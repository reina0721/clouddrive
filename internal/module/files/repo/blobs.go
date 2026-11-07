package repo

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/database"
	"gorm.io/gorm"
)

const blobStatistics = `SELECT object_key, MIN(size_bytes) AS size_bytes, MAX(size_bytes) AS max_size_bytes,
	COUNT(*) AS reference_count, SUM(is_current) AS current_count,
	COUNT(DISTINCT owner_id) AS owner_count, MIN(file_created) AS first_file_created
	FROM blob_refs GROUP BY object_key`

type blobStatisticsRecord struct {
	ObjectKey        string
	SizeBytes        int64
	MaxSizeBytes     int64
	ReferenceCount   int64
	CurrentCount     int64
	OwnerCount       int64
	FirstFileCreated string
}

type blobListRow struct {
	Total      int64
	Statistics blobStatisticsRecord `gorm:"embedded"`
}

type blobDetailRow struct {
	Statistics blobStatisticsRecord `gorm:"embedded"`
	FileID     string
	OwnerID    string
	Name       string
	Revision   int64
	IsCurrent  int
	IsTrashed  int
}

func (record blobStatisticsRecord) item() (service.BlobItem, error) {
	id, err := service.PublishedBlobID(record.ObjectKey)
	if err != nil || record.SizeBytes < 0 || record.SizeBytes != record.MaxSizeBytes ||
		record.ReferenceCount < 1 || record.CurrentCount < 0 || record.CurrentCount > record.ReferenceCount ||
		record.OwnerCount < 1 || record.OwnerCount > record.ReferenceCount {
		return service.BlobItem{}, fmt.Errorf("published blob reference invariant")
	}
	created, err := blobCreatedTime(record.FirstFileCreated)
	if err != nil {
		return service.BlobItem{}, err
	}
	return service.BlobItem{
		ID: id, Storage: service.BlobPrimaryStorage, SizeBytes: record.SizeBytes, ReferenceCount: record.ReferenceCount,
		CurrentCount: record.CurrentCount, HistoryCount: record.ReferenceCount - record.CurrentCount,
		OwnerCount: record.OwnerCount, FirstFileCreated: created,
	}, nil
}

// blobCreatedTime 兼容 SQLite 聚合后返回的 TIMESTAMP 文本和服务器驱动返回的 RFC3339。
func blobCreatedTime(value string) (time.Time, error) {
	for _, layout := range []string{
		time.RFC3339Nano,
		"2006-01-02 15:04:05.999999999-07:00",
		"2006-01-02 15:04:05.999999999 -0700 MST",
		"2006-01-02 15:04:05.999999999",
	} {
		created, err := time.Parse(layout, value)
		if err == nil {
			return created.UTC(), nil
		}
	}
	return time.Time{}, fmt.Errorf("invalid blob reference timestamp")
}

// blobReferenceCTE 把历史 JSON 转成关系行，仅持久化在源文件记录中的关联参与统计。
func blobReferenceCTE(driver, key string) (string, []any, error) {
	var historyJoin, historyKey, historySize, historyRevision string
	switch driver {
	case "sqlite":
		historyJoin = "CROSS JOIN json_each(f.history_json) AS h"
		historyKey = "json_extract(h.value, '$.objectKey')"
		historySize = "json_extract(h.value, '$.sizeBytes')"
		historyRevision = "json_extract(h.value, '$.revision')"
	case "postgres":
		historyJoin = `CROSS JOIN LATERAL jsonb_to_recordset(CAST(f.history_json AS jsonb)) AS h("objectKey" text, "sizeBytes" bigint, revision bigint)`
		historyKey, historySize, historyRevision = `h."objectKey"`, `h."sizeBytes"`, "h.revision"
	case "mysql":
		historyJoin = `JOIN JSON_TABLE(f.history_json, '$[*]' COLUMNS (
			object_key VARCHAR(128) PATH '$.objectKey' ERROR ON EMPTY ERROR ON ERROR,
			size_bytes BIGINT PATH '$.sizeBytes' ERROR ON EMPTY ERROR ON ERROR,
			revision BIGINT PATH '$.revision' ERROR ON EMPTY ERROR ON ERROR)) AS h ON TRUE`
		historyKey, historySize, historyRevision = "h.object_key", "h.size_bytes", "h.revision"
	default:
		return "", nil, fmt.Errorf("unsupported blob catalog database dialect")
	}
	currentFilter, historyFilter := "f.kind = ? AND f.object_key <> ''", "f.kind = ? AND "+historyKey+" <> ''"
	args := []any{model.File, model.File}
	if key != "" {
		currentFilter += " AND f.object_key = ?"
		historyFilter += " AND " + historyKey + " = ?"
		args = []any{model.File, key, model.File, key}
	}
	const entryColumns = "f.id AS file_id, f.owner_id, f.name, f.created_at AS file_created, CASE WHEN f.trashed_at IS NULL THEN 0 ELSE 1 END AS is_trashed"
	cte := "WITH blob_refs AS (SELECT f.object_key, f.size_bytes, f.content_revision AS revision, 1 AS is_current, " + entryColumns +
		" FROM files_entries AS f WHERE " + currentFilter + " UNION ALL SELECT " + historyKey + ", " + historySize + ", " + historyRevision +
		", 0, " + entryColumns + " FROM files_entries AS f " + historyJoin + " WHERE " + historyFilter + ")"
	return cte, args, nil
}

