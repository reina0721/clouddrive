package observability

import (
	"context"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	dto "github.com/prometheus/client_model/go"
	"github.com/reina0721/clouddrive/internal/kernel/app"
	pkgobservability "github.com/reina0721/clouddrive/pkg/observability"
)

type metricsResource struct {
	registry *prometheus.Registry
	requests *prometheus.CounterVec
	duration *prometheus.HistogramVec
	inFlight prometheus.Gauge
	dropped  prometheus.Counter
	exported prometheus.Counter
}

type metricsAccess struct{ delegate app.Lease[*metricsResource] }

type metricsRecorder interface {
	ObserveHTTP(string, string, int, time.Duration) error
	IncInFlight() error
	DecInFlight() error
	RecordDropped(int) error
	RecordExported(int) error
}

func buildMetrics(ctx context.Context, _ struct{}, _ struct{}) (*metricsResource, error) {
	if ctx == nil {
		return nil, fmt.Errorf("observability metrics context is nil")
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	result := &metricsResource{registry: prometheus.NewRegistry()}
	result.requests = prometheus.NewCounterVec(prometheus.CounterOpts{Namespace: "app", Subsystem: "http", Name: "requests_total", Help: "按稳定 operation 汇总的 HTTP 请求数。"}, []string{"operation", "method", "status_class", "error_class"})
	result.duration = prometheus.NewHistogramVec(prometheus.HistogramOpts{Namespace: "app", Subsystem: "http", Name: "request_duration_seconds", Help: "按稳定 operation 汇总的 HTTP 请求耗时。", Buckets: prometheus.DefBuckets}, []string{"operation", "method"})
	result.inFlight = prometheus.NewGauge(prometheus.GaugeOpts{Namespace: "app", Subsystem: "http", Name: "in_flight_requests", Help: "当前业务 HTTP 请求数。"})
	result.dropped = prometheus.NewCounter(prometheus.CounterOpts{Namespace: "app", Subsystem: "telemetry", Name: "dropped_spans_total", Help: "因队列或导出失败丢弃的 span 数。"})
	result.exported = prometheus.NewCounter(prometheus.CounterOpts{Namespace: "app", Subsystem: "telemetry", Name: "exported_spans_total", Help: "已成功导出的 span 数。"})
	for name, collector := range map[string]prometheus.Collector{"HTTP request": result.requests, "HTTP duration": result.duration, "HTTP in-flight": result.inFlight, "telemetry dropped": result.dropped, "telemetry exported": result.exported} {
		if err := result.registry.Register(collector); err != nil {
			return nil, fmt.Errorf("register %s metric: %w", name, err)
		}
	}
	// 进程级监控（081）：注册 prometheus 官方 Go/Process collector，暴露
	// go_goroutines、go_memstats_*、process_cpu_seconds_total、
	// process_resident_memory_bytes、process_start_time_seconds 等标准指标。
	result.registry.MustRegister(prometheus.NewGoCollector(), prometheus.NewProcessCollector(prometheus.ProcessCollectorOpts{}))
	return result, nil
}

func newMetricsAccess(delegate app.Lease[*metricsResource]) (pkgobservability.Metrics, error) {
	if delegate == nil {
		return nil, fmt.Errorf("observability metrics lease is nil")
	}
	return &metricsAccess{delegate: delegate}, nil
}

func (a *metricsAccess) Handler() http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		err := a.delegate.Use(request.Context(), func(current *metricsResource) error {
			promhttp.HandlerFor(current.registry, promhttp.HandlerOpts{EnableOpenMetrics: true}).ServeHTTP(writer, request)
			return nil
		})
		if err != nil {
			http.Error(writer, "metrics unavailable", http.StatusServiceUnavailable)
		}
	})
}

// summaryMetricKeys 是 typed 投影包含的稳定指标名（Prometheus family 名）。
// 只列入产品 UI 真正消费且语义稳定的指标；新增必须同步注册与 WebUI 消费方。
var summaryMetricKeys = []string{
	"app_http_requests_total",
	"app_http_in_flight_requests",
	"app_telemetry_exported_spans_total",
	"app_telemetry_dropped_spans_total",
	"go_goroutines",
	"process_resident_memory_bytes",
	"process_cpu_seconds_total",
}

