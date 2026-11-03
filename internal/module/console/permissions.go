package console

import permission "github.com/reina0721/clouddrive/internal/permission"

// Permissions 声明控制台新增业务权限，不替代 IAM 自有权限。
func Permissions() []permission.Definition {
	return []permission.Definition{
		{Key: "console:settings:read", OwnerModuleID: "console", DescriptionMessageID: "permission.console.settings.read", Risk: permission.RiskElevated},
		{Key: "console:settings:write", OwnerModuleID: "console", DescriptionMessageID: "permission.console.settings.write", Risk: permission.RiskCritical},
		{Key: "console:dictionary:read", OwnerModuleID: "console", DescriptionMessageID: "permission.console.dictionary.read", Risk: permission.RiskStandard},
		{Key: "console:dictionary:write", OwnerModuleID: "console", DescriptionMessageID: "permission.console.dictionary.write", Risk: permission.RiskElevated},
		{Key: "console:workbench:read", OwnerModuleID: "console", DescriptionMessageID: "permission.console.workbench.read", Risk: permission.RiskStandard},
		{Key: "console:workbench:write", OwnerModuleID: "console", DescriptionMessageID: "permission.console.workbench.write", Risk: permission.RiskElevated},
		{Key: "console:workbench:execute", OwnerModuleID: "console", DescriptionMessageID: "permission.console.workbench.execute", Risk: permission.RiskCritical},
	}
}
