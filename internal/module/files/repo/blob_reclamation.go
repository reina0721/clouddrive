package repo

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/database"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type blobCandidateRecord struct {
	ObjectKey  string `gorm:"primaryKey"`
	SizeBytes  int64
	DetachedAt time.Time
	ReadyAt    time.Time
	RetryAt    time.Time
}

func (blobCandidateRecord) TableName() string { return "files_blob_candidates" }

func fileContentSizes(entry model.Entry) map[string]int64 {
	sizes := make(map[string]int64, len(entry.History)+1)
	if entry.Kind == model.File {
		sizes[entry.ObjectKey] = entry.SizeBytes
		for _, version := range entry.History {
			sizes[version.ObjectKey] = version.SizeBytes
		}
	}
	return sizes
}

// detachedBlobRecords 接收已通过文件仓储校验的数据，只允许项目自己的发布对象进入队列。
func detachedBlobRecords(previous, next model.Entry, now time.Time) []blobCandidateRecord {
	if previous.Kind != model.File || previous.ObjectKey == next.ObjectKey && previous.HistoryRevision == next.HistoryRevision {
		return nil
	}
	remaining := fileContentSizes(next)
	var candidates []blobCandidateRecord
	ready := now.Add(service.BlobReclamationGrace)
	for key, size := range fileContentSizes(previous) {
		if _, referenced := remaining[key]; referenced {
			continue
		}
		if _, err := service.PublishedBlobID(key); err != nil {
			continue
		}
		candidates = append(candidates, blobCandidateRecord{ObjectKey: key, SizeBytes: size, DetachedAt: now, ReadyAt: ready, RetryAt: ready})
	}
	return candidates
}

func queueDetachedBlobs(db *gorm.DB, candidates []blobCandidateRecord) error {
	unique := make(map[string]blobCandidateRecord, len(candidates))
	for _, candidate := range candidates {
		unique[candidate.ObjectKey] = candidate
	}
	if len(unique) == 0 {
		return nil
	}
	records := make([]blobCandidateRecord, 0, len(unique))
	for _, record := range unique {
		records = append(records, record)
	}
	for batch := range slices.Chunk(records, 100) {
		err := db.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "object_key"}},
			DoUpdates: clause.AssignmentColumns([]string{"size_bytes", "detached_at", "ready_at", "retry_at"})}).Create(&batch).Error
		if err != nil {
			return err
		}
	}
	return nil
}

const liveBlobTransfer = "(state NOT IN ? OR cleanup_pending = ?)"
const unreferencedBlobCandidates = " FROM files_blob_candidates AS candidate" +
	" WHERE NOT EXISTS (SELECT 1 FROM blob_refs AS ref WHERE ref.object_key = candidate.object_key)" +
	" AND NOT EXISTS (SELECT 1 FROM files_transfers WHERE object_key = candidate.object_key AND " + liveBlobTransfer + ")"

func liveBlobTransferArguments() []any {
	return []any{[]model.TransferState{model.TransferCompleted, model.TransferCanceled, model.TransferExpired}, true}
}

func (r *Repository) BlobCandidates(ctx context.Context, now time.Time, page int) (service.BlobCandidatePage, error) {
	result := service.BlobCandidatePage{Items: []service.BlobCandidate{}, Page: page, PageSize: service.InventoryPageSize}
	err := r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			if err := r.checkStorage(db); err != nil {
				return err
			}
			cte, args, err := blobReferenceCTE(db.Dialector.Name(), "")
			if err != nil {
				return err
			}
			var rows []struct {
				Total      int64
				ObjectKey  *string
				SizeBytes  *int64
				DetachedAt *time.Time
				ReadyAt    *time.Time
			}
			statement := cte + ", candidates AS (SELECT candidate.*" + unreferencedBlobCandidates + ")" +
				", candidates_page AS (SELECT * FROM candidates ORDER BY ready_at, object_key LIMIT ? OFFSET ?) " +
				"SELECT total.total, p.object_key, p.size_bytes, p.detached_at, p.ready_at FROM (SELECT COUNT(*) AS total FROM candidates) AS total " +
				"LEFT JOIN candidates_page AS p ON 1 = 1 ORDER BY p.ready_at, p.object_key"
			args = append(args, liveBlobTransferArguments()...)
			if err := db.Raw(statement, append(args, result.PageSize, (page-1)*result.PageSize)...).Scan(&rows).Error; err != nil {
				return err
			}
			for _, row := range rows {
				result.Total = row.Total
				if row.ObjectKey == nil {
					continue
				}
				id, err := service.PublishedBlobID(*row.ObjectKey)
				if err != nil || row.SizeBytes == nil || *row.SizeBytes < 0 || row.DetachedAt == nil || row.ReadyAt == nil {
					return fmt.Errorf("blob candidate invariant")
				}
				result.Items = append(result.Items, service.BlobCandidate{ID: id, SizeBytes: *row.SizeBytes, DetachedAt: row.DetachedAt.UTC(),
					ReadyAt: row.ReadyAt.UTC(), Ready: !row.ReadyAt.After(now)})
			}
			return nil
		})
	})
	return result, err
}