// Summary 收集 registry 并把稳定指标投影为 typed 值（090 design §8）：
// 按 Key 稳定排序；采样失败返回错误，不返回部分数据冒充完整状态。
func (a *metricsAccess) Summary(ctx context.Context) (pkgobservability.MetricsSummary, error) {
	if ctx == nil {
		return pkgobservability.MetricsSummary{}, fmt.Errorf("observability metrics summary context is nil")
	}
	if err := ctx.Err(); err != nil {
		return pkgobservability.MetricsSummary{}, err
	}
	var summary pkgobservability.MetricsSummary
	err := a.delegate.Use(ctx, func(current *metricsResource) error {
		families, err := current.registry.Gather()
		if err != nil {
			return fmt.Errorf("gather metrics registry: %w", err)
		}
		values := make(map[string]float64, len(summaryMetricKeys))
		for _, family := range families {
			name := family.GetName()
			if !containsString(summaryMetricKeys, name) {
				continue
			}
			for _, metric := range family.GetMetric() {
				if value := metricValueOf(metric); value != nil {
					values[name] += *value
				}
			}
		}
		summary.Items = make([]pkgobservability.MetricValue, 0, len(summaryMetricKeys))
		for _, key := range summaryMetricKeys {
			value, ok := values[key]
			if !ok {
				continue
			}
			summary.Items = append(summary.Items, pkgobservability.MetricValue{Key: key, Value: value, Unit: metricUnit(key)})
		}
		sort.Slice(summary.Items, func(left, right int) bool { return summary.Items[left].Key < summary.Items[right].Key })
		summary.AsOf = time.Now().UTC()
		return nil
	})
	if err != nil {
		return pkgobservability.MetricsSummary{}, err
	}
	return summary, nil
}

// metricValueOf 从 protobuf metric 中提取数值；计数器/仪表取 counter/gauge
// 值，直方图/摘要跳过（typed 投影只消费标量稳定指标）。
func metricValueOf(metric *dto.Metric) *float64 {
	if metric == nil {
		return nil
	}
	switch {
	case metric.GetCounter() != nil:
		value := metric.GetCounter().GetValue()
		return &value
	case metric.GetGauge() != nil:
		value := metric.GetGauge().GetValue()
		return &value
	default:
		return nil
	}
}

// metricUnit 返回稳定指标的单位（与注册命名约定一致；bytes/seconds 显式，
// 其余为 count）。
func metricUnit(key string) string {
	switch {
	case containsString([]string{"process_resident_memory_bytes"}, key):
		return "bytes"
	case containsString([]string{"process_cpu_seconds_total"}, key):
		return "seconds"
	default:
		return "count"
	}
}

func containsString(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func (a *metricsAccess) ObserveHTTP(operation, method string, status int, duration time.Duration) error {
	return a.delegate.Use(context.Background(), func(current *metricsResource) error {
		statusClass := strconv.Itoa(status/100) + "xx"
		errorClass := "none"
		if status >= 400 && status < 500 {
			errorClass = "client"
		} else if status >= 500 {
			errorClass = "server"
		}
		current.requests.WithLabelValues(operation, method, statusClass, errorClass).Inc()
		current.duration.WithLabelValues(operation, method).Observe(duration.Seconds())
		return nil
	})
}

func (a *metricsAccess) IncInFlight() error {
	return a.use(func(current *metricsResource) { current.inFlight.Inc() })
}
func (a *metricsAccess) DecInFlight() error {
	return a.use(func(current *metricsResource) { current.inFlight.Dec() })
}
func (a *metricsAccess) RecordDropped(count int) error {
	if count <= 0 {
		return nil
	}
	return a.use(func(current *metricsResource) { current.dropped.Add(float64(count)) })
}
func (a *metricsAccess) RecordExported(count int) error {
	if count <= 0 {
		return nil
	}
	return a.use(func(current *metricsResource) { current.exported.Add(float64(count)) })
}
func (a *metricsAccess) use(operation func(*metricsResource)) error {
	return a.delegate.Use(context.Background(), func(current *metricsResource) error { operation(current); return nil })
}

var _ pkgobservability.Metrics = (*metricsAccess)(nil)
var _ metricsRecorder = (*metricsAccess)(nil)
