package repo

// 本文件定义 IAM 授权 policy snapshot：Repository 以稳定、去重、已过滤、
// 已编码的项目类型输出授权投影，业务 Service 与 Casbin Adapter 只消费该投影。
// 编码前缀属于 snapshot 协议（evaluator 使用），避免账号 ID 与角色 ID
// 命名空间碰撞；Repository 是唯一产生编码值的边界。

const (
	// PolicySubjectPrefix 是账号主体在 policy 图中的命名空间前缀。
	PolicySubjectPrefix = "account:"
	// PolicyRolePrefix 是角色在 policy 图中的命名空间前缀。
	PolicyRolePrefix = "role:"
	// PolicyPermissionPrefix 是权限键在 policy 图中的命名空间前缀。
	PolicyPermissionPrefix = "permission:"
)

// AccountRoleRule 是一条已编码的账号到角色分组规则（g, account:<id>, role:<id>）。
type AccountRoleRule struct {
	// Account 是带 PolicySubjectPrefix 前缀的账号 ID。
	Account string
	// Role 是带 PolicyRolePrefix 前缀的角色 ID。
	Role string
}

// RolePermissionRule 是一条已编码的角色到权限策略规则（p, role:<id>, permission:<key>）。
type RolePermissionRule struct {
	// Role 是带 PolicyRolePrefix 前缀的角色 ID。
	Role string
	// Permission 是带 PolicyPermissionPrefix 前缀的权限键。
	Permission string
}

// PolicySnapshot 是当前 authorization revision 下完整、有序、只含有效关系的授权投影。
type PolicySnapshot struct {
	// Revision 是产生本快照的 authorization revision，非零。
	Revision uint64
	// AccountRoles 按 (Account, Role) 稳定排序且去重，只含 active、非 archived 角色关系。
	AccountRoles []AccountRoleRule
	// RolePermissions 按 (Role, Permission) 稳定排序且去重，只含 active、非 archived 角色权限。
	RolePermissions []RolePermissionRule
}
