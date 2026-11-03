# R005 HTTP 入口速率与过载保护边界复核

## 研究问题与范围

本记录追踪 production HTTP 请求实际经过的 token bucket、in-flight 门禁、配置绑定和 Application Generation 构造路径，并核验 `golang.org/x/time/rate` 与 `golang.org/x/sync/semaphore` 是否带来真实收益。

本研究只回答单进程入口保护。按 Principal、IP、Operation、租户或业务对象计数的 quota，登录防爆破、跨副本一致限流、网关/CDN 防护，以及出站 retry/circuit breaker 都有不同身份、存储、失败和观测边界，不得并入 `LIMIT-057-001`。

## 当前代码事实

### 1. token bucket 是自研通用算法

`pkg/httpx/production_middleware.go` 的 `RateLimiter` 自行维护 mutex、浮点 token、capacity、refill rate 与 last-refill 时间。它没有后台 goroutine，耗尽时立即返回 `429 rate_limited` 与固定 `Retry-After: 1`，不等待或排队。

当前算法有四个具体问题：

- Go 官方扩展库已有并发安全、生产广泛使用的 token bucket，实现重复；
- 构造函数把非正速率静默改成 `1`，把非正 burst 静默改成速率，直接使用公开构造入口时会掩盖配置错误；
- 错误消息写成 `request quota exceeded`，但它没有 Principal、IP、route 或跨副本计数，实际只是当前进程的整体入口速率保护；
- 测试只覆盖“首个通过、第二个 429”，没有直接证明 refill、并发安全、显式禁用和配置边界。

RFC 6585 允许服务端自行选择计数范围，429 可以携带 `Retry-After`，因此状态码和 header 可以保留；需要修正的是项目对该策略的命名和能力声明，而不是把 429 改成业务 quota。

### 2. in-flight 门禁是简单且有价值的项目策略

`OverloadLimiter` 使用容量为 `maxInFlight` 的 channel，非阻塞获取失败时立即返回 `503 server_overloaded`，请求完成后 defer 释放。它没有 goroutine、等待队列或资源关闭责任，当前测试已证明第二个并发请求不会排队。

`golang.org/x/sync/semaphore` v0.22.0 提供 weighted semaphore、可取消的阻塞 `Acquire` 与非阻塞 `TryAcquire`。但当前 HTTP 策略每个请求权重固定为一，目标恰是 fail-fast 而非排队；用 `TryAcquire(1)` 替换 channel 只会增加类型和依赖耦合，不会删除项目策略或改善正确性。项目已经因 `errgroup`/`singleflight` 直接依赖 `x/sync`，也不能据此机械使用其所有子包。

结论是保留 channel semaphore，并补齐构造输入和并发释放测试；“成熟方案优先”不等于把清晰的三行同步原语换成第三方类型。

### 3. production 保护对象和 middleware 顺序

`internal/composition/service.go` 在 application Router 上依次安装可信代理、安全头、upgrade 拒绝、请求 deadline、body limit、Accept、CORS、RateLimiter 与 OverloadLimiter。结果是：

- limiter 覆盖 WebUI manifest 和全部 public API route，但不覆盖独立 management listener；
- 合法的跨域 OPTIONS preflight 会由 CORS 在 limiter 之前直接完成，不消耗 token；
- authentication 和 OperationGate 位于后续业务 route，因此 limiter 看不到 Principal，也不能表达登录、用户、权限或对象级 quota；
- 速率门禁在并发门禁之前，拒绝的 429 不占用 in-flight slot。

这是一项单进程、全 application entry 的粗粒度 load-shedding policy，不是安全边界或公平性保证。未来主体/路由 quota 必须另建项目策略契约，并根据部署选择 gateway 或共享计数实现。

### 4. 配置存在真实歧义

`RateLimitConfig` 只有 `requestsPerSecond` 和 `burst`。校验允许两者同时为零，但 `resolveServerConfig` 从 `100/200` 默认值开始，只在速率大于零时覆盖，因此 `0/0` 实际恢复默认值而不是关闭。公开语义既没有显式 enabled/mode，也没有说明零值是“使用默认”还是“禁用”。

`100/200` 与 `maxInFlight=128` 都来自仓库初始落地，没有 benchmark、容量模型或 SLO 证据。不能把它们描述为生产容量结论。为避免在没有负载证据时削弱现有防御，本任务保留这些默认起点，但必须：

- 增加有类型的 `local` / `disabled` 模式，缺省仍为 `local`；
- `local` 模式要求速率和 burst 为正，禁止构造函数静默修正；
- `disabled` 模式不安装 token bucket middleware；速率值不生效，并在示例配置中说明；
- 明确默认值只是 scaffold 起点，部署方必须依据真实容量、SLO 和入口网关校准。

这会改变公共配置契约，属于材料性计划修订，必须在实施前重新确认。

### 5. limiter 随 Application Generation 重建

