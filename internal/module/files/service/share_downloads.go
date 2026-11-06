package service

import (
	"context"
	"io"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

type DownloadGrant struct {
	Ticket    string    `json:"ticket"`
	ExpiresAt time.Time `json:"expiresAt"`
}

// CreateDownload 为原生浏览器保存签发短期单文件凭据，不把目录解锁票据放入 URL。
func (s *Sharing) CreateDownload(ctx context.Context, token, ticket, id string) (DownloadGrant, error) {
	snapshot, err := s.inspect(ctx, token, ticket)
	if err != nil {
		return DownloadGrant{}, err
	}
	if !s.authorized(snapshot) {
		return DownloadGrant{}, model.ErrShareLocked
	}
	viewer, viewerErr := s.accounts.ShareViewer(ctx)
	if viewerErr != nil {
		return DownloadGrant{}, viewerErr
	}
	decision, decisionErr := model.EffectiveAccess(snapshot.Entries, snapshot.Share, id, viewer)
	if decisionErr != nil {
		return DownloadGrant{}, decisionErr
	}
	if !decision.Permissions.Allows(model.ShareDownload) {
		return DownloadGrant{}, model.ErrShareForbidden
	}
	entry, ok := model.Find(snapshot.Entries, id)
	if !ok || entry.Kind != model.File || !model.Visible(snapshot.Entries, entry) || !Within(snapshot.Entries, snapshot.Share.RootID, id) {
		return DownloadGrant{}, model.ErrMissing
	}
	secret, err := newCapabilitySecret()
	if err != nil {
		return DownloadGrant{}, err
	}
	now := s.files.clock.Now().UTC()
	expires := now.Add(s.policy.DownloadTTL)
	if snapshot.Share.ExpiresAt.Before(expires) {
		expires = snapshot.Share.ExpiresAt
	}
	if snapshot.Share.PasswordHash != "" && snapshot.Grant.ExpiresAt.Before(expires) {
		expires = snapshot.Grant.ExpiresAt
	}
	grant := model.ShareGrant{AudienceSubject: viewer.AccountID, ShareRevision: snapshot.Share.Revision, Digest: credentialDigest("download", secret), ShareID: snapshot.Share.ID, EntryID: id, ContentRevision: entry.ContentRevision, ExpiresAt: expires}
	if err := s.store.PutDownloadGrant(ctx, grant, now, s.policy.DownloadLimit); err != nil {
		return DownloadGrant{}, err
	}
	return DownloadGrant{Ticket: secret, ExpiresAt: expires}, nil
}

func (s *Sharing) downloadSnapshot(ctx context.Context, ticket string) (ShareSnapshot, model.Entry, error) {
	if !validSecret(ticket) {
		return ShareSnapshot{}, model.Entry{}, model.ErrMissing
	}
	snapshot, err := s.store.ReadDownloadGrant(ctx, credentialDigest("download", ticket), s.files.policy.SearchTreeEntries)
	if err != nil {
		return ShareSnapshot{}, model.Entry{}, err
	}
	if snapshot.Grant == nil || snapshot.Grant.EntryID == "" || snapshot.Grant.ShareID != snapshot.Share.ID || snapshot.Grant.ShareRevision != snapshot.Share.Revision || !s.files.clock.Now().Before(snapshot.Grant.ExpiresAt) || shareStatus(snapshot.Share, snapshot.Entries, s.files.clock.Now().UTC()) != ShareActive {
		return ShareSnapshot{}, model.Entry{}, model.ErrMissing
	}
	if err := s.authorizeAccount(ctx, snapshot.Share.OwnerID, ShareAccountRead); err != nil {
		return ShareSnapshot{}, model.Entry{}, err
	}
	entry, ok := model.Find(snapshot.Entries, snapshot.Grant.EntryID)
	if !ok || entry.Kind != model.File || entry.ContentRevision != snapshot.Grant.ContentRevision || !model.Visible(snapshot.Entries, entry) || !Within(snapshot.Entries, snapshot.Share.RootID, entry.ID) {
		return ShareSnapshot{}, model.Entry{}, model.ErrMissing
	}
	viewer, viewerErr := s.accounts.ShareViewer(ctx)
	if viewerErr != nil {
		return ShareSnapshot{}, model.Entry{}, viewerErr
	}
	if viewer.AccountID != snapshot.Grant.AudienceSubject {
		return ShareSnapshot{}, model.Entry{}, model.ErrShareForbidden
	}
	decision, decisionErr := model.EffectiveAccess(snapshot.Entries, snapshot.Share, entry.ID, viewer)
	if decisionErr != nil {
		return ShareSnapshot{}, model.Entry{}, decisionErr
	}
	if !decision.Permissions.Allows(model.ShareDownload) {
		return ShareSnapshot{}, model.Entry{}, model.ErrShareForbidden
	}
	return snapshot, entry, nil
}

// DownloadTicketTo 对每个 Range 请求重新检查撤销、到期和子树，凭据不能用于别的文件。
func (s *Sharing) DownloadTicketTo(ctx context.Context, ticket string, use func(model.Entry, io.ReadSeeker) error) error {
	snapshot, entry, err := s.downloadSnapshot(ctx, ticket)
	if err != nil {
		return err
	}
	return s.files.DownloadTo(ctx, snapshot.Share.OwnerID, entry.ID, func(current model.Entry, reader io.ReadSeeker) error {
		_, latest, err := s.downloadSnapshot(ctx, ticket)
		if err != nil {
			return err
		}
		if latest.ObjectKey != current.ObjectKey {
			return model.ErrMissing
		}
		return use(current, reader)
	})
}
