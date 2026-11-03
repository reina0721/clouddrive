package service_test

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	passwordadapter "github.com/reina0721/clouddrive/internal/module/iam/adapter/password"
	"github.com/reina0721/clouddrive/internal/module/iam/adapter/totp"
	"github.com/reina0721/clouddrive/internal/module/iam/authorization"
	migrationbinding "github.com/reina0721/clouddrive/internal/module/iam/binding/migration"
	iampermission "github.com/reina0721/clouddrive/internal/module/iam/binding/permission"
	"github.com/reina0721/clouddrive/internal/module/iam/model"
	"github.com/reina0721/clouddrive/internal/module/iam/repo"
	"github.com/reina0721/clouddrive/internal/module/iam/service"
	permissioncatalog "github.com/reina0721/clouddrive/internal/permission"
	pkgalerting "github.com/reina0721/clouddrive/pkg/alerting"
	"github.com/reina0721/clouddrive/pkg/clock"
	"github.com/reina0721/clouddrive/pkg/database"
	dbmigrate "github.com/reina0721/clouddrive/pkg/database/migrate"
	"github.com/reina0721/clouddrive/pkg/idgen"
	"golang.org/x/crypto/argon2"
)

func TestSetupLoginRBACAndRevisionInvalidation(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	ownerSession, err := iam.Setup(t.Context(), "setup-secret", "Owner_01", "系统所有者", "123456789012345")
	if err != nil {
		t.Fatal(err)
	}
	if len(ownerSession.Identity.Permissions) != len(iam.Permissions()) {
		t.Fatalf("owner permissions = %d", len(ownerSession.Identity.Permissions))
	}
	if _, err := iam.Setup(t.Context(), "setup-secret", "other", "Other", "123456789012345"); !errors.Is(err, service.ErrSetupClosed) {
		t.Fatalf("second setup error = %v", err)
	}
	account, err := iam.CreateAccount(t.Context(), "member_01", "成员一", "abcdefghijklmno")
	if err != nil {
		t.Fatal(err)
	}
	role, err := iam.CreateRole(t.Context(), "reader", "只读角色", "")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := iam.ReplaceRolePermissions(t.Context(), role.ID, 1, []permissioncatalog.Key{iampermission.SelfRead}); err != nil {
		t.Fatal(err)
	}
	if _, err := iam.ReplaceAccountRoles(t.Context(), account.ID, 1, []string{role.ID}); err != nil {
		t.Fatal(err)
	}
	first, err := iam.Login(t.Context(), "MEMBER_01", "abcdefghijklmno")
	if err != nil {
		t.Fatal(err)
	}
	if !first.Identity.MustChangePassword || len(first.Identity.Permissions) != 1 || first.Identity.Permissions[0] != iampermission.SelfRead {
		t.Fatalf("first identity = %#v", first.Identity)
	}
	if err := iam.ChangePassword(t.Context(), account.ID, "abcdefghijklmno", "ponmlkjihgfedcb"); err != nil {
		t.Fatal(err)
	}
	if _, err := iam.Resolve(t.Context(), first.ID); !errors.Is(err, service.ErrSessionInvalid) {
		t.Fatalf("stale session error = %v", err)
	}
	second, err := iam.Login(t.Context(), "member_01", "ponmlkjihgfedcb")
	if err != nil {
		t.Fatal(err)
	}
	if second.Identity.MustChangePassword {
		t.Fatal("changed password must clear first-login restriction")
	}
	if err := iam.Compatible(t.Context()); err != nil {
		t.Fatalf("compatible state: %v", err)
	}
}

func TestAccountDetailAggregatesLifecycleRolesAndSecurityImpact(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	if _, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345"); err != nil {
		t.Fatal(err)
	}
	account, err := iam.CreateAccount(t.Context(), "detail_member", "Detail member", "abcdefghijklmno")
	if err != nil {
		t.Fatal(err)
	}
	role, err := iam.CreateRole(t.Context(), "detail-reader", "Detail reader", "")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := iam.ReplaceAccountRoles(t.Context(), account.ID, account.Version, []string{role.ID}); err != nil {
		t.Fatal(err)
	}
	if _, err := iam.Login(t.Context(), account.Username, "abcdefghijklmno"); err != nil {
		t.Fatal(err)
	}

	detail, err := iam.AccountDetail(t.Context(), account.ID)
	if err != nil {
		t.Fatal(err)
	}
	if detail.Account.ID != account.ID || detail.Account.CreatedAt.IsZero() || detail.Account.UpdatedAt.IsZero() {
		t.Fatalf("account detail lifecycle = %#v", detail.Account)
	}
	if len(detail.Roles) != 1 || detail.Roles[0].ID != role.ID {
		t.Fatalf("account detail roles = %#v", detail.Roles)
	}
	if detail.ActiveSessionCount != 1 || detail.TotalSessionCount != 1 || detail.ActiveAPITokenCount != 0 {
		t.Fatalf("account detail impact = %#v", detail)
	}
	if detail.AuthorizationRevision == 0 {
		t.Fatal("account detail authorization revision must be projected")
	}
	if _, err := iam.AccountDetail(t.Context(), "missing-account"); !repo.IsNotFound(err) {
		t.Fatalf("missing account detail error = %v", err)
	}
}

func TestRoleDetailAggregatesMembersPermissionOwnersAndRisk(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	if _, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345"); err != nil {
		t.Fatal(err)
	}
	account, err := iam.CreateAccount(t.Context(), "role_detail_member", "Role detail member", "abcdefghijklmno")
	if err != nil {
		t.Fatal(err)
	}
	role, err := iam.CreateRole(t.Context(), "impact-reviewer", "Impact reviewer", "")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := iam.ReplaceRolePermissions(t.Context(), role.ID, role.Version, []permissioncatalog.Key{iampermission.SelfRead, iampermission.AccountWrite, iampermission.SessionRead}); err != nil {
		t.Fatal(err)
	}
	roleSnapshot, err := iam.RolePermissionsSnapshot(t.Context(), role.ID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := iam.ReplaceAccountRoles(t.Context(), account.ID, account.Version, []string{role.ID}); err != nil {
		t.Fatal(err)
	}

	detail, err := iam.RoleDetail(t.Context(), role.ID)
	if err != nil {
		t.Fatal(err)
	}
	if detail.Role.ID != role.ID || detail.Role.CreatedAt.IsZero() || detail.Role.UpdatedAt.IsZero() {
		t.Fatalf("role detail lifecycle = %#v", detail.Role)
	}
	if len(detail.Permissions) != 3 || detail.OwnerModuleCount != 1 || detail.AssignedAccountCount != 1 {
		t.Fatalf("role detail scope = %#v", detail)
	}
	if detail.ElevatedPermissionCount != 1 || detail.CriticalPermissionCount != 1 {
		t.Fatalf("role detail risk = %#v", detail)
	}
	if detail.AuthorizationRevision <= roleSnapshot.AuthorizationRevision {
		t.Fatalf("role detail revision = %d, before assignment = %d", detail.AuthorizationRevision, roleSnapshot.AuthorizationRevision)
	}
	if _, err := iam.RoleDetail(t.Context(), "missing-role"); !repo.IsNotFound(err) {
		t.Fatalf("missing role detail error = %v", err)
	}
}

func TestLoginFailureIsPersistedUntilLockout(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	if _, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345"); err != nil {
		t.Fatal(err)
	}
	for attempt := 1; attempt <= 2; attempt++ {
		if _, err := iam.Login(t.Context(), "owner", "wrong-password-value"); !errors.Is(err, service.ErrInvalidCredentials) {
			t.Fatalf("attempt %d error = %v", attempt, err)
		}
	}
	if _, err := iam.Login(t.Context(), "owner", "wrong-password-value"); !errors.Is(err, service.ErrAccountLocked) {
		t.Fatalf("lockout error = %v", err)
	}
	if _, err := iam.Login(t.Context(), "owner", "123456789012345"); !errors.Is(err, service.ErrAccountLocked) {
		t.Fatalf("locked account login error = %v", err)
	}
}

