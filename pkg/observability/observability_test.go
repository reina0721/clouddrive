package observability_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/reina0721/clouddrive/pkg/observability"
)

type metricsFixture struct{ handler http.Handler }

func (m metricsFixture) Handler() http.Handler { return m.handler }
func (m metricsFixture) Summary(context.Context) (observability.MetricsSummary, error) {
	return observability.MetricsSummary{Items: []observability.MetricValue{{Key: "go_goroutines", Value: 1, Unit: "count"}}, AsOf: time.Date(2026, 8, 30, 0, 0, 0, 0, time.UTC)}, nil
}

type telemetryFixture struct{ diagnostics observability.Diagnostics }

func (t telemetryFixture) HTTP([]observability.Operation) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler { return next }
}
func (t telemetryFixture) Diagnostics(context.Context) (observability.Diagnostics, error) {
	return t.diagnostics, nil
}
func (t telemetryFixture) Observe(ctx context.Context, _ observability.Work, run observability.WorkFunc) error {
	return run(ctx)
}

func TestCapabilitiesCanBeConsumedWithoutTechnologyTypes(t *testing.T) {
	capabilities := observability.Capabilities{
		Metrics:   metricsFixture{handler: http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) { writer.WriteHeader(http.StatusNoContent) })},
		Telemetry: telemetryFixture{diagnostics: observability.Diagnostics{Enabled: true, Ready: true}},
	}
	recorder := httptest.NewRecorder()
	capabilities.Metrics.Handler().ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/metrics", nil))
	if recorder.Code != http.StatusNoContent {
		t.Fatalf("metrics status = %d", recorder.Code)
	}
	diagnostics, err := capabilities.Telemetry.Diagnostics(t.Context())
	if err != nil {
		t.Fatalf("Diagnostics() error = %v", err)
	}
	if !diagnostics.Enabled || !diagnostics.Ready {
		t.Fatalf("diagnostics = %#v", diagnostics)
	}
	summary, err := capabilities.Metrics.Summary(t.Context())
	if err != nil {
		t.Fatalf("Metrics.Summary() error = %v", err)
	}
	if len(summary.Items) != 1 || summary.Items[0].Key != "go_goroutines" || summary.Items[0].Unit != "count" || summary.AsOf.IsZero() {
		t.Fatalf("metrics summary = %#v", summary)
	}
}
