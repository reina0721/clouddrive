package observability

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/reina0721/clouddrive/pkg/httpx"
	pkgobservability "github.com/reina0721/clouddrive/pkg/observability"
	"go.opentelemetry.io/otel/codes"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
	"go.opentelemetry.io/otel/trace"
)

type fixedLease[T any] struct{ current T }

func (f fixedLease[T]) Use(ctx context.Context, use func(T) error) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	return use(f.current)
}

type checkingLease struct {
	current *telemetryResource
	active  bool
}

func (l *checkingLease) Use(ctx context.Context, use func(*telemetryResource) error) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	l.active = true
	defer func() { l.active = false }()
	return use(l.current)
}

type failingExporter struct{}

func (failingExporter) ExportSpans(context.Context, []sdktrace.ReadOnlySpan) error {
	return errors.New("secret exporter detail")
}
func (failingExporter) Shutdown(context.Context) error { return nil }

func TestHTTPKeepsTelemetryLeaseForWholeRequestAndRecordsStableOperation(t *testing.T) {
	metricsState, err := buildMetrics(t.Context(), struct{}{}, struct{}{})
	if err != nil {
		t.Fatal(err)
	}
	metrics := &metricsAccess{delegate: fixedLease[*metricsResource]{current: metricsState}}
	provider := sdktrace.NewTracerProvider(sdktrace.WithSampler(sdktrace.AlwaysSample()))
	resource := &telemetryResource{provider: provider, tracer: provider.Tracer("test"), metrics: metrics}
	resource.lastError.Store("")
	resource.started.Store(true)
	lease := &checkingLease{current: resource}
	telemetry := &telemetryAccess{delegate: lease}

	var traceID string
	handler := telemetry.HTTP([]pkgobservability.Operation{{ID: "getTodo", Method: http.MethodGet, Path: "/api/v1/todos/{id}"}})(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if !lease.active {
			t.Error("request escaped telemetry lease")
		}
		traceID, _ = httpx.TraceIDFromContext(request.Context())
		writer.WriteHeader(http.StatusNoContent)
	}))
	request := httptest.NewRequest(http.MethodGet, "/api/v1/todos/secret-object-id", nil)
	request.Header.Set("traceparent", "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01")
	handler.ServeHTTP(httptest.NewRecorder(), request)
	if traceID != "4bf92f3577b34da6a3ce929d0e0e4736" {
		t.Fatalf("trace id = %q", traceID)
	}
	recorder := httptest.NewRecorder()
	metrics.Handler().ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/metrics", nil))
	payload, _ := io.ReadAll(recorder.Result().Body)
	text := string(payload)
	if !strings.Contains(text, `operation="getTodo"`) || strings.Contains(text, "secret-object-id") {
		t.Fatalf("metrics payload leaked or missed operation:\n%s", text)
	}
}

func TestMetricsSummaryProjectsStableTypedValues(t *testing.T) {
	metricsState, err := buildMetrics(t.Context(), struct{}{}, struct{}{})
	if err != nil {
		t.Fatal(err)
	}
	metrics := &metricsAccess{delegate: fixedLease[*metricsResource]{current: metricsState}}
	if err := metrics.ObserveHTTP("getTodo", http.MethodGet, http.StatusOK, 10*time.Millisecond); err != nil {
		t.Fatal(err)
	}
	summary, err := metrics.Summary(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	if summary.AsOf.IsZero() {
		t.Fatal("summary asOf is zero")
	}
	byKey := make(map[string]pkgobservability.MetricValue, len(summary.Items))
	for _, item := range summary.Items {
		byKey[item.Key] = item
	}
	requests, ok := byKey["app_http_requests_total"]
	if !ok || requests.Value < 1 || requests.Unit != "count" {
		t.Fatalf("request total metric = %#v (present=%v)", requests, ok)
	}
	goroutines, ok := byKey["go_goroutines"]
	if !ok || goroutines.Value < 1 || goroutines.Unit != "count" {
		t.Fatalf("goroutines metric = %#v (present=%v)", goroutines, ok)
	}
	if _, ok := byKey["process_resident_memory_bytes"]; !ok {
		t.Fatalf("resident memory metric missing: %#v", summary.Items)
	}
	// 稳定排序。
	for index := 1; index < len(summary.Items); index++ {
		if summary.Items[index-1].Key > summary.Items[index].Key {
			t.Fatalf("summary items not sorted: %#v", summary.Items)
		}
	}
}

func TestHTTPUsesSingleOTelHTTPServerSpanWithoutSensitiveURL(t *testing.T) {
	metricsState, err := buildMetrics(t.Context(), struct{}{}, struct{}{})
	if err != nil {
		t.Fatal(err)
	}
	metrics := &metricsAccess{delegate: fixedLease[*metricsResource]{current: metricsState}}
	recorder := tracetest.NewSpanRecorder()
	provider := sdktrace.NewTracerProvider(sdktrace.WithSampler(sdktrace.AlwaysSample()), sdktrace.WithSpanProcessor(recorder))
	resource := &telemetryResource{provider: provider, tracer: provider.Tracer("test"), metrics: metrics}
	resource.lastError.Store("")
	resource.started.Store(true)
	telemetry := &telemetryAccess{delegate: fixedLease[*telemetryResource]{current: resource}}
	var downstreamTarget string
	handler := telemetry.HTTP([]pkgobservability.Operation{{ID: "getTodo", Method: http.MethodGet, Path: "/api/v1/todos/{id}"}})(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		downstreamTarget = request.URL.RequestURI()
		writer.WriteHeader(http.StatusInternalServerError)
	}))
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/api/v1/todos/secret-object-id?token=secret-query", nil))
	if downstreamTarget != "/api/v1/todos/secret-object-id?token=secret-query" {
		t.Fatalf("downstream target = %q", downstreamTarget)
	}
	spans := recorder.Ended()
	if len(spans) != 1 {
		t.Fatalf("server span count = %d", len(spans))
	}
	span := spans[0]
	if span.Name() != "getTodo" || span.SpanKind() != trace.SpanKindServer || span.Status().Code != codes.Error {
		t.Fatalf("span = name:%q kind:%v status:%v", span.Name(), span.SpanKind(), span.Status())
	}
	for _, value := range span.Attributes() {
		text := value.Value.Emit()
		if strings.Contains(text, "secret-object-id") || strings.Contains(text, "secret-query") {
			t.Fatalf("span attribute leaked request target: %s=%q", value.Key, text)
		}
	}
}

