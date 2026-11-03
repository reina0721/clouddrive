// Package service 实现认证、operation policy 与审计用例。
package service

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/reina0721/clouddrive/internal/module/auth/model"
	pkgalerting "github.com/reina0721/clouddrive/pkg/alerting"
	"github.com/reina0721/clouddrive/pkg/clock"
)

// CredentialVerifier 是 Auth Service 使用方定义的第三方凭据验证 port。
type CredentialVerifier interface {
	Verify(context.Context, model.Credential) (model.Principal, error)
	Ready() bool
}

// ChainVerifier 按声明顺序尝试多个 CredentialVerifier（078）：首个成功即
// 返回 Principal；全部失败返回最后一个错误。用于 Bearer 认证链上并存
// 外部 JWT 与自管 API-Token，语义对调用方透明。
type ChainVerifier struct {
	verifiers []CredentialVerifier
}

// NewChainVerifier 构造非空、去 nil 的复合 verifier。
func NewChainVerifier(verifiers ...CredentialVerifier) (*ChainVerifier, error) {
	chain := make([]CredentialVerifier, 0, len(verifiers))
	for _, verifier := range verifiers {
		if verifier == nil {
			continue
		}
		chain = append(chain, verifier)
	}
	if len(chain) == 0 {
		return nil, errors.New("auth chain verifier is empty")
	}
	return &ChainVerifier{verifiers: chain}, nil
}

func (c *ChainVerifier) Verify(ctx context.Context, credential model.Credential) (model.Principal, error) {
	if c == nil || len(c.verifiers) == 0 {
		return model.Principal{}, model.ErrUnauthenticated
	}
	var lastErr error
	for _, verifier := range c.verifiers {
		principal, err := verifier.Verify(ctx, credential)
		if err == nil {
			return principal, nil
		}
		lastErr = err
	}
	if lastErr == nil {
		return model.Principal{}, model.ErrUnauthenticated
	}
	return model.Principal{}, lastErr
}

func (c *ChainVerifier) Ready() bool {
	if c == nil {
		return false
	}
	for _, verifier := range c.verifiers {
		if verifier != nil && verifier.Ready() {
			return true
		}
	}
	return false
}

var _ CredentialVerifier = (*ChainVerifier)(nil)

// AuditSink 是 Auth Service 使用方定义的低敏审计 port。
type AuditSink interface {
	Record(context.Context, model.AuditEvent) error
}

// AuditQueryFilter 是审计只读查询的可选低敏过滤条件；空字段表示不过滤。
type AuditQueryFilter struct {
	CorrelationID string
	Operation     string
	Action        string
	Outcome       string
	ActorKind     string
	SubjectHash   string
	ResourceType  string
	Since         *time.Time
	Until         *time.Time
}

// AuditEventView 是查询返回的低敏事件视图（不含原始 token/claims/对象内容）。
type AuditEventView struct {
	EventID       uint64
	CorrelationID string
	Operation     string
	Action        model.Action
	ActorKind     model.ActorKind
	SubjectHash   string
	ResourceType  string
	ResourceHash  string
	Decision      model.DecisionReason
	Outcome       model.AuditOutcome
	OccurredAt    time.Time
}

// AuditQueryResult 是分页审计查询结果；NextCursor 非空表示还有下一页，
// HasMore 与 NextCursor 同源（服务端按 limit+1 探测）。
type AuditQueryResult struct {
	Items      []AuditEventView
	Limit      int
	Total      int64
	NextCursor string
	HasMore    bool
}

// AuditCursor 是按 (occurredAt,eventId) 倒序翻页的内部稳定位置。
type AuditCursor struct {
	OccurredAt time.Time
	EventID    uint64
}

// Encode 把游标序列化为不透明字符串（低敏、无签名要求：审计查询本身受
// auth.audit.list 权限保护，游标不携带任何对象内容）。
func (cursor AuditCursor) Encode() string {
	payload, err := json.Marshal(cursor)
	if err != nil {
		return ""
	}
	return base64.RawURLEncoding.EncodeToString(payload)
}

// DecodeAuditCursor 解析并校验游标；非法、过期格式返回 ErrAuditCursorInvalid。
func DecodeAuditCursor(value string) (AuditCursor, error) {
	payload, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil {
		return AuditCursor{}, ErrAuditCursorInvalid
	}
	var cursor AuditCursor
	if err := json.Unmarshal(payload, &cursor); err != nil {
		return AuditCursor{}, ErrAuditCursorInvalid
	}
	if cursor.OccurredAt.IsZero() || cursor.EventID == 0 {
		return AuditCursor{}, ErrAuditCursorInvalid
	}
	return cursor, nil
}

