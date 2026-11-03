// Package service 实现 IAM 的账号、凭据、会话与 Core RBAC 用例。
package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/reina0721/clouddrive/internal/module/iam/adapter/totp"
	"github.com/reina0721/clouddrive/internal/module/iam/model"
	"github.com/reina0721/clouddrive/internal/module/iam/repo"
	permissioncatalog "github.com/reina0721/clouddrive/internal/permission"
	pkgalerting "github.com/reina0721/clouddrive/pkg/alerting"
	"github.com/reina0721/clouddrive/pkg/clock"
	"github.com/reina0721/clouddrive/pkg/idgen"
)

const SessionCookieName = "__Host-clouddrive_iam_session"

const (
	defaultListLimit = 20
	maxListLimit     = 100
)

var (
	ErrSetupClosed        = errors.New("iam setup is closed")
	ErrInvalidCredentials = errors.New("iam credentials are invalid")
	ErrAccountLocked      = errors.New("iam account is locked")
	ErrAccountDisabled    = errors.New("iam account is disabled")
	ErrSessionInvalid     = errors.New("iam session is invalid")
	ErrUnknownPermission  = errors.New("iam permission is not in catalog")
	ErrImmutableOwner     = errors.New("iam owner role is immutable")
	ErrIncompatibleState  = errors.New("iam persistent state is incompatible with permission catalog")
	// ErrInvalidQuery 表示列表查询参数非法（排序字段/方向、不支持的过滤或
	// 过大分页）；090 BE-090-001 统一语义：非法查询返回可识别错误，不静默忽略。
	ErrInvalidQuery = errors.New("iam list query is invalid")
	// ErrApiTokenScopeNotOwned 表示令牌请求的 scope 超出创建者当前有效权限（080）。
	ErrApiTokenScopeNotOwned = errors.New("iam api token scope is not owned by the creator")
	// ErrApiTokenLimit 表示账号未吊销令牌数已达到上限（080）。
	ErrApiTokenLimit = errors.New("iam api token limit reached")
	// ErrPasswordReused 表示新口令与最近 historySize 条历史口令相同（077）。
	ErrPasswordReused = errors.New("iam password was reused")
	// ErrMFARequired 是登录第一步密码通过、需要第二步 TOTP 的内部信号。
	ErrMFARequired = errors.New("iam mfa verification is required")
	// ErrMFAInvalidCode 表示 TOTP/恢复码校验失败。
	ErrMFAInvalidCode = errors.New("iam mfa code is invalid")
	// ErrMFANotBound 表示账号未绑定已确认的 TOTP。
	ErrMFANotBound = errors.New("iam mfa is not bound")
	// ErrMFAChallengeInvalid 表示 MFA 挑战缺失、过期或尝试超限。
	ErrMFAChallengeInvalid = errors.New("iam mfa challenge is invalid")
	// ErrVersionConflict 表示关系替换请求携带的 expected version 已过期，
	// 客户端必须重新读取最新快照后由用户确认，不允许静默覆盖或自动 merge。
	ErrVersionConflict = errors.New("iam relationship version is stale")
	// ErrIdempotencyConflict 表示同一幂等键被复用于不同请求。
	ErrIdempotencyConflict = errors.New("iam idempotency key reused with different request")
	// ErrIdempotencyInProgress 表示相同幂等键的原请求仍在执行。
	ErrIdempotencyInProgress = errors.New("iam idempotency request is still in progress")
)

type PasswordHasher interface {
	Hash(string) (string, error)
	Verify(string, string) (PasswordVerification, error)
}

// PasswordVerification 是 IAM Service 拥有的密码校验结果，不暴露具体哈希库类型。
type PasswordVerification struct {
	Match       bool
	NeedsRehash bool
}

// OperationOutcome 是操作审计的低基数结果分类（等同 auth 审计语义的值域，
// 由模块自有窄类型独立声明，避免跨模块 import）。
type OperationOutcome string

const (
	OperationSucceeded OperationOutcome = "succeeded"
	OperationFailed    OperationOutcome = "failed"
)

// OperationAuditRequest 是 IAM 写操作审计的低敏字段域：只携带稳定动作、
// 资源类型/ID 与结果分类；不携带对象内容、密码或权限集合原文。
// Actor 由 writer 实现从当前 Principal 推导。
type OperationAuditRequest struct {
	Operation    string
	Action       string
	ResourceType string
	ResourceID   string
	Outcome      OperationOutcome
}

// OperationAuditWriter 是 IAM 写操作审计的窄 port；由 composition 注入
// Auth OperationAuditWriter 的适配实现。
type OperationAuditWriter interface {
	RecordOperation(context.Context, OperationAuditRequest) error
}

// AuthorizationPublisher 是 IAM Service 在授权 mutation 中使用的 runtime
// 契约；由 module-local composition 注入 authorization.Runtime 实现。
// candidate 必须在事务 commit 前完整构造，commit 后只做原子发布。
type AuthorizationPublisher interface {
	// Mutate 串行化授权 mutation 的数据库事务、commit 与 publish 三段。
	Mutate(func() error) error
	// BuildCandidate 在未提交事务内构造完整候选 evaluator。
	BuildCandidate(context.Context, repo.PolicySnapshot) error
	// PublishCandidate 在 commit 成功后原子发布候选，不返回错误。
	PublishCandidate()
	// ProjectPermissions 用同 revision 的 evaluator 导出账号有效权限键，
	// 只用于 Session/WebUI 体验投影；服务端授权逐 operation 走 Decide。
	// subject 是账号 ID，restricted 表示首次登录只导出自助权限。
	ProjectPermissions(context.Context, string, uint64, bool) ([]permissioncatalog.Key, error)
}

type Config struct {
	SetupToken                   string
	IdleTimeout, AbsoluteTimeout time.Duration
	MaxFailedAttempts            int
	LockDuration                 time.Duration
	// ArchiveConfirmationTTL 是软注销两步确认的有效期（072）；零值使用默认值。
	ArchiveConfirmationTTL time.Duration
	// PasswordPolicy 是创建/重置/修改密码时的强度策略；由配置注入并在
	// New 构造时校验冻结（076），不与运行期配置联动。
	PasswordPolicy model.PasswordPolicy
	// MaxSessionsPerAccount 是单账号最大并发 active 会话数；0=不限。启用后
	// 新登录在达到上限时主动吊销最旧 active 会话（077）。
	MaxSessionsPerAccount int
	// ApiTokenMaxPerAccount 是单账号最大未吊销 API 令牌数；0=不限（080）。
	ApiTokenMaxPerAccount int
	// ApiTokenDefaultTTL 是创建令牌未指定过期时间时的默认有效期；0=永不过期（080）。
	ApiTokenDefaultTTL time.Duration
}
type Session struct {
	ID, CSRFToken                                           string
	Identity                                                model.SessionIdentity
	AuthorizationRevision                                   uint64
	CreatedAt, LastSeenAt, IdleExpiresAt, AbsoluteExpiresAt time.Time
	MfaVerified                                             bool
}
type AccountList struct {
	Items         []model.Account
	Offset, Limit int
	Total         int64
}
type RoleList struct {
	Items         []model.Role
	Offset, Limit int
	Total         int64
}

// AccountRolesView 是账号角色关系的可编辑快照（乐观并发读取侧）。
type AccountRolesView struct {
	AccountID             string
	AccountVersion        uint64
	AuthorizationRevision uint64
	RoleIDs               []string
}

// AccountDetailView 是账户详情页的一致性读取投影。它在一次存储访问中返回
// 账户生命周期、当前角色与安全影响计数，避免客户端用多个请求拼接出可能漂移
// 的“详情”。计数只表达管理影响范围，不暴露 Session 或 API Token 凭据。
type AccountDetailView struct {
	Account               model.Account
	Roles                 []model.Role
	AuthorizationRevision uint64
	ActiveSessionCount    int64
	TotalSessionCount     int64
	ActiveAPITokenCount   int64
}

// RolePermissionsView 是角色权限关系的可编辑快照（乐观并发读取侧）。
type RolePermissionsView struct {
	RoleID                string
	RoleVersion           uint64
	AuthorizationRevision uint64
	PermissionKeys        []permissioncatalog.Key
}

// RoleDetailView 是角色详情与变更影响的一致性读取投影。权限风险由各权限
// owner 在 Catalog 中声明；这里仅聚合，不按权限键猜测风险。
type RoleDetailView struct {
	Role                    model.Role
	Permissions             []permissioncatalog.Definition
	AuthorizationRevision   uint64
	AssignedAccountCount    int64
	OwnerModuleCount        int
	ElevatedPermissionCount int
	CriticalPermissionCount int
}

// AssignmentResult 是关系替换的写入结果（新版本、revision 与 diff 计数）。
type AssignmentResult struct {
	EntityVersion         uint64
	AuthorizationRevision uint64
	Added, Removed        int
}

type resolvedSession struct {
	ID      string
	Session Session
}
type resolvedSessionKey struct{}

func WithResolvedSession(request *http.Request, id string, session Session) *http.Request {
	return request.WithContext(context.WithValue(request.Context(), resolvedSessionKey{}, resolvedSession{ID: id, Session: session}))
}
func SessionFromContext(ctx context.Context) (string, Session, bool) {
	value, ok := ctx.Value(resolvedSessionKey{}).(resolvedSession)
	return value.ID, value.Session, ok && value.ID != ""
}

type Service struct {
	store          *repo.Store
	clock          clock.Clock
	ids            idgen.Generator
	passwords      PasswordHasher
	config         Config
	catalog        permissioncatalog.Catalog
	authorization  AuthorizationPublisher
	operationAudit OperationAuditWriter
	dummyHash      string
	// selfArchiveConfirmations 是软注销两步确认的进程内存储（072）：
	// confirmationId → {AccountID, ExpiresAt}；TTL 由 config.ArchiveConfirmationTTL 控制。
	selfArchiveConfirmations map[string]pendingArchive
	archiveConfirmationsMu   sync.Mutex
	// mfaChallenges 是登录两步的一次性 MFA 挑战（078）：challengeId → 账号，
	// 短 TTL 且单次使用，不落库（进程内）。
	mfaChallenges map[string]mfaChallenge
	mfaMu         sync.Mutex
	// alertReporter 是安全告警事件汇报通道（079）；nil 时告警 no-op。
	alertReporter pkgalerting.Notifier
	// mfaFailureWindows 是 MFA 连续失败告警的进程内窗口（按账号）。
	mfaFailureWindows map[string]mfaFailureWindow
	mfaWindowMu       sync.Mutex
}

// mfaFailureWindow 是 MFA 连续失败告警的进程内计数窗口。
type mfaFailureWindow struct {
	Count       int
	WindowStart time.Time
}

const (
	mfaFailureAlertThreshold = 3
	mfaFailureWindowDuration = 10 * time.Minute
)

// WithAlertReporter 注入安全告警事件汇报通道（079）。
func (s *Service) WithAlertReporter(reporter pkgalerting.Notifier) {
	if s == nil {
		return
	}
	s.alertReporter = reporter
}

// reportAlert 低敏汇报安全事件；未注入 reporter 时零行为，失败被忽略
// （告警写入失败不阻断业务与审计）。
func (s *Service) reportAlert(ctx context.Context, alertType string, severity pkgalerting.Severity, summary, resourceType, resourceID string) {
	if s == nil || s.alertReporter == nil {
		return
	}
	_ = s.alertReporter.Notify(ctx, pkgalerting.Event{Type: alertType, Severity: severity, Summary: summary, ResourceType: resourceType, ResourceIDHash: resourceID, OccurredAt: s.clock.Now().UTC()})
}

// reportMFAFailure 统计账号 MFA 连续失败并触发告警（每窗口一次）。
func (s *Service) reportMFAFailure(ctx context.Context, accountID string) {
	if s == nil || s.alertReporter == nil {
		return
	}
	now := s.clock.Now().UTC()
	s.mfaWindowMu.Lock()
	entry := s.mfaFailureWindows[accountID]
	if now.Sub(entry.WindowStart) > mfaFailureWindowDuration {
		entry = mfaFailureWindow{WindowStart: now}
	}
	entry.Count++
	if entry.Count < mfaFailureAlertThreshold {
		s.mfaFailureWindows[accountID] = entry
		s.mfaWindowMu.Unlock()
		return
	}
	delete(s.mfaFailureWindows, accountID)
	s.mfaWindowMu.Unlock()
	s.reportAlert(ctx, "mfa_failed", pkgalerting.SeverityWarning, "repeated MFA verification failures", "account", accountID)
}

// pendingArchive 是软注销两步确认的临时凭据。
type pendingArchive struct {
	AccountID string
	ExpiresAt time.Time
}

// WithOperationAudit 注入业务写操作审计 writer（由 composition 提供 Auth
// 适配实现）；未注入时写操作审计为 no-op，不阻断业务主路径。
func (s *Service) WithOperationAudit(writer OperationAuditWriter) {
	if s != nil && writer != nil {
		s.operationAudit = writer
	}
}

// auditOperation 在写操作完成边界记录低敏操作审计；writer 未注入或审计
// 失败都不阻断业务结果（低敏上报由 writer/Auth 侧负责）。成功且属于敏感
// 授权面操作时（079）附带告警汇报（resourceID 摘要）。
func (s *Service) auditOperation(ctx context.Context, operation, action, resourceType, resourceID string, err error) {
	if s == nil {
		return
	}
	if s.operationAudit != nil {
		outcome := OperationSucceeded
		if err != nil {
			outcome = OperationFailed
		}
		_ = s.operationAudit.RecordOperation(ctx, OperationAuditRequest{
			Operation: operation, Action: action, ResourceType: resourceType, ResourceID: resourceID, Outcome: outcome,
		})
	}
	if err == nil && sensitiveAlertOperation(operation) {
		s.reportAlert(ctx, "privilege_changed", pkgalerting.SeverityWarning, "privilege-bearing operation changed", resourceType, hex.EncodeToString(digest(resourceID)))
	}
}

// sensitiveAlertOperation 是触发权限变更告警的敏感写操作集合（079/080）。
func sensitiveAlertOperation(operation string) bool {
	switch operation {
	case "iam.accounts.archive", "iam.roles.archive", "iam.accounts.roles.replace", "iam.roles.permissions.replace",
		"iam.api-tokens.create", "iam.api-tokens.rotate", "iam.api-tokens.revoke", "iam.api-tokens.disable", "iam.api-tokens.enable":
		return true
	default:
		return false
	}
}

