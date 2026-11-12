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
	AdminTaskPageSize  = 20
	AdminTaskBatchSize = AdminTaskPageSize
)

type AdminTaskSort string
type AdminTaskOrigin string

const (
	AdminTaskByID         AdminTaskSort   = "id"
	AdminTaskByCreated    AdminTaskSort   = "created"
	AdminTaskOriginAll    AdminTaskOrigin = "all"
	AdminTaskOriginUser   AdminTaskOrigin = "user"
	AdminTaskOriginSystem AdminTaskOrigin = "system"
)

type AdminTaskQuery struct {
	OwnerID       string
	TaskID        string
	NodeID        string
	Kind          BackgroundTaskKind
	Origin        AdminTaskOrigin
	Status        BackgroundTaskStatus
	Sort          AdminTaskSort
	Direction     InventoryDirection
	Page          int
	CleanupBefore time.Time
}

type AdminTaskSummaryQuery struct {
	OwnerID string
	TaskID  string
	NodeID  string
	Kind    BackgroundTaskKind
	Origin  AdminTaskOrigin
}

type AdminTaskTarget struct {
	Kind      BackgroundTaskKind `json:"kind" enum:"zip,extract,http,bittorrent,trash-expiry,blob-reclaim"`
	ID        string             `json:"id" minLength:"36" maxLength:"36"`
	UpdatedAt time.Time          `json:"updatedAt"`
	Revision  int64              `json:"revision" minimum:"0" maximum:"9007199254740991"`
}

// AdminTask 仅包含管理任务的可披露元数据。
type AdminTask struct {
	AdminTaskTarget
	OwnerID     string    `json:"ownerId"`
	Name        string    `json:"name"`
	State       string    `json:"state"`
	FailureCode string    `json:"failureCode"`
	NodeID      string    `json:"nodeId"`
	CreatedAt   time.Time `json:"createdAt"`
	DurationMS  *int64    `json:"durationMs" minimum:"0"`
	Cleanable   bool      `json:"cleanable"`
}

