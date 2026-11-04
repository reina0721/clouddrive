package service

import (
	"context"
	"fmt"
	"time"
	"unicode/utf8"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

const (
	DefaultShareMaxAge         = 30 * 24 * time.Hour
	DefaultShareGrantTTL       = 15 * time.Minute
	DefaultShareAttemptWindow  = time.Minute
	DefaultShareAttemptLimit   = 10
	DefaultShareKDFConcurrency = 2
	DefaultShareDownloadTTL    = time.Minute
	DefaultShareDownloadLimit  = 100
	minSharePasswordBytes      = 8
	maxSharePasswordBytes      = 128
)

type SharePolicy struct {
	ActiveLimit    int
	BatchEntries   int
	MaxAge         time.Duration
	GrantTTL       time.Duration
	AttemptWindow  time.Duration
	AttemptLimit   int
	KDFConcurrency int
	DownloadTTL    time.Duration
	DownloadLimit  int
}

func DefaultSharePolicy() SharePolicy {
	return SharePolicy{ActiveLimit: DefaultShareActiveLimit, BatchEntries: DefaultShareBatchEntries, MaxAge: DefaultShareMaxAge, GrantTTL: DefaultShareGrantTTL, AttemptWindow: DefaultShareAttemptWindow, AttemptLimit: DefaultShareAttemptLimit, KDFConcurrency: DefaultShareKDFConcurrency, DownloadTTL: DefaultShareDownloadTTL, DownloadLimit: DefaultShareDownloadLimit}
}
func (p SharePolicy) Validate() error {
	if p.BatchEntries < 1 || p.BatchEntries > DefaultShareBatchEntries || p.ActiveLimit < 1 || p.ActiveLimit > DefaultShareActiveLimit {
		return fmt.Errorf("invalid share active limit")
	}
	if p.DownloadTTL <= 0 || p.DownloadTTL > DefaultShareDownloadTTL || p.DownloadTTL > p.GrantTTL || p.DownloadTTL > p.MaxAge || p.DownloadLimit < 1 || p.DownloadLimit > DefaultShareDownloadLimit {
		return fmt.Errorf("invalid share download budgets")
	}
	if p.MaxAge <= 0 || p.MaxAge > DefaultShareMaxAge || p.GrantTTL <= 0 || p.GrantTTL > DefaultShareGrantTTL || p.GrantTTL > p.MaxAge || p.AttemptWindow < DefaultShareAttemptWindow || p.AttemptWindow > time.Hour || p.AttemptLimit < 1 || p.AttemptLimit > DefaultShareAttemptLimit || p.KDFConcurrency < 1 || p.KDFConcurrency > DefaultShareKDFConcurrency {
		return fmt.Errorf("invalid file share budgets")
	}
	return nil
}

type PasscodeHasher interface {
	Hash(string) (string, error)
	Verify(string, string) (bool, error)
}
type ShareSnapshot struct {
	Share   model.Share
	Entries []model.Entry
	Grant   *model.ShareGrant
}
type ShareRepository interface {
	ShareManagementRepository
	ReadShare(context.Context, string, string, int) (ShareSnapshot, error)
	ReadShareTarget(context.Context, string, int) (ShareSnapshot, error)
	ReserveShareAttempt(context.Context, string, time.Time, time.Duration, int) error
	PutShareGrant(context.Context, model.ShareGrant, time.Time) error
	PutDownloadGrant(context.Context, model.ShareGrant, time.Time, int) error
	ReadDownloadGrant(context.Context, string, int) (ShareSnapshot, error)
}
type Sharing struct {
	shared    SharedFileRepository
	accounts  ShareAccountAuthority
	files     *Service
	store     ShareRepository
	passwords PasscodeHasher
	policy    SharePolicy
	slots     chan struct{}
}

func NewSharing(files *Service, store ShareRepository, shared SharedFileRepository, accounts ShareAccountAuthority, passwords PasscodeHasher, policy SharePolicy) (*Sharing, error) {
	if files == nil || store == nil || shared == nil || accounts == nil || passwords == nil {
		return nil, fmt.Errorf("file sharing dependencies incomplete")
	}
	if err := policy.Validate(); err != nil {
		return nil, err
	}
	return &Sharing{files: files, store: store, shared: shared, accounts: accounts, passwords: passwords, policy: policy, slots: make(chan struct{}, policy.KDFConcurrency)}, nil
}

func (s *Sharing) acquireKDF(ctx context.Context) (func(), error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	select {
	case s.slots <- struct{}{}:
		return func() { <-s.slots }, nil
	default:
		return nil, model.ErrBusy
	}
}

// ShareStatus 统一原分享与保存引用的可用性，不代表已获得解锁票据。
type ShareStatus string

const (
	ShareActive      ShareStatus = "active"
	ShareRevoked     ShareStatus = "revoked"
	ShareExpired     ShareStatus = "expired"
	ShareUnavailable ShareStatus = "unavailable"
	SharePaused      ShareStatus = "paused"
	ShareLimited     ShareStatus = "limited"
)

type ShareSummary struct {
	Kind            *model.Kind      `json:"kind"`
	Title           string           `json:"title"`
	Permissions     SharePermissions `json:"permissions"`
	Revision        int64            `json:"revision"`
	Enabled         bool             `json:"enabled"`
	MetadataLimited bool             `json:"metadataLimited"`
	ID              string           `json:"id"`
	Token           string           `json:"token"`
	RootID          string           `json:"rootId"`
	Name            string           `json:"name"`
	HasPassword     bool             `json:"hasPassword"`
	CreatedAt       time.Time        `json:"createdAt"`
	ExpiresAt       time.Time        `json:"expiresAt"`
	Status          ShareStatus      `json:"status"`
}

func shareStatus(share model.Share, entries []model.Entry, now time.Time) ShareStatus {
	if share.RevokedAt != nil {
		return ShareRevoked
	}
	if !now.Before(share.ExpiresAt) {
		return ShareExpired
	}
	if share.State == model.SharePaused {
		return SharePaused
	}
	root, ok := model.Find(entries, share.RootID)
	if !ok || !model.Visible(entries, root) {
		return ShareUnavailable
	}
	return ShareActive
}

// InspectShortcutTarget 只返回当前状态，不向保存者复制根名称或签发解锁票据。
func (s *Sharing) InspectShortcutTarget(ctx context.Context, token string, treeLimit int) (ShortcutTargetState, error) {
	if !validSecret(token) {
		return ShortcutTargetState{}, model.ErrMissing
	}
	snapshot, err := s.store.ReadShareTarget(ctx, credentialDigest("share", token), treeLimit)
	if err != nil {
		return ShortcutTargetState{}, err
	}
	status := shareStatus(snapshot.Share, snapshot.Entries, s.files.clock.Now().UTC())
	return ShortcutTargetState{Status: status, Locked: status == ShareActive && snapshot.Share.PasswordHash != ""}, nil
}
func summary(share model.Share, entries []model.Entry, now time.Time) ShareSummary {
	root, _ := model.Find(entries, share.RootID)
	var kind *model.Kind
	if root.Kind == model.File || root.Kind == model.Folder {
		value := root.Kind
		kind = &value
	}
	return ShareSummary{Kind: kind, Title: share.Title, Permissions: sharePermissions(share.Permissions), Revision: share.Revision, Enabled: share.State == model.ShareEnabled, ID: share.ID, Token: share.Token, RootID: share.RootID, Name: root.Name, HasPassword: share.PasswordHash != "", CreatedAt: share.CreatedAt, ExpiresAt: share.ExpiresAt, Status: shareStatus(share, entries, now)}
}
func (s *Sharing) Create(ctx context.Context, owner string, input ShareCreate) (ShareSummary, error) {
	if owner == "" {
		return ShareSummary{}, model.ErrMissing
	}
	if !validShareTitle(input.Title) {
		return ShareSummary{}, model.ErrInvalid
	}
	permissions := model.ShareReadOnly
	if input.Permissions != nil {
		permissions = input.Permissions.permissionSet()
	}
	if !permissions.Valid() {
		return ShareSummary{}, model.ErrInvalid
	}
	now := s.files.clock.Now().UTC()
	expiry := now.Add(s.policy.MaxAge)
	if input.ExpiresAt != nil {
		expiry = input.ExpiresAt.UTC()
	}
	if !expiry.After(now) || expiry.After(now.Add(s.policy.MaxAge)) {
		return ShareSummary{}, model.ErrInvalid
	}
	var hash string
	if input.Password != "" {
		var err error
		hash, err = s.hashPassword(ctx, input.Password)
		if err != nil {
			return ShareSummary{}, err
		}
	}
	id, err := s.files.ids.New()
	if err != nil {
		return ShareSummary{}, err
	}
	token, err := newCapabilitySecret()
	if err != nil {
		return ShareSummary{}, err
	}
	share, err := s.store.CreateShare(ctx, owner, s.policy.ActiveLimit, s.files.policy.SearchTreeEntries, now, func(entries []model.Entry) (model.Share, error) {
		if !expiry.After(s.files.clock.Now()) {
			return model.Share{}, model.ErrInvalid
		}
		root, found := model.Find(entries, input.RootID)
		if !found || !model.Visible(entries, root) {
			return model.Share{}, model.ErrMissing
		}
		if root.Kind == model.Shortcut {
			return model.Share{}, model.ErrUnsupported
		}
		return model.Share{ID: id, OwnerID: owner, RootID: input.RootID, Token: token, TokenDigest: credentialDigest("share", token), PasswordHash: hash, CreatedAt: now, ExpiresAt: expiry, Title: input.Title, State: model.ShareEnabled, Permissions: permissions, Revision: 1}, nil
	})
	if err != nil {
		return ShareSummary{}, err
	}
	return s.ReadManaged(ctx, owner, share.ID)
}
func (s *Sharing) Revoke(ctx context.Context, owner, id string) (ShareSummary, error) {
	_, err := s.store.ChangeSharePolicy(ctx, owner, id, s.policy.ActiveLimit, s.files.clock.Now().UTC(), func(share model.Share) (model.Share, error) {
		if share.RevokedAt == nil {
			if share.Revision >= model.MaxContentRevision {
				return share, model.ErrConflict
			}
			now := s.files.clock.Now().UTC()
			share.RevokedAt = &now
			share.Revision++
		}
		return share, nil
	})
	if err != nil {
		return ShareSummary{}, err
	}
	return s.ReadManaged(ctx, owner, id)
}

func (s *Sharing) inspect(ctx context.Context, token, ticket string) (ShareSnapshot, error) {
	if !validSecret(token) {
		return ShareSnapshot{}, model.ErrMissing
	}
	grant := ""
	if validSecret(ticket) {
		grant = credentialDigest("grant", ticket)
	}
	snapshot, err := s.store.ReadShare(ctx, credentialDigest("share", token), grant, s.files.policy.SearchTreeEntries)
	if err != nil {
		return ShareSnapshot{}, err
	}
	if err := s.authorizeAccount(ctx, snapshot.Share.OwnerID, ShareAccountRead); err != nil {
		return ShareSnapshot{}, err
	}
	if shareStatus(snapshot.Share, snapshot.Entries, s.files.clock.Now().UTC()) != ShareActive {
		return ShareSnapshot{}, model.ErrMissing
	}
	return snapshot, nil
}
func (s *Sharing) authorized(snapshot ShareSnapshot) bool {
	return snapshot.Share.PasswordHash == "" || snapshot.Grant != nil && snapshot.Grant.EntryID == "" && snapshot.Grant.ShareID == snapshot.Share.ID && snapshot.Grant.ShareRevision == snapshot.Share.Revision && s.files.clock.Now().Before(snapshot.Grant.ExpiresAt)
}

type PublicEntry struct {
	ContentRevision int64      `json:"contentRevision"`
	ID              string     `json:"id"`
	Name            string     `json:"name"`
	Kind            model.Kind `json:"kind"`
	SizeBytes       int64      `json:"sizeBytes"`
	MediaType       string     `json:"mediaType"`
	UpdatedAt       time.Time  `json:"updatedAt"`
}

func publicEntry(entry model.Entry) PublicEntry {
	return PublicEntry{ID: entry.ID, Name: entry.Name, Kind: entry.Kind, SizeBytes: entry.SizeBytes, MediaType: entry.MediaType, UpdatedAt: entry.UpdatedAt, ContentRevision: entry.ContentRevision}
}

type PublicShare struct {
	Title       string             `json:"title,omitempty"`
	Revision    *int64             `json:"revision,omitempty"`
	Permissions *SharePermissions  `json:"permissions,omitempty"`
	Limits      *PublicShareLimits `json:"limits,omitempty"`
	Locked      bool               `json:"locked"`
	Root        *PublicEntry       `json:"root,omitempty"`
	ExpiresAt   time.Time          `json:"expiresAt"`
}
type PublicShareLimits struct {
	MaxFileBytes    int64 `json:"maxFileBytes"`
	MaxTextBytes    int64 `json:"maxTextBytes"`
	MaxPreviewBytes int64 `json:"maxPreviewBytes"`
	BatchEntries    int   `json:"batchEntries"`
}

func (s *Sharing) Metadata(ctx context.Context, token, ticket string) (PublicShare, error) {
	snapshot, err := s.inspect(ctx, token, ticket)
	if err != nil {
		return PublicShare{}, err
	}
	result := PublicShare{Locked: !s.authorized(snapshot), ExpiresAt: snapshot.Share.ExpiresAt}
	if !result.Locked {
		permissions := sharePermissions(snapshot.Share.Permissions)
		result.Title = snapshot.Share.Title
		revision := snapshot.Share.Revision
		result.Revision = &revision
		result.Permissions = &permissions
		result.Limits = &PublicShareLimits{MaxFileBytes: s.files.policy.MaxFileBytes, MaxTextBytes: s.files.policy.MaxTextBytes, MaxPreviewBytes: s.files.policy.MaxMediaBytes, BatchEntries: s.policy.BatchEntries}
		root, _ := model.Find(snapshot.Entries, snapshot.Share.RootID)
		entry := publicEntry(root)
		result.Root = &entry
	}
	return result, nil
}

type UnlockResult struct {
	Ticket    string    `json:"ticket"`
	ExpiresAt time.Time `json:"expiresAt"`
}

func (s *Sharing) Unlock(ctx context.Context, token, password string) (UnlockResult, error) {
	if len(password) > maxSharePasswordBytes || !utf8.ValidString(password) {
		return UnlockResult{}, model.ErrShareLocked
	}
	snapshot, err := s.inspect(ctx, token, "")
	if err != nil {
		return UnlockResult{}, err
	}
	if snapshot.Share.PasswordHash == "" {
		return UnlockResult{}, model.ErrInvalid
	}
	release, err := s.acquireKDF(ctx)
	if err != nil {
		return UnlockResult{}, err
	}
	defer release()
	now := s.files.clock.Now().UTC()
	if err := s.store.ReserveShareAttempt(ctx, snapshot.Share.ID, now, s.policy.AttemptWindow, s.policy.AttemptLimit); err != nil {
		return UnlockResult{}, err
	}
	match, err := s.passwords.Verify(snapshot.Share.PasswordHash, password)
	if err != nil {
		return UnlockResult{}, fmt.Errorf("verify share password: %w", err)
	}
	if err := ctx.Err(); err != nil {
		return UnlockResult{}, err
	}
	if !match {
		return UnlockResult{}, model.ErrShareLocked
	}
	// KDF 期间可能发生撤销或到期，签发前重新检查；读取内容时仍会再次检查。
	current, err := s.inspect(ctx, token, "")
	if err != nil {
		return UnlockResult{}, err
	}
	ticket, err := newCapabilitySecret()
	if err != nil {
		return UnlockResult{}, err
	}
	expires := s.files.clock.Now().UTC().Add(s.policy.GrantTTL)
	if current.Share.ExpiresAt.Before(expires) {
		expires = current.Share.ExpiresAt
	}
	if err := s.store.PutShareGrant(ctx, model.ShareGrant{Digest: credentialDigest("grant", ticket), ShareID: current.Share.ID, ShareRevision: current.Share.Revision, ExpiresAt: expires}, s.files.clock.Now().UTC()); err != nil {
		return UnlockResult{}, err
	}
	return UnlockResult{Ticket: ticket, ExpiresAt: expires}, nil
}

type PublicListing struct {
	Total       int           `json:"total"`
	Page        int           `json:"page"`
	PageSize    int           `json:"pageSize"`
	Items       []PublicEntry `json:"items"`
	Breadcrumbs []PublicEntry `json:"breadcrumbs"`
}