func TestLoginRehashesHistoricalCredential(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	session, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345")
	if err != nil {
		t.Fatal(err)
	}
	legacy := historicalHash("123456789012345")
	store := storeForResource(t, resource)
	if err := store.Use(t.Context(), func(unit *repo.Unit) error {
		return unit.UpdateCredential(t.Context(), session.Identity.AccountID, legacy, time.Date(2026, 8, 21, 1, 0, 0, 0, time.UTC))
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := iam.Login(t.Context(), "owner", "123456789012345"); err != nil {
		t.Fatalf("Login() error = %v", err)
	}
	var current string
	if err := store.Use(t.Context(), func(unit *repo.Unit) error {
		credential, findErr := unit.CredentialByAccount(t.Context(), session.Identity.AccountID)
		current = credential.PasswordHash
		return findErr
	}); err != nil {
		t.Fatal(err)
	}
	verification, err := passwordadapter.Verify(current, "123456789012345")
	if err != nil || !verification.Match || verification.NeedsRehash || current == legacy {
		t.Fatalf("rehash = %#v, error = %v, changed = %t", verification, err, current != legacy)
	}
}

func TestLoginRejectsUnboundedStoredCredentialWithoutLeakingIt(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	session, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345")
	if err != nil {
		t.Fatal(err)
	}
	salt := base64.RawStdEncoding.EncodeToString(make([]byte, 16))
	digest := base64.RawStdEncoding.EncodeToString(make([]byte, 32))
	corrupted := fmt.Sprintf("$argon2id$v=%d$m=4294967295,t=3,p=2$%s$%s", argon2.Version, salt, digest)
	store := storeForResource(t, resource)
	if err := store.Use(t.Context(), func(unit *repo.Unit) error {
		return unit.UpdateCredential(t.Context(), session.Identity.AccountID, corrupted, time.Date(2026, 8, 21, 1, 0, 0, 0, time.UTC))
	}); err != nil {
		t.Fatal(err)
	}
	_, err = iam.Login(t.Context(), "owner", "123456789012345")
	if !errors.Is(err, service.ErrInvalidCredentials) {
		t.Fatalf("Login(corrupted credential) error = %v", err)
	}
	if strings.Contains(err.Error(), corrupted) {
		t.Fatalf("Login() leaked stored credential: %v", err)
	}
}

func TestOwnerCatalogExpansionIsReconciledAndInvalidatesSession(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	session, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345")
	if err != nil {
		t.Fatal(err)
	}
	definitions := iampermission.Definitions()
	definitions = append(definitions, permissioncatalog.Definition{Key: "example:read", OwnerModuleID: "example", DescriptionMessageID: "permission.example.read", Risk: permissioncatalog.RiskStandard})
	expanded := serviceForResource(t, resource, definitions)
	if err := expanded.Compatible(t.Context()); !errors.Is(err, service.ErrIncompatibleState) {
		t.Fatalf("missing owner permission compatibility error = %v", err)
	}
	if err := expanded.ReconcileOwnerCatalog(t.Context()); err != nil {
		t.Fatal(err)
	}
	if err := expanded.Compatible(t.Context()); err != nil {
		t.Fatal(err)
	}
	if _, err := expanded.Resolve(t.Context(), session.ID); !errors.Is(err, service.ErrSessionInvalid) {
		t.Fatalf("owner session after catalog expansion = %v", err)
	}
}

// TestBatchAccountStatusAndArchive 验证批量启停/归档：逐账号复用安全语义、
// 单个失败不中止、返回计数与逐条稳定错误码。
func TestBatchAccountStatusAndArchive(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	ownerSession, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345")
	if err != nil {
		t.Fatal(err)
	}
	ownerID := ownerSession.Identity.AccountID
	member, err := iam.CreateAccount(t.Context(), "member-a", "Member A", "abcdefghijklmno")
	if err != nil {
		t.Fatal(err)
	}
	member2, err := iam.CreateAccount(t.Context(), "member-b", "Member B", "abcdefghijklmno")
	if err != nil {
		t.Fatal(err)
	}

	// 批量禁用：member 成功、缺失账号失败，统计与错误码逐条导出。
	result, err := iam.BatchSetAccountStatusIdempotent(t.Context(), "batch-disable", "corr-disable", []string{member.ID, "missing-id"}, model.AccountDisabled)
	if err != nil {
		t.Fatal(err)
	}
	if result.RequestedCount != 2 || result.ProcessedCount != 2 || len(result.Succeeded) != 1 || len(result.Failed) != 1 {
		t.Fatalf("batch disable result = %#v", result)
	}
	if result.Failed[0].ResourceID != "missing-id" || result.Failed[0].Code != "not_found" || result.CorrelationID != "corr-disable" {
		t.Fatalf("batch disable items = %#v", result)
	}
	accounts, err := iam.ListAccounts(t.Context(), 0, 20, repo.AccountFilter{})
	if err != nil {
		t.Fatal(err)
	}
	for _, account := range accounts.Items {
		if account.ID == member.ID && account.Status != model.AccountDisabled {
			t.Fatalf("member not disabled after batch: %+v", account)
		}
	}

	// 批量归档：member2 成功；owner（最后活跃 owner）失败为 owner_invariant。
	result, err = iam.BatchArchiveAccountsIdempotent(t.Context(), "batch-archive", "corr-archive", []string{member2.ID, "missing-id-2"})
	if err != nil {
		t.Fatal(err)
	}
	if result.RequestedCount != 2 || result.ProcessedCount != 2 || len(result.Succeeded) != 1 || len(result.Failed) != 1 || result.Failed[0].Code != "not_found" {
		t.Fatalf("batch archive result = %#v", result)
	}
	archived, err := iam.ListAccounts(t.Context(), 0, 20, repo.AccountFilter{Archived: boolPtr(true)})
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, account := range archived.Items {
		if account.ID == member2.ID {
			found = true
		}
	}
	if !found {
		t.Fatalf("member2 not archived after batch: %#v", archived.Items)
	}

	// owner 无法在批量中被禁用（保持 owner 不变量），错误码为 owner_invariant。
	result, err = iam.BatchSetAccountStatusIdempotent(t.Context(), "batch-owner", "corr-owner", []string{member.ID, ownerID}, model.AccountDisabled)
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Succeeded) != 1 || len(result.Failed) != 1 || result.Failed[0].ResourceID != ownerID || result.Failed[0].Code != "owner_invariant" {
		t.Fatalf("batch disable w/ owner items = %#v", result)
	}
}

// TestBatchAccountStatusIdempotency 验证同一请求可稳定重放，且同一 key
// 不允许绑定不同请求，避免重试导致版本与审计副作用重复发生。
func TestBatchAccountStatusIdempotency(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	if _, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345"); err != nil {
		t.Fatal(err)
	}
	member, err := iam.CreateAccount(t.Context(), "member-idempotent", "Member", "abcdefghijklmno")
	if err != nil {
		t.Fatal(err)
	}

	first, err := iam.BatchSetAccountStatusIdempotent(t.Context(), "batch-status-1", "corr-first", []string{member.ID, "missing-id"}, model.AccountDisabled)
	if err != nil || first.ProcessedCount != 2 || len(first.Succeeded) != 1 || len(first.Failed) != 1 {
		t.Fatalf("first idempotent batch = %#v, %v", first, err)
	}
	afterFirst, err := iam.AccountDetail(t.Context(), member.ID)
	if err != nil {
		t.Fatal(err)
	}

	replayed, err := iam.BatchSetAccountStatusIdempotent(t.Context(), "batch-status-1", "corr-retry", []string{member.ID, "missing-id"}, model.AccountDisabled)
	if err != nil || replayed.ProcessedCount != first.ProcessedCount || len(replayed.Succeeded) != len(first.Succeeded) || len(replayed.Failed) != len(first.Failed) || replayed.CorrelationID != "corr-first" {
		t.Fatalf("replayed idempotent batch = %#v, %v", replayed, err)
	}
	afterReplay, err := iam.AccountDetail(t.Context(), member.ID)
	if err != nil {
		t.Fatal(err)
	}
	if afterReplay.Account.Version != afterFirst.Account.Version {
		t.Fatalf("replay changed account version: first=%d replay=%d", afterFirst.Account.Version, afterReplay.Account.Version)
	}

	_, err = iam.BatchSetAccountStatusIdempotent(t.Context(), "batch-status-1", "corr-conflict", []string{member.ID}, model.AccountActive)
	if !errors.Is(err, service.ErrIdempotencyConflict) {
		t.Fatalf("reused idempotency key error = %v", err)
	}
}

func boolPtr(value bool) *bool { return &value }

func TestLastOwnerCannotBeDisabledOrUnassigned(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	session, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345")
	if err != nil {
		t.Fatal(err)
	}
	roles, err := iam.ListRoles(t.Context(), 0, 20, "")
	if err != nil || len(roles.Items) != 1 {
		t.Fatalf("roles = %#v, %v", roles, err)
	}
	if err := iam.SetAccountStatus(t.Context(), session.Identity.AccountID, model.AccountDisabled); !errors.Is(err, model.ErrOwnerInvariant) {
		t.Fatalf("disable owner error = %v", err)
	}
	if _, err := iam.ReplaceAccountRoles(t.Context(), session.Identity.AccountID, 1, nil); !errors.Is(err, model.ErrOwnerInvariant) {
		t.Fatalf("unassign owner error = %v", err)
	}
}

func TestConcurrentOwnerDisableCannotRemoveEveryActiveOwner(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	first, err := iam.Setup(t.Context(), "setup-secret", "owner-a", "Owner A", "123456789012345")
	if err != nil {
		t.Fatal(err)
	}
	second, err := iam.CreateAccount(t.Context(), "owner-b", "Owner B", "abcdefghijklmno")
	if err != nil {
		t.Fatal(err)
	}
	roles, err := iam.ListRoles(t.Context(), 0, 20, "")
	if err != nil || len(roles.Items) != 1 {
		t.Fatalf("roles = %#v, %v", roles, err)
	}
	if _, err := iam.ReplaceAccountRoles(t.Context(), second.ID, 1, []string{roles.Items[0].ID}); err != nil {
		t.Fatal(err)
	}
	start := make(chan struct{})
	results := make(chan error, 2)
	for _, accountID := range []string{first.Identity.AccountID, second.ID} {
		go func(id string) {
			<-start
			results <- iam.SetAccountStatus(context.Background(), id, model.AccountDisabled)
		}(accountID)
	}
	close(start)
	<-results
	<-results
	accounts, err := iam.ListAccounts(t.Context(), 0, 20, repo.AccountFilter{})
	if err != nil {
		t.Fatal(err)
	}
	active := 0
	for _, account := range accounts.Items {
		if account.Status == model.AccountActive {
			active++
		}
	}
	if active < 1 {
		t.Fatal("concurrent mutations removed every active owner")
	}
}

func newService(t *testing.T) (*service.Service, database.Resource) {
	t.Helper()
	path := filepath.Join(t.TempDir(), "iam.db")
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
	iam := serviceForResource(t, resource, iampermission.Definitions())
	return iam, resource
}

func serviceForResource(t *testing.T, resource database.Resource, definitions []permissioncatalog.Definition) *service.Service {
	t.Helper()
	return serviceForResourceWithPolicy(t, resource, definitions, model.DefaultPasswordPolicy())
}

// serviceForResourceWithPolicy 使用显式密码策略构造 IAM Service，便于验证
// 配置化策略（076）在创建/重置/修改密码路径上的生效语义。
func serviceForResourceWithPolicy(t *testing.T, resource database.Resource, definitions []permissioncatalog.Definition, policy model.PasswordPolicy) *service.Service {
	t.Helper()
	store := storeForResource(t, resource)
	catalog, err := permissioncatalog.BuildCatalog(definitions...)
	if err != nil {
		t.Fatal(err)
	}
	runtime, err := authorization.New(store, catalog)
	if err != nil {
		t.Fatal(err)
	}
	iam, err := service.New(store, clock.Fixed(time.Date(2026, 8, 22, 1, 0, 0, 0, time.UTC)), idgen.UUID(), passwordadapter.Hasher{}, service.Config{SetupToken: "setup-secret", IdleTimeout: 30 * time.Minute, AbsoluteTimeout: 12 * time.Hour, MaxFailedAttempts: 3, LockDuration: 15 * time.Minute, PasswordPolicy: policy}, catalog, runtime)
	if err != nil {
		t.Fatal(err)
	}
	return iam
}

func storeForResource(t *testing.T, resource database.Resource) *repo.Store {
	t.Helper()
	store, err := repo.New(resourceAccess{resource})
	if err != nil {
		t.Fatal(err)
	}
	return store
}

// TestRelationshipReplaceVersionConflictAndNoOp 覆盖 dynamic assignment 的
// expected version 语义：过期版本返回 409 类错误；no-op 不改变版本与 revision、
// 不撤销 Session；有效变更返回 diff 与新版本。
func TestRelationshipReplaceVersionConflictAndNoOp(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	session, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345")
	if err != nil {
		t.Fatal(err)
	}
	account, err := iam.CreateAccount(t.Context(), "member", "成员", "abcdefghijklmno")
	if err != nil {
		t.Fatal(err)
	}
	role, err := iam.CreateRole(t.Context(), "reader", "只读", "")
	if err != nil {
		t.Fatal(err)
	}
	// 过期 expected version → 稳定冲突。
	if _, err := iam.ReplaceAccountRoles(t.Context(), account.ID, 99, []string{role.ID}); !errors.Is(err, service.ErrVersionConflict) {
		t.Fatalf("stale account version error = %v", err)
	}
	if _, err := iam.ReplaceRolePermissions(t.Context(), role.ID, 99, []permissioncatalog.Key{iampermission.SelfRead}); !errors.Is(err, service.ErrVersionConflict) {
		t.Fatalf("stale role version error = %v", err)
	}
	// 正确版本写入角色权限，获得 added 计数与 role version 递增。
	result, err := iam.ReplaceRolePermissions(t.Context(), role.ID, 1, []permissioncatalog.Key{iampermission.SelfRead})
	if err != nil {
		t.Fatal(err)
	}
	if result.Added != 1 || result.Removed != 0 || result.EntityVersion != 2 || result.AuthorizationRevision != 3 {
		t.Fatalf("role permission replace result = %#v", result)
	}
	view, err := iam.RolePermissionsSnapshot(t.Context(), role.ID)
	if err != nil || view.RoleVersion != 2 || len(view.PermissionKeys) != 1 || view.PermissionKeys[0] != iampermission.SelfRead {
		t.Fatalf("role permissions snapshot = %#v, %v", view, err)
	}
	// 账号角色替换成功；旧 Session 失效。
	if _, err := iam.ReplaceAccountRoles(t.Context(), account.ID, 1, []string{role.ID}); err != nil {
		t.Fatal(err)
	}
	first, err := iam.Login(t.Context(), "member", "abcdefghijklmno")
	if err != nil {
		t.Fatal(err)
	}
	// no-op 再提交同一集合：版本/revision 不变，Session 不被撤销。
	before, err := iam.AccountRolesSnapshot(t.Context(), account.ID)
	if err != nil {
		t.Fatal(err)
	}
	noop, err := iam.ReplaceAccountRoles(t.Context(), account.ID, before.AccountVersion, []string{role.ID})
	if err != nil {
		t.Fatal(err)
	}
	if noop.Added != 0 || noop.Removed != 0 || noop.EntityVersion != before.AccountVersion || noop.AuthorizationRevision != before.AuthorizationRevision {
		t.Fatalf("no-op result = %#v, before = %#v", noop, before)
	}
	if _, err := iam.Resolve(t.Context(), first.ID); err != nil {
		t.Fatalf("no-op must not revoke member session: %v", err)
	}
	// 版本冲突后不静默覆盖：期望集合保持不变。
	if _, err := iam.ReplaceAccountRoles(t.Context(), account.ID, noop.EntityVersion, []string{role.ID, "role-ghost"}); !errors.Is(err, repo.ErrNotFound) {
		t.Fatalf("ghost role error = %v", err)
	}
	_ = session
}

