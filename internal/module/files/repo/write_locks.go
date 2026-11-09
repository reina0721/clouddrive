package repo

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/database"
	"gorm.io/gorm"
)

type writeLockRecord model.WriteLock

func (writeLockRecord) TableName() string { return "files_write_locks" }

const expiredWriteLockCleanupBatch = 100

// activeWriteLocks 同时检查持久连接事实，不能把令牌存在当成授权存在。
func activeWriteLocks(db *gorm.DB, owner string, now time.Time) *gorm.DB {
	return db.Model(&writeLockRecord{}).Select("files_write_locks.*").
		Joins("LEFT JOIN files_connections ON files_connections.id = files_write_locks.connection_id AND files_connections.owner_id = files_write_locks.owner_id AND files_connections.revision = files_write_locks.connection_revision").
		Joins("LEFT JOIN files_filesystem_settings AS wopi_policy ON wopi_policy.id = ? AND wopi_policy.revision = files_write_locks.wopi_settings_revision", fileApplicationsID).
		Where("files_write_locks.owner_id = ? AND files_write_locks.expires_at > ?", owner, now).
		Where("((files_write_locks.wopi_session_id = '' AND files_connections.expires_at > ? AND files_connections.state = ? AND files_connections.read_only = ?) OR (files_write_locks.wopi_session_id <> '' AND wopi_policy.id IS NOT NULL))", now, model.ConnectionActive, false)
}

func loadWriteLocks(db *gorm.DB, owner string, now time.Time) ([]model.WriteLock, error) {
	records := []writeLockRecord{}
	if err := activeWriteLocks(db, owner, now).Order("files_write_locks.id ASC").Limit(model.MaxWriteLocksPerOwner + 1).Find(&records).Error; err != nil {
		return nil, err
	}
	if len(records) > model.MaxWriteLocksPerOwner {
		return nil, model.ErrTooLarge
	}
	result := make([]model.WriteLock, 0, len(records))
	for _, record := range records {
		lock := model.WriteLock(record)
		if model.ValidateTransferID(lock.ID) != nil || lock.OwnerID != owner || (lock.Depth != model.WriteLockDepthZero && lock.Depth != model.WriteLockDepthInfinity) || lock.Revision < 1 || lock.RootPath == "" {
			return nil, fmt.Errorf("file write lock record invariant")
		}
		result = append(result, lock)
	}
	return result, nil
}

func (r *Repository) guardWriteLocks(db *gorm.DB, owner string, entries, changed []model.Entry, authority model.FileWriteAuthority) error {
	locks, err := loadWriteLocks(db, owner, r.clock.Now().UTC())
	if err != nil {
		return err
	}
	removed, err := model.CheckWriteLocks(entries, changed, locks, authority)
	if err != nil {
		return err
	}
	if len(removed) > 0 {
		return db.Where("owner_id = ? AND id IN ?", owner, removed).Delete(&writeLockRecord{}).Error
	}
	return nil
}

func (r *Repository) ReadWriteLocks(ctx context.Context, owner string) ([]model.WriteLock, error) {
	if owner == "" {
		return nil, model.ErrMissing
	}
	var result []model.WriteLock
	err := r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			if err := r.checkStorage(db); err != nil {
				return err
			}
			var err error
			result, err = loadWriteLocks(db, owner, r.clock.Now().UTC())
			return err
		})
	})
	return result, err
}

// ChangeWriteLocks 复用storage行的全局写序列，在锁与空文件创建之间不留下未保护窗口。
func (r *Repository) ChangeWriteLocks(ctx context.Context, owner, connectionID string, change func(service.WriteLockSnapshot) (service.WriteLockChange, error)) error {
	return r.changeWriteLocks(ctx, owner, connectionID, nil, change)
}

