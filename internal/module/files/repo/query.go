package repo

import (
	"context"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/database"
	"gorm.io/gorm"
)

// ReadBounded 不将截断结果伪装为完整文件树，且读取后复核内容位置。
func (r *Repository) ReadBounded(ctx context.Context, owner string, limit int) ([]model.Entry, error) {
	if owner == "" {
		return nil, model.ErrMissing
	}
	if limit < 1 || limit > service.DefaultSearchTreeEntries {
		return nil, model.ErrInvalid
	}
	var result []model.Entry
	err := r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			entries, err := loadBoundedEntries(db, owner, limit)
			if err != nil {
				return err
			}
			if err := r.checkStorage(db); err != nil {
				return err
			}
			result = entries
			return nil
		})
	})
	return result, err
}