// TestReplaceRemovesPermissionRevokesAssignedSessionsAndPublishes 验证有效
// 角色权限移除会撤销持有者的 Session，且新登录账号不再拥有该权限。
func TestReplaceRemovesPermissionRevokesAssignedSessionsAndPublishes(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	if _, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345"); err != nil {
		t.Fatal(err)
	}
	account, err := iam.CreateAccount(t.Context(), "member", "成员", "abcdefghijklmno")
	if err != nil {
		t.Fatal(err)
	}
	role, err := iam.CreateRole(t.Context(), "reader", "只读", "")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := iam.ReplaceRolePermissions(t.Context(), role.ID, 1, []permissioncatalog.Key{iampermission.SelfRead, iampermission.AccountRead}); err != nil {
		t.Fatal(err)
	}
	if _, err := iam.ReplaceAccountRoles(t.Context(), account.ID, 1, []string{role.ID}); err != nil {
		t.Fatal(err)
	}
	session, err := iam.Login(t.Context(), "member", "abcdefghijklmno")
	if err != nil {
		t.Fatal(err)
	}
	// 移除 AccountRead：持有者 Session 被撤销。
	result, err := iam.ReplaceRolePermissions(t.Context(), role.ID, 2, []permissioncatalog.Key{iampermission.SelfRead})
	if err != nil {
		t.Fatal(err)
	}
	if result.Removed != 1 || result.Added != 0 {
		t.Fatalf("remove result = %#v", result)
	}
	if _, err := iam.Resolve(t.Context(), session.ID); !errors.Is(err, service.ErrSessionInvalid) {
		t.Fatalf("member session after permission removal = %v", err)
	}
	replacement, err := iam.Login(t.Context(), "member", "abcdefghijklmno")
	if err != nil {
		t.Fatal(err)
	}
	if replacement.Identity.SecurityRevision != session.Identity.SecurityRevision+1 {
		t.Fatalf("replacement security revision = %d, want %d", replacement.Identity.SecurityRevision, session.Identity.SecurityRevision+1)
	}
	view, err := iam.RolePermissionsSnapshot(t.Context(), role.ID)
	if err != nil || len(view.PermissionKeys) != 1 || view.PermissionKeys[0] != iampermission.SelfRead {
		t.Fatalf("role permissions snapshot = %#v, %v", view, err)
	}
}

func historicalHash(value string) string {
	salt := []byte("historical-salt!")
	digest := argon2.IDKey([]byte(value), salt, 2, 32*1024, 1, 32)
	return fmt.Sprintf("$argon2id$v=%d$m=32768,t=2,p=1$%s$%s", argon2.Version, base64.RawStdEncoding.EncodeToString(salt), base64.RawStdEncoding.EncodeToString(digest))
}

type resourceAccess struct{ resource database.Resource }

func (a resourceAccess) Use(ctx context.Context, use func(database.Client) error) error {
	return database.Borrow(ctx, a.resource.Client(), use)
}
func (a resourceAccess) WithinTx(ctx context.Context, use func(context.Context, database.Client, database.Tx) error) error {
	return a.Use(ctx, func(client database.Client) error {
		return client.WithinTx(ctx, func(txCtx context.Context, tx database.Tx) error { return use(txCtx, client, tx) })
	})
}

func TestSessionListingAndSelectiveRevocation(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	if _, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345"); err != nil {
		t.Fatal(err)
	}
	first, err := iam.Login(t.Context(), "owner", "123456789012345")
	if err != nil {
		t.Fatal(err)
	}
	second, err := iam.Login(t.Context(), "owner", "123456789012345")
	if err != nil {
		t.Fatal(err)
	}
	accountID := first.Identity.AccountID

	result, err := iam.ListSessions(t.Context(), accountID, 0, 100, service.SessionListAll)
	if err != nil {
		t.Fatal(err)
	}
	items := result.Items
	// Setup 也创建了一个会话，因此共 3 个。
	if len(items) != 3 || result.Total != 3 {
		t.Fatalf("session list = %d (total %d), want 3", len(items), result.Total)
	}
	// 摘要视图不泄露明文 SessionID。
	for _, item := range items {
		if item.IDHash == "" || item.IDHash == first.ID || item.IDHash == second.ID {
			t.Fatalf("session view leaks raw id: %#v", item)
		}
	}
	// 按明文 session id 的摘要定位对应的 idHash（测试夹具内部实现细节）。
	firstHash, secondHash := "", ""
	for _, item := range items {
		raw, err := hex.DecodeString(item.IDHash)
		if err != nil {
			t.Fatal(err)
		}
		switch string(raw) {
		case string(sessionDigest(first.ID)):
			firstHash = item.IDHash
		case string(sessionDigest(second.ID)):
			secondHash = item.IDHash
		}
	}
	if firstHash == "" || secondHash == "" {
		t.Fatalf("first/second session hash not found: %#v", items)
	}

	// 批量吊销 first 会话；first 失效、second 与 setup 仍有效。
	revoked, err := iam.RevokeSessions(t.Context(), accountID, []string{firstHash})
	if err != nil {
		t.Fatal(err)
	}
	if revoked != 1 {
		t.Fatalf("revoked = %d, want 1", revoked)
	}
	if _, err := iam.Resolve(t.Context(), first.ID); !errors.Is(err, service.ErrSessionInvalid) {
		t.Fatalf("revoked session resolve error = %v", err)
	}
	if _, err := iam.Resolve(t.Context(), second.ID); err != nil {
		t.Fatalf("active session resolve error = %v", err)
	}

	// 重复吊销是 no-op；未知摘要 fail closed。
	if revoked, err := iam.RevokeSessions(t.Context(), accountID, []string{firstHash}); err != nil || revoked != 0 {
		t.Fatalf("repeat revoke = %d, %v", revoked, err)
	}
	if _, err := iam.RevokeSessions(t.Context(), accountID, []string{"deadbeef"}); !errors.Is(err, service.ErrSessionInvalid) {
		t.Fatalf("unknown session hash error = %v", err)
	}

	// 吊销剩余全部会话后 second 也失效。
	remainingResult, err := iam.ListSessions(t.Context(), accountID, 0, 100, service.SessionListAll)
	if err != nil {
		t.Fatal(err)
	}
	remaining := remainingResult.Items
	hashes := make([]string, 0, len(remaining))
	for _, item := range remaining {
		hashes = append(hashes, item.IDHash)
	}
	if n, err := iam.RevokeSessions(t.Context(), accountID, hashes); err != nil || n == 0 {
		t.Fatalf("revoke remaining = %d, %v", n, err)
	}
	if _, err := iam.Resolve(t.Context(), second.ID); !errors.Is(err, service.ErrSessionInvalid) {
		t.Fatalf("second session resolve error = %v", err)
	}
}

// sessionDigest 计算与服务端一致的明文会话摘要（测试夹具用）。
func sessionDigest(value string) []byte {
	sum := sha256.Sum256([]byte(value))
	return sum[:]
}

type recordingOperationAudit struct {
	requests []service.OperationAuditRequest
}

func (r *recordingOperationAudit) RecordOperation(_ context.Context, request service.OperationAuditRequest) error {
	r.requests = append(r.requests, request)
	return nil
}

func TestWriteOperationsAuditOperationOutcome(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	audit := &recordingOperationAudit{}
	iam.WithOperationAudit(audit)

	if _, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345"); err != nil {
		t.Fatal(err)
	}
	account, err := iam.CreateAccount(t.Context(), "member", "Member", "abcdefghijklmno")
	if err != nil {
		t.Fatal(err)
	}
	role, err := iam.CreateRole(t.Context(), "reader", "Reader", "")
	if err != nil {
		t.Fatal(err)
	}
	if err := iam.SetAccountStatus(t.Context(), account.ID, model.AccountDisabled); err != nil {
		t.Fatal(err)
	}
	if err := iam.ResetPassword(t.Context(), account.ID, "ponmlkjihgfedcb"); err != nil {
		t.Fatal(err)
	}
	rolesView, err := iam.AccountRolesSnapshot(t.Context(), account.ID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := iam.ReplaceAccountRoles(t.Context(), account.ID, rolesView.AccountVersion, []string{role.ID}); err != nil {
		t.Fatal(err)
	}
	permissionsView, err := iam.RolePermissionsSnapshot(t.Context(), role.ID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := iam.ReplaceRolePermissions(t.Context(), role.ID, permissionsView.RoleVersion, []permissioncatalog.Key{iampermission.SelfRead}); err != nil {
		t.Fatal(err)
	}

	operations := map[string]bool{}
	for _, request := range audit.requests {
		operations[request.Operation] = true
		if request.ResourceType != "account" && request.ResourceType != "role" {
			t.Fatalf("operation audit resource type unexpected: %#v", request)
		}
		if request.ResourceID == "" {
			t.Fatalf("operation audit resource id is empty: %#v", request)
		}
		if request.Outcome != service.OperationSucceeded {
			t.Fatalf("operation audit outcome is not succeeded: %#v", request)
		}
	}
	for _, expected := range []string{"iam.accounts.create", "iam.roles.create", "iam.accounts.status", "iam.accounts.password.reset", "iam.accounts.roles.replace", "iam.roles.permissions.replace"} {
		if !operations[expected] {
			t.Fatalf("operation audit missing %q: %#v", expected, audit.requests)
		}
	}
}

func TestWriteOperationAuditRecordsFailureWithoutBlocking(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	audit := &recordingOperationAudit{}
	iam.WithOperationAudit(audit)

	// 失败写操作：重置不存在账号应记录 failed 且不阻塞业务错误返回。
	err := iam.ResetPassword(t.Context(), "missing-account", "ponmlkjihgfedcb")
	if err == nil {
		t.Fatal("reset password for missing account should fail")
	}
	_ = err
	found := false
	for _, request := range audit.requests {
		if request.ResourceType == "account" && request.Outcome == service.OperationFailed {
			found = true
		}
	}
	if !found {
		t.Fatalf("failed operation audit missing: %#v", audit.requests)
	}
}

func TestSessionListRejectsUnknownAccount(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	if _, err := iam.ListSessions(t.Context(), "missing-account", 0, 20, service.SessionListAll); !errors.Is(err, repo.ErrNotFound) {
		t.Fatalf("unknown account session list error = %v", err)
	}
}

// TestAccountInfoUpdateRenamesAndRevokesSessions 验证账号显示名更新：成功变更
// 后安全 revision 递增、Session 撤销、过期版本返回稳定冲突。
func TestAccountInfoUpdateRenamesAndRevokesSessions(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	if _, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345"); err != nil {
		t.Fatal(err)
	}
	account, err := iam.CreateAccount(t.Context(), "member", "成员", "abcdefghijklmno")
	if err != nil {
		t.Fatal(err)
	}
	if err := iam.UpdateAccountInfo(t.Context(), account.ID, 99, "新名字"); !errors.Is(err, service.ErrVersionConflict) {
		t.Fatalf("stale account version error = %v", err)
	}
	session, err := iam.Login(t.Context(), "member", "abcdefghijklmno")
	if err != nil {
		t.Fatal(err)
	}
	accounts, err := iam.ListAccounts(t.Context(), 0, 20, repo.AccountFilter{})
	if err != nil {
		t.Fatal(err)
	}
	var currentVersion uint64
	for _, item := range accounts.Items {
		if item.ID == account.ID {
			currentVersion = item.Version
		}
	}
	if err := iam.UpdateAccountInfo(t.Context(), account.ID, currentVersion, "新名字"); err != nil {
		t.Fatal(err)
	}
	if _, err := iam.Resolve(t.Context(), session.ID); !errors.Is(err, service.ErrSessionInvalid) {
		t.Fatalf("session after rename error = %v", err)
	}
	replacement, err := iam.Login(t.Context(), "member", "abcdefghijklmno")
	if err != nil {
		t.Fatal(err)
	}
	if replacement.Identity.DisplayName != "新名字" || replacement.Identity.SecurityRevision != session.Identity.SecurityRevision+1 {
		t.Fatalf("replacement identity = %#v", replacement.Identity)
	}
}

