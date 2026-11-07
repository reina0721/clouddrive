package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

type BlobSort string
type BlobReferenceFilter string
type BlobStorage string

const (
	BlobByID         BlobSort = "id"
	BlobBySize       BlobSort = "size"
	BlobByReferences BlobSort = "references"
	BlobByFirstFile  BlobSort = "first-file"

	BlobAnyReference   BlobReferenceFilter = "any"
	BlobCurrent        BlobReferenceFilter = "current"
	BlobHistorical     BlobReferenceFilter = "history"
	BlobHistoricalOnly BlobReferenceFilter = "history-only"

	BlobAnyStorage         BlobStorage = "any"
	BlobPrimaryStorage     BlobStorage = "primary"
	publishedBlobKeyPrefix             = "files/"
)

// PublishedBlobID 将现有发布对象键转换为不含存储路径的管理标识。
func PublishedBlobID(key string) (string, error) {
	id, found := strings.CutPrefix(key, publishedBlobKeyPrefix)
	if !found || model.ValidateTransferID(id) != nil {
		return "", model.ErrInvalid
	}
	return id, nil
}

type BlobQuery struct {
	OwnerID   string
	Reference BlobReferenceFilter
	Storage   BlobStorage
	Sort      BlobSort
	Direction InventoryDirection
	Page      int
}

type BlobItem struct {
	ID               string      `json:"id"`
	Storage          BlobStorage `json:"storage" enum:"primary"`
	SizeBytes        int64       `json:"sizeBytes"`
	ReferenceCount   int64       `json:"referenceCount"`
	CurrentCount     int64       `json:"currentCount"`
	HistoryCount     int64       `json:"historyCount"`
	OwnerCount       int64       `json:"ownerCount"`
	FirstFileCreated time.Time   `json:"firstFileCreated"`
}

type BlobReference struct {
	FileID   string `json:"fileId"`
	OwnerID  string `json:"ownerId"`
	Name     string `json:"name"`
	Revision int64  `json:"revision"`
	Current  bool   `json:"current"`
	Trashed  bool   `json:"trashed"`
}

type BlobPage struct {
	Items    []BlobItem `json:"items"`
	Total    int64      `json:"total"`
	Page     int        `json:"page"`
	PageSize int        `json:"pageSize"`
}

type BlobDetail struct {
	Blob       BlobItem        `json:"blob"`
	References []BlobReference `json:"references"`
	Page       int             `json:"page"`
	PageSize   int             `json:"pageSize"`
	Exists     bool            `json:"exists"`
}

type BlobCatalogRepository interface {
	QueryBlobs(context.Context, BlobQuery) (BlobPage, error)
	ReadBlob(context.Context, string, int) (BlobDetail, error)
}

type BlobObjectProbe interface {
	Exists(context.Context, string) (bool, error)
}

type BlobCatalog struct {
	store BlobCatalogRepository
	probe BlobObjectProbe
}

func NewBlobCatalog(store BlobCatalogRepository, probe BlobObjectProbe) (*BlobCatalog, error) {
	if store == nil || probe == nil {
		return nil, fmt.Errorf("blob catalog dependencies are required")
	}
	return &BlobCatalog{store: store, probe: probe}, nil
}

func (s *BlobCatalog) List(ctx context.Context, query BlobQuery) (BlobPage, error) {
	if !validInventoryText(query.OwnerID, 128) || query.Page < 1 || query.Page > MaxInventoryPage ||
		(query.Storage != BlobAnyStorage && query.Storage != BlobPrimaryStorage) ||
		(query.Direction != InventoryAscending && query.Direction != InventoryDescending) {
		return BlobPage{}, model.ErrInvalid
	}
	switch query.Reference {
	case BlobAnyReference, BlobCurrent, BlobHistorical, BlobHistoricalOnly:
	default:
		return BlobPage{}, model.ErrInvalid
	}
	switch query.Sort {
	case BlobByID, BlobBySize, BlobByReferences, BlobByFirstFile:
	default:
		return BlobPage{}, model.ErrInvalid
	}
	query.OwnerID = strings.TrimSpace(query.OwnerID)
	return s.store.QueryBlobs(ctx, query)
}

func (s *BlobCatalog) Read(ctx context.Context, id string, page int) (BlobDetail, error) {
	if model.ValidateTransferID(id) != nil {
		return BlobDetail{}, model.ErrMissing
	}
	if page < 1 || page > MaxInventoryPage {
		return BlobDetail{}, model.ErrInvalid
	}
	key := publishedBlobKeyPrefix + id
	detail, err := s.store.ReadBlob(ctx, key, page)
	if err != nil {
		return BlobDetail{}, err
	}
	detail.Exists, err = s.probe.Exists(ctx, key)
	if err != nil {
		return BlobDetail{}, fmt.Errorf("probe published blob: %w", err)
	}
	return detail, nil
}
