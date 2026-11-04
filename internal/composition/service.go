package composition

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/reina0721/clouddrive/internal/kernel"
	kernelcomposition "github.com/reina0721/clouddrive/internal/kernel/composition"
	"github.com/reina0721/clouddrive/internal/kernel/config"
	authmodel "github.com/reina0721/clouddrive/internal/module/auth/model"
	httpbinding "github.com/reina0721/clouddrive/internal/module/ops/binding/http"
	opsmodel "github.com/reina0721/clouddrive/internal/module/ops/model"
	"github.com/reina0721/clouddrive/internal/transport/http/humabinding"
	"github.com/reina0721/clouddrive/pkg/httpx"
	"github.com/reina0721/clouddrive/pkg/logger"
	"github.com/reina0721/clouddrive/pkg/supervisor"
)

func (a *Application) runService(ctx context.Context) error {
	logging := a.config.Logging.Logger()
	logging.Debug("application service selected",
		logger.String("application", a.config.Name),
		logger.String("mode", "service"),
		logger.String("phase", "compose"),
	)
	runtime, err := a.newServiceRuntime()
	if err != nil {
		reportServiceFailure(logging, "compose", err)
		return err
	}
	logging.Debug("application service runtime composed",
		logger.String("application", a.config.Name),
		logger.String("mode", "service"),
		logger.String("phase", "start"),
	)
	if err := runtime.supervisor.Run(ctx); err != nil {
		if !expectedServiceShutdown(ctx, err) {
			reportServiceFailure(logging, "run", err)
		}
		return fmt.Errorf("run application supervisor: %w", err)
	}
	logging.Info("application stopped", logger.String("application", a.config.Name))
	return nil
}

type serviceRuntime struct {
	supervisor  *supervisor.Supervisor
	coordinator *kernel.GenerationCoordinator
	factory     *applicationGenerationFactory
}

func (a *Application) newServiceRuntime() (*serviceRuntime, error) {
	loader := config.New(
		config.FileSource(a.config.ConfigPath),
		config.EnvSource(a.config.EnvironmentPrefix),
	)
	bindings, err := kernelcomposition.ConfigurationBindings(applicationOwnedConfigurationBindings()...)
	if err != nil {
		return nil, fmt.Errorf("compose service configuration bindings: %w", err)
	}
	factory, err := newApplicationGenerationFactory(a.config.Logging, a.config.Name, a.blueprint)
	if err != nil {
		return nil, fmt.Errorf("create application generation factory: %w", err)
	}
	factory.build = a.config.Build.opsModel()
	coordinator, err := kernel.NewGenerationCoordinator(loader, bindings, factory, kernel.Options{Logging: a.config.Logging})
	if err != nil {
		return nil, fmt.Errorf("create application generation coordinator: %w", err)
	}
	process, err := supervisor.New(supervisor.Config{},
		coordinator,
		applicationLifecycle{applicationName: a.config.Name, logging: a.config.Logging.Logger()},
	)
	if err != nil {
		return nil, fmt.Errorf("create application supervisor: %w", err)
	}
	if err := factory.opsRuntime.connect(coordinator, process); err != nil {
		return nil, fmt.Errorf("connect ops runtime source: %w", err)
	}
	if err := process.AddTask("application-generation.monitor", coordinator.Monitor); err != nil {
		return nil, fmt.Errorf("register application generation monitor: %w", err)
	}
	watchReady := make(chan struct{})
	if err := process.AddRunner(supervisor.Task{
		Name: "application-config-watch", Ready: watchReady,
		Run: func(ctx context.Context) error {
			return coordinator.Watch(ctx, reloadErrorReporter(a.config.Logging.Logger()), watchReady)
		},
	}); err != nil {
		return nil, fmt.Errorf("register application config watcher: %w", err)
	}
	return &serviceRuntime{supervisor: process, coordinator: coordinator, factory: factory}, nil
}