`internal/composition/generation.go` 每次有任意受管配置节变化并构造候选 Generation 时都会调用 `applicationRouter`，从而创建新的满 bucket 和空 in-flight channel。配置完全未变化时 coordinator 不构造候选，因此不会无故重置。

把 limiter 提升为进程稳定共享资源会引入跨 Router handoff、配置原子更新和旧请求归还 slot 的额外状态；当前 limiter 没有外部资源，也没有证据证明 reload 窗口中的一次 burst 重置值得这些复杂度。因此本任务明确接受 generation-local 状态：

- 新 Generation 从新 policy 的完整容量开始；
- 旧 Generation 在 drain 期间持有并释放自己的 in-flight slot；
- 不为复用 token 状态建立 pool、Adapter 或兼容层；
- Application Generation 范围是否整体过大仍由 `ARCH-057-001` 处理，不在 LIMIT 任务局部修补。

## 官方候选核验

### `golang.org/x/time/rate`

截至 2026-08-22，官方 module 最新为 v0.15.0，发布于 2026-02-11，BSD-3-Clause，声明 Go 1.25，兼容当前 Go 1.26.6 项目。官方文档明确：

- `Limiter` 是并发安全的 token bucket，初始为满 burst；
- `Allow`/`AllowN` 用于超限时 drop/skip，正好匹配当前 fail-fast HTTP 语义；
- `Reserve`/`Wait` 会预留或阻塞，不适合当前入口门禁；
- 第三方 `Limiter` 类型无需暴露到业务、模块或配置，只放在 `pkg/httpx.RateLimiter` 薄实现内部。

Go 漏洞数据库 module index 当前没有 `golang.org/x/time` 或 `golang.org/x/sync` 条目。这只表示本次快照未发现已收录 module 漏洞，不替代确认实施时的 `govulncheck`。

### 分布式候选为何不在本任务选择

当前没有跨副本一致性目标、主体 key、窗口算法、失败时 fail-open/fail-closed 决策、共享存储预算或网关部署事实。此时罗列 Redis script、sidecar 或集中 rate-limit service 并选一个，会把不存在的业务 quota 伪装成架构需求。触发上述需求后应单独比较 gateway 原生能力与 Redis/集中服务，并保留项目拥有的身份、policy、错误和观测契约。

## 决策

| 项目 | 决策 | 理由与边界 |
| --- | --- | --- |
| 自研 token bucket 数学与锁 | 替换 | `x/time/rate v0.15.0` 已覆盖并发安全 token bucket 与 fail-fast `Allow` |
| `pkg/httpx.RateLimiter` | 保留为薄边界 | 隔离第三方类型并拥有 HTTP 429、Problem、Retry-After 和配置错误语义；不复制完整第三方 API |
| `OverloadLimiter` channel | 保留 | 固定权重、非阻塞 503 的语义清晰；换 `x/sync/semaphore` 没有可验证收益 |
| RateLimit 配置 | 修订 | 增加 `local/disabled` 显式模式，消除 0/0 回落默认值歧义；默认数值保留为待校准 scaffold 起点 |
| limiter 生命周期 | 保持 generation-local | 无外部资源，跨代共享会增加不必要 handoff 状态；新代从新 policy 起点开始 |
| 分布式/主体 quota | 不选型 | 当前缺少身份、部署、一致性和失败语义；另立研究与任务 |

## 修订后的实施与验证边界

`LIMIT-057-001` 只允许：

1. 引入 `golang.org/x/time v0.15.0`，让项目 RateLimiter 内部使用 `rate.NewLimiter` 与 fail-fast `Allow`；
2. 单轨删除自研 mutex/token/refill 字段和算法，不保留旧实现或 fallback；
3. 增加并严格校验 `local/disabled` 配置模式，修正 `quota` 措辞并更新示例/当前文档；
4. 保留并加强 channel-based OverloadLimiter，不改成排队或 weighted bulkhead；
5. 验证 mode、错误输入、burst/refill、并发、取消、429/503、Retry-After、CORS preflight、management 排除和 Generation 重建语义；
6. 运行完整 test、race、vet、依赖、文档与 `govulncheck` 门禁。

任务不允许顺带增加 IP/Principal/route limiter、Redis 计数、网关部署、failsafe-go、出站 breaker 或 Application Generation 重构。

## 局限与刷新条件

- 没有生产流量、延迟分布、资源饱和点或 SLO，因此不能证明 `100/200/128` 是正确生产值；实施只保留现状并明确校准责任。
- 没有多副本运行证据，不能从本地测试推导集群公平性或全局上限。
- `x/time` 仍为 v0 module；其 Go team 维护、广泛采用和小 API 面支持当前选择，但实施前仍需刷新版本、Go 要求、许可证与安全记录。
- 若公共配置字段、错误协议、middleware 顺序或 Generation 生命周期在实施前变化，必须刷新本记录并重新确认。
