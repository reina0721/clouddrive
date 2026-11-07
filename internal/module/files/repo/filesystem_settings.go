package repo

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"strings"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/database"
	"gorm.io/gorm"
)

const filesystemSettingsID = "filesystem"

type filesystemSettingsRecord struct {
	ID            string `gorm:"primaryKey"`
	Revision      int64
	OverridesJSON string
}

func (filesystemSettingsRecord) TableName() string { return "files_filesystem_settings" }

func (r *Repository) ReadFilesystemSettings(ctx context.Context) (service.StoredFilesystemSettings, error) {
	var output service.StoredFilesystemSettings
	err := r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			if err := r.checkStorage(db); err != nil {
				return err
			}
			var record filesystemSettingsRecord
			query := db.Where("id = ?", filesystemSettingsID).Limit(1).Find(&record)
			if query.Error != nil || query.RowsAffected == 0 {
				return query.Error
			}
			output.Revision = record.Revision
			decoder := json.NewDecoder(strings.NewReader(record.OverridesJSON))
			decoder.DisallowUnknownFields()
			var overrides *service.FilesystemOverrides
			if err := decoder.Decode(&overrides); err != nil {
				return fmt.Errorf("decode stored filesystem settings: %w", err)
			}
			if overrides == nil {
				return fmt.Errorf("stored filesystem settings must be an object")
			}
			output.Overrides = *overrides
			if err := decoder.Decode(new(struct{})); err != io.EOF {
				if err != nil {
					return fmt.Errorf("decode stored filesystem settings trailing content: %w", err)
				}
				return fmt.Errorf("unexpected stored filesystem settings trailing value")
			}
			return output.ValidateStored()
		})
	})
	return output, err
}

func (r *Repository) SaveFilesystemSettings(ctx context.Context, value service.StoredFilesystemSettings) (service.StoredFilesystemSettings, error) {
	expected := value.Revision
	value.Revision++
	if err := value.ValidateStored(); err != nil {
		return service.StoredFilesystemSettings{}, err
	}
	payload, err := json.Marshal(value.Overrides)
	if err != nil {
		return service.StoredFilesystemSettings{}, fmt.Errorf("encode filesystem settings: %w", err)
	}
	record := filesystemSettingsRecord{ID: filesystemSettingsID, Revision: value.Revision, OverridesJSON: string(payload)}
	err = r.access.WithinTx(ctx, func(ctx context.Context, _ database.Client, tx database.Tx) error {
		return database.UseGORMTx(ctx, tx, func(db *gorm.DB) error {
			if err := r.lockStorage(db); err != nil {
				return err
			}
			if expected == 0 {
				var count int64
				if err := db.Model(&filesystemSettingsRecord{}).Where("id = ?", filesystemSettingsID).Count(&count).Error; err != nil {
					return err
				}
				if count != 0 {
					return model.ErrConflict
				}
				return db.Create(&record).Error
			}
			updated := db.Model(&filesystemSettingsRecord{}).Where("id = ? AND revision = ?", filesystemSettingsID, expected).
				Select("revision", "overrides_json").Updates(&record)
			if updated.Error != nil {
				return updated.Error
			}
			if updated.RowsAffected != 1 {
				return model.ErrConflict
			}
			return nil
		})
	})
	return value, err
}
