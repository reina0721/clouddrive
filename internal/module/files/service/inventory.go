package service

import (
	"context"
	"fmt"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

const (
	InventoryPageSize = 20
	MaxInventoryPage  = 10000
)

type InventorySort string
type InventoryDirection string
type InventoryTrash string

const (
	InventoryByID      InventorySort = "id"
	InventoryByName    InventorySort = "name"
	InventoryBySize    InventorySort = "size"
	InventoryByCreated InventorySort = "created"

	InventoryAscending  InventoryDirection = "asc"
	InventoryDescending InventoryDirection = "desc"

	InventoryTrashAny      InventoryTrash = "any"
	InventoryTrashDirect   InventoryTrash = "direct"
	InventoryTrashUnmarked InventoryTrash = "unmarked"
)

type InventoryQuery struct {
	OwnerID       string
	Name          string
	Kind          model.Kind
	Trash         InventoryTrash
	HasShare      bool
	HasDirectLink bool
	Sort          InventorySort
	Direction     InventoryDirection
	Page          int
}

// InventoryItem 只包含管理清单可披露的元数据，逻辑占用包含当前内容及历史。
type InventoryItem struct {
	ID            string     `json:"id"`
	OwnerID       string     `json:"ownerId"`
	ParentID      string     `json:"parentId"`
	Kind          model.Kind `json:"kind" enum:"file,folder,shortcut"`
	Name          string     `json:"name"`
	SizeBytes     int64      `json:"sizeBytes"`
	QuotaBytes    int64      `json:"quotaBytes"`
	Revision      int64      `json:"revision"`
	HistoryCount  int        `json:"historyCount"`
	CreatedAt     time.Time  `json:"createdAt"`
	UpdatedAt     time.Time  `json:"updatedAt"`
	TrashedAt     *time.Time `json:"trashedAt"`
	ExpiresAt     *time.Time `json:"expiresAt"`
	HasShare      bool       `json:"hasShare"`
	HasDirectLink bool       `json:"hasDirectLink"`
}

type InventoryPage struct {
	Items    []InventoryItem `json:"items"`
	Total    int64           `json:"total"`
	Page     int             `json:"page"`
	PageSize int             `json:"pageSize"`
}

type InventoryRepository interface {
	QueryInventory(context.Context, InventoryQuery) (InventoryPage, error)
	ReadInventory(context.Context, string) (InventoryItem, error)
}

type Inventory struct {
	store InventoryRepository
	names NameNormalizer
}

func NewInventory(store InventoryRepository, names NameNormalizer) (*Inventory, error) {
	if store == nil || names == nil {
		return nil, fmt.Errorf("file inventory dependencies are required")
	}
	return &Inventory{store: store, names: names}, nil
}

func (s *Inventory) List(ctx context.Context, query InventoryQuery) (InventoryPage, error) {
	if !validInventoryText(query.OwnerID, 128) || !validInventoryText(query.Name, model.MaxNameRunes) ||
		query.Page < 1 || query.Page > MaxInventoryPage ||
		(query.Direction != InventoryAscending && query.Direction != InventoryDescending) {
		return InventoryPage{}, model.ErrInvalid
	}
	switch query.Kind {
	case "", model.File, model.Folder, model.Shortcut:
	default:
		return InventoryPage{}, model.ErrInvalid
	}
	switch query.Trash {
	case InventoryTrashAny, InventoryTrashDirect, InventoryTrashUnmarked:
	default:
		return InventoryPage{}, model.ErrInvalid
	}
	switch query.Sort {
	case InventoryByID, InventoryByName, InventoryBySize, InventoryByCreated:
	default:
		return InventoryPage{}, model.ErrInvalid
	}
	query.OwnerID = strings.TrimSpace(query.OwnerID)
	query.Name = s.names.Normalize(strings.TrimSpace(query.Name))
	return s.store.QueryInventory(ctx, query)
}

func (s *Inventory) Read(ctx context.Context, id string) (InventoryItem, error) {
	if model.ValidateTransferID(id) != nil {
		return InventoryItem{}, model.ErrMissing
	}
	return s.store.ReadInventory(ctx, id)
}

func validInventoryText(value string, maxRunes int) bool {
	return utf8.ValidString(value) && utf8.RuneCountInString(value) <= maxRunes && strings.IndexFunc(value, unicode.IsControl) < 0
}
