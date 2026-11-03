// Package permission 定义 Organization 稳定精确权限键。
package permission

import permissioncatalog "github.com/reina0721/clouddrive/internal/permission"

const (
	DepartmentRead  permissioncatalog.Key = "organization:department:read"
	DepartmentWrite permissioncatalog.Key = "organization:department:write"
	PositionRead    permissioncatalog.Key = "organization:position:read"
	PositionWrite   permissioncatalog.Key = "organization:position:write"
)
