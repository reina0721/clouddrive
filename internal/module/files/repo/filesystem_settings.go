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
	revision, overrides, err := readFileSettings[service.FilesystemOverrides](ctx, r, filesystemSettingsID)
	output := service.StoredFilesystemSettings{Revision: revision, Overrides: overrides}
	if err == nil && revision != 0 {
		err = output.ValidateStored()
	}
	return output, err
}

func readFileSettings[T any](ctx context.Context, r *Repository, id string) (int64, T, error) {
	var revision int64
	var output T
	err := r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			if err := r.checkStorage(db); err != nil {
				return err
			}
			var record filesystemSettingsRecord
			query := db.Where("id = ?", id).Limit(1).Find(&record)
			if query.Error != nil || query.RowsAffected == 0 {
				return query.Error
			}
			if record.Revision < 1 || record.Revision > model.MaxPreferenceRevision {
				return model.ErrInvalid
			}
			revision = record.Revision
			decoder := json.NewDecoder(strings.NewReader(record.OverridesJSON))
			decoder.DisallowUnknownFields()
			var overrides *T
			if err := decoder.Decode(&overrides); err != nil {
				return fmt.Errorf("decode stored file settings: %w", err)
			}
			if overrides == nil {
				return fmt.Errorf("stored file settings must be an object")
			}
			if err := decoder.Decode(new(struct{})); err != io.EOF {
				if err != nil {
					return fmt.Errorf("decode stored file settings trailing content: %w", err)
				}
				return fmt.Errorf("unexpected stored file settings trailing value")
			}
			output = *overrides
			return nil
		})
	})
	return revision, output, err
}

func (r *Repository) SaveFilesystemSettings(ctx context.Context, value service.StoredFilesystemSettings) (service.StoredFilesystemSettings, error) {
	expected := value.Revision
	value.Revision++
	if err := value.ValidateStored(); err != nil {
		return service.StoredFilesystemSettings{}, err
	}
	return value, r.saveFileSettings(ctx, filesystemSettingsID, expected, value.Revision, value.Overrides)
}

func (r *Repository) saveFileSettings(ctx context.Context, id string, expected, revision int64, overrides any) error {
	payload, err := json.Marshal(overrides)
	if err != nil {
		return fmt.Errorf("encode file settings: %w", err)
	}
	record := filesystemSettingsRecord{ID: id, Revision: revision, OverridesJSON: string(payload)}
	return r.access.WithinTx(ctx, func(ctx context.Context, _ database.Client, tx database.Tx) error {
		return database.UseGORMTx(ctx, tx, func(db *gorm.DB) error {
			if err := r.lockStorage(db); err != nil {
				return err
			}
			if expected == 0 {
				var count int64
				if err := db.Model(&filesystemSettingsRecord{}).Where("id = ?", id).Count(&count).Error; err != nil {
					return err
				}
				if count != 0 {
					return model.ErrConflict
				}
				return db.Create(&record).Error
			}
			updated := db.Model(&filesystemSettingsRecord{}).Where("id = ? AND revision = ?", id, expected).
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
}
