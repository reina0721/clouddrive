package service_test

import (
	"context"
	"errors"
	"testing"
	"time"

	iampermission "github.com/reina0721/clouddrive/internal/module/iam/binding/permission"
	"github.com/reina0721/clouddrive/internal/module/iam/model"
	"github.com/reina0721/clouddrive/internal/module/iam/repo"
	"github.com/reina0721/clouddrive/internal/module/iam/service"
	permissioncatalog "github.com/reina0721/clouddrive/internal/permission"
)

// TestConcurrentRolePermissionReplaceYieldsOneVersionConflict 验证两个管理员
// 使用同一 expected version 并发编辑角色权限时，恰好一个成功、一个稳定 409。
func TestConcurrentRolePermissionReplaceYieldsOneVersionConflict(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	if _, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345"); err != nil {
		t.Fatal(err)
	}
	role, err := iam.CreateRole(t.Context(), "reader", "只读", "")
	if err != nil {
		t.Fatal(err)
	}
	start := make(chan struct{})
	results := make(chan error, 2)
	for _, keys := range [][]permissioncatalog.Key{
		{iampermission.SelfRead},
		{iampermission.AccountRead},
	} {
		go func(desired []permissioncatalog.Key) {
			<-start
			_, err := iam.ReplaceRolePermissions(context.Background(), role.ID, 1, desired)
			results <- err
		}(keys)
	}
	close(start)
	first, second := <-results, <-results
	if first == nil && second == nil {
		t.Fatal("both concurrent replaces succeeded")
	}
	if first != nil && second != nil {
		t.Fatalf("both concurrent replaces failed: %v, %v", first, second)
	}
	conflicted := first
	if conflicted == nil {
		conflicted = second
	}
	if !errors.Is(conflicted, service.ErrVersionConflict) {
		t.Fatalf("loser error = %v, want ErrVersionConflict", conflicted)
	}
	view, err := iam.RolePermissionsSnapshot(t.Context(), role.ID)
	if err != nil || view.RoleVersion != 2 || len(view.PermissionKeys) != 1 {
		t.Fatalf("role permissions after race = %#v, %v", view, err)
	}
}

// TestReplaceAccountRolesRejectsInactiveRoleSets 验证 inactive/archived 角色
// 不能在替换时被分配，且整体失败（fail closed）。
func TestReplaceAccountRolesRejectsInactiveRoleSets(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	if _, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345"); err != nil {
		t.Fatal(err)
	}
	account, err := iam.CreateAccount(t.Context(), "member", "成员", "abcdefghijklmno")
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 8, 22, 1, 0, 0, 0, time.UTC)
	store := storeForResource(t, resource)
	if err := store.Use(t.Context(), func(unit *repo.Unit) error {
		return unit.CreateRole(t.Context(), &repo.RoleRecord{ID: "role-inactive", Code: "inactive", Name: "停用", Active: false, CreatedAt: now, UpdatedAt: now})
	}); err != nil {
		t.Fatal(err)
	}
	for _, roleID := range []string{"role-inactive", "role-ghost"} {
		if _, err := iam.ReplaceAccountRoles(t.Context(), account.ID, 1, []string{roleID}); !errors.Is(err, repo.ErrNotFound) {
			t.Fatalf("replace with %s error = %v, want ErrNotFound", roleID, err)
		}
	}
}

// TestReplaceRolePermissionsRejectsUnknownKeyWithoutWrite 验证 Catalog 之外
// 的权限键在任何写入前失败，角色版本保持不变。
func TestReplaceRolePermissionsRejectsUnknownKeyWithoutWrite(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	if _, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345"); err != nil {
		t.Fatal(err)
	}
	role, err := iam.CreateRole(t.Context(), "reader", "只读", "")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := iam.ReplaceRolePermissions(t.Context(), role.ID, 1, []permissioncatalog.Key{"ghost:permission:write"}); !errors.Is(err, service.ErrUnknownPermission) {
		t.Fatalf("unknown key error = %v", err)
	}
	view, err := iam.RolePermissionsSnapshot(t.Context(), role.ID)
	if err != nil || len(view.PermissionKeys) != 0 || view.RoleVersion != 1 {
		t.Fatalf("role permissions after rejected write = %#v, %v", view, err)
	}
}

// TestOwnerRolePermissionsAreImmutable 验证 owner 角色权限不可编辑。
func TestOwnerRolePermissionsAreImmutable(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	if _, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345"); err != nil {
		t.Fatal(err)
	}
	roles, err := iam.ListRoles(t.Context(), 0, 20, "")
	if err != nil || len(roles.Items) != 1 {
		t.Fatalf("roles = %#v, %v", roles, err)
	}
	owner := roles.Items[0]
	if owner.Code != model.OwnerRoleCode {
		t.Fatalf("expected owner role, got %#v", owner)
	}
	if _, err := iam.ReplaceRolePermissions(t.Context(), owner.ID, owner.Version, []permissioncatalog.Key{iampermission.SelfRead}); !errors.Is(err, service.ErrImmutableOwner) {
		t.Fatalf("owner edit error = %v", err)
	}
}

// TestCancelledContextPropagatesFromMutation 验证取消从 mutation 入口保留，
// 不吞掉 context 错误。
func TestCancelledContextPropagatesFromMutation(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	if _, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345"); err != nil {
		t.Fatal(err)
	}
	role, err := iam.CreateRole(t.Context(), "reader", "只读", "")
	if err != nil {
		t.Fatal(err)
	}
	canceled, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := iam.ReplaceRolePermissions(canceled, role.ID, 1, []permissioncatalog.Key{iampermission.SelfRead}); !errors.Is(err, context.Canceled) {
		t.Fatalf("canceled mutation error = %v, want context.Canceled", err)
	}
	if _, err := iam.Login(canceled, "owner", "123456789012345"); !errors.Is(err, context.Canceled) {
		t.Fatalf("canceled login error = %v, want context.Canceled", err)
	}
}

// TestDisabledAccountCannotResolveSession 验证账号禁用后既有 Session 全部失效，
// 且不能重新登录。
func TestDisabledAccountCannotResolveSession(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	if _, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345"); err != nil {
		t.Fatal(err)
	}
	account, err := iam.CreateAccount(t.Context(), "member", "成员", "abcdefghijklmno")
	if err != nil {
		t.Fatal(err)
	}
	session, err := iam.Login(t.Context(), "member", "abcdefghijklmno")
	if err != nil {
		t.Fatal(err)
	}
	if err := iam.SetAccountStatus(t.Context(), account.ID, model.AccountDisabled); err != nil {
		t.Fatal(err)
	}
	if _, err := iam.Resolve(t.Context(), session.ID); !errors.Is(err, service.ErrSessionInvalid) {
		t.Fatalf("disabled account session resolve = %v", err)
	}
	if _, err := iam.Login(t.Context(), "member", "abcdefghijklmno"); !errors.Is(err, service.ErrAccountDisabled) {
		t.Fatalf("disabled account login = %v", err)
	}
}
