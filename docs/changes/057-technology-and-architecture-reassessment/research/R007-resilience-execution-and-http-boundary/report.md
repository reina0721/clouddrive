# R007 重试、执行恢复与 HTTP Client 策略边界复核

## 研究问题与方法

R001/R002 将 `failsafe-go` 列为组合韧性首选 PoC。本报告在任何 Batch C 源码实施前，从 Commit `1e9fd58bc49e67c8eb1eadca53cdeb22ca8bd884` 重新追踪 `pkg/resilience`、`pkg/httpx`、`pkg/execution`、Kernel App 装配、Todo/Schedule/Messaging 消费者、配置、错误与 goroutine owner，并刷新成熟候选的官方版本、维护、依赖和安全记录。

目标不是选功能最多的框架，而是回答三个问题：当前真实调用需要哪些策略；现有状态机是否有真实资源和 failure domain；成熟库应在哪个窄边界接入。RabbitMQ broker redelivery、Scheduler lease 协调和配置文件稳定读取各有独立协议 owner，不纳入统一 retry Wrapper。

## 当前代码事实

### 1. 通用 resilience 是自研算法，且 breaker 没有真实消费者

- `pkg/resilience` 自行实现固定倍增退避、`context.WithTimeout` 薄包装，以及只会由连续失败打开、只能手工 `Reset` 的 breaker。
- production 中只有 `pkg/execution` 使用 retry/timeout；breaker 没有非测试调用方。`pkg/resilience` README 声称 HTTP、数据库、缓存和对象存储都应复用它，但当前代码没有这些消费者。
- `pkg/execution.Execution.Policy` 直接暴露 `resilience.RetryPolicy`，使项目公共执行契约依赖一个实现包；`PolicyName` 与 Kernel config 才是现有真实稳定选择边界。
- 当前 `resilience.Do` 在没有 `Retryable` 时默认重试所有错误；execution 会补 `fault.Retryable`，但包本身的危险默认仍可被其它调用方误用。

### 2. HTTP Client 的隐式重试既无消费者，也缺少协议前提

- `pkg/httpx.standardClient` 对 transport error、429 和全部 5xx 按 `RetryCount` 自动重试，不区分 GET/PUT/DELETE 与 POST/PATCH，也不要求调用方声明业务幂等或 idempotency key。
- 它不解析 `Retry-After`，等待期间 caller cancellation 最终会被表现为上一次 transport/status error，而不是稳定保留取消原因。
- 除测试外，仓库没有 `pkg/httpx.NewClient` 调用方。Auth JWKS 使用 `jwx` 自有 client 接口与受控 `net/http.Client`，不消费该通用 Client。
- RFC 9110 §9.2.2 明确要求：非幂等方法只有在客户端知道其语义幂等，或能确认原请求未生效时，才应自动重试；`Retry-After` 又可能是 delta-seconds 或 HTTP-date。通用 status/method 猜测不能替代下游语义。

结论：当前不是给 HTTP Client 接一个更强 retry 框架，而是先删除无真实 profile 支撑的隐式重试。未来每个真实下游 Adapter 按 operation、幂等与 budget 声明策略；基础 Client 保持单次 transport。

### 3. Execution 的恢复/异步状态机没有真实外部主存储

- production 只支持 `memory/disabled`。`DriverMemory` 调用 `assemble` 时传入两个独立 `MemoryStore`，分别冒充 primary 与 local；没有 Database/Redis/durable Store Adapter。
- 正常 production memory Store 不会产生外部依赖故障，因此 `RecoveringStore` 的 Degraded/Recovering、探测、回放、抖动与缓冲逻辑只在故障注入测试中可达。默认应用仍为此常驻一个恢复 goroutine。
- `AsyncRecorder` 又为内存记录启动 worker 和队列；当前没有查询执行记录的 production consumer，也没有慢 I/O 能证明异步化收益。`OverflowDiscard` 满时返回成功，记录丢弃也没有对外 counter。
- 若未来幂等 authority 是持久化 Store，在主 Store 不可用时改用进程本地 Store 执行业务会改变一致性边界：不同副本可能同时接受同一 key。此类 fail-open 不能由通用恢复 Wrapper 预先决定。
- `Access.Health` 被 Messaging admission 使用，但当前 memory driver 实际只需要表达 enabled/ready；不存在可降级的外部 Execution backend。

