// Package execution 定义由 Kernel 治理的后台任务执行能力 App 组件。
// 当前 memory backend 只提供单进程幂等、同步记录与有界重试，不伪装成外部持久化资源。
package execution

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/reina0721/clouddrive/internal/kernel/app"
	"github.com/reina0721/clouddrive/internal/kernel/config"
	"github.com/reina0721/clouddrive/internal/kernel/logging"
	pkgexecution "github.com/reina0721/clouddrive/pkg/execution"
	"github.com/reina0721/clouddrive/pkg/health"
	pkglogger "github.com/reina0721/clouddrive/pkg/logger"
)

const (
	ID         app.ID = "execution"
	ConfigPath        = "execution"
)

// Driver 表示 Execution backend 的明确选择。
type Driver string

const (
	// DriverDisabled 表示当前进程不启用后台任务执行能力。
	DriverDisabled Driver = "disabled"
	// DriverMemory 表示使用仅进程内可见的幂等与记录 backend。
	DriverMemory Driver = "memory"
)

const (
	defaultDriver           = DriverMemory
	defaultMaxAttempts      = 3
	defaultInitialDelayMs   = 50
	defaultMaxDelayMs       = 500
	defaultJitterFactor     = 0.2
	defaultAttemptTimeoutMs = 2000
	defaultTotalTimeoutMs   = 7000
)

// Config 是 Execution App 的 typed 配置契约。
type Config struct {
	Driver                Driver                  `mapstructure:"driver"`
	RetryMaxAttempts      int                     `mapstructure:"retryMaxAttempts"`
	RetryInitialDelayMs   int                     `mapstructure:"retryInitialDelayMs"`
	RetryMaxDelayMs       int                     `mapstructure:"retryMaxDelayMs"`
	RetryJitterFactor     float64                 `mapstructure:"retryJitterFactor"`
	RetryAttemptTimeoutMs int                     `mapstructure:"retryAttemptTimeoutMs"`
	RetryTotalTimeoutMs   int                     `mapstructure:"retryTotalTimeoutMs"`
	Policies              map[string]PolicyConfig `mapstructure:"policies"`
}

// PolicyConfig 是业务模块按需独立声明的执行策略。
type PolicyConfig struct {
	RetryMaxAttempts      int     `mapstructure:"retryMaxAttempts"`
	RetryInitialDelayMs   int     `mapstructure:"retryInitialDelayMs"`
	RetryMaxDelayMs       int     `mapstructure:"retryMaxDelayMs"`
	RetryJitterFactor     float64 `mapstructure:"retryJitterFactor"`
	RetryAttemptTimeoutMs int     `mapstructure:"retryAttemptTimeoutMs"`
	RetryTotalTimeoutMs   int     `mapstructure:"retryTotalTimeoutMs"`
}

// Access 是业务模块消费的稳定执行入口。
type Access interface {
	Execute(context.Context, pkgexecution.Execution) (pkgexecution.Result, error)
	Health() (health.Result, error)
}

type componentDeps struct {
	logger pkglogger.Logger
}

type resource struct {
	driver        Driver
	executor      pkgexecution.OperationExecutor
	defaultPolicy pkgexecution.RetryPolicy
	policies      map[string]pkgexecution.RetryPolicy
}

type access struct {
	delegate app.Lease[*resource]
}

// Definition 返回无安装副作用的 Execution 组件声明。
func Definition(logger app.Input[logging.Target]) (app.Definition[Access], error) {
	source, err := app.Configured(ConfigPath, decode, defaults{})
	if err != nil {
		return app.Definition[Access]{}, err
	}
	dependencies, err := app.DependencySet(func(values app.Values) (componentDeps, error) {
		target, err := app.Resolve(values, logger)
		if err != nil {
			return componentDeps{}, err
		}
		return componentDeps{logger: target.Logger()}, nil
	}, logger)
	if err != nil {
		return app.Definition[Access]{}, err
	}
	return app.ManagedConfigured(ID, source, dependencies, build, app.Leased(newAccess),
		app.KernelInstanceSwap, app.WithReady(ready))
}

func newAccess(delegate app.Lease[*resource]) (Access, error) {
	if delegate == nil {
		return nil, fmt.Errorf("execution lease is nil")
	}
	return &access{delegate: delegate}, nil
}

// Configuration 返回 execution 组件的配置节契约。
func Configuration() config.Binding {
	return config.Binding{CapabilityID: string(ID), ConfigPath: ConfigPath, Contract: defaults{},
		Validate: func(snapshot config.Snapshot) error { _, err := decode(snapshot); return err }}
}

