package repo

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/database"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const inventoryShareExists = "EXISTS (SELECT 1 FROM files_shares AS sharing WHERE sharing.root_id = inventory.id AND sharing.owner_id = inventory.owner_id AND sharing.revoked_at IS NULL)"
const inventoryDirectLinkExists = "EXISTS (SELECT 1 FROM files_direct_links AS direct WHERE direct.entry_id = inventory.id AND direct.owner_id = inventory.owner_id)"
const inventoryProjection = "inventory.id, inventory.owner_id, inventory.parent_id, inventory.kind, inventory.name, inventory.size_bytes, inventory.content_revision, inventory.history_revision, inventory.history_json, inventory.created_at, inventory.updated_at, inventory.trashed_at, inventory.trash_expires_at, " +
	"CASE WHEN " + inventoryShareExists + " THEN 1 ELSE 0 END AS has_share, " +
	"CASE WHEN " + inventoryDirectLinkExists + " THEN 1 ELSE 0 END AS has_direct_link"

type inventoryRecord struct {
	ID              string
	OwnerID         string
	ParentID        string
	Kind            model.Kind
	Name            string
	SizeBytes       int64
	ContentRevision int64
	HistoryRevision int64
	HistoryJSON     string
	CreatedAt       time.Time
	UpdatedAt       time.Time
	TrashedAt       *time.Time
	TrashExpiresAt  *time.Time
	HasShare        int
	HasDirectLink   int
}

func (record inventoryRecord) item() (service.InventoryItem, error) {
	entry := model.Entry{Kind: record.Kind, ContentRevision: record.ContentRevision, HistoryRevision: record.HistoryRevision}
	if len(record.HistoryJSON) > model.MaxHistoryJSONBytes {
		return service.InventoryItem{}, model.ErrHistoryFull
	}
	if err := json.Unmarshal([]byte(record.HistoryJSON), &entry.History); err != nil {
		return service.InventoryItem{}, fmt.Errorf("decode inventory history: %w", err)
	}
	if entry.History == nil {
		return service.InventoryItem{}, fmt.Errorf("inventory history must be an array")
	}
	if err := model.ValidateHistory(entry); err != nil {
		return service.InventoryItem{}, fmt.Errorf("invalid inventory history: %w", err)
	}
	return service.InventoryItem{
		ID: record.ID, OwnerID: record.OwnerID, ParentID: record.ParentID, Kind: record.Kind, Name: record.Name,
		SizeBytes: record.SizeBytes, QuotaBytes: record.SizeBytes + model.HistoryBytes(entry),
		Revision: record.ContentRevision, HistoryCount: len(entry.History), CreatedAt: record.CreatedAt,
		UpdatedAt: record.UpdatedAt, TrashedAt: record.TrashedAt, ExpiresAt: record.TrashExpiresAt,
		HasShare: record.HasShare != 0, HasDirectLink: record.HasDirectLink != 0,
	}, nil
}

func inventoryQuery(db *gorm.DB, query service.InventoryQuery) *gorm.DB {
	base := db.Table("files_entries AS inventory")
	if query.OwnerID != "" {
		base = base.Where("inventory.owner_id = ?", query.OwnerID)
	}
	if query.Name != "" {
		needle := "%" + strings.NewReplacer("!", "!!", "%", "!%", "_", "!_").Replace(query.Name) + "%"
		base = base.Where("(inventory.normalized_name LIKE ? ESCAPE '!' OR LOWER(inventory.normalized_name) LIKE ? ESCAPE '!')", needle, strings.ToLower(needle))
	}
	if query.Kind != "" {
		base = base.Where("inventory.kind = ?", query.Kind)
	}
	switch query.Trash {
	case service.InventoryTrashDirect:
		base = base.Where("inventory.trashed_at IS NOT NULL")
	case service.InventoryTrashUnmarked:
		base = base.Where("inventory.trashed_at IS NULL")
	}
	if query.HasShare {
		base = base.Where(inventoryShareExists)
	}
	if query.HasDirectLink {
		base = base.Where(inventoryDirectLinkExists)
	}
	return base
}

func inventoryOrder(query service.InventoryQuery) (clause.OrderByColumn, error) {
	var column string
	switch query.Sort {
	case service.InventoryByID:
		column = "id"
	case service.InventoryByName:
		column = "normalized_name"
	case service.InventoryBySize:
		column = "size_bytes"
	case service.InventoryByCreated:
		column = "created_at"
	default:
		return clause.OrderByColumn{}, model.ErrInvalid
	}
	return clause.OrderByColumn{Column: clause.Column{Table: "inventory", Name: column}, Desc: query.Direction == service.InventoryDescending}, nil
}

func (r *Repository) QueryInventory(ctx context.Context, query service.InventoryQuery) (service.InventoryPage, error) {
	page := service.InventoryPage{Items: []service.InventoryItem{}, Page: query.Page, PageSize: service.InventoryPageSize}
	order, err := inventoryOrder(query)
	if err != nil {
		return service.InventoryPage{}, err
	}
	err = r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			if err := r.checkStorage(db); err != nil {
				return err
			}
			base := inventoryQuery(db, query)
			if err := base.Session(&gorm.Session{}).Count(&page.Total).Error; err != nil || page.Total == 0 {
				return err
			}
			var records []inventoryRecord
			query := base.Select(inventoryProjection).Order(order)
			if order.Column.Name != "id" {
				query = query.Order("inventory.id ASC")
			}
			if err := query.Offset((page.Page - 1) * page.PageSize).Limit(page.PageSize).Find(&records).Error; err != nil {
				return err
			}
			for _, record := range records {
				item, err := record.item()
				if err != nil {
					return err
				}
				page.Items = append(page.Items, item)
			}
			return nil
		})
	})
	if err != nil {
		return service.InventoryPage{}, err
	}
	return page, nil
}

func (r *Repository) ReadInventory(ctx context.Context, id string) (service.InventoryItem, error) {
	var record inventoryRecord
	err := r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			if err := r.checkStorage(db); err != nil {
				return err
			}
			result := db.Table("files_entries AS inventory").Select(inventoryProjection).Where("inventory.id = ?", id).Limit(1).Find(&record)
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected != 1 {
				return model.ErrMissing
			}
			return nil
		})
	})
	if err != nil {
		return service.InventoryItem{}, err
	}
	return record.item()
}
