// Package permission 声明 IAM 自有的稳定权限键。
package permission

import permissioncatalog "github.com/reina0721/clouddrive/internal/permission"
import iampermission "github.com/reina0721/clouddrive/internal/module/iam/permission"

const (
	SelfRead             = iampermission.SelfRead
	SelfPasswordWrite    = iampermission.SelfPasswordWrite
	SelfProfileWrite     = iampermission.SelfProfileWrite
	SelfPreferencesRead  = iampermission.SelfPreferencesRead
	SelfPreferencesWrite = iampermission.SelfPreferencesWrite
	SelfArchive          = iampermission.SelfArchive
	AccountRead          = iampermission.AccountRead
	AccountWrite         = iampermission.AccountWrite
	RoleRead             = iampermission.RoleRead
	RoleWrite            = iampermission.RoleWrite
	PermissionRead       = iampermission.PermissionRead
	SessionRead          = iampermission.SessionRead
	SessionRevoke        = iampermission.SessionRevoke
	ApiTokenRead         = iampermission.ApiTokenRead
	ApiTokenWrite        = iampermission.ApiTokenWrite
)

func Definitions() []permissioncatalog.Definition {
	return []permissioncatalog.Definition{
		{Key: SelfRead, OwnerModuleID: "iam", DescriptionMessageID: "permission.iam.self.read", Risk: permissioncatalog.RiskStandard},
		{Key: SelfPasswordWrite, OwnerModuleID: "iam", DescriptionMessageID: "permission.iam.self-password.write", Risk: permissioncatalog.RiskElevated},
		{Key: SelfProfileWrite, OwnerModuleID: "iam", DescriptionMessageID: "permission.iam.self-profile.write", Risk: permissioncatalog.RiskStandard},
		{Key: SelfPreferencesRead, OwnerModuleID: "iam", DescriptionMessageID: "permission.iam.self-preferences.read", Risk: permissioncatalog.RiskStandard},
		{Key: SelfPreferencesWrite, OwnerModuleID: "iam", DescriptionMessageID: "permission.iam.self-preferences.write", Risk: permissioncatalog.RiskStandard},
		{Key: SelfArchive, OwnerModuleID: "iam", DescriptionMessageID: "permission.iam.self-archive", Risk: permissioncatalog.RiskElevated},
		{Key: AccountRead, OwnerModuleID: "iam", DescriptionMessageID: "permission.iam.account.read", Risk: permissioncatalog.RiskElevated},
		{Key: AccountWrite, OwnerModuleID: "iam", DescriptionMessageID: "permission.iam.account.write", Risk: permissioncatalog.RiskCritical},
		{Key: RoleRead, OwnerModuleID: "iam", DescriptionMessageID: "permission.iam.role.read", Risk: permissioncatalog.RiskElevated},
		{Key: RoleWrite, OwnerModuleID: "iam", DescriptionMessageID: "permission.iam.role.write", Risk: permissioncatalog.RiskCritical},
		{Key: PermissionRead, OwnerModuleID: "iam", DescriptionMessageID: "permission.iam.permission.read", Risk: permissioncatalog.RiskElevated},
		{Key: SessionRead, OwnerModuleID: "iam", DescriptionMessageID: "permission.iam.session.read", Risk: permissioncatalog.RiskElevated},
		{Key: SessionRevoke, OwnerModuleID: "iam", DescriptionMessageID: "permission.iam.session.revoke", Risk: permissioncatalog.RiskCritical},
		{Key: ApiTokenRead, OwnerModuleID: "iam", DescriptionMessageID: "permission.iam.api-token.read", Risk: permissioncatalog.RiskElevated},
		{Key: ApiTokenWrite, OwnerModuleID: "iam", DescriptionMessageID: "permission.iam.api-token.write", Risk: permissioncatalog.RiskCritical},
	}
}