结论：这不是选择哪一个 backoff 库的问题，而是承载架构建立在未来假设上。修订计划直接退役 `RecoveringStore`、`AsyncRecorder`、其配置、goroutine 和 Recovery API；保留 MemoryStore、幂等执行与同步内存记录。未来 durable Store 必须先定义跨副本 Claim、不可用时 fail-closed/degraded 策略、记录耐久性和 lifecycle，再单独研究。

## 成熟候选复核

| 候选 | 当前官方事实（2026-08-22） | 适配判断 |
| --- | --- | --- |
| `github.com/cenkalti/backoff/v7 v7.0.0` | 2026-06-30 发布，Go 1.23，MIT，无运行时依赖；项目长期维护且当前约 4k stars。v6/v7 新增 `RetryError{Cause, LastErr}`、`ErrPermanent`、`ErrExhausted`、`ErrMaxElapsedTime`、context 与带原因的 `RetryAfter` | **采用**于当前真实的 Execution retry loop。每次调用创建独立 `ExponentialBackOff`；显式设置 attempts、initial/max interval、jitter，并用 caller/profile context 作为总 budget；设置 `WithMaxElapsedTime(0)`，禁止库的隐藏 15 分钟默认成为项目策略 |
| `github.com/failsafe-go/failsafe-go v0.9.7` | 2026-08-16 发布，MIT、Go 1.21，覆盖 retry/breaker/bulkhead/timeout/hedge 等；维护活跃。仍为 pre-v1，官方 versioning 允许 minor 含不兼容 API；module 直接列出 gRPC、protobuf、tdigest、bitset 等当前无关依赖。v0.9.6/0.9.7 连续修复 child/per-request context 问题 | **本轮拒绝**。能力覆盖远大于当前需求，稳定与依赖成本不优于窄方案；不是对安全性的否定。真实场景同时需要组合 policy 且能证明收益时重新 PoC |
| `github.com/sony/gobreaker/v2 v2.4.0` | 2026-01-01 发布，Go 1.22，MIT，稳定 major；提供 closed/open/half-open、自动 timeout 恢复、rolling/fixed window、成功/排除分类和状态回调 | **条件候选，不引入**。库本身成熟，但当前没有出站 Client 消费者、共享下游资源 identity 或 breaker failure domain；先删除无消费者自研 breaker。真实下游出现时在其 Adapter 内按 endpoint/failure domain 持有共享 breaker |

`go mod why` 证明当前 `backoff/v5 v5.0.3` 只由 OTLP HTTP exporter 的内部 retry 间接引入。实施时直接采用 v7 会让 v5/v7 两个不同 major 同时存在于 module graph；这是上游内部实现与项目直接策略的独立 import path，不应为了“只留一个版本”退回旧 API。若 OpenTelemetry 后续迁移 major，按正常 dependency refresh 收敛，不把其内部 retry 暴露给项目。

OSV Go module 查询在核验日没有返回上述三个 module 的公开漏洞记录。该结果只证明查询时未命中，不等于库永远安全；实施后仍需运行项目 `govulncheck`，release、安全公告或依赖树变化会触发刷新。

## 修订后的目标边界

### Execution

- 项目拥有：`Execution`/`OperationExecutor`、幂等 key/Store、命名 profile、`fault.Retryable` 分类、attempt/total budget、错误映射与低敏观测。
- `backoff/v7` 拥有：指数退避、jitter、等待取消、最大 attempts 与 retry loop。
- third-party 类型不进入 `pkg/execution` 的公开契约；内部 Adapter 把 project policy 映射到每次调用独享的 BackOff。
- caller cancellation/deadline 原因完整保留；不可重试错误返回原错误链；只有实际耗尽 attempts 才附加 `ErrRetryExhausted`。

