package repo

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/clock"
	"github.com/reina0721/clouddrive/pkg/database"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Transfers 固定本代内容和暂存位置；旧代不能在换根后继续接收新会话。
type Transfers struct {
	*Repository
	stagingIdentity string
	metadataEntries int
}

func NewTransfers(access Access, storageIdentity, stagingIdentity string, metadataEntries int, currentClock clock.Clock) (*Transfers, error) {
	if stagingIdentity == "" || metadataEntries < 1 || metadataEntries > service.DefaultSearchTreeEntries || currentClock == nil {
		return nil, model.ErrInvalid
	}
	repository, err := New(access, storageIdentity, currentClock)
	if err != nil {
		return nil, err
	}
	return &Transfers{Repository: repository, stagingIdentity: stagingIdentity, metadataEntries: metadataEntries}, nil
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
	if err != nil {
		return model.Transfer{}, err
	}
	return transfer.model()
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
			return db.Where("source <> ?", model.TransferSourceOffline).Where("(state NOT IN ? AND expires_at <= ?) OR cleanup_pending = ?", []model.TransferState{model.TransferCompleted, model.TransferCanceled, model.TransferExpired}, now, true).Order("id ASC").Limit(limit).Find(&records).Error
		})
	})
	if err != nil {
		return nil, err
	}
	transfers := make([]model.Transfer, len(records))
	for index, record := range records {
		var err error
		transfers[index], err = record.model()
		if err != nil {
			return nil, err
		}
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
			query := db.Model(&transferRecord{}).Where("owner_id = ? AND source NOT IN ?", owner, []model.TransferSource{model.TransferSourceOffline, model.TransferSourceShare})
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
				transfer, err := record.model()
				if err != nil {
					return err
				}
				page.Items = append(page.Items, transfer)
			}
			return nil
		})
	})
	return page, err
}

func (r *Transfers) ChangeTransfer(ctx context.Context, owner, id, key string, change func(service.TransferSnapshot) (model.Transfer, *model.Entry, error)) (model.Transfer, error) {
	return r.changeTransfer(ctx, owner, id, key, nil, nil, change)
}

