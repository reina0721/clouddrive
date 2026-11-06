package repo

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/database"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"io"
	"strings"
)

type historyPreferencesRecord struct {
	OwnerID  string `gorm:"primaryKey"`
	Revision int64
	Document string
}

func (historyPreferencesRecord) TableName() string { return "files_history_preferences" }

func decodeHistoryPreferences(record historyPreferencesRecord) (model.HistoryPreferences, error) {
	var value model.HistoryPreferences
	decoder := json.NewDecoder(strings.NewReader(record.Document))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&value); err != nil {
		return value, fmt.Errorf("decode history preferences: %w", err)
	}
	if err := decoder.Decode(new(struct{})); !errors.Is(err, io.EOF) {
		if err != nil {
			return value, fmt.Errorf("history preferences trailing document: %w", err)
		}
		return value, fmt.Errorf("history preferences trailing document")
	}
	if record.Revision < 1 || record.Revision != value.Revision {
		return value, fmt.Errorf("history preferences revision invariant")
	}
	if err := value.Validate(); err != nil {
		return value, fmt.Errorf("stored history preferences: %w", err)
	}
	return value, nil
}

// loadHistoryPreferences 只使用调用方已有事务或租约，不自行取得第二连接。
func loadHistoryPreferences(db *gorm.DB, owner string) (model.HistoryPreferences, error) {
	var record historyPreferencesRecord
	if err := db.First(&record, "owner_id = ?", owner).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return model.DefaultHistoryPreferences(), nil
		}
		return model.HistoryPreferences{}, err
	}
	return decodeHistoryPreferences(record)
}

func (r *Repository) ReadHistoryPreferences(ctx context.Context, owner string) (model.HistoryPreferences, error) {
	if owner == "" {
		return model.HistoryPreferences{}, model.ErrMissing
	}
	var value model.HistoryPreferences
	err := r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			if err := r.checkStorage(db); err != nil {
				return err
			}
			var err error
			value, err = loadHistoryPreferences(db, owner)
			return err
		})
	})
	return value, err
}

func (r *Repository) SaveHistoryPreferences(ctx context.Context, owner string, value model.HistoryPreferences) (model.HistoryPreferences, error) {
	if owner == "" {
		return model.HistoryPreferences{}, model.ErrMissing
	}
	if err := value.Validate(); err != nil {
		return model.HistoryPreferences{}, err
	}
	if value.Revision == model.MaxPreferenceRevision {
		return model.HistoryPreferences{}, model.ErrConflict
	}
	expected := value.Revision
	value.Revision++
	encoded, err := json.Marshal(value)
	if err != nil {
		return model.HistoryPreferences{}, fmt.Errorf("encode history preferences: %w", err)
	}
	err = r.access.WithinTx(ctx, func(ctx context.Context, _ database.Client, tx database.Tx) error {
		return database.UseGORMTx(ctx, tx, func(db *gorm.DB) error {
			if err := r.lockOwner(db, owner); err != nil {
				return err
			}
			record := historyPreferencesRecord{OwnerID: owner, Revision: value.Revision, Document: string(encoded)}
			var changed *gorm.DB
			if expected == 0 {
				changed = db.Clauses(clause.OnConflict{DoNothing: true}).Create(&record)
			} else {
				changed = db.Model(&historyPreferencesRecord{}).Where("owner_id = ? AND revision = ?", owner, expected).Updates(map[string]any{"revision": record.Revision, "document": record.Document})
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

func (r *Repository) ChangeContent(ctx context.Context, owner string, change func(service.ContentSnapshot) (model.Entry, error)) (model.Entry, error) {
	var result model.Entry
	err := r.access.WithinTx(ctx, func(ctx context.Context, _ database.Client, tx database.Tx) error {
		return database.UseGORMTx(ctx, tx, func(db *gorm.DB) error {
			if err := r.lockOwner(db, owner); err != nil {
				return err
			}
			entries, err := loadEntries(db, owner)
			if err != nil {
				return err
			}
			preferences, err := loadHistoryPreferences(db, owner)
			if err != nil {
				return err
			}
			entry, err := change(service.ContentSnapshot{Entries: entries, HistoryPreferences: preferences})
			if err != nil {
				return err
			}
			if err := saveEntryChanges(db, owner, entries, []model.Entry{entry}); err != nil {
				return err
			}
			result = entry
			return nil
		})
	})
	return result, err
}
