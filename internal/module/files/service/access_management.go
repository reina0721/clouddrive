package service

import (
	"context"
	"errors"
	"github.com/reina0721/clouddrive/internal/module/files/model"
)

// FileAccessPolicy 是维护入口使用的可读能力策略，不暴露内部位集合。
type FileAccessPolicy struct {
	Default  SharePermissions `json:"default"`
	Audience ShareAudience    `json:"audience"`
}

func fileAccessPolicy(p *model.AccessPolicy) *FileAccessPolicy {
	if p == nil {
		return nil
	}
	return &FileAccessPolicy{Default: sharePermissions(p.Default), Audience: audienceFromModel(p.Audience)}
}

func (p FileAccessPolicy) model() model.AccessPolicy {
	return model.AccessPolicy{Default: p.Default.permissionSet(), Audience: p.Audience.model()}
}

// AccessSource 只投影拥有者可见的权限来源条目。
type AccessSource struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// AccessShareContext 定位实际有效分享，不向预览选择器返回访问凭据。
type AccessShareContext struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	RootName string `json:"rootName"`
}

// FileAccessDetail 返回本项草稿基线及最近独立祖先；nil策略表示继承。
type FileAccessDetail struct {
	Entry         model.Entry          `json:"entry"`
	Revision      int64                `json:"revision"`
	Policy        *FileAccessPolicy    `json:"policy"`
	InheritedFrom *AccessSource        `json:"inheritedFrom"`
	Shares        []AccessShareContext `json:"shares"`
	MaxRules      int                  `json:"maxRules"`
}

// FileAccessUpdate 以策略修订号执行比较并交换，nil明确恢复继承。
type FileAccessUpdate struct {
	Revision int64             `json:"revision" minimum:"0" maximum:"9007199254740990"`
	Policy   *FileAccessPolicy `json:"policy"`
}

// EffectiveFileAccess 是实际分享与可信身份下已保存策略的计算结果。
type EffectiveFileAccess struct {
	Permissions SharePermissions   `json:"permissions"`
	Reason      model.AccessReason `json:"reason"`
	Source      *AccessSource      `json:"source"`
}

func accessAncestors(entries []model.Entry, id string) ([]model.Entry, error) {
	var result []model.Entry
	seen := map[string]bool{}
	for remaining := len(entries) + 1; remaining > 0; remaining-- {
		entry, ok := model.Find(entries, id)
		if !ok || seen[id] {
			return nil, model.ErrMissing
		}
		seen[id] = true
		result = append(result, entry)
		if entry.ParentID == "" {
			return result, nil
		}
		id = entry.ParentID
	}
	return nil, model.ErrInvalid
}

func (s *Sharing) accessEntries(ctx context.Context, owner, id string) ([]model.Entry, model.Entry, error) {
	entries, err := s.files.repo.ReadBounded(ctx, owner, s.files.policy.SearchTreeEntries)
	if err != nil {
		return nil, model.Entry{}, err
	}
	entry, ok := model.Find(entries, id)
	if !ok || !model.Visible(entries, entry) {
		return nil, model.Entry{}, model.ErrMissing
	}
	if entry.Kind == model.Shortcut {
		return nil, model.Entry{}, model.ErrUnsupported
	}
	return entries, entry, nil
}

func (s *Sharing) labelAudience(ctx context.Context, audience *ShareAudience) error {
	for _, group := range []struct {
		kind  AudienceKind
		rules []AudienceRule
	}{{AudienceAccount, audience.Accounts}, {AudienceRole, audience.Roles}} {
		for index := range group.rules {
			target, err := s.accounts.AudienceTarget(ctx, group.kind, group.rules[index].SubjectID)
			if errors.Is(err, model.ErrMissing) {
				continue
			}
			if err != nil {
				return err
			}
			group.rules[index].Label = target.Label
		}
	}
	return nil
}

