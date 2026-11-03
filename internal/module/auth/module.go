// Package auth 封装认证、授权、审计及其运行时参与者。
package auth

import (
	"fmt"
	"net"
	"net/http"
	"net/url"

	"github.com/reina0721/clouddrive/internal/module"
	auditadapter "github.com/reina0721/clouddrive/internal/module/auth/adapter/audit"
	auditstorage "github.com/reina0721/clouddrive/internal/module/auth/adapter/audit/storage"
	jwtadapter "github.com/reina0721/clouddrive/internal/module/auth/adapter/jwt"
	configbinding "github.com/reina0721/clouddrive/internal/module/auth/binding/config"
	httpbinding "github.com/reina0721/clouddrive/internal/module/auth/binding/http"
	"github.com/reina0721/clouddrive/internal/module/auth/middleware"
	"github.com/reina0721/clouddrive/internal/module/auth/model"
	"github.com/reina0721/clouddrive/internal/module/auth/repo"
	"github.com/reina0721/clouddrive/internal/module/auth/service"
	pkgalerting "github.com/reina0721/clouddrive/pkg/alerting"
	"github.com/reina0721/clouddrive/pkg/clock"
	"github.com/reina0721/clouddrive/pkg/logger"
	"github.com/reina0721/clouddrive/pkg/supervisor"
)

const moduleID module.ID = "auth"

// Dependencies 是 Auth module 实际使用的稳定能力和 authority inventory。
type Dependencies struct {
	Clock         clock.Clock
	Logger        logger.Logger
	Config        configbinding.Config
	Policies      []model.Policy
	SessionSource RequestAuthenticator
	// DecisionPoint 是 iam-rbac 来源主体的 RBAC 决策 port；由 composition
	// 注入 IAM Authorization facet 的适配实现。
	DecisionPoint service.DecisionPoint
	// ExtraVerifiers 是附加的 Bearer 凭据验证器（078：API-Token 等），
	// 按声明顺序排在模块自有 verifier（JWT/development）之后尝试。
	ExtraVerifiers []service.CredentialVerifier
	// AlertNotifier 是安全告警事件汇报通道（079）；nil 时告警 no-op。
	AlertNotifier pkgalerting.Notifier
	// Database 是持久化低敏审计的可选数据库访问；nil 时回退 logger Sink。
	// 模块内部拥有 storage Sink 装配，composition 只注入数据库租约。
	Database repo.Access
	// AuditRetentionLimit 是审计持久化保留上限；<=0 表示不限（默认限由
	// 模块常量提供，composition 可显式覆盖）。
	AuditRetentionLimit int64
}

// Module 是 Auth 局部装配后交给 composition root 的完成品。
type Module struct {
	Service        *service.Service
	BearerSource   RequestAuthenticator
	SessionSource  RequestAuthenticator
	HTTPMiddleware func(http.Handler) http.Handler
	AuditHandler   *httpbinding.Handler
	// OperationAudit 是业务写操作审计的窄 port 输出；composition 把它适配为
	// 各业务模块的自有窄接口并注入。
	OperationAudit service.OperationAuditWriter
	Contribution   module.Contribution
}

// defaultAuditRetentionLimit 是审计持久化的默认受控保留上限（决策 4 首版：
// 显式上限，不自动归档；超出时删除最旧事件）。
const defaultAuditRetentionLimit int64 = 100_000

// RequestAuthenticator 是 composition 可按 security profile 选择的项目自有认证来源。
type RequestAuthenticator interface {
	AuthenticateRequest(*http.Request) (*http.Request, error)
}

// ManagementMiddleware 允许 management 使用 Bearer 或 WebUI Session，普通 API 不走此入口。
func (m Module) ManagementMiddleware(next http.Handler) http.Handler {
	if next == nil {
		return http.NotFoundHandler()
	}
	if m.SessionSource == nil {
		return m.HTTPMiddleware(next)
	}
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if authenticated, err := m.SessionSource.AuthenticateRequest(request); err == nil {
			next.ServeHTTP(writer, authenticated)
			return
		}
		m.HTTPMiddleware(next).ServeHTTP(writer, request)
	})
}