func New(store *repo.Store, currentClock clock.Clock, ids idgen.Generator, passwords PasswordHasher, config Config, catalog permissioncatalog.Catalog, authorization AuthorizationPublisher) (*Service, error) {
	if store == nil || currentClock == nil || ids == nil || passwords == nil || authorization == nil {
		return nil, fmt.Errorf("iam service dependencies are incomplete")
	}
	if config.IdleTimeout <= 0 || config.AbsoluteTimeout <= config.IdleTimeout || config.MaxFailedAttempts <= 0 || config.LockDuration <= 0 {
		return nil, fmt.Errorf("iam service security budgets are invalid")
	}
	if config.PasswordPolicy.MinLength < 1 || config.PasswordPolicy.MaxLength < config.PasswordPolicy.MinLength {
		return nil, fmt.Errorf("iam service password policy is invalid")
	}
	if config.PasswordPolicy.HistorySize < 0 || config.PasswordPolicy.MaxPasswordAge < 0 {
		return nil, fmt.Errorf("iam service password history or age is invalid")
	}
	if config.MaxSessionsPerAccount < 0 {
		return nil, fmt.Errorf("iam service max sessions per account is invalid")
	}
	if config.ApiTokenMaxPerAccount < 0 || config.ApiTokenDefaultTTL < 0 {
		return nil, fmt.Errorf("iam service api token limit or ttl is invalid")
	}
	dummy, err := passwords.Hash("fixed-cost-dummy-password")
	if err != nil {
		return nil, fmt.Errorf("create iam fixed-cost verifier: %w", err)
	}
	return &Service{store: store, clock: currentClock, ids: ids, passwords: passwords, config: config, catalog: catalog, authorization: authorization, dummyHash: dummy, selfArchiveConfirmations: map[string]pendingArchive{}, mfaChallenges: map[string]mfaChallenge{}, mfaFailureWindows: map[string]mfaFailureWindow{}}, nil
}

func (s *Service) Setup(ctx context.Context, setupToken, username, displayName, password string) (Session, error) {
	if strings.TrimSpace(s.config.SetupToken) == "" || subtle.ConstantTimeCompare([]byte(setupToken), []byte(s.config.SetupToken)) != 1 {
		return Session{}, ErrInvalidCredentials
	}
	if err := model.ValidatePasswordWith(password, s.config.PasswordPolicy); err != nil {
		return Session{}, err
	}
	hash, err := s.passwords.Hash(password)
	if err != nil {
		return Session{}, fmt.Errorf("hash setup credential: %w", err)
	}
	accountID, err := s.ids.New()
	if err != nil {
		return Session{}, err
	}
	roleID, err := s.ids.New()
	if err != nil {
		return Session{}, err
	}
	now := s.clock.Now().UTC()
	account, err := model.NewAccount(accountID, username, displayName, false, now)
	if err != nil {
		return Session{}, err
	}
	owner, err := model.NewRole(roleID, model.OwnerRoleCode, "系统所有者", "系统内置且不可移除的所有者角色", true, now)
	if err != nil {
		return Session{}, err
	}
	var result Session
	err = s.authorizeMutation(ctx, func(txCtx context.Context, r *repo.Unit) (bool, error) {
		count, err := r.CountAccounts(txCtx, repo.AccountFilter{})
		if err != nil {
			return false, err
		}
		if count != 0 {
			return false, ErrSetupClosed
		}
		ar := accountRecord(account)
		if err := r.CreateAccount(txCtx, &ar); err != nil {
			return false, mapSetupConflict(err)
		}
		credential := repo.CredentialRecord{AccountID: account.ID, PasswordHash: hash, UpdatedAt: now, PasswordChangedAt: now}
		if err := r.CreateCredential(txCtx, &credential); err != nil {
			return false, err
		}
		if err := s.recordPasswordHistory(txCtx, r, account.ID, hash, now); err != nil {
			return false, err
		}
		rr := roleRecord(owner)
		if err := r.CreateRole(txCtx, &rr); err != nil {
			return false, err
		}
		assignment := repo.AccountRoleRecord{AccountID: account.ID, RoleID: owner.ID, Active: true, UpdatedAt: now}
		if err := r.CreateAccountRole(txCtx, &assignment); err != nil {
			return false, err
		}
		for _, definition := range s.catalog.Definitions() {
			item := repo.RolePermissionRecord{RoleID: owner.ID, PermissionKey: string(definition.Key), Active: true, UpdatedAt: now}
			if err := r.CreateRolePermission(txCtx, &item); err != nil {
				return false, err
			}
		}
		return true, nil
	}, func(txCtx context.Context, r *repo.Unit) error {
		session, err := s.createSession(txCtx, r, account, false)
		if err != nil {
			return err
		}
		result = session
		return nil
	})
	if repo.IsDuplicate(err) {
		return Session{}, ErrSetupClosed
	}
	if err != nil {
		return Session{}, err
	}
	return s.projectSession(ctx, result)
}

func (s *Service) Login(ctx context.Context, username, password string) (Session, error) {
	username, err := model.NormalizeUsername(username)
	if err != nil {
		_, _ = s.passwords.Verify(s.dummyHash, password)
		return Session{}, ErrInvalidCredentials
	}
	var result Session
	var outcome error
	var resolvedAccountID string
	err = s.store.WithinTx(ctx, func(txCtx context.Context, r *repo.Unit) error {
		account, findErr := r.AccountByUsername(txCtx, username)
		if findErr != nil {
			_, _ = s.passwords.Verify(s.dummyHash, password)
			return ErrInvalidCredentials
		}
		credential, findErr := r.CredentialByAccount(txCtx, account.ID)
		if findErr != nil {
			_, _ = s.passwords.Verify(s.dummyHash, password)
			return ErrInvalidCredentials
		}
		now := s.clock.Now().UTC()
		if account.Archived {
			_, _ = s.passwords.Verify(credential.PasswordHash, password)
			return ErrAccountDisabled
		}
		if account.Status != string(model.AccountActive) {
			_, _ = s.passwords.Verify(credential.PasswordHash, password)
			return ErrAccountDisabled
		}
		if account.LockedUntil != nil && now.Before(*account.LockedUntil) {
			_, _ = s.passwords.Verify(credential.PasswordHash, password)
			return ErrAccountLocked
		}
		verification, verifyErr := s.passwords.Verify(credential.PasswordHash, password)
		if verifyErr != nil {
			return credentialVerificationError(verifyErr)
		}
		if !verification.Match {
			attempts := account.FailedAttempts + 1
			var locked *time.Time
			if attempts >= s.config.MaxFailedAttempts {
				value := now.Add(s.config.LockDuration)
				locked = &value
				attempts = 0
			}
			updateErr := r.UpdateAccount(txCtx, account.ID, account.Version, repo.AccountChanges{FailedAttempts: &attempts, LockedUntil: &locked, UpdatedAt: now})
			if updateErr != nil {
				return updateErr
			}
			if locked != nil {
				outcome = ErrAccountLocked
				return nil
			}
			outcome = ErrInvalidCredentials
			return nil
		}
		if verification.NeedsRehash {
			rehashed, hashErr := s.passwords.Hash(password)
			if hashErr != nil {
				return fmt.Errorf("rehash password credential: %w", hashErr)
			}
			if updateErr := r.UpdateCredential(txCtx, account.ID, rehashed, now); updateErr != nil {
				return updateErr
			}
		}
		resolvedAccountID = account.ID
		// MFA（078）：账号已绑定并确认 TOTP 时，本步只验证密码，第二步走
		// mfa-verify（一次性挑战）；未绑定账号直接建立会话。
		if secret, mfaErr := r.MFASecretByAccount(txCtx, account.ID); mfaErr == nil && secret.Confirmed {
			outcome = ErrMFARequired
			return nil
		}
		zero := 0
		var unlocked *time.Time
		err = r.UpdateAccount(txCtx, account.ID, account.Version, repo.AccountChanges{FailedAttempts: &zero, LockedUntil: &unlocked, UpdatedAt: now})
		if err != nil {
			return err
		}
		account.FailedAttempts = 0
		account.LockedUntil = nil
		account.Version++
		principal := modelAccount(account)
		if s.passwordExpired(now, credential.PasswordChangedAt) {
			principal.MustChangePassword = true
		}
		result, err = s.createSession(txCtx, r, principal, false)
		return err
	})
	if err == nil && outcome != nil {
		if errors.Is(outcome, ErrMFARequired) {
			challenge, challengeErr := s.BeginMFAChallenge(ctx, resolvedAccountID)
			if challengeErr != nil {
				return Session{}, challengeErr
			}
			return Session{}, &MFARequiredError{ChallengeID: challenge}
		}
		if errors.Is(outcome, ErrAccountLocked) {
			s.reportAlert(ctx, "account_locked", pkgalerting.SeverityCritical, "account locked after repeated failures", "account", hex.EncodeToString(digest(resolvedAccountID)))
		}
		return Session{}, outcome
	}
	if err != nil {
		return Session{}, err
	}
	return s.projectSession(ctx, result)
}

// Compatible 在监听器启动前校验已有 IAM 状态与当前精确权限目录相容；空库保留 setup 入口。
func (s *Service) Compatible(ctx context.Context) error {
	return s.store.Use(ctx, func(r *repo.Unit) error {
		count, err := r.CountAccounts(ctx, repo.AccountFilter{})
		if err != nil {
			return err
		}
		if count == 0 {
			return nil
		}
		owner, err := r.OwnerRole(ctx)
		if err != nil || !owner.Active || owner.Archived || !owner.System {
			return fmt.Errorf("%w: active system owner role is required", ErrIncompatibleState)
		}
		ownerCount, err := activeOwnerCount(ctx, r)
		if err != nil || ownerCount < 1 {
			return fmt.Errorf("%w: at least one active owner account is required", ErrIncompatibleState)
		}
		items, err := r.ListActiveRolePermissions(ctx)
		if err != nil {
			return err
		}
		ownerKeys := make(map[permissioncatalog.Key]struct{}, len(s.catalog.Definitions()))
		for _, item := range items {
			key := permissioncatalog.Key(item.PermissionKey)
			if _, known := s.catalog.Lookup(key); !known {
				return fmt.Errorf("%w: unknown active permission %q", ErrIncompatibleState, key)
			}
			if item.RoleID == owner.ID {
				ownerKeys[key] = struct{}{}
			}
		}
		for _, definition := range s.catalog.Definitions() {
			if _, exists := ownerKeys[definition.Key]; !exists {
				return fmt.Errorf("%w: owner is missing permission %q", ErrIncompatibleState, definition.Key)
			}
		}
		return nil
	})
}

// ReconcileOwnerCatalog 在模块目录扩展时把新增权限赋予 system owner，并使
// 现有 owner Session 失效；无新增权限时为 no-op，不 bump revision。
func (s *Service) ReconcileOwnerCatalog(ctx context.Context) error {
	return s.authorizeMutation(ctx, func(txCtx context.Context, r *repo.Unit) (bool, error) {
		count, err := r.CountAccounts(txCtx, repo.AccountFilter{})
		if err != nil || count == 0 {
			return false, err
		}
		owner, err := r.OwnerRole(txCtx)
		if err != nil || !owner.Active || owner.Archived || !owner.System {
			return false, fmt.Errorf("%w: active system owner role is required", ErrIncompatibleState)
		}
		items, err := r.ListActiveRolePermissions(txCtx)
		if err != nil {
			return false, err
		}
		ownerKeys := map[permissioncatalog.Key]struct{}{}
		for _, item := range items {
			key := permissioncatalog.Key(item.PermissionKey)
			if _, known := s.catalog.Lookup(key); !known {
				return false, fmt.Errorf("%w: unknown active permission %q", ErrIncompatibleState, key)
			}
			if item.RoleID == owner.ID {
				ownerKeys[key] = struct{}{}
			}
		}
		now := s.clock.Now().UTC()
		changed := false
		for _, definition := range s.catalog.Definitions() {
			if _, exists := ownerKeys[definition.Key]; exists {
				continue
			}
			item := repo.RolePermissionRecord{RoleID: owner.ID, PermissionKey: string(definition.Key), Active: true, UpdatedAt: now}
			if err := r.CreateRolePermission(txCtx, &item); err != nil {
				return false, err
			}
			changed = true
		}
		if !changed {
			return false, nil
		}
		if err := touchOwner(txCtx, r, owner, now); err != nil {
			return false, err
		}
		assignments, err := r.ListAccountRolesByRole(txCtx, owner.ID)
		if err != nil {
			return false, err
		}
		for _, assignment := range assignments {
			account, err := accountByID(txCtx, r, assignment.AccountID)
			if err != nil {
				return false, err
			}
			if err := bumpAndRevoke(txCtx, r, account, now); err != nil {
				return false, err
			}
		}
		return true, nil
	}, nil)
}

func (s *Service) Resolve(ctx context.Context, sessionID string) (Session, error) {
	if sessionID == "" {
		return Session{}, ErrSessionInvalid
	}
	var session repo.SessionRecord
	var account repo.AccountRecord
	var revision uint64
	var passwordExpired bool
	err := s.store.WithinTx(ctx, func(txCtx context.Context, r *repo.Unit) error {
		var err error
		session, err = r.SessionByHash(txCtx, digest(sessionID))
		if err != nil {
			return ErrSessionInvalid
		}
		now := s.clock.Now().UTC()
		if session.RevokedAt != nil || !now.Before(session.IdleExpiresAt) || !now.Before(session.AbsoluteExpiresAt) {
			return ErrSessionInvalid
		}
		account, err = r.AccountByID(txCtx, session.AccountID)
		if err != nil || account.Status != string(model.AccountActive) || account.Archived || account.SecurityRevision != session.SecurityRevision {
			return ErrSessionInvalid
		}
		credential, credentialErr := r.CredentialByAccount(txCtx, session.AccountID)
		if credentialErr != nil {
			return ErrSessionInvalid
		}
		passwordExpired = s.passwordExpired(now, credential.PasswordChangedAt)
		revision, err = r.CurrentAuthorizationRevision(txCtx)
		if err != nil {
			return err
		}
		if now.Sub(session.LastSeenAt) >= time.Minute {
			session.LastSeenAt = now
			session.IdleExpiresAt = now.Add(s.config.IdleTimeout)
			err = r.TouchSession(txCtx, digest(sessionID), nil, session.LastSeenAt, session.IdleExpiresAt)
		}
		return err
	})
	if err != nil {
		return Session{}, err
	}
	principal := modelAccount(account)
	if passwordExpired {
		principal.MustChangePassword = true
	}
	result := sessionOutput(sessionID, session, principal, nil)
	result.AuthorizationRevision = revision
	return s.projectSession(ctx, result)
}

func (s *Service) Logout(ctx context.Context, sessionID string) error {
	now := s.clock.Now().UTC()
	return s.store.Use(ctx, func(r *repo.Unit) error {
		err := r.RevokeSession(ctx, digest(sessionID), now)
		if repo.IsNotFound(err) {
			return nil
		}
		return err
	})
}

func (s *Service) RotateCSRF(ctx context.Context, sessionID string) (string, error) {
	token, err := randomToken()
	if err != nil {
		return "", err
	}
	now := s.clock.Now().UTC()
	err = s.store.Use(ctx, func(r *repo.Unit) error {
		session, err := r.SessionByHash(ctx, digest(sessionID))
		if err != nil || session.RevokedAt != nil || !now.Before(session.IdleExpiresAt) || !now.Before(session.AbsoluteExpiresAt) {
			return ErrSessionInvalid
		}
		return r.TouchSession(ctx, digest(sessionID), digest(token), time.Time{}, time.Time{})
	})
	return token, err
}
func (s *Service) ValidateCSRF(ctx context.Context, sessionID, token string) error {
	if sessionID == "" || token == "" {
		return ErrSessionInvalid
	}
	return s.store.Use(ctx, func(r *repo.Unit) error {
		session, err := r.SessionByHash(ctx, digest(sessionID))
		if err != nil {
			return ErrSessionInvalid
		}
		now := s.clock.Now().UTC()
		if session.RevokedAt != nil || !now.Before(session.IdleExpiresAt) || !now.Before(session.AbsoluteExpiresAt) || subtle.ConstantTimeCompare(session.CSRFHash, digest(token)) != 1 {
			return ErrSessionInvalid
		}
		return nil
	})
}