func (r *Repository) DueBlobCandidates(ctx context.Context, now time.Time, limit int) ([]string, error) {
	var keys []string
	err := r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			if err := r.checkStorage(db); err != nil {
				return err
			}
			cte, args, err := blobReferenceCTE(db.Dialector.Name(), "")
			if err != nil {
				return err
			}
			statement := cte + " SELECT candidate.object_key" + unreferencedBlobCandidates +
				" AND candidate.ready_at <= ? AND candidate.retry_at <= ? ORDER BY candidate.retry_at, candidate.object_key LIMIT ?"
			args = append(args, liveBlobTransferArguments()...)
			return db.Raw(statement, append(args, now, now, limit)...).Scan(&keys).Error
		})
	})
	return keys, err
}

// ReclaimBlob 在与发布相同的存储锁内校验所有引用，并以单个有界删除结束候选。
// 存储已删除但提交失败时，候选仍在。下一次可重试幂等删除。
func (r *Repository) ReclaimBlob(ctx context.Context, key string, now time.Time, mode service.BlobReclamationMode, remove func(context.Context, string) error) error {
	if _, err := service.PublishedBlobID(key); err != nil {
		return err
	}
	return r.access.WithinTx(ctx, func(ctx context.Context, _ database.Client, tx database.Tx) error {
		return database.UseGORMTx(ctx, tx, func(db *gorm.DB) error {
			if err := r.lockStorage(db); err != nil {
				return err
			}
			var candidate blobCandidateRecord
			if err := db.First(&candidate, "object_key = ?", key).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return errors.Join(model.ErrMissing, err)
				}
				return err
			}
			if candidate.ReadyAt.After(now) || mode == service.BlobReclamationScheduled && candidate.RetryAt.After(now) {
				return model.ErrConflict
			}
			cte, args, err := blobReferenceCTE(db.Dialector.Name(), key)
			if err != nil {
				return err
			}
			var refs int64
			if err := db.Raw(cte+" SELECT COUNT(*) FROM blob_refs", args...).Scan(&refs).Error; err != nil {
				return err
			}
			var transfers int64
			if err := db.Model(&transferRecord{}).Where("object_key = ? AND "+liveBlobTransfer,
				append([]any{key}, liveBlobTransferArguments()...)...).Count(&transfers).Error; err != nil {
				return err
			}
			if refs != 0 || transfers != 0 {
				return model.ErrConflict
			}
			if err := remove(ctx, key); err != nil {
				return fmt.Errorf("reclaim published blob: %w", err)
			}
			return db.Delete(&candidate).Error
		})
	})
}

func (r *Repository) DeferBlobReclamation(ctx context.Context, key string, now, retry time.Time) error {
	return r.access.WithinTx(ctx, func(ctx context.Context, _ database.Client, tx database.Tx) error {
		return database.UseGORMTx(ctx, tx, func(db *gorm.DB) error {
			if err := r.lockStorage(db); err != nil {
				return err
			}
			return db.Model(&blobCandidateRecord{}).Where("object_key = ? AND retry_at <= ?", key, now).
				UpdateColumn("retry_at", retry.Truncate(time.Second)).Error
		})
	})
}
