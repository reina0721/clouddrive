package repo

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/database"
	"gorm.io/gorm"
)

type archiveTaskRecord struct {
	ID            string `gorm:"primaryKey"`
	OwnerID       string
	SourceID      string
	SourceName    string
	ClientKey     string
	RequestJSON   string `gorm:"column:request_json"`
	DestinationID string
	State         service.ArchiveTaskState
	FailureCode   string
	CreatedCount  int
	SkippedCount  int
	RenamedCount  int
	Candidates    string
	LeaseToken    string
	LeaseUntil    *time.Time
	CleanupAfter  *time.Time
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

func (archiveTaskRecord) TableName() string { return "files_archive_tasks" }

func (r archiveTaskRecord) summary() service.ArchiveTask {
	return service.ArchiveTask{
		ID: r.ID, SourceName: r.SourceName, DestinationID: r.DestinationID, State: r.State, FailureCode: r.FailureCode,
		CreatedCount: r.CreatedCount, SkippedCount: r.SkippedCount, RenamedCount: r.RenamedCount,
		CleanupPending: r.State == service.ArchiveTaskFailed && r.Candidates != "",
		CreatedAt:      r.CreatedAt, UpdatedAt: r.UpdatedAt,
	}
}

func (r archiveTaskRecord) claim() service.ArchiveTaskClaim {
	return service.ArchiveTaskClaim{ID: r.ID, OwnerID: r.OwnerID, SourceID: r.SourceID, Token: r.LeaseToken, RequestJSON: r.RequestJSON}
}

func archiveTaskAt(db *gorm.DB, owner, id string) (archiveTaskRecord, error) {
	var row archiveTaskRecord
	if err := db.First(&row, "owner_id = ? AND id = ?", owner, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return row, errors.Join(model.ErrMissing, err)
		}
		return row, err
	}
	return row, nil
}

func archiveTaskUpdate(db *gorm.DB, row archiveTaskRecord, columns ...string) error {
	return db.Model(&archiveTaskRecord{}).Where("id = ? AND owner_id = ?", row.ID, row.OwnerID).Select(columns).Updates(&row).Error
}

func (r *Repository) archiveTransaction(ctx context.Context, change func(*gorm.DB) error) error {
	return r.access.WithinTx(ctx, func(ctx context.Context, _ database.Client, tx database.Tx) error {
		return database.UseGORMTx(ctx, tx, change)
	})
}

func (r *Repository) CreateArchiveTask(ctx context.Context, task service.ArchiveTaskClaim, key string, limit int, validate func([]model.Entry) (string, error)) (service.ArchiveTask, error) {
	var result service.ArchiveTask
	err := r.archiveTransaction(ctx, func(db *gorm.DB) error {
		if err := r.lockOwner(db, task.OwnerID); err != nil {
			return err
		}
		var previous archiveTaskRecord
		err := db.Take(&previous, "owner_id = ? AND client_key = ?", task.OwnerID, key).Error
		if err == nil {
			if previous.SourceID != task.SourceID || previous.RequestJSON != task.RequestJSON {
				return model.ErrConflict
			}
			result = previous.summary()
			return nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		var total, own int64
		if err := db.Model(&archiveTaskRecord{}).Count(&total).Error; err != nil {
			return err
		}
		if err := db.Model(&archiveTaskRecord{}).Where("owner_id = ?", task.OwnerID).Count(&own).Error; err != nil {
			return err
		}
		if total >= service.ArchiveTaskGlobalLimit || own >= service.ArchiveTaskOwnerLimit {
			return model.ErrBusy
		}
		entries, err := loadBoundedEntries(db, task.OwnerID, limit)
		if err != nil {
			return err
		}
		name, err := validate(entries)
		if err != nil {
			return err
		}
		now := r.clock.Now().UTC()
		row := archiveTaskRecord{ID: task.ID, OwnerID: task.OwnerID, SourceID: task.SourceID, ClientKey: key, SourceName: name, RequestJSON: task.RequestJSON, State: service.ArchiveTaskQueued, CreatedAt: now, UpdatedAt: now}
		if err := db.Create(&row).Error; err != nil {
			return err
		}
		result = row.summary()
		return nil
	})
	return result, err
}

func (r *Repository) ListArchiveTasks(ctx context.Context, owner string) ([]service.ArchiveTask, error) {
	result := []service.ArchiveTask{}
	err := r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			rows := []archiveTaskRecord{}
			if err := db.Omit("request_json", "lease_token").Where("owner_id = ?", owner).Order("created_at DESC, id DESC").Limit(service.ArchiveTaskOwnerLimit).Find(&rows).Error; err != nil {
				return err
			}
			for _, row := range rows {
				result = append(result, row.summary())
			}
			return nil
		})
	})
	return result, err
}