func (s *Service) ChangePassword(ctx context.Context, accountID, currentPassword, newPassword string) error {
	if err := model.ValidatePasswordWith(newPassword, s.config.PasswordPolicy); err != nil {
		return err
	}
	hash, err := s.passwords.Hash(newPassword)
	if err != nil {
		return err
	}
	return s.store.WithinTx(ctx, func(txCtx context.Context, r *repo.Unit) error {
		account, err := accountByID(txCtx, r, accountID)
		if err != nil {
			return err
		}
		credential, err := r.CredentialByAccount(txCtx, accountID)
		if err != nil {
			return ErrInvalidCredentials
		}
		verification, verifyErr := s.passwords.Verify(credential.PasswordHash, currentPassword)
		if verifyErr != nil {
			return credentialVerificationError(verifyErr)
		}
		if !verification.Match {
			return ErrInvalidCredentials
		}
		now := s.clock.Now().UTC()
		if err = s.ensurePasswordNotReused(txCtx, r, accountID, newPassword); err != nil {
			return err
		}
		if err = r.UpdateCredential(txCtx, accountID, hash, now); err != nil {
			return err
		}
		if err = s.recordPasswordHistory(txCtx, r, accountID, hash, now); err != nil {
			return err
		}
		return bumpAndRevokeWith(txCtx, r, account, now, nil, nil, false)
	})
}

func credentialVerificationError(err error) error {
	return errors.Join(ErrInvalidCredentials, fmt.Errorf("verify stored password credential: %w", err))
}

// ensurePasswordNotReused 校验新口令（明文）不在账号最近 historySize 条历史
// 口令中（077）；historySize<=0 时不启用。历史哈希损坏跳过该条，不阻断改密。
func (s *Service) ensurePasswordNotReused(ctx context.Context, r *repo.Unit, accountID string, password string) error {
	if s.config.PasswordPolicy.HistorySize <= 0 {
		return nil
	}
	history, err := r.PasswordHistoryHashes(ctx, accountID, s.config.PasswordPolicy.HistorySize)
	if err != nil {
		return fmt.Errorf("read iam password history: %w", err)
	}
	for _, previous := range history {
		verification, verifyErr := s.passwords.Verify(previous, password)
		if verifyErr == nil && verification.Match {
			return ErrPasswordReused
		}
	}
	return nil
}

// recordPasswordHistory 在口令成功写入后记录新哈希并裁剪到 historySize 条（077）。
func (s *Service) recordPasswordHistory(ctx context.Context, r *repo.Unit, accountID string, hash string, now time.Time) error {
	if s.config.PasswordPolicy.HistorySize <= 0 {
		return nil
	}
	if err := r.CreatePasswordHistory(ctx, &repo.PasswordHistoryRecord{AccountID: accountID, PasswordHash: hash, CreatedAt: now}); err != nil {
		return err
	}
	return r.TrimPasswordHistory(ctx, accountID, s.config.PasswordPolicy.HistorySize)
}
func (s *Service) ResetPassword(ctx context.Context, accountID, newPassword string, expected ...uint64) error {
	if err := model.ValidatePasswordWith(newPassword, s.config.PasswordPolicy); err != nil {
		return err
	}
	hash, err := s.passwords.Hash(newPassword)
	if err != nil {
		return err
	}
	err = s.store.WithinTx(ctx, func(txCtx context.Context, r *repo.Unit) error {
		account, err := accountByID(txCtx, r, accountID)
		if err != nil {
			return err
		}
		if len(expected) > 0 && account.Version != expected[0] {
			return ErrVersionConflict
		}
		if account.Archived {
			return ErrAccountDisabled
		}
		now := s.clock.Now().UTC()
		if err = s.ensurePasswordNotReused(txCtx, r, accountID, newPassword); err != nil {
			return err
		}
		if err = r.UpdateCredential(txCtx, accountID, hash, now); err != nil {
			return err
		}
		if err = s.recordPasswordHistory(txCtx, r, accountID, hash, now); err != nil {
			return err
		}
		account.MustChangePassword = true
		return bumpAndRevokeWith(txCtx, r, account, now, nil, nil, true)
	})
	s.auditOperation(ctx, "iam.accounts.password.reset", "reset", "account", accountID, err)
	return err
}

func (s *Service) CreateAccount(ctx context.Context, username, displayName, password string) (model.Account, error) {
	if err := model.ValidatePasswordWith(password, s.config.PasswordPolicy); err != nil {
		return model.Account{}, err
	}
	hash, err := s.passwords.Hash(password)
	if err != nil {
		return model.Account{}, err
	}
	id, err := s.ids.New()
	if err != nil {
		return model.Account{}, err
	}
	account, err := model.NewAccount(id, username, displayName, true, s.clock.Now())
	if err != nil {
		return model.Account{}, err
	}
	account.Version = 1
	record := accountRecord(account)
	err = s.store.WithinTx(ctx, func(txCtx context.Context, r *repo.Unit) error {
		if err := r.CreateAccount(txCtx, &record); err != nil {
			return err
		}
		now := s.clock.Now().UTC()
		if err := r.CreateCredential(txCtx, &repo.CredentialRecord{AccountID: account.ID, PasswordHash: hash, UpdatedAt: now, PasswordChangedAt: now}); err != nil {
			return err
		}
		return s.recordPasswordHistory(txCtx, r, account.ID, hash, now)
	})
	s.auditOperation(ctx, "iam.accounts.create", "create", "account", account.ID, err)
	return account, err
}
func (s *Service) ListAccounts(ctx context.Context, offset, limit int, filter repo.AccountFilter) (AccountList, error) {
	offset, limit, err := normalizePage(offset, limit)
	if err != nil {
		return AccountList{}, err
	}
	if err := validateAccountSort(filter.Sort); err != nil {
		return AccountList{}, err
	}
	var records []repo.AccountRecord
	var total int64
	err = s.store.Use(ctx, func(r *repo.Unit) error {
		var listErr error
		total, listErr = r.CountAccounts(ctx, filter)
		if listErr != nil {
			return listErr
		}
		records, listErr = r.ListAccounts(ctx, offset, limit, filter)
		return listErr
	})
	items := make([]model.Account, len(records))
	for i, v := range records {
		items[i] = modelAccount(v)
	}
	return AccountList{Items: items, Offset: offset, Limit: limit, Total: total}, err
}

// ListAccountsForRole 返回拥有指定活跃角色的账号（分页）；用于角色归档/权限
// 变更前的影响分析。角色不存在时向上返回 not found；只读查询不改变授权状态。
func (s *Service) ListAccountsForRole(ctx context.Context, roleID string, offset, limit int) (AccountList, error) {
	offset, limit, err := normalizePage(offset, limit)
	if err != nil {
		return AccountList{}, err
	}
	var records []repo.AccountRecord
	var total int64
	err = s.store.Use(ctx, func(r *repo.Unit) error {
		if _, roleErr := r.RoleByID(ctx, roleID); roleErr != nil {
			return roleErr
		}
		var countErr error
		total, countErr = r.CountAccountRolesByRole(ctx, roleID)
		if countErr != nil {
			return countErr
		}
		records, countErr = r.ListAccountsByRole(ctx, roleID, offset, limit)
		return countErr
	})
	items := make([]model.Account, len(records))
	for index, record := range records {
		items[index] = modelAccount(record)
	}
	return AccountList{Items: items, Offset: offset, Limit: limit, Total: total}, err
}

// ListRolesForPermission 返回拥有指定活跃权限键的角色（分页）；用于权限键退役
// /审计前的影响分析。未知权限键返回 ErrUnknownPermission；只读查询不改变授权状态。
func (s *Service) ListRolesForPermission(ctx context.Context, key permissioncatalog.Key, offset, limit int) (RoleList, error) {
	if _, ok := s.catalog.Lookup(key); !ok {
		return RoleList{}, fmt.Errorf("%w: %s", ErrUnknownPermission, key)
	}
	offset, limit, err := normalizePage(offset, limit)
	if err != nil {
		return RoleList{}, err
	}
	var records []repo.RoleRecord
	var total int64
	err = s.store.Use(ctx, func(r *repo.Unit) error {
		var countErr error
		total, countErr = r.CountRolePermissionsByKey(ctx, string(key))
		if countErr != nil {
			return countErr
		}
		records, countErr = r.ListRolesByPermissionKey(ctx, string(key), offset, limit)
		return countErr
	})
	items := make([]model.Role, len(records))
	for index, record := range records {
		items[index] = modelRole(record)
	}
	return RoleList{Items: items, Offset: offset, Limit: limit, Total: total}, err
}

func (s *Service) ResetPasswordByUsername(ctx context.Context, username, newPassword string) error {
	username, err := model.NormalizeUsername(username)
	if err != nil {
		return err
	}
	var accountID string
	if err := s.store.Use(ctx, func(r *repo.Unit) error {
		account, findErr := r.AccountByUsername(ctx, username)
		if findErr != nil {
			return findErr
		}
		accountID = account.ID
		return nil
	}); err != nil {
		return err
	}
	return s.ResetPassword(ctx, accountID, newPassword)
}
func (s *Service) SetAccountStatus(ctx context.Context, accountID string, status model.AccountStatus) error {
	return s.SetAccountStatusVersion(ctx, accountID, status, 0)
}

// SetAccountStatusVersion 让新版管理接口在事务内检查客户端版本。
func (s *Service) SetAccountStatusVersion(ctx context.Context, accountID string, status model.AccountStatus, expectedVersion uint64) error {
	if status != model.AccountActive && status != model.AccountDisabled {
		return model.ErrInvalidName
	}
	err := s.store.WithinTx(ctx, func(txCtx context.Context, r *repo.Unit) error {
		account, err := accountByID(txCtx, r, accountID)
		if err != nil {
			return err
		}
		if expectedVersion != 0 && account.Version != expectedVersion {
			return ErrVersionConflict
		}
		if account.Archived {
			return ErrAccountDisabled
		}
		if status == model.AccountDisabled {
			owner, err := ownerRole(txCtx, r)
			if err == nil {
				assigned, err := hasRole(txCtx, r, accountID, owner.ID)
				if err != nil {
					return err
				}
				if assigned {
					count, err := activeOwnerCount(txCtx, r)
					if err != nil {
						return err
					}
					if count <= 1 {
						return model.ErrOwnerInvariant
					}
					if err := touchOwner(txCtx, r, owner, s.clock.Now().UTC()); err != nil {
						return err
					}
				}
			}
		}
		now := s.clock.Now().UTC()
		statusValue := string(status)
		return bumpAndRevokeWith(txCtx, r, account, now, &statusValue, nil, account.MustChangePassword)
	})
	s.auditOperation(ctx, "iam.accounts.status", "update", "account", accountID, err)
	return err
}

// UpdateAccountInfo 更新账号显示名并沿用安全变更语义：成功变更后 bump 安全
// revision 并撤销该账号全部 Session（与改密/启停一致）。过期版本返回
// ErrVersionConflict。
func (s *Service) UpdateAccountInfo(ctx context.Context, accountID string, expectedVersion uint64, displayName string) error {
	displayName, err := model.NormalizeName(displayName)
	if err != nil {
		return err
	}
	err = s.store.WithinTx(ctx, func(txCtx context.Context, r *repo.Unit) error {
		account, err := accountByID(txCtx, r, accountID)
		if err != nil {
			return err
		}
		if account.Version != expectedVersion {
			return ErrVersionConflict
		}
		if account.Archived {
			return ErrAccountDisabled
		}
		now := s.clock.Now().UTC()
		revision := account.SecurityRevision + 1
		if err := r.UpdateAccount(txCtx, account.ID, account.Version, repo.AccountChanges{DisplayName: &displayName, SecurityRevision: &revision, UpdatedAt: now}); err != nil {
			return err
		}
		return r.RevokeAccountSessions(txCtx, account.ID, now)
	})
	s.auditOperation(ctx, "iam.accounts.update", "update", "account", accountID, err)
	return err
}

// BatchItemSuccess 是批量操作中成功处理的资源引用。
type BatchItemSuccess struct {
	ResourceID string `json:"resourceId"`
}

// BatchItemFailure 是批量操作中单个资源的稳定失败语义。Message 只输出受控
// 文案键，原始错误仍停留在服务端；Retryable 明确告知客户端是否适合逐项重试。
type BatchItemFailure struct {
	ResourceID string `json:"resourceId"`
	Code       string `json:"code"`
	Message    string `json:"message"`
	Retryable  bool   `json:"retryable"`
}

// BatchResult 是批量 mutation 的完整稳定结果，可按幂等键安全重放。
type BatchResult struct {
	RequestedCount int                `json:"requestedCount"`
	ProcessedCount int                `json:"processedCount"`
	Succeeded      []BatchItemSuccess `json:"succeeded"`
	Failed         []BatchItemFailure `json:"failed"`
	CorrelationID  string             `json:"correlationId,omitempty"`
}

const (
	batchCodeNotFound       = "not_found"
	batchCodeArchived       = "archived"
	batchCodeOwnerInvariant = "owner_invariant"
	batchCodeInvalid        = "invalid"
)

func batchItemErrorCode(err error) string {
	switch {
	case errors.Is(err, repo.ErrNotFound):
		return batchCodeNotFound
	case errors.Is(err, ErrAccountDisabled):
		return batchCodeArchived
	case errors.Is(err, model.ErrOwnerInvariant):
		return batchCodeOwnerInvariant
	default:
		return batchCodeInvalid
	}
}

func batchItemFailure(resourceID string, err error) BatchItemFailure {
	code := batchItemErrorCode(err)
	return BatchItemFailure{ResourceID: resourceID, Code: code, Message: code, Retryable: false}
}

// BatchSetAccountStatusIdempotent 批量启停账号：逐账号复用完整安全语义，
// 单项失败不中止，并按 Idempotency-Key 稳定重放同一完整结果。
func (s *Service) BatchSetAccountStatusIdempotent(ctx context.Context, key, correlationID string, accountIDs []string, status model.AccountStatus) (BatchResult, error) {
	return s.runBatchIdempotent(ctx, "iam.accounts.status.batch", key, struct {
		AccountIDs []string            `json:"accountIds"`
		Status     model.AccountStatus `json:"status"`
	}{AccountIDs: accountIDs, Status: status}, func() BatchResult {
		result := BatchResult{RequestedCount: len(accountIDs), Succeeded: []BatchItemSuccess{}, Failed: []BatchItemFailure{}, CorrelationID: correlationID}
		for _, id := range accountIDs {
			if err := s.SetAccountStatus(ctx, id, status); err != nil {
				result.ProcessedCount++
				result.Failed = append(result.Failed, batchItemFailure(id, err))
				continue
			}
			result.ProcessedCount++
			result.Succeeded = append(result.Succeeded, BatchItemSuccess{ResourceID: id})
		}
		return result
	})
}

