package repo

import (
	"context"
	"fmt"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/database"
	"gorm.io/gorm"
)

// 列表只投影持久可显示字段；下载详情仍由下载仓储校验存储、子项和发布结果。
const backgroundTaskProjection = `
SELECT id, kind, source_name, state, failure_code, created_at, updated_at,
       NULL AS declared_bytes, 0 AS received_bytes, 0 AS rate_bytes_per_second, 0 AS source_status,
       destination_id, result_entry_id, created_count, skipped_count, renamed_count,
       CASE WHEN state = ? AND candidates <> '' THEN 1 ELSE 0 END AS cleanup_pending
FROM files_archive_tasks
WHERE owner_id = ?
UNION ALL
SELECT d.id, d.kind,
       CASE WHEN d.kind = ? THEN COALESCE(NULLIF(tr.name, ''), '')
            ELSE COALESCE(NULLIF(d.requested_name, ''), NULLIF(bt.name, ''), ?) END,
       d.state, d.failure_code, d.created_at, d.updated_at,
       d.declared_bytes, d.received_bytes, d.rate_bytes_per_second, d.source_status,
       '', '', 0, 0, 0, 0
FROM files_download_tasks d
LEFT JOIN files_transfers tr ON d.kind = ? AND tr.owner_id = d.owner_id AND tr.download_id = d.id AND tr.source = ?
LEFT JOIN files_torrent_tasks bt ON d.kind = ? AND bt.owner_id = d.owner_id AND bt.task_id = d.id
WHERE d.owner_id = ?
LIMIT ?`

func (r *Repository) ListBackgroundTasks(ctx context.Context, owner string) ([]service.BackgroundTask, error) {
	result := []service.BackgroundTask{}
	err := r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			if err := r.checkStorage(db); err != nil {
				return err
			}
			return db.Raw(backgroundTaskProjection,
				service.ArchiveTaskFailed, owner, model.DownloadHTTP, "BitTorrent",
				model.DownloadHTTP, model.TransferSourceOffline, model.DownloadBitTorrent, owner,
				service.BackgroundTaskMaxRecords+1,
			).Scan(&result).Error
		})
	})
	if err != nil {
		return nil, err
	}
	for _, task := range result {
		if task.SourceName == "" {
			return nil, fmt.Errorf("background task display name invariant")
		}
	}
	return result, nil
}
