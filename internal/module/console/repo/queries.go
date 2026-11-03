package repo

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/reina0721/clouddrive/internal/module/console/model"
	"github.com/reina0721/clouddrive/pkg/database"
	"github.com/reina0721/clouddrive/pkg/idgen"
	"gorm.io/gorm"
	"strconv"
	"time"
)

type NotificationQuery = model.NotificationQuery

func (s *Store) Notification(ctx context.Context, owner, id string) (model.Notification, error) {
	var value model.Notification
	err := s.use(ctx, func(db *gorm.DB) error {
		return db.Table("console_notifications").Where("id = ? AND owner_id = ?", id, owner).First(&value).Error
	})
	return value, err
}
func (s *Store) Notifications(ctx context.Context, owner string, filter NotificationQuery) ([]model.Notification, int64, int64, error) {
	items := []model.Notification{}
	var total, unread int64
	err := s.use(ctx, func(db *gorm.DB) error {
		if err := db.Table("console_notifications").Where("owner_id = ?", owner).Where(map[string]any{"read": false}).Count(&unread).Error; err != nil {
			return err
		}
		q := db.Table("console_notifications").Where("owner_id = ?", owner)
		if filter.Query != "" {
			q = q.Where("object_name LIKE ?", "%"+filter.Query+"%")
		}
		if filter.Category != "" && filter.Category != "all" {
			q = q.Where("category = ?", filter.Category)
		}
		if filter.Read == "read" || filter.Read == "unread" {
			q = q.Where(map[string]any{"read": filter.Read == "read"})
		}
		if err := q.Count(&total).Error; err != nil {
			return err
		}
		return q.Order("created_at DESC").Offset(filter.Offset).Limit(filter.Limit).Find(&items).Error
	})
	return items, total, unread, err
}
func (s *Store) ReadNotifications(ctx context.Context, owner string, ids []string, all bool) error {
	return s.transaction(ctx, func(db *gorm.DB) error {
		q := db.Table("console_notifications").Where("owner_id = ?", owner)
		if !all {
			q = q.Where("id IN ?", ids)
			var count int64
			if err := q.Count(&count).Error; err != nil {
				return err
			}
			if count != int64(len(ids)) {
				return database.ErrNotFound
			}
		}
		update := db.Table("console_notifications").Where("owner_id = ?", owner)
		if !all {
			update = update.Where("id IN ?", ids)
		}
		return update.Update("read", true).Error
	})
}

type EventQuery = model.EventQuery

func (s *Store) Event(ctx context.Context, id string) (model.Event, error) {
	var value model.Event
	err := s.use(ctx, func(db *gorm.DB) error { return db.Table("console_events").Where("id = ?", id).First(&value).Error })
	return value, err
}
func (s *Store) Events(ctx context.Context, filter EventQuery) ([]model.Event, int64, error) {
	items := []model.Event{}
	var total int64
	err := s.use(ctx, func(db *gorm.DB) error {
		q := db.Table("console_events")
		if filter.Operation != "" && filter.Operation != "all" {
			q = q.Where("operation = ?", filter.Operation)
		}
		if filter.Result != "" && filter.Result != "all" {
			q = q.Where("result = ?", filter.Result)
		}
		if filter.Query != "" {
			like := "%" + filter.Query + "%"
			q = q.Where("(actor_name LIKE ? OR object_name LIKE ? OR operation LIKE ?)", like, like, like)
		}
		if filter.Actor != "" {
			q = q.Where("actor_id = ?", filter.Actor)
		}
		if filter.Object != "" {
			q = q.Where("object_id = ?", filter.Object)
		}
		if filter.From != nil {
			q = q.Where("created_at >= ?", *filter.From)
		}
		if filter.To != nil {
			q = q.Where("created_at <= ?", *filter.To)
		}
		if err := q.Count(&total).Error; err != nil {
			return err
		}
		return q.Order("created_at DESC").Offset(filter.Offset).Limit(filter.Limit).Find(&items).Error
	})
	return items, total, err
}

