// Package permission 把 Navigation 权限贡献给应用 Catalog。
package permission

import (
	navigationpermission "github.com/reina0721/clouddrive/internal/module/navigation/permission"
	permissioncatalog "github.com/reina0721/clouddrive/internal/permission"
)

func Definitions() []permissioncatalog.Definition {
	return []permissioncatalog.Definition{
		{Key: navigationpermission.MenuRead, OwnerModuleID: "navigation", DescriptionMessageID: "permission.navigation.menu.read", Risk: permissioncatalog.RiskStandard},
		{Key: navigationpermission.MenuWrite, OwnerModuleID: "navigation", DescriptionMessageID: "permission.navigation.menu.write", Risk: permissioncatalog.RiskElevated},
	}
}
