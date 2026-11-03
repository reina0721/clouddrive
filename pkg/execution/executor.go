package execution

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/cenkalti/backoff/v7"
	"github.com/reina0721/clouddrive/pkg/concurrency"
	"github.com/reina0721/clouddrive/pkg/fault"
)

// executor 组合幂等占用、失败重试与执行记录，输出稳定 OperationExecutor 契约。
type executor struct {
	store         Store
	sf            concurrency.SingleFlight
	now           func() time.Time
	retryObserver RetryObserver
}

// RetryEvent 描述一次失败后即将发生的重试，只包含受控诊断字段。
type RetryEvent struct {
	Attempt   int
	NextDelay time.Duration
	ErrorCode fault.Code
}

// RetryObserver 在重试等待前接收低敏事件；不得在回调中执行阻塞工作。
type RetryObserver func(RetryEvent)

// Option 配置 executor 的包内扩展点。
type Option func(*executor)

// WithRetryObserver 注入重试观测回调。nil 表示不观测。
func WithRetryObserver(observer RetryObserver) Option {
	return func(target *executor) { target.retryObserver = observer }
}

var _ OperationExecutor = (*executor)(nil)

// NewExecutor 返回基于给定 Store 的操作执行器（默认 Store 供测试用 MemoryStore）。
func NewExecutor(store Store, options ...Option) OperationExecutor {
	target := &executor{store: store, now: time.Now}
	for _, option := range options {
		if option != nil {
			option(target)
		}
	}
	return target
}

// Execute 执行一次受幂等 / 重试 / 执行记录托管的操作。
func (e *executor) Execute(ctx context.Context, exec Execution) (Result, error) {
	if ctx == nil {
		return Result{}, ErrNilContext
	}
	if err := validateExecution(exec); err != nil {
		return Result{}, err
	}
	// 幂等：已完成则直接返回重复，不再执行。
	done, err := e.store.IsCompleted(ctx, exec.Key)
	if err != nil {
		return Result{}, WrapBackend(err)
	}
	if done {
		return Result{Status: StatusCompleted, Duplicate: true}, nil
	}
	// 同进程同 key 并发合并：仅一个 goroutine 执行，其余复用结果。
	value, err, _ := e.sf.Do(string(exec.Key), func() (any, error) {
		return e.run(ctx, exec)
	})
	if err != nil {
		if res, ok := value.(Result); ok {
			return res, err
		}
		return Result{}, err
	}
	res, _ := value.(Result)
	return res, nil
}

// run 在占用保护下执行操作：占用 -> 带策略重试 -> 成功/失败记录。
func (e *executor) run(ctx context.Context, exec Execution) (any, error) {
	now := e.now()
	claimed, err := e.store.Claim(ctx, exec.Key, exec.LeaseTTL, now)
	if err != nil {
		return Result{}, WrapBackend(err)
	}
	if !claimed {
		return Result{Status: StatusRunning}, ErrAlreadyRunning
	}
	started := e.now()
	runErr, attempts := e.executeWithRetry(ctx, exec)

	rec := Record{
		Key: exec.Key, Status: StatusFailed,
		Trigger: exec.Trigger, Trace: TraceFrom(ctx),
		Duration: e.now().Sub(started), Attempts: attempts, CreatedAt: e.now(),
	}
	if runErr == nil {
		rec.Status = StatusCompleted
		if err := e.store.Complete(ctx, exec.Key, exec.RetentionTTL, rec); err != nil {
			return Result{Status: StatusCompleted}, WrapBackend(err)
		}
		return Result{Status: StatusCompleted}, nil
	}
	rec.Error = runErr.Error()
	releaseErr := e.store.Release(ctx, exec.Key)
	recordErr := e.store.Record(ctx, exec.Key, rec)
	return Result{Status: StatusFailed}, errors.Join(
		runErr,
		WrapBackend(releaseErr),
		WrapBackend(recordErr),
	)
}

