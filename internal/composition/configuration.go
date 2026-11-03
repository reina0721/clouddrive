package composition

import (
	composed "github.com/reina0721/clouddrive/internal/kernel/composition"
	"github.com/reina0721/clouddrive/internal/kernel/config"
	authconfig "github.com/reina0721/clouddrive/internal/module/auth/binding/config"
	"github.com/reina0721/clouddrive/internal/module/console"
	iamconfig "github.com/reina0721/clouddrive/internal/module/iam/binding/config"
	migrationconfig "github.com/reina0721/clouddrive/internal/module/migration/binding/config"
	opsconfig "github.com/reina0721/clouddrive/internal/module/ops/binding/config"
	todoconfig "github.com/reina0721/clouddrive/internal/module/todo/binding/config"
)

// applicationOwnedConfigurationBindings 返回统一正式配置中由应用模块拥有的 section。
// Bootstrap、Service 与 one-shot CLI 必须调用本函数，避免各入口复制集合后发生漂移。
func applicationOwnedConfigurationBindings() []config.Binding {
	return []config.Binding{
		authconfig.Binding(),
		console.Binding(),
		iamconfig.Binding(),
		migrationconfig.Binding(),
		todoconfig.Binding(),
		opsconfig.Binding(),
		composed.ObservabilityConfiguration(),
		composed.AlertingConfiguration(),
	}
}
