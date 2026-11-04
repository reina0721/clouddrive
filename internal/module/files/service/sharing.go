package service

import (
	"context"
	"fmt"
	"io"
	"sort"
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
	MaxAge         time.Duration
	GrantTTL       time.Duration
	AttemptWindow  time.Duration
	AttemptLimit   int
	KDFConcurrency int
	DownloadTTL    time.Duration
	DownloadLimit  int
}

func DefaultSharePolicy() SharePolicy {
	return SharePolicy{MaxAge: DefaultShareMaxAge, GrantTTL: DefaultShareGrantTTL, AttemptWindow: DefaultShareAttemptWindow, AttemptLimit: DefaultShareAttemptLimit, KDFConcurrency: DefaultShareKDFConcurrency, DownloadTTL: DefaultShareDownloadTTL, DownloadLimit: DefaultShareDownloadLimit}
}
func (p SharePolicy) Validate() error {
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
	ReadShares(context.Context, string) ([]model.Share, error)
	ChangeShare(context.Context, string, func([]model.Entry, []model.Share) (model.Share, error)) (model.Share, error)
	ReadShare(context.Context, string, string) (ShareSnapshot, error)
	ReadShareTarget(context.Context, string, int) (ShareSnapshot, error)
	ReserveShareAttempt(context.Context, string, time.Time, time.Duration, int) error
	PutShareGrant(context.Context, model.ShareGrant, time.Time) error
	PutDownloadGrant(context.Context, model.ShareGrant, time.Time, int) error
	ReadDownloadGrant(context.Context, string) (ShareSnapshot, error)
}
type Sharing struct {
	files     *Service
	store     ShareRepository
	passwords PasscodeHasher
	policy    SharePolicy
	slots     chan struct{}
}

func NewSharing(files *Service, store ShareRepository, passwords PasscodeHasher, policy SharePolicy) (*Sharing, error) {
	if files == nil || store == nil || passwords == nil {
		return nil, fmt.Errorf("file sharing dependencies incomplete")
	}
	if err := policy.Validate(); err != nil {
		return nil, err
	}
	return &Sharing{files: files, store: store, passwords: passwords, policy: policy, slots: make(chan struct{}, policy.KDFConcurrency)}, nil
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
)

type ShareSummary struct {
	ID          string      `json:"id"`
	Token       string      `json:"token"`
	RootID      string      `json:"rootId"`
	Name        string      `json:"name"`
	HasPassword bool        `json:"hasPassword"`
	CreatedAt   time.Time   `json:"createdAt"`
	ExpiresAt   time.Time   `json:"expiresAt"`
	Status      ShareStatus `json:"status"`
}

