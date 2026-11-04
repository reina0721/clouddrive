package repo

import (
	"context"
	"errors"
	"fmt"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/database"
	"gorm.io/gorm"
)

type connectionRecord model.Connection

func (connectionRecord) TableName() string { return "files_connections" }

// Connections 固定存储位置及元数据读取上限，不拥有数据库连接。
type Connections struct {
	*Repository
	treeLimit int
}

func NewConnections(access Access, identity string, treeLimit int) (*Connections, error) {
	if treeLimit < 1 || treeLimit > service.DefaultConnectionTreeEntries {
		return nil, model.ErrInvalid
	}
	repository, err := New(access, identity)
	if err != nil {
		return nil, err
	}
	return &Connections{Repository: repository, treeLimit: treeLimit}, nil
}

func (r *Connections) entries(db *gorm.DB, owner string) ([]model.Entry, error) {
	records := []entryRecord{}
	if err := db.Where("owner_id = ?", owner).Order("id ASC").Limit(r.treeLimit + 1).Find(&records).Error; err != nil {
		return nil, err
	}
	if len(records) > r.treeLimit {
		return nil, model.ErrTooLarge
	}
	return entryModels(records)
}

func (r *Connections) ReadConnection(ctx context.Context, id string) (model.Connection, error) {
	var result model.Connection
	err := r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			if err := r.checkStorage(db); err != nil {
				return err
			}
			var record connectionRecord
			if err := db.First(&record, "id = ?", id).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return model.ErrMissing
				}
				return err
			}
			result = model.Connection(record)
			return nil
		})
	})
	return result, err
}
func (r *Connections) ConnectionEntries(ctx context.Context, owner string) ([]model.Entry, error) {
	var result []model.Entry
	err := r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			if err := r.checkStorage(db); err != nil {
				return err
			}
			var err error
			result, err = r.entries(db, owner)
			return err
		})
	})
	return result, err
}
func (r *Connections) ListConnections(ctx context.Context, owner, cursor string, limit int) (service.ConnectionPage, error) {
	page := service.ConnectionPage{Items: []model.Connection{}}
	if owner == "" || limit < 1 || limit > service.DefaultConnectionDirectoryEntries || (cursor != "" && model.ValidateTransferID(cursor) != nil) {
		return page, model.ErrInvalid
	}
	err := r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			if err := r.checkStorage(db); err != nil {
				return err
			}
			query := db.Where("owner_id = ?", owner)
			if cursor != "" {
				query = query.Where("id > ?", cursor)
			}
			records := []connectionRecord{}
			if err := query.Order("id ASC").Limit(limit + 1).Find(&records).Error; err != nil {
				return err
			}
			if len(records) > limit {
				records = records[:limit]
				page.NextCursor = records[len(records)-1].ID
			}
			for _, record := range records {
				page.Items = append(page.Items, model.Connection(record))
			}
			return nil
		})
	})
	return page, err
}
func (r *Connections) ChangeConnection(ctx context.Context, owner, id string, change func(service.ConnectionSnapshot) (model.Connection, error)) (model.Connection, error) {
	var result model.Connection
	if owner == "" || change == nil {
		return result, model.ErrInvalid
	}
	err := r.access.WithinTx(ctx, func(ctx context.Context, _ database.Client, tx database.Tx) error {
		return database.UseGORMTx(ctx, tx, func(db *gorm.DB) error {
			if err := r.lockOwner(db, owner); err != nil {
				return err
			}
			entries, err := r.entries(db, owner)
			if err != nil && !errors.Is(err, model.ErrTooLarge) {
				return err
			}
			snapshot := service.ConnectionSnapshot{Entries: entries, EntriesUnavailable: errors.Is(err, model.ErrTooLarge)}
			if id != "" {
				var record connectionRecord
				if err := db.First(&record, "owner_id = ? AND id = ?", owner, id).Error; err != nil {
					if errors.Is(err, gorm.ErrRecordNotFound) {
						return model.ErrMissing
					}
					return err
				}
				current := model.Connection(record)
				snapshot.Current = &current
			}
			if err := db.Model(&connectionRecord{}).Where("owner_id = ? AND state <> ?", owner, model.ConnectionRevoked).Count(&snapshot.ActiveCount).Error; err != nil {
				return err
			}
			changed, err := change(snapshot)
			if err != nil {
				return err
			}
			if changed.OwnerID != owner || model.ValidateTransferID(changed.ID) != nil || !changed.State.Valid() || changed.SecretDigest == "" {
				return fmt.Errorf("file connection identity invariant")
			}
			if previous := snapshot.Current; previous != nil {
				if changed.ID != previous.ID || changed.RootID != previous.RootID || !changed.CreatedAt.Equal(previous.CreatedAt) {
					return fmt.Errorf("file connection immutable scope invariant")
				}
				changed.Revision = previous.Revision + 1
				record := connectionRecord(changed)
				update := db.Model(&connectionRecord{}).Where("owner_id = ? AND id = ? AND revision = ?", owner, id, previous.Revision).Select("*").Updates(&record)
				if update.Error != nil {
					return update.Error
				}
				if update.RowsAffected != 1 {
					return model.ErrConflict
				}
			} else {
				changed.Revision = 1
				record := connectionRecord(changed)
				if err := db.Create(&record).Error; err != nil {
					return err
				}
			}
			result = changed
			return nil
		})
	})
	return result, err
}

var _ service.ConnectionRepository = (*Connections)(nil)

// ChangeConnectionFiles 在同一owner事务内重读连接，避免写操作绕过刚更新的scope策略。
func (r *Connections) ChangeConnectionFiles(ctx context.Context, id string, revision int64, change func(service.ConnectionFileSnapshot) ([]model.Entry, error)) ([]model.Entry, error) {
	if change == nil {
		return nil, model.ErrInvalid
	}
	connection, err := r.ReadConnection(ctx, id)
	if err != nil {
		return nil, err
	}
	var result []model.Entry
	err = r.access.WithinTx(ctx, func(ctx context.Context, _ database.Client, tx database.Tx) error {
		return database.UseGORMTx(ctx, tx, func(db *gorm.DB) error {
			if err := r.lockOwner(db, connection.OwnerID); err != nil {
				return err
			}
			var record connectionRecord
			if err := db.First(&record, "id = ? AND owner_id = ?", id, connection.OwnerID).Error; err != nil {
				return err
			}
			if record.Revision != revision {
				return service.ErrConnectionUnavailable
			}
			entries, err := r.entries(db, record.OwnerID)
			if err != nil {
				return err
			}
			changed, err := change(service.ConnectionFileSnapshot{Connection: model.Connection(record), Entries: entries})
			if err != nil {
				return err
			}
			if err := saveEntryChanges(db, record.OwnerID, entries, changed); err != nil {
				return err
			}
			result = changed
			return nil
		})
	})
	return result, err
}