// ChangeWOPIWriteLocks 用与设置保存相同的序列验证已确认的应用策略。
func (r *Repository) ChangeWOPIWriteLocks(ctx context.Context, owner string, policyRevision int64, change func(service.WriteLockSnapshot) (service.WriteLockChange, error)) error {
	return r.changeWriteLocks(ctx, owner, "", &policyRevision, change)
}

func (r *Repository) changeWriteLocks(ctx context.Context, owner, connectionID string, wopiRevision *int64, change func(service.WriteLockSnapshot) (service.WriteLockChange, error)) error {
	if owner == "" || change == nil {
		return model.ErrInvalid
	}
	var wopiConflict *service.WOPILockConflict
	err := r.access.WithinTx(ctx, func(ctx context.Context, _ database.Client, tx database.Tx) error {
		return database.UseGORMTx(ctx, tx, func(db *gorm.DB) error {
			if err := r.lockOwner(db, owner); err != nil {
				return err
			}
			if wopiRevision != nil {
				var count int64
				if err := db.Model(&filesystemSettingsRecord{}).Where("id = ? AND revision = ?", fileApplicationsID, *wopiRevision).Count(&count).Error; err != nil {
					return err
				}
				if count != 1 {
					return model.ErrMissing
				}
			}
			now := r.clock.Now().UTC()
			// 有界清理使用子查询，避免把全局历史加载到内存；并行创建已由storage行串行化。
			expired := db.Model(&writeLockRecord{}).Select("id").Where("expires_at <= ?", now).Order("expires_at ASC").Limit(expiredWriteLockCleanupBatch)
			// 双层派生表兼容MySQL同表删除限制。
			if err := db.Where("id IN (?)", db.Table("(?) AS expired_file_locks", expired).Select("id")).Delete(&writeLockRecord{}).Error; err != nil {
				return err
			}
			activeIDs := activeWriteLocks(db, owner, now).Select("files_write_locks.id")
			if err := db.Where("owner_id = ? AND id NOT IN (?)", owner, db.Table("(?) AS active_owner_file_locks", activeIDs).Select("id")).Delete(&writeLockRecord{}).Error; err != nil {
				return err
			}
			snapshot := service.WriteLockSnapshot{}
			var err error
			snapshot.Entries, err = loadBoundedEntries(db, owner, service.DefaultConnectionTreeEntries)
			if err != nil {
				return err
			}
			snapshot.Locks, err = loadWriteLocks(db, owner, now)
			if err != nil {
				return err
			}
			if err := db.Model(&writeLockRecord{}).Where("expires_at > ?", now).Count(&snapshot.GlobalCount).Error; err != nil {
				return err
			}
			if wopiRevision != nil {
				snapshot.HistoryPreferences, err = loadHistoryPreferences(db, owner)
				if err != nil {
					return err
				}
				reservations, err := loadTransferReservations(db, owner)
				if err != nil {
					return err
				}
				snapshot.OwnerReservedBytes = reservations.OwnerBytes
			}
			if connectionID != "" {
				var record connectionRecord
				if err := db.First(&record, "id = ? AND owner_id = ?", connectionID, owner).Error; err != nil {
					if errors.Is(err, gorm.ErrRecordNotFound) {
						return model.ErrMissing
					}
					return err
				}
				connection := model.Connection(record)
				snapshot.Connection = &connection
			}
			changed, err := change(snapshot)
			if err != nil {
				// 数据库边界会隐藏驱动错误类型。单独保留 WOPI 协议需要的业务冲突值。
				if wopiRevision != nil {
					errors.As(err, &wopiConflict)
				}
				return err
			}
			if changed.Upsert != nil && changed.RemoveID != "" {
				return model.ErrInvalid
			}
			if len(changed.Entries) > 0 {
				if err := r.saveEntryChanges(db, owner, snapshot.Entries, changed.Entries, changed.Authority); err != nil {
					return err
				}
			}
			if changed.RemoveID != "" {
				deleted := db.Where("owner_id = ? AND id = ? AND revision = ?", owner, changed.RemoveID, changed.ExpectedRevision).Delete(&writeLockRecord{})
				if deleted.Error != nil {
					return deleted.Error
				}
				if deleted.RowsAffected != 1 {
					return model.ErrConflict
				}
				return nil
			}
			if lock := changed.Upsert; lock != nil {
				if lock.OwnerID != owner || model.ValidateTransferID(lock.ID) != nil || !lock.ExpiresAt.After(now) || !lock.ExpiresAt.After(lock.CreatedAt) {
					return model.ErrInvalid
				}
				if wopiRevision == nil {
					if lock.WOPISessionID != "" || lock.ConnectionID != connectionID || snapshot.Connection == nil ||
						lock.ConnectionRevision != snapshot.Connection.Revision || lock.ExpiresAt.After(snapshot.Connection.ExpiresAt) ||
						len(lock.OwnerXML) > model.MaxWriteLockOwnerXMLBytes || (lock.Depth != model.WriteLockDepthZero && lock.Depth != model.WriteLockDepthInfinity) {
						return model.ErrInvalid
					}
				} else if model.ValidateTransferID(lock.WOPISessionID) != nil || lock.ConnectionID != "" ||
					lock.ConnectionRevision != 0 || lock.OwnerXML != "" || lock.Depth != model.WriteLockDepthZero ||
					lock.WOPISettingsRevision != *wopiRevision || !model.ValidWOPILockValue(lock.WOPIValue) {
					return model.ErrInvalid
				}
				merged := slices.Clone(snapshot.Entries)
				for _, entry := range changed.Entries {
					position := slices.IndexFunc(merged, func(previous model.Entry) bool { return previous.ID == entry.ID })
					if position < 0 {
						merged = append(merged, entry)
					} else {
						merged[position] = entry
					}
				}
				namespace, err := model.NewLockNamespace(merged)
				if err != nil {
					return err
				}
				root, exists := namespace.Resolve(lock.RootPath)
				if !exists {
					return model.ErrMissing
				}
				if wopiRevision != nil {
					entry, exists := model.Find(merged, root)
					if !exists || entry.Kind != model.File || entry.ID != lock.WOPIEntryID ||
						entry.ContentRevision != lock.WOPIContentRevision {
						return model.ErrInvalid
					}
				}
				record := writeLockRecord(*lock)
				if changed.ExpectedRevision == 0 {
					if lock.Revision != 1 {
						return model.ErrInvalid
					}
					return db.Create(&record).Error
				}
				for _, previous := range snapshot.Locks {
					if previous.ID == lock.ID && (previous.RootPath != lock.RootPath || previous.Depth != lock.Depth || previous.OwnerXML != lock.OwnerXML || !previous.CreatedAt.Equal(lock.CreatedAt) || previous.ConnectionID != lock.ConnectionID || previous.ConnectionRevision != lock.ConnectionRevision ||
						previous.WOPISessionID != lock.WOPISessionID || previous.WOPIEntryID != lock.WOPIEntryID || previous.WOPISettingsRevision != lock.WOPISettingsRevision ||
						lock.WOPIContentRevision < previous.WOPIContentRevision || lock.WOPIContentRevision-previous.WOPIContentRevision > 1) {
						return model.ErrInvalid
					}
				}
				if lock.Revision != changed.ExpectedRevision+1 {
					return model.ErrInvalid
				}
				updated := db.Model(&writeLockRecord{}).Where("owner_id = ? AND id = ? AND revision = ?", owner, lock.ID, changed.ExpectedRevision).Select("*").Updates(&record)
				if updated.Error != nil {
					return updated.Error
				}
				if updated.RowsAffected != 1 {
					return model.ErrConflict
				}
			}
			return nil
		})
	})
	if wopiConflict != nil {
		return errors.Join(wopiConflict, err)
	}
	return err
}

var _ service.WriteLockRepository = (*Repository)(nil)
var _ service.WOPIWriteRepository = (*Repository)(nil)