// AuditReader 是 Auth module 对持久化审计的只读查询 port；由 composition
// 注入 adapter/audit/storage Sink 实现。查询不提供删除/篡改入口。
type AuditReader interface {
	List(context.Context, AuditQueryFilter, *AuditCursor, int) (AuditQueryResult, error)
	Get(context.Context, uint64) (AuditEventView, error)
}

// ErrAuditEventNotFound 表示请求的低敏审计事件不存在或已超出保留窗口。
var ErrAuditEventNotFound = errors.New("auth audit event not found")

// ErrAuditCursorInvalid 表示游标损坏、过期格式或与当前筛选条件不匹配。
var ErrAuditCursorInvalid = errors.New("auth audit cursor is invalid")

// OperationAuditWriter 是业务模块写操作审计的窄 port：业务模块在写操作
// 成功/失败边界调用，携带低敏字段域；实现方负责从当前 Principal 推导
// actor 并写入同一低敏审计面。审计写失败低敏上报（由实现方记录），
// 不阻断业务结果。
type OperationAuditWriter interface {
	RecordOperation(context.Context, model.OperationAuditRequest) error
}

// AuthorizationRequest 是 Auth 交给 DecisionPoint 的最小判断输入；
// Permission 语义为精确 PermissionKey，Auth 不解释其 owner。
type AuthorizationRequest struct {
	Subject    string
	Permission model.Scope
	Revision   uint64
	Restricted bool
}

// AuthorizationDecision 是 DecisionPoint 返回的低基数判断结果。
type AuthorizationDecision struct {
	Allowed bool
	Reason  model.DecisionReason
}

// DecisionPoint 是 Auth 消费方拥有的 RBAC 决策 port；由 composition 把
// IAM Authorization facet 适配注入。Auth 不 import IAM，不知道 Casbin。
type DecisionPoint interface {
	Decide(context.Context, AuthorizationRequest) (AuthorizationDecision, error)
}

// Authenticator 是 HTTP middleware 使用的最小入口。
type Authenticator interface {
	Authenticate(context.Context, model.Credential) (model.Principal, error)
	DevelopmentPrincipal(context.Context) (model.Principal, error)
	RecordAuthenticationFailure(context.Context) error
}

// Service 是 Auth module 对 transport 与跨模块 Adapter 暴露的完成品。
type Service struct {
	clock         clock.Clock
	verifier      CredentialVerifier
	development   *model.Principal
	audit         AuditSink
	auditReader   AuditReader
	decisionPoint DecisionPoint
	byOperation   map[string]model.Policy
	byAction      map[model.Action]model.Policy

	alertReporter  pkgalerting.Notifier
	authFailures   map[string]authFailureWindow
	authFailuresMu sync.Mutex
}

// authFailureWindow 是连续认证失败告警的进程内计数窗口。
type authFailureWindow struct {
	Count       int
	WindowStart time.Time
}

const (
	authFailureAlertThreshold = 5
	authFailureWindowDuration = 10 * time.Minute
)

// WithAlertReporter 注入安全告警事件汇报通道（079）；nil 时告警 no-op。
func (s *Service) WithAlertReporter(reporter pkgalerting.Notifier) {
	if s == nil {
		return
	}
	s.alertReporter = reporter
}

// New 构造不执行 I/O 的 Auth Service，并冻结 policy authority；
// decisionPoint 是 iam-rbac 来源主体的必选依赖。
func New(currentClock clock.Clock, verifier CredentialVerifier, development *model.Principal, audit AuditSink, decisionPoint DecisionPoint, policies []model.Policy) (*Service, error) {
	return newService(currentClock, verifier, development, false, audit, nil, decisionPoint, policies)
}

// NewLocal 构造只接受显式 CLI operator 的 Auth Service，不启用 HTTP 认证入口，
// 也不需要 DecisionPoint（CLI operator 永远是 token-scopes 来源）。
func NewLocal(currentClock clock.Clock, audit AuditSink, policies []model.Policy) (*Service, error) {
	return newService(currentClock, nil, nil, true, audit, nil, nil, policies)
}

// WithAuditReader 注入持久化审计只读查询 port；被授权查询 operation 消费。
func (s *Service) WithAuditReader(reader AuditReader) error {
	if s == nil || reader == nil {
		return fmt.Errorf("auth audit reader is nil")
	}
	s.auditReader = reader
	return nil
}

