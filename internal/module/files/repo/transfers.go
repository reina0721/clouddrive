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

type transferRecord model.Transfer

func (transferRecord) TableName() string { return "files_transfers" }

// Transfers 固定本代内容和暂存位置；旧代不能在换根后继续接收新会话。
type Transfers struct {
	*Repository
	stagingIdentity string
}

func NewTransfers(access Access, storageIdentity, stagingIdentity string) (*Transfers, error) {
	if stagingIdentity == "" {
		return nil, model.ErrInvalid
	}
	repository, err := New(access, storageIdentity)
	if err != nil {
		return nil, err
	}
	return &Transfers{Repository: repository, stagingIdentity: stagingIdentity}, nil
}

func (r *Transfers) checkStaging(db *gorm.DB) error {
	var binding transferStagingBinding
	if err := db.First(&binding, "id = ?", primaryStorageID).Error; err != nil {
		return err
	}
	if binding.Identity != r.stagingIdentity {
		return fmt.Errorf("transfer staging identity changed")
	}
	return nil
}

type transferStagingBinding struct {
	ID       string `gorm:"primaryKey"`
	Identity string
}

func (transferStagingBinding) TableName() string { return "files_transfer_staging" }

// ValidateStagingRoot 在候选准入时绑定暂存位置，有未清理会话时禁止无迁移换根。
func (r *Repository) ValidateStagingRoot(ctx context.Context, identity string) error {
	if identity == "" {
		return model.ErrInvalid
	}
	return r.access.WithinTx(ctx, func(ctx context.Context, _ database.Client, tx database.Tx) error {
		return database.UseGORMTx(ctx, tx, func(db *gorm.DB) error {
			if err := db.Model(&storageBinding{}).Where("id = ?", primaryStorageID).UpdateColumn("identity", gorm.Expr("identity")).Error; err != nil {
				return err
			}
			if err := r.checkStorage(db); err != nil {
				return err
			}
			binding := transferStagingBinding{ID: primaryStorageID, Identity: identity}
			if err := db.Clauses(clause.OnConflict{DoNothing: true}).Create(&binding).Error; err != nil {
				return err
			}
			if err := db.First(&binding, "id = ?", primaryStorageID).Error; err != nil {
				return err
			}
			if binding.Identity == identity {
				return nil
			}
			var count int64
			if err := db.Model(&transferRecord{}).Where("state NOT IN ? OR cleanup_pending = ?", []model.TransferState{model.TransferCompleted, model.TransferCanceled, model.TransferExpired}, true).Count(&count).Error; err != nil {
				return err
			}
			if count > 0 {
				return fmt.Errorf("transfer staging location change requires migration")
			}
			return db.Model(&binding).Update("identity", identity).Error
		})
	})
}

func (r *Transfers) ReadTransfer(ctx context.Context, owner, id string) (model.Transfer, error) {
	var transfer transferRecord
	err := r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			if err := r.checkStorage(db); err != nil {
				return err
			}
			if err := r.checkStaging(db); err != nil {
				return err
			}
			return db.First(&transfer, "owner_id = ? AND id = ?", owner, id).Error
		})
	})
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return model.Transfer{}, model.ErrMissing
	}
	return model.Transfer(transfer), err
}

// CleanupTransfers 仅供内部请求驱动维护，返回有界的到期或清理未完成项。
func (r *Transfers) CleanupTransfers(ctx context.Context, now time.Time, limit int) ([]model.Transfer, error) {
	if limit < 1 || limit > service.DefaultTransferSweepCount {
		return nil, model.ErrInvalid
	}
	records := []transferRecord{}
	err := r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			if err := r.checkStorage(db); err != nil {
				return err
			}
			if err := r.checkStaging(db); err != nil {
				return err
			}
			return db.Where("(state NOT IN ? AND expires_at <= ?) OR cleanup_pending = ?", []model.TransferState{model.TransferCompleted, model.TransferCanceled, model.TransferExpired}, now, true).Order("id ASC").Limit(limit).Find(&records).Error
		})
	})
	if err != nil {
		return nil, err
	}
	transfers := make([]model.Transfer, len(records))
	for index, record := range records {
		transfers[index] = model.Transfer(record)
	}
	return transfers, nil
}

