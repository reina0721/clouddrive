package repo

import (
	"context"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/database"
	"gorm.io/gorm"
	"time"
)

func (r *Repository) RelatedSharePolicies(ctx context.Context, owner string, roots []string, limit int, now time.Time) ([]model.Share, error) {
	if owner == "" || len(roots) == 0 || len(roots) > service.DefaultSearchTreeEntries || limit < 1 || limit > service.DefaultShareActiveLimit {
		return nil, model.ErrInvalid
	}
	result := []model.Share{}
	err := r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			if err := r.checkStorage(db); err != nil {
				return err
			}
			var records []shareRecord
			if err := db.Where("owner_id = ? AND root_id IN ? AND state = ? AND revoked_at IS NULL AND expires_at > ?", owner, roots, model.ShareEnabled, now).Order("id").Limit(limit + 1).Find(&records).Error; err != nil {
				return err
			}
			if len(records) > limit {
				return model.ErrTooLarge
			}
			for _, record := range records {
				share, err := record.model()
				if err != nil {
					return err
				}
				if !validShareRecord(share) {
					return model.ErrInvalid
				}
				result = append(result, share)
			}
			return nil
		})
	})
	return result, err
}