func newService(currentClock clock.Clock, verifier CredentialVerifier, development *model.Principal, localOnly bool, audit AuditSink, auditReader AuditReader, decisionPoint DecisionPoint, policies []model.Policy) (*Service, error) {
	if currentClock == nil || audit == nil {
		return nil, fmt.Errorf("auth service dependencies are incomplete")
	}
	if verifier == nil && development == nil && !localOnly {
		return nil, fmt.Errorf("auth service has no authentication profile")
	}
	if localOnly && (verifier != nil || development != nil) || verifier != nil && development != nil {
		return nil, fmt.Errorf("auth service authentication profiles conflict")
	}
	if decisionPoint == nil && !localOnly {
		return nil, fmt.Errorf("auth service has no decision point")
	}
	byOperation := make(map[string]model.Policy, len(policies))
	byAction := make(map[model.Action]model.Policy, len(policies))
	for _, policy := range policies {
		if err := validatePolicy(policy); err != nil {
			return nil, err
		}
		if _, exists := byOperation[policy.Operation]; exists {
			return nil, fmt.Errorf("auth operation policy %q is duplicated", policy.Operation)
		}
		byOperation[policy.Operation] = policy
		if policy.Action != "" {
			if _, exists := byAction[policy.Action]; exists {
				return nil, fmt.Errorf("auth action policy %q is duplicated", policy.Action)
			}
			byAction[policy.Action] = policy
		}
	}
	if len(byOperation) == 0 {
		return nil, fmt.Errorf("auth policy inventory is empty")
	}
	return &Service{
		clock: currentClock, verifier: verifier, development: development, audit: audit,
		auditReader: auditReader, decisionPoint: decisionPoint, byOperation: byOperation, byAction: byAction,
		authFailures: map[string]authFailureWindow{},
	}, nil
}

func validatePolicy(policy model.Policy) error {
	if strings.TrimSpace(policy.Operation) == "" {
		return fmt.Errorf("auth operation policy has empty operation")
	}
	switch policy.Mode {
	case model.PolicyPublic:
		if policy.Scope != "" || policy.Action != "" {
			return fmt.Errorf("public auth policy %q declares scope or action", policy.Operation)
		}
	case model.PolicyProtected:
		if policy.Scope == "" || policy.Action == "" {
			return fmt.Errorf("protected auth policy %q is incomplete", policy.Operation)
		}
	default:
		return fmt.Errorf("auth policy %q has unsupported mode %q", policy.Operation, policy.Mode)
	}
	return nil
}

// Authenticate 验证 transport 提供的凭据；Verifier 未 Ready 时 fail closed。
func (s *Service) Authenticate(ctx context.Context, credential model.Credential) (model.Principal, error) {
	if ctx == nil || s == nil || s.verifier == nil || !s.verifier.Ready() {
		return model.Principal{}, model.ErrUnauthenticated
	}
	if err := ctx.Err(); err != nil {
		return model.Principal{}, err
	}
	principal, err := s.verifier.Verify(ctx, credential)
	if err != nil {
		if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
			return model.Principal{}, err
		}
		return model.Principal{}, model.ErrUnauthenticated
	}
	return principal, nil
}

// DevelopmentPrincipal 只在已由 config gate 构造的开发 profile 返回主体。
func (s *Service) DevelopmentPrincipal(ctx context.Context) (model.Principal, error) {
	if ctx == nil || s == nil || s.development == nil {
		return model.Principal{}, model.ErrUnauthenticated
	}
	if err := ctx.Err(); err != nil {
		return model.Principal{}, err
	}
	return *s.development, nil
}

// LocalPrincipal 为显式 CLI operator 构造主体，不解析 bearer token。
func (s *Service) LocalPrincipal(ctx context.Context, subject string, scopes []model.Scope) (model.Principal, error) {
	if ctx == nil || s == nil {
		return model.Principal{}, model.ErrUnauthenticated
	}
	if err := ctx.Err(); err != nil {
		return model.Principal{}, err
	}
	now := s.clock.Now()
	return model.NewPrincipal(subject, model.ActorCLI, scopes, now, now)
}

// AuthorizeOperation 按 OpenAPI operation authority 授权。
func (s *Service) AuthorizeOperation(ctx context.Context, principal model.Principal, operation string) (model.Decision, error) {
	policy, exists := s.byOperation[operation]
	if !exists {
		return model.Decision{Reason: model.ReasonMissingPolicy}, nil
	}
	return s.decide(ctx, principal, policy, model.ResourceFacts{})
}

