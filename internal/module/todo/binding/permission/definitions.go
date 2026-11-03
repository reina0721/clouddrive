// Package permission 声明 Todo 模块拥有的权限完成品。
package permission

import permissioncatalog "github.com/reina0721/clouddrive/internal/permission"

// Definitions 返回 Todo 当前真实 operation 使用的精确权限定义。
func Definitions() []permissioncatalog.Definition {
	return []permissioncatalog.Definition{
		{Key: "todos:read", OwnerModuleID: "todo", DescriptionMessageID: "permission.todo.read", Risk: permissioncatalog.RiskStandard},
		{Key: "todos:write", OwnerModuleID: "todo", DescriptionMessageID: "permission.todo.write", Risk: permissioncatalog.RiskElevated},
	}
}
