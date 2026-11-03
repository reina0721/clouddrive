// Package repo 实现 Navigation 对项目数据库契约的窄适配。
package repo

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/reina0721/clouddrive/pkg/database"
	"gorm.io/gorm"
)

const policyTable = "navigation_menu_policies"

type Access interface {
	Use(context.Context, func(database.Client) error) error
	WithinTx(context.Context, func(context.Context, database.Client, database.Tx) error) error
}

type PolicyRecord struct {
	Label                  string
	PresentationPermission string
	NavigationID           string
	Enabled                bool
	ParentOverride         *string
	OrderOverride          *int
	CatalogRevision        string
	Version                uint64
	UpdatedAt              time.Time
}

type Store struct{ access Access }
type Unit struct {
	client database.Client
	tx     database.Tx
}

func New(access Access) (*Store, error) {
	if access == nil {
		return nil, fmt.Errorf("navigation database access is nil")
	}
	return &Store{access: access}, nil
}
func (store *Store) Use(ctx context.Context, use func(*Unit) error) error {
	return store.access.Use(ctx, func(client database.Client) error {
		unit, err := newUnit(client, nil)
		if err != nil {
			return err
		}
		return use(unit)
	})
}
func (store *Store) WithinTx(ctx context.Context, use func(context.Context, *Unit) error) error {
	return store.access.WithinTx(ctx, func(txCtx context.Context, client database.Client, tx database.Tx) error {
		unit, err := newUnit(client, tx)
		if err != nil {
			return err
		}
		return use(txCtx, unit)
	})
}

func newUnit(client database.Client, tx database.Tx) (*Unit, error) {
	if client == nil {
		return nil, database.ErrClientUnavailable
	}
	return &Unit{client: client, tx: tx}, nil
}

func (unit *Unit) useDB(ctx context.Context, use func(*gorm.DB) error) error {
	if unit.tx != nil {
		return database.UseGORMTx(ctx, unit.tx, use)
	}
	return database.UseGORM(ctx, unit.client, use)
}

func (unit *Unit) List(ctx context.Context) ([]PolicyRecord, error) {
	var records []PolicyRecord
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		return db.Table(policyTable).Order("navigation_id ASC").Find(&records).Error
	})
	return records, err
}
func (unit *Unit) ByID(ctx context.Context, id string) (PolicyRecord, error) {
	var record PolicyRecord
	err := unit.useDB(ctx, func(db *gorm.DB) error {
		return db.Table(policyTable).Where("navigation_id = ?", id).First(&record).Error
	})
	return record, err
}
func (unit *Unit) Create(ctx context.Context, record *PolicyRecord) error {
	record.Version = 1
	return unit.useDB(ctx, func(db *gorm.DB) error {
		return db.Table(policyTable).Create(record).Error
	})
}
func (unit *Unit) Update(ctx context.Context, record PolicyRecord, version uint64) error {
	return unit.useDB(ctx, func(db *gorm.DB) error {
		result := db.Table(policyTable).
			Where("navigation_id = ? AND version = ?", record.NavigationID, version).
			Updates(map[string]any{
				"enabled":                 record.Enabled,
				"label":                   record.Label,
				"presentation_permission": record.PresentationPermission,
				"parent_override":         record.ParentOverride,
				"order_override":          record.OrderOverride,
				"catalog_revision":        record.CatalogRevision,
				"updated_at":              record.UpdatedAt,
				"version":                 gorm.Expr("version + 1"),
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return database.ErrOptimisticConflict
		}
		return nil
	})
}
func IsNotFound(err error) bool { return errors.Is(err, database.ErrNotFound) }
func IsConflict(err error) bool { return errors.Is(err, database.ErrOptimisticConflict) }
