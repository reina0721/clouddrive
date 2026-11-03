package iam

import (
	"context"

	"github.com/reina0721/clouddrive/internal/module/iam/authorization"
	"github.com/reina0721/clouddrive/internal/module/iam/service"
	permissioncatalog "github.com/reina0721/clouddrive/internal/permission"
)

// 本文件定义 IAM Module 对外的窄输出 facet：根 composition 和跨模块
// Adapter 只通过项目自有窄契约使用 IAM 能力，不取得完整 *service.Service、
// Repository 或第三方类型。每个 facet 由真实消费者驱动。

// SessionResolver 是 Session 认证来源的最小能力。
type SessionResolver interface {
	Resolve(context.Context, string) (service.Session, error)
}

// Authorization 是 IAM RBAC evaluator 的窄 facet；
// composition 的 iamRBACDecisionAdapter 把它适配为 Auth DecisionPoint。
type Authorization interface {
	// Load 在 Generation Prepare 的 listener 前加载并验证当前 evaluator；
	// 任何失败都必须中止装配。
	Load(context.Context) error
	// Decide 执行同步 fail-closed 判断。
	Decide(context.Context, authorization.Request) (authorization.Decision, error)
	// ProjectPermissions 在同 revision 下导出账号有效权限（仅体验投影）。
	ProjectPermissions(context.Context, string, uint64, bool) ([]permissioncatalog.Key, error)
}

// AccountDirectory 是 Organization 需要的账号可指派校验。
type AccountDirectory interface {
	RequireAssignableAccount(context.Context, string) error
}

// MutationGuard 是 HTTP mutation 的 Origin/Session/CSRF 校验能力。
type MutationGuard interface {
	ValidateCSRF(context.Context, string, string) error
}

// Administration 是启动与 CLI 管理所需的 IAM 生命周期能力。
type Administration interface {
	Compatible(context.Context) error
	ReconcileOwnerCatalog(context.Context) error
	ResetPasswordByUsername(context.Context, string, string) error
}

// ApiTokenResolver 是 API-Token 认证解析的窄 facet（078）；composition 把
// 它适配为 Auth Bearer 链上的 CredentialVerifier。
type ApiTokenResolver interface {
	ResolveApiToken(context.Context, string) (service.ApiTokenResolution, error)
}
