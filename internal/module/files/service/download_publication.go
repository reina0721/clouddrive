package service

import (
	"context"
	"errors"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

// downloadPublication 是一次领取的发布许可，不能跨token复用；最终校验消费传输事务内的任务快照。
type downloadPublication struct {
	claim      DownloadClaim
	repository DownloadRepository
	accounts   DownloadAccountAuthority
}

func (p *downloadPublication) validateTask(task *model.DownloadTask, now time.Time) error {
	if task == nil || task.ID != p.claim.TaskID || task.OwnerID != p.claim.OwnerID || task.LeaseToken != p.claim.Token || !task.LeaseValid(now) || task.Intent != model.DownloadRun || task.State != model.DownloadPublishing || !now.Before(task.ExpiresAt) {
		return model.ErrDownloadLeaseLost
	}
	return nil
}

func (p *downloadPublication) authorize(ctx context.Context, now time.Time) error {
	allowed, err := p.accounts.AuthorizeDownload(ctx, p.claim.OwnerID)
	if err != nil {
		return errors.Join(model.ErrDownloadPermission, err)
	}
	if !allowed {
		return model.ErrDownloadPermission
	}
	snapshot, err := p.repository.ReadDownload(ctx, p.claim.OwnerID, p.claim.TaskID)
	if err != nil {
		return err
	}
	if snapshot.MetadataLimited {
		return model.ErrDownloadMetadataLimited
	}
	return p.validateTask(&snapshot.Task, now)
}
