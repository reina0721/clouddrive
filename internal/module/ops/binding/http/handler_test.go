package httpbinding

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"runtime"
	"testing"
	"time"

	configbinding "github.com/reina0721/clouddrive/internal/module/ops/binding/config"
	"github.com/reina0721/clouddrive/internal/module/ops/model"
	"github.com/reina0721/clouddrive/internal/module/ops/service"
	"github.com/reina0721/clouddrive/pkg/logger"
	pkgobservability "github.com/reina0721/clouddrive/pkg/observability"
)

// testMetrics 实现 pkgobservability.Metrics：暴露固定文本 handler 与 typed 摘要。
type testMetrics struct{}

func (testMetrics) Handler() http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) { _, _ = writer.Write([]byte("metric")) })
}
func (testMetrics) Summary(context.Context) (pkgobservability.MetricsSummary, error) {
	return pkgobservability.MetricsSummary{Items: []pkgobservability.MetricValue{{Key: "go_goroutines", Value: 1, Unit: "count"}}, AsOf: time.Date(2026, 8, 30, 0, 0, 0, 0, time.UTC)}, nil
}

type testSource struct{}

func (testSource) Snapshot(context.Context) (model.RuntimeSnapshot, error) {
	return model.RuntimeSnapshot{Started: true, Live: true, Ready: true, AuthReady: true, DatabaseReady: true}, nil
}
func (testSource) Readiness(context.Context) (bool, bool, error) { return true, true, nil }

type unhealthySource struct{}

func (unhealthySource) Snapshot(context.Context) (model.RuntimeSnapshot, error) {
	return model.RuntimeSnapshot{Started: true, Live: true, Ready: false}, nil
}
func (unhealthySource) Readiness(context.Context) (bool, bool, error) {
	return false, false, fmt.Errorf("readiness dependency unavailable")
}

type failingSource struct{}

func (failingSource) Snapshot(context.Context) (model.RuntimeSnapshot, error) {
	return model.RuntimeSnapshot{}, fmt.Errorf("runtime snapshot unavailable")
}
func (failingSource) Readiness(context.Context) (bool, bool, error) { return false, false, nil }

type testAccess struct{ allowed bool }

func (a testAccess) Authenticate(next http.Handler) http.Handler { return next }
func (a testAccess) Authorize(context.Context, string) error {
	if !a.allowed {
		return context.Canceled
	}
	return nil
}

func TestManagementRoutePathsContractsWithRegisteredRoutes(t *testing.T) {
	service, _ := service.New(testSource{}, model.BuildInfo{Version: "v1", Commit: "abc", BuildTime: "now", GoVersion: runtime.Version()})
	handler, err := New(service, testMetrics{}, testAccess{}, configbinding.AccessDisabled, logger.Noop())
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	want := []string{"/startupz", "/livez", "/readyz", "/build", "/diagnostics", "/metrics", "/metrics-summary"}
	paths := ManagementRoutePaths()
	if len(paths) != len(want) {
		t.Fatalf("ManagementRoutePaths() = %v, want %v", paths, want)
	}
	seen := map[string]bool{}
	for _, path := range paths {
		seen[path] = true
		// diagnostics 在 AccessDisabled 之外受保护；metrics/metrics-summary 在 Disabled 下不注册。
		if path == "/diagnostics" || path == "/metrics" || path == "/metrics-summary" {
			continue
		}
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, path, nil))
		if recorder.Code != http.StatusOK {
			t.Fatalf("GET %s status = %d, want 200", path, recorder.Code)
		}
	}
	for _, path := range want {
		if !seen[path] {
			t.Fatalf("ManagementRoutePaths() missed %q", path)
		}
	}
}

func TestManagementRoutesExcludePprofAndProtectDiagnostics(t *testing.T) {
	service, _ := service.New(testSource{}, model.BuildInfo{Version: "v1", Commit: "abc", BuildTime: "now", GoVersion: runtime.Version()})
	handler, err := New(service, testMetrics{}, testAccess{}, configbinding.AccessDisabled, logger.Noop())
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	for _, test := range []struct {
		path string
		want int
	}{{"/startupz", 200}, {"/livez", 200}, {"/readyz", 200}, {"/diagnostics", 403}, {"/metrics", 404}, {"/metrics-summary", 404}, {"/debug/pprof/", 404}} {
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, test.path, nil))
		if recorder.Code != test.want {
			t.Fatalf("GET %s status = %d, want %d", test.path, recorder.Code, test.want)
		}
	}
}

func TestManagementLogsRejectedAndFailedBoundaries(t *testing.T) {
	service, _ := service.New(failingSource{}, model.BuildInfo{Version: "v1", Commit: "abc", BuildTime: "now", GoVersion: runtime.Version()})
	logs := logger.NewTestLogger()
	handler, err := New(service, testMetrics{}, testAccess{}, configbinding.AccessProtected, logs)
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}

	for _, test := range []struct {
		path string
		want int
	}{{"/diagnostics", 403}, {"/startupz", 503}} {
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, test.path, nil))
		if recorder.Code != test.want {
			t.Fatalf("GET %s status = %d, want %d", test.path, recorder.Code, test.want)
		}
	}

	entries := logs.Entries()
	if len(entries) != 2 {
		t.Fatalf("entries = %d, want 2", len(entries))
	}
	if entries[0].Level != "warn" || entries[0].Message != "management operation rejected" {
		t.Fatalf("first entry = %#v", entries[0])
	}
	if entries[1].Level != "error" || entries[1].Message != "management operation failed" {
		t.Fatalf("second entry = %#v", entries[1])
	}
}

func TestManagementLogsUnhealthyProbeAsWarn(t *testing.T) {
	service, _ := service.New(unhealthySource{}, model.BuildInfo{Version: "v1", Commit: "abc", BuildTime: "now", GoVersion: runtime.Version()})
	logs := logger.NewTestLogger()
	handler, err := New(service, testMetrics{}, testAccess{allowed: true}, configbinding.AccessDisabled, logs)
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/readyz", nil))
	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("GET /readyz status = %d, want %d", recorder.Code, http.StatusServiceUnavailable)
	}

	entries := logs.Entries()
	if len(entries) != 1 {
		t.Fatalf("entries = %d, want 1", len(entries))
	}
	if entries[0].Level != "warn" || entries[0].Message != "management probe failed" {
		t.Fatalf("entry = %#v", entries[0])
	}
}
