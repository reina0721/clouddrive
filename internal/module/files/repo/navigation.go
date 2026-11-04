package repo

import (
	"context"
	"errors"
	"fmt"
	"math"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/database"
	"github.com/reina0721/clouddrive/pkg/idgen"
	"gorm.io/gorm"
)

type pinRecord model.Pin

func (pinRecord) TableName() string { return "files_pins" }

type navigationState struct {
	OwnerID  string `gorm:"primaryKey"`
	Revision int64
}

func (navigationState) TableName() string { return "files_navigation_states" }

// Navigation 固定存储位置与读取预算，复用现有owner锁及条目保存。
type Navigation struct {
	*Repository
	treeLimit int
}

func NewNavigation(access Access, identity string, treeLimit int) (*Navigation, error) {
	if treeLimit < 1 || treeLimit > service.DefaultNavigationTreeEntries {
		return nil, model.ErrInvalid
	}
	repository, err := New(access, identity)
	if err != nil {
		return nil, err
	}
	return &Navigation{Repository: repository, treeLimit: treeLimit}, nil
}
func loadBoundedEntries(db *gorm.DB, owner string, limit int) ([]model.Entry, error) {
	records := []entryRecord{}
	if err := db.Where("owner_id = ?", owner).Order("id ASC").Limit(limit + 1).Find(&records).Error; err != nil {
		return nil, err
	}
	if len(records) > limit {
		return nil, model.ErrTooLarge
	}
	return entryModels(records)
}
func readNavigationRevision(db *gorm.DB, owner string) (int64, error) {
	var state navigationState
	if err := db.First(&state, "owner_id = ?", owner).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return 0, nil
		}
		return 0, err
	}
	if state.Revision < 1 {
		return 0, fmt.Errorf("invalid file navigation revision")
	}
	return state.Revision, nil
}
func (r *Navigation) snapshot(db *gorm.DB, owner string) (service.NavigationSnapshot, error) {
	revision, err := readNavigationRevision(db, owner)
	if err != nil {
		return service.NavigationSnapshot{}, err
	}
	records := []pinRecord{}
	if err := db.Where("owner_id = ?", owner).Order("position ASC, id ASC").Limit(service.DefaultPinLimit + 1).Find(&records).Error; err != nil {
		return service.NavigationSnapshot{}, err
	}
	if len(records) > service.DefaultPinLimit {
		return service.NavigationSnapshot{}, model.ErrTooLarge
	}
	pins := make([]model.Pin, len(records))
	for index, record := range records {
		pins[index] = model.Pin(record)
	}
	entries, err := loadBoundedEntries(db, owner, r.treeLimit)
	if err != nil && !errors.Is(err, model.ErrTooLarge) {
		return service.NavigationSnapshot{}, err
	}
	result := service.NavigationSnapshot{Entries: entries, EntriesUnavailable: errors.Is(err, model.ErrTooLarge), Pins: pins, Revision: revision}
	// 读取跨越一次pin提交时返回冲突，不用新旧集合拼出可覆盖的数据。
	current, err := readNavigationRevision(db, owner)
	if err != nil {
		return service.NavigationSnapshot{}, err
	}
	if current != revision {
		return service.NavigationSnapshot{}, model.ErrConflict
	}
	return result, nil
}
func (r *Navigation) ReadNavigation(ctx context.Context, owner string) (service.NavigationSnapshot, error) {
	if owner == "" {
		return service.NavigationSnapshot{}, model.ErrMissing
	}
	var result service.NavigationSnapshot
	err := r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			if err := r.checkStorage(db); err != nil {
				return err
			}
			var err error
			result, err = r.snapshot(db, owner)
			return err
		})
	})
	return result, err
}
func (r *Navigation) ChangePins(ctx context.Context, owner string, revision int64, change func(service.NavigationSnapshot) ([]model.Pin, error)) (service.NavigationSnapshot, error) {
	if owner == "" || revision < 0 || change == nil {
		return service.NavigationSnapshot{}, model.ErrInvalid
	}
	var result service.NavigationSnapshot
	err := r.access.WithinTx(ctx, func(ctx context.Context, _ database.Client, tx database.Tx) error {
		return database.UseGORMTx(ctx, tx, func(db *gorm.DB) error {
			if err := r.lockOwner(db, owner); err != nil {
				return err
			}
			snapshot, err := r.snapshot(db, owner)
			if err != nil {
				return err
			}
			if snapshot.Revision != revision {
				return model.ErrConflict
			}
			if revision == math.MaxInt64 {
				return fmt.Errorf("file navigation revision exhausted")
			}
			pins, err := change(snapshot)
			if err != nil {
				return err
			}
			if len(pins) > service.DefaultPinLimit {
				return model.ErrTooLarge
			}
			ids := map[string]bool{}
			targets := map[string]bool{}
			for index, pin := range pins {
				target := string(pin.TargetKind) + ":" + pin.TargetID
				if pin.OwnerID != owner || idgen.Validate(pin.ID) != nil || !pin.TargetKind.Valid() || ids[pin.ID] || targets[target] {
					return fmt.Errorf("file pin identity invariant")
				}
				ids[pin.ID] = true
				targets[target] = true
				pins[index].Position = index
			}
			if revision == 0 {
				if err := db.Create(&navigationState{OwnerID: owner, Revision: 1}).Error; err != nil {
					return err
				}
			} else {
				updated := db.Model(&navigationState{}).Where("owner_id = ? AND revision = ?", owner, revision).Update("revision", revision+1)
				if updated.Error != nil {
					return updated.Error
				}
				if updated.RowsAffected != 1 {
					return model.ErrConflict
				}
			}
			if err := db.Where("owner_id = ?", owner).Delete(&pinRecord{}).Error; err != nil {
				return err
			}
			for _, pin := range pins {
				record := pinRecord(pin)
				if err := db.Create(&record).Error; err != nil {
					return err
				}
			}
			result = snapshot
			result.Revision = revision + 1
			result.Pins = pins
			return nil
		})
	})
	return result, err
}
func (r *Navigation) CreateShortcut(ctx context.Context, owner string, change func([]model.Entry) (model.Entry, error)) (model.Entry, error) {
	if owner == "" || change == nil {
		return model.Entry{}, model.ErrInvalid
	}
	var result model.Entry
	err := r.access.WithinTx(ctx, func(ctx context.Context, _ database.Client, tx database.Tx) error {
		return database.UseGORMTx(ctx, tx, func(db *gorm.DB) error {
			if err := r.lockOwner(db, owner); err != nil {
				return err
			}
			entries, err := loadBoundedEntries(db, owner, r.treeLimit)
			if err != nil {
				return err
			}
			entry, err := change(entries)
			if err != nil {
				return err
			}
			if entry.Kind != model.Shortcut || entry.ObjectKey != "" || entry.SizeBytes != 0 || entry.ShareToken == "" {
				return fmt.Errorf("file shortcut content invariant")
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

// PurgeShortcut 只移除已回收引用，不递归、不删除对象或原分享。
func (r *Navigation) PurgeShortcut(ctx context.Context, owner, id string, revision int64) error {
	if owner == "" || idgen.Validate(id) != nil || revision < 1 {
		return model.ErrInvalid
	}
	return r.access.WithinTx(ctx, func(ctx context.Context, _ database.Client, tx database.Tx) error {
		return database.UseGORMTx(ctx, tx, func(db *gorm.DB) error {
			if err := r.lockOwner(db, owner); err != nil {
				return err
			}
			var entry entryRecord
			if err := db.First(&entry, "owner_id = ? AND id = ?", owner, id).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return model.ErrMissing
				}
				return err
			}
			if entry.Kind != model.Shortcut || entry.TrashedAt == nil {
				return model.ErrConflict
			}
			if entry.ContentRevision != revision {
				return model.ErrConflict
			}
			deleted := db.Where("owner_id = ? AND id = ? AND content_revision = ? AND kind = ? AND trashed_at IS NOT NULL", owner, id, revision, model.Shortcut).Delete(&entryRecord{})
			if deleted.Error != nil {
				return deleted.Error
			}
			if deleted.RowsAffected != 1 {
				return model.ErrConflict
			}
			pins := db.Where("owner_id = ? AND target_kind = ? AND target_id = ?", owner, model.PinShortcut, id).Delete(&pinRecord{})
			if pins.Error != nil {
				return pins.Error
			}
			if pins.RowsAffected > 0 {
				updated := db.Model(&navigationState{}).Where("owner_id = ? AND revision < ?", owner, int64(math.MaxInt64)).Update("revision", gorm.Expr("revision + 1"))
				if updated.Error != nil {
					return updated.Error
				}
				if updated.RowsAffected != 1 {
					return fmt.Errorf("file pin cleanup revision invariant")
				}
			}
			return nil
		})
	})
}

var _ service.NavigationRepository = (*Navigation)(nil)
