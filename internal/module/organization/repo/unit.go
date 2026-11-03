package repo

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/reina0721/clouddrive/pkg/database"
	"gorm.io/gorm"
)

var ErrNotFound = database.ErrNotFound

func IsNotFound(err error) bool  { return errors.Is(err, database.ErrNotFound) }
func IsDuplicate(err error) bool { return errors.Is(err, database.ErrDuplicateKey) }
func IsConflict(err error) bool  { return errors.Is(err, database.ErrOptimisticConflict) }

type DepartmentChanges struct {
	Leader, Remark   *string
	Name             *string
	ParentID         **string
	Active, Archived *bool
	UpdatedAt        time.Time
}
type PositionChanges struct {
	Name             *string
	Active, Archived *bool
	UpdatedAt        time.Time
}

func (unit *Unit) CreateDepartment(ctx context.Context, value *DepartmentRecord) error {
	value.Version = 1
	return unit.useDB(ctx, func(db *gorm.DB) error { return db.Table(departmentTable).Create(value).Error })
}

func (unit *Unit) DepartmentByID(ctx context.Context, id string) (DepartmentRecord, error) {
	var record DepartmentRecord
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		if err := db.Table(departmentTable).Where("id = ?", id).First(&record).Error; err != nil {
			return err
		}
		return db.Table(accountDepartmentTable).Where("department_id = ? AND assigned = ?", id, true).Count(&record.MemberCount).Error
	})
	return record, err
}

func (unit *Unit) ListDepartments(ctx context.Context, offset, limit int, activeOnly bool, query string) ([]DepartmentRecord, int64, error) {
	var records []DepartmentRecord
	var total int64
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		q := db.Table(departmentTable)
		if activeOnly {
			q = q.Where("active = ? AND archived = ?", true, false)
		}
		if strings.TrimSpace(query) != "" {
			like := "%" + strings.TrimSpace(query) + "%"
			q = q.Where("(code LIKE ? OR name LIKE ?)", like, like)
		}
		if err := q.Count(&total).Error; err != nil {
			return err
		}
		if err := q.Order("code ASC").Offset(offset).Limit(limit).Find(&records).Error; err != nil {
			return err
		}
		for i := range records {
			if err := db.Table(accountDepartmentTable).Where("department_id = ? AND assigned = ?", records[i].ID, true).Count(&records[i].MemberCount).Error; err != nil {
				return err
			}
		}
		return nil
	})
	return records, total, err
}

func (unit *Unit) AllDepartments(ctx context.Context) ([]DepartmentRecord, error) {
	var records []DepartmentRecord
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		if err := db.Table(departmentTable).Order("code ASC").Find(&records).Error; err != nil {
			return err
		}
		for i := range records {
			if err := db.Table(accountDepartmentTable).Where("department_id = ? AND assigned = ?", records[i].ID, true).Count(&records[i].MemberCount).Error; err != nil {
				return err
			}
		}
		return nil
	})
	return records, err
}

func (unit *Unit) UpdateDepartment(ctx context.Context, id string, version uint64, changes DepartmentChanges) error {
	values := map[string]any{"updated_at": changes.UpdatedAt, "version": gorm.Expr("version + 1")}
	if changes.Leader != nil {
		values["leader"] = *changes.Leader
	}
	if changes.Remark != nil {
		values["remark"] = *changes.Remark
	}
	if changes.Name != nil {
		values["name"] = *changes.Name
	}
	if changes.ParentID != nil {
		values["parent_id"] = *changes.ParentID
	}
	if changes.Active != nil {
		values["active"] = *changes.Active
	}
	if changes.Archived != nil {
		values["archived"] = *changes.Archived
	}
	return unit.updateVersioned(ctx, departmentTable, "id = ? AND version = ?", []any{id, version}, values)
}

func (unit *Unit) CountActiveChildren(ctx context.Context, id string) (int64, error) {
	return unit.count(ctx, departmentTable, "parent_id = ? AND archived = ?", id, false)
}

func (unit *Unit) CountDepartmentAssignments(ctx context.Context, id string) (int64, error) {
	return unit.count(ctx, accountDepartmentTable, "department_id = ? AND assigned = ?", id, true)
}

func (unit *Unit) CreatePosition(ctx context.Context, value *PositionRecord) error {
	value.Version = 1
	return unit.useDB(ctx, func(db *gorm.DB) error { return db.Table(positionTable).Create(value).Error })
}

func (unit *Unit) PositionByID(ctx context.Context, id string) (PositionRecord, error) {
	var record PositionRecord
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		return db.Table(positionTable).Where("id = ?", id).First(&record).Error
	})
	return record, err
}

