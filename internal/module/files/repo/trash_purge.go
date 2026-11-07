package repo

import (
	"context"
	"fmt"
	"math"
	"slices"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/database"
	"gorm.io/gorm"
)

// trashRemovalBatchSize 为所有支持的数据库保留绑定参数余量。
const trashRemovalBatchSize = 200

// RemoveTrash 在现有写入序列内移除已确认目录项，不取得物理内容的删除权。
func (r *Repository) RemoveTrash(ctx context.Context, owner string, limit int, plan func([]model.Entry) ([]string, error)) error {
	if limit < 1 || limit > service.DefaultSearchTreeEntries || plan == nil {
		return model.ErrInvalid
	}
	return r.access.WithinTx(ctx, func(ctx context.Context, _ database.Client, tx database.Tx) error {
		return database.UseGORMTx(ctx, tx, func(db *gorm.DB) error {
			if err := r.lockOwner(db, owner); err != nil {
				return err
			}
			entries, err := loadBoundedEntries(db, owner, limit)
			if err != nil {
				return err
			}
			ids, err := plan(entries)
			if err != nil {
				return err
			}
			pinsRemoved := false
			for batch := range slices.Chunk(ids, trashRemovalBatchSize) {
				deleted := db.Where("owner_id = ? AND id IN ?", owner, batch).Delete(&entryRecord{})
				if deleted.Error != nil {
					return deleted.Error
				}
				if deleted.RowsAffected != int64(len(batch)) {
					return model.ErrConflict
				}
				pins := db.Where("owner_id = ? AND target_kind IN ? AND target_id IN ?", owner, []model.PinKind{model.PinFolder, model.PinShortcut}, batch).Delete(&pinRecord{})
				if pins.Error != nil {
					return pins.Error
				}
				pinsRemoved = pinsRemoved || pins.RowsAffected != 0
			}
			if pinsRemoved {
				return bumpPinRevision(db, owner)
			}
			return nil
		})
	})
}

func bumpPinRevision(db *gorm.DB, owner string) error {
	updated := db.Model(&navigationState{}).Where("owner_id = ? AND revision < ?", owner, int64(math.MaxInt64)).Update("revision", gorm.Expr("revision + 1"))
	if updated.Error != nil {
		return updated.Error
	}
	if updated.RowsAffected != 1 {
		return fmt.Errorf("file pin cleanup revision invariant")
	}
	return nil
}