func applicationRouter(
	capabilities kernelcomposition.Capabilities,
	httpConfig httpx.ServerConfig,
	apiRoutes http.Handler,
	managementFacade http.Handler,
	transferRoutes func(*http.Request) bool,
) (httpx.Router, error) {
	if apiRoutes == nil {
		return nil, fmt.Errorf("application API routes are nil")
	}
	trustedProxy, err := httpx.TrustedProxy(httpConfig.TrustedProxyCIDRs)
	if err != nil {
		return nil, fmt.Errorf("compose trusted proxy policy: %w", err)
	}
	corsMiddleware, err := httpx.CORS(httpConfig.CORS)
	if err != nil {
		return nil, fmt.Errorf("compose HTTP CORS policy: %w", err)
	}
	overload, err := httpx.NewOverloadLimiter(httpConfig.MaxInFlight)
	if err != nil {
		return nil, fmt.Errorf("compose HTTP overload limiter: %w", err)
	}
	router := httpx.NewRouter(nil)
	middlewares := []httpx.Middleware{
		httpx.RequestID(capabilities.IDGenerator),
		httpx.Recovery(capabilities.Logger),
		httpx.AccessLog(capabilities.Logger),
		trustedProxy,
		httpx.SecureHeaders(),
		httpx.RejectUpgrade(),
		httpx.RequestTimeoutPolicy(httpConfig.RequestTimeout, func(request *http.Request) (time.Duration, bool) {
			if transferRoutes != nil && transferRoutes(request) {
				return httpConfig.TransferTimeout, true
			}
			return 0, false
		}),
		func(next httpx.Handler) httpx.Handler {
			ordinary := httpx.BodyLimit(httpConfig.MaxRequestBodyBytes)(next)
			return func(ctx *httpx.Context) error {
				// 分块路由在认证及准入后按文件模块的 chunkBytes 限流；其余请求保留普通上限。
				if ctx.Request.Method == http.MethodPatch && transferRoutes != nil && transferRoutes(ctx.Request) {
					return next(ctx)
				}
				return ordinary(ctx)
			}
		},
		corsMiddleware,
	}
	switch httpConfig.RateLimit.Mode {
	case httpx.RateLimitModeLocal:
		rateLimiter, rateErr := httpx.NewPathRateLimiter(
			httpConfig.RateLimit.RequestsPerSecond,
			httpConfig.RateLimit.Burst,
			httpConfig.RateLimit.Routes,
		)
		if rateErr != nil {
			return nil, fmt.Errorf("compose HTTP rate limiter: %w", rateErr)
		}
		middlewares = append(middlewares, rateLimiter.Middleware())
	case httpx.RateLimitModeDisabled:
	default:
		return nil, fmt.Errorf("compose HTTP rate limiter: unsupported mode %q", httpConfig.RateLimit.Mode)
	}
	middlewares = append(middlewares, overload.Middleware())
	router.Use(middlewares...)
	// 模式 B：按 management 路由单一清单把已知子路径挂到业务 listener（/management/*），
	// 供托管 WebUI 同源读取真实管理数据；未知子路径由 chi NotFound 兜底为 JSON 404，
	// 非 GET 由路由 MethodNotAllowed 兜底为 JSON 405，绝不回退 SPA。
	if managementFacade != nil {
		for _, subPath := range httpbinding.ManagementRoutePaths() {
			sub := subPath
			router.Handle(httpx.MethodGet, managementHTTPPrefix+sub, func(ctx *httpx.Context) error {
				request := ctx.Request.Clone(ctx.Request.Context())
				request.URL.Path = sub
				managementFacade.ServeHTTP(ctx.ResponseWriter, request)
				return nil
			})
		}
	}
	router.Mount("/", apiRoutes)
	return router, nil
}

// apiPrefix 是业务 API 分组在宿主 Router 上的前缀；具体 operation 路径由
// internal/transport/http 与模块 contracts 声明。
const apiPrefix = "/api"