type AdminTaskPage struct {
	Items    []AdminTask `json:"items"`
	Total    int64       `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
}

// AdminTaskSummary is a point-in-time aggregate for the selected task scope.
// It deliberately excludes pagination, sorting and status so a narrowed list
// cannot be mistaken for the operational picture.
type AdminTaskSummary struct {
	Total     int64     `json:"total"`
	Active    int64     `json:"active"`
	Completed int64     `json:"completed"`
	Failed    int64     `json:"failed"`
	Canceled  int64     `json:"canceled"`
	Expired   int64     `json:"expired"`
	Cleanable int64     `json:"cleanable"`
	AsOf      time.Time `json:"asOf"`
}

type AdminTaskRepository interface {
	QueryAdminTasks(context.Context, AdminTaskQuery, time.Time) (AdminTaskPage, error)
	SummarizeAdminTasks(context.Context, AdminTaskSummaryQuery, time.Time) (AdminTaskSummary, error)
	ReadAdminTask(context.Context, BackgroundTaskKind, string, time.Time) (AdminTask, error)
	RemoveArchiveTaskIfUnchanged(context.Context, string, string, time.Time) error
	RemoveMaintenanceRunIfUnchanged(context.Context, MaintenanceKind, string, time.Time) error
}

func normalizeAdminTaskScope(ownerID, taskID, nodeID string, kind BackgroundTaskKind, origin AdminTaskOrigin) (AdminTaskSummaryQuery, error) {
	query := AdminTaskSummaryQuery{OwnerID: strings.TrimSpace(ownerID), TaskID: strings.TrimSpace(taskID), NodeID: nodeID, Kind: kind, Origin: origin}
	if !validInventoryText(query.OwnerID, 128) || (query.TaskID != "" && model.ValidateTransferID(query.TaskID) != nil) ||
		(query.NodeID != "" && !validTorrentNodeID(query.NodeID)) || (query.Kind != BackgroundTaskAny && !validAdminTaskKind(query.Kind)) {
		return AdminTaskSummaryQuery{}, model.ErrInvalid
	}
	switch query.Origin {
	case AdminTaskOriginAll, AdminTaskOriginUser, AdminTaskOriginSystem:
	default:
		return AdminTaskSummaryQuery{}, model.ErrInvalid
	}
	return query, nil
}

type AdminTaskDownloadRemoval interface {
	Remove(context.Context, string, string, int64) error
}

type AdminTaskCleanupResult struct {
	Target AdminTaskTarget
	Err    error
}

type AdminTasks struct {
	store     AdminTaskRepository
	downloads AdminTaskDownloadRemoval
	clock     clock.Clock
}

func NewAdminTasks(store AdminTaskRepository, downloads AdminTaskDownloadRemoval, timeSource clock.Clock) (*AdminTasks, error) {
	if store == nil || downloads == nil || timeSource == nil {
		return nil, fmt.Errorf("admin task dependencies are required")
	}
	return &AdminTasks{store: store, downloads: downloads, clock: timeSource}, nil
}

func validAdminTaskKind(kind BackgroundTaskKind) bool {
	return kind == BackgroundTaskZIP || kind == BackgroundTaskExtract || kind == BackgroundTaskHTTP || kind == BackgroundTaskBitTorrent || isMaintenanceKind(kind)
}

func isMaintenanceKind(kind BackgroundTaskKind) bool {
	return MaintenanceKind(kind) == MaintenanceTrashExpiry || MaintenanceKind(kind) == MaintenanceBlobReclaim
}

func (s *AdminTasks) List(ctx context.Context, query AdminTaskQuery) (AdminTaskPage, error) {
	scope, err := normalizeAdminTaskScope(query.OwnerID, query.TaskID, query.NodeID, query.Kind, query.Origin)
	if err != nil {
		return AdminTaskPage{}, err
	}
	query.OwnerID, query.TaskID, query.NodeID, query.Kind, query.Origin = scope.OwnerID, scope.TaskID, scope.NodeID, scope.Kind, scope.Origin
	if query.Page < 1 || query.Page > MaxInventoryPage ||
		(query.Sort != AdminTaskByID && query.Sort != AdminTaskByCreated) || (query.Direction != InventoryAscending && query.Direction != InventoryDescending) {
		return AdminTaskPage{}, model.ErrInvalid
	}
	switch query.Status {
	case BackgroundStatusAll, BackgroundStatusActive, BackgroundStatusCompleted, BackgroundStatusFailed, BackgroundStatusCanceled, BackgroundStatusExpired:
	default:
		return AdminTaskPage{}, model.ErrInvalid
	}
	now := s.clock.Now().UTC()
	if !query.CleanupBefore.IsZero() && (query.CleanupBefore.After(now) || query.Status == BackgroundStatusActive) {
		return AdminTaskPage{}, model.ErrInvalid
	}
	return s.store.QueryAdminTasks(ctx, query, now)
}

func (s *AdminTasks) Summary(ctx context.Context, query AdminTaskSummaryQuery) (AdminTaskSummary, error) {
	query, err := normalizeAdminTaskScope(query.OwnerID, query.TaskID, query.NodeID, query.Kind, query.Origin)
	if err != nil {
		return AdminTaskSummary{}, err
	}
	now := s.clock.Now().UTC()
	return s.store.SummarizeAdminTasks(ctx, query, now)
}

func (s *AdminTasks) Read(ctx context.Context, kind BackgroundTaskKind, id string) (AdminTask, error) {
	if !validAdminTaskKind(kind) || model.ValidateTransferID(id) != nil {
		return AdminTask{}, model.ErrInvalid
	}
	return s.store.ReadAdminTask(ctx, kind, id, s.clock.Now().UTC())
}

func (s *AdminTasks) Cleanup(ctx context.Context, targets []AdminTaskTarget) ([]AdminTaskCleanupResult, error) {
	if len(targets) < 1 || len(targets) > AdminTaskBatchSize {
		return nil, model.ErrInvalid
	}
	seen := make(map[string]struct{}, len(targets))
	for _, target := range targets {
		key := string(target.Kind) + ":" + target.ID
		if _, exists := seen[key]; exists || !validAdminTaskKind(target.Kind) || model.ValidateTransferID(target.ID) != nil || target.UpdatedAt.IsZero() {
			return nil, model.ErrInvalid
		}
		seen[key] = struct{}{}
	}
	results := make([]AdminTaskCleanupResult, 0, len(targets))
	for _, target := range targets {
		results = append(results, AdminTaskCleanupResult{Target: target, Err: s.remove(ctx, target)})
	}
	return results, nil
}

func (s *AdminTasks) remove(ctx context.Context, target AdminTaskTarget) error {
	value, err := s.store.ReadAdminTask(ctx, target.Kind, target.ID, s.clock.Now().UTC())
	if err != nil {
		return err
	}
	if !value.Cleanable || !value.UpdatedAt.Equal(target.UpdatedAt) || value.Revision != target.Revision {
		return model.ErrConflict
	}
	if target.Kind == BackgroundTaskZIP || target.Kind == BackgroundTaskExtract {
		return s.store.RemoveArchiveTaskIfUnchanged(ctx, value.OwnerID, target.ID, target.UpdatedAt)
	}
	if isMaintenanceKind(target.Kind) {
		return s.store.RemoveMaintenanceRunIfUnchanged(ctx, MaintenanceKind(target.Kind), target.ID, target.UpdatedAt)
	}
	return s.downloads.Remove(ctx, value.OwnerID, target.ID, target.Revision)
}