// ReadAccess 读取拥有者的策略和有效分享上下文，不改变文件内容修订。
func (s *Sharing) ReadAccess(ctx context.Context, owner, id string) (FileAccessDetail, error) {
	entries, entry, err := s.accessEntries(ctx, owner, id)
	if err != nil {
		return FileAccessDetail{}, err
	}
	ancestors, err := accessAncestors(entries, id)
	if err != nil {
		return FileAccessDetail{}, err
	}
	result := FileAccessDetail{Entry: entry, Revision: entry.AccessPolicyRevision, Policy: fileAccessPolicy(entry.AccessPolicy), Shares: []AccessShareContext{}, MaxRules: model.MaxAudienceRules}
	ids := make([]string, 0, len(ancestors))
	for index, ancestor := range ancestors {
		ids = append(ids, ancestor.ID)
		if index > 0 && result.InheritedFrom == nil && ancestor.AccessPolicy != nil {
			result.InheritedFrom = &AccessSource{ID: ancestor.ID, Name: ancestor.Name}
		}
	}
	shares, err := s.store.RelatedSharePolicies(ctx, owner, ids, s.policy.ActiveLimit, s.files.clock.Now().UTC())
	if err != nil {
		return FileAccessDetail{}, err
	}
	for _, share := range shares {
		if shareStatus(share, entries, s.files.clock.Now().UTC()) != ShareActive {
			continue
		}
		root, _ := model.Find(entries, share.RootID)
		result.Shares = append(result.Shares, AccessShareContext{ID: share.ID, Title: share.Title, RootName: root.Name})
	}
	if result.Policy != nil {
		if err := s.labelAudience(ctx, &result.Policy.Audience); err != nil {
			return FileAccessDetail{}, err
		}
	}
	return result, nil
}

// UpdateAccess 在拥有者文件事务内校验修订及新增主体，只更新本项策略。
func (s *Sharing) UpdateAccess(ctx context.Context, owner, id string, input FileAccessUpdate) (FileAccessDetail, error) {
	if input.Revision < 0 || input.Revision >= model.MaxContentRevision {
		return FileAccessDetail{}, model.ErrInvalid
	}
	var policy *model.AccessPolicy
	if input.Policy != nil {
		converted := input.Policy.model()
		if err := converted.Validate(); err != nil {
			return FileAccessDetail{}, err
		}
		policy = &converted
	}
	_, err := s.files.repo.ChangeManyBounded(ctx, owner, s.files.policy.SearchTreeEntries, func(entries []model.Entry) ([]model.Entry, error) {
		entry, ok := model.Find(entries, id)
		if !ok || !model.Visible(entries, entry) {
			return nil, model.ErrMissing
		}
		if entry.Kind == model.Shortcut {
			return nil, model.ErrUnsupported
		}
		if entry.AccessPolicyRevision != input.Revision {
			return nil, model.ErrConflict
		}
		if policy != nil {
			previous := model.AudiencePolicy{}
			if entry.AccessPolicy != nil {
				previous = entry.AccessPolicy.Audience
			}
			if err := s.validateAudienceTargets(ctx, policy.Audience, previous); err != nil {
				return nil, err
			}
		}
		entry.AccessPolicy = model.CloneAccessPolicy(policy)
		entry.AccessPolicyRevision++
		return []model.Entry{entry}, nil
	})
	if err != nil {
		return FileAccessDetail{}, err
	}
	return s.ReadAccess(ctx, owner, id)
}

// PreviewAccess 按服务器当前账号事实计算已保存策略；空账号表示匿名。
func (s *Sharing) PreviewAccess(ctx context.Context, owner, id, shareID, accountID string) (EffectiveFileAccess, error) {
	entries, _, err := s.accessEntries(ctx, owner, id)
	if err != nil {
		return EffectiveFileAccess{}, err
	}
	share, _, err := s.store.ReadOwnedShare(ctx, owner, shareID)
	if err != nil {
		return EffectiveFileAccess{}, err
	}
	if shareStatus(share, entries, s.files.clock.Now().UTC()) != ShareActive {
		return EffectiveFileAccess{}, model.ErrMissing
	}
	viewer := model.ShareViewer{}
	if accountID != "" {
		viewer, err = s.accounts.AudienceAccount(ctx, accountID)
		if err != nil {
			return EffectiveFileAccess{}, err
		}
	}
	decision, err := model.EffectiveAccess(entries, share, id, viewer)
	if err != nil {
		return EffectiveFileAccess{}, err
	}
	result := EffectiveFileAccess{Permissions: sharePermissions(decision.Permissions), Reason: decision.Reason}
	if decision.SourceEntryID != "" {
		entry, _ := model.Find(entries, decision.SourceEntryID)
		result.Source = &AccessSource{ID: entry.ID, Name: entry.Name}
	}
	return result, nil
}
