package service

import (
	"context"
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

const (
	DefaultShareActiveLimit  = 200
	SharePageSize            = 20
	DefaultShareBatchEntries = 20
	MaxShareTitleBytes       = 255
)

type ShareAccountAccess string

const (
	ShareAccountRead  ShareAccountAccess = "read"
	ShareAccountWrite ShareAccountAccess = "write"
)

type ShareAccountAuthority interface {
	ShareAudienceAuthority
	AuthorizeShare(context.Context, string, ShareAccountAccess) (bool, error)
}

type ShareCreate struct {
	Audience    *ShareAudience    `json:"audience,omitempty"`
	RootID      string            `json:"rootId" minLength:"36" maxLength:"36"`
	Password    string            `json:"password,omitempty" maxLength:"128"`
	ExpiresAt   *time.Time        `json:"expiresAt,omitempty"`
	Title       string            `json:"title,omitempty" maxLength:"255"`
	Permissions *SharePermissions `json:"permissions,omitempty"`
}

type SharePasswordAction string

const (
	SharePasswordKeep   SharePasswordAction = "keep"
	SharePasswordSet    SharePasswordAction = "set"
	SharePasswordRemove SharePasswordAction = "remove"
)

type ShareUpdate struct {
	Audience       ShareAudience       `json:"audience"`
	Revision       int64               `json:"revision" minimum:"1" maximum:"9007199254740990"`
	Title          string              `json:"title" maxLength:"255"`
	ExpiresAt      time.Time           `json:"expiresAt"`
	Permissions    SharePermissions    `json:"permissions"`
	PasswordAction SharePasswordAction `json:"passwordAction" enum:"keep,set,remove"`
	Password       string              `json:"password" maxLength:"128"`
}
type ShareQuery struct {
	Search string `json:"search"`
	State  string `json:"state"`
	Sort   string `json:"sort"`
	Page   int    `json:"page"`
}
type ShareRecordPage struct {
	Items []model.Share
	Roots []model.Entry
	Total int
}
type ShareListing struct {
	Items           []ShareSummary `json:"items"`
	Total           int            `json:"total"`
	Page            int            `json:"page"`
	PageSize        int            `json:"pageSize"`
	MetadataLimited bool           `json:"metadataLimited"`
}

// ShareManagementRepository 不读取整套历史链接来更新一个策略，也不让修改覆盖密码尝试窗口。
type ShareManagementRepository interface {
	RelatedSharePolicies(context.Context, string, []string, int, time.Time) ([]model.Share, error)
	CreateShare(context.Context, string, int, int, time.Time, func([]model.Entry) (model.Share, error)) (model.Share, error)
	ReadOwnedShare(context.Context, string, string) (model.Share, model.Entry, error)
	ChangeSharePolicy(context.Context, string, string, int, time.Time, func(model.Share) (model.Share, error)) (model.Share, error)
	QueryShares(context.Context, string, ShareQuery, time.Time) (ShareRecordPage, error)
}

func validShareTitle(value string) bool {
	return len(value) <= MaxShareTitleBytes && utf8.ValidString(value) && strings.IndexFunc(value, func(r rune) bool { return r < 32 || r == 127 }) < 0
}
func (s *Sharing) authorizeAccount(ctx context.Context, owner string, access ShareAccountAccess) error {
	allowed, err := s.accounts.AuthorizeShare(ctx, owner, access)
	if err != nil {
		return err
	}
	if !allowed {
		return model.ErrShareForbidden
	}
	return nil
}
func (s *Sharing) hashPassword(ctx context.Context, password string) (string, error) {
	if !utf8.ValidString(password) || len(password) < minSharePasswordBytes || len(password) > maxSharePasswordBytes {
		return "", model.ErrInvalid
	}
	release, err := s.acquireKDF(ctx)
	if err != nil {
		return "", err
	}
	defer release()
	hash, err := s.passwords.Hash(password)
	if err != nil {
		return "", err
	}
	if err := ctx.Err(); err != nil {
		return "", err
	}
	return hash, nil
}
func (s *Sharing) managedSummary(ctx context.Context, owner string, share model.Share, root model.Entry) (ShareSummary, error) {
	entries, err := s.files.repo.ReadBounded(ctx, owner, s.files.policy.SearchTreeEntries)
	limited := errors.Is(err, model.ErrTooLarge)
	if err != nil && !limited {
		return ShareSummary{}, err
	}
	result := summary(share, entries, s.files.clock.Now().UTC())
	if err := s.labelAudience(ctx, &result.Audience); err != nil {
		return ShareSummary{}, err
	}
	result.Name = root.Name
	if root.Kind == model.File || root.Kind == model.Folder {
		kind := root.Kind
		result.Kind = &kind
	}
	result.MetadataLimited = limited
	if limited && result.Status == ShareUnavailable {
		result.Status = ShareLimited
	}
	return result, nil
}
func (s *Sharing) ReadManaged(ctx context.Context, owner, id string) (ShareSummary, error) {
	share, root, err := s.store.ReadOwnedShare(ctx, owner, id)
	if err != nil {
		return ShareSummary{}, err
	}
	return s.managedSummary(ctx, owner, share, root)
}
func (s *Sharing) List(ctx context.Context, owner string, query ShareQuery) (ShareListing, error) {
	if query.Page == 0 {
		query.Page = 1
	}
	if query.Page < 1 || query.Page > 100000 || len([]rune(query.Search)) > 200 || !utf8.ValidString(query.Search) {
		return ShareListing{}, model.ErrInvalid
	}
	if query.Sort == "" {
		query.Sort = "newest"
	}
	if query.Sort != "newest" && query.Sort != "oldest" && query.Sort != "name" {
		return ShareListing{}, model.ErrInvalid
	}
	switch query.State {
	case "", "active", "paused", "expired", "revoked":
	default:
		return ShareListing{}, model.ErrInvalid
	}
	page, err := s.store.QueryShares(ctx, owner, query, s.files.clock.Now().UTC())
	if err != nil {
		return ShareListing{}, err
	}
	entries, err := s.files.repo.ReadBounded(ctx, owner, s.files.policy.SearchTreeEntries)
	limited := errors.Is(err, model.ErrTooLarge)
	if err != nil && !limited {
		return ShareListing{}, err
	}
	result := ShareListing{Items: []ShareSummary{}, Total: page.Total, Page: query.Page, PageSize: SharePageSize, MetadataLimited: limited}
	for _, share := range page.Items {
		item := summary(share, entries, s.files.clock.Now().UTC())
		root, _ := model.Find(page.Roots, share.RootID)
		item.Name = root.Name
		if root.Kind == model.File || root.Kind == model.Folder {
			kind := root.Kind
			item.Kind = &kind
		}
		item.MetadataLimited = limited
		if limited && item.Status == ShareUnavailable {
			item.Status = ShareLimited
		}
		result.Items = append(result.Items, item)
	}
	return result, nil
}
func (s *Sharing) Update(ctx context.Context, owner, id string, input ShareUpdate) (ShareSummary, error) {
	if !validShareTitle(input.Title) || !input.Permissions.permissionSet().Valid() || input.Revision < 1 || input.Revision >= model.MaxContentRevision {
		return ShareSummary{}, model.ErrInvalid
	}
	now := s.files.clock.Now().UTC()
	if err := input.Audience.model().Validate(); err != nil {
		return ShareSummary{}, err
	}
	expiry := input.ExpiresAt.UTC()
	var hash string
	switch input.PasswordAction {
	case SharePasswordKeep, SharePasswordRemove:
		if input.Password != "" {
			return ShareSummary{}, model.ErrInvalid
		}
	case SharePasswordSet:
		var err error
		hash, err = s.hashPassword(ctx, input.Password)
		if err != nil {
			return ShareSummary{}, err
		}
	default:
		return ShareSummary{}, model.ErrInvalid
	}
	_, err := s.store.ChangeSharePolicy(ctx, owner, id, s.policy.ActiveLimit, now, func(share model.Share) (model.Share, error) {
		if share.RevokedAt != nil || share.Revision != input.Revision {
			return share, model.ErrConflict
		}
		// 过期链接仍可维护标题或密码；只有修改有效期时才要求新的未来时间。
		if !expiry.Equal(share.ExpiresAt) && (!expiry.After(now) || expiry.After(now.Add(s.policy.MaxAge))) {
			return share, model.ErrInvalid
		}
		audience := input.Audience.model()
		if err := s.validateAudienceTargets(ctx, audience, share.Audience); err != nil {
			return share, err
		}
		share.Audience = audience
		share.Title, share.Permissions, share.ExpiresAt = input.Title, input.Permissions.permissionSet(), expiry
		if input.PasswordAction != SharePasswordKeep {
			share.PasswordHash = hash
		}
		share.Revision++
		return share, nil
	})
	if err != nil {
		return ShareSummary{}, err
	}
	return s.ReadManaged(ctx, owner, id)
}
func (s *Sharing) SetEnabled(ctx context.Context, owner, id string, revision int64, enabled bool) (ShareSummary, error) {
	if revision < 1 || revision >= model.MaxContentRevision {
		return ShareSummary{}, model.ErrInvalid
	}
	_, err := s.store.ChangeSharePolicy(ctx, owner, id, s.policy.ActiveLimit, s.files.clock.Now().UTC(), func(share model.Share) (model.Share, error) {
		if share.RevokedAt != nil || share.Revision != revision || enabled && !s.files.clock.Now().Before(share.ExpiresAt) {
			return share, model.ErrConflict
		}
		state := model.SharePaused
		if enabled {
			state = model.ShareEnabled
		}
		if state != share.State {
			share.State = state
			share.Revision++
		}
		return share, nil
	})
	if err != nil {
		return ShareSummary{}, err
	}
	return s.ReadManaged(ctx, owner, id)
}