func (r *Repository) ReadArchiveTask(ctx context.Context, owner, id string) (service.ArchiveTask, error) {
	var result service.ArchiveTask
	err := r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			row, err := archiveTaskAt(db.Omit("request_json", "lease_token"), owner, id)
			result = row.summary()
			return err
		})
	})
	return result, err
}

func (r *Repository) CancelArchiveTask(ctx context.Context, owner, id string) error {
	return r.archiveTransaction(ctx, func(db *gorm.DB) error {
		if err := r.lockOwner(db, owner); err != nil {
			return err
		}
		row, err := archiveTaskAt(db, owner, id)
		if err != nil {
			return err
		}
		if row.State == service.ArchiveTaskCanceled {
			return nil
		}
		if row.State != service.ArchiveTaskQueued {
			return model.ErrConflict
		}
		row.State, row.UpdatedAt = service.ArchiveTaskCanceled, r.clock.Now().UTC()
		return archiveTaskUpdate(db, row, "state", "updated_at")
	})
}

func (r *Repository) RemoveArchiveTask(ctx context.Context, owner, id string) error {
	return r.archiveTransaction(ctx, func(db *gorm.DB) error {
		if err := r.lockOwner(db, owner); err != nil {
			return err
		}
		row, err := archiveTaskAt(db, owner, id)
		if err != nil {
			return err
		}
		if !row.State.Terminal() || row.Candidates != "" {
			return model.ErrConflict
		}
		return db.Where("owner_id = ? AND id = ?", owner, id).Delete(&archiveTaskRecord{}).Error
	})
}

func (r *Repository) ClaimArchiveTask(ctx context.Context, token string) (service.ArchiveTaskClaim, error) {
	var claim service.ArchiveTaskClaim
	err := r.archiveTransaction(ctx, func(db *gorm.DB) error {
		if err := r.lockStorage(db); err != nil {
			return err
		}
		now := r.clock.Now().UTC()
		active := []service.ArchiveTaskState{service.ArchiveTaskRunning, service.ArchiveTaskPublishing}
		expired := map[string]any{
			"state": service.ArchiveTaskFailed, "failure_code": service.ArchiveFailureInterrupted, "lease_token": "",
			"lease_until": nil, "cleanup_after": now, "updated_at": now,
		}
		if err := db.Model(&archiveTaskRecord{}).Where("state IN ? AND lease_until <= ?", active, now).Updates(expired).Error; err != nil {
			return err
		}
		var running int64
		if err := db.Model(&archiveTaskRecord{}).Where("state IN ?", active).Count(&running).Error; err != nil || running > 0 {
			return err
		}
		var row archiveTaskRecord
		err := db.Where("state = ?", service.ArchiveTaskQueued).Order("created_at ASC, id ASC").Take(&row).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		if err != nil {
			return err
		}
		until := now.Add(service.ArchiveTaskLease)
		row.State, row.LeaseToken, row.LeaseUntil, row.UpdatedAt = service.ArchiveTaskRunning, token, &until, now
		if err := archiveTaskUpdate(db, row, "state", "lease_token", "lease_until", "updated_at"); err != nil {
			return err
		}
		claim = row.claim()
		return nil
	})
	return claim, err
}

func (r archiveTaskRecord) owns(claim service.ArchiveTaskClaim, now time.Time) bool {
	return r.LeaseToken == claim.Token && claim.Token != "" && r.LeaseUntil != nil && now.Before(*r.LeaseUntil)
}

func archiveCandidateSet(keys []string) (string, error) {
	if len(keys) == 0 {
		return "", nil
	}
	if len(keys) > service.DefaultMaxBatchEntries {
		return "", model.ErrTooLarge
	}
	encoded, err := json.Marshal(keys)
	return string(encoded), err
}

func (r *Repository) RecordArchiveCandidates(ctx context.Context, claim service.ArchiveTaskClaim, keys []string) error {
	encoded, err := archiveCandidateSet(keys)
	if err != nil {
		return err
	}
	return r.archiveTransaction(ctx, func(db *gorm.DB) error {
		if err := r.lockOwner(db, claim.OwnerID); err != nil {
			return err
		}
		row, err := archiveTaskAt(db, claim.OwnerID, claim.ID)
		if err != nil {
			return err
		}
		now := r.clock.Now().UTC()
		if !row.owns(claim, now) || row.State != service.ArchiveTaskRunning {
			return model.ErrConflict
		}
		row.State, row.Candidates, row.UpdatedAt = service.ArchiveTaskPublishing, encoded, now
		return archiveTaskUpdate(db, row, "state", "candidates", "updated_at")
	})
}

