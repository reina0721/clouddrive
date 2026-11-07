package repo

import (
	"context"
	"fmt"

	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/database"
	"gorm.io/gorm"
)

const storagePolicyID = "storage-policy"

func (r *Repository) ReadStoragePolicy(ctx context.Context) (service.StoredStoragePolicy, error) {
	revision, overrides, err := readFileSettings[service.StorageLimitOverrides](ctx, r, storagePolicyID)
	output := service.StoredStoragePolicy{Revision: revision, Overrides: overrides}
	if err == nil && revision != 0 {
		err = output.ValidateStored()
	}
	return output, err
}

func (r *Repository) SaveStoragePolicy(ctx context.Context, value service.StoredStoragePolicy) (service.StoredStoragePolicy, error) {
	expected := value.Revision
	value.Revision++
	if err := value.ValidateStored(); err != nil {
		return service.StoredStoragePolicy{}, err
	}
	return value, r.saveFileSettings(ctx, storagePolicyID, expected, value.Revision, value.Overrides)
}

func (r *Repository) ReadStorageUsage(ctx context.Context) (service.StorageUsage, error) {
	var row struct {
		service.StorageUsage `gorm:"embedded"`
		InvalidSizes         int64
	}
	err := r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			if err := r.checkStorage(db); err != nil {
				return err
			}
			cte, args, err := blobReferenceCTE(db.Dialector.Name(), "")
			if err != nil {
				return err
			}
			query := cte + ", grouped_blobs AS (" + blobStatistics + `)
SELECT COUNT(*) AS blob_count, COALESCE(SUM(size_bytes), 0) AS blob_bytes,
       COALESCE(SUM(current_count), 0) AS current_references,
       COALESCE(SUM(reference_count - current_count), 0) AS history_references,
       COALESCE(SUM(CASE WHEN size_bytes < 0 OR size_bytes <> max_size_bytes THEN 1 ELSE 0 END), 0) AS invalid_sizes,
       (SELECT COUNT(*) FROM files_blob_candidates) AS pending_count,
       (SELECT COALESCE(SUM(size_bytes), 0) FROM files_blob_candidates) AS pending_bytes
FROM grouped_blobs`
			if err := db.Raw(query, args...).Scan(&row).Error; err != nil {
				return err
			}
			if row.InvalidSizes > 0 || row.PendingBytes < 0 {
				return fmt.Errorf("published blob size invariant")
			}
			return nil
		})
	})
	return row.StorageUsage, err
}