// BatchArchiveAccountsIdempotent 批量归档账号，并按 Idempotency-Key 稳定重放结果。
func (s *Service) BatchArchiveAccountsIdempotent(ctx context.Context, key, correlationID string, accountIDs []string) (BatchResult, error) {
	return s.runBatchIdempotent(ctx, "iam.accounts.archive.batch", key, struct {
		AccountIDs []string `json:"accountIds"`
	}{AccountIDs: accountIDs}, func() BatchResult {
		result := BatchResult{RequestedCount: len(accountIDs), Succeeded: []BatchItemSuccess{}, Failed: []BatchItemFailure{}, CorrelationID: correlationID}
		for _, id := range accountIDs {
			if err := s.ArchiveAccount(ctx, id); err != nil {
				result.ProcessedCount++
				result.Failed = append(result.Failed, batchItemFailure(id, err))
				continue
			}
			result.ProcessedCount++
			result.Succeeded = append(result.Succeeded, BatchItemSuccess{ResourceID: id})
		}
		return result
	})
}

func (s *Service) runBatchIdempotent(ctx context.Context, operation, key string, payload any, execute func() BatchResult) (BatchResult, error) {
	key = strings.TrimSpace(key)
	if key == "" {
		return execute(), nil
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return BatchResult{}, fmt.Errorf("iam batch request hash: %w", err)
	}
	digest := sha256.Sum256(body)
	requestHash := hex.EncodeToString(digest[:])
	var existing repo.IdempotencyRecord
	claimed := false
	err = s.store.Use(ctx, func(r *repo.Unit) error {
		existing, err = r.IdempotencyByKey(ctx, operation, key)
		if err == nil {
			return nil
		}
		if !repo.IsNotFound(err) {
			return err
		}
		record := &repo.IdempotencyRecord{Operation: operation, IdempotencyKey: key, RequestHash: requestHash, ResultJSON: "{}", CreatedAt: s.clock.Now().UTC()}
		if err := r.CreateIdempotency(ctx, record); err != nil {
			if !repo.IsDuplicate(err) {
				return err
			}
			existing, err = r.IdempotencyByKey(ctx, operation, key)
			return err
		}
		existing = *record
		claimed = true
		return nil
	})
	if err != nil {
		return BatchResult{}, err
	}
	if existing.RequestHash != requestHash {
		return BatchResult{}, ErrIdempotencyConflict
	}
	if existing.Completed {
		var result BatchResult
		if existing.ResultJSON != "" {
			if err := json.Unmarshal([]byte(existing.ResultJSON), &result); err != nil {
				return BatchResult{}, fmt.Errorf("iam batch idempotency result: %w", err)
			}
		}
		return result, nil
	}
	if !claimed {
		return BatchResult{}, ErrIdempotencyInProgress
	}
	result := execute()
	resultJSON, err := json.Marshal(result)
	if err != nil {
		return BatchResult{}, fmt.Errorf("iam batch idempotency result: %w", err)
	}
	if err := s.store.Use(ctx, func(r *repo.Unit) error {
		return r.CompleteIdempotency(ctx, operation, key, string(resultJSON))
	}); err != nil {
		return BatchResult{}, err
	}
	return result, nil
}

// ArchiveAccount 把账号置为归档终态：归档账号不可登录、不可分配、全部 Session
// 撤销。owner 不变量保持（最后一个 active owner 不可归档）。不做物理删除与恢复。
func (s *Service) ArchiveAccount(ctx context.Context, accountID string, expected ...uint64) error {
	err := s.store.WithinTx(ctx, func(txCtx context.Context, r *repo.Unit) error {
		account, err := accountByID(txCtx, r, accountID)
		if err != nil {
			return err
		}
		if len(expected) > 0 && account.Version != expected[0] {
			return ErrVersionConflict
		}
		if account.Archived {
			return nil
		}
		owner, err := ownerRole(txCtx, r)
		if err == nil {
			assigned, err := hasRole(txCtx, r, accountID, owner.ID)
			if err != nil {
				return err
			}
			if assigned {
				count, err := activeOwnerCount(txCtx, r)
				if err != nil {
					return err
				}
				if count <= 1 {
					return model.ErrOwnerInvariant
				}
				if err := touchOwner(txCtx, r, owner, s.clock.Now().UTC()); err != nil {
					return err
				}
			}
		}
		now := s.clock.Now().UTC()
		archived := true
		return bumpAndRevokeWith(txCtx, r, account, now, nil, &archived, account.MustChangePassword)
	})
	s.auditOperation(ctx, "iam.accounts.archive", "archive", "account", accountID, err)
	return err
}

// defaultArchiveConfirmationTTL 是软注销两步确认的默认有效期。
const defaultArchiveConfirmationTTL = 2 * time.Minute

func (s *Service) archiveConfirmationTTL() time.Duration {
	if s.config.ArchiveConfirmationTTL > 0 {
		return s.config.ArchiveConfirmationTTL
	}
	return defaultArchiveConfirmationTTL
}

// UpdateSelfProfile 更新当前账号主页资料（昵称/介绍/出生日期，072）。
// 资料变更不 bump 安全修订号（不撤销会话）；乐观锁版本过期返回 ErrVersionConflict。
func (s *Service) UpdateSelfProfile(ctx context.Context, accountID string, expectedVersion uint64, nickname, bio, birthDate string) (model.Account, error) {
	nickname = strings.TrimSpace(nickname)
	bio = strings.TrimSpace(bio)
	birthDate = strings.TrimSpace(birthDate)
	if len([]rune(nickname)) > 64 || len([]rune(bio)) > 2048 || len([]rune(birthDate)) > 16 {
		return model.Account{}, model.ErrInvalidProfile
	}
	if birthDate != "" {
		if _, err := time.Parse("2006-01-02", birthDate); err != nil {
			return model.Account{}, model.ErrInvalidProfile
		}
	}
	var updated model.Account
	err := s.store.WithinTx(ctx, func(txCtx context.Context, r *repo.Unit) error {
		record, err := accountByID(txCtx, r, accountID)
		if err != nil {
			return err
		}
		if record.Archived {
			return model.ErrOwnerInvariant
		}
		if record.Version != expectedVersion {
			return ErrVersionConflict
		}
		now := s.clock.Now().UTC()
		if err := r.UpdateAccount(txCtx, record.ID, record.Version, repo.AccountChanges{Nickname: &nickname, Bio: &bio, BirthDate: &birthDate, UpdatedAt: now}); err != nil {
			return err
		}
		record.Nickname, record.Bio, record.BirthDate, record.Version, record.UpdatedAt = nickname, bio, birthDate, record.Version+1, now
		updated = modelAccount(record)
		return nil
	})
	s.auditOperation(ctx, "iam.self.profile", "update", "account", accountID, err)
	return updated, err
}

// SelfPreferences 返回当前账号的有效偏好：持久化覆盖与系统默认值合并，
// 缺失键回退默认（优先级：默认 < 用户覆盖；组织策略覆盖是后续扩展点，
// 契约在响应中保留 source 语义）。读取不产生副作用。
func (s *Service) SelfPreferences(ctx context.Context, accountID string) (model.UserPreferences, error) {
	if strings.TrimSpace(accountID) == "" {
		return model.UserPreferences{}, model.ErrInvalidID
	}
	defaults := model.DefaultUserPreferences()
	var record repo.UserPreferenceRecord
	err := s.store.Use(ctx, func(r *repo.Unit) error {
		if _, err := accountByID(ctx, r, accountID); err != nil {
			return err
		}
		// 账号存在但尚无偏好记录 → 返回默认（不视为错误）。
		found, findErr := r.UserPreferencesByAccount(ctx, accountID)
		if findErr != nil {
			if repo.IsNotFound(findErr) {
				return nil
			}
			return findErr
		}
		record = found
		return nil
	})
	if err != nil {
		return model.UserPreferences{}, err
	}
	if record.AccountID == "" {
		return defaults, nil
	}
	overrides, decodeErr := decodePreferenceOverrides(record.PreferencesJSON)
	if decodeErr != nil {
		return model.UserPreferences{}, fmt.Errorf("decode user preferences: %w", decodeErr)
	}
	effective := mergePreferenceDefaults(defaults, overrides)
	effective.Version = record.Version
	return effective, nil
}

// UpdateSelfPreferences 合并并持久化当前账号的偏好覆盖：只接受白名单键，
// 未知键或非法值返回 model.ErrInvalidPreferences；调用方（HTTP binding）
// 负责以完整或部分对象调用，service 把存储覆盖与默认值合并后返回有效值。
// notifications 为显式指针集合：nil 表示该字段未提交（保持现值），显式
// 布尔值表示用户开启/关闭。
func (s *Service) UpdateSelfPreferences(ctx context.Context, accountID string, updates model.UserPreferences, notifications *NotificationUpdate, expected ...uint64) (model.UserPreferences, error) {
	if strings.TrimSpace(accountID) == "" {
		return model.UserPreferences{}, model.ErrInvalidID
	}
	if err := updates.ValidatePartial(); err != nil {
		return model.UserPreferences{}, err
	}
	var effective model.UserPreferences
	err := s.store.WithinTx(ctx, func(txCtx context.Context, r *repo.Unit) error {
		if _, err := accountByID(txCtx, r, accountID); err != nil {
			return err
		}
		defaults := model.DefaultUserPreferences()
		var stored model.UserPreferences
		record, findErr := r.UserPreferencesByAccount(txCtx, accountID)
		switch {
		case findErr == nil:
			decoded, decodeErr := decodePreferenceOverrides(record.PreferencesJSON)
			if decodeErr != nil {
				return decodeErr
			}
			stored = mergePreferenceDefaults(defaults, decoded)
		case repo.IsNotFound(findErr):
			stored = defaults
		default:
			return findErr
		}
		if len(expected) > 0 && record.Version != expected[0] {
			return ErrVersionConflict
		}
		merged := mergePreferenceUpdates(stored, updates, notifications)
		if err := merged.Validate(); err != nil {
			return err
		}
		encoded, err := encodePreferenceOverrides(merged)
		if err != nil {
			return err
		}
		if err := r.UpsertUserPreferences(txCtx, accountID, encoded, s.clock.Now().UTC(), record.Version); err != nil {
			return err
		}
		merged.Version = record.Version + 1
		effective = merged
		return nil
	})
	s.auditOperation(ctx, "iam.self.preferences", "update", "account", accountID, err)
	return effective, err
}

// BeginSelfArchive 为软注销生成两步确认凭据（072）。此调用只创建进程内
// confirmationId（TTL 后失效），不产生任何业务副作用。
func (s *Service) BeginSelfArchive(ctx context.Context, accountID string) (string, error) {
	var archived bool
	if err := s.store.Use(ctx, func(r *repo.Unit) error {
		record, err := accountByID(ctx, r, accountID)
		if err != nil {
			return err
		}
		archived = record.Archived
		return nil
	}); err != nil {
		return "", err
	}
	if archived {
		return "", model.ErrOwnerInvariant
	}
	s.archiveConfirmationsMu.Lock()
	defer s.archiveConfirmationsMu.Unlock()
	now := s.clock.Now().UTC()
	for id, pending := range s.selfArchiveConfirmations {
		if pending.ExpiresAt.Before(now) {
			delete(s.selfArchiveConfirmations, id)
		}
	}
	for {
		confirmationID, err := randomToken()
		if err != nil {
			return "", err
		}
		if _, exists := s.selfArchiveConfirmations[confirmationID]; exists {
			continue
		}
		s.selfArchiveConfirmations[confirmationID] = pendingArchive{AccountID: accountID, ExpiresAt: now.Add(s.archiveConfirmationTTL())}
		return confirmationID, nil
	}
}

// ConfirmSelfArchive 校验两步凭据并把当前账号软注销：复用归档语义
// （登录阻塞、不可分配、全部会话吊销）；确认凭据单次使用并受 TTL 约束。
func (s *Service) ConfirmSelfArchive(ctx context.Context, accountID string, confirmationID string) error {
	if strings.TrimSpace(confirmationID) == "" {
		return model.ErrInvalidConfirmation
	}
	s.archiveConfirmationsMu.Lock()
	pending, exists := s.selfArchiveConfirmations[confirmationID]
	if exists {
		delete(s.selfArchiveConfirmations, confirmationID)
	}
	s.archiveConfirmationsMu.Unlock()
	if !exists || pending.AccountID != accountID || pending.ExpiresAt.Before(s.clock.Now().UTC()) {
		return model.ErrInvalidConfirmation
	}
	return s.ArchiveAccount(ctx, accountID)
}

func (s *Service) CreateRole(ctx context.Context, code, name, description string) (model.Role, error) {
	id, err := s.ids.New()
	if err != nil {
		return model.Role{}, err
	}
	role, err := model.NewRole(id, code, name, description, false, s.clock.Now())
	if err != nil {
		return model.Role{}, err
	}
	role.Version = 1
	record := roleRecord(role)
	err = s.store.Use(ctx, func(r *repo.Unit) error { return r.CreateRole(ctx, &record) })
	s.auditOperation(ctx, "iam.roles.create", "create", "role", role.ID, err)
	return role, err
}
func (s *Service) ListRoles(ctx context.Context, offset, limit int, query string) (RoleList, error) {
	return s.ListRolesSorted(ctx, offset, limit, query, "")
}

// ListRolesSorted 分页返回角色，并按受控排序字段排列。
func (s *Service) ListRolesSorted(ctx context.Context, offset, limit int, query, sortValue string) (RoleList, error) {
	offset, limit, err := normalizePage(offset, limit)
	if err != nil {
		return RoleList{}, err
	}
	if err := validateListSort(sortValue, roleSortColumns); err != nil {
		return RoleList{}, err
	}
	var records []repo.RoleRecord
	var total int64
	err = s.store.Use(ctx, func(r *repo.Unit) error {
		var listErr error
		if strings.TrimSpace(query) == "" {
			total, listErr = r.CountRoles(ctx)
		} else {
			total, listErr = r.CountRolesMatching(ctx, query)
		}
		if listErr != nil {
			return listErr
		}
		records, listErr = r.ListRoles(ctx, offset, limit, query, sortValue)
		return listErr
	})
	items := make([]model.Role, len(records))
	for i, v := range records {
		items[i] = modelRole(v)
	}
	return RoleList{Items: items, Offset: offset, Limit: limit, Total: total}, err
}
func (s *Service) Permissions() []permissioncatalog.Definition { return s.catalog.Definitions() }

