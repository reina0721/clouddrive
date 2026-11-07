package repo

import (
	"context"
	"errors"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/database"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const adminShareProjection = "sharing.id, sharing.owner_id, sharing.root_id, sharing.title, sharing.state, sharing.revision, " +
	"sharing.created_at, sharing.expires_at, sharing.revoked_at, sharing.view_count AS views, sharing.download_count AS downloads, " +
	"CASE WHEN sharing.password_hash <> '' THEN 1 ELSE 0 END AS protected, source.name AS root_name"

type adminShareRecord struct {
	service.AdminShareItem `gorm:"embedded"`
	State                  model.ShareState
	Protected              int
}

func (record adminShareRecord) item(now time.Time) service.AdminShareItem {
	value := record.AdminShareItem
	value.Status = service.SharePolicyStatus(record.State, value.ExpiresAt, value.RevokedAt, now)
	value.HasPassword = record.Protected != 0
	return value
}

func adminShareTable(db *gorm.DB) *gorm.DB {
	return db.Table("files_shares AS sharing").Joins("LEFT JOIN files_entries AS source ON source.id = sharing.root_id AND source.owner_id = sharing.owner_id")
}

func adminShareOrder(query service.AdminShareQuery) (clause.OrderByColumn, error) {
	var column string
	switch query.Sort {
	case service.AdminShareByID:
		column = "id"
	case service.AdminShareByCreated:
		column = "created_at"
	case service.AdminShareByViews:
		column = "view_count"
	case service.AdminShareByDownloads:
		column = "download_count"
	default:
		return clause.OrderByColumn{}, model.ErrInvalid
	}
	return clause.OrderByColumn{Column: clause.Column{Table: "sharing", Name: column}, Desc: query.Direction == service.InventoryDescending}, nil
}

func (r *Repository) QueryAdminShares(ctx context.Context, query service.AdminShareQuery, now time.Time) (service.AdminSharePage, error) {
	value := service.AdminSharePage{Items: []service.AdminShareItem{}, Page: query.Page, PageSize: service.AdminSharePageSize}
	order, err := adminShareOrder(query)
	if err != nil {
		return value, err
	}
	err = r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			if err := r.checkStorage(db); err != nil {
				return err
			}
			base := adminShareTable(db)
			if query.OwnerID != "" {
				base = base.Where("sharing.owner_id = ?", query.OwnerID)
			}
			if query.RootID != "" {
				base = base.Where("sharing.root_id = ?", query.RootID)
			}
			switch query.Status {
			case service.ShareRevoked:
				base = base.Where("sharing.revoked_at IS NOT NULL")
			case service.ShareExpired:
				base = base.Where("sharing.revoked_at IS NULL AND sharing.expires_at <= ?", now)
			case service.SharePaused, service.ShareActive:
				base = base.Where("sharing.revoked_at IS NULL AND sharing.expires_at > ? AND sharing.state = ?", now, query.Status)
			}
			if err := base.Session(&gorm.Session{}).Count(&value.Total).Error; err != nil {
				return err
			}
			var records []adminShareRecord
			page := base.Select(adminShareProjection).Order(order)
			if query.Sort != service.AdminShareByID {
				page = page.Order("sharing.id ASC")
			}
			if err := page.Offset((query.Page - 1) * value.PageSize).Limit(value.PageSize).Find(&records).Error; err != nil {
				return err
			}
			for _, record := range records {
				value.Items = append(value.Items, record.item(now))
			}
			return nil
		})
	})
	return value, err
}

func (r *Repository) ReadAdminShare(ctx context.Context, id string, now time.Time) (service.AdminShareItem, error) {
	var value service.AdminShareItem
	err := r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			if err := r.checkStorage(db); err != nil {
				return err
			}
			var record adminShareRecord
			if err := adminShareTable(db).Select(adminShareProjection).Where("sharing.id = ?", id).Take(&record).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return errors.Join(model.ErrMissing, err)
				}
				return err
			}
			value = record.item(now)
			return nil
		})
	})
	return value, err
}

func (r *Repository) RevokeAdminShares(ctx context.Context, targets []service.AdminShareTarget, now time.Time) (int, error) {
	versions := make(map[string]int64, len(targets))
	ids := make([]string, 0, len(targets))
	for _, target := range targets {
		versions[target.ID] = target.Revision
		ids = append(ids, target.ID)
	}
	var affected int
	err := r.access.WithinTx(ctx, func(ctx context.Context, _ database.Client, tx database.Tx) error {
		return database.UseGORMTx(ctx, tx, func(db *gorm.DB) error {
			// 与分享创建、个人策略写入共用存储锁，校验完成后只更新仍未撤销的目标。
			if err := r.lockStorage(db); err != nil {
				return err
			}
			var rows []shareRecord
			if err := db.Select("id", "revision", "revoked_at").Where("id IN ?", ids).Find(&rows).Error; err != nil {
				return err
			}
			if len(rows) != len(ids) {
				return model.ErrMissing
			}
			pending := make([]string, 0, len(rows))
			for _, row := range rows {
				if row.Revision != versions[row.ID] || (row.RevokedAt == nil && row.Revision >= model.MaxContentRevision) {
					return model.ErrConflict
				}
				if row.RevokedAt == nil {
					pending = append(pending, row.ID)
				}
			}
			if len(pending) == 0 {
				return nil
			}
			result := db.Model(&shareRecord{}).Where("id IN ? AND revoked_at IS NULL", pending).
				Updates(map[string]any{"revoked_at": now, "revision": gorm.Expr("revision + 1")})
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected != int64(len(pending)) {
				return model.ErrConflict
			}
			affected = len(pending)
			return nil
		})
	})
	if err != nil {
		return 0, err
	}
	return affected, nil
}

// RecordShareView 只累计仍匹配已校验修订的请求，不阻碍并发撤销或增加策略修订。
func (r *Repository) RecordShareView(ctx context.Context, id string, revision int64, now time.Time) error {
	return r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			return db.Model(&shareRecord{}).Where("id = ? AND revision = ? AND revoked_at IS NULL AND state = ? AND expires_at > ? AND view_count < ?", id, revision, model.ShareEnabled, now, service.MaxShareActivity).
				UpdateColumn("view_count", gorm.Expr("view_count + 1")).Error
		})
	})
}
