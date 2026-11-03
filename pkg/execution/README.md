# execution

`pkg/execution` 定义幂等、失败重试和同步执行记录的项目自有契约。业务模块只依赖 `OperationExecutor`、`Execution`、`RetryPolicy`、`Key`、`Result` 与 `Record`；`cenkalti/backoff/v7` 只在包内承担退避循环，不进入业务契约。

## 推荐入口

- 业务接入流程见[业务模块接入 execution 能力](../../docs/development/execution-capability.md)。
- Kernel App 装配形态见[Kernel App 组件开发](../../internal/kernel/app/README.md)。
- 配置节 ownership 见[配置说明](../../docs/configuration/README.md)。

## 基础使用

```go
result, err := executor.Execute(ctx, execution.Execution{
	Key:       execution.Key("todo.cleanup:2026-08-22"),
	Trigger:   "scheduler",
	LeaseTTL:  time.Minute,
	PolicyName: "todo",
	Operation: func(ctx context.Context) (any, error) {
		return nil, service.Cleanup(ctx)
	},
})
```

业务代码不要创建第二套 Store 或 Executor 绕过注入。通常以 `PolicyName` 引用 composition 解析的命名策略；直接构造 `RetryPolicy` 只适合明确拥有预算的技术边界。

## 策略与资源边界

- `RetryPolicy` 明确 `MaxAttempts`、initial/max delay、jitter、单次 attempt timeout 与 total timeout。
- `fault.Retryable` 是统一错误分类；业务不能通过任意回调让不可重试错误进入循环。
- `NewMemoryStore` 仅进程内可见，记录同步写入，不提供分布式幂等或耐久性保证。
- `WithRetryObserver` 只导出受控的 attempt、next delay 与错误码，不导出原始错误或业务参数。
- `WithTrace`/`TraceFrom` 只传递低敏 trace/span 标识。

本包没有恢复探测、local fail-open、异步记录队列或 circuit breaker。真实 durable Store、degraded write 或下游 breaker 必须先按实际 failure domain 独立设计。

## 错误语义

- `ErrEmptyKey`、`ErrNilOperation`、`ErrNilContext`：调用契约错误。
- `ErrAlreadyRunning`：同一 key 已有运行占用。
- `ErrRetryExhausted`：只有确实用完 `MaxAttempts` 时返回，并保留最后原因。
- 不可重试错误：直接保留原错误链，不错误标记为 exhausted。
- caller cancellation/deadline：保留 `context.Canceled` 或 `context.DeadlineExceeded`。
- `ErrBackend`：Store 操作失败并保留 backend 原因。

本包不定义 Outbox/Inbox、分布式锁、事务边界、数据库/Redis Store 或调度触发器。