// EnforceOperation 执行 operation policy 并在返回前完成低敏审计。
func (s *Service) EnforceOperation(ctx context.Context, principal model.Principal, operation string) error {
	decision, err := s.AuthorizeOperation(ctx, principal, operation)
	if err != nil {
		return err
	}
	outcome := model.AuditDenied
	if decision.Allowed {
		outcome = model.AuditSucceeded
	}
	if err := s.Record(ctx, model.AuditEvent{
		Operation: operation, Principal: principal, Decision: decision, Outcome: outcome,
	}); err != nil {
		return fmt.Errorf("record operation authorization audit: %w", err)
	}
	if !decision.Allowed {
		return model.ErrPermissionDenied
	}
	return nil
}

// AuthorizeAction 按业务 action 与真实资源事实授权。
func (s *Service) AuthorizeAction(ctx context.Context, principal model.Principal, action model.Action, resource model.ResourceFacts) (model.Decision, error) {
	policy, exists := s.byAction[action]
	if !exists {
		return model.Decision{Reason: model.ReasonMissingPolicy}, nil
	}
	return s.decide(ctx, principal, policy, resource)
}

// EnforceAction 执行业务对象 policy，并把资源标识交给低敏 Sink 脱敏后记录。
func (s *Service) EnforceAction(ctx context.Context, principal model.Principal, action model.Action, resource model.ResourceFacts) error {
	decision, err := s.AuthorizeAction(ctx, principal, action, resource)
	if err != nil {
		return err
	}
	outcome := model.AuditDenied
	if decision.Allowed {
		outcome = model.AuditSucceeded
	}
	if err := s.Record(ctx, model.AuditEvent{
		Action: action, Principal: principal, Resource: resource, Decision: decision, Outcome: outcome,
	}); err != nil {
		return fmt.Errorf("record action authorization audit: %w", err)
	}
	if !decision.Allowed {
		return model.ErrPermissionDenied
	}
	return nil
}

func (s *Service) decide(ctx context.Context, principal model.Principal, policy model.Policy, resource model.ResourceFacts) (model.Decision, error) {
	if ctx == nil {
		return model.Decision{}, fmt.Errorf("authorization context is nil")
	}
	if err := ctx.Err(); err != nil {
		return model.Decision{}, err
	}
	if policy.Mode == model.PolicyPublic {
		return model.Decision{Allowed: true, Reason: model.ReasonPublic}, nil
	}
	if principal.Subject == "" {
		return model.Decision{}, model.ErrUnauthenticated
	}
	switch principal.AuthorizationSource {
	case model.AuthorizationTokenScopes:
		if !principal.HasScope(policy.Scope) {
			return model.Decision{Reason: model.ReasonMissingScope}, nil
		}
	case model.AuthorizationIAMRBAC:
		if s == nil || s.decisionPoint == nil {
			return model.Decision{}, fmt.Errorf("iam rbac decision point is unavailable")
		}
		decision, err := s.decisionPoint.Decide(ctx, AuthorizationRequest{
			Subject: principal.Subject, Permission: policy.Scope,
			Revision: principal.AuthorizationRevision, Restricted: principal.Restricted,
		})
		if err != nil {
			return model.Decision{}, fmt.Errorf("iam rbac decision failed: %w", err)
		}
		if !decision.Allowed {
			return model.Decision{Reason: model.ReasonRBACDenied}, nil
		}
	default:
		return model.Decision{}, fmt.Errorf("principal authorization source %q is unknown", principal.AuthorizationSource)
	}
	if resource.OwnerSubject != "" && resource.OwnerSubject != principal.Subject {
		return model.Decision{Reason: model.ReasonOwnerMismatch}, nil
	}
	return model.Decision{Allowed: true, Reason: model.ReasonAllowed}, nil
}

// Record 交给 module-owned Audit Adapter 记录低敏事件。
func (s *Service) Record(ctx context.Context, event model.AuditEvent) error {
	if s == nil {
		return fmt.Errorf("auth service is nil")
	}
	return s.audit.Record(ctx, event)
}

