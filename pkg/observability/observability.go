// Package observability 定义进程观测能力对业务与管理模块开放的最小契约。
package observability

import (
	"context"
	"net/http"
	"time"
)

// Operation 是 HTTP 观测使用的稳定、低基数路由事实。
type Operation struct {
	ID     string
	Method string
	Path   string
}

// Work 是后台工作 span 的稳定低基数身份，不包含业务参数。
type Work struct {
	Name string
	Kind string
}

// WorkFunc 是在同一 Telemetry provider 下执行的后台工作。
type WorkFunc func(context.Context) error

// Diagnostics 描述 exporter 的低敏、自包含运行状态。
type Diagnostics struct {
	Enabled       bool   `json:"enabled"`
	Ready         bool   `json:"ready"`
	QueueDepth    int64  `json:"queueDepth"`
	DroppedSpans  uint64 `json:"droppedSpans"`
	ExportedSpans uint64 `json:"exportedSpans"`
	LastErrorType string `json:"lastErrorType,omitempty"`
}

// MetricValue 是单个稳定指标投影（090 design §8）：携带 key、value、unit，
// 供产品 UI 直接消费，不从前端解析 Prometheus 文本推断语义。
type MetricValue struct {
	// Key 是稳定指标标识（如 "requests_total"、"in_flight_requests"、
	// "goroutines"、"resident_memory_bytes"、"cpu_seconds_total"）。
	Key string `json:"key"`
	// Value 是当前数值；Counter 为累计值，Gauge 为瞬时值。
	Value float64 `json:"value"`
	// Unit 是稳定单位（"count"、"bytes"、"seconds"）。
	Unit string `json:"unit"`
}

// MetricsSummary 是进程级指标的 typed 投影（090 design §8）。Prometheus 文本
// 仍服务监控系统与专业调试；产品 UI 只消费本投影，避免从文本推断业务语义。
type MetricsSummary struct {
	// Items 按 Key 稳定排序，只含注册在案的稳定指标。
	Items []MetricValue `json:"items"`
	// AsOf 是采样时刻（UTC）。
	AsOf time.Time `json:"asOf"`
}

// Metrics 提供只连接进程私有 registry 的 exposition 入口与 typed 摘要投影。
type Metrics interface {
	Handler() http.Handler
	// Summary 返回进程级指标的 typed 投影；采样失败返回错误（不返回部分
	// 数据冒充完整状态）。
	Summary(context.Context) (MetricsSummary, error)
}

// Telemetry 提供请求级观测和低敏诊断，不暴露 tracer、provider 或关闭权。
type Telemetry interface {
	HTTP([]Operation) func(http.Handler) http.Handler
	Observe(context.Context, Work, WorkFunc) error
	Diagnostics(context.Context) (Diagnostics, error)
}

// Capabilities 聚合 application composition 可以连接的观测能力。
type Capabilities struct {
	Metrics   Metrics
	Telemetry Telemetry
}

type traceIDContextKey struct{}

// WithTraceID 把低敏 trace identity 放入项目自有 context，不暴露 SDK Span 类型。
func WithTraceID(ctx context.Context, traceID string) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	return context.WithValue(ctx, traceIDContextKey{}, traceID)
}

// TraceIDFrom 返回由 Telemetry 写入的低敏 trace identity。
func TraceIDFrom(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	traceID, _ := ctx.Value(traceIDContextKey{}).(string)
	return traceID
}
