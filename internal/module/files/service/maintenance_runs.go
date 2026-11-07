package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/reina0721/clouddrive/pkg/clock"
	"github.com/reina0721/clouddrive/pkg/idgen"
)

const (
	MaintenanceHistoryLimit  = 200
	maintenanceRecordTimeout = 5 * time.Second
	maintenanceFailedCode    = "maintenance_failed"
	maintenanceTimeoutCode   = "maintenance_timeout"
)

type MaintenanceKind string

const (
	MaintenanceTrashExpiry MaintenanceKind = "trash-expiry"
	MaintenanceBlobReclaim MaintenanceKind = "blob-reclaim"
)

// MaintenanceRun 表示已退出的文件维护执行，只携带可公开给管理者的数据。
type MaintenanceRun struct {
	ID          string
	Kind        MaintenanceKind
	State       BackgroundTaskStatus
	FailureCode string
	CreatedAt   time.Time
	UpdatedAt   time.Time
	DurationMS  int64
}

type MaintenanceRunStore interface {
	AppendMaintenanceRun(context.Context, MaintenanceRun) error
}

type MaintenanceRuns struct {
	store MaintenanceRunStore
	clock clock.Clock
	ids   idgen.Generator
}

func NewMaintenanceRuns(store MaintenanceRunStore, timeSource clock.Clock, ids idgen.Generator) (*MaintenanceRuns, error) {
	if store == nil || timeSource == nil || ids == nil {
		return nil, fmt.Errorf("maintenance run dependencies are required")
	}
	return &MaintenanceRuns{store: store, clock: timeSource, ids: ids}, nil
}

// Record 保留维护原有成功和失败语义；取消后仍给历史写入一个有界窗口。
func (s *MaintenanceRuns) Record(ctx context.Context, kind MaintenanceKind, execute func(context.Context) error) error {
	start := s.clock.Now()
	runErr := execute(ctx)
	end := s.clock.Now()
	state, failure := BackgroundStatusCompleted, ""
	switch {
	case runErr == nil:
	case errors.Is(runErr, context.Canceled) && errors.Is(ctx.Err(), context.Canceled):
		state = BackgroundStatusCanceled
	case errors.Is(runErr, context.DeadlineExceeded):
		state, failure = BackgroundStatusFailed, maintenanceTimeoutCode
	default:
		state, failure = BackgroundStatusFailed, maintenanceFailedCode
	}
	id, err := s.ids.New()
	if err != nil {
		return errors.Join(runErr, fmt.Errorf("allocate maintenance run id: %w", err))
	}
	write, cancel := context.WithTimeout(context.WithoutCancel(ctx), maintenanceRecordTimeout)
	defer cancel()
	row := MaintenanceRun{ID: id, Kind: kind, State: state, FailureCode: failure, CreatedAt: start.UTC(),
		UpdatedAt: end.UTC(), DurationMS: max(0, end.Sub(start).Milliseconds())}
	if row.UpdatedAt.Before(row.CreatedAt) {
		row.UpdatedAt = row.CreatedAt
	}
	if err := s.store.AppendMaintenanceRun(write, row); err != nil {
		return errors.Join(runErr, fmt.Errorf("persist maintenance run: %w", err))
	}
	return runErr
}
