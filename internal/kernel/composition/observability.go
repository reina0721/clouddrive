package composition

import (
	"github.com/reina0721/clouddrive/internal/kernel/app"
	observabilityapp "github.com/reina0721/clouddrive/internal/kernel/app/observability"
	"github.com/reina0721/clouddrive/internal/kernel/config"
	pkgobservability "github.com/reina0721/clouddrive/pkg/observability"
)

// ObservabilityMetricsDefinition 选择当前进程唯一的 Metrics 底层实现。
func ObservabilityMetricsDefinition() (app.Definition[pkgobservability.Metrics], error) {
	return observabilityapp.MetricsDefinition()
}

// ObservabilityTelemetryDefinition 选择当前进程唯一的 Telemetry 底层实现。
func ObservabilityTelemetryDefinition(metrics pkgobservability.Metrics) (app.Definition[pkgobservability.Telemetry], error) {
	return observabilityapp.TelemetryDefinition(metrics)
}

// ObservabilityConfiguration 返回底层 Observability 配置 authority。
func ObservabilityConfiguration() config.Binding { return observabilityapp.Configuration() }