func blobOrdering(query service.BlobQuery) (string, error) {
	var column string
	switch query.Sort {
	case service.BlobByID:
		column = "object_key"
	case service.BlobBySize:
		column = "size_bytes"
	case service.BlobByReferences:
		column = "reference_count"
	case service.BlobByFirstFile:
		column = "first_file_created"
	default:
		return "", model.ErrInvalid
	}
	if query.Direction == service.InventoryDescending {
		column += " DESC"
	} else {
		column += " ASC"
	}
	if query.Sort != service.BlobByID {
		column += ", object_key ASC"
	}
	return column, nil
}

func (r *Repository) QueryBlobs(ctx context.Context, query service.BlobQuery) (service.BlobPage, error) {
	result := service.BlobPage{Items: []service.BlobItem{}, Page: query.Page, PageSize: service.InventoryPageSize}
	ordering, err := blobOrdering(query)
	if err != nil {
		return service.BlobPage{}, err
	}
	err = r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			if err := r.checkStorage(db); err != nil {
				return err
			}
			cte, args, err := blobReferenceCTE(db.Dialector.Name(), "")
			if err != nil {
				return err
			}
			var filters []string
			if query.OwnerID != "" {
				filters = append(filters, "SUM(CASE WHEN owner_id = ? THEN 1 ELSE 0 END) > 0")
				args = append(args, query.OwnerID)
			}
			switch query.Reference {
			case service.BlobCurrent:
				filters = append(filters, "SUM(is_current) > 0")
			case service.BlobHistorical:
				filters = append(filters, "SUM(is_current) < COUNT(*)")
			case service.BlobHistoricalOnly:
				filters = append(filters, "SUM(is_current) = 0")
			}
			grouped := blobStatistics
			if len(filters) != 0 {
				grouped += " HAVING " + strings.Join(filters, " AND ")
			}
			statement := cte + ", grouped_blobs AS (" + grouped + "), page_blobs AS (SELECT * FROM grouped_blobs ORDER BY " + ordering +
				" LIMIT ? OFFSET ?) SELECT totals.total, page_blobs.* FROM (SELECT COUNT(*) AS total FROM grouped_blobs) AS totals " +
				"LEFT JOIN page_blobs ON 1=1 ORDER BY " + ordering
			args = append(args, result.PageSize, (result.Page-1)*result.PageSize)
			var rows []blobListRow
			if err := db.Raw(statement, args...).Scan(&rows).Error; err != nil {
				return err
			}
			for _, row := range rows {
				result.Total = row.Total
				if row.Statistics.ObjectKey == "" {
					continue
				}
				item, err := row.Statistics.item()
				if err != nil {
					return err
				}
				result.Items = append(result.Items, item)
			}
			return nil
		})
	})
	if err != nil {
		return service.BlobPage{}, err
	}
	return result, nil
}

func (r *Repository) ReadBlob(ctx context.Context, key string, page int) (service.BlobDetail, error) {
	result := service.BlobDetail{References: []service.BlobReference{}, Page: page, PageSize: service.InventoryPageSize}
	err := r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			if err := r.checkStorage(db); err != nil {
				return err
			}
			cte, args, err := blobReferenceCTE(db.Dialector.Name(), key)
			if err != nil {
				return err
			}
			const sort = "file_id ASC, is_current DESC, revision DESC"
			statement := cte + ", stats AS (" + blobStatistics + "), page_refs AS (" +
				"SELECT file_id, owner_id, name, revision, is_current, is_trashed FROM blob_refs ORDER BY " + sort +
				" LIMIT ? OFFSET ?) SELECT stats.*, page_refs.* FROM stats LEFT JOIN page_refs ON 1=1 ORDER BY " + sort
			args = append(args, result.PageSize, (result.Page-1)*result.PageSize)
			var rows []blobDetailRow
			if err := db.Raw(statement, args...).Scan(&rows).Error; err != nil {
				return err
			}
			if len(rows) == 0 {
				return model.ErrMissing
			}
			result.Blob, err = rows[0].Statistics.item()
			if err != nil {
				return err
			}
			for _, row := range rows {
				if row.FileID == "" {
					continue
				}
				result.References = append(result.References, service.BlobReference{
					FileID: row.FileID, OwnerID: row.OwnerID, Name: row.Name, Revision: row.Revision,
					Current: row.IsCurrent != 0, Trashed: row.IsTrashed != 0,
				})
			}
			return nil
		})
	})
	if err != nil {
		return service.BlobDetail{}, err
	}
	return result, nil
}
