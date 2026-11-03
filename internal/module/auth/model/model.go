// Package model 定义认证授权模块的稳定项目类型。
package model

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"
)

var (
	// ErrUnauthenticated 表示请求没有可用且已验证的身份。
	ErrUnauthenticated = errors.New("principal is unauthenticated")
	// ErrPermissionDenied 表示主体不满足当前 operation/action policy。
	ErrPermissionDenied = errors.New("principal is not authorized")
)

// ActorKind 描述主体的信任来源。
type ActorKind string

const (
	ActorService     ActorKind = "service"
	ActorCLI         ActorKind = "cli"
	ActorDevelopment ActorKind = "development"
)

// AuthorizationSource 区分主体的授权决策来源；两者构造互斥，未知来源拒绝。
type AuthorizationSource string

const (
	// AuthorizationTokenScopes 表示凭据携带的精确 scope 直接决定授权，
	// revision 必须为零（Bearer/JWT、CLI/development）。
	AuthorizationTokenScopes AuthorizationSource = "token-scopes"
	// AuthorizationIAMRBAC 表示授权由注入的 DecisionPoint 按 IAM RBAC
	// evaluator 判断，Scopes 必须为空且 revision 非零。
	AuthorizationIAMRBAC AuthorizationSource = "iam-rbac"
)

// Scope 是认证主体携带的精确权限范围。
type Scope string

const (
	// ScopeManagementRead 是当前管理面只读能力的精确权限键。
	ScopeManagementRead Scope = "management:read"
	// ScopeAuditRead 是审计只读查询的精确权限键。
	ScopeAuditRead Scope = "auth:audit:read"
	// OperationWebUISession 是当前登录主体查看 WebUI 会话详情的授权 identity。
	OperationWebUISession = "auth.webui.session"
)

// Principal 是不暴露第三方 claims 的已验证主体。
type Principal struct {
	Subject               string
	Kind                  ActorKind
	AuthorizationSource   AuthorizationSource
	Scopes                []Scope
	AuthorizationRevision uint64
	// Restricted 表示 IAM 会话要求修改密码，只能使用自助权限；
	// 仅 iam-rbac 来源可携带，token-scopes 构造时恒为 false。
	Restricted      bool
	AuthenticatedAt time.Time
	IssuedAt        time.Time
}

// NewPrincipal 构造 token-scopes 来源的规范化且不含空 scope 的 Principal。
// 构造不变量：来源必须为 token-scopes，revision 必须为零。
func NewPrincipal(subject string, kind ActorKind, scopes []Scope, authenticatedAt, issuedAt time.Time) (Principal, error) {
	principal, err := newPrincipal(subject, kind, scopes, 0, false, authenticatedAt, issuedAt)
	if err != nil {
		return Principal{}, err
	}
	principal.AuthorizationSource = AuthorizationTokenScopes
	return principal, nil
}

// NewIAMRBACPrincipal 构造由注入 DecisionPoint 决策的 Principal。
// 构造不变量：来源必须为 iam-rbac，revision 必须非零，Scopes 必须为空。
func NewIAMRBACPrincipal(subject string, kind ActorKind, revision uint64, restricted bool, authenticatedAt, issuedAt time.Time) (Principal, error) {
	if revision == 0 {
		return Principal{}, fmt.Errorf("iam rbac principal revision is zero")
	}
	principal, err := newPrincipal(subject, kind, nil, revision, restricted, authenticatedAt, issuedAt)
	if err != nil {
		return Principal{}, err
	}
	principal.AuthorizationSource = AuthorizationIAMRBAC
	return principal, nil
}

func newPrincipal(subject string, kind ActorKind, scopes []Scope, revision uint64, restricted bool, authenticatedAt, issuedAt time.Time) (Principal, error) {
	subject = strings.TrimSpace(subject)
	if subject == "" || kind == "" || authenticatedAt.IsZero() || issuedAt.IsZero() {
		return Principal{}, ErrUnauthenticated
	}
	seen := make(map[Scope]struct{}, len(scopes))
	normalized := make([]Scope, 0, len(scopes))
	for _, scope := range scopes {
		scope = Scope(strings.TrimSpace(string(scope)))
		if scope == "" {
			return Principal{}, fmt.Errorf("principal scope is empty")
		}
		if _, exists := seen[scope]; exists {
			continue
		}
		seen[scope] = struct{}{}
		normalized = append(normalized, scope)
	}
	sort.Slice(normalized, func(i, j int) bool { return normalized[i] < normalized[j] })
	return Principal{
		Subject: subject, Kind: kind, Scopes: normalized,
		AuthorizationRevision: revision, Restricted: restricted,
		AuthenticatedAt: authenticatedAt.UTC(), IssuedAt: issuedAt.UTC(),
	}, nil
}