// UpdateRoleInfo 更新自定义角色的名称与描述；owner 角色不可修改。名称/描述是
// 展示字段，变更不改变授权关系，因此不 bump authorization revision、不撤销
// Session；角色版本递增用于保持乐观并发语义。
func (s *Service) UpdateRoleInfo(ctx context.Context, roleID string, expectedVersion uint64, name, description string) (model.Role, error) {
	name, err := model.NormalizeName(name)
	if err != nil {
		return model.Role{}, err
	}
	description = strings.TrimSpace(description)
	var result model.Role
	err = s.store.WithinTx(ctx, func(txCtx context.Context, r *repo.Unit) error {
		role, err := r.RoleByID(txCtx, roleID)
		if err != nil {
			return err
		}
		if role.Code == model.OwnerRoleCode {
			return ErrImmutableOwner
		}
		if role.Version != expectedVersion {
			return ErrVersionConflict
		}
		if role.Archived {
			return repo.ErrNotFound
		}
		now := s.clock.Now().UTC()
		if err := r.UpdateRoleInfo(txCtx, role.ID, role.Version, repo.RoleChanges{Name: &name, Description: &description, UpdatedAt: now}); err != nil {
			return err
		}
		role.Name, role.Description, role.Version, role.UpdatedAt = name, description, role.Version+1, now
		result = modelRole(role)
		return nil
	})
	s.auditOperation(ctx, "iam.roles.update", "update", "role", roleID, err)
	return result, err
}

// ArchiveRole 把自定义角色置为归档终态：归档角色移出可分配集合、不产生授权
// 规则；已分配该角色的账号保留历史记录但不再获得其权限。该操作改变授权关系，
// 必须走 authorizeMutation 协议：事务内 bump authorization revision、撤销持
// 有者账号 Session 与安全 revision、commit 后原子发布新 evaluator。owner 角色
// 不可归档。
func (s *Service) ArchiveRole(ctx context.Context, roleID string) error {
	err := s.authorizeMutation(ctx, func(txCtx context.Context, r *repo.Unit) (bool, error) {
		role, err := r.RoleByID(txCtx, roleID)
		if err != nil {
			return false, err
		}
		if role.Code == model.OwnerRoleCode {
			return false, ErrImmutableOwner
		}
		if role.Archived {
			return false, nil
		}
		now := s.clock.Now().UTC()
		archived := true
		if err := r.UpdateRoleInfo(txCtx, role.ID, role.Version, repo.RoleChanges{Archived: &archived, Active: boolPointer(false), UpdatedAt: now}); err != nil {
			return false, err
		}
		if err := s.touchAssignedAccounts(txCtx, r, roleID, now); err != nil {
			return false, err
		}
		return true, nil
	}, nil)
	s.auditOperation(ctx, "iam.roles.archive", "archive", "role", roleID, err)
	return err
}

// boolPointer 返回指向给定值的布尔指针，用于把归档角色同时置为 inactive。
func boolPointer(value bool) *bool { return &value }

// AccountRolesSnapshot 返回账号角色关系的可编辑快照：账号版本、
// authorization revision 与当前 active RoleID 集合。
func (s *Service) AccountRolesSnapshot(ctx context.Context, accountID string) (AccountRolesView, error) {
	var result AccountRolesView
	err := s.store.Use(ctx, func(r *repo.Unit) error {
		account, err := r.AccountByID(ctx, accountID)
		if err != nil {
			return err
		}
		items, err := r.ListAccountRolesByAccount(ctx, accountID, true)
		if err != nil {
			return err
		}
		roleIDs := make([]string, len(items))
		for index, item := range items {
			roleIDs[index] = item.RoleID
		}
		sort.Strings(roleIDs)
		revision, err := r.CurrentAuthorizationRevision(ctx)
		if err != nil {
			return err
		}
		result = AccountRolesView{AccountID: accountID, AccountVersion: account.Version, AuthorizationRevision: revision, RoleIDs: roleIDs}
		return nil
	})
	return result, err
}

// AccountDetail 返回账户核心详情及禁用、归档或授权变更会影响的安全资源摘要。
func (s *Service) AccountDetail(ctx context.Context, accountID string) (AccountDetailView, error) {
	var result AccountDetailView
	now := s.clock.Now().UTC()
	err := s.store.Use(ctx, func(r *repo.Unit) error {
		account, err := r.AccountByID(ctx, accountID)
		if err != nil {
			return err
		}
		relations, err := r.ListAccountRolesByAccount(ctx, accountID, true)
		if err != nil {
			return err
		}
		roles := make([]model.Role, 0, len(relations))
		for _, relation := range relations {
			role, roleErr := r.RoleByID(ctx, relation.RoleID)
			if roleErr != nil {
				return roleErr
			}
			roles = append(roles, modelRole(role))
		}
		sort.Slice(roles, func(left, right int) bool { return roles[left].Code < roles[right].Code })
		activeSessions, err := r.CountSessionsByAccount(ctx, accountID, now, true, false)
		if err != nil {
			return err
		}
		totalSessions, err := r.CountSessionsByAccount(ctx, accountID, now, false, false)
		if err != nil {
			return err
		}
		activeTokens, err := r.CountApiTokensFiltered(ctx, accountID, repo.ApiTokenFilter{Status: string(ApiTokenStatusActive), Now: now})
		if err != nil {
			return err
		}
		revision, err := r.CurrentAuthorizationRevision(ctx)
		if err != nil {
			return err
		}
		result = AccountDetailView{
			Account:               modelAccount(account),
			Roles:                 roles,
			AuthorizationRevision: revision,
			ActiveSessionCount:    activeSessions,
			TotalSessionCount:     totalSessions,
			ActiveAPITokenCount:   activeTokens,
		}
		return nil
	})
	return result, err
}

// RolePermissionsSnapshot 返回角色权限关系的可编辑快照：角色版本、
// authorization revision 与当前 active PermissionKey 集合。
func (s *Service) RolePermissionsSnapshot(ctx context.Context, roleID string) (RolePermissionsView, error) {
	var result RolePermissionsView
	err := s.store.Use(ctx, func(r *repo.Unit) error {
		role, err := r.RoleByID(ctx, roleID)
		if err != nil {
			return err
		}
		items, err := r.ListRolePermissions(ctx, roleID, true)
		if err != nil {
			return err
		}
		keys := make([]permissioncatalog.Key, len(items))
		for index, item := range items {
			keys[index] = permissioncatalog.Key(item.PermissionKey)
		}
		sort.Slice(keys, func(left, right int) bool { return keys[left] < keys[right] })
		revision, err := r.CurrentAuthorizationRevision(ctx)
		if err != nil {
			return err
		}
		result = RolePermissionsView{RoleID: roleID, RoleVersion: role.Version, AuthorizationRevision: revision, PermissionKeys: keys}
		return nil
	})
	return result, err
}

// RoleDetail 返回角色生命周期、权限目录元数据与成员/风险影响摘要。
func (s *Service) RoleDetail(ctx context.Context, roleID string) (RoleDetailView, error) {
	var result RoleDetailView
	err := s.store.Use(ctx, func(r *repo.Unit) error {
		role, err := r.RoleByID(ctx, roleID)
		if err != nil {
			return err
		}
		relations, err := r.ListRolePermissions(ctx, roleID, true)
		if err != nil {
			return err
		}
		definitions := make([]permissioncatalog.Definition, 0, len(relations))
		owners := make(map[string]struct{})
		elevatedCount, criticalCount := 0, 0
		for _, relation := range relations {
			definition, exists := s.catalog.Lookup(permissioncatalog.Key(relation.PermissionKey))
			if !exists {
				return ErrUnknownPermission
			}
			definitions = append(definitions, definition)
			owners[string(definition.OwnerModuleID)] = struct{}{}
			switch definition.Risk {
			case permissioncatalog.RiskElevated:
				elevatedCount++
			case permissioncatalog.RiskCritical:
				criticalCount++
			}
		}
		sort.Slice(definitions, func(left, right int) bool { return definitions[left].Key < definitions[right].Key })
		assignedAccounts, err := r.CountAccountRolesByRole(ctx, roleID)
		if err != nil {
			return err
		}
		revision, err := r.CurrentAuthorizationRevision(ctx)
		if err != nil {
			return err
		}
		result = RoleDetailView{
			Role: modelRole(role), Permissions: definitions,
			AuthorizationRevision: revision, AssignedAccountCount: assignedAccounts,
			OwnerModuleCount: len(owners), ElevatedPermissionCount: elevatedCount,
			CriticalPermissionCount: criticalCount,
		}
		return nil
	})
	return result, err
}

// ReplaceAccountRoles 以 expected version + 完整期望集合替换账号角色关系；
// 版本冲突返回 ErrVersionConflict；no-op 提交不改变版本/revision、不撤销
// Session；有效变更原子更新关系、受影响账号安全状态/Session、authorization
// revision 并发布新 evaluator。
func (s *Service) ReplaceAccountRoles(ctx context.Context, accountID string, expectedVersion uint64, roleIDs []string) (AssignmentResult, error) {
	var result AssignmentResult
	err := s.authorizeMutation(ctx, func(txCtx context.Context, r *repo.Unit) (bool, error) {
		account, err := accountByID(txCtx, r, accountID)
		if err != nil {
			return false, err
		}
		if account.Archived {
			return false, ErrAccountDisabled
		}
		if account.Version != expectedVersion {
			return false, ErrVersionConflict
		}
		owner, ownerErr := ownerRole(txCtx, r)
		previousOwner := false
		if ownerErr == nil {
			previousOwner, _ = hasRole(txCtx, r, accountID, owner.ID)
		}
		next := set(roleIDs)
		if previousOwner {
			if _, ok := next[owner.ID]; !ok {
				count, err := activeOwnerCount(txCtx, r)
				if err != nil {
					return false, err
				}
				if count <= 1 {
					return false, model.ErrOwnerInvariant
				}
			}
		}
		for roleID := range next {
			role, err := r.RoleByID(txCtx, roleID)
			if err != nil || !role.Active || role.Archived {
				return false, repo.ErrNotFound
			}
		}
		existing, err := r.ListAccountRolesByAccount(txCtx, accountID, true)
		if err != nil {
			return false, err
		}
		current := map[string]struct{}{}
		for _, item := range existing {
			current[item.RoleID] = struct{}{}
		}
		added, removed := diffNames(current, next)
		if len(added) == 0 && len(removed) == 0 {
			revision, err := r.CurrentAuthorizationRevision(txCtx)
			if err != nil {
				return false, err
			}
			result = AssignmentResult{EntityVersion: account.Version, AuthorizationRevision: revision}
			return false, nil
		}
		now := s.clock.Now().UTC()
		all, err := r.ListAccountRolesByAccount(txCtx, accountID, false)
		if err != nil {
			return false, err
		}
		seen := map[string]struct{}{}
		for _, item := range all {
			_, active := next[item.RoleID]
			seen[item.RoleID] = struct{}{}
			if err := r.UpdateAccountRole(txCtx, accountID, item.RoleID, active, now); err != nil {
				return false, err
			}
		}
		for roleID := range next {
			if _, ok := seen[roleID]; ok {
				continue
			}
			item := repo.AccountRoleRecord{AccountID: accountID, RoleID: roleID, Active: true, UpdatedAt: now}
			if err := r.CreateAccountRole(txCtx, &item); err != nil {
				return false, err
			}
		}
		if ownerErr == nil && (previousOwner || contains(roleIDs, owner.ID)) {
			if err := touchOwner(txCtx, r, owner, now); err != nil {
				return false, err
			}
		}
		if err := bumpAndRevoke(txCtx, r, account, now); err != nil {
			return false, err
		}
		result = AssignmentResult{EntityVersion: account.Version + 1, Added: len(added), Removed: len(removed)}
		return true, nil
	}, func(txCtx context.Context, r *repo.Unit) error {
		revision, err := r.CurrentAuthorizationRevision(txCtx)
		if err != nil {
			return err
		}
		result.AuthorizationRevision = revision
		return nil
	})
	s.auditOperation(ctx, "iam.accounts.roles.replace", "replace", "account", accountID, err)
	return result, err
}

// ReplaceRolePermissions 以 expected version + 完整期望集合替换角色权限；
// 版本冲突返回 ErrVersionConflict；no-op 提交不改变版本/revision、不撤销
// 受影响账号 Session；有效变更原子更新关系、账号安全状态/Session、
// authorization revision 并发布新 evaluator。owner 角色不可编辑。
func (s *Service) ReplaceRolePermissions(ctx context.Context, roleID string, expectedVersion uint64, keys []permissioncatalog.Key) (AssignmentResult, error) {
	for _, key := range keys {
		if _, ok := s.catalog.Lookup(key); !ok {
			return AssignmentResult{}, fmt.Errorf("%w: %s", ErrUnknownPermission, key)
		}
	}
	var result AssignmentResult
	err := s.authorizeMutation(ctx, func(txCtx context.Context, r *repo.Unit) (bool, error) {
		role, err := r.RoleByID(txCtx, roleID)
		if err != nil {
			return false, err
		}
		if role.Code == model.OwnerRoleCode {
			return false, ErrImmutableOwner
		}
		if role.Version != expectedVersion {
			return false, ErrVersionConflict
		}
		next := map[string]struct{}{}
		for _, key := range keys {
			next[string(key)] = struct{}{}
		}
		existing, err := r.ListRolePermissions(txCtx, roleID, true)
		if err != nil {
			return false, err
		}
		current := map[string]struct{}{}
		for _, item := range existing {
			current[item.PermissionKey] = struct{}{}
		}
		added, removed := diffNames(current, next)
		if len(added) == 0 && len(removed) == 0 {
			revision, err := r.CurrentAuthorizationRevision(txCtx)
			if err != nil {
				return false, err
			}
			result = AssignmentResult{EntityVersion: role.Version, AuthorizationRevision: revision}
			return false, nil
		}
		now := s.clock.Now().UTC()
		all, err := r.ListRolePermissions(txCtx, roleID, false)
		if err != nil {
			return false, err
		}
		seen := map[string]struct{}{}
		for _, item := range all {
			_, active := next[item.PermissionKey]
			seen[item.PermissionKey] = struct{}{}
			if err := r.UpdateRolePermission(txCtx, roleID, item.PermissionKey, active, now); err != nil {
				return false, err
			}
		}
		for key := range next {
			if _, ok := seen[key]; ok {
				continue
			}
			item := repo.RolePermissionRecord{RoleID: roleID, PermissionKey: key, Active: true, UpdatedAt: now}
			if err := r.CreateRolePermission(txCtx, &item); err != nil {
				return false, err
			}
		}
		if err := s.touchAssignedAccounts(txCtx, r, roleID, now); err != nil {
			return false, err
		}
		if err := touchRole(txCtx, r, role, now); err != nil {
			return false, err
		}
		result = AssignmentResult{EntityVersion: role.Version + 1, Added: len(added), Removed: len(removed)}
		return true, nil
	}, func(txCtx context.Context, r *repo.Unit) error {
		revision, err := r.CurrentAuthorizationRevision(txCtx)
		if err != nil {
			return err
		}
		result.AuthorizationRevision = revision
		return nil
	})
	s.auditOperation(ctx, "iam.roles.permissions.replace", "replace", "role", roleID, err)
	return result, err
}