// ListAuditEvents 返回持久化审计的只读游标分页视图；reader 未注入时 fail
// closed，不返回空数据冒充当前状态。limit 沿用 IAM 分页上限语义（非法输入
// 返回错误）；cursor 为空表示第一页，按 (occurredAt,eventId) 倒序稳定翻页。
func (s *Service) ListAuditEvents(ctx context.Context, filter AuditQueryFilter, cursor *AuditCursor, limit int) (AuditQueryResult, error) {
	if s == nil || s.auditReader == nil {
		return AuditQueryResult{}, fmt.Errorf("auth audit reader is unavailable")
	}
	if limit < 0 || limit > 100 {
		return AuditQueryResult{}, fmt.Errorf("auth audit pagination is invalid")
	}
	if limit == 0 {
		limit = 20
	}
	return s.auditReader.List(ctx, filter, cursor, limit)
}

// AuditEvent 返回单个低敏审计详情投影；reader 未注入时 fail closed。
func (s *Service) AuditEvent(ctx context.Context, eventID uint64) (AuditEventView, error) {
	if s == nil || s.auditReader == nil {
		return AuditEventView{}, fmt.Errorf("auth audit reader is unavailable")
	}
	if eventID == 0 {
		return AuditEventView{}, ErrAuditEventNotFound
	}
	return s.auditReader.Get(ctx, eventID)
}

// RecordOperation 把业务写操作审计事件写入低敏审计面（操作审计）。
// actor 从当前 transport Principal 推导；无 principal 时 fail closed。
// 审计写失败向上返回低敏错误（不吞错），由调用方决定是否呈现；
// 不修改业务对象，也不回滚业务结果。
func (s *Service) RecordOperation(ctx context.Context, request model.OperationAuditRequest) error {
	if s == nil {
		return fmt.Errorf("auth operation audit service is nil")
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	if request.Operation == "" || request.ResourceType == "" || request.ResourceID == "" || request.Outcome == "" {
		return fmt.Errorf("auth operation audit request is incomplete")
	}
	principal, ok := model.PrincipalFromContext(ctx)
	if !ok {
		return model.ErrUnauthenticated
	}
	event := model.AuditEvent{
		Operation: request.Operation, Action: request.Action, Principal: principal,
		Resource: model.ResourceFacts{Type: request.ResourceType, ID: request.ResourceID},
		Decision: model.Decision{Allowed: request.Outcome != model.AuditDenied && request.Outcome != model.AuditFailed, Reason: operationAuditReason(request.Outcome)},
		Outcome:  request.Outcome,
	}
	return s.Record(ctx, event)
}

// operationAuditReason 把操作审计 outcome 映射为低基数决策原因，避免暴露
// 对象内容或授权细节。
func operationAuditReason(outcome model.AuditOutcome) model.DecisionReason {
	switch outcome {
	case model.AuditSucceeded:
		return model.ReasonAllowed
	case model.AuditDenied:
		return model.ReasonRBACDenied
	default:
		return model.ReasonOwnerMismatch
	}
}

// RecordAuthenticationFailure 记录不含 token、claims 或 raw path 的认证拒绝，
// 并在连续失败窗口触发低敏告警（079）。
func (s *Service) RecordAuthenticationFailure(ctx context.Context) error {
	err := s.Record(ctx, model.AuditEvent{
		Operation: "http.authenticate", Decision: model.Decision{Reason: model.ReasonUnauthenticated}, Outcome: model.AuditDenied,
	})
	if err != nil {
		return err
	}
	s.reportRepeatedAuthFailure(ctx)
	return nil
}

// reportRepeatedAuthFailure 在进程内窗口统计连续认证失败；达到阈值后汇报一次
// 并重置窗口。未注入 reporter 时零行为。
func (s *Service) reportRepeatedAuthFailure(ctx context.Context) {
	if s == nil || s.alertReporter == nil {
		return
	}
	now := s.clock.Now().UTC()
	s.authFailuresMu.Lock()
	entry := s.authFailures["anonymous"]
	if now.Sub(entry.WindowStart) > authFailureWindowDuration {
		entry = authFailureWindow{WindowStart: now}
	}
	entry.Count++
	if entry.Count < authFailureAlertThreshold {
		s.authFailures["anonymous"] = entry
		s.authFailuresMu.Unlock()
		return
	}
	delete(s.authFailures, "anonymous")
	s.authFailuresMu.Unlock()
	_ = s.alertReporter.Notify(ctx, pkgalerting.Event{Type: "auth_failed", Severity: pkgalerting.SeverityWarning, Summary: "repeated authentication failures", OccurredAt: now})
}

// Ready 表示当前 HTTP verifier 是否可用；development profile 始终 Ready。
func (s *Service) Ready() bool {
	return s != nil && (s.development != nil || s.verifier != nil && s.verifier.Ready())
}

var _ Authenticator = (*Service)(nil)