// changeTransfer 让任务创建与传输预算共享同一个存储/owner事务，避免先建空任务再补传输。
func (r *Transfers) changeTransfer(ctx context.Context, owner, id, key string, task *model.DownloadTask, shareAccess *service.ShareAccess, change func(service.TransferSnapshot) (model.Transfer, *model.Entry, error)) (model.Transfer, error) {
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
			snapshot := service.TransferSnapshot{}
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
					owned, err := previous.model()
					if err != nil {
						return err
					}
					snapshot.Transfer = &owned
					if owned.Source == model.TransferSourceOffline {
						current, err := readDownloadTask(db, owner, owned.DownloadID)
						if err != nil {
							return err
						}
						snapshot.DownloadTask = &current
					}
					if owned.Source == model.TransferSourceShare {
						if err := loadTransferShare(db, &snapshot, owner, owned.ShareID, owned.ShareGrantDigest); err != nil {
							return err
						}
					}
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
			if snapshot.Transfer == nil && shareAccess != nil {
				if err := loadTransferShare(db, &snapshot, owner, shareAccess.ShareID, shareAccess.GrantDigest); err != nil {
					return err
				}
			}
			var entries []model.Entry
			var err error
			if task != nil || snapshot.DownloadTask != nil || shareAccess != nil || snapshot.Share != nil {
				entries, snapshot.MetadataLimited, err = downloadEntrySnapshot(db, owner, r.metadataEntries)
			} else {
				entries, err = loadEntries(db, owner)
			}
			if err != nil {
				return err
			}
			snapshot.Entries = entries
			snapshot.HistoryPreferences, err = loadHistoryPreferences(db, owner)
			if err != nil {
				return err
			}
			reservations, err := loadTransferReservations(db, owner)
			if err != nil {
				return err
			}
			snapshot.GlobalReservedBytes, snapshot.GlobalReservedCount = reservations.GlobalBytes, reservations.GlobalCount
			snapshot.OwnerReservedBytes, snapshot.OwnerReservedCount = reservations.OwnerBytes, reservations.OwnerCount
			if task != nil {
				var total, owned int64
				if err := db.Model(&downloadRecord{}).Count(&total).Error; err != nil {
					return err
				}
				if err := db.Model(&downloadRecord{}).Where("owner_id = ?", owner).Count(&owned).Error; err != nil {
					return err
				}
				snapshot.GlobalDownloadRecords, snapshot.OwnerDownloadRecords = int(total), int(owned)
			}
			changed, entry, err := change(snapshot)
			if err != nil {
				return err
			}
			if snapshot.Transfer == nil || entry != nil {
				authority := model.FileWriteAuthority{}
				if changed.Source == model.TransferSourceWebDAV {
					locks, err := loadWriteLocks(db, owner, r.clock.Now().UTC())
					if err != nil {
						return err
					}
					var matched bool
					authority, matched, err = model.EvaluateDAVCondition(entries, locks, changed.DAVCondition, changed.ConnectionID, changed.ConnectionRevision)
					if err != nil {
						return err
					}
					if !matched {
						return service.ErrContentPrecondition
					}
				}
				target := entry
				if target == nil {
					candidate := model.Entry{ID: changed.ID, OwnerID: owner, ParentID: changed.ParentID, Name: changed.Name, NormalizedName: changed.NormalizedName, Kind: model.File}
					if changed.ExpectedEntryID != "" {
						existing, ok := model.Find(entries, changed.ExpectedEntryID)
						if !ok {
							return model.ErrConflict
						}
						candidate = existing
					}
					target = &candidate
				}
				if err := r.guardWriteLocks(db, owner, entries, []model.Entry{*target}, authority); err != nil {
					return err
				}
			}
			if entry != nil && snapshot.MetadataLimited {
				return model.ErrDownloadMetadataLimited
			}
			if changed.OwnerID != owner || model.ValidateTransferID(changed.ID) != nil || changed.SizeBytes < 0 || changed.SizeBytes > model.MaxFileContentBytes || changed.QuotaReservedBytes < 0 || changed.QuotaReservedBytes > changed.SizeBytes || !changed.Source.Valid() || !changed.State.Valid() {
				return fmt.Errorf("transfer identity invariant")
			}
			if (changed.Source == model.TransferSourceOffline) != (changed.DownloadID != "") || (changed.DownloadID != "" && model.ValidateTransferID(changed.DownloadID) != nil) {
				return fmt.Errorf("transfer download ownership invariant")
			}
			if (changed.Source == model.TransferSourceShare) != (changed.ShareID != "") || changed.Source != model.TransferSourceShare && (changed.ShareRevision != 0 || changed.ShareGrantDigest != "" || changed.ShareAudienceSubject != "") || changed.Source == model.TransferSourceShare && (changed.ShareAudienceSubject != "" && model.ValidateTransferID(changed.ShareAudienceSubject) != nil || model.ValidateTransferID(changed.ShareID) != nil || changed.ShareRevision < 1 || changed.ShareRevision > model.MaxContentRevision || (changed.ShareGrantDigest != "" && len(changed.ShareGrantDigest) != 64)) {
				return fmt.Errorf("transfer share binding invariant")
			}
			if previous := snapshot.Transfer; previous != nil {
				if !changed.DAVCondition.Equal(previous.DAVCondition) {
					return fmt.Errorf("transfer DAV condition immutable invariant")
				}
				sealed := previous.Source == model.TransferSourceWebDAV && previous.ContentSHA256 == "" && changed.ContentSHA256 != "" && previous.State == model.TransferReceiving && changed.State == model.TransferReceiving && changed.SizeKnown && changed.SizeBytes <= previous.SizeBytes && changed.QuotaReservedBytes <= previous.QuotaReservedBytes
				offlineMutable := false
				if current := snapshot.DownloadTask; previous.Source == model.TransferSourceOffline && !previous.Terminal() && current != nil && entry == nil && current.LeaseValid(r.clock.Now().UTC()) {
					allocating := current.Intent == model.DownloadRun && (current.State == model.DownloadFetching || current.State == model.DownloadPublishing) && changed.State == model.TransferReceiving
					resetting := current.Intent == model.DownloadPause && (current.State == model.DownloadPaused || current.State == model.DownloadFailed) && changed.State == model.TransferPreparing && changed.SizeBytes == 0 && changed.QuotaReservedBytes == 0 && !changed.SizeKnown && changed.ContentSHA256 == ""
					offlineMutable = allocating || resetting
				}
				if changed.ID != previous.ID || changed.Source != previous.Source || changed.ShareID != previous.ShareID || changed.ShareRevision != previous.ShareRevision || changed.ShareGrantDigest != previous.ShareGrantDigest || changed.ShareAudienceSubject != previous.ShareAudienceSubject || changed.DownloadID != previous.DownloadID || changed.ConnectionID != previous.ConnectionID || changed.ConnectionRevision != previous.ConnectionRevision || changed.ExpectedEntryID != previous.ExpectedEntryID || changed.ExpectedContentRevision != previous.ExpectedContentRevision || (!sealed && !offlineMutable && (changed.SizeBytes != previous.SizeBytes || changed.SizeKnown != previous.SizeKnown || changed.QuotaReservedBytes != previous.QuotaReservedBytes || changed.ContentSHA256 != previous.ContentSHA256)) || changed.IdempotencyKey != previous.IdempotencyKey || changed.ObjectKey != previous.ObjectKey || !changed.CreatedAt.Equal(previous.CreatedAt) || !changed.ExpiresAt.Equal(previous.ExpiresAt) {
					return fmt.Errorf("transfer immutable identity invariant")
				}
				changed.Revision = previous.Revision + 1
				record, err := transferRecordFromModel(changed)
				if err != nil {
					return err
				}
				if err := db.Model(&transferRecord{}).Where("owner_id = ? AND id = ?", owner, changed.ID).Select("*").Updates(&record).Error; err != nil {
					return err
				}
			} else {
				if id != "" {
					return model.ErrMissing
				}
				changed.Revision = 1
				if changed.Source == model.TransferSourceOffline {
					if task == nil || changed.DownloadID != task.ID || task.OwnerID != owner || model.ValidateDownloadTask(*task) != nil {
						return model.ErrInvalid
					}
					record := downloadRecord(*task)
					if err := db.Create(&record).Error; err != nil {
						return err
					}
				} else if task != nil {
					return model.ErrInvalid
				}
				if changed.Source == model.TransferSourceShare {
					if shareAccess == nil || snapshot.Share == nil || changed.ShareID != shareAccess.ShareID || changed.ShareRevision != shareAccess.ShareRevision || changed.ShareGrantDigest != shareAccess.GrantDigest || changed.ShareAudienceSubject != shareAccess.AudienceSubject {
						return model.ErrShareForbidden
					}
				}
				if changed.Source == model.TransferSourceWebDAV {
					var connection connectionRecord
					if err := db.First(&connection, "id = ? AND owner_id = ? AND revision = ?", changed.ConnectionID, owner, changed.ConnectionRevision).Error; err != nil {
						return err
					}
					if connection.State != model.ConnectionActive || connection.ReadOnly {
						return service.ErrConnectionUnavailable
					}
				}
				record, err := transferRecordFromModel(changed)
				if err != nil {
					return err
				}
				if err := db.Create(&record).Error; err != nil {
					return err
				}
			}
			if entry != nil {
				if entry.OwnerID != owner || entry.ID == "" || changed.EntryID != entry.ID || changed.State != model.TransferCompleted {
					return fmt.Errorf("transfer publication invariant")
				}
				record, err := entryRecordFromModel(*entry)
				if err != nil {
					return err
				}
				if previous, exists := model.Find(entries, entry.ID); exists {
					if (changed.Source != model.TransferSourceWebDAV && changed.Source != model.TransferSourceTus) || changed.ExpectedEntryID != entry.ID || changed.ExpectedContentRevision < 1 {
						return model.ErrConflict
					}
					update := db.Model(&entryRecord{}).Where("owner_id = ? AND id = ? AND content_revision = ?", owner, entry.ID, changed.ExpectedContentRevision).Select("*").Updates(&record)
					if update.Error != nil {
						return update.Error
					}
					if update.RowsAffected != 1 {
						return model.ErrConflict
					}
					if err := queueDetachedBlobs(db, detachedBlobRecords(previous, *entry, r.clock.Now().UTC().Truncate(time.Second))); err != nil {
						return err
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
