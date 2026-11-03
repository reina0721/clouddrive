package composition

import (
	"context"
	"fmt"
	"net/http"
	"runtime"
	"sync"
	"time"

	"github.com/reina0721/clouddrive/internal/kernel"
	"github.com/reina0721/clouddrive/internal/module/auth"
	authmodel "github.com/reina0721/clouddrive/internal/module/auth/model"
	httpbinding "github.com/reina0721/clouddrive/internal/module/ops/binding/http"
	opsmodel "github.com/reina0721/clouddrive/internal/module/ops/model"
	"github.com/reina0721/clouddrive/pkg/supervisor"
)

type opsAccessAdapter struct{ auth auth.Module }

func (a opsAccessAdapter) Authenticate(next http.Handler) http.Handler {
	return a.auth.ManagementMiddleware(next)
}
func (a opsAccessAdapter) Authorize(ctx context.Context, operation string) error {
	principal, ok := authmodel.PrincipalFromContext(ctx)
	if !ok {
		return authmodel.ErrUnauthenticated
	}
	return a.auth.Service.EnforceOperation(ctx, principal, operation)
}

type opsRuntimeSource struct {
	mu          sync.RWMutex
	coordinator *kernel.GenerationCoordinator
	supervisor  *supervisor.Supervisor
}

func (s *opsRuntimeSource) connect(coordinator *kernel.GenerationCoordinator, process *supervisor.Supervisor) error {
	if coordinator == nil || process == nil {
		return fmt.Errorf("ops runtime source dependencies are incomplete")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.coordinator != nil || s.supervisor != nil {
		return fmt.Errorf("ops runtime source is already connected")
	}
	s.coordinator, s.supervisor = coordinator, process
	return nil
}

func (s *opsRuntimeSource) Snapshot(ctx context.Context) (opsmodel.RuntimeSnapshot, error) {
	if ctx == nil {
		return opsmodel.RuntimeSnapshot{}, fmt.Errorf("ops runtime context is nil")
	}
	s.mu.RLock()
	coordinator, process := s.coordinator, s.supervisor
	s.mu.RUnlock()
	if coordinator == nil || process == nil {
		return opsmodel.RuntimeSnapshot{}, fmt.Errorf("ops runtime source is not connected")
	}
	generationDiagnostics := coordinator.Diagnostics()
	processDiagnostics := process.Snapshot()
	result := opsmodel.RuntimeSnapshot{
		Started:      generationDiagnostics.CurrentGeneration != 0,
		Live:         processDiagnostics.State != supervisor.StateFailed && processDiagnostics.State != supervisor.StateStopped,
		Ready:        generationDiagnostics.Ready && processDiagnostics.Ready,
		ProcessState: string(processDiagnostics.State), GenerationState: string(generationDiagnostics.State),
		Generation: generationDiagnostics.CurrentGeneration, Phase: generationDiagnostics.Phase,
		ConfiguredAddress: generationDiagnostics.ConfiguredAddress, BoundAddress: generationDiagnostics.BoundAddress,
		ActiveRequests: generationDiagnostics.ActiveRequests, ActiveConnections: generationDiagnostics.ActiveConnections,
		CleanupRequired:  generationDiagnostics.CleanupRequired,
		LastFailurePhase: generationDiagnostics.LastFailurePhase, LastFailureOwner: generationDiagnostics.LastFailureOwner,
		LastFailureType: generationDiagnostics.LastFailureType, Since: generationDiagnostics.Since,
		Units: processDiagnostics.Units,
	}
	return result, nil
}

type generationOpsSource struct {
	process    *opsRuntimeSource
	generation *applicationGeneration
}

func (s generationOpsSource) Snapshot(ctx context.Context) (opsmodel.RuntimeSnapshot, error) {
	result, err := s.process.Snapshot(ctx)
	if err != nil {
		return opsmodel.RuntimeSnapshot{}, err
	}
	result.AuthReady = s.generation.authModule.Service.Ready()
	if s.generation.scheduler == nil {
		return opsmodel.RuntimeSnapshot{}, fmt.Errorf("scheduler diagnostics are unavailable")
	}
	scheduler, schedulerErr := s.generation.scheduler.output.Diagnostics(ctx)
	if schedulerErr != nil {
		return opsmodel.RuntimeSnapshot{}, fmt.Errorf("read scheduler diagnostics: %w", schedulerErr)
	}
	schedulerHealth, schedulerHealthErr := s.generation.scheduler.output.Health(ctx)
	if schedulerHealthErr != nil {
		return opsmodel.RuntimeSnapshot{}, fmt.Errorf("read scheduler health: %w", schedulerHealthErr)
	}
	result.Scheduler = scheduler
	result.SchedulerHealth = string(schedulerHealth.Status)
	result.Ready = result.Ready && scheduler.Ready
	if s.generation.messaging == nil {
		return opsmodel.RuntimeSnapshot{}, fmt.Errorf("messaging diagnostics are unavailable")
	}
	messaging, messagingErr := s.generation.messaging.output.Control.Diagnostics(ctx)
	if messagingErr != nil {
		return opsmodel.RuntimeSnapshot{}, fmt.Errorf("read messaging diagnostics: %w", messagingErr)
	}
	messagingHealth, messagingHealthErr := s.generation.messaging.output.Control.Health(ctx)
	if messagingHealthErr != nil {
		return opsmodel.RuntimeSnapshot{}, fmt.Errorf("read messaging health: %w", messagingHealthErr)
	}
	result.Messaging = messaging
	result.MessagingHealth = string(messagingHealth.Status)
	result.Ready = result.Ready && messagingHealth.Status != "fail"
	telemetry, diagnosticsErr := s.generation.telemetry.output.Diagnostics(ctx)
	if diagnosticsErr != nil {
		return opsmodel.RuntimeSnapshot{}, fmt.Errorf("read telemetry diagnostics: %w", diagnosticsErr)
	}
	result.Telemetry = telemetry
	result.Process = sampleProcessState(result.Since)
	return result, nil
}

// sampleProcessState 采样进程级运行状态（081）：标准库 runtime 只读指标，
// uptime 以 supervisor 起始时间为基准（低敏、跨平台）。
func sampleProcessState(since time.Time) opsmodel.ProcessSnapshot {
	var memory runtime.MemStats
	runtime.ReadMemStats(&memory)
	sample := opsmodel.ProcessSnapshot{AllocBytes: memory.Alloc, SysBytes: memory.Sys, HeapAllocBytes: memory.HeapAlloc, NumGC: memory.NumGC}
	sample.NumGoroutine = runtime.NumGoroutine()
	if !since.IsZero() {
		sample.UptimeSeconds = time.Since(since).Seconds()
	}
	return sample
}

func (s generationOpsSource) Readiness(ctx context.Context) (bool, bool, error) {
	if ctx == nil {
		return false, false, fmt.Errorf("ops readiness context is nil")
	}
	if s.generation == nil {
		return false, false, nil
	}
	authReady := s.generation.authModule.Service.Ready()
	if err := s.generation.database.value().Ping(ctx); err != nil {
		return authReady, false, nil
	}
	return authReady, true, nil
}

var _ httpbinding.Access = opsAccessAdapter{}