func (r *Repository) PublishArchiveTask(ctx context.Context, claim service.ArchiveTaskClaim, limit int, result service.ArchiveTask, validate func([]model.Entry) ([]model.Entry, error)) error {
	return r.archiveTransaction(ctx, func(db *gorm.DB) error {
		if err := r.lockOwner(db, claim.OwnerID); err != nil {
			return err
		}
		row, err := archiveTaskAt(db, claim.OwnerID, claim.ID)
		if err != nil {
			return err
		}
		now := r.clock.Now().UTC()
		if !row.owns(claim, now) || row.State != service.ArchiveTaskPublishing {
			return model.ErrConflict
		}
		entries, err := loadBoundedEntries(db, claim.OwnerID, limit)
		if err != nil {
			return err
		}
		changed, err := validate(entries)
		if err != nil {
			return err
		}
		keys := []string{}
		for _, entry := range changed {
			if _, exists := model.Find(entries, entry.ID); exists {
				return model.ErrConflict
			}
			if entry.Kind == model.File {
				keys = append(keys, entry.ObjectKey)
			}
		}
		encoded, err := archiveCandidateSet(keys)
		if err != nil {
			return err
		}
		if encoded != row.Candidates || result.CreatedCount != len(changed) {
			return fmt.Errorf("archive candidate publication invariant")
		}
		if err := r.saveEntryChanges(db, claim.OwnerID, entries, changed, model.FileWriteAuthority{}); err != nil {
			return err
		}
		row.State, row.UpdatedAt = service.ArchiveTaskCompleted, now
		row.DestinationID, row.CreatedCount, row.SkippedCount, row.RenamedCount = result.DestinationID, result.CreatedCount, result.SkippedCount, result.RenamedCount
		row.LeaseToken, row.LeaseUntil, row.Candidates = "", nil, ""
		return archiveTaskUpdate(db, row, "state", "updated_at", "destination_id", "created_count", "skipped_count", "renamed_count", "lease_token", "lease_until", "candidates")
	})
}

func (r *Repository) FailArchiveTask(ctx context.Context, claim service.ArchiveTaskClaim, code string) (bool, error) {
	failed := false
	err := r.archiveTransaction(ctx, func(db *gorm.DB) error {
		if err := r.lockOwner(db, claim.OwnerID); err != nil {
			return err
		}
		row, err := archiveTaskAt(db, claim.OwnerID, claim.ID)
		if err != nil {
			return err
		}
		now := r.clock.Now().UTC()
		if !row.owns(claim, now) || (row.State != service.ArchiveTaskRunning && row.State != service.ArchiveTaskPublishing) {
			return nil
		}
		row.State, row.FailureCode, row.UpdatedAt = service.ArchiveTaskFailed, code, now
		row.CleanupAfter, row.LeaseUntil, row.LeaseToken = row.LeaseUntil, nil, ""
		failed = true
		return archiveTaskUpdate(db, row, "state", "failure_code", "updated_at", "cleanup_after", "lease_until", "lease_token")
	})
	return failed, err
}

func (r *Repository) ClaimArchiveCleanup(ctx context.Context, token string) (service.ArchiveCleanup, error) {
	var batch service.ArchiveCleanup
	err := r.archiveTransaction(ctx, func(db *gorm.DB) error {
		if err := r.lockStorage(db); err != nil {
			return err
		}
		now := r.clock.Now().UTC()
		var row archiveTaskRecord
		err := db.Where("state = ? AND candidates <> ? AND cleanup_after <= ?", service.ArchiveTaskFailed, "", now).Order("cleanup_after ASC, id ASC").Take(&row).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		if err != nil {
			return err
		}
		var keys []string
		if err := json.Unmarshal([]byte(row.Candidates), &keys); err != nil {
			return fmt.Errorf("decode archive cleanup: %w", err)
		}
		if len(keys) < 1 || len(keys) > service.DefaultMaxBatchEntries {
			return fmt.Errorf("archive cleanup count invariant")
		}
		retry := now.Add(service.ArchiveCleanupRetry)
		row.LeaseToken, row.CleanupAfter = token, &retry
		if err := archiveTaskUpdate(db, row, "lease_token", "cleanup_after"); err != nil {
			return err
		}
		batch = service.ArchiveCleanup{ID: row.ID, OwnerID: row.OwnerID, Token: token, Keys: keys}
		return nil
	})
	return batch, err
}

func (r *Repository) SettleArchiveCleanup(ctx context.Context, batch service.ArchiveCleanup, remaining []string) error {
	encoded, err := archiveCandidateSet(remaining)
	if err != nil {
		return err
	}
	return r.archiveTransaction(ctx, func(db *gorm.DB) error {
		if err := r.lockOwner(db, batch.OwnerID); err != nil {
			return err
		}
		row, err := archiveTaskAt(db, batch.OwnerID, batch.ID)
		if err != nil {
			return err
		}
		if row.State != service.ArchiveTaskFailed || row.LeaseToken != batch.Token {
			return model.ErrConflict
		}
		row.Candidates, row.LeaseToken, row.UpdatedAt = encoded, "", r.clock.Now().UTC()
		if encoded == "" {
			row.CleanupAfter = nil
		}
		return archiveTaskUpdate(db, row, "candidates", "lease_token", "cleanup_after", "updated_at")
	})
}