// NewHTTP 按已校验配置构造 HTTP Auth profile；构造阶段不执行网络 I/O。
func NewHTTP(dependencies Dependencies) (Module, error) {
	var audit service.AuditSink
	var auditReader service.AuditReader
	if dependencies.Database != nil {
		store, err := repo.New(dependencies.Database)
		if err != nil {
			return Module{}, fmt.Errorf("compose auth audit store: %w", err)
		}
		limit := dependencies.AuditRetentionLimit
		if limit <= 0 {
			limit = defaultAuditRetentionLimit
		}
		persistent, err := auditstorage.New(store, dependencies.Clock, limit)
		if err != nil {
			return Module{}, fmt.Errorf("compose auth audit storage sink: %w", err)
		}
		audit = persistent
		auditReader = persistent
	}
	if audit == nil {
		var err error
		audit, err = auditadapter.New(dependencies.Logger)
		if err != nil {
			return Module{}, fmt.Errorf("compose auth audit adapter: %w", err)
		}
	}
	var (
		verifier     service.CredentialVerifier
		development  *model.Principal
		participants []supervisor.Participant
		verifiers    []service.CredentialVerifier
	)
	switch dependencies.Config.Mode {
	case configbinding.ModeDevelopmentAnonymous:
		now := dependencies.Clock.Now()
		scopes := make([]model.Scope, len(dependencies.Config.AnonymousScopes))
		for index, scope := range dependencies.Config.AnonymousScopes {
			scopes[index] = model.Scope(scope)
		}
		principal, principalErr := model.NewPrincipal(
			dependencies.Config.AnonymousSubject, model.ActorDevelopment, scopes, now, now,
		)
		if principalErr != nil {
			return Module{}, fmt.Errorf("compose development principal: %w", principalErr)
		}
		development = &principal
	case configbinding.ModeSession:
		// API Token verifier 由 composition 显式注入，Session 走独立来源。
	case configbinding.ModeJWT:
		jwtConfig := dependencies.Config.JWT
		adapter, adapterErr := jwtadapter.New(jwtadapter.Config{
			Issuer: jwtConfig.Issuer, Audience: jwtConfig.Audience, JWKSURL: jwtConfig.JWKSURL,
			Algorithms: jwtConfig.Algorithms, ScopesClaim: jwtConfig.ScopesClaim,
			RequestTimeout: jwtConfig.RequestTimeout, RefreshInterval: jwtConfig.RefreshInterval,
			RefreshTimeout: jwtConfig.RefreshTimeout, Leeway: jwtConfig.Leeway,
			MaxResponseBodyBytes:   jwtConfig.MaxResponseBodyBytes,
			AllowLoopbackOrPrivate: loopbackURL(jwtConfig.JWKSURL),
		}, dependencies.Clock)
		if adapterErr != nil {
			return Module{}, fmt.Errorf("compose JWT verifier: %w", adapterErr)
		}
		verifiers = append(verifiers, adapter)
		participants = append(participants, adapter)
	default:
		return Module{}, fmt.Errorf("compose auth module: unsupported mode %q", dependencies.Config.Mode)
	}
	// 078：附加 Bearer verifier（API-Token 等）排在模块自有 verifier 之后。
	verifiers = append(verifiers, dependencies.ExtraVerifiers...)
	switch len(verifiers) {
	case 0:
		verifier = nil
	case 1:
		verifier = verifiers[0]
	default:
		chain, chainErr := service.NewChainVerifier(verifiers...)
		if chainErr != nil {
			return Module{}, fmt.Errorf("compose auth chain verifier: %w", chainErr)
		}
		verifier = chain
	}
	authService, err := service.New(dependencies.Clock, verifier, development, audit, dependencies.DecisionPoint, dependencies.Policies)
	if err != nil {
		return Module{}, fmt.Errorf("compose auth service: %w", err)
	}
	if dependencies.AlertNotifier != nil {
		authService.WithAlertReporter(dependencies.AlertNotifier)
	}
	if auditReader != nil {
		if err := authService.WithAuditReader(auditReader); err != nil {
			return Module{}, fmt.Errorf("compose auth audit reader: %w", err)
		}
	}
	auditHandler, err := httpbinding.NewHandler(authService)
	if err != nil {
		return Module{}, fmt.Errorf("compose auth audit handler: %w", err)
	}
	bearerSource, err := middleware.NewSource(authService)
	if err != nil {
		return Module{}, fmt.Errorf("compose auth bearer source: %w", err)
	}
	httpMiddleware := bearerSource.Middleware
	contribution := module.Contribution{ID: moduleID, Participants: participants}
	if err := module.ValidateContributions(contribution); err != nil {
		return Module{}, fmt.Errorf("validate auth contribution: %w", err)
	}
	return Module{Service: authService, BearerSource: bearerSource, SessionSource: dependencies.SessionSource, HTTPMiddleware: httpMiddleware, AuditHandler: auditHandler, OperationAudit: authService, Contribution: contribution}, nil
}

// NewLocal 构造 CLI profile；operator 必须由命令执行边界显式提供。
func NewLocal(dependencies Dependencies) (Module, error) {
	audit, err := auditadapter.New(dependencies.Logger)
	if err != nil {
		return Module{}, fmt.Errorf("compose auth audit adapter: %w", err)
	}
	authService, err := service.NewLocal(dependencies.Clock, audit, dependencies.Policies)
	if err != nil {
		return Module{}, fmt.Errorf("compose local auth service: %w", err)
	}
	contribution := module.Contribution{ID: moduleID}
	if err := module.ValidateContributions(contribution); err != nil {
		return Module{}, fmt.Errorf("validate auth contribution: %w", err)
	}
	return Module{Service: authService, Contribution: contribution}, nil
}

func loopbackURL(raw string) bool {
	parsed, err := url.Parse(raw)
	if err != nil {
		return false
	}
	ip := net.ParseIP(parsed.Hostname())
	return ip != nil && ip.IsLoopback()
}
