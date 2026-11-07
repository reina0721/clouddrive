package repo

import (
	"context"
	"fmt"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/database"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type trashRetentionRecord struct {
	OwnerID  string `gorm:"primaryKey"`
	Revision int64
	Days     int
}

func (trashRetentionRecord) TableName() string { return "files_trash_retention" }

func loadTrashRetention(db *gorm.DB, owner string) (model.TrashRetention, error) {
	var record trashRetentionRecord
	result := db.Where("owner_id = ?", owner).Limit(1).Find(&record)
	if result.Error != nil || result.RowsAffected == 0 {
		return model.TrashRetention{}, result.Error
	}
	if record.Revision < 1 {
		return model.TrashRetention{}, fmt.Errorf("stored trash retention revision invariant")
	}
	policy := model.TrashRetention{Days: record.Days, Revision: record.Revision}
	if err := policy.Validate(); err != nil {
		return model.TrashRetention{}, fmt.Errorf("stored trash retention: %w", err)
	}
	return policy, nil
}

func (r *Repository) ReadTrashRetention(ctx context.Context, owner string) (model.TrashRetention, error) {
	if owner == "" {
		return model.TrashRetention{}, model.ErrMissing
	}
	var value model.TrashRetention
	err := r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			if err := r.checkStorage(db); err != nil {
				return err
			}
			var err error
			value, err = loadTrashRetention(db, owner)
			return err
		})
	})
	return value, err
}

func (r *Repository) SaveTrashRetention(ctx context.Context, owner string, policy model.TrashRetention) (model.TrashRetention, error) {
	if err := policy.Validate(); err != nil {
		return model.TrashRetention{}, err
	}
	if policy.Revision == model.MaxPreferenceRevision {
		return model.TrashRetention{}, model.ErrConflict
	}
	expected := policy.Revision
	policy.Revision++
	err := r.access.WithinTx(ctx, func(ctx context.Context, _ database.Client, tx database.Tx) error {
		return database.UseGORMTx(ctx, tx, func(db *gorm.DB) error {
			if err := r.lockOwner(db, owner); err != nil {
				return err
			}
			record := trashRetentionRecord{OwnerID: owner, Revision: policy.Revision, Days: policy.Days}
			var changed *gorm.DB
			if expected == 0 {
				changed = db.Clauses(clause.OnConflict{DoNothing: true}).Create(&record)
			} else {
				changed = db.Model(&trashRetentionRecord{}).Where("owner_id = ? AND revision = ?", owner, expected).
					Select("revision", "days").Updates(&record)
			}
			if changed.Error != nil {
				return changed.Error
			}
			if changed.RowsAffected != 1 {
				return model.ErrConflict
			}
			return nil
		})
	})
	if err != nil {
		return model.TrashRetention{}, err
	}
	return policy, nil
}

func (r *Repository) FindDueTrash(ctx context.Context, now time.Time) ([]model.TrashExpiryCandidate, error) {
	var candidates []model.TrashExpiryCandidate
	err := r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			if err := r.checkStorage(db); err != nil {
				return err
			}
			return db.Model(&entryRecord{}).
				Select("id", "owner_id", "trashed_at", "trash_expires_at", "trash_retry_at").
				Where("trash_retry_at <= ? AND trash_expires_at <= ? AND trashed_at IS NOT NULL", now, now).
				Order("trash_retry_at, owner_id, id").Limit(service.TrashExpiryBatch).Find(&candidates).Error
		})
	})
	return candidates, err
}

// DeferTrashExpiry 只重排同一次入站记录，避免覆盖后续恢复、回收或重试。
func (r *Repository) DeferTrashExpiry(ctx context.Context, owner string, candidates []model.TrashExpiryCandidate, retry time.Time) error {
	return r.access.WithinTx(ctx, func(ctx context.Context, _ database.Client, tx database.Tx) error {
		return database.UseGORMTx(ctx, tx, func(db *gorm.DB) error {
			if err := r.lockOwner(db, owner); err != nil {
				return err
			}
			for _, candidate := range candidates {
				if candidate.OwnerID != owner || !retry.After(candidate.TrashRetryAt) {
					return model.ErrInvalid
				}
				err := db.Model(&entryRecord{}).
					Where("owner_id = ? AND id = ? AND trashed_at = ? AND trash_expires_at = ? AND trash_retry_at = ?",
						owner, candidate.ID, candidate.TrashedAt, candidate.TrashExpiresAt, candidate.TrashRetryAt).
					UpdateColumn("trash_retry_at", retry).Error
				if err != nil {
					return err
				}
			}
			return nil
		})
	})
}