// touchAssignedAccounts 撤销所有持有该角色的账号 Session 并 bump 其安全 revision。
func (s *Service) touchAssignedAccounts(ctx context.Context, r *repo.Unit, roleID string, now time.Time) error {
	assignments, err := r.ListAccountRolesByRole(ctx, roleID)
	if err != nil {
		return err
	}
	for _, assignment := range assignments {
		account, err := accountByID(ctx, r, assignment.AccountID)
		if err != nil {
			return err
		}
		if err := bumpAndRevoke(ctx, r, account, now); err != nil {
			return err
		}
	}
	return nil
}

// authorizeMutation 是授权关系 mutation 的统一协议：在同一事务内完成业务
// mutation、authorization revision bump、完成品 finalize（可选）与完整候选
// evaluator 构造；事务 commit 成功后原子发布候选。mutate 返回 false 表示
// no-op（关系未变化），不 bump revision、不构造候选、不发布。
func (s *Service) authorizeMutation(ctx context.Context, mutate func(context.Context, *repo.Unit) (bool, error), finalize func(context.Context, *repo.Unit) error) error {
	return s.authorization.Mutate(func() error {
		now := s.clock.Now().UTC()
		err := s.store.WithinTx(ctx, func(txCtx context.Context, r *repo.Unit) error {
			changed, err := mutate(txCtx, r)
			if err != nil {
				return err
			}
			if !changed {
				return nil
			}
			if _, err := r.UpdateAuthorizationRevision(txCtx, now); err != nil {
				return err
			}
			if finalize != nil {
				if err := finalize(txCtx, r); err != nil {
					return err
				}
			}
			snapshot, err := r.AuthorizationSnapshot(txCtx, s.catalog)
			if err != nil {
				return err
			}
			return s.authorization.BuildCandidate(txCtx, snapshot)
		})
		if err != nil {
			return err
		}
		s.authorization.PublishCandidate()
		return nil
	})
}

// SessionInfo 是会话集中管理的元数据视图：只暴露 IDHash 摘要（hex）、
// 账号与过期信息，绝不泄露明文 SessionID 或 CSRF。
type SessionInfo struct {
	IDHash                                                  string
	AccountID                                               string
	CreatedAt, LastSeenAt, IdleExpiresAt, AbsoluteExpiresAt time.Time
	RevokedAt                                               *time.Time
}

// SessionList 是会话集中管理列表的分页结果。
type SessionList struct {
	Items         []SessionInfo
	Offset, Limit int
	Total         int64
}

// SessionListStatus 是会话列表的状态过滤类目。
type SessionListStatus string

const (
	// SessionListAll 返回该账号全部会话（默认，含已吊销）。
	SessionListAll SessionListStatus = "all"
	// SessionListActive 仅返回未吊销且按服务端时钟未过 idle/absolute 过期的会话。
	SessionListActive SessionListStatus = "active"
	// SessionListRevoked 仅返回已吊销会话。
	SessionListRevoked SessionListStatus = "revoked"
)

// ListSessions 分页返回账号的受信 Session 元数据视图（含已吊销标记）；
// status 决定过滤语义（active/revoked/all），total 与列表使用同一过滤条件。
func (s *Service) ListSessions(ctx context.Context, accountID string, offset, limit int, status SessionListStatus) (SessionList, error) {
	return s.ListSessionsSorted(ctx, accountID, offset, limit, status, "")
}

// ListSessionsSorted 分页返回会话，并按受控排序字段排列。
func (s *Service) ListSessionsSorted(ctx context.Context, accountID string, offset, limit int, status SessionListStatus, sortValue string) (SessionList, error) {
	if strings.TrimSpace(accountID) == "" {
		return SessionList{}, ErrSessionInvalid
	}
	offset, limit, err := normalizePage(offset, limit)
	if err != nil {
		return SessionList{}, err
	}
	if err := validateListSort(sortValue, sessionSortColumns); err != nil {
		return SessionList{}, err
	}
	activeOnly, revokedOnly, err := sessionStatusFilter(status)
	if err != nil {
		return SessionList{}, err
	}
	now := s.clock.Now().UTC()
	var records []repo.SessionRecord
	var total int64
	err = s.store.Use(ctx, func(r *repo.Unit) error {
		if _, err := r.AccountByID(ctx, accountID); err != nil {
			return err
		}
		total, err = r.CountSessionsByAccount(ctx, accountID, now, activeOnly, revokedOnly)
		if err != nil {
			return err
		}
		records, err = r.ListSessionsByAccount(ctx, accountID, now, activeOnly, revokedOnly, offset, limit, sortValue)
		return err
	})
	if err != nil {
		return SessionList{}, err
	}
	items := make([]SessionInfo, len(records))
	for index, record := range records {
		items[index] = SessionInfo{
			IDHash: hex.EncodeToString(record.IDHash), AccountID: record.AccountID,
			CreatedAt: record.CreatedAt, LastSeenAt: record.LastSeenAt,
			IdleExpiresAt: record.IdleExpiresAt, AbsoluteExpiresAt: record.AbsoluteExpiresAt,
			RevokedAt: record.RevokedAt,
		}
	}
	return SessionList{Items: items, Offset: offset, Limit: limit, Total: total}, nil
}

// sessionStatusFilter 把会话列表状态类目映射为 repo 过滤语义；未知类目拒绝。
func sessionStatusFilter(status SessionListStatus) (activeOnly, revokedOnly bool, err error) {
	switch status {
	case SessionListAll, "":
		return false, false, nil
	case SessionListActive:
		return true, false, nil
	case SessionListRevoked:
		return false, true, nil
	default:
		return false, false, fmt.Errorf("iam session list status %q is unknown", status)
	}
}

// RevokeSessions 按 idHash 摘要批量吊销指定账号的受信 Session；摘要无法
// 解析、不属于该账号或账号已禁用时 fail closed。当前登录会话由调用方按
// 决策语义决定是否包含在集合内，本方法不自动豁免任何会话。
func (s *Service) RevokeSessions(ctx context.Context, accountID string, idHashes []string) (int, error) {
	if strings.TrimSpace(accountID) == "" {
		return 0, ErrSessionInvalid
	}
	if len(idHashes) == 0 {
		return 0, nil
	}
	now := s.clock.Now().UTC()
	revoked := 0
	err := s.store.WithinTx(ctx, func(txCtx context.Context, r *repo.Unit) error {
		account, err := r.AccountByID(txCtx, accountID)
		if err != nil {
			return err
		}
		if account.Status != string(model.AccountActive) {
			return ErrAccountDisabled
		}
		for _, idHash := range idHashes {
			if strings.TrimSpace(idHash) == "" {
				return ErrSessionInvalid
			}
			raw, err := hex.DecodeString(idHash)
			if err != nil || len(raw) == 0 {
				return ErrSessionInvalid
			}
			record, err := r.SessionByHash(txCtx, raw)
			if err != nil {
				if repo.IsNotFound(err) {
					return ErrSessionInvalid
				}
				return err
			}
			if record.AccountID != accountID {
				return ErrSessionInvalid
			}
			if record.RevokedAt != nil {
				continue
			}
			if err := r.RevokeSession(txCtx, raw, now); err != nil {
				return err
			}
			revoked++
		}
		return nil
	})
	if err != nil {
		return 0, err
	}
	return revoked, nil
}

// createSession 在事务内创建会话记录；Permissions 投影由调用方在事务外
// 通过 projectSession 填充（evaluator 同 revision 导出）。
func (s *Service) createSession(ctx context.Context, r *repo.Unit, account model.Account, mfaVerified bool) (Session, error) {
	id, err := randomToken()
	if err != nil {
		return Session{}, err
	}
	csrf, err := randomToken()
	if err != nil {
		return Session{}, err
	}
	revision, err := r.CurrentAuthorizationRevision(ctx)
	if err != nil {
		return Session{}, err
	}
	now := s.clock.Now().UTC()
	// 077：会话数量上限——active 会话达到上限时主动吊销最旧会话（用户体验连续），
	// 踢除行为按低敏操作审计记录。
	if s.config.MaxSessionsPerAccount > 0 {
		active, countErr := r.CountSessionsByAccount(ctx, account.ID, now, true, false)
		if countErr != nil {
			return Session{}, countErr
		}
		if active >= int64(s.config.MaxSessionsPerAccount) {
			oldest, oldestErr := r.FindOldestActiveSession(ctx, account.ID, now)
			if oldestErr != nil {
				return Session{}, fmt.Errorf("find oldest active session for eviction: %w", oldestErr)
			}
			if evictErr := r.RevokeSession(ctx, oldest.IDHash, now); evictErr != nil {
				return Session{}, evictErr
			}
			s.auditOperation(ctx, "iam.session.evict", "evict", "session", hex.EncodeToString(oldest.IDHash), nil)
		}
	}
	record := repo.SessionRecord{IDHash: digest(id), AccountID: account.ID, CSRFHash: digest(csrf), SecurityRevision: account.SecurityRevision, CreatedAt: now, LastSeenAt: now, IdleExpiresAt: now.Add(s.config.IdleTimeout), AbsoluteExpiresAt: now.Add(s.config.AbsoluteTimeout), MfaVerified: mfaVerified}
	if err := r.CreateSession(ctx, &record); err != nil {
		return Session{}, err
	}
	result := sessionOutput(id, record, account, nil)
	result.AuthorizationRevision = revision
	result.CSRFToken = csrf
	return result, nil
}

// passwordExpired 判定口令是否超过 maxPasswordAge 期限（077）；策略关闭或无
// 变更时间时返回 false。
func (s *Service) passwordExpired(now time.Time, changedAt time.Time) bool {
	if s.config.PasswordPolicy.MaxPasswordAge <= 0 || changedAt.IsZero() {
		return false
	}
	return now.Sub(changedAt) > s.config.PasswordPolicy.MaxPasswordAge
}

// projectSession 在事务/写锁外填充 Session 的权限投影：用 evaluator 在
// 会话 revision 下导出有效权限键（受限会话只导出自助权限），不再手写展开
// 角色关系。投影失败时 fail closed，不返回空权限冒充当前状态。
func (s *Service) projectSession(ctx context.Context, session Session) (Session, error) {
	if session.ID == "" {
		return Session{}, ErrSessionInvalid
	}
	permissions, err := s.authorization.ProjectPermissions(ctx, session.Identity.AccountID, session.AuthorizationRevision, session.Identity.MustChangePassword)
	if err != nil {
		return Session{}, fmt.Errorf("project iam session permissions: %w", err)
	}
	session.Identity.Permissions = permissions
	return session, nil
}

func accountByID(ctx context.Context, r *repo.Unit, id string) (repo.AccountRecord, error) {
	return r.AccountByID(ctx, id)
}

// RequireAssignableAccount 验证账号存在且当前可承载组织目录关系。
// 该窄方法供 composition 适配为 Organization 的 AccountDirectory 端口，避免模块互相导入。
func (s *Service) RequireAssignableAccount(ctx context.Context, accountID string) error {
	return s.store.Use(ctx, func(r *repo.Unit) error {
		account, err := r.AccountByID(ctx, accountID)
		if err != nil {
			return err
		}
		if account.Status != string(model.AccountActive) || account.Archived {
			return ErrAccountDisabled
		}
		return nil
	})
}
func ownerRole(ctx context.Context, r *repo.Unit) (repo.RoleRecord, error) {
	return r.OwnerRole(ctx)
}
func hasRole(ctx context.Context, r *repo.Unit, accountID, roleID string) (bool, error) {
	return r.HasRole(ctx, accountID, roleID)
}
func activeOwnerCount(ctx context.Context, r *repo.Unit) (int64, error) {
	owner, err := ownerRole(ctx, r)
	if err != nil {
		return 0, err
	}
	assignments, err := r.ListAccountRolesByRole(ctx, owner.ID)
	if err != nil {
		return 0, err
	}
	var count int64
	for _, item := range assignments {
		account, err := accountByID(ctx, r, item.AccountID)
		if err == nil && account.Status == string(model.AccountActive) && !account.Archived {
			count++
		}
	}
	return count, nil
}
func touchOwner(ctx context.Context, r *repo.Unit, owner repo.RoleRecord, now time.Time) error {
	return r.TouchRole(ctx, owner.ID, owner.Version, now)
}
func touchRole(ctx context.Context, r *repo.Unit, role repo.RoleRecord, now time.Time) error {
	return r.TouchRole(ctx, role.ID, role.Version, now)
}
func bumpAndRevoke(ctx context.Context, r *repo.Unit, account repo.AccountRecord, now time.Time) error {
	return bumpAndRevokeWith(ctx, r, account, now, nil, nil, account.MustChangePassword)
}
func bumpAndRevokeWith(ctx context.Context, r *repo.Unit, account repo.AccountRecord, now time.Time, status *string, archived *bool, mustChange bool) error {
	revision := account.SecurityRevision + 1
	if err := r.UpdateAccount(ctx, account.ID, account.Version, repo.AccountChanges{Status: status, Archived: archived, MustChangePassword: &mustChange, SecurityRevision: &revision, UpdatedAt: now}); err != nil {
		return err
	}
	return r.RevokeAccountSessions(ctx, account.ID, now)
}
func normalizePage(offset, limit int) (int, int, error) {
	if offset < 0 || limit < 0 || limit > maxListLimit {
		return 0, 0, fmt.Errorf("%w: offset=%d limit=%d", ErrInvalidQuery, offset, limit)
	}
	if limit == 0 {
		limit = defaultListLimit
	}
	return offset, limit, nil
}
func randomToken() (string, error) {
	value := make([]byte, 32)
	if _, err := rand.Read(value); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(value), nil
}
func digest(value string) []byte { sum := sha256.Sum256([]byte(value)); return sum[:] }
func sessionOutput(id string, record repo.SessionRecord, account model.Account, permissions []permissioncatalog.Key) Session {
	return Session{ID: id, Identity: model.SessionIdentity{AccountID: account.ID, Username: account.Username, DisplayName: account.DisplayName, Nickname: account.Nickname, Bio: account.Bio, BirthDate: account.BirthDate, Permissions: append([]permissioncatalog.Key(nil), permissions...), MustChangePassword: account.MustChangePassword, SecurityRevision: account.SecurityRevision, AuthenticatedAt: record.CreatedAt}, CreatedAt: record.CreatedAt, LastSeenAt: record.LastSeenAt, IdleExpiresAt: record.IdleExpiresAt, AbsoluteExpiresAt: record.AbsoluteExpiresAt, MfaVerified: record.MfaVerified}
}
func accountRecord(v model.Account) repo.AccountRecord {
	return repo.AccountRecord{ID: v.ID, Username: v.Username, DisplayName: v.DisplayName, Nickname: v.Nickname, Bio: v.Bio, BirthDate: v.BirthDate, Status: string(v.Status), Archived: v.Archived, MustChangePassword: v.MustChangePassword, SecurityRevision: v.SecurityRevision, FailedAttempts: v.FailedAttempts, LockedUntil: v.LockedUntil, Version: v.Version, CreatedAt: v.CreatedAt, UpdatedAt: v.UpdatedAt}
}
func modelAccount(v repo.AccountRecord) model.Account {
	return model.Account{ID: v.ID, Username: v.Username, DisplayName: v.DisplayName, Nickname: v.Nickname, Bio: v.Bio, BirthDate: v.BirthDate, Status: model.AccountStatus(v.Status), Archived: v.Archived, MustChangePassword: v.MustChangePassword, SecurityRevision: v.SecurityRevision, FailedAttempts: v.FailedAttempts, LockedUntil: v.LockedUntil, Version: v.Version, CreatedAt: v.CreatedAt, UpdatedAt: v.UpdatedAt}
}
func roleRecord(v model.Role) repo.RoleRecord {
	return repo.RoleRecord{ID: v.ID, Code: v.Code, Name: v.Name, Description: v.Description, Active: v.Active, Archived: v.Archived, System: v.System, Version: v.Version, CreatedAt: v.CreatedAt, UpdatedAt: v.UpdatedAt}
}
func modelRole(v repo.RoleRecord) model.Role {
	return model.Role{ID: v.ID, Code: v.Code, Name: v.Name, Description: v.Description, Active: v.Active, Archived: v.Archived, System: v.System, Version: v.Version, CreatedAt: v.CreatedAt, UpdatedAt: v.UpdatedAt}
}
func set(values []string) map[string]struct{} {
	result := make(map[string]struct{}, len(values))
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			result[v] = struct{}{}
		}
	}
	return result
}
func contains(values []string, value string) bool {
	for _, item := range values {
		if item == value {
			return true
		}
	}
	return false
}