func (r *Transfers) ListTransfers(ctx context.Context, owner, state, cursor string, limit int) (service.TransferPage, error) {
	if limit < 1 || limit > service.DefaultTransferGlobalCount {
		return service.TransferPage{}, model.ErrInvalid
	}
	if cursor != "" && model.ValidateTransferID(cursor) != nil {
		return service.TransferPage{}, model.ErrInvalid
	}
	page := service.TransferPage{Items: []model.Transfer{}}
	err := r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			if err := r.checkStorage(db); err != nil {
				return err
			}
			query := db.Model(&transferRecord{}).Where("owner_id = ?", owner)
			if err := r.checkStaging(db); err != nil {
				return err
			}
			switch state {
			case "":
			case "active":
				query = query.Where("state IN ?", []model.TransferState{model.TransferPreparing, model.TransferReceiving, model.TransferPaused, model.TransferPublishing})
			case "attention":
				query = query.Where("state IN ?", []model.TransferState{model.TransferAttention, model.TransferExpired, model.TransferCanceled})
			case "completed":
				query = query.Where("state = ?", model.TransferCompleted)
			default:
				return model.ErrInvalid
			}
			// 随机 UUID 顺序稳定，游标不依赖用户可修改的更新时间，也不使用无限 offset。
			if cursor != "" {
				query = query.Where("id > ?", cursor)
			}
			records := []transferRecord{}
			if err := query.Order("id ASC").Limit(limit + 1).Find(&records).Error; err != nil {
				return err
			}
			if len(records) > limit {
				records = records[:limit]
				page.NextCursor = records[len(records)-1].ID
			}
			for _, record := range records {
				page.Items = append(page.Items, model.Transfer(record))
			}
			return nil
		})
	})
	return page, err
}

