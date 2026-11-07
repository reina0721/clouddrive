// Package permission 声明文件模块的私有操作和管理清单权限。
package permission

import permissioncatalog "github.com/reina0721/clouddrive/internal/permission"

const (
	Read          permissioncatalog.Key = "files:read"
	Write         permissioncatalog.Key = "files:write"
	InventoryRead permissioncatalog.Key = "files:inventory:read"
	BlobRead      permissioncatalog.Key = "files:blob:read"
)

func Definitions() []permissioncatalog.Definition {
	return []permissioncatalog.Definition{
		{Key: Read, OwnerModuleID: "files", DescriptionMessageID: "permission.files.read", Risk: permissioncatalog.RiskStandard},
		{Key: Write, OwnerModuleID: "files", DescriptionMessageID: "permission.files.write", Risk: permissioncatalog.RiskElevated},
		{Key: InventoryRead, OwnerModuleID: "files", DescriptionMessageID: "permission.files.inventory.read", Risk: permissioncatalog.RiskElevated},
		{Key: BlobRead, OwnerModuleID: "files", DescriptionMessageID: "permission.files.blob.read", Risk: permissioncatalog.RiskElevated},
	}
}