func shareStatus(share model.Share, entries []model.Entry, now time.Time) ShareStatus {
	if share.RevokedAt != nil {
		return ShareRevoked
	}
	if !now.Before(share.ExpiresAt) {
		return ShareExpired
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
	return ShareSummary{ID: share.ID, Token: share.Token, RootID: share.RootID, Name: root.Name, HasPassword: share.PasswordHash != "", CreatedAt: share.CreatedAt, ExpiresAt: share.ExpiresAt, Status: shareStatus(share, entries, now)}
}
func (s *Sharing) Create(ctx context.Context, owner, rootID, password string, expiresAt *time.Time) (ShareSummary, error) {
	if owner == "" {
		return ShareSummary{}, model.ErrMissing
	}
	now := s.files.clock.Now().UTC()
	expiry := now.Add(s.policy.MaxAge)
	if expiresAt != nil {
		expiry = expiresAt.UTC()
	}
	if !expiry.After(now) || expiry.After(now.Add(s.policy.MaxAge)) {
		return ShareSummary{}, model.ErrInvalid
	}
	var hash string
	if password != "" {
		if !utf8.ValidString(password) || len(password) < minSharePasswordBytes || len(password) > maxSharePasswordBytes {
			return ShareSummary{}, model.ErrInvalid
		}
		release, err := s.acquireKDF(ctx)
		if err != nil {
			return ShareSummary{}, err
		}
		hash, err = s.passwords.Hash(password)
		release()
		if err != nil {
			return ShareSummary{}, fmt.Errorf("hash share password: %w", err)
		}
	}
	if err := ctx.Err(); err != nil {
		return ShareSummary{}, err
	}
	id, err := s.files.ids.New()
	if err != nil {
		return ShareSummary{}, err
	}
	token, err := newCapabilitySecret()
	if err != nil {
		return ShareSummary{}, err
	}
	var result ShareSummary
	_, err = s.store.ChangeShare(ctx, owner, func(entries []model.Entry, shares []model.Share) (model.Share, error) {
		if !expiry.After(s.files.clock.Now()) {
			return model.Share{}, model.ErrInvalid
		}
		root, ok := model.Find(entries, rootID)
		if !ok || !model.Visible(entries, root) {
			return model.Share{}, model.ErrMissing
		}
		if root.Kind == model.Shortcut {
			return model.Share{}, model.ErrUnsupported
		}
		for _, old := range shares {
			if old.ID == id {
				return model.Share{}, model.ErrConflict
			}
		}
		share := model.Share{ID: id, OwnerID: owner, RootID: rootID, Token: token, TokenDigest: credentialDigest("share", token), PasswordHash: hash, CreatedAt: now, ExpiresAt: expiry}
		result = summary(share, entries, now)
		return share, nil
	})
	return result, err
}
func (s *Sharing) List(ctx context.Context, owner string) ([]ShareSummary, error) {
	entries, err := s.files.read(ctx, owner)
	if err != nil {
		return nil, err
	}
	shares, err := s.store.ReadShares(ctx, owner)
	if err != nil {
		return nil, err
	}
	result := make([]ShareSummary, 0, len(shares))
	for _, share := range shares {
		result = append(result, summary(share, entries, s.files.clock.Now().UTC()))
	}
	sort.Slice(result, func(i, j int) bool {
		if result[i].CreatedAt.Equal(result[j].CreatedAt) {
			return result[i].ID < result[j].ID
		}
		return result[i].CreatedAt.After(result[j].CreatedAt)
	})
	return result, nil
}
func (s *Sharing) Revoke(ctx context.Context, owner, id string) (ShareSummary, error) {
	var result ShareSummary
	_, err := s.store.ChangeShare(ctx, owner, func(entries []model.Entry, shares []model.Share) (model.Share, error) {
		for _, share := range shares {
			if share.ID == id {
				now := s.files.clock.Now().UTC()
				if share.RevokedAt == nil {
					share.RevokedAt = &now
				}
				result = summary(share, entries, now)
				return share, nil
			}
		}
		return model.Share{}, model.ErrMissing
	})
	return result, err
}

func (s *Sharing) inspect(ctx context.Context, token, ticket string) (ShareSnapshot, error) {
	if !validSecret(token) {
		return ShareSnapshot{}, model.ErrMissing
	}
	grant := ""
	if validSecret(ticket) {
		grant = credentialDigest("grant", ticket)
	}
	snapshot, err := s.store.ReadShare(ctx, credentialDigest("share", token), grant)
	if err != nil {
		return ShareSnapshot{}, err
	}
	if shareStatus(snapshot.Share, snapshot.Entries, s.files.clock.Now().UTC()) != "active" {
		return ShareSnapshot{}, model.ErrMissing
	}
	return snapshot, nil
}
func (s *Sharing) authorized(snapshot ShareSnapshot) bool {
	return snapshot.Share.PasswordHash == "" || snapshot.Grant != nil && snapshot.Grant.EntryID == "" && snapshot.Grant.ShareID == snapshot.Share.ID && s.files.clock.Now().Before(snapshot.Grant.ExpiresAt)
}

type PublicEntry struct {
	ID        string     `json:"id"`
	Name      string     `json:"name"`
	Kind      model.Kind `json:"kind"`
	SizeBytes int64      `json:"sizeBytes"`
	MediaType string     `json:"mediaType"`
	UpdatedAt time.Time  `json:"updatedAt"`
}

func publicEntry(entry model.Entry) PublicEntry {
	return PublicEntry{entry.ID, entry.Name, entry.Kind, entry.SizeBytes, entry.MediaType, entry.UpdatedAt}
}

type PublicShare struct {
	Locked    bool         `json:"locked"`
	Root      *PublicEntry `json:"root,omitempty"`
	ExpiresAt time.Time    `json:"expiresAt"`
}

func (s *Sharing) Metadata(ctx context.Context, token, ticket string) (PublicShare, error) {
	snapshot, err := s.inspect(ctx, token, ticket)
	if err != nil {
		return PublicShare{}, err
	}
	result := PublicShare{Locked: !s.authorized(snapshot), ExpiresAt: snapshot.Share.ExpiresAt}
	if !result.Locked {
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
	if err := s.store.PutShareGrant(ctx, model.ShareGrant{Digest: credentialDigest("grant", ticket), ShareID: current.Share.ID, ExpiresAt: expires}, s.files.clock.Now().UTC()); err != nil {
		return UnlockResult{}, err
	}
	return UnlockResult{Ticket: ticket, ExpiresAt: expires}, nil
}

type PublicListing struct {
	Items       []PublicEntry `json:"items"`
	Breadcrumbs []PublicEntry `json:"breadcrumbs"`
}

func (s *Sharing) Entries(ctx context.Context, token, ticket, parent string) (PublicListing, error) {
	snapshot, err := s.inspect(ctx, token, ticket)
	if err != nil {
		return PublicListing{}, err
	}
	if !s.authorized(snapshot) {
		return PublicListing{}, model.ErrShareLocked
	}
	if parent == "" {
		parent = snapshot.Share.RootID
	}
	directory, ok := model.Find(snapshot.Entries, parent)
	if !ok || directory.Kind != model.Folder || !model.Visible(snapshot.Entries, directory) || !Within(snapshot.Entries, snapshot.Share.RootID, parent) {
		return PublicListing{}, model.ErrMissing
	}
	result := PublicListing{Items: []PublicEntry{}, Breadcrumbs: []PublicEntry{}}
	for _, entry := range snapshot.Entries {
		if entry.ParentID == parent && model.Visible(snapshot.Entries, entry) {
			result.Items = append(result.Items, publicEntry(entry))
		}
	}
	if len(result.Items) > s.files.policy.MaxBatchEntries {
		return PublicListing{}, model.ErrTooLarge
	}
	for current := directory; ; {
		result.Breadcrumbs = append([]PublicEntry{publicEntry(current)}, result.Breadcrumbs...)
		if current.ID == snapshot.Share.RootID {
			break
		}
		current, ok = model.Find(snapshot.Entries, current.ParentID)
		if !ok || len(result.Breadcrumbs) > len(snapshot.Entries) {
			return PublicListing{}, model.ErrMissing
		}
	}
	sort.Slice(result.Items, func(i, j int) bool {
		if result.Items[i].Name == result.Items[j].Name {
			return result.Items[i].ID < result.Items[j].ID
		}
		return result.Items[i].Name < result.Items[j].Name
	})
	return result, nil
}
func (s *Sharing) DownloadTo(ctx context.Context, token, ticket, id string, use func(model.Entry, io.ReadSeeker) error) error {
	snapshot, err := s.inspect(ctx, token, ticket)
	if err != nil {
		return err
	}
	if !s.authorized(snapshot) {
		return model.ErrShareLocked
	}
	if !Within(snapshot.Entries, snapshot.Share.RootID, id) {
		return model.ErrMissing
	}
	return s.files.DownloadTo(ctx, snapshot.Share.OwnerID, id, func(entry model.Entry, reader io.ReadSeeker) error {
		// 读取对象期间可能移动到分享树外，重新授权且验证同一内容版本。
		current, err := s.inspect(ctx, token, ticket)
		if err != nil {
			return err
		}
		if !s.authorized(current) {
			return model.ErrShareLocked
		}
		latest, ok := model.Find(current.Entries, id)
		if !ok || !model.Visible(current.Entries, latest) || !Within(current.Entries, current.Share.RootID, id) || latest.ObjectKey != entry.ObjectKey {
			return model.ErrMissing
		}
		return use(entry, reader)
	})
}