// managementHTTPPrefix 是 WebUI 开发代理约定的 management 面路径前缀；
// 托管模式下该前缀永远不回退到 SPA HTML，保持 JSON 404/405 语义。
const managementHTTPPrefix = "/management"

// webUIImmutablePrefix 是 Vite 产物中带内容 hash 的静态资源前缀，可长期缓存。
const webUIImmutablePrefix = "/assets"

func operationPoliciesFromDefinitions(definitions []humabinding.Definition) ([]authmodel.Policy, error) {
	policies := make([]authmodel.Policy, 0, 8)
	for _, operation := range definitions {
		policies = append(policies, authmodel.Policy{Operation: operation.ID, Mode: authmodel.PolicyMode(operation.Policy), Scope: authmodel.Scope(operation.Scope), Action: authmodel.Action(operation.Action)})
	}
	if len(policies) == 0 {
		return nil, fmt.Errorf("module operation policy inventory is empty")
	}
	policies = append(policies,
		authmodel.Policy{Operation: opsmodel.OperationDiagnostics, Mode: authmodel.PolicyProtected, Scope: authmodel.ScopeManagementRead, Action: "ops.diagnostics.read"},
		authmodel.Policy{Operation: opsmodel.OperationMetrics, Mode: authmodel.PolicyProtected, Scope: authmodel.ScopeManagementRead, Action: "ops.metrics.read"},
	)
	return policies, nil
}

func reloadErrorReporter(logging logger.Logger) func(error) {
	return func(err error) {
		if logging == nil || err == nil {
			return
		}
		var committed *kernel.CommittedCleanupError
		fields := []logger.Field{logger.String("error_type", fmt.Sprintf("%T", err))}
		var operation *kernel.GenerationOperationError
		if errors.As(err, &operation) {
			fields = append(fields,
				logger.String("phase", operation.Phase),
				logger.String("owner", operation.Owner),
				logger.Any("generation", operation.Generation),
				logger.String("cause_type", fmt.Sprintf("%T", operation.Err)),
			)
		}
		if errors.As(err, &committed) {
			logging.Error("application generation reload applied with cleanup debt", fields...)
			return
		}
		logging.Warn("application generation reload rejected; previous generation remains active", fields...)
	}
}

func reportServiceFailure(logging logger.Logger, phase string, err error) {
	if logging == nil || err == nil {
		return
	}
	fields := []logger.Field{
		logger.String("owner", "application"),
		logger.String("phase", phase),
		logger.String("error_type", fmt.Sprintf("%T", err)),
	}
	var operation *kernel.GenerationOperationError
	if errors.As(err, &operation) {
		fields = append(fields,
			logger.String("generation_phase", operation.Phase),
			logger.String("generation_owner", operation.Owner),
			logger.Any("generation", operation.Generation),
			logger.String("cause_type", fmt.Sprintf("%T", operation.Err)),
		)
	}
	logging.Error("application service failed", fields...)
}

func expectedServiceShutdown(ctx context.Context, err error) bool {
	if ctx == nil || ctx.Err() == nil {
		return false
	}
	return errors.Is(err, ctx.Err()) || errors.Is(err, context.Canceled)
}

type applicationLifecycle struct {
	applicationName string
	logging         logger.Logger
}

func (applicationLifecycle) Name() string { return "application" }

func (l applicationLifecycle) Start(ctx context.Context) error {
	return l.write(ctx, "application ready")
}

func (l applicationLifecycle) Stop(ctx context.Context) error {
	return l.write(ctx, "application draining")
}

func (l applicationLifecycle) write(ctx context.Context, message string) error {
	if ctx == nil {
		return fmt.Errorf("application logger context is nil")
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	if l.logging == nil {
		return fmt.Errorf("application logger is nil")
	}
	if l.applicationName == "" {
		return fmt.Errorf("application name is empty")
	}
	l.logging.Info(message, logger.String("application", l.applicationName))
	return nil
}
