package casbin_test

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/reina0721/clouddrive/internal/module/iam/adapter/casbin"
	"github.com/reina0721/clouddrive/internal/module/iam/repo"
)

// fixtureEvaluator 构造覆盖 owner/reader/writer 角色与多角色合并的固定快照。
func fixtureEvaluator(t *testing.T) *casbin.Evaluator {
	t.Helper()
	snapshot := repo.PolicySnapshot{
		Revision: 7,
		AccountRoles: []repo.AccountRoleRule{
			{Account: "account:acc-owner", Role: "role:role-owner"},
			{Account: "account:acc-member", Role: "role:role-reader"},
			{Account: "account:acc-multi", Role: "role:role-reader"},
			{Account: "account:acc-multi", Role: "role:role-writer"},
		},
		RolePermissions: []repo.RolePermissionRule{
			{Role: "role:role-owner", Permission: "permission:iam:account:read"},
			{Role: "role:role-owner", Permission: "permission:iam:role:write"},
			{Role: "role:role-owner", Permission: "permission:organization:department:read"},
			{Role: "role:role-reader", Permission: "permission:iam:account:read"},
			{Role: "role:role-writer", Permission: "permission:iam:role:write"},
		},
	}
	evaluator, err := casbin.New(t.Context(), snapshot)
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	return evaluator
}

func TestEvaluatorExactCoreRBACDecisionMatrix(t *testing.T) {
	evaluator := fixtureEvaluator(t)
	cases := []struct {
		name       string
		subject    string
		permission string
		allowed    bool
	}{
		{"owner allowed", "acc-owner", "iam:account:read", true},
		{"owner second permission", "acc-owner", "iam:role:write", true},
		{"owner third permission", "acc-owner", "organization:department:read", true},
		{"owner denies unknown key", "acc-owner", "iam:account:delete", false},
		{"reader allowed", "acc-member", "iam:account:read", true},
		{"reader denies writer key", "acc-member", "iam:role:write", false},
		{"reader denies owner key", "acc-member", "organization:department:read", false},
		{"no role denies all", "acc-none", "iam:account:read", false},
		{"unknown account denies", "acc-ghost", "iam:account:read", false},
		{"multi role union allows reader key", "acc-multi", "iam:account:read", true},
		{"multi role union allows writer key", "acc-multi", "iam:role:write", true},
		{"multi role union denies third key", "acc-multi", "organization:department:read", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			allowed, err := evaluator.Decide(t.Context(), tc.subject, tc.permission)
			if err != nil {
				t.Fatalf("Decide() error = %v", err)
			}
			if allowed != tc.allowed {
				t.Fatalf("Decide(%q, %q) = %t, want %t", tc.subject, tc.permission, allowed, tc.allowed)
			}
		})
	}
}

// TestEvaluatorPrefixIsolation 证明账号与角色命名空间前缀隔离：账号 ID 与
// 角色 ID 相同也不会错误继承角色权限。
func TestEvaluatorPrefixIsolation(t *testing.T) {
	snapshot := repo.PolicySnapshot{
		Revision: 1,
		AccountRoles: []repo.AccountRoleRule{
			// 只有账号 "v2" 显式链接角色 "u1"；账号 "u1" 与角色 "u1" 仅字符串相同。
			{Account: "account:v2", Role: "role:u1"},
		},
		RolePermissions: []repo.RolePermissionRule{
			{Role: "role:u1", Permission: "permission:iam:role:read"},
		},
	}
	evaluator, err := casbin.New(t.Context(), snapshot)
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	// 账号 "u1"（与角色 "u1" 同名）没有显式链接，必须拒绝角色权限。
	if allowed, err := evaluator.Decide(t.Context(), "u1", "iam:role:read"); err != nil || allowed {
		t.Fatalf("unlinked account Decide() = %t, %v; want false", allowed, err)
	}
	// 显式链接的账号 "v2" 正常获得角色 "u1" 的权限。
	if allowed, err := evaluator.Decide(t.Context(), "v2", "iam:role:read"); err != nil || !allowed {
		t.Fatalf("linked account Decide() = %t, %v; want true", allowed, err)
	}
	// 同名账号的权限投影必须为空，不包含角色 "u1" 的权限。
	keys, err := evaluator.PermissionsForSubject(t.Context(), "u1")
	if err != nil || len(keys) != 0 {
		t.Fatalf("PermissionsForSubject(u1) = %v, %v; want empty", keys, err)
	}
}

// TestEvaluatorRejectsNormalizationViolations 校验非法或重复规则在构造期整体失败。
func TestEvaluatorRejectsNormalizationViolations(t *testing.T) {
	base := repo.PolicySnapshot{
		Revision: 1,
		AccountRoles: []repo.AccountRoleRule{
			{Account: "account:acc-1", Role: "role:role-1"},
		},
		RolePermissions: []repo.RolePermissionRule{
			{Role: "role:role-1", Permission: "permission:iam:account:read"},
		},
	}
	t.Run("zero revision", func(t *testing.T) {
		invalid := base
		invalid.Revision = 0
		if _, err := casbin.New(t.Context(), invalid); err == nil {
			t.Fatal("New(zero revision) succeeded")
		}
	})
	t.Run("duplicate account role", func(t *testing.T) {
		invalid := base
		invalid.AccountRoles = append(invalid.AccountRoles, invalid.AccountRoles[0])
		if _, err := casbin.New(t.Context(), invalid); err == nil {
			t.Fatal("New(duplicate account role) succeeded")
		}
	})
	t.Run("duplicate role permission", func(t *testing.T) {
		invalid := base
		invalid.RolePermissions = append(invalid.RolePermissions, invalid.RolePermissions[0])
		if _, err := casbin.New(t.Context(), invalid); err == nil {
			t.Fatal("New(duplicate role permission) succeeded")
		}
	})
	t.Run("unencoded account", func(t *testing.T) {
		invalid := base
		invalid.AccountRoles = []repo.AccountRoleRule{{Account: "acc-1", Role: "role:role-1"}}
		if _, err := casbin.New(t.Context(), invalid); err == nil {
			t.Fatal("New(unencoded account) succeeded")
		}
	})
	t.Run("unencoded permission", func(t *testing.T) {
		invalid := base
		invalid.RolePermissions = []repo.RolePermissionRule{{Role: "role:role-1", Permission: "iam:account:read"}}
		if _, err := casbin.New(t.Context(), invalid); err == nil {
			t.Fatal("New(unencoded permission) succeeded")
		}
	})
}