// Health 只表达当前 backend 是否启用并已装配，不虚构外部依赖恢复状态。
func (a *access) Health() (health.Result, error) {
	var result health.Result
	err := a.delegate.Use(context.Background(), func(current *resource) error {
		if current == nil {
			return fmt.Errorf("execution instance is nil")
		}
		if current.driver == DriverDisabled || current.executor == nil {
			result = health.Result{Status: health.StatusFail, Message: "execution backend is disabled"}
			return nil
		}
		result = health.Result{Status: health.StatusPass, Message: "execution memory backend is ready"}
		return nil
	})
	return result, err
}

func (a *access) Execute(ctx context.Context, exec pkgexecution.Execution) (pkgexecution.Result, error) {
	if ctx == nil {
		return pkgexecution.Result{}, pkgexecution.ErrNilContext
	}
	var result pkgexecution.Result
	err := a.delegate.Use(ctx, func(current *resource) error {
		if current == nil {
			return fmt.Errorf("execution instance is nil")
		}
		if current.driver == DriverDisabled || current.executor == nil {
			return pkgexecution.WrapBackend(fmt.Errorf("execution backend is disabled"))
		}
		if err := current.applyPolicy(&exec); err != nil {
			return err
		}
		var err error
		result, err = current.executor.Execute(ctx, exec)
		return err
	})
	return result, err
}

func (r *resource) applyPolicy(exec *pkgexecution.Execution) error {
	if exec.PolicyName != "" {
		policy, ok := r.policies[exec.PolicyName]
		if !ok {
			return fmt.Errorf("unknown execution policy %q", exec.PolicyName)
		}
		exec.Policy = policy
		return nil
	}
	if exec.Policy.MaxAttempts == 0 {
		exec.Policy = r.defaultPolicy
	}
	return nil
}

