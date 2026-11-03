// Package model 定义 Ops module 对外稳定的管理与观测契约。
package model

import (
	"time"

	pkgmessaging "github.com/reina0721/clouddrive/pkg/messaging"
	"github.com/reina0721/clouddrive/pkg/observability"
	pkgschedule "github.com/reina0721/clouddrive/pkg/schedule"
	"github.com/reina0721/clouddrive/pkg/supervisor"
)

// ProbeKind 是管理端点支持的有限探针集合。
type ProbeKind string

const (
	ProbeStartup  ProbeKind = "startup"
	ProbeLiveness ProbeKind = "liveness"
	ProbeReady    ProbeKind = "readiness"
)

const (
	// OperationBuild 是构建信息读取的稳定审计 identity。
	OperationBuild = "ops.build"
	// OperationDiagnostics 是完整诊断读取的稳定审计 identity。
	OperationDiagnostics = "ops.diagnostics"
	// OperationMetrics 是受保护 metrics 读取的稳定审计 identity。
	OperationMetrics = "ops.metrics"
)

// BuildInfo 是允许通过管理面公开的非敏感构建元数据。
type BuildInfo struct {
	Version   string `json:"version"`
	Commit    string `json:"commit"`
	BuildTime string `json:"buildTime"`
	GoVersion string `json:"goVersion"`
	Dirty     bool   `json:"dirty"`
}

// RuntimeSnapshot 是 composition 向 Ops module 提供的只读进程视图。
type RuntimeSnapshot struct {
	Started           bool                      `json:"started"`
	Live              bool                      `json:"live"`
	Ready             bool                      `json:"ready"`
	ProcessState      string                    `json:"processState"`
	GenerationState   string                    `json:"generationState"`
	Generation        uint64                    `json:"generation"`
	Phase             string                    `json:"phase"`
	ConfiguredAddress string                    `json:"configuredAddress,omitempty"`
	BoundAddress      string                    `json:"boundAddress,omitempty"`
	ActiveRequests    int64                     `json:"activeRequests"`
	ActiveConnections int64                     `json:"activeConnections"`
	AuthReady         bool                      `json:"authReady"`
	DatabaseReady     bool                      `json:"databaseReady"`
	CleanupRequired   bool                      `json:"cleanupRequired"`
	LastFailurePhase  string                    `json:"lastFailurePhase,omitempty"`
	LastFailureOwner  string                    `json:"lastFailureOwner,omitempty"`
	LastFailureType   string                    `json:"lastFailureType,omitempty"`
	Telemetry         observability.Diagnostics `json:"telemetry"`
	Scheduler         pkgschedule.Diagnostics   `json:"scheduler"`
	SchedulerHealth   string                    `json:"schedulerHealth"`
	Messaging         pkgmessaging.Diagnostics  `json:"messaging"`
	MessagingHealth   string                    `json:"messagingHealth"`
	// Process 是进程级运行状态（081）：标准库 runtime 采样，低敏。
	Process ProcessSnapshot `json:"process"`
	// Units 是 supervisor 监督单元摘要（participants + tasks，081）。
	Units []supervisor.UnitSnapshot `json:"units,omitempty"`
	Since time.Time                 `json:"since"`
}

// ProcessSnapshot 是进程级服务器状态（081）：内存、goroutine、GC 与启动时长，
// 全部来自标准库 runtime，跨平台且低敏。
type ProcessSnapshot struct {
	AllocBytes     uint64  `json:"allocBytes"`
	SysBytes       uint64  `json:"sysBytes"`
	HeapAllocBytes uint64  `json:"heapAllocBytes"`
	NumGoroutine   int     `json:"numGoroutine"`
	NumGC          uint32  `json:"numGC"`
	UptimeSeconds  float64 `json:"uptimeSeconds"`
}

// Probe 是公开探针的最小响应，不包含内部失败细节。
type Probe struct {
	Status string `json:"status"`
}
