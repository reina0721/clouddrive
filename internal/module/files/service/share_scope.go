package service

import (
	"context"
	"errors"
	"io"
	"reflect"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

// ShareFileAction 是一次用例的意图，不能由任意字符串或请求owner扩大范围。
type ShareFileAction string

const (
	ShareActionBrowse   ShareFileAction = "browse"
	ShareActionPreview  ShareFileAction = "preview"
	ShareActionDownload ShareFileAction = "download"
	ShareActionCreate   ShareFileAction = "create"
	ShareActionUpload   ShareFileAction = "upload"
	ShareActionModify   ShareFileAction = "modify"
	ShareActionRename   ShareFileAction = "rename"
	ShareActionMove     ShareFileAction = "move"
	ShareActionCopy     ShareFileAction = "copy"
	ShareActionTrash    ShareFileAction = "trash"
)

func (a ShareFileAction) permission() model.SharePermission {
	switch a {
	case ShareActionBrowse:
		return model.ShareBrowse
	case ShareActionPreview:
		return model.SharePreview
	case ShareActionDownload:
		return model.ShareDownload
	case ShareActionCreate:
		return model.ShareCreate
	case ShareActionUpload:
		return model.ShareUpload
	case ShareActionModify:
		return model.ShareModify
	case ShareActionRename:
		return model.ShareRename
	case ShareActionMove:
		return model.ShareMove
	case ShareActionCopy:
		return model.ShareCopy
	case ShareActionTrash:
		return model.ShareTrash
	default:
		return 0
	}
}
func (a ShareFileAction) accountAccess() ShareAccountAccess {
	switch a {
	case ShareActionBrowse, ShareActionPreview, ShareActionDownload:
		return ShareAccountRead
	default:
		return ShareAccountWrite
	}
}

type SharedFileRepository interface {
	ReadShareBinding(context.Context, string) (model.Share, error)
	ReadShare(context.Context, string, string, int) (ShareSnapshot, error)
	ChangeSharedFiles(context.Context, string, string, int, func(ShareSnapshot) ([]model.Entry, error)) ([]model.Entry, error)
}

// ShareAccess 是明确绑定到本次读取策略版本的请求范围，不持有原始链接或密码。
type ShareAccess struct {
	AudienceSubject   string
	ShareID           string
	ShareRevision     int64
	TokenDigest       string
	GrantDigest       string
	Action            ShareFileAction
	Targets           []string
	Destination       *string
	ExpectedRevision  int64
	ExpectedUpdatedAt *time.Time
}
type SharedSelection struct {
	Targets           []string
	Destination       *string
	ExpectedRevision  int64
	ExpectedUpdatedAt *time.Time
}

func (s *Sharing) validateAccess(ctx context.Context, snapshot ShareSnapshot, access ShareAccess) error {
	share := snapshot.Share
	if share.ID != access.ShareID || share.Revision != access.ShareRevision || shareStatus(share, snapshot.Entries, s.files.clock.Now().UTC()) != ShareActive {
		return model.ErrMissing
	}
	if !s.authorized(snapshot) {
		return model.ErrShareLocked
	}
	permission := access.Action.permission()
	if permission == 0 {
		return model.ErrShareForbidden
	}
	viewer, err := s.accounts.ShareViewer(ctx)
	if err != nil {
		return err
	}
	if viewer.AccountID != access.AudienceSubject {
		return model.ErrShareForbidden
	}
	resolver, resolverErr := model.NewShareAccessResolver(snapshot.Entries, share, viewer)
	if resolverErr != nil {
		return resolverErr
	}
	check := func(id string, required model.SharePermission) error {
		decision, err := resolver.Decision(id)
		if err != nil {
			return err
		}
		if !decision.Permissions.Allows(required) {
			return model.ErrShareForbidden
		}
		return nil
	}
	if len(access.Targets) == 0 && access.Destination == nil {
		if err := check(share.RootID, permission); err != nil {
			return err
		}
	}
	for _, id := range access.Targets {
		entry, ok := model.Find(snapshot.Entries, id)
		if !ok {
			return model.ErrMissing
		}
		if err := check(id, permission); err != nil {
			return err
		}
		if entry.Kind == model.Folder && (access.Action == ShareActionCopy || access.Action == ShareActionMove || access.Action == ShareActionTrash || access.Action == ShareActionDownload) {
			tree, treeErr := newQueryTree(ctx, snapshot.Entries, id)
			if treeErr != nil {
				return treeErr
			}
			for _, child := range snapshot.Entries {
				visible, err := tree.walk(ctx, child.ID, walkVisibility)
				if err != nil {
					return err
				}
				if !visible {
					continue
				}
				inside, err := tree.walk(ctx, child.ID, walkDescendants)
				if err != nil {
					return err
				}
				if inside {
					if err := check(child.ID, permission); err != nil {
						return err
					}
				}
			}
		}
		if id == share.RootID && (access.Action == ShareActionRename || access.Action == ShareActionMove || access.Action == ShareActionTrash) {
			return model.ErrShareForbidden
		}
		if access.ExpectedRevision > 0 && entry.ContentRevision != access.ExpectedRevision {
			return model.ErrConflict
		}
		if access.ExpectedUpdatedAt != nil && !entry.UpdatedAt.Equal(*access.ExpectedUpdatedAt) {
			return model.ErrConflict
		}
	}
	if access.Destination != nil {
		parent, ok := model.Find(snapshot.Entries, *access.Destination)
		if !ok || parent.Kind != model.Folder {
			return model.ErrMissing
		}
		required := permission
		if access.Action == ShareActionCopy || access.Action == ShareActionMove {
			required = model.ShareCreate
		}
		if err := check(parent.ID, required); err != nil {
			return err
		}
	}
	return nil
}

func (s *Sharing) scope(ctx context.Context, token, ticket string, action ShareFileAction, selection SharedSelection) (*Service, ShareAccess, string, error) {
	snapshot, err := s.inspect(ctx, token, ticket)
	if err != nil {
		return nil, ShareAccess{}, "", err
	}
	if !s.authorized(snapshot) {
		return nil, ShareAccess{}, "", model.ErrShareLocked
	}
	if err := s.authorizeAccount(ctx, snapshot.Share.OwnerID, action.accountAccess()); err != nil {
		return nil, ShareAccess{}, "", err
	}
	viewer, viewerErr := s.accounts.ShareViewer(ctx)
	if viewerErr != nil {
		return nil, ShareAccess{}, "", viewerErr
	}
	access := ShareAccess{AudienceSubject: viewer.AccountID, ShareID: snapshot.Share.ID, ShareRevision: snapshot.Share.Revision, TokenDigest: credentialDigest("share", token), Action: action, Targets: append([]string(nil), selection.Targets...), ExpectedRevision: selection.ExpectedRevision, ExpectedUpdatedAt: selection.ExpectedUpdatedAt}
	if ticket != "" {
		if !validSecret(ticket) {
			return nil, ShareAccess{}, "", model.ErrShareLocked
		}
		access.GrantDigest = credentialDigest("grant", ticket)
	}
	if selection.Destination != nil {
		destination := *selection.Destination
		if destination == "" {
			destination = snapshot.Share.RootID
		}
		access.Destination = &destination
	}
	if err := s.validateAccess(ctx, snapshot, access); err != nil {
		return nil, ShareAccess{}, "", err
	}
	return s.scopedService(snapshot.Share.OwnerID, access), access, snapshot.Share.OwnerID, nil
}

// scopedService 复用同一内容、配额、Clock和I/O名额；只显式改变授权仓储，不创建第二套资源。
func (s *Sharing) scopedService(owner string, access ShareAccess) *Service {
	repository := &shareScopedRepository{sharing: s, base: s.files.repo, store: s.shared, owner: owner, access: access, treeLimit: s.files.policy.SearchTreeEntries}
	return &Service{repo: repository, content: &shareScopedContent{base: s.files.content, repository: repository}, clock: s.files.clock, ids: s.files.ids, policy: s.files.policy, slots: s.files.slots, names: s.files.names}
}

type shareScopedRepository struct {
	sharing   *Sharing
	base      Repository
	store     SharedFileRepository
	owner     string
	access    ShareAccess
	treeLimit int
}

func (r *shareScopedRepository) snapshot(ctx context.Context, owner string, limit int) (ShareSnapshot, error) {
	if owner != r.owner || limit < 1 || limit > r.treeLimit {
		return ShareSnapshot{}, model.ErrInvalid
	}
	if err := r.sharing.authorizeAccount(ctx, owner, r.access.Action.accountAccess()); err != nil {
		return ShareSnapshot{}, err
	}
	snapshot, err := r.store.ReadShare(ctx, r.access.TokenDigest, r.access.GrantDigest, limit)
	if err != nil {
		return ShareSnapshot{}, err
	}
	if snapshot.Share.OwnerID != owner {
		return ShareSnapshot{}, model.ErrMissing
	}
	if err := r.sharing.validateAccess(ctx, snapshot, r.access); err != nil {
		return ShareSnapshot{}, err
	}
	return snapshot, nil
}
func scopedReadEntries(snapshot ShareSnapshot) []model.Entry {
	result := []model.Entry{}
	for _, entry := range snapshot.Entries {
		if model.Visible(snapshot.Entries, entry) && Within(snapshot.Entries, snapshot.Share.RootID, entry.ID) {
			if entry.ID == snapshot.Share.RootID {
				entry.ParentID = ""
			}
			result = append(result, entry)
		}
	}
	return result
}
func (r *shareScopedRepository) Read(ctx context.Context, owner string) ([]model.Entry, error) {
	return r.ReadBounded(ctx, owner, r.treeLimit)
}
func (r *shareScopedRepository) ReadBounded(ctx context.Context, owner string, limit int) ([]model.Entry, error) {
	snapshot, err := r.snapshot(ctx, owner, limit)
	if err != nil {
		return nil, err
	}
	return scopedReadEntries(snapshot), nil
}
func (r *shareScopedRepository) Change(ctx context.Context, owner string, change func([]model.Entry) (model.Entry, error)) (model.Entry, error) {
	changed, err := r.ChangeMany(ctx, owner, func(entries []model.Entry) ([]model.Entry, error) {
		entry, err := change(entries)
		if err != nil {
			return nil, err
		}
		return []model.Entry{entry}, nil
	})
	if err != nil {
		return model.Entry{}, err
	}
	if len(changed) != 1 {
		return model.Entry{}, model.ErrInvalid
	}
	return changed[0], nil
}
func (r *shareScopedRepository) ChangeMany(ctx context.Context, owner string, change func([]model.Entry) ([]model.Entry, error)) ([]model.Entry, error) {
	return r.ChangeManyBounded(ctx, owner, r.treeLimit, change)
}
func (r *shareScopedRepository) ChangeManyBounded(ctx context.Context, owner string, limit int, change func([]model.Entry) ([]model.Entry, error)) ([]model.Entry, error) {
	if owner != r.owner || limit < 1 || limit > r.treeLimit || change == nil || r.access.Action.accountAccess() != ShareAccountWrite {
		return nil, model.ErrShareForbidden
	}
	if err := r.sharing.authorizeAccount(ctx, owner, ShareAccountWrite); err != nil {
		return nil, err
	}
	return r.store.ChangeSharedFiles(ctx, r.access.TokenDigest, r.access.GrantDigest, limit, func(snapshot ShareSnapshot) ([]model.Entry, error) {
		if snapshot.Share.OwnerID != owner {
			return nil, model.ErrMissing
		}
		if err := r.sharing.validateAccess(ctx, snapshot, r.access); err != nil {
			return nil, err
		}
		changed, err := change(snapshot.Entries)
		if err != nil {
			return nil, err
		}
		merged := append([]model.Entry(nil), snapshot.Entries...)
		for _, entry := range changed {
			replaced := false
			for index := range merged {
				if merged[index].ID == entry.ID {
					merged[index] = entry
					replaced = true
					break
				}
			}
			if !replaced {
				merged = append(merged, entry)
			}
		}
		if len(merged) > limit {
			return nil, model.ErrTooLarge
		}
		for _, entry := range changed {
			previous, exists := model.Find(snapshot.Entries, entry.ID)
			if exists && (previous.AccessPolicyRevision != entry.AccessPolicyRevision || !reflect.DeepEqual(previous.AccessPolicy, entry.AccessPolicy)) {
				return nil, model.ErrShareForbidden
			}
			if entry.OwnerID != owner || exists && !Within(snapshot.Entries, snapshot.Share.RootID, entry.ID) || !Within(merged, snapshot.Share.RootID, entry.ID) {
				return nil, model.ErrShareForbidden
			}
			if entry.ID == snapshot.Share.RootID && (r.access.Action != ShareActionModify || previous.Kind != model.File || entry.ParentID != previous.ParentID || entry.Name != previous.Name || entry.TrashedAt != nil) {
				return nil, model.ErrShareForbidden
			}
		}
		return changed, nil
	})
}

// RecordCleanup 在策略失效后仍记录本次候选补偿，不能让撤销阻止资源回收。
func (r *shareScopedRepository) RecordCleanup(ctx context.Context, owner, key string) error {
	if owner != r.owner {
		return model.ErrMissing
	}
	return r.base.RecordCleanup(ctx, owner, key)
}

type shareScopedContent struct {
	base       Content
	repository *shareScopedRepository
}

func (c *shareScopedContent) Put(ctx context.Context, key string, payload []byte, mediaType string) error {
	return c.base.Put(ctx, key, payload, mediaType)
}
func (c *shareScopedContent) Delete(ctx context.Context, key string) error {
	return c.base.Delete(ctx, key)
}
func (c *shareScopedContent) check(ctx context.Context, key string) error {
	entries, err := c.repository.Read(ctx, c.repository.owner)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		if entry.Kind == model.File && entry.ObjectKey == key {
			return nil
		}
	}
	return model.ErrMissing
}
func (c *shareScopedContent) WithReader(ctx context.Context, key string, use func(io.ReadSeeker, int64) error) error {
	if err := c.check(ctx, key); err != nil {
		return err
	}
	return c.base.WithReader(ctx, key, func(reader io.ReadSeeker, size int64) error { return errors.Join(use(reader, size), c.check(ctx, key)) })
}