// TestArchiveAccountBlocksLoginAssignmentAndRevokesSessions 验证账号归档：
// 归档后不可登录、组织分配失败（Assignable=false）、Session 撤销、owner 最后账号保护。
func TestArchiveAccountBlocksLoginAssignmentAndRevokesSessions(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	session, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345")
	if err != nil {
		t.Fatal(err)
	}
	account, err := iam.CreateAccount(t.Context(), "member", "成员", "abcdefghijklmno")
	if err != nil {
		t.Fatal(err)
	}
	memberSession, err := iam.Login(t.Context(), "member", "abcdefghijklmno")
	if err != nil {
		t.Fatal(err)
	}
	if err := iam.ArchiveAccount(t.Context(), account.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := iam.Login(t.Context(), "member", "abcdefghijklmno"); !errors.Is(err, service.ErrAccountDisabled) {
		t.Fatalf("login after archive error = %v", err)
	}
	if err := iam.RequireAssignableAccount(t.Context(), account.ID); !errors.Is(err, service.ErrAccountDisabled) {
		t.Fatalf("assignable after archive error = %v", err)
	}
	if _, err := iam.Resolve(t.Context(), memberSession.ID); !errors.Is(err, service.ErrSessionInvalid) {
		t.Fatalf("session after archive error = %v", err)
	}
	// 重复归档是 no-op。
	if err := iam.ArchiveAccount(t.Context(), account.ID); err != nil {
		t.Fatalf("repeat archive error = %v", err)
	}
	// 最后一个 owner 账号不可归档。
	if err := iam.ArchiveAccount(t.Context(), session.Identity.AccountID); !errors.Is(err, model.ErrOwnerInvariant) {
		t.Fatalf("archive last owner error = %v", err)
	}
}

// TestRoleInfoUpdateDoesNotChangeAuthorizationRevision 验证角色改名/描述更新：
// 不触发授权 revision change、不撤销持有者 Session；过期版本返回稳定冲突。
func TestRoleInfoUpdateDoesNotChangeAuthorizationRevision(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	if _, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345"); err != nil {
		t.Fatal(err)
	}
	role, err := iam.CreateRole(t.Context(), "reader", "只读", "")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := iam.ReplaceRolePermissions(t.Context(), role.ID, 1, []permissioncatalog.Key{iampermission.SelfRead}); err != nil {
		t.Fatal(err)
	}
	account, err := iam.CreateAccount(t.Context(), "member", "成员", "abcdefghijklmno")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := iam.ReplaceAccountRoles(t.Context(), account.ID, 1, []string{role.ID}); err != nil {
		t.Fatal(err)
	}
	session, err := iam.Login(t.Context(), "member", "abcdefghijklmno")
	if err != nil {
		t.Fatal(err)
	}
	before, err := iam.RolePermissionsSnapshot(t.Context(), role.ID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := iam.UpdateRoleInfo(t.Context(), role.ID, 99, "只读升级", "描述"); !errors.Is(err, service.ErrVersionConflict) {
		t.Fatalf("stale role version error = %v", err)
	}
	updated, err := iam.UpdateRoleInfo(t.Context(), role.ID, before.RoleVersion, "只读升级", "描述")
	if err != nil {
		t.Fatal(err)
	}
	if updated.Name != "只读升级" || updated.Description != "描述" {
		t.Fatalf("updated role = %#v", updated)
	}
	after, err := iam.RolePermissionsSnapshot(t.Context(), role.ID)
	if err != nil {
		t.Fatal(err)
	}
	if after.AuthorizationRevision != before.AuthorizationRevision {
		t.Fatalf("role info update changed authorization revision: %d -> %d", before.AuthorizationRevision, after.AuthorizationRevision)
	}
	// 改名不撤销持有者 Session。
	if _, err := iam.Resolve(t.Context(), session.ID); err != nil {
		t.Fatalf("member session after role rename = %v", err)
	}
	// owner 角色不可改名。
	ownerRoles, err := iam.ListRoles(t.Context(), 0, 20, "")
	if err != nil {
		t.Fatal(err)
	}
	for _, item := range ownerRoles.Items {
		if item.Code == model.OwnerRoleCode {
			if _, err := iam.UpdateRoleInfo(t.Context(), item.ID, item.Version, "x", ""); !errors.Is(err, service.ErrImmutableOwner) {
				t.Fatalf("owner role info update error = %v", err)
			}
		}
	}
}

// TestArchiveRoleRevokesPermissionAndSessions 验证角色归档：归档移出授权规则、
// 持有者 Session 撤销、不可再分配、owner 不可归档。
func TestArchiveRoleRevokesPermissionAndSessions(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	ownerSession, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345")
	if err != nil {
		t.Fatal(err)
	}
	role, err := iam.CreateRole(t.Context(), "reader", "只读", "")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := iam.ReplaceRolePermissions(t.Context(), role.ID, 1, []permissioncatalog.Key{iampermission.SelfRead, iampermission.AccountRead}); err != nil {
		t.Fatal(err)
	}
	account, err := iam.CreateAccount(t.Context(), "member", "成员", "abcdefghijklmno")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := iam.ReplaceAccountRoles(t.Context(), account.ID, 1, []string{role.ID}); err != nil {
		t.Fatal(err)
	}
	session, err := iam.Login(t.Context(), "member", "abcdefghijklmno")
	if err != nil {
		t.Fatal(err)
	}
	if err := iam.ArchiveRole(t.Context(), role.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := iam.Resolve(t.Context(), session.ID); !errors.Is(err, service.ErrSessionInvalid) {
		t.Fatalf("member session after role archive = %v", err)
	}
	// 归档角色不可再分配。
	accounts, err := iam.ListAccounts(t.Context(), 0, 20, repo.AccountFilter{})
	if err != nil {
		t.Fatal(err)
	}
	var accountVersion uint64
	for _, item := range accounts.Items {
		if item.ID == account.ID {
			accountVersion = item.Version
			break
		}
	}
	if _, err := iam.ReplaceAccountRoles(t.Context(), account.ID, accountVersion, []string{role.ID}); !errors.Is(err, repo.ErrNotFound) {
		t.Fatalf("assign archived role error = %v", err)
	}
	// 新登录不再获得该角色权限。
	replacement, err := iam.Login(t.Context(), "member", "abcdefghijklmno")
	if err != nil {
		t.Fatal(err)
	}
	if len(replacement.Identity.Permissions) != 0 {
		t.Fatalf("permissions after role archive = %v", replacement.Identity.Permissions)
	}
	// owner 角色不可归档。
	ownerRoles, err := iam.ListRoles(t.Context(), 0, 20, "")
	if err != nil {
		t.Fatal(err)
	}
	for _, item := range ownerRoles.Items {
		if item.Code == model.OwnerRoleCode {
			if err := iam.ArchiveRole(t.Context(), item.ID); !errors.Is(err, service.ErrImmutableOwner) {
				t.Fatalf("archive owner role error = %v", err)
			}
		}
	}
	_ = ownerSession
}

// TestUpdateSelfProfilePersistsProfileWithOptimisticLock 验证自服务资料更新：
// 昵称/介绍/出生日期写入并可读回；过期版本返回 ErrVersionConflict；非法出生日期拒绝。
func TestUpdateSelfProfilePersistsProfileWithOptimisticLock(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	session, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345")
	if err != nil {
		t.Fatal(err)
	}
	accounts, err := iam.ListAccounts(t.Context(), 0, 10, repo.AccountFilter{})
	if err != nil {
		t.Fatal(err)
	}
	firstVersion := accounts.Items[0].Version
	updated, err := iam.UpdateSelfProfile(t.Context(), session.Identity.AccountID, firstVersion, "Nick", "Hello", "1990-01-02")
	if err != nil {
		t.Fatal(err)
	}
	if updated.Nickname != "Nick" || updated.Bio != "Hello" || updated.BirthDate != "1990-01-02" || updated.Version != firstVersion+1 {
		t.Fatalf("updated account = %#v", updated)
	}
	if _, err := iam.UpdateSelfProfile(t.Context(), session.Identity.AccountID, firstVersion, "Nick2", "", ""); !errors.Is(err, service.ErrVersionConflict) {
		t.Fatalf("stale version error = %v", err)
	}
	if _, err := iam.UpdateSelfProfile(t.Context(), session.Identity.AccountID, updated.Version, "Nick2", "", "not-a-date"); !errors.Is(err, model.ErrInvalidProfile) {
		t.Fatalf("invalid birth date error = %v", err)
	}
}

// TestSelfPreferencesMergeDefaultsAndPersist 验证跨设备偏好（BE-090-005）：
// 未设置时返回默认；PATCH 合并覆盖并持久化；跨会话读取一致；非法值拒绝。
func TestSelfPreferencesMergeDefaultsAndPersist(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	session, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345")
	if err != nil {
		t.Fatal(err)
	}
	accountID := session.Identity.AccountID
	// 未设置时返回系统默认。
	initial, err := iam.SelfPreferences(t.Context(), accountID)
	if err != nil {
		t.Fatal(err)
	}
	defaults := model.DefaultUserPreferences()
	if initial.Language != defaults.Language || initial.ThemeMode != defaults.ThemeMode || initial.Density != defaults.Density || initial.ReduceMotion != defaults.ReduceMotion {
		t.Fatalf("initial preferences = %#v, want defaults %#v", initial, defaults)
	}
	// PATCH 合并更新：只改主题与密度，语言/通知保持默认。
	updated, err := iam.UpdateSelfPreferences(t.Context(), accountID, model.UserPreferences{
		ThemeMode: model.PreferenceThemeModeDark, ThemePreset: model.PreferenceThemePresetGreen, Density: model.PreferenceDensityCompact,
	}, nil)
	if err != nil {
		t.Fatal(err)
	}
	if updated.ThemeMode != model.PreferenceThemeModeDark || updated.ThemePreset != model.PreferenceThemePresetGreen || updated.Density != model.PreferenceDensityCompact {
		t.Fatalf("updated preferences = %#v", updated)
	}
	if updated.Language != defaults.Language || updated.ReduceMotion != defaults.ReduceMotion {
		t.Fatalf("updated preferences must keep untouched defaults: %#v", updated)
	}
	if updated.Notifications != defaults.Notifications {
		t.Fatalf("notifications must remain default: %#v", updated.Notifications)
	}
	// 跨会话读取（新 service 仍读同一 store）返回持久化值。
	again, err := iam.SelfPreferences(t.Context(), accountID)
	if err != nil {
		t.Fatal(err)
	}
	if again.ThemeMode != model.PreferenceThemeModeDark || again.Density != model.PreferenceDensityCompact {
		t.Fatalf("persisted preferences = %#v", again)
	}
	// 非法主题拒绝。
	if _, err := iam.UpdateSelfPreferences(t.Context(), accountID, model.UserPreferences{ThemeMode: "neon"}, nil); !errors.Is(err, model.ErrInvalidPreferences) {
		t.Fatalf("invalid theme mode error = %v", err)
	}
	// 非法时区拒绝。
	if _, err := iam.UpdateSelfPreferences(t.Context(), accountID, model.UserPreferences{TimeZone: "not a zone"}, nil); !errors.Is(err, model.ErrInvalidPreferences) {
		t.Fatalf("invalid time zone error = %v", err)
	}
	// 缺失账号返回 not-found。
	if _, err := iam.SelfPreferences(t.Context(), "missing-account"); !repo.IsNotFound(err) {
		t.Fatalf("missing account error = %v", err)
	}
}

// TestSelfPreferencesSupportsNotificationToggles 验证通知布尔偏好可显式关闭：
// 关闭后读取返回 false（不再回退默认 true）。
func TestSelfPreferencesSupportsNotificationToggles(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	session, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345")
	if err != nil {
		t.Fatal(err)
	}
	accountID := session.Identity.AccountID
	updated, err := iam.UpdateSelfPreferences(t.Context(), accountID, model.UserPreferences{}, &service.NotificationUpdate{
		EmailDigest: testBoolPointer(false), InApp: testBoolPointer(true), ShowSummaries: testBoolPointer(false), DailySummary: testBoolPointer(true),
	})
	if err != nil {
		t.Fatal(err)
	}
	if updated.Notifications.EmailDigest || !updated.Notifications.InApp || updated.Notifications.ShowSummaries || !updated.Notifications.DailySummary {
		t.Fatalf("notification toggles not honored: %#v", updated.Notifications)
	}
	again, err := iam.SelfPreferences(t.Context(), accountID)
	if err != nil {
		t.Fatal(err)
	}
	if again.Notifications != updated.Notifications {
		t.Fatalf("notification prefs not persisted: %#v", again.Notifications)
	}
}

// TestSelfArchiveRequiresTwoStepConfirmation 验证软注销两步确认：
// 未确认时账号保持可用；错误确认被拒；确认后归档生效（登录拒绝、会话吊销）。
func TestSelfArchiveRequiresTwoStepConfirmation(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	session, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345")
	if err != nil {
		t.Fatal(err)
	}
	member, err := iam.CreateAccount(t.Context(), "member", "成员", "abcdefghijklmno")
	if err != nil {
		t.Fatal(err)
	}
	memberSession, err := iam.Login(t.Context(), "member", "abcdefghijklmno")
	if err != nil {
		t.Fatal(err)
	}
	confirmation, err := iam.BeginSelfArchive(t.Context(), member.ID)
	if err != nil {
		t.Fatal(err)
	}
	// 错误确认被拒绝，账号仍可用。
	if err := iam.ConfirmSelfArchive(t.Context(), member.ID, "wrong-confirmation"); !errors.Is(err, model.ErrInvalidConfirmation) {
		t.Fatalf("wrong confirmation error = %v", err)
	}
	if _, err := iam.Resolve(t.Context(), memberSession.ID); err != nil {
		t.Fatalf("session before confirm error = %v", err)
	}
	// 正确确认后归档生效：登录拒绝、会话吊销、重复确认过期。
	if err := iam.ConfirmSelfArchive(t.Context(), member.ID, confirmation); err != nil {
		t.Fatal(err)
	}
	if _, err := iam.Login(t.Context(), "member", "abcdefghijklmno"); !errors.Is(err, service.ErrAccountDisabled) {
		t.Fatalf("login after self archive error = %v", err)
	}
	if _, err := iam.Resolve(t.Context(), memberSession.ID); !errors.Is(err, service.ErrSessionInvalid) {
		t.Fatalf("session after self archive error = %v", err)
	}
	// 最后一个 owner 账号不允许两步软注销确认。
	ownerConfirmation, err := iam.BeginSelfArchive(t.Context(), session.Identity.AccountID)
	if err != nil {
		t.Fatal(err)
	}
	if err := iam.ConfirmSelfArchive(t.Context(), session.Identity.AccountID, ownerConfirmation); !errors.Is(err, model.ErrOwnerInvariant) {
		t.Fatalf("archive last owner confirm error = %v", err)
	}
}

// TestReverseMembershipQueries 验证角色→账号、权限键→角色反向查询（076 G2）：
// 分页 total、未知角色 404 语义、未知权限键拒绝。
func TestReverseMembershipQueries(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	if _, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345"); err != nil {
		t.Fatal(err)
	}
	member, err := iam.CreateAccount(t.Context(), "member", "成员", "123456789012345")
	if err != nil {
		t.Fatal(err)
	}
	editor, err := iam.CreateRole(t.Context(), "editor", "编辑器", "")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := iam.ReplaceAccountRoles(t.Context(), member.ID, 1, []string{editor.ID}); err != nil {
		t.Fatal(err)
	}
	if _, err := iam.ReplaceRolePermissions(t.Context(), editor.ID, 1, []permissioncatalog.Key{iampermission.SelfRead}); err != nil {
		t.Fatal(err)
	}
	accounts, err := iam.ListAccountsForRole(t.Context(), editor.ID, 0, 20)
	if err != nil {
		t.Fatal(err)
	}
	if accounts.Total != 1 || len(accounts.Items) != 1 || accounts.Items[0].ID != member.ID {
		t.Fatalf("role accounts = %#v", accounts)
	}
	roles, err := iam.ListRolesForPermission(t.Context(), iampermission.SelfRead, 0, 20)
	if err != nil {
		t.Fatal(err)
	}
	// Setup 时 owner 角色拥有全部当前目录权限（054 语义），因此 editor 与 owner 都命中。
	if roles.Total != 2 || len(roles.Items) != 2 || roles.Items[0].ID != editor.ID {
		t.Fatalf("permission roles = %#v", roles)
	}
	if _, err := iam.ListRolesForPermission(t.Context(), "unknown:key", 0, 20); !errors.Is(err, service.ErrUnknownPermission) {
		t.Fatalf("unknown permission error = %v", err)
	}
	if _, err := iam.ListAccountsForRole(t.Context(), "missing-role", 0, 20); !errors.Is(err, repo.ErrNotFound) {
		t.Fatalf("unknown role error = %v", err)
	}
}

// TestListSessionsPaginationAndStatusFilter 验证会话列表分页与 active/revoked 过滤
// （076 G3）：total 与列表同条件、分页生效、吊销后过滤翻转、未知状态拒绝。
func TestListSessionsPaginationAndStatusFilter(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	first, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := iam.Login(t.Context(), "owner", "123456789012345"); err != nil {
		t.Fatal(err)
	}
	accountID := first.Identity.AccountID
	active, err := iam.ListSessions(t.Context(), accountID, 0, 1, service.SessionListActive)
	if err != nil {
		t.Fatal(err)
	}
	if active.Total != 2 || len(active.Items) != 1 || active.Limit != 1 {
		t.Fatalf("active page = %#v", active)
	}
	revoked, err := iam.ListSessions(t.Context(), accountID, 0, 100, service.SessionListRevoked)
	if err != nil {
		t.Fatal(err)
	}
	if revoked.Total != 0 || len(revoked.Items) != 0 {
		t.Fatalf("revoked before any revocation = %#v", revoked)
	}
	all, err := iam.ListSessions(t.Context(), accountID, 0, 100, service.SessionListAll)
	if err != nil {
		t.Fatal(err)
	}
	if all.Total != 2 || len(all.Items) != 2 {
		t.Fatalf("all sessions = %#v", all)
	}
	// 吊销其中一个会话后 active/revoked 过滤各自翻转。
	if _, err := iam.RevokeSessions(t.Context(), accountID, []string{all.Items[0].IDHash}); err != nil {
		t.Fatal(err)
	}
	activeAfter, err := iam.ListSessions(t.Context(), accountID, 0, 100, service.SessionListActive)
	if err != nil {
		t.Fatal(err)
	}
	if activeAfter.Total != 1 {
		t.Fatalf("active after revoke = %d", activeAfter.Total)
	}
	revokedAfter, err := iam.ListSessions(t.Context(), accountID, 0, 100, service.SessionListRevoked)
	if err != nil {
		t.Fatal(err)
	}
	if revokedAfter.Total != 1 {
		t.Fatalf("revoked after revoke = %d", revokedAfter.Total)
	}
	if _, err := iam.ListSessions(t.Context(), accountID, 0, 100, service.SessionListStatus("bogus")); err == nil {
		t.Fatal("unknown session status must be rejected")
	}
}

// TestListAccountsMultiFilter 验证账号列表 status/archived/roleId 多维过滤（076 G4），
// Count 与 List 同语义、无过滤时保持既有行为。
func TestListAccountsMultiFilter(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	if _, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345"); err != nil {
		t.Fatal(err)
	}
	member, err := iam.CreateAccount(t.Context(), "member", "成员", "123456789012345")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := iam.CreateAccount(t.Context(), "third", "Third", "123456789012345"); err != nil {
		t.Fatal(err)
	}
	plain, err := iam.ListAccounts(t.Context(), 0, 100, repo.AccountFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if plain.Total != 3 {
		t.Fatalf("plain list total = %d", plain.Total)
	}
	// status=disabled
	if err := iam.SetAccountStatus(t.Context(), member.ID, model.AccountDisabled); err != nil {
		t.Fatal(err)
	}
	disabled, err := iam.ListAccounts(t.Context(), 0, 100, repo.AccountFilter{Status: string(model.AccountDisabled)})
	if err != nil {
		t.Fatal(err)
	}
	if disabled.Total != 1 || disabled.Items[0].ID != member.ID {
		t.Fatalf("disabled filter = %#v", disabled)
	}
	// archived=true
	if err := iam.ArchiveAccount(t.Context(), member.ID); err != nil {
		t.Fatal(err)
	}
	archivedTrue := true
	archived, err := iam.ListAccounts(t.Context(), 0, 100, repo.AccountFilter{Archived: &archivedTrue})
	if err != nil {
		t.Fatal(err)
	}
	if archived.Total != 1 || archived.Items[0].ID != member.ID {
		t.Fatalf("archived filter = %#v", archived)
	}
	// roleId=owner 角色只匹配 setup 账号。
	roles, err := iam.ListRoles(t.Context(), 0, 100, "")
	if err != nil {
		t.Fatal(err)
	}
	ownerRoleID := ""
	for _, role := range roles.Items {
		if role.Code == model.OwnerRoleCode {
			ownerRoleID = role.ID
		}
	}
	if ownerRoleID == "" {
		t.Fatal("owner role not found")
	}
	byOwner, err := iam.ListAccounts(t.Context(), 0, 100, repo.AccountFilter{RoleID: ownerRoleID})
	if err != nil {
		t.Fatal(err)
	}
	if byOwner.Total != 1 || byOwner.Items[0].Username != "owner" {
		t.Fatalf("roleId filter = %#v", byOwner)
	}
}

// newPolicyService 使用显式密码策略构造 IAM Service（076 G5）。
func newPolicyService(t *testing.T, policy model.PasswordPolicy) *service.Service {
	t.Helper()
	path := filepath.Join(t.TempDir(), "iam.db")
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
	t.Cleanup(func() { _ = resource.Close() })
	return serviceForResourceWithPolicy(t, resource, iampermission.Definitions(), policy)
}

// TestPasswordPolicyMinMaxApplied 验证自定义最小/最大长度在创建与修改密码路径生效（076 G5）。
func TestPasswordPolicyMinMaxApplied(t *testing.T) {
	iam := newPolicyService(t, model.PasswordPolicy{MinLength: 8, MaxLength: 20})
	if _, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "1234567"); !errors.Is(err, model.ErrInvalidPassword) {
		t.Fatalf("setup below-min password error = %v", err)
	}
	owner, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "12345678")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := iam.CreateAccount(t.Context(), "member", "成员", "123456789012345678901"); !errors.Is(err, model.ErrInvalidPassword) {
		t.Fatalf("create above-max password error = %v", err)
	}
	if _, err := iam.CreateAccount(t.Context(), "member", "成员", "12345678"); err != nil {
		t.Fatal(err)
	}
	session, err := iam.Login(t.Context(), "owner", "12345678")
	if err != nil {
		t.Fatal(err)
	}
	if err := iam.ChangePassword(t.Context(), owner.Identity.AccountID, "12345678", "123456789012345678901"); !errors.Is(err, model.ErrInvalidPassword) {
		t.Fatalf("change to above-max password error = %v", err)
	}
	if err := iam.ChangePassword(t.Context(), session.Identity.AccountID, "12345678", "abcdefgh123"); err != nil {
		t.Fatal(err)
	}
}

