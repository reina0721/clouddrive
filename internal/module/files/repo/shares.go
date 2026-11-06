package repo

import (
	"context"
	"errors"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/database"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func (shareRecord) TableName() string { return "files_shares" }

type grantRecord struct {
	AudienceSubject string
	ShareRevision   int64
	Digest          string `gorm:"primaryKey"`
	ShareID         string
	ExpiresAt       time.Time
	EntryID         string
	ContentRevision int64
}

func (grantRecord) TableName() string { return "files_share_grants" }

// lockOwner 与文件批量写入共用锁顺序，防止分享创建和目录状态变更跨越快照。
func (r *Repository) lockOwner(db *gorm.DB, owner string) error {
	if owner == "" {
		return model.ErrMissing
	}
	if err := db.Model(&storageBinding{}).Where("id = ?", primaryStorageID).UpdateColumn("identity", gorm.Expr("identity")).Error; err != nil {
		return err
	}
	if err := r.checkStorage(db); err != nil {
		return err
	}
	if err := db.Clauses(clause.OnConflict{DoNothing: true}).Create(&ownerLock{OwnerID: owner}).Error; err != nil {
		return err
	}
	return db.Model(&ownerLock{}).Where("owner_id = ?", owner).UpdateColumn("revision", gorm.Expr("revision + 1")).Error
}

func (r *Repository) ReadShare(ctx context.Context, digest, grantDigest string, treeLimit int) (service.ShareSnapshot, error) {
	var snapshot service.ShareSnapshot
	err := r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			var record shareRecord
			if err := db.Where("token_digest = ?", digest).First(&record).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return errors.Join(model.ErrMissing, err)
				}
				return err
			}
			convertedShare, decodeErr := record.model()
			if decodeErr != nil {
				return decodeErr
			}
			snapshot.Share = convertedShare
			entries, err := loadBoundedEntries(db, record.OwnerID, treeLimit)
			if err != nil {
				return err
			}
			snapshot.Entries = entries
			if grantDigest != "" {
				var grant grantRecord
				err := db.Where("digest = ? AND share_id = ?", grantDigest, record.ID).First(&grant).Error
				if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
					return err
				}
				if err == nil {
					converted := model.ShareGrant(grant)
					snapshot.Grant = &converted
				}
			}
			return r.checkStorage(db)
		})
	})
	return snapshot, err
}

// ReadShareTarget 为引用状态提供独立有界读取，不获取或复用访客解锁票据。
func (r *Repository) ReadShareTarget(ctx context.Context, digest string, treeLimit int) (service.ShareSnapshot, error) {
	if treeLimit < 1 || treeLimit > service.DefaultNavigationTreeEntries {
		return service.ShareSnapshot{}, model.ErrInvalid
	}
	var snapshot service.ShareSnapshot
	err := r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			if err := r.checkStorage(db); err != nil {
				return err
			}
			var record shareRecord
			if err := db.Where("token_digest = ?", digest).First(&record).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return errors.Join(model.ErrMissing, err)
				}
				return err
			}
			convertedShare, decodeErr := record.model()
			if decodeErr != nil {
				return decodeErr
			}
			snapshot.Share = convertedShare
			entries, err := loadBoundedEntries(db, record.OwnerID, treeLimit)
			if err != nil {
				return err
			}
			snapshot.Entries = entries
			return nil
		})
	})
	return snapshot, err
}

