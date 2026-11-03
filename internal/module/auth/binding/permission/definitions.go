// Package permission 声明当前 Auth 模块拥有的权限完成品。
package permission

import (
	authmodel "github.com/reina0721/clouddrive/internal/module/auth/model"
	permissioncatalog "github.com/reina0721/clouddrive/internal/permission"
)

// Definitions 返回当前管理面 operation 使用的精确权限定义。
func Definitions() []permissioncatalog.Definition {
	return []permissioncatalog.Definition{
		{Key: permissioncatalog.Key(authmodel.ScopeManagementRead), OwnerModuleID: "auth", DescriptionMessageID: "permission.auth.management.read", Risk: permissioncatalog.RiskElevated},
		{Key: permissioncatalog.Key(authmodel.ScopeAuditRead), OwnerModuleID: "auth", DescriptionMessageID: "permission.auth.audit.read", Risk: permissioncatalog.RiskElevated},
	}
}
