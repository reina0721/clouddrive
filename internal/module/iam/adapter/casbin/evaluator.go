// Package casbin 是 IAM 对 Apache Casbin evaluator 的 module-owned 窄适配。
//
// 本包是仓库中唯一允许出现 github.com/casbin/casbin/v3 类型的边界：
// Casbin Enforcer、Model 与 policy slice 只在这里构造和使用，对外只暴露
// 项目自有的 Evaluator 值对象。Casbin 只执行固定 Core RBAC 的只读判断，
// 发布后的 Evaluator 不允许再调用任何 Casbin mutation API。
package casbin

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/casbin/casbin/v3"
	casbinlog "github.com/casbin/casbin/v3/log"
	casbinmodel "github.com/casbin/casbin/v3/model"
	"github.com/reina0721/clouddrive/internal/module/iam/repo"
)

// coreRBACModelText 是 IAM 固定的 Core RBAC model。
//
// 它只表达“账号拥有精确权限”的二元判断：request 为 sub/obj；
// policy 为 p = sub, obj；角色关系 g = _, _ 只由 Repository 的
// PolicySnapshot 生成 account -> role 分组。该文本是 module-owned 的
// 固定实现资产，不进入用户配置；修改它等同于修改公共授权语义，
// 必须重新研究并确认。
const coreRBACModelText = `
[request_definition]
r = sub, obj

[policy_definition]
p = sub, obj

[role_definition]
g = _, _

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = g(r.sub, p.sub) && r.obj == p.obj
`

// Evaluator 是发布后只读的不可变授权求值器，携带其所属 authorization revision。
type Evaluator struct {
	revision uint64
	enforcer *casbin.SyncedEnforcer
}

