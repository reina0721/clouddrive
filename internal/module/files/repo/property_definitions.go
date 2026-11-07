package repo

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"strings"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/pkg/database"
	"gorm.io/gorm"
)

const propertyDefinitionSetID = "global"

type propertyDefinitionRecord struct {
	ID              string `gorm:"primaryKey"`
	Revision        int64
	DefinitionsJSON string
}

func (propertyDefinitionRecord) TableName() string { return "files_property_definitions" }

func loadPropertyDefinitions(db *gorm.DB) (model.PropertyDefinitionSet, error) {
	value := model.PropertyDefinitionSet{Items: []model.PropertyDefinition{}}
	var record propertyDefinitionRecord
	query := db.Where("id = ?", propertyDefinitionSetID).Limit(1).Find(&record)
	if query.Error != nil || query.RowsAffected == 0 {
		return value, query.Error
	}
	decoder := json.NewDecoder(strings.NewReader(record.DefinitionsJSON))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&value.Items); err != nil {
		return model.PropertyDefinitionSet{}, fmt.Errorf("decode file property definitions: %w", err)
	}
	if err := decoder.Decode(new(struct{})); err != io.EOF {
		if err != nil {
			return model.PropertyDefinitionSet{}, fmt.Errorf("decode file property definition trailing content: %w", err)
		}
		return model.PropertyDefinitionSet{}, fmt.Errorf("unexpected file property definition trailing content")
	}
	value.Revision = record.Revision
	if value.Revision < 1 {
		return model.PropertyDefinitionSet{}, fmt.Errorf("stored file property definition revision invariant")
	}
	if err := value.Validate(); err != nil {
		return model.PropertyDefinitionSet{}, fmt.Errorf("validate stored file property definitions: %w", err)
	}
	return value, nil
}

func (r *Repository) ReadPropertyDefinitions(ctx context.Context) (model.PropertyDefinitionSet, error) {
	var result model.PropertyDefinitionSet
	err := r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			if err := r.checkStorage(db); err != nil {
				return err
			}
			var err error
			result, err = loadPropertyDefinitions(db)
			return err
		})
	})
	return result, err
}

func (r *Repository) SavePropertyDefinitions(ctx context.Context, value model.PropertyDefinitionSet) (model.PropertyDefinitionSet, error) {
	expected := value.Revision
	value.Revision++
	payload, err := json.Marshal(value.Items)
	if err != nil {
		return model.PropertyDefinitionSet{}, fmt.Errorf("encode file property definitions: %w", err)
	}
	record := propertyDefinitionRecord{ID: propertyDefinitionSetID, Revision: value.Revision, DefinitionsJSON: string(payload)}
	err = r.access.WithinTx(ctx, func(ctx context.Context, _ database.Client, tx database.Tx) error {
		return database.UseGORMTx(ctx, tx, func(db *gorm.DB) error {
			if err := r.lockStorage(db); err != nil {
				return err
			}
			current, err := loadPropertyDefinitions(db)
			if err != nil {
				return err
			}
			if current.Revision != expected {
				return model.ErrConflict
			}
			kinds := make(map[string]model.PropertyKind, len(current.Items))
			for _, definition := range current.Items {
				kinds[definition.Key] = definition.Kind
			}
			for _, definition := range value.Items {
				if kind, exists := kinds[definition.Key]; exists && kind != definition.Kind {
					return model.ErrInvalid
				}
			}
			if expected == 0 {
				return db.Create(&record).Error
			}
			result := db.Model(&propertyDefinitionRecord{}).Where("id = ? AND revision = ?", propertyDefinitionSetID, expected).
				Select("revision", "definitions_json").Updates(&record)
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected != 1 {
				return model.ErrConflict
			}
			return nil
		})
	})
	return value, err
}

// validateDefinedProperties 只检验变更的值，保留规则变化前已保存的旧值及其可删除性。
func validateDefinedProperties(definitions []model.PropertyDefinition, previous, next []model.Property) error {
	previousValues := make(map[string]string, len(previous))
	for _, property := range previous {
		previousValues[property.Key] = property.Value
	}
	for _, property := range next {
		if value, exists := previousValues[property.Key]; exists && value == property.Value {
			continue
		}
		for _, definition := range definitions {
			if property.Key == definition.Key {
				if err := definition.ValidateValue(property.Value); err != nil {
					return err
				}
				break
			}
		}
	}
	return nil
}