func (e *executor) executeWithRetry(ctx context.Context, exec Execution) (error, int) {
	policy := normalizedRetryPolicy(exec.Policy)
	retryCtx := ctx
	cancel := func() {}
	if policy.TotalTimeout > 0 {
		retryCtx, cancel = context.WithTimeout(ctx, policy.TotalTimeout)
	}
	defer cancel()

	attempts := 0
	operation := func() (struct{}, error) {
		attempts++
		attemptCtx := retryCtx
		attemptCancel := func() {}
		if policy.AttemptTimeout > 0 {
			attemptCtx, attemptCancel = context.WithTimeout(retryCtx, policy.AttemptTimeout)
		}
		defer attemptCancel()
		_, err := exec.Operation(attemptCtx)
		if err != nil && !fault.Retryable(err) {
			return struct{}{}, backoff.Permanent(err)
		}
		return struct{}{}, err
	}

	engine := backoff.NewExponentialBackOff()
	engine.InitialInterval = policy.InitialDelay
	engine.MaxInterval = policy.MaxDelay
	engine.RandomizationFactor = policy.JitterFactor
	engine.Multiplier = 2
	options := []backoff.RetryOption{
		backoff.WithBackOff(engine),
		backoff.WithMaxTries(uint(policy.MaxAttempts)),
		backoff.WithMaxElapsedTime(0),
	}
	if e.retryObserver != nil {
		options = append(options, backoff.WithNotify(func(err error, next time.Duration) {
			e.retryObserver(RetryEvent{Attempt: attempts, NextDelay: next, ErrorCode: fault.CodeOf(err)})
		}))
	}
	_, err := backoff.Retry(retryCtx, operation, options...)
	return classifyRetryError(err), attempts
}

func normalizedRetryPolicy(policy RetryPolicy) RetryPolicy {
	if policy.MaxAttempts == 0 {
		policy.MaxAttempts = 1
	}
	if policy.InitialDelay == 0 {
		policy.InitialDelay = time.Millisecond
	}
	if policy.MaxDelay == 0 {
		policy.MaxDelay = policy.InitialDelay
	}
	return policy
}

func classifyRetryError(err error) error {
	if err == nil {
		return nil
	}
	retryErr := backoff.AsRetryError(err)
	if retryErr == nil {
		return err
	}
	switch {
	case errors.Is(retryErr.Cause, backoff.ErrPermanent):
		return retryErr.LastErr
	case errors.Is(retryErr.Cause, backoff.ErrExhausted):
		return WrapRetryExhausted(retryErr.LastErr)
	case errors.Is(retryErr.Cause, context.Canceled), errors.Is(retryErr.Cause, context.DeadlineExceeded):
		return errors.Join(retryErr.Cause, retryErr.LastErr)
	default:
		return errors.Join(retryErr.Cause, retryErr.LastErr)
	}
}

func validateExecution(exec Execution) error {
	if exec.Key == "" {
		return ErrEmptyKey
	}
	if exec.Operation == nil {
		return ErrNilOperation
	}
	if exec.LeaseTTL < 0 {
		return fmt.Errorf("execution: lease ttl must be non-negative")
	}
	if exec.RetentionTTL < 0 {
		return fmt.Errorf("execution: retention ttl must be non-negative")
	}
	policy := exec.Policy
	if policy.MaxAttempts < 0 || policy.InitialDelay < 0 || policy.MaxDelay < 0 ||
		policy.AttemptTimeout < 0 || policy.TotalTimeout < 0 {
		return fmt.Errorf("execution: retry policy values must be non-negative")
	}
	if policy.JitterFactor < 0 || policy.JitterFactor > 1 {
		return fmt.Errorf("execution: retry jitter factor must be between 0 and 1")
	}
	if policy.MaxAttempts > 1 && policy.InitialDelay <= 0 {
		return fmt.Errorf("execution: retry initial delay must be positive when max attempts exceeds one")
	}
	if policy.MaxDelay > 0 && policy.MaxDelay < policy.InitialDelay {
		return fmt.Errorf("execution: retry max delay must not be less than initial delay")
	}
	if policy.AttemptTimeout > 0 && policy.TotalTimeout > 0 && policy.TotalTimeout < policy.AttemptTimeout {
		return fmt.Errorf("execution: total timeout must not be less than attempt timeout")
	}
	return nil
}
