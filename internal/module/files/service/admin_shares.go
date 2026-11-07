package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/pkg/clock"
)

const (
	AdminSharePageSize = 20
	MaxAdminShareBatch = 20
	MaxShareActivity   = 1<<53 - 1
)

type AdminShareSort string

const (
	AdminShareByID        AdminShareSort = "id"
	AdminShareByCreated   AdminShareSort = "created"
	AdminShareByViews     AdminShareSort = "views"
	AdminShareByDownloads AdminShareSort = "downloads"
)

type AdminShareQuery struct {
	OwnerID   string
	RootID    string
	Status    ShareStatus
	Sort      AdminShareSort
	Direction InventoryDirection
	Page      int
}

// AdminShareItem 仅投影管理所需的数据，不包含链接、访问凭据或内容定位信息。
type AdminShareItem struct {
	ID          string      `json:"id"`
	OwnerID     string      `json:"ownerId"`
	RootID      string      `json:"rootId"`
	RootName    *string     `json:"rootName"`
	Title       string      `json:"title"`
	Status      ShareStatus `json:"status" enum:"active,paused,expired,revoked"`
	HasPassword bool        `json:"hasPassword"`
	Views       int64       `json:"views"`
	Downloads   int64       `json:"downloads"`
	Revision    int64       `json:"revision"`
	CreatedAt   time.Time   `json:"createdAt"`
	ExpiresAt   time.Time   `json:"expiresAt"`
	RevokedAt   *time.Time  `json:"revokedAt"`
}

type AdminSharePage struct {
	Items    []AdminShareItem `json:"items"`
	Total    int64            `json:"total"`
	Page     int              `json:"page"`
	PageSize int              `json:"pageSize"`
}

type AdminShareTarget struct {
	ID       string `json:"id" minLength:"36" maxLength:"36"`
	Revision int64  `json:"revision" minimum:"1" maximum:"9007199254740991"`
}

type AdminShareRepository interface {
	QueryAdminShares(context.Context, AdminShareQuery, time.Time) (AdminSharePage, error)
	ReadAdminShare(context.Context, string, time.Time) (AdminShareItem, error)
	RevokeAdminShares(context.Context, []AdminShareTarget, time.Time) (int, error)
}

type AdminShares struct {
	store AdminShareRepository
	clock clock.Clock
}

func NewAdminShares(store AdminShareRepository, timeSource clock.Clock) (*AdminShares, error) {
	if store == nil || timeSource == nil {
		return nil, fmt.Errorf("admin share dependencies are required")
	}
	return &AdminShares{store: store, clock: timeSource}, nil
}

func (s *AdminShares) List(ctx context.Context, query AdminShareQuery) (AdminSharePage, error) {
	if !validInventoryText(query.OwnerID, 128) || query.Page < 1 || query.Page > MaxInventoryPage ||
		(query.Direction != InventoryAscending && query.Direction != InventoryDescending) {
		return AdminSharePage{}, model.ErrInvalid
	}
	query.OwnerID = strings.TrimSpace(query.OwnerID)
	query.RootID = strings.TrimSpace(query.RootID)
	if query.RootID != "" && model.ValidateTransferID(query.RootID) != nil {
		return AdminSharePage{}, model.ErrInvalid
	}
	switch query.Status {
	case "", ShareActive, SharePaused, ShareExpired, ShareRevoked:
	default:
		return AdminSharePage{}, model.ErrInvalid
	}
	switch query.Sort {
	case AdminShareByID, AdminShareByCreated, AdminShareByViews, AdminShareByDownloads:
	default:
		return AdminSharePage{}, model.ErrInvalid
	}
	return s.store.QueryAdminShares(ctx, query, s.clock.Now().UTC())
}

func (s *AdminShares) Read(ctx context.Context, id string) (AdminShareItem, error) {
	if model.ValidateTransferID(id) != nil {
		return AdminShareItem{}, model.ErrInvalid
	}
	return s.store.ReadAdminShare(ctx, id, s.clock.Now().UTC())
}

func (s *AdminShares) Revoke(ctx context.Context, targets []AdminShareTarget) (int, error) {
	if len(targets) < 1 || len(targets) > MaxAdminShareBatch {
		return 0, model.ErrInvalid
	}
	seen := make(map[string]struct{}, len(targets))
	for _, target := range targets {
		if _, exists := seen[target.ID]; exists || model.ValidateTransferID(target.ID) != nil || target.Revision < 1 || target.Revision > model.MaxContentRevision {
			return 0, model.ErrInvalid
		}
		seen[target.ID] = struct{}{}
	}
	return s.store.RevokeAdminShares(ctx, targets, s.clock.Now().UTC())
}