// New 从规范化 PolicySnapshot 构造完整 Evaluator；snapshot 必须由
// Repository 完成排序、去重和 Catalog 校验。任何非法规则、重复规则或
// 构造错误都会整体失败，不产生可用的部分 evaluator。
func New(ctx context.Context, snapshot repo.PolicySnapshot) (*Evaluator, error) {
	if ctx == nil {
		return nil, errors.New("casbin evaluator context is nil")
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if err := validateSnapshot(snapshot); err != nil {
		return nil, err
	}
	model, err := casbinmodel.NewModelFromString(coreRBACModelText)
	if err != nil {
		return nil, fmt.Errorf("build casbin core rbac model: %w", err)
	}
	enforcer, err := casbin.NewSyncedEnforcer(model)
	if err != nil {
		return nil, fmt.Errorf("build casbin synced enforcer: %w", err)
	}
	enforcer.EnableAutoSave(false)
	enforcer.SetLogger(silentLogger{})
	for _, rule := range snapshot.AccountRoles {
		added, err := enforcer.AddGroupingPolicy(rule.Account, rule.Role)
		if err != nil {
			return nil, fmt.Errorf("load account role rule (%s, %s): %w", rule.Account, rule.Role, err)
		}
		if !added {
			return nil, fmt.Errorf("account role rule (%s, %s) is duplicated in policy snapshot", rule.Account, rule.Role)
		}
	}
	for _, rule := range snapshot.RolePermissions {
		added, err := enforcer.AddPolicy(rule.Role, rule.Permission)
		if err != nil {
			return nil, fmt.Errorf("load role permission rule (%s, %s): %w", rule.Role, rule.Permission, err)
		}
		if !added {
			return nil, fmt.Errorf("role permission rule (%s, %s) is duplicated in policy snapshot", rule.Role, rule.Permission)
		}
	}
	if err := verifyLoaded(snapshot, enforcer); err != nil {
		return nil, err
	}
	return &Evaluator{revision: snapshot.Revision, enforcer: enforcer}, nil
}

// Revision 返回本 evaluator 对应的 authorization revision。
func (e *Evaluator) Revision() uint64 {
	if e == nil {
		return 0
	}
	return e.revision
}

// Decide 在固定 revision 下判断账号是否拥有精确权限键；subject 是账号 ID，
// permission 是 PermissionKey。调用方 context 的取消/超时被保留并优先返回，
// Casbin 求值错误被保留错误链导出。
func (e *Evaluator) Decide(ctx context.Context, subject string, permission string) (bool, error) {
	if e == nil || e.enforcer == nil {
		return false, errors.New("casbin evaluator is unavailable")
	}
	if ctx == nil {
		return false, errors.New("casbin decision context is nil")
	}
	if err := ctx.Err(); err != nil {
		return false, err
	}
	if strings.TrimSpace(subject) == "" || strings.TrimSpace(permission) == "" {
		return false, errors.New("casbin decision subject or permission is empty")
	}
	allowed, err := e.enforcer.Enforce(repo.PolicySubjectPrefix+subject, repo.PolicyPermissionPrefix+permission)
	if err != nil {
		return false, fmt.Errorf("casbin decision failed: %w", err)
	}
	return allowed, nil
}

// PermissionsForSubject 返回账号在 evaluator 当前 revision 下的全部有效
// 权限键（精确匹配、去重、稳定排序）；只用于同 revision 的前端投影，
// 服务端授权仍逐 operation 调用 Decide。
func (e *Evaluator) PermissionsForSubject(ctx context.Context, subject string) ([]string, error) {
	if e == nil || e.enforcer == nil {
		return nil, errors.New("casbin evaluator is unavailable")
	}
	if ctx == nil {
		return nil, errors.New("casbin evaluator context is nil")
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if strings.TrimSpace(subject) == "" {
		return nil, errors.New("casbin evaluator subject is empty")
	}
	encoded := repo.PolicySubjectPrefix + subject
	roles, err := e.enforcer.GetRolesForUser(encoded)
	if err != nil {
		return nil, fmt.Errorf("casbin roles query failed for subject: %w", err)
	}
	seen := map[string]struct{}{}
	for _, role := range roles {
		items, err := e.enforcer.GetFilteredPolicy(0, role)
		if err != nil {
			return nil, fmt.Errorf("casbin permissions query failed for role %s: %w", role, err)
		}
		for _, item := range items {
			if len(item) < 2 {
				return nil, fmt.Errorf("casbin permission rule %v is malformed", item)
			}
			value, ok := strings.CutPrefix(item[1], repo.PolicyPermissionPrefix)
			if !ok || value == "" {
				return nil, fmt.Errorf("casbin permission rule %v has no %q prefix", item, repo.PolicyPermissionPrefix)
			}
			seen[value] = struct{}{}
		}
	}
	result := make([]string, 0, len(seen))
	for value := range seen {
		result = append(result, value)
	}
	sort.Strings(result)
	return result, nil
}

// validateSnapshot 校验 snapshot 的 revision 与规则的编码完整性和唯一性。
func validateSnapshot(snapshot repo.PolicySnapshot) error {
	if snapshot.Revision == 0 {
		return errors.New("policy snapshot revision is zero")
	}
	groups := make(map[repo.AccountRoleRule]struct{}, len(snapshot.AccountRoles))
	for _, rule := range snapshot.AccountRoles {
		if !encodes(rule.Account, repo.PolicySubjectPrefix) {
			return fmt.Errorf("account role rule account %q is not %q encoded", rule.Account, repo.PolicySubjectPrefix)
		}
		if !encodes(rule.Role, repo.PolicyRolePrefix) {
			return fmt.Errorf("account role rule role %q is not %q encoded", rule.Role, repo.PolicyRolePrefix)
		}
		if _, exists := groups[rule]; exists {
			return fmt.Errorf("account role rule (%s, %s) is duplicated", rule.Account, rule.Role)
		}
		groups[rule] = struct{}{}
	}
	policies := make(map[repo.RolePermissionRule]struct{}, len(snapshot.RolePermissions))
	for _, rule := range snapshot.RolePermissions {
		if !encodes(rule.Role, repo.PolicyRolePrefix) {
			return fmt.Errorf("role permission rule role %q is not %q encoded", rule.Role, repo.PolicyRolePrefix)
		}
		if !encodes(rule.Permission, repo.PolicyPermissionPrefix) {
			return fmt.Errorf("role permission rule permission %q is not %q encoded", rule.Permission, repo.PolicyPermissionPrefix)
		}
		if _, exists := policies[rule]; exists {
			return fmt.Errorf("role permission rule (%s, %s) is duplicated", rule.Role, rule.Permission)
		}
		policies[rule] = struct{}{}
	}
	return nil
}

// verifyLoaded 复核 Enforcer 实际装载的规则数与 snapshot 完全一致，防止
// 任何规则在被 Codable 边界吞掉后评估器仍然发布。
func verifyLoaded(snapshot repo.PolicySnapshot, enforcer *casbin.SyncedEnforcer) error {
	roles, err := enforcer.GetGroupingPolicy()
	if err != nil {
		return fmt.Errorf("verify loaded grouping policy: %w", err)
	}
	if len(roles) != len(snapshot.AccountRoles) {
		return fmt.Errorf("loaded %d grouping rules while snapshot has %d", len(roles), len(snapshot.AccountRoles))
	}
	policies, err := enforcer.GetPolicy()
	if err != nil {
		return fmt.Errorf("verify loaded policy: %w", err)
	}
	if len(policies) != len(snapshot.RolePermissions) {
		return fmt.Errorf("loaded %d policy rules while snapshot has %d", len(policies), len(snapshot.RolePermissions))
	}
	return nil
}

func encodes(value, prefix string) bool {
	remaining, ok := strings.CutPrefix(value, prefix)
	return ok && remaining != ""
}

// silentLogger 是 Casbin 事件日志的静默实现：Evaluator 关闭所有事件日志，
// 防止授权主体、权限键或 matcher 细节进入任何日志 sink 或审计通道。
type silentLogger struct{}

func (silentLogger) SetEventTypes([]casbinlog.EventType) error            { return nil }
func (silentLogger) SetLogCallback(func(*casbinlog.LogEntry) error) error { return nil }
func (silentLogger) OnBeforeEvent(*casbinlog.LogEntry) error              { return nil }
func (silentLogger) OnAfterEvent(*casbinlog.LogEntry) error               { return nil }