### HTTP Client

- `net/http` 继续拥有 transport 和连接池；`pkg/httpx` 保留受限 request/response/body/error 边界，但每次 `Do` 只发一次请求。
- 删除全局 `RetryCount/RetryWaitTime/RetryMaxWaitTime`。未来下游 Adapter 若需要重试，必须声明可重试 operation、幂等依据、status/transport 分类、`Retry-After` 上限、总 budget 和观测；不得重新加入“所有 Client 默认重试”。

### Circuit / bulkhead / recovery

- 删除无消费者自研 breaker，不引入 replacement。breaker 必须按真实下游 failure domain 共享，不能是每请求新建或全应用一个万能 breaker。
- HTTP 入口 channel overload limiter 由 R005 单独保留；它不是出站 bulkhead。
- `RecoveringStore`/`AsyncRecorder` 当前没有真实资源依据，直接退役而不是用成熟库包装。durable idempotency、degraded write 与 record pipeline 各自另立研究。
- RabbitMQ redelivery、连接恢复和 Scheduler coordination retry 保持各自协议 owner；不并入本任务，避免与进程内 Execution attempts 形成 N×M retry。

## 对 RESIL-057-001 的材料性修订

原计划“以 failsafe-go 为首选 PoC，统一 HTTP/execution 的 retry/timeout/circuit/bulkhead”被真实消费者与依赖证据推翻。修订任务改为单轨收敛：

1. 以 `cenkalti/backoff/v7 v7.0.0` 替换 Execution 自研 retry loop，第三方类型留在内部实现；新增项目自有 policy，明确 attempts、initial/max delay、jitter、attempt timeout 和 total timeout。
2. 删除 `pkg/resilience`，包括无消费者 breaker/timeout Wrapper；Messaging 的单次 attempt 改用项目 execution policy，不保留兼容 alias。
3. 删除 `pkg/httpx` 隐式 retry 配置和状态机，保留 one-shot Client；未来下游 profile 另立任务。
4. 删除没有真实外部 primary 的 `RecoveringStore`、`AsyncRecorder`、Recovery API/配置/诊断和 goroutine；Memory execution 直接同步使用 MemoryStore，Health 只表达 enabled/ready。
5. 同步 Todo、Schedule、Messaging、composition、配置样例、当前文档和旧符号搜索；以 cancellation、budget、错误分类、幂等、broker 单次 attempt、race 和完整质量门禁验证。

这改变依赖选择、公共 execution 字段、HTTP config 与 lifecycle，属于材料性计划修订。此前任何 Batch A 或其它任务确认都不覆盖它；必须等待用户明确确认“修订后的 `RESIL-057-001`”后才能实施。

## 实施结果（2026-08-22）

用户确认修订计划后，`RESIL-057-001` 已按上述边界单轨实施：`backoff/v7 v7.0.0` 只存在于 `pkg/execution` 内部，项目 policy、错误和观测契约不暴露第三方类型；基础 HTTP Client 对 transport/status failure 均 one-shot；旧 `pkg/resilience`、RecoveringStore、AsyncRecorder、Recovery API/配置与后台 goroutine已删除。Messaging 显式使用单次 attempt，把 redelivery 留给 broker owner。

全仓 test/race/vet/build、生成物 clean diff、文档门禁与漏洞扫描通过；artifact 门禁只被范围外两个既有 tracked `old-backend/**/app.db` 阻塞。该结果把本报告的目标结论更新为当前事实，但不扩大到 durable Store、真实出站下游或 breaker。

## 局限与刷新触发器

- 本研究没有引入真实外部 HTTP 服务、durable Execution Store 或多副本部署，因此不声称 breaker、分布式幂等或 degraded write 已验证。
- 当前 package adoption 数字只是生态信号，不是采用依据；核心采用理由是功能适配、错误语义、依赖面和可替换性。
- `backoff/v7`、failsafe-go、gobreaker release/安全状态变化，出现真实下游/durable Store，或 Execution delivery owner 改变时重新研究。
