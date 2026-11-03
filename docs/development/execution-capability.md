# 业务模块接入 execution 能力

> 本文是应用模块接入 `execution` 的唯一现行入口。实现以 `pkg/execution`、`internal/kernel/app/execution`、composition 与实际业务调用方为准。

## 1. 消费边界

业务模块不直接构造 backend，也不读取 `Capabilities` 全集。模块在使用侧定义窄 port，由 composition 以 `pkg/execution.OperationExecutor` 适配并注入：

```go
type OperationExecutor interface {
    Execute(ctx context.Context, exec Execution) (Result, error)
}
```

## 2. 执行契约

```go
type Execution struct {
    Key          Key
    Policy       RetryPolicy
    LeaseTTL     time.Duration
    RetentionTTL time.Duration
    Trigger      string
    Operation    Operation
    PolicyName   string
}

type RetryPolicy struct {
    MaxAttempts    int
    InitialDelay   time.Duration
    MaxDelay       time.Duration
    JitterFactor   float64
    AttemptTimeout time.Duration
    TotalTimeout   time.Duration
}
```

- 同 `Key` 已完成时返回 `Duplicate=true`，不再执行 Operation。
- `fault.Retryable` 决定错误是否可重试；只有 attempts 确实耗尽才返回 `ErrRetryExhausted`。
- caller cancellation/deadline 与不可重试错误保留原原因链。
- `LeaseTTL` 约束 running 占用；`RetentionTTL` 从成功完成时起约束去重窗口。
- `Record.Attempts` 记录实际调用次数；执行记录与幂等状态同步写入 Store。

## 3. 命名策略

```yaml
execution:
  driver: memory
  policies:
    todo:
      retryMaxAttempts: 3
      retryInitialDelayMs: 50
      retryMaxDelayMs: 500
      retryJitterFactor: 0.2
      retryAttemptTimeoutMs: 2000
      retryTotalTimeoutMs: 7000
```

`PolicyName` 未知会直接失败，不静默回退。`MaxAttempts=1` 表示只执行一次；超过一次时 initial delay 必须为正。total timeout 同时约束所有 attempts 与等待时间，不能小于单次 timeout。

## 4. 业务使用

```go
res, err := executor.Execute(ctx, pkgexecution.Execution{
    Key:        pkgexecution.Key("todo:complete:" + command.ID),
    PolicyName: "todo",
    Operation: func(ctx context.Context) (any, error) {
        return s.repository.Save(ctx, todo)
    },
})
```

消息 consumer 明确使用单次 attempt，让 broker redelivery 保持唯一 delivery retry owner；Scheduler 的协调重试也不并入 Execution attempts，避免 N×M 放大。

## 5. 观测与真实边界

- `Access.Health()` 只报告 memory backend 是否 enabled/ready。
- 每次实际重试通过注入 Logger 输出 Debug，字段仅为 `owner`、`phase`、`attempt`、`next_delay` 与稳定错误码。
- memory backend 只提供单实例幂等，不是外部主存储、恢复系统或分布式一致性能力。
- durable Store、降级写、回放、异步 record pipeline 与 circuit breaker 均未实现；出现真实资源和 SLO 后重新研究。

相关入口：`pkg/execution` 契约、`internal/kernel/app/execution` 组件、`internal/kernel/composition` 装配，以及 Todo/Schedule/Messaging 真实调用方。