type DailyCount = model.DailyCount

func (s *Store) DailyCounts(ctx context.Context, owner string, start time.Time, days int) ([]DailyCount, error) {
	items := []DailyCount{}
	err := s.use(ctx, func(db *gorm.DB) error {
		for i := 0; i < days; i++ {
			day := start.AddDate(0, 0, i)
			q := db.Table("console_events").Where("created_at >= ? AND created_at < ?", day, day.AddDate(0, 0, 1))
			if owner != "" {
				q = q.Where("actor_id = ?", owner)
			}
			var count int64
			if err := q.Count(&count).Error; err != nil {
				return err
			}
			items = append(items, DailyCount{Time: day.UnixMilli(), Count: count})
		}
		return nil
	})
	return items, err
}

func (s *Store) Dictionaries(ctx context.Context) ([]model.Dictionary, []model.DictionaryItem, error) {
	types := []model.Dictionary{}
	items := []model.DictionaryItem{}
	err := s.use(ctx, func(db *gorm.DB) error {
		if err := db.Table("console_dictionaries").Order("code").Find(&types).Error; err != nil {
			return err
		}
		return db.Table("console_dictionary_items").Order("sort_order").Find(&items).Error
	})
	return types, items, err
}
func (s *Store) SaveDictionary(ctx context.Context, id string, input model.Dictionary) error {
	if id == "" {
		generated, err := idgen.UUID().New()
		if err != nil {
			return err
		}
		input.ID = generated
		input.Version = 1
		input.UpdatedAt = time.Now().UnixMilli()
		return s.use(ctx, func(db *gorm.DB) error { return db.Table("console_dictionaries").Create(&input).Error })
	}
	return s.use(ctx, func(db *gorm.DB) error {
		result := db.Table("console_dictionaries").Where("id = ? AND version = ?", id, input.Version).Updates(map[string]any{"name": input.Name, "code": input.Code, "status": input.Status, "remark": input.Remark, "version": input.Version + 1, "updated_at": time.Now().UnixMilli()})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return database.ErrOptimisticConflict
		}
		return nil
	})
}
func (s *Store) DeleteDictionary(ctx context.Context, id string, version uint64) error {
	return s.transaction(ctx, func(db *gorm.DB) error {
		var count int64
		if err := db.Table("console_dictionary_items").Where("type_id = ?", id).Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return database.ErrOptimisticConflict
		}
		result := db.Table("console_dictionaries").Where("id = ? AND version = ?", id, version).Delete(&model.Dictionary{})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return database.ErrOptimisticConflict
		}
		return nil
	})
}
func (s *Store) SaveDictionaryItem(ctx context.Context, parent, id string, input model.DictionaryItem) error {
	if id == "" {
		generated, err := idgen.UUID().New()
		if err != nil {
			return err
		}
		input.ID = generated
		input.TypeID = parent
		input.Version = 1
		return s.transaction(ctx, func(db *gorm.DB) error {
			var dictionary model.Dictionary
			if err := db.Table("console_dictionaries").Where("id = ?", parent).First(&dictionary).Error; err != nil {
				return err
			}
			return db.Table("console_dictionary_items").Create(&input).Error
		})
	}
	return s.use(ctx, func(db *gorm.DB) error {
		result := db.Table("console_dictionary_items").Where("id = ? AND version = ?", id, input.Version).Updates(map[string]any{"label": input.Label, "value": input.Value, "sort_order": input.Order, "status": input.Status, "tone": input.Tone, "version": input.Version + 1})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return database.ErrOptimisticConflict
		}
		return nil
	})
}
func (s *Store) DeleteDictionaryItem(ctx context.Context, id string, version uint64) error {
	return s.use(ctx, func(db *gorm.DB) error {
		result := db.Table("console_dictionary_items").Where("id = ? AND version = ?", id, version).Delete(&model.DictionaryItem{})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return database.ErrOptimisticConflict
		}
		return nil
	})
}

