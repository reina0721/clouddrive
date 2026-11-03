// Package permission 定义 IAM 业务规则使用的稳定精确权限键。
package permission

import permissioncatalog "github.com/reina0721/clouddrive/internal/permission"

const (
	SelfRead             permissioncatalog.Key = "iam:account:self:read"
	SelfPasswordWrite    permissioncatalog.Key = "iam:account:self:password:write"
	SelfProfileWrite     permissioncatalog.Key = "iam:account:self:profile:write"
	SelfPreferencesRead  permissioncatalog.Key = "iam:account:self:preferences:read"
	SelfPreferencesWrite permissioncatalog.Key = "iam:account:self:preferences:write"
	SelfArchive          permissioncatalog.Key = "iam:account:self:archive"
	AccountRead          permissioncatalog.Key = "iam:account:read"
	AccountWrite         permissioncatalog.Key = "iam:account:write"
	RoleRead             permissioncatalog.Key = "iam:role:read"
	RoleWrite            permissioncatalog.Key = "iam:role:write"
	PermissionRead       permissioncatalog.Key = "iam:permission:read"
	SessionRead          permissioncatalog.Key = "iam:session:read"
	SessionRevoke        permissioncatalog.Key = "iam:session:revoke"
	ApiTokenRead         permissioncatalog.Key = "iam:api-token:read"
	ApiTokenWrite        permissioncatalog.Key = "iam:api-token:write"
)
