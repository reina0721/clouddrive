// Package iam 负责身份、凭据、会话与 Core RBAC 的局部装配。
package iam

import (
	"fmt"

	"github.com/reina0721/clouddrive/internal/module"
	passwordadapter "github.com/reina0721/clouddrive/internal/module/iam/adapter/password"
	"github.com/reina0721/clouddrive/internal/module/iam/authorization"
	configbinding "github.com/reina0721/clouddrive/internal/module/iam/binding/config"
	httpbinding "github.com/reina0721/clouddrive/internal/module/iam/binding/http"
	"github.com/reina0721/clouddrive/internal/module/iam/model"
	"github.com/reina0721/clouddrive/internal/module/iam/repo"
	"github.com/reina0721/clouddrive/internal/module/iam/service"
	permissioncatalog "github.com/reina0721/clouddrive/internal/permission"
	pkgalerting "github.com/reina0721/clouddrive/pkg/alerting"
	"github.com/reina0721/clouddrive/pkg/clock"
	"github.com/reina0721/clouddrive/pkg/idgen"
)

const moduleID module.ID = "iam"

type Dependencies struct {
	Database    repo.Access
	Clock       clock.Clock
	IDGenerator idgen.Generator
	Config      configbinding.Config
	Permissions permissioncatalog.Catalog
	// AlertNotifier 是安全告警事件汇报通道（079）；nil 时告警 no-op。
	AlertNotifier pkgalerting.Notifier
}
type HTTPDependencies struct {
	Dependencies
	AllowedOrigins []string
}

// Module 是 IAM 局部装配后的完成品；根组合只通过窄 facet 使用 IAM。
type Module struct {
	Collaboration        CollaborationDirectory
	Sessions             SessionResolver
	Authorization        Authorization
	Accounts             AccountDirectory
	AccountAuthorization AccountAuthorizer
	Administration       Administration
	Mutation             MutationGuard
	// ApiTokens 是 API-Token 认证解析窄 facet（078）。
	ApiTokens    ApiTokenResolver
	Contribution module.Contribution
}
type HTTPModule struct {
	Module
	Handler *httpbinding.Handler
	// Service 是 HTTP profile 的完成品服务，供 composition 注入跨模块能力
	// （如业务操作审计 writer）与窄协议装配；普通模块协作仍走 Module facet。
	Service *service.Service
}

func New(dependencies Dependencies) (Module, error) {
	core, _, err := newModule(dependencies)
	return core, err
}

// newModule 构造 IAM module-local composition；iamService 只返回给
// 模块内部的 HTTP/Handler 装配使用，根组合通过窄 facet 访问 IAM。
func newModule(dependencies Dependencies) (Module, *service.Service, error) {
	store, err := repo.New(dependencies.Database)
	if err != nil {
		return Module{}, nil, err
	}
	runtime, err := authorization.New(store, dependencies.Permissions)
	if err != nil {
		return Module{}, nil, fmt.Errorf("compose iam authorization runtime: %w", err)
	}
	local := dependencies.Config.Local
	iamService, err := service.New(store, dependencies.Clock, dependencies.IDGenerator, passwordadapter.Hasher{}, service.Config{SetupToken: local.SetupToken, IdleTimeout: local.IdleTimeout, AbsoluteTimeout: local.AbsoluteTimeout, MaxFailedAttempts: local.MaxFailedAttempts, LockDuration: local.LockDuration, PasswordPolicy: model.PasswordPolicy{MinLength: local.PasswordPolicy.MinLength, MaxLength: local.PasswordPolicy.MaxLength, RequireComplexity: local.PasswordPolicy.RequireComplexity, HistorySize: local.PasswordPolicy.HistorySize, MaxPasswordAge: local.PasswordPolicy.MaxPasswordAge}, MaxSessionsPerAccount: local.MaxSessionsPerAccount, ApiTokenMaxPerAccount: local.ApiTokenMaxPerAccount, ApiTokenDefaultTTL: local.ApiTokenDefaultTTL}, dependencies.Permissions, runtime)
	if err != nil {
		return Module{}, nil, fmt.Errorf("compose iam service: %w", err)
	}
	if dependencies.AlertNotifier != nil {
		iamService.WithAlertReporter(dependencies.AlertNotifier)
	}
	contribution := module.Contribution{ID: moduleID}
	if err := module.ValidateContributions(contribution); err != nil {
		return Module{}, nil, err
	}
	return Module{
		Collaboration: collaborationDirectory{store: store, clock: dependencies.Clock}, Sessions: iamService, Authorization: runtime, Accounts: iamService, AccountAuthorization: accountAuthorizer{store: store, runtime: runtime},
		Administration: iamService, Mutation: iamService, ApiTokens: iamService, Contribution: contribution,
	}, iamService, nil
}
func NewHTTP(dependencies HTTPDependencies) (HTTPModule, error) {
	core, iamService, err := newModule(dependencies.Dependencies)
	if err != nil {
		return HTTPModule{}, err
	}
	handler, err := httpbinding.NewHandler(iamService, dependencies.AllowedOrigins)
	if err != nil {
		return HTTPModule{}, fmt.Errorf("compose iam HTTP handler: %w", err)
	}
	return HTTPModule{Module: core, Handler: handler, Service: iamService}, nil
}
