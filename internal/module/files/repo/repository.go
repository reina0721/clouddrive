// Package repo 通过现有数据库租约保存 files 元数据，不拥有连接关闭权。
package repo

import (
	"context"
	"fmt"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/pkg/database"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"time"
)

type Access interface {
	Use(context.Context, func(database.Client) error) error
	WithinTx(context.Context, func(context.Context, database.Client, database.Tx) error) error
}
type Repository struct {
	access   Access
	identity string
}

const primaryStorageID = "primary"

type entryRecord model.Entry

func (entryRecord) TableName() string { return "files_entries" }

func loadEntries(db *gorm.DB, owner string) ([]model.Entry, error) {
	records := []entryRecord{}
	if err := db.Where("owner_id = ?", owner).Find(&records).Error; err != nil {
		return nil, err
	}
	entries := make([]model.Entry, len(records))
	for index, record := range records {
		entries[index] = model.Entry(record)
	}
	return entries, nil
}

func (r *Repository) checkStorage(db *gorm.DB) error {
	var binding storageBinding
	if err := db.First(&binding, "id = ?", primaryStorageID).Error; err != nil {
		return err
	}
	if binding.Identity != r.identity {
		return fmt.Errorf("file storage identity changed")
	}
	return nil
}

type storageBinding struct {
	ID       string `gorm:"primaryKey"`
	Identity string
}

func (storageBinding) TableName() string { return "files_storage" }

type pendingCleanup struct {
	ObjectKey string `gorm:"primaryKey"`
	OwnerID   string
	CreatedAt time.Time
}

func (pendingCleanup) TableName() string { return "files_pending_cleanup" }

// ValidateStorage 在候选发布前绑定内容存储身份；有文件时拒绝无迁移切换存储位置。
func (r *Repository) ValidateStorage(ctx context.Context, identity string) error {
	return r.access.WithinTx(ctx, func(ctx context.Context, _ database.Client, tx database.Tx) error {
		return database.UseGORMTx(ctx, tx, func(db *gorm.DB) error {
			binding := storageBinding{ID: primaryStorageID, Identity: identity}
			if err := db.Clauses(clause.OnConflict{DoNothing: true}).Create(&binding).Error; err != nil {
				return err
			}
			if err := db.Model(&storageBinding{}).Where("id = ?", primaryStorageID).UpdateColumn("identity", gorm.Expr("identity")).Error; err != nil {
				return err
			}
			if err := db.First(&binding, "id = ?", primaryStorageID).Error; err != nil {
				return err
			}
			if binding.Identity == identity {
				return nil
			}
			var count int64
			if err := db.Model(&entryRecord{}).Count(&count).Error; err != nil {
				return err
			}
			var pending int64
			if err := db.Model(&pendingCleanup{}).Count(&pending).Error; err != nil {
				return err
			}
			if count > 0 || pending > 0 {
				return fmt.Errorf("file storage location change requires content migration")
			}
			var transfers int64
			if err := db.Model(&transferRecord{}).Where("state NOT IN ? OR cleanup_pending = ?", []model.TransferState{model.TransferCompleted, model.TransferCanceled, model.TransferExpired}, true).Count(&transfers).Error; err != nil {
				return err
			}
			if transfers > 0 {
				return fmt.Errorf("file storage location change requires transfer migration")
			}
			return db.Model(&binding).Update("identity", identity).Error
		})
	})
}

// RecordCleanup 持久化补偿失败对象，禁止把未清理对象只留在日志中。
func (r *Repository) RecordCleanup(ctx context.Context, owner, key string) error {
	return r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			return db.Clauses(clause.OnConflict{DoNothing: true}).Create(&pendingCleanup{ObjectKey: key, OwnerID: owner, CreatedAt: time.Now().UTC()}).Error
		})
	})
}

func New(access Access, identity string) (*Repository, error) {
	if access == nil || identity == "" {
		return nil, fmt.Errorf("files database is required")
	}
	return &Repository{access: access, identity: identity}, nil
}
func (r *Repository) Read(ctx context.Context, owner string) ([]model.Entry, error) {
	entries := []model.Entry{}
	err := r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			var err error
			entries, err = loadEntries(db, owner)
			if err != nil {
				return err
			}
			// 有内容时不允许位置切换；查询后校验还覆盖空库切换与旧代请求并存的窗口。
			return r.checkStorage(db)
		})
	})
	return entries, err
}

type ownerLock struct {
	OwnerID  string `gorm:"primaryKey"`
	Revision int64
}

func (ownerLock) TableName() string { return "files_owners" }

// Change 先锁定存储身份再锁 owner；防止空库换存储时旧代上传提交到新位置的元数据。
func (r *Repository) Change(ctx context.Context, owner string, change func([]model.Entry) (model.Entry, error)) (model.Entry, error) {
	entries, err := r.ChangeMany(ctx, owner, func(entries []model.Entry) ([]model.Entry, error) {
		entry, err := change(entries)
		if err != nil {
			return nil, err
		}
		return []model.Entry{entry}, nil
	})
	if err != nil {
		return model.Entry{}, err
	}
	return entries[0], nil
}

// ChangeMany 在同一存储和 owner 锁内保存整个变化集合，任何一项失败都会回滚。
func (r *Repository) ChangeMany(ctx context.Context, owner string, change func([]model.Entry) ([]model.Entry, error)) ([]model.Entry, error) {
	var result []model.Entry
	err := r.access.WithinTx(ctx, func(ctx context.Context, _ database.Client, tx database.Tx) error {
		return database.UseGORMTx(ctx, tx, func(db *gorm.DB) error {
			if err := r.lockOwner(db, owner); err != nil {
				return err
			}
			entries, err := loadEntries(db, owner)
			if err != nil {
				return err
			}
			changed, err := change(entries)
			if err != nil {
				return err
			}
			seen := make(map[string]bool, len(changed))
			for _, entry := range changed {
				if entry.OwnerID != owner || entry.ID == "" || seen[entry.ID] {
					return fmt.Errorf("files mutation identity invariant")
				}
				seen[entry.ID] = true
				record := entryRecord(entry)
				if _, exists := model.Find(entries, entry.ID); exists {
					if err := db.Model(&entryRecord{}).Where("id = ? AND owner_id = ?", entry.ID, owner).Select("*").Updates(&record).Error; err != nil {
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