func TestBoundedProcessorCountsExporterFailureWithoutSensitiveText(t *testing.T) {
	metricsState, err := buildMetrics(t.Context(), struct{}{}, struct{}{})
	if err != nil {
		t.Fatal(err)
	}
	metrics := &metricsAccess{delegate: fixedLease[*metricsResource]{current: metricsState}}
	cfg := DefaultConfig().Tracing
	cfg.QueueSize, cfg.BatchSize, cfg.ExportTimeout = 1, 1, time.Second
	processor := newBoundedProcessor(failingExporter{}, cfg, metrics)
	processor.start()
	provider := sdktrace.NewTracerProvider(sdktrace.WithSampler(sdktrace.AlwaysSample()), sdktrace.WithSpanProcessor(processor))
	_, span := provider.Tracer("test").Start(t.Context(), "operation")
	span.End()
	if err := processor.ForceFlush(t.Context()); err != nil && strings.Contains(err.Error(), "secret") {
		t.Fatalf("ForceFlush() leaked exporter detail: %v", err)
	}
	if err := processor.Shutdown(t.Context()); err != nil {
		t.Fatalf("Shutdown() error = %v", err)
	}
	diagnostics := processor.diagnostics(false)
	if diagnostics.DroppedSpans != 1 || diagnostics.LastErrorType == "" || diagnostics.LastErrorType == "secret exporter detail" {
		t.Fatalf("diagnostics = %#v", diagnostics)
	}
}

func TestBoundedProcessorDropsWithoutBlockingWhenQueueIsFull(t *testing.T) {
	metricsState, err := buildMetrics(t.Context(), struct{}{}, struct{}{})
	if err != nil {
		t.Fatal(err)
	}
	metrics := &metricsAccess{delegate: fixedLease[*metricsResource]{current: metricsState}}
	cfg := DefaultConfig().Tracing
	cfg.QueueSize, cfg.BatchSize = 1, 1
	processor := newBoundedProcessor(failingExporter{}, cfg, metrics)
	provider := sdktrace.NewTracerProvider(sdktrace.WithSampler(sdktrace.AlwaysSample()), sdktrace.WithSpanProcessor(processor))
	for range 2 {
		_, span := provider.Tracer("test").Start(t.Context(), "operation")
		span.End()
	}
	diagnostics := processor.diagnostics(false)
	if diagnostics.QueueDepth != 1 || diagnostics.DroppedSpans != 1 {
		t.Fatalf("diagnostics = %#v", diagnostics)
	}
	processor.start()
	if err := processor.Shutdown(t.Context()); err != nil {
		t.Fatalf("Shutdown() error = %v", err)
	}
}

func TestObserveKeepsLeaseAndProvidesProjectTraceIdentity(t *testing.T) {
	metricsState, err := buildMetrics(t.Context(), struct{}{}, struct{}{})
	if err != nil {
		t.Fatal(err)
	}
	metrics := &metricsAccess{delegate: fixedLease[*metricsResource]{current: metricsState}}
	provider := sdktrace.NewTracerProvider(sdktrace.WithSampler(sdktrace.AlwaysSample()))
	resource := &telemetryResource{provider: provider, tracer: provider.Tracer("test"), metrics: metrics}
	resource.lastError.Store("")
	lease := &checkingLease{current: resource}
	telemetry := &telemetryAccess{delegate: lease}
	var traceID string
	err = telemetry.Observe(t.Context(), pkgobservability.Work{Name: "schedule.task", Kind: "scheduled-task"}, func(ctx context.Context) error {
		if !lease.active {
			t.Error("work escaped telemetry lease")
		}
		traceID = pkgobservability.TraceIDFrom(ctx)
		return nil
	})
	if err != nil {
		t.Fatalf("Observe() error = %v", err)
	}
	if traceID == "" {
		t.Fatal("Observe() did not provide trace identity")
	}
}