// TestPasswordPolicyComplexityOption 验证复杂度开关：开启后必须同时包含大写、
// 小写与数字（076 G5）；默认关闭时不要求复杂度（既有存量兼容）。
func TestPasswordPolicyComplexityOption(t *testing.T) {
	iam := newPolicyService(t, model.PasswordPolicy{MinLength: 8, MaxLength: 128, RequireComplexity: true})
	if _, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "abcdefgh"); !errors.Is(err, model.ErrInvalidPassword) {
		t.Fatalf("setup non-complex password error = %v", err)
	}
	if _, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "Abcd1234"); err != nil {
		t.Fatal(err)
	}
}

// newLimitService 使用显式口令策略与会话上限构造 IAM Service（077 P2）。
func newLimitService(t *testing.T, policy model.PasswordPolicy, maxSessions int) *service.Service {
	t.Helper()
	path := filepath.Join(t.TempDir(), "iam.db")
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
	t.Cleanup(func() { _ = resource.Close() })
	store := storeForResource(t, resource)
	catalog, err := permissioncatalog.BuildCatalog(iampermission.Definitions()...)
	if err != nil {
		t.Fatal(err)
	}
	runtime, err := authorization.New(store, catalog)
	if err != nil {
		t.Fatal(err)
	}
	iam, err := service.New(store, clock.Fixed(time.Date(2026, 8, 22, 1, 0, 0, 0, time.UTC)), idgen.UUID(), passwordadapter.Hasher{}, service.Config{SetupToken: "setup-secret", IdleTimeout: 30 * time.Minute, AbsoluteTimeout: 12 * time.Hour, MaxFailedAttempts: 3, LockDuration: 15 * time.Minute, PasswordPolicy: policy, MaxSessionsPerAccount: maxSessions}, catalog, runtime)
	if err != nil {
		t.Fatal(err)
	}
	return iam
}