func build(ctx context.Context, cfg Config, deps componentDeps) (*resource, error) {
	if ctx == nil {
		return nil, app.ErrNilContext
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	switch cfg.Driver {
	case DriverDisabled:
		return &resource{driver: DriverDisabled}, nil
	case DriverMemory:
		policies := make(map[string]pkgexecution.RetryPolicy, len(cfg.Policies))
		for name, policy := range cfg.Policies {
			policies[name] = retryPolicy(policy)
		}
		return &resource{
			driver: DriverMemory,
			executor: pkgexecution.NewExecutor(pkgexecution.NewMemoryStore(),
				pkgexecution.WithRetryObserver(logRetry(deps.logger))),
			defaultPolicy: retryPolicy(policyConfigOf(cfg)), policies: policies,
		}, nil
	default:
		return nil, fmt.Errorf("unsupported execution driver %q", cfg.Driver)
	}
}

func policyConfigOf(cfg Config) PolicyConfig {
	return PolicyConfig{
		RetryMaxAttempts: cfg.RetryMaxAttempts, RetryInitialDelayMs: cfg.RetryInitialDelayMs,
		RetryMaxDelayMs: cfg.RetryMaxDelayMs, RetryJitterFactor: cfg.RetryJitterFactor,
		RetryAttemptTimeoutMs: cfg.RetryAttemptTimeoutMs, RetryTotalTimeoutMs: cfg.RetryTotalTimeoutMs,
	}
}

func retryPolicy(cfg PolicyConfig) pkgexecution.RetryPolicy {
	return pkgexecution.RetryPolicy{
		MaxAttempts: cfg.RetryMaxAttempts, InitialDelay: time.Duration(cfg.RetryInitialDelayMs) * time.Millisecond,
		MaxDelay: time.Duration(cfg.RetryMaxDelayMs) * time.Millisecond, JitterFactor: cfg.RetryJitterFactor,
		AttemptTimeout: time.Duration(cfg.RetryAttemptTimeoutMs) * time.Millisecond,
		TotalTimeout:   time.Duration(cfg.RetryTotalTimeoutMs) * time.Millisecond,
	}
}

func logRetry(logger pkglogger.Logger) pkgexecution.RetryObserver {
	if logger == nil {
		return nil
	}
	return func(event pkgexecution.RetryEvent) {
		logger.Debug("execution retry scheduled",
			pkglogger.String("owner", "execution"), pkglogger.String("phase", "retry"),
			pkglogger.Int("attempt", event.Attempt), pkglogger.Duration("next_delay", event.NextDelay),
			pkglogger.String("error_code", string(event.ErrorCode)))
	}
}

func ready(ctx context.Context, current *resource) error {
	if ctx == nil {
		return app.ErrNilContext
	}
	if current == nil {
		return fmt.Errorf("execution instance is nil")
	}
	return nil
}

func decode(snapshot config.Snapshot) (Config, error) {
	cfg := defaultConfig()
	if err := snapshot.DecodeSection(ConfigPath, &cfg); err != nil {
		return Config{}, err
	}
	cfg.Driver = Driver(strings.ToLower(strings.TrimSpace(string(cfg.Driver))))
	switch cfg.Driver {
	case DriverDisabled, DriverMemory:
	default:
		return Config{}, fmt.Errorf("unsupported execution driver %q", cfg.Driver)
	}
	if err := validatePolicy("default", policyConfigOf(cfg)); err != nil {
		return Config{}, err
	}
	for name, policy := range cfg.Policies {
		if strings.TrimSpace(name) == "" {
			return Config{}, fmt.Errorf("execution policy name must be non-empty")
		}
		if err := validatePolicy(name, policy); err != nil {
			return Config{}, err
		}
		if name == pkgexecution.PersistentTaskPolicyName && policy != persistentTaskPolicy() {
			return Config{}, fmt.Errorf("execution policy %q delegates timing and retry to its operation", name)
		}
	}
	return cfg, nil
}

func validatePolicy(name string, policy PolicyConfig) error {
	if policy.RetryMaxAttempts < 0 || policy.RetryInitialDelayMs < 0 || policy.RetryMaxDelayMs < 0 ||
		policy.RetryAttemptTimeoutMs < 0 || policy.RetryTotalTimeoutMs < 0 {
		return fmt.Errorf("execution policy %q values must be non-negative", name)
	}
	if policy.RetryJitterFactor < 0 || policy.RetryJitterFactor > 1 {
		return fmt.Errorf("execution policy %q jitter factor must be between 0 and 1", name)
	}
	if policy.RetryMaxAttempts > 1 && policy.RetryInitialDelayMs <= 0 {
		return fmt.Errorf("execution policy %q initial delay must be positive when max attempts exceeds one", name)
	}
	if policy.RetryMaxDelayMs > 0 && policy.RetryMaxDelayMs < policy.RetryInitialDelayMs {
		return fmt.Errorf("execution policy %q max delay must not be less than initial delay", name)
	}
	if policy.RetryAttemptTimeoutMs > 0 && policy.RetryTotalTimeoutMs > 0 &&
		policy.RetryTotalTimeoutMs < policy.RetryAttemptTimeoutMs {
		return fmt.Errorf("execution policy %q total timeout must not be less than attempt timeout", name)
	}
	return nil
}

type defaults struct{}

func (defaults) Defaults(ctx context.Context) (config.Object, config.Control, error) {
	if ctx == nil {
		return nil, config.Continue, app.ErrNilContext
	}
	cfg := defaultConfig()
	fields, err := policyFields(policyConfigOf(cfg))
	if err != nil {
		return nil, config.Continue, err
	}
	fields = append([]config.Field{config.FieldOf("driver", config.String(string(cfg.Driver)))}, fields...)
	if len(cfg.Policies) > 0 {
		names := make([]string, 0, len(cfg.Policies))
		for name := range cfg.Policies {
			names = append(names, name)
		}
		sort.Strings(names)
		items := make([]config.Field, 0, len(names))
		for _, name := range names {
			policy, err := policyFields(cfg.Policies[name])
			if err != nil {
				return nil, config.Continue, err
			}
			items = append(items, config.FieldOf(name, config.ObjectValue(config.Object(policy))))
		}
		fields = append(fields, config.FieldOf("policies", config.ObjectValue(config.Object(items))))
	}
	return config.Object(fields), config.Continue, nil
}

func policyFields(policy PolicyConfig) ([]config.Field, error) {
	values := []struct{ key, value string }{
		{"retryMaxAttempts", fmt.Sprint(policy.RetryMaxAttempts)},
		{"retryInitialDelayMs", fmt.Sprint(policy.RetryInitialDelayMs)},
		{"retryMaxDelayMs", fmt.Sprint(policy.RetryMaxDelayMs)},
		{"retryJitterFactor", fmt.Sprint(policy.RetryJitterFactor)},
		{"retryAttemptTimeoutMs", fmt.Sprint(policy.RetryAttemptTimeoutMs)},
		{"retryTotalTimeoutMs", fmt.Sprint(policy.RetryTotalTimeoutMs)},
	}
	fields := make([]config.Field, 0, len(values))
	for _, value := range values {
		number, err := config.Number(value.value)
		if err != nil {
			return nil, err
		}
		fields = append(fields, config.FieldOf(value.key, number))
	}
	return fields, nil
}

func defaultConfig() Config {
	return Config{
		Driver: defaultDriver, RetryMaxAttempts: defaultMaxAttempts,
		RetryInitialDelayMs: defaultInitialDelayMs, RetryMaxDelayMs: defaultMaxDelayMs,
		RetryJitterFactor: defaultJitterFactor, RetryAttemptTimeoutMs: defaultAttemptTimeoutMs,
		RetryTotalTimeoutMs: defaultTotalTimeoutMs,
		Policies:            map[string]PolicyConfig{pkgexecution.PersistentTaskPolicyName: persistentTaskPolicy()},
	}
}

func persistentTaskPolicy() PolicyConfig { return PolicyConfig{RetryMaxAttempts: 1} }

var _ Access = (*access)(nil)
var _ config.DefaultContract = defaults{}
