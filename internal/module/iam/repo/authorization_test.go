// Package repo_test 覆盖 IAM authorization revision 与 policy snapshot 的
// Repository 契约；使用 SQLite runtime，Postgres/MySQL 走 env 驱动契约测试。
package repo_test

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
	"time"

	migrationbinding "github.com/reina0721/clouddrive/internal/module/iam/binding/migration"
	iampermission "github.com/reina0721/clouddrive/internal/module/iam/binding/permission"
	"github.com/reina0721/clouddrive/internal/module/iam/repo"
	permissioncatalog "github.com/reina0721/clouddrive/internal/permission"
	"github.com/reina0721/clouddrive/pkg/database"
	dbmigrate "github.com/reina0721/clouddrive/pkg/database/migrate"
	"gorm.io/gorm"
)

func TestAuthorizationSnapshotNormalization(t *testing.T) {
	store, resource := newStore(t)
	defer resource.Close()
	fixed := time.Date(2026, 8, 22, 1, 0, 0, 0, time.UTC)
	if err := store.Use(t.Context(), func(unit *repo.Unit) error {
		if err := unit.CreateRole(t.Context(), &repo.RoleRecord{ID: "role-owner", Code: "owner", Name: "所有者", Active: true, System: true, CreatedAt: fixed, UpdatedAt: fixed}); err != nil {
			return err
		}
		if err := unit.CreateRole(t.Context(), &repo.RoleRecord{ID: "role-custom", Code: "reader", Name: "只读", Active: true, CreatedAt: fixed, UpdatedAt: fixed}); err != nil {
			return err
		}
		// 归档与停用角色都必须从快照中排除。
		if err := unit.CreateRole(t.Context(), &repo.RoleRecord{ID: "role-archived", Code: "archived", Name: "归档", Active: true, Archived: true, CreatedAt: fixed, UpdatedAt: fixed}); err != nil {
			return err
		}
		if err := unit.CreateRole(t.Context(), &repo.RoleRecord{ID: "role-inactive", Code: "inactive", Name: "停用", Active: false, CreatedAt: fixed, UpdatedAt: fixed}); err != nil {
			return err
		}
		for _, id := range []string{"acc-1", "acc-2"} {
			if err := unit.CreateAccount(t.Context(), &repo.AccountRecord{ID: id, Username: "user_" + id, DisplayName: "账号 " + id, Status: "active", SecurityRevision: 1, Version: 1, CreatedAt: fixed, UpdatedAt: fixed}); err != nil {
				return err
			}
		}
		if err := unit.CreateAccountRole(t.Context(), &repo.AccountRoleRecord{AccountID: "acc-1", RoleID: "role-owner", Active: true, UpdatedAt: fixed}); err != nil {
			return err
		}
		if err := unit.CreateAccountRole(t.Context(), &repo.AccountRoleRecord{AccountID: "acc-2", RoleID: "role-custom", Active: true, UpdatedAt: fixed}); err != nil {
			return err
		}
		// 停用关系与归档角色的关系必须排除。
		if err := unit.CreateAccountRole(t.Context(), &repo.AccountRoleRecord{AccountID: "acc-2", RoleID: "role-owner", Active: false, UpdatedAt: fixed}); err != nil {
			return err
		}
		if err := unit.CreateAccountRole(t.Context(), &repo.AccountRoleRecord{AccountID: "acc-2", RoleID: "role-archived", Active: true, UpdatedAt: fixed}); err != nil {
			return err
		}
		for _, item := range []repo.RolePermissionRecord{
			{RoleID: "role-owner", PermissionKey: string(iampermission.SelfRead), Active: true, UpdatedAt: fixed},
			{RoleID: "role-owner", PermissionKey: string(iampermission.AccountRead), Active: true, UpdatedAt: fixed},
			{RoleID: "role-custom", PermissionKey: string(iampermission.SelfRead), Active: true, UpdatedAt: fixed},
			// 非 active 权限与归档角色权限必须排除。
			{RoleID: "role-owner", PermissionKey: string(iampermission.RoleWrite), Active: false, UpdatedAt: fixed},
			{RoleID: "role-archived", PermissionKey: string(iampermission.RoleWrite), Active: true, UpdatedAt: fixed},
		} {
			if err := unit.CreateRolePermission(t.Context(), &item); err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	var snapshot repo.PolicySnapshot
	err := store.Use(t.Context(), func(unit *repo.Unit) error {
		var snapshotErr error
		snapshot, snapshotErr = unit.AuthorizationSnapshot(t.Context(), catalogForTest(t))
		return snapshotErr
	})
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.Revision != 1 {
		t.Fatalf("snapshot revision = %d, want 1", snapshot.Revision)
	}
	wantRoles := []repo.AccountRoleRule{
		{Account: "account:acc-1", Role: "role:role-owner"},
		{Account: "account:acc-2", Role: "role:role-custom"},
	}
	if len(snapshot.AccountRoles) != len(wantRoles) {
		t.Fatalf("account roles = %v, want %v", snapshot.AccountRoles, wantRoles)
	}
	for index := range wantRoles {
		if snapshot.AccountRoles[index] != wantRoles[index] {
			t.Fatalf("account roles = %v, want %v", snapshot.AccountRoles, wantRoles)
		}
	}
	wantPermissions := []repo.RolePermissionRule{
		{Role: "role:role-custom", Permission: "permission:iam:account:self:read"},
		{Role: "role:role-owner", Permission: "permission:iam:account:read"},
		{Role: "role:role-owner", Permission: "permission:iam:account:self:read"},
	}
	if len(snapshot.RolePermissions) != len(wantPermissions) {
		t.Fatalf("role permissions = %v, want %v", snapshot.RolePermissions, wantPermissions)
	}
	for index := range wantPermissions {
		if snapshot.RolePermissions[index] != wantPermissions[index] {
			t.Fatalf("role permissions = %v, want %v", snapshot.RolePermissions, wantPermissions)
		}
	}
}

// TestAuthorizationSnapshotRejectsUnknownPermission 验证 Catalog 之外的
// permission key 在 snapshot 构建期直接失败，不进入 evaluator。
func TestAuthorizationSnapshotRejectsUnknownPermission(t *testing.T) {
	store, resource := newStore(t)
	defer resource.Close()
	fixed := time.Date(2026, 8, 22, 1, 0, 0, 0, time.UTC)
	if err := store.Use(t.Context(), func(unit *repo.Unit) error {
		if err := unit.CreateRole(t.Context(), &repo.RoleRecord{ID: "role-custom", Code: "reader", Name: "只读", Active: true, CreatedAt: fixed, UpdatedAt: fixed}); err != nil {
			return err
		}
		return unit.CreateRolePermission(t.Context(), &repo.RolePermissionRecord{RoleID: "role-custom", PermissionKey: "ghost:permission:read", Active: true, UpdatedAt: fixed})
	}); err != nil {
		t.Fatal(err)
	}
	err := store.Use(t.Context(), func(unit *repo.Unit) error {
		_, snapshotErr := unit.AuthorizationSnapshot(t.Context(), catalogForTest(t))
		return snapshotErr
	})
	if !errors.Is(err, repo.ErrSnapshotIncompatible) {
		t.Fatalf("snapshot error = %v, want ErrSnapshotIncompatible", err)
	}
}

func TestAuthorizationRevisionBumpIsSequential(t *testing.T) {
	store, resource := newStore(t)
	defer resource.Close()
	fixed := time.Date(2026, 8, 22, 1, 0, 0, 0, time.UTC)
	err := store.Use(t.Context(), func(unit *repo.Unit) error {
		next, nextErr := unit.UpdateAuthorizationRevision(t.Context(), fixed)
		if nextErr != nil || next != 2 {
			return errors.Join(nextErr, errors.New("bumped revision must be 2"))
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}

// TestConcurrentAuthorizationRevisionBumps 验证两个并发 mutation 各自事务内
// 的 revision 递增都成功，且收敛为单调递增的最新值；evaluator publish 顺序
// 由任务 003 的 authorization write lock 保证。
func TestConcurrentAuthorizationRevisionBumps(t *testing.T) {
	store, resource := newStore(t)
	defer resource.Close()
	fixed := time.Date(2026, 8, 22, 1, 0, 0, 0, time.UTC)
	start := make(chan struct{})
	results := make(chan error, 2)
	for i := 0; i < 2; i++ {
		go func() {
			<-start
			results <- store.WithinTx(context.Background(), func(txCtx context.Context, unit *repo.Unit) error {
				_, err := unit.UpdateAuthorizationRevision(txCtx, fixed)
				return err
			})
		}()
	}
	close(start)
	for i := 0; i < 2; i++ {
		if err := <-results; err != nil {
			t.Fatalf("concurrent bump error = %v", err)
		}
	}
	if err := store.Use(t.Context(), func(unit *repo.Unit) error {
		current, err := unit.CurrentAuthorizationRevision(t.Context())
		if err != nil || current != 3 {
			return errors.Join(err, errors.New("final revision must be 3"))
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}
}

// TestAuthorizationRevisionMissingFailsClosed 验证单例行缺失时读取与递增都
// 返回可识别错误，不静默重建。
func TestAuthorizationRevisionMissingFailsClosed(t *testing.T) {
	store, resource := newStore(t)
	defer resource.Close()
	if err := database.Borrow(t.Context(), resource.Client(), func(client database.Client) error {
		return database.UseGORM(t.Context(), client, func(db *gorm.DB) error {
			return db.Exec("DELETE FROM iam_authorization_state WHERE id = 1").Error
		})
	}); err != nil {
		t.Fatal(err)
	}
	if err := store.Use(t.Context(), func(unit *repo.Unit) error {
		_, err := unit.CurrentAuthorizationRevision(t.Context())
		return err
	}); err != nil && !repo.IsNotFound(err) {
		t.Fatalf("current revision error = %v, want not found", err)
	}
	if err := store.Use(t.Context(), func(unit *repo.Unit) error {
		_, err := unit.UpdateAuthorizationRevision(t.Context(), time.Date(2026, 8, 22, 1, 0, 0, 0, time.UTC))
		return err
	}); !errors.Is(err, repo.ErrAuthorizationStateMissing) {
		t.Fatalf("bump revision error = %v, want ErrAuthorizationStateMissing", err)
	}
}

func catalogForTest(t *testing.T) permissioncatalog.Catalog {
	t.Helper()
	catalog, err := permissioncatalog.BuildCatalog(iampermission.Definitions()...)
	if err != nil {
		t.Fatal(err)
	}
	return catalog
}

func newStore(t *testing.T) (*repo.Store, database.Resource) {
	t.Helper()
	path := filepath.Join(t.TempDir(), "iam-repo.db")
	cfg := database.DefaultConfig()
	cfg.Driver = database.DriverSQLite
	cfg.DSN = path
	runner, err := dbmigrate.New(t.Context(), dbmigrate.Config{Database: cfg, LockTimeout: 5 * time.Second}, migrationbinding.Set())
	if err != nil {
		t.Fatal(err)
	}
	if err := runner.Up(t.Context()); err != nil {
		t.Fatal(err)
	}
	if err := runner.Close(); err != nil {
		t.Fatal(err)
	}
	resource, err := database.NewGORM(t.Context(), &cfg)
	if err != nil {
		t.Fatal(err)
	}
	store, err := repo.New(accessFor{resource})
	if err != nil {
		t.Fatal(err)
	}
	return store, resource
}

type accessFor struct{ resource database.Resource }

func (a accessFor) Use(ctx context.Context, use func(database.Client) error) error {
	return database.Borrow(ctx, a.resource.Client(), use)
}
func (a accessFor) WithinTx(ctx context.Context, use func(context.Context, database.Client, database.Tx) error) error {
	return a.Use(ctx, func(client database.Client) error {
		return client.WithinTx(ctx, func(txCtx context.Context, tx database.Tx) error { return use(txCtx, client, tx) })
	})
}
