// Package authorization_test 覆盖 IAM AuthorizationRuntime 的加载、判断、
// 刷新、mutation 发布与 fail-closed 生命周期。
package authorization_test

import (
	"context"
	"errors"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/reina0721/clouddrive/internal/module/iam/authorization"
	migrationbinding "github.com/reina0721/clouddrive/internal/module/iam/binding/migration"
	iampermission "github.com/reina0721/clouddrive/internal/module/iam/binding/permission"
	"github.com/reina0721/clouddrive/internal/module/iam/repo"
	permissioncatalog "github.com/reina0721/clouddrive/internal/permission"
	"github.com/reina0721/clouddrive/pkg/database"
	dbmigrate "github.com/reina0721/clouddrive/pkg/database/migrate"
	"gorm.io/gorm"
)

var fixed = time.Date(2026, 8, 22, 1, 0, 0, 0, time.UTC)

// fixture 构造 owner/reader 两类角色与两个账号的最小授权数据库。
func fixture(t *testing.T) (*repo.Store, database.Resource, permissioncatalog.Catalog) {
	t.Helper()
	store, resource := newStore(t)
	if err := store.Use(t.Context(), func(unit *repo.Unit) error {
		if err := unit.CreateRole(t.Context(), &repo.RoleRecord{ID: "role-owner", Code: "owner", Name: "所有者", Active: true, System: true, CreatedAt: fixed, UpdatedAt: fixed}); err != nil {
			return err
		}
		if err := unit.CreateRole(t.Context(), &repo.RoleRecord{ID: "role-reader", Code: "reader", Name: "只读", Active: true, CreatedAt: fixed, UpdatedAt: fixed}); err != nil {
			return err
		}
		for _, id := range []string{"acc-owner", "acc-member"} {
			if err := unit.CreateAccount(t.Context(), &repo.AccountRecord{ID: id, Username: "user_" + id, DisplayName: "账号", Status: "active", MustChangePassword: id == "acc-member", SecurityRevision: 1, Version: 1, CreatedAt: fixed, UpdatedAt: fixed}); err != nil {
				return err
			}
		}
		if err := unit.CreateAccountRole(t.Context(), &repo.AccountRoleRecord{AccountID: "acc-owner", RoleID: "role-owner", Active: true, UpdatedAt: fixed}); err != nil {
			return err
		}
		if err := unit.CreateAccountRole(t.Context(), &repo.AccountRoleRecord{AccountID: "acc-member", RoleID: "role-reader", Active: true, UpdatedAt: fixed}); err != nil {
			return err
		}
		for _, item := range []repo.RolePermissionRecord{
			{RoleID: "role-owner", PermissionKey: string(iampermission.SelfRead), Active: true, UpdatedAt: fixed},
			{RoleID: "role-owner", PermissionKey: string(iampermission.AccountRead), Active: true, UpdatedAt: fixed},
			{RoleID: "role-reader", PermissionKey: string(iampermission.SelfRead), Active: true, UpdatedAt: fixed},
		} {
			if err := unit.CreateRolePermission(t.Context(), &item); err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	catalog := catalogForTest(t)
	return store, resource, catalog
}

func TestRuntimeLoadAndDecide(t *testing.T) {
	store, resource, catalog := fixture(t)
	defer resource.Close()
	runtime, err := authorization.New(store, catalog)
	if err != nil {
		t.Fatal(err)
	}
	if err := runtime.Load(t.Context()); err != nil {
		t.Fatal(err)
	}
	decision, err := runtime.Decide(t.Context(), authorization.Request{Subject: "acc-owner", Permission: iampermission.AccountRead, Revision: 1})
	if err != nil || !decision.Allowed {
		t.Fatalf("owner decide = %#v, %v", decision, err)
	}
	decision, err = runtime.Decide(t.Context(), authorization.Request{Subject: "acc-member", Permission: iampermission.AccountRead, Revision: 1})
	if err != nil || decision.Allowed {
		t.Fatalf("member decide = %#v, %v; want deny", decision, err)
	}
	decision, err = runtime.Decide(t.Context(), authorization.Request{Subject: "acc-owner", Permission: iampermission.RoleWrite, Revision: 1})
	if err != nil || decision.Allowed {
		t.Fatalf("owner unknown permission = %#v, %v; want deny", decision, err)
	}
}

// TestRuntimeRefreshOnRevisionMismatch 验证授权关系变化并经 runtime 发布后：
// 旧 revision Principal 通过同步刷新获得新语义；刷新后仍不一致的请求
// fail closed；无关账号的既有权限不受影响。
func TestRuntimeRefreshOnRevisionMismatch(t *testing.T) {
	store, resource, catalog := fixture(t)
	defer resource.Close()
	runtime, err := authorization.New(store, catalog)
	if err != nil {
		t.Fatal(err)
	}
	if err := runtime.Load(t.Context()); err != nil {
		t.Fatal(err)
	}
	// 变更前：revision=1 的 member 拥有自助权限。
	decision, err := runtime.Decide(t.Context(), authorization.Request{Subject: "acc-member", Permission: iampermission.SelfRead, Revision: 1})
	if err != nil || !decision.Allowed {
		t.Fatalf("member pre-change decide = %#v, %v", decision, err)
	}
	// 通过 runtime 提交授权 mutation：移除 reader 角色的自助权限并发布 revision 2。
	if err := runtime.Mutate(func() error {
		err := store.WithinTx(t.Context(), func(ctx context.Context, unit *repo.Unit) error {
			if err := unit.UpdateRolePermission(ctx, "role-reader", string(iampermission.SelfRead), false, fixed); err != nil {
				return err
			}
			if _, err := unit.UpdateAuthorizationRevision(ctx, fixed); err != nil {
				return err
			}
			snapshot, err := unit.AuthorizationSnapshot(ctx, catalog)
			if err != nil {
				return err
			}
			return runtime.BuildCandidate(ctx, snapshot)
		})
		if err != nil {
			return err
		}
		runtime.PublishCandidate()
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	// 旧 revision=1 的 member 请求触发刷新后仍不一致 → fail-closed error。
	_, err = runtime.Decide(t.Context(), authorization.Request{Subject: "acc-member", Permission: iampermission.SelfRead, Revision: 1})
	if !errors.Is(err, authorization.ErrRevisionMismatch) {
		t.Fatalf("member stale decide error = %v, want ErrRevisionMismatch", err)
	}
	// 新 revision=2 的直接判断拒绝已移除的权限。
	decision, err = runtime.Decide(t.Context(), authorization.Request{Subject: "acc-member", Permission: iampermission.SelfRead, Revision: 2})
	if err != nil || decision.Allowed {
		t.Fatalf("member fresh decide = %#v, %v; want deny", decision, err)
	}
	// 无关账号 owner 的权限仍在；其新会话（revision 2）直接允许。
	decision, err = runtime.Decide(t.Context(), authorization.Request{Subject: "acc-owner", Permission: iampermission.AccountRead, Revision: 2})
	if err != nil || !decision.Allowed {
		t.Fatalf("owner decide after refresh = %#v, %v", decision, err)
	}
}

// TestRuntimeRefreshFailureFailsClosed 验证刷新失败（startup 未加载、
// 数据库刷新失败）时不使用旧 evaluator 放行。
func TestRuntimeRefreshFailureFailsClosed(t *testing.T) {
	store, resource, catalog := fixture(t)
	defer resource.Close()
	runtime, err := authorization.New(store, catalog)
	if err != nil {
		t.Fatal(err)
	}
	// 未加载 evaluator：任何判断都失败。
	if _, err := runtime.Decide(t.Context(), authorization.Request{Subject: "acc-owner", Permission: iampermission.AccountRead, Revision: 1}); !errors.Is(err, authorization.ErrEvaluatorUnavailable) {
		t.Fatalf("unloaded decide error = %v", err)
	}
	if err := runtime.Load(t.Context()); err != nil {
		t.Fatal(err)
	}
	// 删除 authorization state 单例行，使 revision 读取与刷新失败。
	if err := database.Borrow(t.Context(), resource.Client(), func(client database.Client) error {
		return database.UseGORM(t.Context(), client, func(db *gorm.DB) error {
			return db.Exec("DELETE FROM iam_authorization_state WHERE id = 1").Error
		})
	}); err != nil {
		t.Fatal(err)
	}
	// 与新 revision 不一致的请求必须刷新失败并报错，而不是用旧 evaluator 放行。
	if _, err := runtime.Decide(t.Context(), authorization.Request{Subject: "acc-owner", Permission: iampermission.AccountRead, Revision: 2}); err == nil {
		t.Fatal("stale decide succeeded after refresh failure")
	}
	// 与当前 evaluator revision 一致的请求仍按快照语义执行（快照一致不等于放行泄露）。
	decision, err := runtime.Decide(t.Context(), authorization.Request{Subject: "acc-owner", Permission: iampermission.AccountRead, Revision: 1})
	if err != nil || !decision.Allowed {
		t.Fatalf("consistent decide = %#v, %v", decision, err)
	}
}

// TestRuntimeCancellationPreserved 验证取消与 deadline 在判断入口优先返回。
func TestRuntimeCancellationPreserved(t *testing.T) {
	store, resource, catalog := fixture(t)
	defer resource.Close()
	runtime, err := authorization.New(store, catalog)
	if err != nil {
		t.Fatal(err)
	}
	if err := runtime.Load(t.Context()); err != nil {
		t.Fatal(err)
	}
	canceled, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := runtime.Decide(canceled, authorization.Request{Subject: "acc-owner", Permission: iampermission.AccountRead, Revision: 1}); !errors.Is(err, context.Canceled) {
		t.Fatalf("canceled decide error = %v", err)
	}
	if _, err := runtime.ProjectPermissions(canceled, "acc-owner", 1, false); !errors.Is(err, context.Canceled) {
		t.Fatalf("canceled projection error = %v", err)
	}
}

// TestRuntimeMutationPublishAndRollback 验证 mutation 的 candidate-before-commit、
// commit 后原子发布，以及候选构造失败时事务回滚且不发布。
func TestRuntimeMutationPublishAndRollback(t *testing.T) {
	store, resource, catalog := fixture(t)
	defer resource.Close()
	runtime, err := authorization.New(store, catalog)
	if err != nil {
		t.Fatal(err)
	}
	if err := runtime.Load(t.Context()); err != nil {
		t.Fatal(err)
	}
	// 成功 mutation：移除 owner 的读权限，commit 后发布。
	if err := runtime.Mutate(func() error {
		err := store.WithinTx(t.Context(), func(ctx context.Context, unit *repo.Unit) error {
			if err := unit.UpdateRolePermission(ctx, "role-owner", string(iampermission.AccountRead), false, fixed); err != nil {
				return err
			}
			if _, err := unit.UpdateAuthorizationRevision(ctx, fixed); err != nil {
				return err
			}
			snapshot, err := unit.AuthorizationSnapshot(ctx, catalog)
			if err != nil {
				return err
			}
			return runtime.BuildCandidate(ctx, snapshot)
		})
		if err != nil {
			return err
		}
		runtime.PublishCandidate()
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	decision, err := runtime.Decide(t.Context(), authorization.Request{Subject: "acc-owner", Permission: iampermission.AccountRead, Revision: 2})
	if err != nil || decision.Allowed {
		t.Fatalf("owner decide after publish = %#v, %v; want deny", decision, err)
	}
	// 失败 mutation：事务内写入 Catalog 之外的权限键 → snapshot 构建失败
	// → 整个事务回滚，候选不发布。
	err = runtime.Mutate(func() error {
		return store.WithinTx(t.Context(), func(ctx context.Context, unit *repo.Unit) error {
			if err := unit.CreateRolePermission(ctx, &repo.RolePermissionRecord{RoleID: "role-owner", PermissionKey: "ghost:permission:write", Active: true, UpdatedAt: fixed}); err != nil {
				return err
			}
			if _, err := unit.UpdateAuthorizationRevision(ctx, fixed); err != nil {
				return err
			}
			snapshot, err := unit.AuthorizationSnapshot(ctx, catalog)
			if err != nil {
				return err
			}
			return runtime.BuildCandidate(ctx, snapshot)
		})
	})
	if err == nil || !errors.Is(err, repo.ErrSnapshotIncompatible) {
		t.Fatalf("mutation error = %v, want ErrSnapshotIncompatible", err)
	}
	// 数据库状态回滚，evaluator 仍为 revision 2：owner 的自助权限未被撤销。
	decision, err = runtime.Decide(t.Context(), authorization.Request{Subject: "acc-owner", Permission: iampermission.SelfRead, Revision: 2})
	if err != nil || !decision.Allowed {
		t.Fatalf("owner self decide after rollback = %#v, %v", decision, err)
	}
}

// TestRuntimeRestrictedRequest 验证首次登录受限会话只允许自助权限。
func TestRuntimeRestrictedRequest(t *testing.T) {
	store, resource, catalog := fixture(t)
	defer resource.Close()
	runtime, err := authorization.New(store, catalog)
	if err != nil {
		t.Fatal(err)
	}
	if err := runtime.Load(t.Context()); err != nil {
		t.Fatal(err)
	}
	request := authorization.Request{Subject: "acc-member", Permission: iampermission.SelfRead, Revision: 1, Restricted: true}
	decision, err := runtime.Decide(t.Context(), request)
	if err != nil || !decision.Allowed {
		t.Fatalf("restricted self decide = %#v, %v", decision, err)
	}
	request.Permission = iampermission.AccountRead
	decision, err = runtime.Decide(t.Context(), request)
	if err != nil || decision.Allowed || decision.Reason != authorization.ReasonDenied {
		t.Fatalf("restricted foreign decide = %#v, %v; want deny decision", decision, err)
	}
	keys, err := runtime.ProjectPermissions(t.Context(), "acc-member", 1, true)
	if err != nil || len(keys) != 1 || keys[0] != iampermission.SelfRead {
		t.Fatalf("restricted projection = %v, %v; want [self:read]", keys, err)
	}
}

// TestRuntimeConcurrentAccess 验证并发 Decide/刷新与 mutation 发布不会产生
// 数据竞争（配合 -race），且最终 evaluator 收敛到最新 revision。
func TestRuntimeConcurrentAccess(t *testing.T) {
	store, resource, catalog := fixture(t)
	defer resource.Close()
	runtime, err := authorization.New(store, catalog)
	if err != nil {
		t.Fatal(err)
	}
	if err := runtime.Load(t.Context()); err != nil {
		t.Fatal(err)
	}
	stop := make(chan struct{})
	var wait sync.WaitGroup
	failures := make(chan error, 8)
	for worker := 0; worker < 4; worker++ {
		wait.Add(1)
		go func() {
			defer wait.Done()
			for {
				select {
				case <-stop:
					return
				default:
				}
				if _, err := runtime.Decide(t.Context(), authorization.Request{Subject: "acc-owner", Permission: iampermission.AccountRead, Revision: 1}); err != nil && !errors.Is(err, authorization.ErrRevisionMismatch) {
					failures <- err
					return
				}
			}
		}()
	}
	for round := 1; round <= 3; round++ {
		if err := runtime.Mutate(func() error {
			err := store.WithinTx(t.Context(), func(ctx context.Context, unit *repo.Unit) error {
				if _, err := unit.UpdateAuthorizationRevision(ctx, fixed); err != nil {
					return err
				}
				snapshot, err := unit.AuthorizationSnapshot(ctx, catalog)
				if err != nil {
					return err
				}
				return runtime.BuildCandidate(ctx, snapshot)
			})
			if err != nil {
				return err
			}
			runtime.PublishCandidate()
			return nil
		}); err != nil {
			t.Fatal(err)
		}
	}
	close(stop)
	wait.Wait()
	close(failures)
	for failure := range failures {
		t.Fatal(failure)
	}
	decision, err := runtime.Decide(t.Context(), authorization.Request{Subject: "acc-owner", Permission: iampermission.AccountRead, Revision: 4})
	if err != nil || !decision.Allowed {
		t.Fatalf("final decide = %#v, %v", decision, err)
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
	path := filepath.Join(t.TempDir(), "iam-runtime.db")
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
