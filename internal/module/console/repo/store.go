package repo

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/reina0721/clouddrive/internal/module/console/model"
	"github.com/reina0721/clouddrive/pkg/database"
	"github.com/reina0721/clouddrive/pkg/idgen"
	"gorm.io/gorm"
	"time"
)

// Access 是控制台持久化消费的数据库租约，不包含连接池关闭权。
type Access interface {
	Use(context.Context, func(database.Client) error) error
	WithinTx(context.Context, func(context.Context, database.Client, database.Tx) error) error
}
type Store struct{ access Access }

func New(access Access) (*Store, error) {
	if access == nil {
		return nil, errors.New("console database access is nil")
	}
	return &Store{access: access}, nil
}
func (s *Store) use(ctx context.Context, fn func(*gorm.DB) error) error {
	return s.access.Use(ctx, func(client database.Client) error { return database.UseGORM(ctx, client, fn) })
}
func (s *Store) transaction(ctx context.Context, fn func(*gorm.DB) error) error {
	return s.access.WithinTx(ctx, func(ctx context.Context, _ database.Client, tx database.Tx) error {
		return database.UseGORMTx(ctx, tx, fn)
	})
}

func (s *Store) Record(ctx context.Context, event model.Event) error {
	id, err := idgen.UUID().New()
	if err != nil {
		return err
	}
	event.ID = id
	event.CreatedAt = time.Now().UTC()
	return s.transaction(ctx, func(db *gorm.DB) error {
		if err := db.Table("console_events").Create(&event).Error; err != nil {
			return err
		}
		notificationID, err := idgen.UUID().New()
		if err != nil {
			return err
		}
		category := event.NotificationCategory
		if category == "" {
			category = event.Result
		}
		n := model.Notification{ID: notificationID, OwnerID: event.ActorID, Operation: event.Operation, ObjectID: event.ObjectID, ObjectName: event.ObjectName, Category: category, CreatedAt: event.CreatedAt}
		return db.Table("console_notifications").Create(&n).Error
	})
}

func emptyWorkspace() json.RawMessage {
	return json.RawMessage(`{"version":1,"projects":[],"collections":[],"requests":[],"environments":[],"globals":[],"tasks":[],"history":[]}`)
}
func (s *Store) Workspace(ctx context.Context, owner string) (model.WorkspaceRecord, error) {
	var record model.WorkspaceRecord
	err := s.use(ctx, func(db *gorm.DB) error {
		return db.Table("console_workspaces").Where("owner_id = ?", owner).First(&record).Error
	})
	if errors.Is(err, database.ErrNotFound) || errors.Is(err, gorm.ErrRecordNotFound) {
		return model.WorkspaceRecord{OwnerID: owner, Snapshot: string(emptyWorkspace())}, nil
	}
	return record, err
}
func (s *Store) SaveWorkspace(ctx context.Context, record model.WorkspaceRecord) error {
	return s.transaction(ctx, func(db *gorm.DB) error {
		record.UpdatedAt = time.Now().UTC()
		if record.Version == 0 {
			record.Version = 1
			return db.Table("console_workspaces").Create(&record).Error
		}
		result := db.Table("console_workspaces").Where("owner_id = ? AND version = ?", record.OwnerID, record.Version).Updates(map[string]any{"snapshot": record.Snapshot, "version": record.Version + 1, "updated_at": record.UpdatedAt})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return database.ErrOptimisticConflict
		}
		return nil
	})
}