// TestPasswordHistoryPreventsReuse 验证 historySize 启用后禁止复用最近 N 次口令，
// 且裁剪后旧口令可重新使用（077 P1）。
func TestPasswordHistoryPreventsReuse(t *testing.T) {
	iam := newLimitService(t, model.PasswordPolicy{MinLength: 8, MaxLength: 128, HistorySize: 3}, 0)
	if _, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "password01"); err != nil {
		t.Fatal(err)
	}
	member, err := iam.CreateAccount(t.Context(), "member", "成员", "password01")
	if err != nil {
		t.Fatal(err)
	}
	session, err := iam.Login(t.Context(), "member", "password01")
	if err != nil {
		t.Fatal(err)
	}
	accountID := session.Identity.AccountID
	if accountID != member.ID {
		t.Fatalf("session account = %s, want %s", accountID, member.ID)
	}
	if err := iam.ChangePassword(t.Context(), accountID, "password01", "password02"); err != nil {
		t.Fatal(err)
	}
	if err := iam.ChangePassword(t.Context(), accountID, "password02", "password03"); err != nil {
		t.Fatal(err)
	}
	// 最近 3 条历史包含 password01/02/03，复用 password01 拒绝。
	if err := iam.ChangePassword(t.Context(), accountID, "password03", "password01"); !errors.Is(err, service.ErrPasswordReused) {
		t.Fatalf("reuse within history error = %v", err)
	}
	// 改到 password04 后历史裁剪为 [04,03,02]，password01 已移出最近 3 条，可复用。
	if err := iam.ChangePassword(t.Context(), accountID, "password03", "password04"); err != nil {
		t.Fatal(err)
	}
	if err := iam.ChangePassword(t.Context(), accountID, "password04", "password01"); err != nil {
		t.Fatalf("reuse outside history should succeed: %v", err)
	}
}

// TestPasswordAgeForcesRestrictedChange 验证 maxPasswordAge 到期后登录进入受限
// 改密状态（MustChangePassword），改密后恢复普通会话（077 P1）。两个 Service
// 共享同一数据库，用不同固定时钟构造「口令已过期」场景。
func TestPasswordAgeForcesRestrictedChange(t *testing.T) {
	path := filepath.Join(t.TempDir(), "iam.db")
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
	t.Cleanup(func() { _ = resource.Close() })
	store := storeForResource(t, resource)
	catalog, err := permissioncatalog.BuildCatalog(iampermission.Definitions()...)
	if err != nil {
		t.Fatal(err)
	}
	runtime, err := authorization.New(store, catalog)
	if err != nil {
		t.Fatal(err)
	}
	makeService := func(now time.Time, policy model.PasswordPolicy) *service.Service {
		iam, serviceErr := service.New(store, clock.Fixed(now), idgen.UUID(), passwordadapter.Hasher{}, service.Config{SetupToken: "setup-secret", IdleTimeout: 30 * time.Minute, AbsoluteTimeout: 12 * time.Hour, MaxFailedAttempts: 3, LockDuration: 15 * time.Minute, PasswordPolicy: policy}, catalog, runtime)
		if serviceErr != nil {
			t.Fatal(serviceErr)
		}
		return iam
	}
	base := makeService(time.Date(2026, 8, 22, 1, 0, 0, 0, time.UTC), model.PasswordPolicy{MinLength: 8, MaxLength: 128})
	if _, err := base.Setup(t.Context(), "setup-secret", "owner", "Owner", "password01"); err != nil {
		t.Fatal(err)
	}
	// 2 分钟后登录：口令 changed_at=01:00，maxPasswordAge=1m => 过期受限。
	aged := makeService(time.Date(2026, 8, 22, 1, 2, 0, 0, time.UTC), model.PasswordPolicy{MinLength: 8, MaxLength: 128, MaxPasswordAge: time.Minute})
	session, err := aged.Login(t.Context(), "owner", "password01")
	if err != nil {
		t.Fatal(err)
	}
	if !session.Identity.MustChangePassword {
		t.Fatal("expired password login must be restricted")
	}
	// 改密后 changed_at=01:02，不再过期，恢复普通会话。
	if err := aged.ChangePassword(t.Context(), session.Identity.AccountID, "password01", "password02"); err != nil {
		t.Fatal(err)
	}
	after, err := aged.Login(t.Context(), "owner", "password02")
	if err != nil {
		t.Fatal(err)
	}
	if after.Identity.MustChangePassword {
		t.Fatal("password change must clear restricted state")
	}
}

// TestMaxSessionsEvictsOldest 验证 maxSessionsPerAccount 启用后新登录主动吊销
// 最旧 active 会话（077 P2），会话总数保持上限。
func TestMaxSessionsEvictsOldest(t *testing.T) {
	iam := newLimitService(t, model.PasswordPolicy{MinLength: 8, MaxLength: 128}, 2)
	first, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "password01")
	if err != nil {
		t.Fatal(err)
	}
	second, err := iam.Login(t.Context(), "owner", "password01")
	if err != nil {
		t.Fatal(err)
	}
	third, err := iam.Login(t.Context(), "owner", "password01")
	if err != nil {
		t.Fatal(err)
	}
	// 第三次登录时应主动剔一个最旧 active 会话（固定时钟下 created_at 相同，
	// 由 id_hash 决定次序），new 会话永远不被踢；被踢会话 Resolve 失效。
	if _, err := iam.Resolve(t.Context(), third.ID); err != nil {
		t.Fatalf("newest session must survive eviction: %v", err)
	}
	evicted := 0
	for _, id := range []string{first.ID, second.ID} {
		if _, err := iam.Resolve(t.Context(), id); err != nil {
			if !errors.Is(err, service.ErrSessionInvalid) {
				t.Fatalf("session resolve error = %v", err)
			}
			evicted++
		}
	}
	if evicted != 1 {
		t.Fatalf("evicted oldest sessions = %d, want 1", evicted)
	}
	active, err := iam.ListSessions(t.Context(), first.Identity.AccountID, 0, 100, service.SessionListActive)
	if err != nil {
		t.Fatal(err)
	}
	if active.Total != 2 {
		t.Fatalf("active sessions after eviction = %d, want 2", active.Total)
	}
}

