package iam

import (
	"context"
	"errors"
	"sort"

	"github.com/reina0721/clouddrive/internal/module/iam/model"
	"github.com/reina0721/clouddrive/internal/module/iam/repo"
	"github.com/reina0721/clouddrive/pkg/clock"
)

// ErrAudienceUnavailable 不区分不存在、已禁用和归档主体，避免查找泄露生命周期。
var ErrAudienceUnavailable = errors.New("collaboration audience unavailable")

// AudienceTarget 只投影选择器需要的稳定ID与标签，不输出会话或权限快照。
type AudienceTarget struct{ ID, Label string }

// AudienceIdentity 是当前有效账号与角色事实，不承载文件授权规则。
type AudienceIdentity struct {
	AudienceTarget
	RoleIDs       []string
	Administrator bool
}

// CollaborationDirectory 是文件分享消费的窄事实入口，所有读取仍由IAM拥有。
type CollaborationDirectory interface {
	AudienceAccount(context.Context, string) (AudienceIdentity, error)
	AudienceRole(context.Context, string) (AudienceTarget, error)
	FindAudienceAccount(context.Context, string) (AudienceTarget, error)
	FindAudienceRole(context.Context, string) (AudienceTarget, error)
}

type collaborationDirectory struct {
	store *repo.Store
	clock clock.Clock
}

func (d collaborationDirectory) accountUsable(account repo.AccountRecord) bool {
	return !account.Archived && account.Status == string(model.AccountActive) && !account.MustChangePassword && (account.LockedUntil == nil || !d.clock.Now().Before(*account.LockedUntil))
}

func accountAudienceTarget(account repo.AccountRecord) AudienceTarget {
	label := account.DisplayName
	if label == "" {
		label = account.Username
	}
	return AudienceTarget{ID: account.ID, Label: label}
}

func (d collaborationDirectory) AudienceAccount(ctx context.Context, id string) (AudienceIdentity, error) {
	account, roles, err := d.store.CollaborationAccount(ctx, id)
	if errors.Is(err, repo.ErrNotFound) {
		return AudienceIdentity{}, errors.Join(ErrAudienceUnavailable, err)
	}
	if err != nil {
		return AudienceIdentity{}, err
	}
	if !d.accountUsable(account) {
		return AudienceIdentity{}, ErrAudienceUnavailable
	}
	result := AudienceIdentity{AudienceTarget: accountAudienceTarget(account), RoleIDs: []string{}}
	for _, role := range roles {
		result.RoleIDs = append(result.RoleIDs, role.ID)
		if role.System && role.Code == model.OwnerRoleCode {
			result.Administrator = true
		}
	}
	sort.Strings(result.RoleIDs)
	return result, nil
}

func (d collaborationDirectory) AudienceRole(ctx context.Context, id string) (AudienceTarget, error) {
	role, err := d.store.CollaborationRole(ctx, id)
	if errors.Is(err, repo.ErrNotFound) {
		return AudienceTarget{}, errors.Join(ErrAudienceUnavailable, err)
	}
	if err != nil {
		return AudienceTarget{}, err
	}
	if !role.Active || role.Archived {
		return AudienceTarget{}, ErrAudienceUnavailable
	}
	return AudienceTarget{ID: role.ID, Label: role.Name}, nil
}

func (d collaborationDirectory) FindAudienceAccount(ctx context.Context, username string) (AudienceTarget, error) {
	username, err := model.NormalizeUsername(username)
	if err != nil {
		return AudienceTarget{}, errors.Join(ErrAudienceUnavailable, err)
	}
	account, err := d.store.CollaborationAccountByUsername(ctx, username)
	if errors.Is(err, repo.ErrNotFound) {
		return AudienceTarget{}, errors.Join(ErrAudienceUnavailable, err)
	}
	if err != nil {
		return AudienceTarget{}, err
	}
	if !d.accountUsable(account) {
		return AudienceTarget{}, ErrAudienceUnavailable
	}
	return accountAudienceTarget(account), nil
}

func (d collaborationDirectory) FindAudienceRole(ctx context.Context, code string) (AudienceTarget, error) {
	code, err := model.NormalizeRoleCode(code)
	if err != nil {
		return AudienceTarget{}, errors.Join(ErrAudienceUnavailable, err)
	}
	role, err := d.store.CollaborationRoleByCode(ctx, code)
	if errors.Is(err, repo.ErrNotFound) {
		return AudienceTarget{}, errors.Join(ErrAudienceUnavailable, err)
	}
	if err != nil {
		return AudienceTarget{}, err
	}
	if !role.Active || role.Archived {
		return AudienceTarget{}, ErrAudienceUnavailable
	}
	return AudienceTarget{ID: role.ID, Label: role.Name}, nil
}
