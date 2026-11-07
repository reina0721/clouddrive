// Package permission 声明文件模块的私有操作和管理清单权限。
package permission

import permissioncatalog "github.com/reina0721/clouddrive/internal/permission"

const (
	Read             permissioncatalog.Key = "files:read"
	Write            permissioncatalog.Key = "files:write"
	InventoryRead    permissioncatalog.Key = "files:inventory:read"
	BlobRead         permissioncatalog.Key = "files:blob:read"
	BlobReclaim      permissioncatalog.Key = "files:blob:reclaim"
	SettingsRead     permissioncatalog.Key = "files:settings:read"
	SettingsWrite    permissioncatalog.Key = "files:settings:write"
	AdminShareRead   permissioncatalog.Key = "files:share-admin:read"
	AdminShareRevoke permissioncatalog.Key = "files:share-admin:revoke"
)

func Definitions() []permissioncatalog.Definition {
	return []permissioncatalog.Definition{
		{Key: Read, OwnerModuleID: "files", DescriptionMessageID: "permission.files.read", Risk: permissioncatalog.RiskStandard},
		{Key: Write, OwnerModuleID: "files", DescriptionMessageID: "permission.files.write", Risk: permissioncatalog.RiskElevated},
		{Key: InventoryRead, OwnerModuleID: "files", DescriptionMessageID: "permission.files.inventory.read", Risk: permissioncatalog.RiskElevated},
		{Key: BlobRead, OwnerModuleID: "files", DescriptionMessageID: "permission.files.blob.read", Risk: permissioncatalog.RiskElevated},
		{Key: BlobReclaim, OwnerModuleID: "files", DescriptionMessageID: "permission.files.blob.reclaim", Risk: permissioncatalog.RiskCritical},
		{Key: SettingsRead, OwnerModuleID: "files", DescriptionMessageID: "permission.files.settings.read", Risk: permissioncatalog.RiskElevated},
		{Key: SettingsWrite, OwnerModuleID: "files", DescriptionMessageID: "permission.files.settings.write", Risk: permissioncatalog.RiskCritical},
		{Key: AdminShareRead, OwnerModuleID: "files", DescriptionMessageID: "permission.files.share-admin.read", Risk: permissioncatalog.RiskElevated},
		{Key: AdminShareRevoke, OwnerModuleID: "files", DescriptionMessageID: "permission.files.share-admin.revoke", Risk: permissioncatalog.RiskCritical},
	}
}