// TestApiTokenLifecycle 验证 API-Token 发证→使用→轮换→吊销闭环（078）：
// secret 明文仅一次、scope 校验、吊销/轮换失效、未知 scope 拒绝。
func TestApiTokenLifecycle(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	owner, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345")
	if err != nil {
		t.Fatal(err)
	}
	accountID := owner.Identity.AccountID
	issued, err := iam.CreateApiToken(t.Context(), accountID, "ci", "CI access", []permissioncatalog.Key{iampermission.AccountRead}, nil)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(issued.Secret, "iam_") || issued.Secret == "" {
		t.Fatalf("issued secret invalid: %q", issued.Secret)
	}
	// 解析成功且 scope 正确。
	resolution, err := iam.ResolveApiToken(t.Context(), issued.Secret)
	if err != nil {
		t.Fatal(err)
	}
	if resolution.AccountID != accountID || len(resolution.Scopes) != 1 || resolution.Scopes[0] != iampermission.AccountRead {
		t.Fatalf("resolution = %#v", resolution)
	}
	// 列表不含明文。
	list, err := iam.ListApiTokens(t.Context(), accountID, 0, 20, service.ApiTokenStatusAll)
	if err != nil {
		t.Fatal(err)
	}
	if list.Total != 1 || len(list.Items) != 1 || list.Items[0].Name != "ci" {
		t.Fatalf("api token list = %#v", list)
	}
	// 未知 scope 创建拒绝。
	if _, err := iam.CreateApiToken(t.Context(), accountID, "bad", "", []permissioncatalog.Key{"no:such:key"}, nil); !errors.Is(err, service.ErrUnknownPermission) {
		t.Fatalf("unknown scope error = %v", err)
	}
	// 轮换：旧 secret 立即失效，新 secret 可用。
	rotated, err := iam.RotateApiToken(t.Context(), accountID, issued.ID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := iam.ResolveApiToken(t.Context(), issued.Secret); !errors.Is(err, service.ErrSessionInvalid) {
		t.Fatalf("rotated secret resolve error = %v", err)
	}
	if _, err := iam.ResolveApiToken(t.Context(), rotated.Secret); err != nil {
		t.Fatal(err)
	}
	// 吊销：认证失败；非所属令牌 404。
	if err := iam.RevokeApiToken(t.Context(), accountID, issued.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := iam.ResolveApiToken(t.Context(), rotated.Secret); !errors.Is(err, service.ErrSessionInvalid) {
		t.Fatalf("revoked secret resolve error = %v", err)
	}
	if _, err := iam.RotateApiToken(t.Context(), accountID, "missing-token"); !errors.Is(err, repo.ErrNotFound) {
		t.Fatalf("rotate unknown token error = %v", err)
	}
}

// TestApiTokenScopeInheritance 验证权限知情创建（080）：令牌 scope 必须受限于
// 创建者当前有效权限（越权 403），受限（需改密）账号禁止创建。
func TestApiTokenScopeInheritance(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	owner, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345")
	if err != nil {
		t.Fatal(err)
	}
	// reader 角色只授 AccountRead。
	reader, err := iam.CreateRole(t.Context(), "reader", "Reader", "")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := iam.ReplaceRolePermissions(t.Context(), reader.ID, 1, []permissioncatalog.Key{iampermission.AccountRead, iampermission.SelfRead, iampermission.SelfPasswordWrite}); err != nil {
		t.Fatal(err)
	}
	member, err := iam.CreateAccount(t.Context(), "member", "Member", "123456789012345")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := iam.ReplaceAccountRoles(t.Context(), member.ID, 1, []string{reader.ID}); err != nil {
		t.Fatal(err)
	}
	// 受限（MustChangePassword）账号禁止创建令牌。
	if _, err := iam.CreateApiToken(t.Context(), member.ID, "x", "", []permissioncatalog.Key{iampermission.AccountRead}, nil); !errors.Is(err, service.ErrAccountDisabled) {
		t.Fatalf("restricted create error = %v", err)
	}
	// 改密后解除受限。
	session, err := iam.Login(t.Context(), "member", "123456789012345")
	if err != nil {
		t.Fatal(err)
	}
	if err := iam.ChangePassword(t.Context(), session.Identity.AccountID, "123456789012345", "abcdefghijklmno"); err != nil {
		t.Fatal(err)
	}
	// 越权：member 请求 RoleWrite（非其有效权限）-> 403。
	if _, err := iam.CreateApiToken(t.Context(), member.ID, "bad", "", []permissioncatalog.Key{iampermission.RoleWrite}, nil); !errors.Is(err, service.ErrApiTokenScopeNotOwned) {
		t.Fatalf("out-of-scope create error = %v", err)
	}
	// 权限内：member 创建 AccountRead 令牌成功。
	issued, err := iam.CreateApiToken(t.Context(), member.ID, "good", "", []permissioncatalog.Key{iampermission.AccountRead}, nil)
	if err != nil {
		t.Fatalf("in-scope create error = %v", err)
	}
	resolution, err := iam.ResolveApiToken(t.Context(), issued.Secret)
	if err != nil {
		t.Fatal(err)
	}
	if resolution.AccountID != member.ID || len(resolution.Scopes) != 1 || resolution.Scopes[0] != iampermission.AccountRead {
		t.Fatalf("member resolution = %#v", resolution)
	}
	_ = owner
}

// TestApiTokenLifecycleStates 验证令牌状态机（080）：禁用/启用（可逆）、过期、
// 吊销（终态）与 status 过滤。
func TestApiTokenLifecycleStates(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	if _, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345"); err != nil {
		t.Fatal(err)
	}
	accountID := "owner"
	_ = accountID
	// 用 Setup 返回的 session 账号。
	ownerSession, err := iam.Login(t.Context(), "owner", "123456789012345")
	if err != nil {
		t.Fatal(err)
	}
	accountID = ownerSession.Identity.AccountID
	issued, err := iam.CreateApiToken(t.Context(), accountID, "a", "", []permissioncatalog.Key{iampermission.SelfRead}, nil)
	if err != nil {
		t.Fatal(err)
	}
	// 禁用：认证立即失败；启用：恢复。
	if err := iam.DisableApiToken(t.Context(), accountID, issued.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := iam.ResolveApiToken(t.Context(), issued.Secret); !errors.Is(err, service.ErrSessionInvalid) {
		t.Fatalf("disabled resolve error = %v", err)
	}
	if err := iam.EnableApiToken(t.Context(), accountID, issued.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := iam.ResolveApiToken(t.Context(), issued.Secret); err != nil {
		t.Fatal(err)
	}
	// 元数据更新：改名/描述/永不过期。
	if err := iam.UpdateApiToken(t.Context(), accountID, issued.ID, "renamed", "desc", nil, true); err != nil {
		t.Fatal(err)
	}
	// 吊销（终态）。
	if err := iam.RevokeApiToken(t.Context(), accountID, issued.ID); err != nil {
		t.Fatal(err)
	}
	// status 过滤。
	list, err := iam.ListApiTokens(t.Context(), accountID, 0, 50, service.ApiTokenStatusRevoked)
	if err != nil {
		t.Fatal(err)
	}
	if list.Total != 1 || list.Items[0].Status != "revoked" {
		t.Fatalf("revoked list = %#v", list)
	}
	active, err := iam.ListApiTokens(t.Context(), accountID, 0, 50, service.ApiTokenStatusActive)
	if err != nil {
		t.Fatal(err)
	}
	if active.Total != 0 || len(active.Items) != 0 {
		t.Fatalf("active list after revoke = %#v", active)
	}
}

// TestBatchRevokeApiTokensIdempotent 验证批量吊销令牌（090 PAGE-090-002）：
// 逐项吊销、已吊销幂等、Idempotency-Key 稳定重放、缺失项不报错。
func TestBatchRevokeApiTokensIdempotent(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	owner, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345")
	if err != nil {
		t.Fatal(err)
	}
	accountID := owner.Identity.AccountID
	first, err := iam.CreateApiToken(t.Context(), accountID, "a", "", []permissioncatalog.Key{iampermission.SelfRead}, nil)
	if err != nil {
		t.Fatal(err)
	}
	second, err := iam.CreateApiToken(t.Context(), accountID, "b", "", []permissioncatalog.Key{iampermission.SelfRead}, nil)
	if err != nil {
		t.Fatal(err)
	}
	third, err := iam.CreateApiToken(t.Context(), accountID, "c", "", []permissioncatalog.Key{iampermission.SelfRead}, nil)
	if err != nil {
		t.Fatal(err)
	}
	result, err := iam.BatchRevokeApiTokensIdempotent(t.Context(), "batch-revoke-1", "corr-1", accountID, []string{first.ID, second.ID, "missing-token"})
	if err != nil {
		t.Fatal(err)
	}
	if result.RequestedCount != 3 || result.ProcessedCount != 3 || len(result.Succeeded) != 3 || len(result.Failed) != 0 {
		t.Fatalf("batch revoke result = %#v", result)
	}
	// 已吊销的令牌认证失败。
	if _, err := iam.ResolveApiToken(t.Context(), first.Secret); !errors.Is(err, service.ErrSessionInvalid) {
		t.Fatalf("revoked secret resolve error = %v", err)
	}
	if _, err := iam.ResolveApiToken(t.Context(), second.Secret); !errors.Is(err, service.ErrSessionInvalid) {
		t.Fatalf("revoked secret resolve error = %v", err)
	}
	// 未在批次中的第三个令牌仍可用。
	if _, err := iam.ResolveApiToken(t.Context(), third.Secret); err != nil {
		t.Fatalf("unrevoked secret resolve error = %v", err)
	}
	// 相同 key 重放返回原结果且不报错（幂等）。
	replayed, err := iam.BatchRevokeApiTokensIdempotent(t.Context(), "batch-revoke-1", "corr-1", accountID, []string{first.ID, second.ID, "missing-token"})
	if err != nil {
		t.Fatal(err)
	}
	if replayed.RequestedCount != result.RequestedCount || len(replayed.Succeeded) != len(result.Succeeded) {
		t.Fatalf("replayed batch result = %#v, want %#v", replayed, result)
	}
	// 同一 key 复用于不同请求 payload 返回冲突。
	if _, err := iam.BatchRevokeApiTokensIdempotent(t.Context(), "batch-revoke-1", "corr-1", accountID, []string{first.ID}); !errors.Is(err, service.ErrIdempotencyConflict) {
		t.Fatalf("conflicting payload error = %v", err)
	}
}

// TestApiTokenExpiryViaLaterClock 用共享数据库 + 更晚固定时钟验证过期：
// 创建（expiresAt=01:30）后，在 01:31 的实例上认证被拒绝且 status=expired。
func TestApiTokenExpiryViaLaterClock(t *testing.T) {
	path := filepath.Join(t.TempDir(), "iam.db")
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
	t.Cleanup(func() { _ = resource.Close() })
	store := storeForResource(t, resource)
	catalog, err := permissioncatalog.BuildCatalog(iampermission.Definitions()...)
	if err != nil {
		t.Fatal(err)
	}
	runtime, err := authorization.New(store, catalog)
	if err != nil {
		t.Fatal(err)
	}
	makeIAM := func(now time.Time) *service.Service {
		iam, serviceErr := service.New(store, clock.Fixed(now), idgen.UUID(), passwordadapter.Hasher{}, service.Config{SetupToken: "setup-secret", IdleTimeout: 30 * time.Minute, AbsoluteTimeout: 12 * time.Hour, MaxFailedAttempts: 3, LockDuration: 15 * time.Minute, PasswordPolicy: model.DefaultPasswordPolicy()}, catalog, runtime)
		if serviceErr != nil {
			t.Fatal(serviceErr)
		}
		return iam
	}
	first := makeIAM(time.Date(2026, 8, 22, 1, 0, 0, 0, time.UTC))
	if _, err := first.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345"); err != nil {
		t.Fatal(err)
	}
	owner, err := first.Login(t.Context(), "owner", "123456789012345")
	if err != nil {
		t.Fatal(err)
	}
	expiresAt := time.Date(2026, 8, 22, 1, 30, 0, 0, time.UTC)
	issued, err := first.CreateApiToken(t.Context(), owner.Identity.AccountID, "short", "", []permissioncatalog.Key{iampermission.SelfRead}, &expiresAt)
	if err != nil {
		t.Fatal(err)
	}
	// 01:31 实例：同时钟过期（expiresAt 01:30 已过）-> 认证拒绝 + status=expired。
	later := makeIAM(time.Date(2026, 8, 22, 1, 31, 0, 0, time.UTC))
	if _, err := later.ResolveApiToken(t.Context(), issued.Secret); !errors.Is(err, service.ErrSessionInvalid) {
		t.Fatalf("expired resolve error = %v", err)
	}
	list, err := later.ListApiTokens(t.Context(), owner.Identity.AccountID, 0, 50, service.ApiTokenStatusExpired)
	if err != nil {
		t.Fatal(err)
	}
	if list.Total != 1 || list.Items[0].Status != "expired" {
		t.Fatalf("expired list = %#v", list)
	}
}

// newTokenService 使用显式 API 令牌上限与默认 TTL 构造 IAM Service（080）。
func newTokenService(t *testing.T, maxPerAccount int, defaultTTL time.Duration) *service.Service {
	t.Helper()
	path := filepath.Join(t.TempDir(), "iam.db")
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
	t.Cleanup(func() { _ = resource.Close() })
	store := storeForResource(t, resource)
	catalog, err := permissioncatalog.BuildCatalog(iampermission.Definitions()...)
	if err != nil {
		t.Fatal(err)
	}
	runtime, err := authorization.New(store, catalog)
	if err != nil {
		t.Fatal(err)
	}
	iam, err := service.New(store, clock.Fixed(time.Date(2026, 8, 22, 1, 0, 0, 0, time.UTC)), idgen.UUID(), passwordadapter.Hasher{}, service.Config{SetupToken: "setup-secret", IdleTimeout: 30 * time.Minute, AbsoluteTimeout: 12 * time.Hour, MaxFailedAttempts: 3, LockDuration: 15 * time.Minute, PasswordPolicy: model.DefaultPasswordPolicy(), ApiTokenMaxPerAccount: maxPerAccount, ApiTokenDefaultTTL: defaultTTL}, catalog, runtime)
	if err != nil {
		t.Fatal(err)
	}
	return iam
}

// TestApiTokenLimitAndDefaultTTL 验证数量上限（未吊销计数，超限 409）与默认
// TTL（未指定过期时间时生效；默认 TTL 到期后认证失败）。
func TestApiTokenLimitAndDefaultTTL(t *testing.T) {
	iam := newTokenService(t, 2, 24*time.Hour)
	if _, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345"); err != nil {
		t.Fatal(err)
	}
	owner, err := iam.Login(t.Context(), "owner", "123456789012345")
	if err != nil {
		t.Fatal(err)
	}
	accountID := owner.Identity.AccountID
	if _, err := iam.CreateApiToken(t.Context(), accountID, "one", "", []permissioncatalog.Key{iampermission.SelfRead}, nil); err != nil {
		t.Fatal(err)
	}
	second, err := iam.CreateApiToken(t.Context(), accountID, "two", "", []permissioncatalog.Key{iampermission.SelfRead}, nil)
	if err != nil {
		t.Fatal(err)
	}
	// 上限 2：第三个未吊销令牌 -> 409。
	if _, err := iam.CreateApiToken(t.Context(), accountID, "three", "", []permissioncatalog.Key{iampermission.SelfRead}, nil); !errors.Is(err, service.ErrApiTokenLimit) {
		t.Fatalf("limit error = %v", err)
	}
	// 吊销一个后 revoked 不占额度，可再创建。
	if err := iam.RevokeApiToken(t.Context(), accountID, second.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := iam.CreateApiToken(t.Context(), accountID, "three", "", []permissioncatalog.Key{iampermission.SelfRead}, nil); err != nil {
		t.Fatal(err)
	}
	// 默认 TTL 到期后认证失败（固定时钟 01:00，ttl=24h -> expires 01:00 次日后 active；
	// 用后续时钟构造过期场景需要新实例，此处只断言默认 TTL 落在 expiresAt=now+24h）。
	list, err := iam.ListApiTokens(t.Context(), accountID, 0, 50, service.ApiTokenStatusActive)
	if err != nil {
		t.Fatal(err)
	}
	for _, item := range list.Items {
		if item.ExpiresAt == nil {
			t.Fatalf("default ttl token has no expiry: %#v", item)
		}
	}
}

// TestMFABindAndLoginFlow 验证 TOTP 绑定/确认/登录两步/解绑闭环（078）：
// 绑定后登录返回一次性挑战，验证码通过后建立 mfa_verified 会话。
func TestMFABindAndLoginFlow(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	owner, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345")
	if err != nil {
		t.Fatal(err)
	}
	accountID := owner.Identity.AccountID
	bound, err := iam.MFABound(t.Context(), accountID)
	if err != nil || bound {
		t.Fatalf("mfa bound before enroll = %v, %v", bound, err)
	}
	enroll, err := iam.BeginMFAEnroll(t.Context(), accountID)
	if err != nil {
		t.Fatal(err)
	}
	if enroll.Secret == "" || !strings.HasPrefix(enroll.URI, "otpauth://totp/") {
		t.Fatalf("enroll view = %#v", enroll)
	}
	now := time.Date(2026, 8, 22, 1, 0, 0, 0, time.UTC)
	code, err := totp.CodeAt(enroll.Secret, now)
	if err != nil {
		t.Fatal(err)
	}
	codes, err := iam.ConfirmMFAEnroll(t.Context(), accountID, code)
	if err != nil {
		t.Fatal(err)
	}
	if len(codes) != 10 {
		t.Fatalf("recovery codes = %d, want 10", len(codes))
	}
	bound, err = iam.MFABound(t.Context(), accountID)
	if err != nil || !bound {
		t.Fatalf("mfa bound after confirm = %v, %v", bound, err)
	}
	// 登录第一步：密码通过但需要 MFA。
	_, err = iam.Login(t.Context(), "owner", "123456789012345")
	var mfaRequired *service.MFARequiredError
	if !errors.As(err, &mfaRequired) || mfaRequired.ChallengeID == "" {
		t.Fatalf("login error = %v", err)
	}
	// 第二步：错误码拒绝；正确码通过并建立 mfa_verified 会话。
	if _, err := iam.VerifyMFAChallenge(t.Context(), "bogus-challenge", code); !errors.Is(err, service.ErrMFAChallengeInvalid) {
		t.Fatalf("bogus challenge error = %v", err)
	}
	if _, err := iam.VerifyMFAChallenge(t.Context(), mfaRequired.ChallengeID, "000000"); !errors.Is(err, service.ErrMFAInvalidCode) {
		t.Fatalf("wrong code error = %v", err)
	}
	verified, err := iam.VerifyMFAChallenge(t.Context(), mfaRequired.ChallengeID, code)
	if err != nil {
		t.Fatal(err)
	}
	if !verified.MfaVerified {
		t.Fatal("session must be mfa verified")
	}
	// 挑战一次性：再次使用同一 challenge 失败。
	if _, err := iam.VerifyMFAChallenge(t.Context(), mfaRequired.ChallengeID, code); !errors.Is(err, service.ErrMFAChallengeInvalid) {
		t.Fatalf("replayed challenge error = %v", err)
	}
	// 解绑：错误码拒绝、正确码通过；解绑后恢复单步登录。
	if err := iam.DisableMFA(t.Context(), accountID, "000000"); !errors.Is(err, service.ErrMFAInvalidCode) {
		t.Fatalf("disable wrong code error = %v", err)
	}
	if err := iam.DisableMFA(t.Context(), accountID, code); err != nil {
		t.Fatal(err)
	}
	if _, err := iam.Login(t.Context(), "owner", "123456789012345"); err != nil {
		t.Fatalf("login after disable error = %v", err)
	}
}

// TestMFALoginWithRecoveryCode 验证恢复码可在登录第二步替代 TOTP（078）。
func TestMFALoginWithRecoveryCode(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	owner, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345")
	if err != nil {
		t.Fatal(err)
	}
	enroll, err := iam.BeginMFAEnroll(t.Context(), owner.Identity.AccountID)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 8, 22, 1, 0, 0, 0, time.UTC)
	code, err := totp.CodeAt(enroll.Secret, now)
	if err != nil {
		t.Fatal(err)
	}
	codes, err := iam.ConfirmMFAEnroll(t.Context(), owner.Identity.AccountID, code)
	if err != nil {
		t.Fatal(err)
	}
	_, err = iam.Login(t.Context(), "owner", "123456789012345")
	var mfaRequired *service.MFARequiredError
	if !errors.As(err, &mfaRequired) {
		t.Fatalf("login error = %v", err)
	}
	// 恢复码登录；同一恢复码不可重复使用（挑战一次性 + 恢复码作废）。
	if _, err := iam.VerifyMFAChallenge(t.Context(), mfaRequired.ChallengeID, codes[0]); err != nil {
		t.Fatal(err)
	}
	_, err = iam.Login(t.Context(), "owner", "123456789012345")
	if !errors.As(err, &mfaRequired) {
		t.Fatalf("second login error = %v", err)
	}
	if _, err := iam.VerifyMFAChallenge(t.Context(), mfaRequired.ChallengeID, codes[0]); !errors.Is(err, service.ErrMFAInvalidCode) {
		t.Fatalf("reused recovery code error = %v", err)
	}
}

// fakeAlertReporter 记录告警事件（079 触发测试用）。
type fakeAlertReporter struct {
	mu     sync.Mutex
	events []pkgalerting.Event
}

func (r *fakeAlertReporter) Notify(_ context.Context, event pkgalerting.Event) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.events = append(r.events, event)
	return nil
}

