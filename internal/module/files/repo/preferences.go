package repo

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/pkg/database"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type preferencesRecord struct {
	OwnerID  string `gorm:"primaryKey"`
	Revision int64
	Document string
}

func (preferencesRecord) TableName() string { return "files_preferences" }

func decodeFilePreferences(record preferencesRecord) (model.FilePreferences, error) {
	var value model.FilePreferences
	decoder := json.NewDecoder(strings.NewReader(record.Document))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&value); err != nil {
		return value, fmt.Errorf("decode file preferences: %w", err)
	}
	if err := decoder.Decode(new(struct{})); !errors.Is(err, io.EOF) {
		if err != nil {
			return value, fmt.Errorf("file preferences trailing document: %w", err)
		}
		return value, fmt.Errorf("file preferences trailing document")
	}
	if record.Revision < 1 || record.Revision != value.Revision {
		return value, fmt.Errorf("file preferences revision invariant")
	}
	if err := value.Validate(); err != nil {
		return value, fmt.Errorf("stored file preferences: %w", err)
	}
	return value, nil
}

func (r *Repository) ReadPreferences(ctx context.Context, owner string) (model.FilePreferences, error) {
	if owner == "" {
		return model.FilePreferences{}, model.ErrMissing
	}
	value := model.DefaultFilePreferences()
	err := r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			if err := r.checkStorage(db); err != nil {
				return err
			}
			var record preferencesRecord
			if err := db.First(&record, "owner_id = ?", owner).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return nil
				}
				return err
			}
			var err error
			value, err = decodeFilePreferences(record)
			return err
		})
	})
	return value, err
}

func (r *Repository) SavePreferences(ctx context.Context, owner string, value model.FilePreferences) (model.FilePreferences, error) {
	if owner == "" {
		return model.FilePreferences{}, model.ErrMissing
	}
	if err := value.Validate(); err != nil {
		return model.FilePreferences{}, err
	}
	if value.Revision == model.MaxPreferenceRevision {
		return model.FilePreferences{}, fmt.Errorf("file preferences revision exhausted")
	}
	expected := value.Revision
	value.Revision++
	encoded, err := json.Marshal(value)
	if err != nil {
		return model.FilePreferences{}, fmt.Errorf("encode file preferences: %w", err)
	}
	err = r.access.WithinTx(ctx, func(ctx context.Context, _ database.Client, tx database.Tx) error {
		return database.UseGORMTx(ctx, tx, func(db *gorm.DB) error {
			if err := r.lockOwner(db, owner); err != nil {
				return err
			}
			if err := r.checkStorage(db); err != nil {
				return err
			}
			record := preferencesRecord{OwnerID: owner, Revision: value.Revision, Document: string(encoded)}
			var changed *gorm.DB
			if expected == 0 {
				changed = db.Clauses(clause.OnConflict{DoNothing: true}).Create(&record)
			} else {
				changed = db.Model(&preferencesRecord{}).Where("owner_id = ? AND revision = ?", owner, expected).Updates(map[string]any{"revision": record.Revision, "document": record.Document})
			}
			if changed.Error != nil {
				return changed.Error
			}
			if changed.RowsAffected != 1 {
				return model.ErrConflict
			}
			return nil
		})
	})
	return value, err
}