func (s *Store) Tasks(ctx context.Context, owner string) ([]model.TaskRecord, error) {
	records := []model.TaskRecord{}
	err := s.use(ctx, func(db *gorm.DB) error {
		return db.Table("console_tasks").Where("owner_id = ?", owner).Order("id").Find(&records).Error
	})
	return records, err
}
func (s *Store) DeleteTask(ctx context.Context, owner, id, expected string) error {
	version, err := strconv.ParseUint(expected, 10, 64)
	if err != nil || version == 0 {
		return database.ErrOptimisticConflict
	}
	return s.transaction(ctx, func(db *gorm.DB) error {
		var existing model.TaskRecord
		if err := db.Table("console_tasks").Where("id = ? AND owner_id = ?", id, owner).First(&existing).Error; err != nil {
			return err
		}
		if existing.Version != version {
			return database.ErrOptimisticConflict
		}
		result := db.Table("console_tasks").Where("id = ? AND owner_id = ? AND version = ?", id, owner, version).Delete(&model.TaskRecord{})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return database.ErrOptimisticConflict
		}
		return nil
	})
}
func (s *Store) UpsertTask(ctx context.Context, input model.TaskRecord) error {
	return s.transaction(ctx, func(db *gorm.DB) error {
		var existing model.TaskRecord
		err := db.Table("console_tasks").Where("id = ?", input.ID).First(&existing).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			if input.Version != 0 {
				return database.ErrOptimisticConflict
			}
			input.Version = 1
			return db.Table("console_tasks").Create(&input).Error
		}
		if err != nil {
			return err
		}
		if existing.OwnerID != input.OwnerID {
			return database.ErrNotFound
		}
		if input.Version != existing.Version {
			return database.ErrOptimisticConflict
		}
		var prior, next model.TaskDefinition
		if err = json.Unmarshal([]byte(existing.Definition), &prior); err != nil {
			return err
		}
		if err = json.Unmarshal([]byte(input.Definition), &next); err != nil {
			return err
		}
		next.LastRun = prior.LastRun
		encoded, err := json.Marshal(next)
		if err != nil {
			return err
		}
		input.Definition = string(encoded)
		result := db.Table("console_tasks").Where("id = ? AND owner_id = ? AND version = ?", input.ID, input.OwnerID, existing.Version).Updates(map[string]any{"definition": input.Definition, "next_run_at": input.NextRunAt, "version": existing.Version + 1, "updated_at": input.UpdatedAt})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return database.ErrOptimisticConflict
		}
		return nil
	})
}
func (s *Store) DueTasks(ctx context.Context, now time.Time, limit int) ([]model.TaskRecord, error) {
	records := []model.TaskRecord{}
	err := s.use(ctx, func(db *gorm.DB) error {
		return db.Table("console_tasks").Where("next_run_at IS NOT NULL AND next_run_at <= ?", now).Order("next_run_at").Limit(limit).Find(&records).Error
	})
	return records, err
}
func (s *Store) ClaimTask(ctx context.Context, id string, version uint64, now, next time.Time) (bool, error) {
	claimed := false
	err := s.use(ctx, func(db *gorm.DB) error {
		result := db.Table("console_tasks").Where("id = ? AND version = ? AND next_run_at <= ?", id, version, now).Updates(map[string]any{"next_run_at": next, "version": version + 1})
		claimed = result.RowsAffected == 1
		return result.Error
	})
	return claimed, err
}
func (s *Store) TaskResult(ctx context.Context, id string, version uint64, definition string) error {
	return s.use(ctx, func(db *gorm.DB) error {
		return db.Table("console_tasks").Where("id = ? AND version = ?", id, version).Updates(map[string]any{"definition": definition, "updated_at": time.Now().UTC()}).Error
	})
}
