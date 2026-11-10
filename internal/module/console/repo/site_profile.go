package repo

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/reina0721/clouddrive/internal/module/console/model"
	"github.com/reina0721/clouddrive/pkg/database"
	"gorm.io/gorm"
)

const publicSiteProfileID = 1

type siteProfileRecord struct {
	ID          int
	Revision    int64
	ProfileJSON string
}

func (siteProfileRecord) TableName() string { return "console_site_profile" }

// SiteProfile 读取预置的唯一站点配置。
func (s *Store) SiteProfile(ctx context.Context) (model.SiteProfileVersion, error) {
	var record siteProfileRecord
	err := s.use(ctx, func(db *gorm.DB) error {
		return db.First(&record, publicSiteProfileID).Error
	})
	if err != nil {
		return model.SiteProfileVersion{}, err
	}
	result := model.SiteProfileVersion{Revision: record.Revision}
	if err := json.Unmarshal([]byte(record.ProfileJSON), &result.Profile); err != nil {
		return model.SiteProfileVersion{}, fmt.Errorf("decode console site profile: %w", err)
	}
	if result.Revision < 1 || result.Revision > model.MaxSiteProfileRevision || !result.Profile.Valid() {
		return model.SiteProfileVersion{}, fmt.Errorf("console site profile invariant")
	}
	return result, nil
}

// SaveSiteProfile 用调用方读取的修订号保护整张表单。
func (s *Store) SaveSiteProfile(ctx context.Context, value model.SiteProfileVersion) (model.SiteProfileVersion, error) {
	payload, err := json.Marshal(value.Profile)
	if err != nil {
		return model.SiteProfileVersion{}, fmt.Errorf("encode console site profile: %w", err)
	}
	expected := value.Revision
	value.Revision++
	err = s.use(ctx, func(db *gorm.DB) error {
		updated := db.Model(&siteProfileRecord{}).Where("id = ? AND revision = ?", publicSiteProfileID, expected).
			Select("revision", "profile_json").Updates(siteProfileRecord{Revision: value.Revision, ProfileJSON: string(payload)})
		if updated.Error != nil {
			return updated.Error
		}
		if updated.RowsAffected != 1 {
			return database.ErrOptimisticConflict
		}
		return nil
	})
	if err != nil {
		return model.SiteProfileVersion{}, err
	}
	return value, nil
}
