package repo

import (
	"context"
	"errors"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"gorm.io/gorm"
)

// RecordTorrentSubmission 只记录原提交者的迟到事实，不授予续租或发布权限。
// 明确未发送与真实Accepted都可单调落账；未知回执不能伪造停止证据。
func (r *Torrents) RecordTorrentSubmission(ctx context.Context, claim service.DownloadClaim, gid string, outcome service.TorrentSubmissionOutcome) error {
	if !validClaim(claim) || !validTorrentHex(gid, 8) || (outcome != service.TorrentSubmissionAccepted && outcome != service.TorrentSubmissionUnsent) {
		return model.ErrInvalid
	}
	return r.downloads.transaction(ctx, claim.OwnerID, func(db *gorm.DB) error {
		task, err := readDownloadTask(db, claim.OwnerID, claim.TaskID)
		if err != nil {
			return err
		}
		if task.Kind != model.DownloadBitTorrent {
			return model.ErrInvalid
		}
		var record torrentJobRecord
		if err := db.Where("owner_id = ? AND task_id = ? AND gid = ? AND claim_token = ?", claim.OwnerID, claim.TaskID, gid, claim.Token).First(&record).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return model.ErrMissing
			}
			return err
		}
		if !record.Submitted {
			return model.ErrConflict
		}
		if outcome == service.TorrentSubmissionAccepted {
			if record.Stopped && !record.Accepted {
				return model.ErrConflict
			}
			record.Accepted = true
		} else {
			if record.Accepted {
				return model.ErrConflict
			}
			record.Stopped = true
		}
		return db.Model(&torrentJobRecord{}).Where("owner_id = ? AND task_id = ? AND gid = ? AND claim_token = ?", claim.OwnerID, claim.TaskID, gid, claim.Token).Select("accepted", "stopped").Updates(&record).Error
	})
}
