package repo

import (
	"context"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/database"
	"gorm.io/gorm"
)

type directLinkRecord struct {
	ID          string `gorm:"primaryKey"`
	OwnerID     string
	EntryID     string
	Token       string
	TokenDigest string
	CreatedAt   time.Time
}

func (directLinkRecord) TableName() string { return "files_direct_links" }

func (record directLinkRecord) model() model.DirectLink {
	return model.DirectLink{ID: record.ID, OwnerID: record.OwnerID, EntryID: record.EntryID, Token: record.Token, TokenDigest: record.TokenDigest, CreatedAt: record.CreatedAt}
}

// IssueDirectLinks 串行复用同一文件的链接，只对业务上无效的条目返回逐项失败。
func (r *Repository) IssueDirectLinks(ctx context.Context, owner string, proposed []model.DirectLink, treeLimit int) ([]service.DirectLinkResult, error) {
	results := make([]service.DirectLinkResult, 0, len(proposed))
	err := r.access.WithinTx(ctx, func(ctx context.Context, _ database.Client, tx database.Tx) error {
		return database.UseGORMTx(ctx, tx, func(db *gorm.DB) error {
			if err := r.lockOwner(db, owner); err != nil {
				return err
			}
			entries, err := loadBoundedEntries(db, owner, treeLimit)
			if err != nil {
				return err
			}
			var count int64
			if err := db.Model(&directLinkRecord{}).Where("owner_id = ?", owner).Count(&count).Error; err != nil {
				return err
			}
			for _, candidate := range proposed {
				if candidate.OwnerID != owner {
					return model.ErrInvalid
				}
				result, created, err := issueDirectLink(db, owner, entries, candidate, count)
				if err != nil {
					return err
				}
				if created {
					count++
				}
				results = append(results, result)
			}
			return nil
		})
	})
	if err != nil {
		return nil, err
	}
	return results, nil
}

func issueDirectLink(db *gorm.DB, owner string, entries []model.Entry, candidate model.DirectLink, count int64) (service.DirectLinkResult, bool, error) {
	result := service.DirectLinkResult{EntryID: candidate.EntryID}
	entry, exists := model.Find(entries, candidate.EntryID)
	if !exists || entry.Kind != model.File || !model.Visible(entries, entry) {
		result.Failure = service.DirectLinkUnavailable
		return result, false, nil
	}
	var record directLinkRecord
	read := db.Where("owner_id = ? AND entry_id = ?", owner, entry.ID).Limit(1).Find(&record)
	if read.Error != nil {
		return result, false, read.Error
	}
	created := read.RowsAffected == 0
	if created {
		if count >= service.DirectLinkOwnerLimit {
			result.Failure = service.DirectLinkLimit
			return result, false, nil
		}
		record = directLinkRecord{ID: candidate.ID, OwnerID: owner, EntryID: entry.ID, Token: candidate.Token, TokenDigest: candidate.TokenDigest, CreatedAt: candidate.CreatedAt}
		if err := db.Create(&record).Error; err != nil {
			return result, false, err
		}
	}
	link := record.model()
	link.Name, link.Active = entry.Name, true
	result.Link = &link
	return result, created, nil
}

func (r *Repository) ListDirectLinks(ctx context.Context, owner string, page, treeLimit int) (service.DirectLinkPage, error) {
	result := service.DirectLinkPage{Items: []model.DirectLink{}, Page: page, PageSize: service.DirectLinkPageSize}
	err := r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			if err := r.checkStorage(db); err != nil {
				return err
			}
			query := db.Model(&directLinkRecord{}).Where("owner_id = ?", owner)
			var total int64
			if err := query.Count(&total).Error; err != nil {
				return err
			}
			result.Total = int(total)
			if total == 0 {
				return nil
			}
			var records []directLinkRecord
			if err := query.Order("created_at DESC, id DESC").Offset((page - 1) * result.PageSize).Limit(result.PageSize).Find(&records).Error; err != nil {
				return err
			}
			entries, err := loadBoundedEntries(db, owner, treeLimit)
			if err != nil {
				return err
			}
			for _, record := range records {
				link := record.model()
				if entry, exists := model.Find(entries, record.EntryID); exists {
					link.Name, link.Active = entry.Name, model.Visible(entries, entry)
				}
				result.Items = append(result.Items, link)
			}
			return nil
		})
	})
	return result, err
}

func (r *Repository) RevokeDirectLink(ctx context.Context, owner, id string) error {
	return r.access.WithinTx(ctx, func(ctx context.Context, _ database.Client, tx database.Tx) error {
		return database.UseGORMTx(ctx, tx, func(db *gorm.DB) error {
			if err := r.lockOwner(db, owner); err != nil {
				return err
			}
			removed := db.Where("owner_id = ? AND id = ?", owner, id).Delete(&directLinkRecord{})
			if removed.Error != nil {
				return removed.Error
			}
			if removed.RowsAffected != 1 {
				return model.ErrMissing
			}
			return nil
		})
	})
}

func (r *Repository) ReadDirectLinkTarget(ctx context.Context, digest string) (model.DirectLink, error) {
	var record directLinkRecord
	err := r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			if err := r.checkStorage(db); err != nil {
				return err
			}
			result := db.Select("id", "owner_id", "entry_id").Where("token_digest = ?", digest).Limit(1).Find(&record)
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected != 1 {
				return model.ErrMissing
			}
			return nil
		})
	})
	return record.model(), err
}
