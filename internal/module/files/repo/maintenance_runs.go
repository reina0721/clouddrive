package repo

import (
	"context"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/database"
	"gorm.io/gorm"
)

type maintenanceRunRecord service.MaintenanceRun

func (maintenanceRunRecord) TableName() string { return "files_maintenance_runs" }

func (r *Repository) AppendMaintenanceRun(ctx context.Context, run service.MaintenanceRun) error {
	return r.access.WithinTx(ctx, func(ctx context.Context, _ database.Client, tx database.Tx) error {
		return database.UseGORMTx(ctx, tx, func(db *gorm.DB) error {
			if err := r.lockStorage(db); err != nil {
				return err
			}
			record := maintenanceRunRecord(run)
			if err := db.Create(&record).Error; err != nil {
				return err
			}
			var expired []string
			if err := db.Model(&maintenanceRunRecord{}).Where("kind = ?", run.Kind).Order("created_at DESC, id DESC").
				Offset(service.MaintenanceHistoryLimit).Limit(1).Pluck("id", &expired).Error; err != nil {
				return err
			}
			if len(expired) == 0 {
				return nil
			}
			return db.Where("id = ?", expired[0]).Delete(&maintenanceRunRecord{}).Error
		})
	})
}

func (r *Repository) RemoveMaintenanceRunIfUnchanged(ctx context.Context, kind service.MaintenanceKind, id string, updatedAt time.Time) error {
	return r.access.WithinTx(ctx, func(ctx context.Context, _ database.Client, tx database.Tx) error {
		return database.UseGORMTx(ctx, tx, func(db *gorm.DB) error {
			if err := r.lockStorage(db); err != nil {
				return err
			}
			result := db.Where("id = ? AND kind = ? AND updated_at = ?", id, kind, updatedAt.UTC()).Delete(&maintenanceRunRecord{})
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected != 1 {
				return model.ErrConflict
			}
			return nil
		})
	})
}
