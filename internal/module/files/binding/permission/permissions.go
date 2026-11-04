// Package permission 声明文件模块的私有文件操作权限。
package permission

import permissioncatalog "github.com/reina0721/clouddrive/internal/permission"

func Definitions() []permissioncatalog.Definition {
	return []permissioncatalog.Definition{
		{Key: "files:read", OwnerModuleID: "files", DescriptionMessageID: "permission.files.read", Risk: permissioncatalog.RiskStandard},
		{Key: "files:write", OwnerModuleID: "files", DescriptionMessageID: "permission.files.write", Risk: permissioncatalog.RiskElevated},
	}
}