// HasScope 判断 Principal 是否拥有精确 scope；不支持隐式通配符。
// 只适用于 token-scopes 来源；iam-rbac 来源必须经 DecisionPoint 判断。
func (p Principal) HasScope(scope Scope) bool {
	for _, candidate := range p.Scopes {
		if candidate == scope {
			return true
		}
	}
	return false
}

// Credential 是 transport 提取后交给 verifier 的不透明凭据。
type Credential struct {
	Scheme string
	Value  string
}

// PolicyMode 区分公开与受保护 operation。
type PolicyMode string

const (
	PolicyPublic    PolicyMode = "public"
	PolicyProtected PolicyMode = "protected"
)

// Action 是业务用例拥有的稳定授权动作。
type Action string

// Policy 是由 OpenAPI inventory 传入 Auth module 的 operation policy。
type Policy struct {
	Operation string
	Mode      PolicyMode
	Scope     Scope
	Action    Action
}

// ResourceFacts 是授权所需的最小真实资源事实。
type ResourceFacts struct {
	Type         string
	ID           string
	OwnerSubject string
}

// DecisionReason 是可审计但不泄漏对象内容的原因类。
type DecisionReason string

const (
	ReasonAllowed         DecisionReason = "allowed"
	ReasonPublic          DecisionReason = "public"
	ReasonUnauthenticated DecisionReason = "unauthenticated"
	ReasonMissingPolicy   DecisionReason = "missing_policy"
	ReasonMissingScope    DecisionReason = "missing_scope"
	// ReasonRBACDenied 表示 iam-rbac 来源被注入 DecisionPoint 业务拒绝。
	ReasonRBACDenied    DecisionReason = "rbac_denied"
	ReasonOwnerMismatch DecisionReason = "owner_mismatch"
)

// Decision 是显式 fail-closed 的授权结果。
type Decision struct {
	Allowed bool
	Reason  DecisionReason
}

// AuditOutcome 是安全审计的低基数结果类。
type AuditOutcome string

const (
	AuditSucceeded AuditOutcome = "succeeded"
	AuditDenied    AuditOutcome = "denied"
	AuditFailed    AuditOutcome = "failed"
)

// AuditEvent 只携带安全判断需要的项目类型；Sink 负责标识符脱敏。
type AuditEvent struct {
	// CorrelationID 关联同一请求内产生的多个低敏操作事件；缺失时为空。
	CorrelationID string
	Operation     string
	Action        Action
	Principal     Principal
	Resource      ResourceFacts
	Decision      Decision
	Outcome       AuditOutcome
}

// OperationAuditRequest 是业务模块写操作审计的低敏字段域：只携带稳定动作、
// 资源类型/ID（写入时统一哈希）、结果分类，不携带对象内容、before/after、
// 密码、token 或权限集合原文。Actor 由写入方从当前 Principal 推导。
type OperationAuditRequest struct {
	Operation    string
	Action       Action
	ResourceType string
	ResourceID   string
	Outcome      AuditOutcome
}

type principalContextKey struct{}

type correlationIDContextKey struct{}

// WithPrincipal 把已验证 Principal 写入单次 transport context。
func WithPrincipal(ctx context.Context, principal Principal) context.Context {
	return context.WithValue(ctx, principalContextKey{}, principal)
}

// PrincipalFromContext 读取 transport 边界写入的 Principal。
func PrincipalFromContext(ctx context.Context) (Principal, bool) {
	if ctx == nil {
		return Principal{}, false
	}
	principal, ok := ctx.Value(principalContextKey{}).(Principal)
	return principal, ok && principal.Subject != "" && principal.Kind != "" && principal.AuthorizationSource != "" && !principal.AuthenticatedAt.IsZero()
}

// WithCorrelationID 把请求关联标识写入单次 transport context。
func WithCorrelationID(ctx context.Context, value string) context.Context {
	return context.WithValue(ctx, correlationIDContextKey{}, strings.TrimSpace(value))
}

// CorrelationIDFromContext 读取请求关联标识；空值视为未设置。
func CorrelationIDFromContext(ctx context.Context) (string, bool) {
	if ctx == nil {
		return "", false
	}
	value, ok := ctx.Value(correlationIDContextKey{}).(string)
	return value, ok && value != ""
}
