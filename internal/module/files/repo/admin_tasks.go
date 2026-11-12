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

// 管理投影不读取请求体、下载地址、节点凭据或文件存储位置。
const adminTaskProjection = `
SELECT id, '' AS owner_id, kind,
       CASE WHEN kind = ? THEN 'Blob reclamation' ELSE 'Trash expiry' END AS name,
       state, failure_code, '' AS node_id, created_at, updated_at, NULL AS lease_until,
       0 AS revision, 0 AS cleanup_pending, duration_ms
FROM files_maintenance_runs
UNION ALL
SELECT id, owner_id, kind, source_name AS name, state, failure_code,
       '' AS node_id, created_at, updated_at, lease_until, 0 AS revision,
       CASE WHEN candidates <> '' THEN 1 ELSE 0 END AS cleanup_pending, NULL
FROM files_archive_tasks
UNION ALL
SELECT d.id, d.owner_id, d.kind,
       CASE WHEN d.kind = ? THEN COALESCE(NULLIF(tr.name, ''), NULLIF(d.requested_name, ''), 'HTTP')
            ELSE COALESCE(NULLIF(d.requested_name, ''), NULLIF(bt.name, ''), 'BitTorrent') END,
       d.state, d.failure_code, COALESCE(bt.node_id, ''), d.created_at, d.updated_at, d.lease_until,
       d.revision, 0, NULL
FROM files_download_tasks d
LEFT JOIN files_transfers tr ON d.kind = ? AND tr.owner_id = d.owner_id AND tr.download_id = d.id AND tr.source = ?
LEFT JOIN files_torrent_tasks bt ON d.kind = ? AND bt.owner_id = d.owner_id AND bt.task_id = d.id`

type adminTaskRecord struct {
	service.AdminTask `gorm:"embedded"`
	LeaseUntil        *time.Time
	CleanupPending    bool
}

func (row adminTaskRecord) item(now time.Time) service.AdminTask {
	item := row.AdminTask
	item.Cleanable = model.DownloadState(row.State).Finished() && !row.CleanupPending && (row.LeaseUntil == nil || !row.LeaseUntil.After(now))
	return item
}

func adminTaskTable(db *gorm.DB) *gorm.DB {
	return db.Table("(?) AS task", db.Raw(adminTaskProjection, service.MaintenanceBlobReclaim,
		model.DownloadHTTP, model.DownloadHTTP, model.TransferSourceOffline, model.DownloadBitTorrent))
}

func adminTerminalTaskStates() []model.DownloadState {
	return []model.DownloadState{model.DownloadCompleted, model.DownloadFailed, model.DownloadCanceled, model.DownloadExpired}
}

func filterAdminTaskScope(base *gorm.DB, query service.AdminTaskSummaryQuery) *gorm.DB {
	switch query.Origin {
	case service.AdminTaskOriginUser:
		base = base.Where("task.owner_id <> ''")
	case service.AdminTaskOriginSystem:
		base = base.Where("task.owner_id = ''")
	}
	if query.OwnerID != "" {
		base = base.Where("task.owner_id = ?", query.OwnerID)
	}
	if query.TaskID != "" {
		base = base.Where("task.id = ?", query.TaskID)
	}
	if query.NodeID != "" {
		base = base.Where("task.node_id = ?", query.NodeID)
	}
	if query.Kind != service.BackgroundTaskAny {
		base = base.Where("task.kind = ?", query.Kind)
	}
	return base
}

func (r *Repository) QueryAdminTasks(ctx context.Context, query service.AdminTaskQuery, now time.Time) (service.AdminTaskPage, error) {
	page := service.AdminTaskPage{Items: []service.AdminTask{}, Page: query.Page, PageSize: service.AdminTaskPageSize}
	err := r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			if err := r.checkStorage(db); err != nil {
				return err
			}
			base := filterAdminTaskScope(adminTaskTable(db), service.AdminTaskSummaryQuery{
				OwnerID: query.OwnerID, TaskID: query.TaskID, NodeID: query.NodeID, Kind: query.Kind, Origin: query.Origin,
			})
			switch query.Status {
			case service.BackgroundStatusAll:
			case service.BackgroundStatusActive:
				base = base.Where("task.state NOT IN ?", adminTerminalTaskStates())
			default:
				base = base.Where("task.state = ?", query.Status)
			}
			if !query.CleanupBefore.IsZero() {
				base = base.Where("task.created_at < ? AND task.state IN ? AND task.cleanup_pending = 0 AND (task.lease_until IS NULL OR task.lease_until <= ?)", query.CleanupBefore.UTC(), adminTerminalTaskStates(), now)
			}
			if err := base.Session(&gorm.Session{}).Count(&page.Total).Error; err != nil {
				return err
			}
			column := "created_at"
			if query.Sort == service.AdminTaskByID {
				column = "id"
			}
			order := clause.OrderByColumn{Column: clause.Column{Table: "task", Name: column}, Desc: query.Direction == service.InventoryDescending}
			var records []adminTaskRecord
			if err := base.Order(order).Order("task.kind ASC, task.id ASC").Offset((query.Page - 1) * page.PageSize).Limit(page.PageSize).Find(&records).Error; err != nil {
				return err
			}
			for _, record := range records {
				page.Items = append(page.Items, record.item(now))
			}
			return nil
		})
	})
	return page, err
}

func (r *Repository) SummarizeAdminTasks(ctx context.Context, query service.AdminTaskSummaryQuery, now time.Time) (service.AdminTaskSummary, error) {
	summary := service.AdminTaskSummary{}
	err := r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			if err := r.checkStorage(db); err != nil {
				return err
			}
			base := filterAdminTaskScope(adminTaskTable(db), query)
			return base.Select(`COUNT(*) AS total,
				COALESCE(SUM(CASE WHEN task.state NOT IN ? THEN 1 ELSE 0 END), 0) AS active,
				COALESCE(SUM(CASE WHEN task.state = ? THEN 1 ELSE 0 END), 0) AS completed,
				COALESCE(SUM(CASE WHEN task.state = ? THEN 1 ELSE 0 END), 0) AS failed,
				COALESCE(SUM(CASE WHEN task.state = ? THEN 1 ELSE 0 END), 0) AS canceled,
				COALESCE(SUM(CASE WHEN task.state = ? THEN 1 ELSE 0 END), 0) AS expired,
				COALESCE(SUM(CASE WHEN task.state IN ? AND task.cleanup_pending = 0 AND (task.lease_until IS NULL OR task.lease_until <= ?) THEN 1 ELSE 0 END), 0) AS cleanable`,
				adminTerminalTaskStates(), model.DownloadCompleted, model.DownloadFailed, model.DownloadCanceled, model.DownloadExpired,
				adminTerminalTaskStates(), now).Scan(&summary).Error
		})
	})
	summary.AsOf = now
	return summary, err
}

func (r *Repository) ReadAdminTask(ctx context.Context, kind service.BackgroundTaskKind, id string, now time.Time) (service.AdminTask, error) {
	var record adminTaskRecord
	err := r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			if err := r.checkStorage(db); err != nil {
				return err
			}
			if err := adminTaskTable(db).Where("task.kind = ? AND task.id = ?", kind, id).Take(&record).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return errors.Join(model.ErrMissing, err)
				}
				return err
			}
			return nil
		})
	})
	return record.item(now), err
}