// TestEvaluatorConcurrentEnforceAndQuery 验证 SyncedEnforcer 边界下并发
// Enforce 与只读查询结果一致（配合 -race 运行）。
func TestEvaluatorConcurrentEnforceAndQuery(t *testing.T) {
	evaluator := fixtureEvaluator(t)
	const workers = 24
	const rounds = 200
	var wait sync.WaitGroup
	failures := make(chan string, workers)
	for worker := 0; worker < workers; worker++ {
		wait.Add(1)
		go func(worker int) {
			defer wait.Done()
			for round := 0; round < rounds; round++ {
				if round%3 == 0 {
					allowed, err := evaluator.Decide(context.Background(), "acc-multi", "iam:role:write")
					if err != nil || !allowed {
						failures <- "multi allow decision mismatch"
						return
					}
					continue
				}
				if round%3 == 1 {
					allowed, err := evaluator.Decide(context.Background(), "acc-member", "organization:department:read")
					if err != nil || allowed {
						failures <- "member deny decision mismatch"
						return
					}
					continue
				}
				keys, err := evaluator.PermissionsForSubject(context.Background(), "acc-owner")
				if err != nil || len(keys) != 3 {
					failures <- "owner projection mismatch"
					return
				}
			}
		}(worker)
	}
	wait.Wait()
	close(failures)
	for failure := range failures {
		t.Fatal(failure)
	}
}

// TestEvaluatorPermissionsForSubject 验证同 revision 的权限投影去重、去前缀并按序导出。
func TestEvaluatorPermissionsForSubject(t *testing.T) {
	evaluator := fixtureEvaluator(t)
	cases := []struct {
		subject string
		keys    []string
	}{
		{"acc-owner", []string{"iam:account:read", "iam:role:write", "organization:department:read"}},
		{"acc-member", []string{"iam:account:read"}},
		{"acc-none", []string(nil)},
	}
	for _, tc := range cases {
		keys, err := evaluator.PermissionsForSubject(t.Context(), tc.subject)
		if err != nil {
			t.Fatalf("PermissionsForSubject(%q) error = %v", tc.subject, err)
		}
		if len(keys) != len(tc.keys) {
			t.Fatalf("PermissionsForSubject(%q) = %v, want %v", tc.subject, keys, tc.keys)
		}
		for index := range keys {
			if keys[index] != tc.keys[index] {
				t.Fatalf("PermissionsForSubject(%q) = %v, want %v", tc.subject, keys, tc.keys)
			}
		}
	}
}

// TestEvaluatorErrorSemantics 验证取消、deadline、nil context 与空输入的错误语义。
func TestEvaluatorErrorSemantics(t *testing.T) {
	snapshot := repo.PolicySnapshot{
		Revision: 3,
		AccountRoles: []repo.AccountRoleRule{
			{Account: "account:acc-1", Role: "role:role-1"},
		},
		RolePermissions: []repo.RolePermissionRule{
			{Role: "role:role-1", Permission: "permission:iam:account:read"},
		},
	}
	evaluator, err := casbin.New(t.Context(), snapshot)
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	if evaluator.Revision() != 3 {
		t.Fatalf("Revision() = %d, want 3", evaluator.Revision())
	}
	canceled, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := evaluator.Decide(canceled, "acc-1", "iam:account:read"); !errors.Is(err, context.Canceled) {
		t.Fatalf("Decide(canceled) error = %v, want context.Canceled", err)
	}
	if _, err := evaluator.PermissionsForSubject(canceled, "acc-1"); !errors.Is(err, context.Canceled) {
		t.Fatalf("PermissionsForSubject(canceled) error = %v, want context.Canceled", err)
	}
	expired, expire := context.WithDeadline(context.Background(), time.Now().Add(-time.Second))
	defer expire()
	if _, err := evaluator.Decide(expired, "acc-1", "iam:account:read"); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("Decide(expired) error = %v, want context.DeadlineExceeded", err)
	}
	if _, err := evaluator.Decide(nil, "acc-1", "iam:account:read"); err == nil {
		t.Fatal("Decide(nil ctx) succeeded")
	}
	if _, err := evaluator.Decide(t.Context(), "", "iam:account:read"); err == nil {
		t.Fatal("Decide(empty subject) succeeded")
	}
	if _, err := evaluator.Decide(t.Context(), "acc-1", ""); err == nil {
		t.Fatal("Decide(empty permission) succeeded")
	}
	if _, err := casbin.New(nil, snapshot); err == nil {
		t.Fatal("New(nil ctx) succeeded")
	}
}
