package repo

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/database"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type shareRecord model.Share

func (shareRecord) TableName() string { return "files_shares" }

type grantRecord struct {
	Digest    string `gorm:"primaryKey"`
	ShareID   string
	ExpiresAt time.Time
}

func (grantRecord) TableName() string { return "files_share_grants" }

func loadShares(db *gorm.DB, owner string) ([]model.Share, error) {
	records := []shareRecord{}
	if err := db.Where("owner_id = ?", owner).Find(&records).Error; err != nil {
		return nil, err
	}
	shares := make([]model.Share, len(records))
	for i, record := range records {
		shares[i] = model.Share(record)
	}
	return shares, nil
}
func (r *Repository) ReadShares(ctx context.Context, owner string) ([]model.Share, error) {
	var shares []model.Share
	err := r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error { var err error; shares, err = loadShares(db, owner); return err })
	})
	return shares, err
}

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

func (r *Repository) ChangeShare(ctx context.Context, owner string, change func([]model.Entry, []model.Share) (model.Share, error)) (model.Share, error) {
	var result model.Share
	err := r.access.WithinTx(ctx, func(ctx context.Context, _ database.Client, tx database.Tx) error {
		return database.UseGORMTx(ctx, tx, func(db *gorm.DB) error {
			if err := r.lockOwner(db, owner); err != nil {
				return err
			}
			entries, err := loadEntries(db, owner)
			if err != nil {
				return err
			}
			shares, err := loadShares(db, owner)
			if err != nil {
				return err
			}
			changed, err := change(entries, shares)
			if err != nil {
				return err
			}
			if changed.OwnerID != owner || changed.ID == "" {
				return fmt.Errorf("files share identity invariant")
			}
			for _, previous := range shares {
				if previous.ID == changed.ID {
					// 当前只允许撤销；不把并发解锁产生的计数覆盖为旧快照值。
					if changed.TokenDigest != previous.TokenDigest || changed.RootID != previous.RootID {
						return fmt.Errorf("files share immutable scope invariant")
					}
					if err := db.Model(&shareRecord{}).Where("id = ? AND owner_id = ?", changed.ID, owner).Update("revoked_at", changed.RevokedAt).Error; err != nil {
						return err
					}
					result = changed
					return nil
				}
			}
			record := shareRecord(changed)
			if err := db.Create(&record).Error; err != nil {
				return err
			}
			result = changed
			return nil
		})
	})
	return result, err
}

func (r *Repository) ReadShare(ctx context.Context, digest, grantDigest string) (service.ShareSnapshot, error) {
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
			snapshot.Share = model.Share(record)
			entries, err := loadEntries(db, record.OwnerID)
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
					snapshot.Grant = &model.ShareGrant{Digest: grant.Digest, ShareID: grant.ShareID, ExpiresAt: grant.ExpiresAt}
				}
			}
			return r.checkStorage(db)
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
			if record.RevokedAt != nil || !now.Before(record.ExpiresAt) {
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
			if share.RevokedAt != nil || !now.Before(share.ExpiresAt) || !now.Before(grant.ExpiresAt) || grant.ExpiresAt.After(share.ExpiresAt) {
				return model.ErrMissing
			}
			// 过期票据不是文件或审计记录，仅在签发同分享票据时释放其持久化空间。
			if err := db.Where("share_id = ? AND expires_at <= ?", grant.ShareID, now).Delete(&grantRecord{}).Error; err != nil {
				return err
			}
			record := grantRecord{Digest: grant.Digest, ShareID: grant.ShareID, ExpiresAt: grant.ExpiresAt}
			return db.Create(&record).Error
		})
	})
}