func (r *Transfers) ChangeTransfer(ctx context.Context, owner, id, key string, change func(service.TransferSnapshot) (model.Transfer, *model.Entry, error)) (model.Transfer, error) {
	if owner == "" || change == nil || (id != "" && key != "") {
		return model.Transfer{}, model.ErrInvalid
	}
	var result model.Transfer
	err := r.access.WithinTx(ctx, func(ctx context.Context, _ database.Client, tx database.Tx) error {
		return database.UseGORMTx(ctx, tx, func(db *gorm.DB) error {
			if err := r.lockOwner(db, owner); err != nil {
				return err
			}
			if err := r.checkStaging(db); err != nil {
				return err
			}
			entries, err := loadEntries(db, owner)
			if err != nil {
				return err
			}
			snapshot := service.TransferSnapshot{Entries: entries}
			if id != "" || key != "" {
				var previous transferRecord
				query := db.Where("owner_id = ?", owner)
				if id != "" {
					query = query.Where("id = ?", id)
				} else {
					query = query.Where("idempotency_key = ?", key)
				}
				err := query.First(&previous).Error
				if err == nil {
					owned := model.Transfer(previous)
					snapshot.Transfer = &owned
					if owned.ConnectionID != "" {
						var connection connectionRecord
						if err := db.First(&connection, "id = ? AND owner_id = ?", owned.ConnectionID, owner).Error; err != nil {
							return err
						}
						current := model.Connection(connection)
						snapshot.Connection = &current
					}
				} else if !errors.Is(err, gorm.ErrRecordNotFound) {
					return err
				}
			}
			type reservation struct {
				OwnerID    string
				Bytes      int64
				QuotaBytes int64
				Count      int64
			}
			reservations := []reservation{}
			// 仅聚合仍占预算的项；不把无界历史记录全量载入 service。
			if err := db.Model(&transferRecord{}).Select("owner_id, SUM(size_bytes) AS bytes, SUM(quota_reserved_bytes) AS quota_bytes, COUNT(*) AS count").Where("state NOT IN ? OR cleanup_pending = ?", []model.TransferState{model.TransferCompleted, model.TransferCanceled, model.TransferExpired}, true).Group("owner_id").Scan(&reservations).Error; err != nil {
				return err
			}
			for _, reservation := range reservations {
				if reservation.Bytes < 0 || reservation.QuotaBytes < 0 || reservation.Count < 0 {
					return fmt.Errorf("transfer reservation invariant")
				}
				snapshot.GlobalReservedBytes += reservation.Bytes
				snapshot.GlobalReservedCount += reservation.Count
				if reservation.OwnerID == owner {
					snapshot.OwnerReservedBytes = reservation.QuotaBytes
					snapshot.OwnerReservedCount = reservation.Count
				}
			}
			changed, entry, err := change(snapshot)
			if err != nil {
				return err
			}
			if changed.OwnerID != owner || model.ValidateTransferID(changed.ID) != nil || changed.SizeBytes < 0 || changed.QuotaReservedBytes < 0 || changed.QuotaReservedBytes > changed.SizeBytes || !changed.Source.Valid() || !changed.State.Valid() {
				return fmt.Errorf("transfer identity invariant")
			}
			if previous := snapshot.Transfer; previous != nil {
				sealed := previous.Source == model.TransferSourceWebDAV && previous.ContentSHA256 == "" && changed.ContentSHA256 != "" && previous.State == model.TransferReceiving && changed.State == model.TransferReceiving && changed.SizeKnown && changed.SizeBytes <= previous.SizeBytes && changed.QuotaReservedBytes <= previous.QuotaReservedBytes
				if changed.ID != previous.ID || changed.Source != previous.Source || changed.ConnectionID != previous.ConnectionID || changed.ConnectionRevision != previous.ConnectionRevision || changed.ExpectedEntryID != previous.ExpectedEntryID || changed.ExpectedContentRevision != previous.ExpectedContentRevision || (!sealed && (changed.SizeBytes != previous.SizeBytes || changed.SizeKnown != previous.SizeKnown || changed.QuotaReservedBytes != previous.QuotaReservedBytes || changed.ContentSHA256 != previous.ContentSHA256)) || changed.IdempotencyKey != previous.IdempotencyKey || changed.ObjectKey != previous.ObjectKey || !changed.CreatedAt.Equal(previous.CreatedAt) || !changed.ExpiresAt.Equal(previous.ExpiresAt) {
					return fmt.Errorf("transfer immutable identity invariant")
				}
				changed.Revision = previous.Revision + 1
				record := transferRecord(changed)
				if err := db.Model(&transferRecord{}).Where("owner_id = ? AND id = ?", owner, changed.ID).Select("*").Updates(&record).Error; err != nil {
					return err
				}
			} else {
				if id != "" {
					return model.ErrMissing
				}
				changed.Revision = 1
				if changed.Source == model.TransferSourceWebDAV {
					var connection connectionRecord
					if err := db.First(&connection, "id = ? AND owner_id = ? AND revision = ?", changed.ConnectionID, owner, changed.ConnectionRevision).Error; err != nil {
						return err
					}
					if connection.State != model.ConnectionActive || connection.ReadOnly {
						return service.ErrConnectionUnavailable
					}
				}
				record := transferRecord(changed)
				if err := db.Create(&record).Error; err != nil {
					return err
				}
			}
			if entry != nil {
				if entry.OwnerID != owner || entry.ID == "" || changed.EntryID != entry.ID || changed.State != model.TransferCompleted {
					return fmt.Errorf("transfer publication invariant")
				}
				record := entryRecord(*entry)
				if _, exists := model.Find(entries, entry.ID); exists {
					if changed.Source != model.TransferSourceWebDAV || changed.ExpectedEntryID != entry.ID {
						return model.ErrConflict
					}
					update := db.Model(&entryRecord{}).Where("owner_id = ? AND id = ? AND content_revision = ?", owner, entry.ID, changed.ExpectedContentRevision).Select("*").Updates(&record)
					if update.Error != nil {
						return update.Error
					}
					if update.RowsAffected != 1 {
						return model.ErrConflict
					}
				} else if err := db.Create(&record).Error; err != nil {
					return err
				}
			}
			result = changed
			return nil
		})
	})
	return result, err
}

var _ service.TransferRepository = (*Transfers)(nil)
