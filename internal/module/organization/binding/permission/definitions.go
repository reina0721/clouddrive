// Package permission 把 Organization 权限贡献给应用 Catalog。
package permission

import (
	orgpermission "github.com/reina0721/clouddrive/internal/module/organization/permission"
	permissioncatalog "github.com/reina0721/clouddrive/internal/permission"
)

func Definitions() []permissioncatalog.Definition {
	return []permissioncatalog.Definition{
		{Key: orgpermission.DepartmentRead, OwnerModuleID: "organization", DescriptionMessageID: "permission.organization.department.read", Risk: permissioncatalog.RiskStandard},
		{Key: orgpermission.DepartmentWrite, OwnerModuleID: "organization", DescriptionMessageID: "permission.organization.department.write", Risk: permissioncatalog.RiskElevated},
		{Key: orgpermission.PositionRead, OwnerModuleID: "organization", DescriptionMessageID: "permission.organization.position.read", Risk: permissioncatalog.RiskStandard},
		{Key: orgpermission.PositionWrite, OwnerModuleID: "organization", DescriptionMessageID: "permission.organization.position.write", Risk: permissioncatalog.RiskElevated},
	}
}