// diffNames 计算相对于目标集合 next 的 added（新增）与 removed（移除）子集。
func diffNames(current, next map[string]struct{}) (added, removed []string) {
	for id := range next {
		if _, ok := current[id]; !ok {
			added = append(added, id)
		}
	}
	for id := range current {
		if _, ok := next[id]; !ok {
			removed = append(removed, id)
		}
	}
	return added, removed
}
func mapSetupConflict(err error) error {
	if repo.IsDuplicate(err) {
		return ErrSetupClosed
	}
	return err
}

// ---- API-Token（078，R078-001） ----

// ApiTokenView 是 API 令牌的管理视图（永不包含明文 secret）。
// Status 为派生状态（active|disabled|expired|revoked，080）。
type ApiTokenView struct {
	Version     uint64
	ID          string
	Name        string
	Description string
	Scopes      []permissioncatalog.Key
	ExpiresAt   *time.Time
	DisabledAt  *time.Time
	RevokedAt   *time.Time
	CreatedAt   time.Time
	LastUsed    *time.Time
	Status      string
}

// ApiTokenStatus 是令牌列表状态过滤类目（080）。
type ApiTokenStatus string

const (
	ApiTokenStatusActive   ApiTokenStatus = "active"
	ApiTokenStatusDisabled ApiTokenStatus = "disabled"
	ApiTokenStatusExpired  ApiTokenStatus = "expired"
	ApiTokenStatusRevoked  ApiTokenStatus = "revoked"
	ApiTokenStatusAll      ApiTokenStatus = "all"
)

// ApiTokenIssued 是创建/轮换响应：Secret 明文只在本次返回一次。
type ApiTokenIssued struct {
	ApiTokenView
	Secret string
}

// ApiTokenList 是 API 令牌分页列表。
type ApiTokenList struct {
	Items         []ApiTokenView
	Offset, Limit int
	Total         int64
}

// ApiTokenResolution 是认证解析结果（供 Auth api-token verifier 适配）。
type ApiTokenResolution struct {
	AccountID string
	Scopes    []permissioncatalog.Key
}

const apiTokenPrefix = "iam_"

// mfaIssuer 是 otpauth URI 的展示名（验证器 app 内显示）。
const mfaIssuer = "clouddrive"

// MFARequiredError 表示登录需要第二步 TOTP 验证；ChallengeID 单次有效、短 TTL。
type MFARequiredError struct {
	ChallengeID string
}

func (e *MFARequiredError) Error() string { return "iam mfa verification is required" }

// CreateApiToken 为当前账号发放机器访问令牌（080）：
//   - scope 必须为 Catalog 已知精确键（未知 404）；
//   - scope 必须 ⊆ 创建者当前有效权限（越权 403，防提权）；
//   - 受限（MustChangePassword）账号禁止创建（403）；
//   - 未吊销令牌数达到上限时拒绝（409）；
//   - 未指定过期时间时按 ApiTokenDefaultTTL（0=永不过期）。
//
// 明文 secret 只在本响应返回，之后只读哈希摘要。
func (s *Service) CreateApiToken(ctx context.Context, accountID, name, description string, scopes []permissioncatalog.Key, expiresAt *time.Time) (ApiTokenIssued, error) {
	normalized, err := s.validateApiTokenScopes(scopes)
	if err != nil {
		return ApiTokenIssued{}, err
	}
	if strings.TrimSpace(name) == "" || len([]rune(name)) > 128 {
		return ApiTokenIssued{}, model.ErrInvalidName
	}
	if len([]rune(description)) > 1024 {
		return ApiTokenIssued{}, model.ErrInvalidName
	}
	account, err := s.accountByID(ctx, accountID)
	if err != nil {
		return ApiTokenIssued{}, err
	}
	if account.MustChangePassword || account.Status != string(model.AccountActive) || account.Archived {
		return ApiTokenIssued{}, ErrAccountDisabled
	}
	owned, err := s.creatorOwnedPermissions(ctx, accountID)
	if err != nil {
		return ApiTokenIssued{}, err
	}
	for _, scope := range normalized {
		if _, ok := owned[scope]; !ok {
			return ApiTokenIssued{}, fmt.Errorf("%w: %s", ErrApiTokenScopeNotOwned, scope)
		}
	}
	now := s.clock.Now().UTC()
	effectiveExpiry := expiresAt
	if effectiveExpiry == nil && s.config.ApiTokenDefaultTTL > 0 {
		value := now.Add(s.config.ApiTokenDefaultTTL)
		effectiveExpiry = &value
	}
	if effectiveExpiry != nil && !effectiveExpiry.After(now) {
		return ApiTokenIssued{}, model.ErrInvalidTime
	}
	if s.config.ApiTokenMaxPerAccount > 0 {
		var count int64
		countErr := s.store.Use(ctx, func(r *repo.Unit) error {
			var err error
			count, err = r.CountApiTokens(ctx, accountID)
			return err
		})
		if countErr != nil {
			return ApiTokenIssued{}, countErr
		}
		if count >= int64(s.config.ApiTokenMaxPerAccount) {
			return ApiTokenIssued{}, ErrApiTokenLimit
		}
	}
	secret, err := newApiTokenSecret()
	if err != nil {
		return ApiTokenIssued{}, err
	}
	id, err := s.ids.New()
	if err != nil {
		return ApiTokenIssued{}, err
	}
	encoded, err := encodeApiTokenScopes(normalized)
	if err != nil {
		return ApiTokenIssued{}, err
	}
	record := repo.ApiTokenRecord{Version: 1, ID: id, AccountID: accountID, Name: strings.TrimSpace(name), Description: strings.TrimSpace(description), TokenHash: apiTokenHash(secret), Scopes: encoded, ExpiresAt: effectiveExpiry, CreatedAt: now}
	err = s.store.Use(ctx, func(r *repo.Unit) error { return r.CreateApiToken(ctx, &record) })
	s.auditOperation(ctx, "iam.api-tokens.create", "create", "api-token", record.ID, err)
	if err != nil {
		return ApiTokenIssued{}, err
	}
	return ApiTokenIssued{ApiTokenView: apiTokenView(record, now), Secret: secret}, nil
}

// ListApiTokens 分页返回账号令牌管理视图（无明文）；status 过滤（080）。
func (s *Service) ListApiTokens(ctx context.Context, accountID string, offset, limit int, status ApiTokenStatus) (ApiTokenList, error) {
	return s.ListApiTokensSorted(ctx, accountID, offset, limit, status, "")
}

// ListApiTokensSorted 分页返回令牌，并按受控排序字段排列。
func (s *Service) ListApiTokensSorted(ctx context.Context, accountID string, offset, limit int, status ApiTokenStatus, sortValue string) (ApiTokenList, error) {
	offset, limit, err := normalizePage(offset, limit)
	if err != nil {
		return ApiTokenList{}, err
	}
	if err := validateListSort(sortValue, apiTokenSortColumns); err != nil {
		return ApiTokenList{}, err
	}
	statusValue, err := normalizeApiTokenStatus(status)
	if err != nil {
		return ApiTokenList{}, err
	}
	now := s.clock.Now().UTC()
	filter := repo.ApiTokenFilter{Status: statusValue, Now: now}
	var records []repo.ApiTokenRecord
	var total int64
	err = s.store.Use(ctx, func(r *repo.Unit) error {
		var listErr error
		total, listErr = r.CountApiTokensFiltered(ctx, accountID, filter)
		if listErr != nil {
			return listErr
		}
		records, listErr = r.ListApiTokensFiltered(ctx, accountID, offset, limit, filter, sortValue)
		return listErr
	})
	if err != nil {
		return ApiTokenList{}, err
	}
	items := make([]ApiTokenView, len(records))
	for index, record := range records {
		items[index] = apiTokenView(record, now)
	}
	return ApiTokenList{Items: items, Offset: offset, Limit: limit, Total: total}, nil
}

// UpdateApiToken 更新令牌元数据（名称/描述/过期时间，080）。
// expiresAt 非 nil 时设置新过期时间；neverExpires 为 true 时清空（永不过期）；
// 两者均为空表示保持不变。
func (s *Service) UpdateApiToken(ctx context.Context, accountID, id, name, description string, expiresAt *time.Time, neverExpires bool, expected ...uint64) error {
	if strings.TrimSpace(name) == "" || len([]rune(name)) > 128 {
		return model.ErrInvalidName
	}
	if len([]rune(description)) > 1024 {
		return model.ErrInvalidName
	}
	now := s.clock.Now().UTC()
	changes := map[string]any{"name": strings.TrimSpace(name), "description": strings.TrimSpace(description)}
	switch {
	case neverExpires:
		changes["expires_at"] = nil
	case expiresAt != nil:
		if !expiresAt.After(now) {
			return model.ErrInvalidTime
		}
		changes["expires_at"] = expiresAt
	}
	err := s.store.Use(ctx, func(r *repo.Unit) error {
		return r.UpdateApiTokenFields(ctx, accountID, id, changes, expected...)
	})
	s.auditOperation(ctx, "iam.api-tokens.update", "update", "api-token", id, err)
	return err
}

// DisableApiToken 把令牌置为禁用（可逆）；禁用后认证立即失败。
func (s *Service) DisableApiToken(ctx context.Context, accountID, id string, expected ...uint64) error {
	now := s.clock.Now().UTC()
	disabled := now
	err := s.store.Use(ctx, func(r *repo.Unit) error { return r.SetApiTokenDisabled(ctx, accountID, id, &disabled, expected...) })
	s.auditOperation(ctx, "iam.api-tokens.disable", "disable", "api-token", id, err)
	return err
}

// EnableApiToken 解除禁用（可逆）。
func (s *Service) EnableApiToken(ctx context.Context, accountID, id string, expected ...uint64) error {
	err := s.store.Use(ctx, func(r *repo.Unit) error { return r.SetApiTokenDisabled(ctx, accountID, id, nil, expected...) })
	s.auditOperation(ctx, "iam.api-tokens.enable", "enable", "api-token", id, err)
	return err
}

// RotateApiToken 轮换令牌：旧哈希立即失效并返回新明文 secret。
func (s *Service) RotateApiToken(ctx context.Context, accountID, id string, expected ...uint64) (ApiTokenIssued, error) {
	now := s.clock.Now().UTC()
	if err := s.store.Use(ctx, func(r *repo.Unit) error {
		_, findErr := r.ApiTokenByID(ctx, accountID, id)
		return findErr
	}); err != nil {
		return ApiTokenIssued{}, err
	}
	secret, err := newApiTokenSecret()
	if err != nil {
		return ApiTokenIssued{}, err
	}
	err = s.store.Use(ctx, func(r *repo.Unit) error {
		return r.RotateApiTokenHash(ctx, accountID, id, apiTokenHash(secret), now, expected...)
	})
	s.auditOperation(ctx, "iam.api-tokens.rotate", "rotate", "api-token", id, err)
	if err != nil {
		return ApiTokenIssued{}, err
	}
	var record repo.ApiTokenRecord
	_ = s.store.Use(ctx, func(r *repo.Unit) error {
		record, err = r.ApiTokenByID(ctx, accountID, id)
		return err
	})
	return ApiTokenIssued{ApiTokenView: apiTokenView(record, now), Secret: secret}, nil
}

// RevokeApiToken 把令牌置为终态吊销；后续认证立即失败。
func (s *Service) RevokeApiToken(ctx context.Context, accountID, id string, expected ...uint64) error {
	now := s.clock.Now().UTC()
	err := s.store.Use(ctx, func(r *repo.Unit) error { return r.RevokeApiToken(ctx, accountID, id, now, expected...) })
	s.auditOperation(ctx, "iam.api-tokens.revoke", "revoke", "api-token", id, err)
	return err
}

// BatchRevokeApiTokensIdempotent 批量吊销当前账号的令牌：逐令牌复用既有
// 吊销语义，单项失败不中止（已吊销视为成功幂等），并按 Idempotency-Key
// 稳定重放完整结果（090 PAGE-090-002 会话/Token 批处理）。
func (s *Service) BatchRevokeApiTokensIdempotent(ctx context.Context, key, correlationID, accountID string, tokenIDs []string) (BatchResult, error) {
	if strings.TrimSpace(accountID) == "" {
		return BatchResult{}, model.ErrInvalidID
	}
	return s.runBatchIdempotent(ctx, "iam.api-tokens.revoke.batch", key, struct {
		TokenIDs []string `json:"tokenIds"`
	}{TokenIDs: tokenIDs}, func() BatchResult {
		result := BatchResult{RequestedCount: len(tokenIDs), Succeeded: []BatchItemSuccess{}, Failed: []BatchItemFailure{}, CorrelationID: correlationID}
		for _, id := range tokenIDs {
			if strings.TrimSpace(id) == "" {
				result.ProcessedCount++
				result.Failed = append(result.Failed, batchItemFailure(id, model.ErrInvalidID))
				continue
			}
			err := s.RevokeApiToken(ctx, accountID, id)
			if err != nil && !repo.IsNotFound(err) {
				result.ProcessedCount++
				result.Failed = append(result.Failed, batchItemFailure(id, err))
				continue
			}
			// 已吊销/不存在视为成功（幂等吊销语义），不重复报错。
			result.ProcessedCount++
			result.Succeeded = append(result.Succeeded, BatchItemSuccess{ResourceID: id})
		}
		return result
	})
}

