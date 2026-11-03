package composition

import (
	"github.com/reina0721/clouddrive/internal/kernel/app"
	alertingapp "github.com/reina0721/clouddrive/internal/kernel/app/alerting"
	"github.com/reina0721/clouddrive/internal/kernel/config"
	pkgalerting "github.com/reina0721/clouddrive/pkg/alerting"
)

// AlertingDefinition 选择当前进程唯一的安全告警底层实现（Webhook）。
func AlertingDefinition(dependencies alertingapp.Dependencies) (app.Definition[pkgalerting.Notifier], error) {
	return alertingapp.Definition(dependencies)
}

// AlertingConfiguration 返回底层告警配置 authority。
func AlertingConfiguration() config.Binding { return alertingapp.Configuration() }
