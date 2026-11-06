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

// ReadShareBinding 只读取清理需要的不可变归属，不让目录预算或授权撤销阻止候选回收。
func (r *Repository) ReadShareBinding(ctx context.Context, digest string) (model.Share, error) {
	var result model.Share
	err := r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			if err := r.checkStorage(db); err != nil {
				return err
			}
			var record shareRecord
			if err := db.First(&record, "token_digest = ?", digest).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return errors.Join(model.ErrMissing, err)
				}
				return err
			}
			decoded, decodeErr := record.model()
			if decodeErr != nil {
				return decodeErr
			}
			result = decoded
			if !validShareRecord(result) {
				return fmt.Errorf("share policy invariant")
			}
			return nil
		})
	})
	return result, err
}

// ChangeSharedFiles 与策略写入持有同一owner锁，不能通过事务外的分享检查取得写权限。
func (r *Repository) ChangeSharedFiles(ctx context.Context, digest, grantDigest string, limit int, change func(service.ShareSnapshot) ([]model.Entry, error)) ([]model.Entry, error) {
	if limit < 1 || limit > service.DefaultSearchTreeEntries || change == nil {
		return nil, model.ErrInvalid
	}
	var result []model.Entry
	err := r.access.WithinTx(ctx, func(ctx context.Context, _ database.Client, tx database.Tx) error {
		return database.UseGORMTx(ctx, tx, func(db *gorm.DB) error {
			var initial shareRecord
			if err := db.First(&initial, "token_digest = ?", digest).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return errors.Join(model.ErrMissing, err)
				}
				return err
			}
			if err := r.lockOwner(db, initial.OwnerID); err != nil {
				return err
			}
			var current shareRecord
			if err := db.First(&current, "id = ? AND token_digest = ? AND owner_id = ?", initial.ID, digest, initial.OwnerID).Error; err != nil {
				return err
			}
			decoded, decodeErr := current.model()
			if decodeErr != nil {
				return decodeErr
			}
			if !validShareRecord(decoded) {
				return fmt.Errorf("share policy invariant")
			}
			entries, err := loadBoundedEntries(db, current.OwnerID, limit)
			if err != nil {
				return err
			}
			preferences, err := loadHistoryPreferences(db, current.OwnerID)
			if err != nil {
				return err
			}
			snapshot := service.ShareSnapshot{Share: decoded, Entries: entries, HistoryPreferences: preferences}
			if grantDigest != "" {
				var grant grantRecord
				err := db.First(&grant, "digest = ? AND share_id = ?", grantDigest, current.ID).Error
				if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
					return err
				}
				if err == nil {
					converted := model.ShareGrant(grant)
					snapshot.Grant = &converted
				}
			}
			changed, err := change(snapshot)
			if err != nil {
				return err
			}
			if err := r.saveEntryChanges(db, current.OwnerID, entries, changed, model.FileWriteAuthority{}); err != nil {
				return err
			}
			// 返回同一事务内的持久表示，避免数据库时间精度与Go回执不一致。
			ids := make([]string, 0, len(changed))
			for _, entry := range changed {
				ids = append(ids, entry.ID)
			}
			var records []entryRecord
			if err := db.Where("owner_id = ? AND id IN ?", current.OwnerID, ids).Find(&records).Error; err != nil {
				return err
			}
			persisted, err := entryModels(records)
			if err != nil {
				return err
			}
			for _, entry := range changed {
				stored, ok := model.Find(persisted, entry.ID)
				if !ok {
					return fmt.Errorf("shared mutation receipt invariant")
				}
				result = append(result, stored)
			}
			return nil
		})
	})
	return result, err
}
