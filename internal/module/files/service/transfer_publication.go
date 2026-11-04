package service

import (
	"context"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

// transferPublication 让最终传输事务消费真实来源的授权快照，不在事务外假定许可仍有效。
type transferPublication interface {
	source() model.TransferSource
	authorize(context.Context, time.Time) error
	validate(TransferSnapshot, time.Time) error
}

func (p *downloadPublication) source() model.TransferSource { return model.TransferSourceOffline }
func (p *downloadPublication) validate(snapshot TransferSnapshot, now time.Time) error {
	return p.validateTask(snapshot.DownloadTask, now)
}

type sharePublication struct {
	sharing *Sharing
	owner   string
	access  ShareAccess
}

func (p *sharePublication) source() model.TransferSource { return model.TransferSourceShare }
func (p *sharePublication) authorize(ctx context.Context, _ time.Time) error {
	if err := p.sharing.authorizeAccount(ctx, p.owner, ShareAccountWrite); err != nil {
		return err
	}
	if err := p.sharing.authorizeAccount(ctx, p.owner, ShareAccountRead); err != nil {
		return err
	}
	snapshot, err := p.sharing.shared.ReadShare(ctx, p.access.TokenDigest, p.access.GrantDigest, p.sharing.files.policy.SearchTreeEntries)
	if err != nil {
		return err
	}
	if snapshot.Share.OwnerID != p.owner {
		return model.ErrMissing
	}
	return p.sharing.validateAccess(snapshot, p.access)
}
func (p *sharePublication) validateAdmission(snapshot TransferSnapshot) error {
	if snapshot.MetadataLimited {
		return model.ErrTooLarge
	}
	if snapshot.Share == nil || snapshot.Share.OwnerID != p.owner || snapshot.Share.TokenDigest != p.access.TokenDigest {
		return model.ErrMissing
	}
	return p.sharing.validateAccess(ShareSnapshot{Share: *snapshot.Share, Grant: snapshot.ShareGrant, Entries: snapshot.Entries}, p.access)
}
func (p *sharePublication) validate(snapshot TransferSnapshot, _ time.Time) error {
	if err := p.validateAdmission(snapshot); err != nil {
		return err
	}
	transfer := snapshot.Transfer
	if transfer == nil || transfer.Source != model.TransferSourceShare || transfer.ShareID != p.access.ShareID || transfer.ShareRevision != p.access.ShareRevision || transfer.ShareGrantDigest != p.access.GrantDigest || p.access.Destination == nil || transfer.ParentID != *p.access.Destination || transfer.ExpectedEntryID != "" {
		return model.ErrShareForbidden
	}
	return nil
}