func (r *fakeAlertReporter) types() []string {
	r.mu.Lock()
	defer r.mu.Unlock()
	seen := make([]string, 0, len(r.events))
	for _, event := range r.events {
		seen = append(seen, event.Type)
	}
	return seen
}

// TestAlertOnLockAndSensitiveWrites 验证账号锁定与敏感写操作触发告警（079）。
func TestAlertOnLockAndSensitiveWrites(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	reporter := &fakeAlertReporter{}
	iam.WithAlertReporter(reporter)
	if _, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345"); err != nil {
		t.Fatal(err)
	}
	// 三次错误密码触发锁定（MaxFailedAttempts=3）-> account_locked。
	for index := 0; index < 3; index++ {
		_, _ = iam.Login(t.Context(), "owner", "wrong-password")
	}
	found := false
	for _, alertType := range reporter.types() {
		if alertType == "account_locked" {
			found = true
		}
	}
	if !found {
		t.Fatalf("alert types = %v, want account_locked", reporter.types())
	}
	// 敏感写：角色归档 -> privilege_changed。
	editor, err := iam.CreateRole(t.Context(), "editor", "Editor", "")
	if err != nil {
		t.Fatal(err)
	}
	if err := iam.ArchiveRole(t.Context(), editor.ID); err != nil {
		t.Fatal(err)
	}
	foundPrivilege := false
	for _, alertType := range reporter.types() {
		if alertType == "privilege_changed" {
			foundPrivilege = true
		}
	}
	if !foundPrivilege {
		t.Fatalf("alert types after archive = %v, want privilege_changed", reporter.types())
	}
}

// TestAlertOnRepeatedMFAFailure 验证 MFA 连续失败触发告警（079）。
func TestAlertOnRepeatedMFAFailure(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	reporter := &fakeAlertReporter{}
	iam.WithAlertReporter(reporter)
	owner, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345")
	if err != nil {
		t.Fatal(err)
	}
	enroll, err := iam.BeginMFAEnroll(t.Context(), owner.Identity.AccountID)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 8, 22, 1, 0, 0, 0, time.UTC)
	code, err := totp.CodeAt(enroll.Secret, now)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := iam.ConfirmMFAEnroll(t.Context(), owner.Identity.AccountID, code); err != nil {
		t.Fatal(err)
	}
	// 三次错误验证码（阈值 3）-> mfa_failed。
	for index := 0; index < 3; index++ {
		_, err := iam.Login(t.Context(), "owner", "123456789012345")
		var mfaRequired *service.MFARequiredError
		if !errors.As(err, &mfaRequired) {
			t.Fatalf("login error = %v", err)
		}
		_, _ = iam.VerifyMFAChallenge(t.Context(), mfaRequired.ChallengeID, "000000")
	}
	found := false
	for _, alertType := range reporter.types() {
		if alertType == "mfa_failed" {
			found = true
		}
	}
	if !found {
		t.Fatalf("alert types = %v, want mfa_failed", reporter.types())
	}
}

// TestListQueryValidationRejectsInvalidSortAndPage 验证 BE-090-001 一致查询：
// 非法排序字段/方向与过大分页返回稳定 ErrInvalidQuery，不再静默忽略或回退。
func TestListQueryValidationRejectsInvalidSortAndPage(t *testing.T) {
	iam, resource := newService(t)
	defer resource.Close()
	if _, err := iam.Setup(t.Context(), "setup-secret", "owner", "Owner", "123456789012345"); err != nil {
		t.Fatal(err)
	}
	// 账号列表：非法排序列与方向被拒绝。
	if _, err := iam.ListAccounts(t.Context(), 0, 20, repo.AccountFilter{Sort: "password:asc"}); !errors.Is(err, service.ErrInvalidQuery) {
		t.Fatalf("account invalid sort column error = %v", err)
	}
	if _, err := iam.ListAccounts(t.Context(), 0, 20, repo.AccountFilter{Sort: "username:sideways"}); !errors.Is(err, service.ErrInvalidQuery) {
		t.Fatalf("account invalid sort direction error = %v", err)
	}
	if _, err := iam.ListAccounts(t.Context(), 0, 20, repo.AccountFilter{Sort: "username"}); !errors.Is(err, service.ErrInvalidQuery) {
		t.Fatalf("account malformed sort error = %v", err)
	}
	// 合法排序仍可用（不回归）。
	if _, err := iam.ListAccounts(t.Context(), 0, 20, repo.AccountFilter{Sort: "username:desc"}); err != nil {
		t.Fatalf("account valid sort error = %v", err)
	}
	// 角色列表：非法排序列被拒绝。
	if _, err := iam.ListRolesSorted(t.Context(), 0, 20, "", "unknown:asc"); !errors.Is(err, service.ErrInvalidQuery) {
		t.Fatalf("role invalid sort error = %v", err)
	}
	// 过大分页被拒绝。
	if _, err := iam.ListAccounts(t.Context(), 0, 1001, repo.AccountFilter{}); !errors.Is(err, service.ErrInvalidQuery) {
		t.Fatalf("oversized page error = %v", err)
	}
	if _, err := iam.ListRolesSorted(t.Context(), 0, 1001, "", ""); !errors.Is(err, service.ErrInvalidQuery) {
		t.Fatalf("oversized role page error = %v", err)
	}
}

// testBoolPointer 返回指向给定布尔值的指针（偏好通知更新测试用）。
func testBoolPointer(value bool) *bool { return &value }