// ResolveApiToken 供 Auth api-token verifier 适配：按明文 secret 哈希解析
// 未吊销、未禁用、未过期的令牌并刷新最后使用时间；任何失败返回
// ErrSessionInvalid（认证层映射为 401）。
func (s *Service) ResolveApiToken(ctx context.Context, token string) (ApiTokenResolution, error) {
	secret := strings.TrimSpace(token)
	if !strings.HasPrefix(secret, apiTokenPrefix) {
		return ApiTokenResolution{}, ErrSessionInvalid
	}
	var resolution ApiTokenResolution
	now := s.clock.Now().UTC()
	err := s.store.Use(ctx, func(r *repo.Unit) error {
		record, err := r.ApiTokenByHash(ctx, apiTokenHash(secret))
		if err != nil {
			return ErrSessionInvalid
		}
		if record.RevokedAt != nil || record.DisabledAt != nil || (record.ExpiresAt != nil && !now.Before(*record.ExpiresAt)) {
			return ErrSessionInvalid
		}
		scopes, scopeErr := decodeApiTokenScopes(record.Scopes)
		if scopeErr != nil {
			return scopeErr
		}
		resolution = ApiTokenResolution{AccountID: record.AccountID, Scopes: scopes}
		return r.TouchApiTokenUsage(ctx, record.ID, now)
	})
	return resolution, err
}

// normalizeApiTokenStatus 校验并归一状态过滤类目（空=all）。
func normalizeApiTokenStatus(status ApiTokenStatus) (string, error) {
	switch status {
	case "", ApiTokenStatusAll:
		return "all", nil
	case ApiTokenStatusActive, ApiTokenStatusDisabled, ApiTokenStatusExpired, ApiTokenStatusRevoked:
		return string(status), nil
	default:
		return "", fmt.Errorf("iam api token status %q is unknown", status)
	}
}

// accountByID 读取账号完整记录。
func (s *Service) accountByID(ctx context.Context, accountID string) (repo.AccountRecord, error) {
	var account repo.AccountRecord
	err := s.store.Use(ctx, func(r *repo.Unit) error {
		var findErr error
		account, findErr = r.AccountByID(ctx, accountID)
		return findErr
	})
	return account, err
}

// creatorOwnedPermissions 投影创建者当前有效权限集合（080：权限知情创建
// 的权威依据；受限会话此处由调用方前置拒绝）。
func (s *Service) creatorOwnedPermissions(ctx context.Context, accountID string) (map[permissioncatalog.Key]struct{}, error) {
	var revision uint64
	if err := s.store.Use(ctx, func(r *repo.Unit) error {
		var err error
		revision, err = r.CurrentAuthorizationRevision(ctx)
		return err
	}); err != nil {
		return nil, err
	}
	values, err := s.authorization.ProjectPermissions(ctx, accountID, revision, false)
	if err != nil {
		return nil, err
	}
	owned := make(map[permissioncatalog.Key]struct{}, len(values))
	for _, value := range values {
		owned[value] = struct{}{}
	}
	return owned, nil
}

func (s *Service) validateApiTokenScopes(scopes []permissioncatalog.Key) ([]permissioncatalog.Key, error) {
	normalized := make([]permissioncatalog.Key, 0, len(scopes))
	seen := make(map[permissioncatalog.Key]struct{}, len(scopes))
	for _, scope := range scopes {
		if strings.TrimSpace(string(scope)) == "" {
			return nil, ErrUnknownPermission
		}
		if _, ok := s.catalog.Lookup(scope); !ok {
			return nil, fmt.Errorf("%w: %s", ErrUnknownPermission, scope)
		}
		if _, exists := seen[scope]; exists {
			continue
		}
		seen[scope] = struct{}{}
		normalized = append(normalized, scope)
	}
	sort.Slice(normalized, func(left, right int) bool { return normalized[left] < normalized[right] })
	return normalized, nil
}

func (s *Service) requireAccount(ctx context.Context, accountID string) error {
	return s.store.Use(ctx, func(r *repo.Unit) error {
		_, err := r.AccountByID(ctx, accountID)
		return err
	})
}

func newApiTokenSecret() (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", fmt.Errorf("generate api token secret: %w", err)
	}
	return apiTokenPrefix + base64.RawURLEncoding.EncodeToString(raw), nil
}

func apiTokenHash(secret string) string {
	sum := sha256.Sum256([]byte(secret))
	return hex.EncodeToString(sum[:])
}

func encodeApiTokenScopes(scopes []permissioncatalog.Key) (string, error) {
	values := make([]string, len(scopes))
	for index, scope := range scopes {
		values[index] = string(scope)
	}
	encoded, err := json.Marshal(values)
	if err != nil {
		return "", fmt.Errorf("encode api token scopes: %w", err)
	}
	return string(encoded), nil
}

func decodeApiTokenScopes(encoded string) ([]permissioncatalog.Key, error) {
	var values []string
	if err := json.Unmarshal([]byte(encoded), &values); err != nil {
		return nil, fmt.Errorf("decode api token scopes: %w", err)
	}
	scopes := make([]permissioncatalog.Key, 0, len(values))
	for _, value := range values {
		scopes = append(scopes, permissioncatalog.Key(value))
	}
	return scopes, nil
}

func apiTokenView(record repo.ApiTokenRecord, now time.Time) ApiTokenView {
	scopes, err := decodeApiTokenScopes(record.Scopes)
	if err != nil {
		scopes = nil
	}
	return ApiTokenView{Version: record.Version, ID: record.ID, Name: record.Name, Description: record.Description, Scopes: scopes, ExpiresAt: record.ExpiresAt, DisabledAt: record.DisabledAt, RevokedAt: record.RevokedAt, CreatedAt: record.CreatedAt, LastUsed: record.LastUsed, Status: derivedApiTokenStatus(record, now)}
}

// derivedApiTokenStatus 派生令牌状态（优先级 revoked > expired > disabled > active）。
func derivedApiTokenStatus(record repo.ApiTokenRecord, now time.Time) string {
	switch {
	case record.RevokedAt != nil:
		return string(ApiTokenStatusRevoked)
	case record.ExpiresAt != nil && !now.Before(*record.ExpiresAt):
		return string(ApiTokenStatusExpired)
	case record.DisabledAt != nil:
		return string(ApiTokenStatusDisabled)
	default:
		return string(ApiTokenStatusActive)
	}
}

// ---- MFA/TOTP（078，R078-002） ----

// mfaChallenge 是登录两步的一次性挑战（内存态、短 TTL、最多 maxMFAChallengeAttempts 次）。
type mfaChallenge struct {
	AccountID string
	ExpiresAt time.Time
	Attempts  int
}

const (
	mfaChallengeTTL         = 2 * time.Minute
	maxMFAChallengeAttempts = 5
	mfaRecoveryCodeCount    = 10
)

// MFAEnrollView 是绑定预览（secret 明文仅绑定阶段可见）。
type MFAEnrollView struct {
	Secret string
	URI    string
}

// BeginMFAEnroll 生成 TOTP 种子与 otpauth URI 并落 pending 记录（未确认）。
func (s *Service) BeginMFAEnroll(ctx context.Context, accountID string) (MFAEnrollView, error) {
	if err := s.requireAccount(ctx, accountID); err != nil {
		return MFAEnrollView{}, err
	}
	secret, err := totp.GenerateSecret()
	if err != nil {
		return MFAEnrollView{}, err
	}
	now := s.clock.Now().UTC()
	err = s.store.Use(ctx, func(r *repo.Unit) error {
		return r.UpsertMFASecret(ctx, &repo.MFASecretRecord{AccountID: accountID, Secret: secret, CreatedAt: now})
	})
	if err != nil {
		return MFAEnrollView{}, err
	}
	return MFAEnrollView{Secret: secret, URI: totp.URI(mfaIssuer, accountID, secret)}, nil
}

// ConfirmMFAEnroll 校验验证码并激活绑定，返回一次性恢复码（明文仅此一次）。
func (s *Service) ConfirmMFAEnroll(ctx context.Context, accountID, code string) ([]string, error) {
	now := s.clock.Now().UTC()
	var recoveryCodes []string
	err := s.store.Use(ctx, func(r *repo.Unit) error {
		secret, err := r.MFASecretByAccount(ctx, accountID)
		if err != nil {
			return err
		}
		ok, verifyErr := totp.Validate(secret.Secret, code, now, totp.DefaultWindow)
		if verifyErr != nil {
			return verifyErr
		}
		if !ok {
			return ErrMFAInvalidCode
		}
		if err := r.ConfirmMFASecret(ctx, accountID, now); err != nil {
			return err
		}
		hashes := make([]string, 0, mfaRecoveryCodeCount)
		codes := make([]string, 0, mfaRecoveryCodeCount)
		records := make([]repo.MfaRecoveryCodeRecord, 0, mfaRecoveryCodeCount)
		for range mfaRecoveryCodeCount {
			plain, generateErr := newRecoveryCode()
			if generateErr != nil {
				return generateErr
			}
			codes = append(codes, plain)
			hashes = append(hashes, recoveryCodeHash(plain))
			records = append(records, repo.MfaRecoveryCodeRecord{AccountID: accountID, CodeHash: recoveryCodeHash(plain)})
		}
		if err := r.CreateRecoveryCodes(ctx, records); err != nil {
			return err
		}
		recoveryCodes = codes
		return nil
	})
	s.auditOperation(ctx, "iam.self.mfa.confirm", "confirm", "mfa", accountID, err)
	if err != nil {
		return nil, err
	}
	return recoveryCodes, nil
}

// DisableMFA 校验验证码或恢复码后解绑 MFA（删除种子与恢复码）。
func (s *Service) DisableMFA(ctx context.Context, accountID, code string) error {
	now := s.clock.Now().UTC()
	err := s.store.Use(ctx, func(r *repo.Unit) error {
		secret, err := r.MFASecretByAccount(ctx, accountID)
		if err != nil {
			return err
		}
		valid, verifyErr := totp.Validate(secret.Secret, code, now, totp.DefaultWindow)
		if verifyErr != nil {
			return verifyErr
		}
		if !valid {
			// 允许使用恢复码解绑（丢失设备场景）。
			if !s.recoveryCodeValid(ctx, r, accountID, code) {
				return ErrMFAInvalidCode
			}
		}
		if err := r.DeleteMFASecret(ctx, accountID); err != nil {
			return err
		}
		return r.DeleteRecoveryCodes(ctx, accountID)
	})
	s.auditOperation(ctx, "iam.self.mfa.disable", "disable", "mfa", accountID, err)
	return err
}

// MFABound 判断账号是否已绑定并确认 TOTP。
func (s *Service) MFABound(ctx context.Context, accountID string) (bool, error) {
	var bound bool
	err := s.store.Use(ctx, func(r *repo.Unit) error {
		secret, err := r.MFASecretByAccount(ctx, accountID)
		if err != nil {
			if repo.IsNotFound(err) {
				return nil
			}
			return err
		}
		bound = secret.Confirmed
		return nil
	})
	return bound, err
}

// BeginMFAChallenge 为已通过密码验证的账号签发一次性 MFA 挑战。
func (s *Service) BeginMFAChallenge(ctx context.Context, accountID string) (string, error) {
	bound, err := s.MFABound(ctx, accountID)
	if err != nil {
		return "", err
	}
	if !bound {
		return "", ErrMFANotBound
	}
	challenge, err := randomToken()
	if err != nil {
		return "", err
	}
	s.mfaMu.Lock()
	s.mfaChallenges[challenge] = mfaChallenge{AccountID: accountID, ExpiresAt: s.clock.Now().UTC().Add(mfaChallengeTTL)}
	s.mfaMu.Unlock()
	return challenge, nil
}

// VerifyMFAChallenge 校验一次性挑战 + TOTP/恢复码并建立 MFA 已验证会话。
func (s *Service) VerifyMFAChallenge(ctx context.Context, challengeID, code string) (Session, error) {
	s.mfaMu.Lock()
	candidate, ok := s.mfaChallenges[challengeID]
	if ok {
		if !s.clock.Now().UTC().Before(candidate.ExpiresAt) {
			delete(s.mfaChallenges, challengeID)
			ok = false
		}
	}
	if !ok {
		s.mfaMu.Unlock()
		return Session{}, ErrMFAChallengeInvalid
	}
	candidate.Attempts++
	s.mfaChallenges[challengeID] = candidate
	s.mfaMu.Unlock()
	if candidate.Attempts > maxMFAChallengeAttempts {
		s.mfaMu.Lock()
		delete(s.mfaChallenges, challengeID)
		s.mfaMu.Unlock()
		return Session{}, ErrMFAChallengeInvalid
	}

	var result Session
	err := s.store.Use(ctx, func(r *repo.Unit) error {
		secret, err := r.MFASecretByAccount(ctx, candidate.AccountID)
		if err != nil {
			return err
		}
		now := s.clock.Now().UTC()
		valid, verifyErr := totp.Validate(secret.Secret, code, now, totp.DefaultWindow)
		if verifyErr != nil {
			return verifyErr
		}
		if !valid && !s.recoveryCodeValid(ctx, r, candidate.AccountID, code) {
			return ErrMFAInvalidCode
		}
		account, err := r.AccountByID(ctx, candidate.AccountID)
		if err != nil || account.Status != string(model.AccountActive) || account.Archived {
			return ErrAccountDisabled
		}
		credential, credentialErr := r.CredentialByAccount(ctx, candidate.AccountID)
		if credentialErr != nil {
			return ErrSessionInvalid
		}
		principal := modelAccount(account)
		if s.passwordExpired(now, credential.PasswordChangedAt) {
			principal.MustChangePassword = true
		}
		result, err = s.createSession(ctx, r, principal, true)
		return err
	})
	if err == nil {
		// 挑战一次性：仅在成功后销毁；错误码/失败保留以便在尝试上限内重试。
		s.mfaMu.Lock()
		delete(s.mfaChallenges, challengeID)
		s.mfaMu.Unlock()
	}
	if err != nil {
		if errors.Is(err, ErrMFAInvalidCode) {
			// 连续 MFA 失败触发告警并补低敏审计（079）。
			s.reportMFAFailure(ctx, candidate.AccountID)
			s.auditOperation(ctx, "iam.login.mfa-verify", "verify", "account", candidate.AccountID, err)
		}
		return Session{}, err
	}
	return s.projectSession(ctx, result)
}

func (s *Service) recoveryCodeValid(ctx context.Context, r *repo.Unit, accountID, code string) bool {
	if strings.TrimSpace(code) == "" {
		return false
	}
	hash := recoveryCodeHash(strings.TrimSpace(code))
	hashes, err := r.RecoveryCodesByAccount(ctx, accountID)
	if err != nil {
		return false
	}
	for _, existing := range hashes {
		if subtle.ConstantTimeCompare([]byte(existing), []byte(hash)) != 1 {
			continue
		}
		return r.MarkRecoveryCodeUsed(ctx, accountID, hash, s.clock.Now().UTC()) == nil
	}
	return false
}

func newRecoveryCode() (string, error) {
	raw := make([]byte, 9)
	if _, err := rand.Read(raw); err != nil {
		return "", fmt.Errorf("generate mfa recovery code: %w", err)
	}
	encoded := base64.RawURLEncoding.EncodeToString(raw)
	return strings.ToUpper(encoded[:6]) + "-" + strings.ToUpper(encoded[6:12]), nil
}

func recoveryCodeHash(code string) string {
	sum := sha256.Sum256([]byte(code))
	return hex.EncodeToString(sum[:])
}