func (unit *Unit) ListPositions(ctx context.Context, offset, limit int, activeOnly bool, query string) ([]PositionRecord, int64, error) {
	var records []PositionRecord
	var total int64
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		q := db.Table(positionTable)
		if activeOnly {
			q = q.Where("active = ? AND archived = ?", true, false)
		}
		if strings.TrimSpace(query) != "" {
			like := "%" + strings.TrimSpace(query) + "%"
			q = q.Where("(code LIKE ? OR name LIKE ?)", like, like)
		}
		if err := q.Count(&total).Error; err != nil {
			return err
		}
		return q.Order("code ASC").Offset(offset).Limit(limit).Find(&records).Error
	})
	return records, total, err
}

func (unit *Unit) UpdatePosition(ctx context.Context, id string, version uint64, changes PositionChanges) error {
	values := map[string]any{"updated_at": changes.UpdatedAt, "version": gorm.Expr("version + 1")}
	if changes.Name != nil {
		values["name"] = *changes.Name
	}
	if changes.Active != nil {
		values["active"] = *changes.Active
	}
	if changes.Archived != nil {
		values["archived"] = *changes.Archived
	}
	return unit.updateVersioned(ctx, positionTable, "id = ? AND version = ?", []any{id, version}, values)
}

func (unit *Unit) CountPositionAssignments(ctx context.Context, id string) (int64, error) {
	return unit.count(ctx, accountPositionTable, "position_id = ? AND assigned = ?", id, true)
}

func (unit *Unit) AccountDepartment(ctx context.Context, accountID string) (AccountDepartmentRecord, error) {
	var record AccountDepartmentRecord
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		return db.Table(accountDepartmentTable).Where("account_id = ? AND assigned = ?", accountID, true).First(&record).Error
	})
	return record, err
}

func (unit *Unit) ReplaceAccountDepartment(ctx context.Context, accountID string, expectedVersion uint64, departmentID *string, now time.Time) error {
	var existing AccountDepartmentRecord
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		return db.Table(accountDepartmentTable).Where("account_id = ?", accountID).First(&existing).Error
	})
	if err == nil {
		if existing.Version != expectedVersion {
			return database.ErrOptimisticConflict
		}
		values := map[string]any{"assigned": departmentID != nil, "version": gorm.Expr("version + 1"), "updated_at": now}
		if departmentID != nil {
			values["department_id"] = *departmentID
		}
		return unit.update(ctx, accountDepartmentTable, "account_id = ? AND version = ?", []any{accountID, expectedVersion}, values)
	}
	if !IsNotFound(err) || departmentID == nil {
		return nilIfNotFound(err)
	}
	if expectedVersion != 0 {
		return database.ErrOptimisticConflict
	}
	return unit.useDB(ctx, func(db *gorm.DB) error {
		return db.Table(accountDepartmentTable).Create(&AccountDepartmentRecord{AccountID: accountID, DepartmentID: *departmentID, Assigned: true, Version: 1, UpdatedAt: now}).Error
	})
}

func (unit *Unit) ListAccountPositions(ctx context.Context, accountID string, assignedOnly bool) ([]AccountPositionRecord, error) {
	var records []AccountPositionRecord
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		query := db.Table(accountPositionTable).Where("account_id = ?", accountID)
		if assignedOnly {
			query = query.Where("assigned = ?", true)
		}
		return query.Order("position_id ASC").Find(&records).Error
	})
	return records, err
}

func (unit *Unit) SetAccountPosition(ctx context.Context, accountID, positionID string, assigned bool, now time.Time) error {
	var existing AccountPositionRecord
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		return db.Table(accountPositionTable).Where("account_id = ? AND position_id = ?", accountID, positionID).First(&existing).Error
	})
	if IsNotFound(err) && assigned {
		return unit.useDB(ctx, func(db *gorm.DB) error {
			return db.Table(accountPositionTable).Create(&AccountPositionRecord{AccountID: accountID, PositionID: positionID, Assigned: true, UpdatedAt: now}).Error
		})
	}
	if IsNotFound(err) && !assigned {
		return nil
	}
	if err != nil {
		return err
	}
	return unit.update(ctx, accountPositionTable, "account_id = ? AND position_id = ?", []any{accountID, positionID}, map[string]any{"assigned": assigned, "updated_at": now})
}

func (unit *Unit) count(ctx context.Context, table, condition string, arguments ...any) (int64, error) {
	var count int64
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		return db.Table(table).Where(condition, arguments...).Count(&count).Error
	})
	return count, err
}

func (unit *Unit) update(ctx context.Context, table, condition string, arguments []any, values map[string]any) error {
	return unit.useDB(ctx, func(db *gorm.DB) error {
		return db.Table(table).Where(condition, arguments...).Updates(values).Error
	})
}

func (unit *Unit) updateVersioned(ctx context.Context, table, condition string, arguments []any, values map[string]any) error {
	return unit.useDB(ctx, func(db *gorm.DB) error {
		result := db.Table(table).Where(condition, arguments...).Updates(values)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return database.ErrOptimisticConflict
		}
		return nil
	})
}

func nilIfNotFound(err error) error {
	if IsNotFound(err) {
		return nil
	}
	return err
}