// ReserveShareAttempt 在 KDF 前占用持久化窗口，多个进程不能绕过每分享预算。
func (r *Repository) ReserveShareAttempt(ctx context.Context, id string, now time.Time, window time.Duration, limit int) error {
	return r.access.WithinTx(ctx, func(ctx context.Context, _ database.Client, tx database.Tx) error {
		return database.UseGORMTx(ctx, tx, func(db *gorm.DB) error {
			if err := db.Model(&shareRecord{}).Where("id = ?", id).UpdateColumn("unlock_attempts", gorm.Expr("unlock_attempts")).Error; err != nil {
				return err
			}
			var record shareRecord
			if err := db.First(&record, "id = ?", id).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return errors.Join(model.ErrMissing, err)
				}
				return err
			}
			if record.RevokedAt != nil || record.State != model.ShareEnabled || !now.Before(record.ExpiresAt) {
				return model.ErrMissing
			}
			if record.AttemptWindow == nil || !now.Before(record.AttemptWindow.Add(window)) {
				record.AttemptWindow = &now
				record.UnlockAttempts = 0
			}
			if record.UnlockAttempts >= limit {
				return model.ErrBusy
			}
			return db.Model(&shareRecord{}).Where("id = ?", id).Updates(map[string]any{"attempt_window": record.AttemptWindow, "unlock_attempts": record.UnlockAttempts + 1}).Error
		})
	})
}
func (r *Repository) PutShareGrant(ctx context.Context, grant model.ShareGrant, now time.Time) error {
	if grant.EntryID != "" {
		return model.ErrInvalid
	}
	return r.putGrant(ctx, grant, now, 0)
}

func (r *Repository) PutDownloadGrant(ctx context.Context, grant model.ShareGrant, now time.Time, limit int) error {
	if grant.EntryID == "" || grant.ContentRevision < 1 || limit < 1 {
		return model.ErrInvalid
	}
	return r.putGrant(ctx, grant, now, limit)
}

func (r *Repository) putGrant(ctx context.Context, grant model.ShareGrant, now time.Time, downloadLimit int) error {
	return r.access.WithinTx(ctx, func(ctx context.Context, _ database.Client, tx database.Tx) error {
		return database.UseGORMTx(ctx, tx, func(db *gorm.DB) error {
			if err := db.Model(&shareRecord{}).Where("id = ?", grant.ShareID).UpdateColumn("unlock_attempts", gorm.Expr("unlock_attempts")).Error; err != nil {
				return err
			}
			var share shareRecord
			if err := db.First(&share, "id = ?", grant.ShareID).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return errors.Join(model.ErrMissing, err)
				}
				return err
			}
			if share.RevokedAt != nil || share.State != model.ShareEnabled || share.Revision != grant.ShareRevision || !now.Before(share.ExpiresAt) || !now.Before(grant.ExpiresAt) || grant.ExpiresAt.After(share.ExpiresAt) {
				return model.ErrMissing
			}
			// 过期票据不是文件或审计记录，仅在签发同分享票据时释放其持久化空间。
			if err := db.Where("share_id = ? AND expires_at <= ?", grant.ShareID, now).Delete(&grantRecord{}).Error; err != nil {
				return err
			}
			if downloadLimit > 0 {
				var active int64
				if err := db.Model(&grantRecord{}).Where("share_id = ? AND entry_id <> ?", grant.ShareID, "").Count(&active).Error; err != nil {
					return err
				}
				if active >= int64(downloadLimit) {
					return model.ErrBusy
				}
			}
			record := grantRecord(grant)
			return db.Create(&record).Error
		})
	})
}

func (r *Repository) ReadDownloadGrant(ctx context.Context, digest string, treeLimit int) (service.ShareSnapshot, error) {
	var snapshot service.ShareSnapshot
	err := r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			var grant grantRecord
			if err := db.First(&grant, "digest = ? AND entry_id <> ?", digest, "").Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return errors.Join(model.ErrMissing, err)
				}
				return err
			}
			var share shareRecord
			if err := db.First(&share, "id = ?", grant.ShareID).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return errors.Join(model.ErrMissing, err)
				}
				return err
			}
			entries, err := loadBoundedEntries(db, share.OwnerID, treeLimit)
			if err != nil {
				return err
			}
			converted := model.ShareGrant(grant)
			convertedShare, decodeErr := share.model()
			if decodeErr != nil {
				return decodeErr
			}
			snapshot = service.ShareSnapshot{Share: convertedShare, Entries: entries, Grant: &converted}
			return r.checkStorage(db)
		})
	})
	return snapshot, err
}
