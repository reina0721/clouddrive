# 技术选型与架构复核基线

本文是项目选择、保留、升级或替换通用技术时的当前 authority。它要求同时审查具体实现和承载架构，不把现有代码、最小改动或“统一封装”当作当然正确的前提。当前代码事实与外部候选的完整快照见 [057 研究与计划](../changes/057-technology-and-architecture-reassessment/README.md)。

## 决策原则

1. 先定位实际定义、composition root、调用方、资源 owner、错误/安全语义和测试，再读取设计文档。
2. 把能力分类为标准库、成熟第三方、项目特有逻辑或自研通用机制；已有自研代码不自动获得保留优先级。
3. 对重要候选核对官方源码、release、维护状态、安全公告、许可证、Go 版本、生产适用范围和退出成本。
4. 同时比较实现适配和架构适配。若当前生命周期、装配或抽象迫使成熟方案增加无价值兼容层，优先研究承载架构本身。
5. 以可验证收益决定保留、升级、替换、自研、退役或重构；不为更新而更新，也不为解耦机械封装。
6. 安全修复、依赖升级、能力替换和架构重构分批交付。高优先级漏洞不得等待长期重构，PoC 结论不得直接冒充生产迁移授权。

## 抽象与接入边界

以下任一条件成立时，应建立项目自有窄契约或 Adapter：

- 第三方类型会进入业务 Service、Model 或跨模块公共契约；
- 项目需要统一错误、安全、超时、配置、资源关闭或诊断语义；
- 同一能力有多个实现，或替换概率和迁移成本都足够高；
- 共享连接、Client、listener 或后台任务必须由 composition/生命周期 owner 治理。

只在一个模块 Adapter 内使用、没有共享资源和稳定边界价值的库可以直接依赖。禁止把第三方 API 原样复制到项目接口，也禁止业务调用方自行构造第二套共享 Client。

## 当前能力决策矩阵

下表是 2026-08-22 的研究基线，不表示待实施项已经完成。版本、安全状态或真实需求变化时必须刷新。

| 能力 | 当前事实 | 当前结论 | 明确候选与项目内职责 |
| --- | --- | --- | --- |
| 日志 | `pkg/logger` 以窄接口封装 `zap v1.28.0`，composition 拥有 sink 与 Sync/Close | **保留**；没有证据证明迁移 `log/slog` 能抵消行为、性能和迁移成本 | 保持 `zap` 为实现；`log/slog` 只作为后续基准候选，不向业务暴露具体 logger 类型 |
| HTTP server/router | `net/http + chi v5.3.1`，项目拥有 server 生命周期与错误语义 | **保留** | `chi` 只承担路由；标准库承担 server/transport；项目边界继续拥有 Problem Details、超时和关闭语义 |
| HTTP Client | `pkg/httpx` 在 `net/http` 上自研请求、响应和隐式 transport/429/5xx 重试；当前无 production Client 构造 | **保留标准库核心，退役无依据的通用重试**；基础 Client 应 one-shot，不替下游猜测非幂等与 `Retry-After` 语义 | `net/http` 为 transport；`otelhttp` 承担标准观测。未来真实下游 Adapter 按 operation/profile 明确幂等、status/transport 分类、`Retry-After` 上限、budget 与观测，再决定是否使用 backoff/v7；不恢复全局 retry 开关 |
| HTTP 契约/OpenAPI | 原 `pkg/httpx/contract` 自研 typed DSL/renderer/codec 与重复 kin-openapi validation 已删除 | **采用 Huma v2，已全量迁移** | `Huma v2.39.1` 接管全部 31 个业务 operation 的 typed input/output、OpenAPI/JSON Schema、validation 与 chi registration；项目保留 OperationGate、Problem、operation/policy metadata、生成 inventory 和 server lifecycle。kin-openapi 仅作为 Huma 间接依赖；ogen 仅在未来改为 spec-first 时重评 |
| ORM/Repository | `GORM v1.31.2` 活跃；Todo、Navigation、IAM 与 Organization 均使用 direct GORM；反射式 generic Schema/Query/Repository、dynamic model 与旧 fixture 已删除；当前 production 查询没有 join/CTE/window | **保留 GORM resource/transaction；module concrete repository 已完成单轨替换** | GORM 类型只在 technology-specific session bridge 与 module repo Adapter；业务仍依赖模块 port，migration SQL 仍是 authority。当前查询不足以抵消 GORM Gen/sqlc 的生成与三方言成本，出现 SQL-heavy 用例后按查询重评 |
| Migration | 使用 `golang-migrate` 与模块自有 migration set | **保留** | `golang-migrate` 负责版本执行；模块拥有 SQL 与兼容语义，不使用 GORM AutoMigrate 替代发布 migration |
| Cache | 默认 L1、`patrickmn/go-cache`、本地 tag/cleanup 状态已退役；typed Client 无资源且 production 暂无消费者，Redis 是唯一数据与 tag authority | **保留 Redis 与项目缓存语义**；只有 `ErrNotFound` 作为 miss，取消、disabled、backend 与 codec 错误向上返回 | `go-redis/v9` 继续只存在于 Adapter，项目保留 typed key/tag/错误边界。真实消费者给出命中率、内存和陈旧预算后，高并发/weight 场景优先 PoC `Otter v2`，简单 TTL/容量场景 PoC `ttlcache v3` |
| JWT/JWK | Auth Adapter 使用最新 v3 线 `jwx/v3 v3.2.0`，显式治理 JWK 生命周期及 issuer/audience/algorithm；未知 key 并发刷新已全局合并，调用取消与刷新超时可识别 | **保留成熟 v3，安全强化已完成**；不为版本号把实验性构建约束扩散到全项目 | `jwx/v3` 继续拥有 JOSE/JWT/JWK 通用机制，项目 Adapter 拥有网络、claim、algorithm、取消、错误和 lifecycle；jsonv2 稳定或 v3 支持变化后再评 v4 + jwkfetch。真实 OIDC 用例出现时优先比较 `coreos/go-oidc/v3 + x/oauth2`，不自研 discovery/nonce/token 验证 |
| Password | IAM Adapter 使用 Go 官方 `x/crypto/argon2`；PHC 现已按编码参数校验，并在 Argon2 前限制版本、格式和资源预算 | **保留成熟密码学实现，演进边界已补齐**；不引入不能消除资源边界的小众 Wrapper | `x/crypto/argon2` 拥有 Argon2id；项目只拥有严格且有资源上限的 PHC 格式、目标 policy、verification result、恒时比较编排与成功登录事务内渐进重哈希，不自行实现密码学算法 |
| Permission/AuthZ | code-defined Permission Catalog + IAM typed 表存储 Core RBAC；`Casbin v3.10.0`（Apache-2.0，当前稳定版）只在 `internal/module/iam/adapter/casbin` 内执行固定两字段 Core RBAC 求值；Auth 只依赖消费方 `DecisionPoint` port，Principal 显式区分 `token-scopes`/`iam-rbac`；authorization revision 与不可变 snapshot 保证跨 Generation/并发 mutation fail closed | **采用 Casbin v3 作为 IAM 内 evaluator（058 已单轨实施）；IAM 继续是唯一业务与存储 authority** | Casbin model/policy 固定为 exact Core RBAC，不开 hierarchy/domain/deny/wildcard/ABAC/ReBAC/superuser；不使用 GORM Adapter、AutoLoad、Watcher 或 AI API。出现真实 domain/ABAC 语义时重新研究 model 与存储再决策；跨资源 ReBAC/集中决策继续比较 `OpenFGA`/OPA，不因 058 改变立场 |
| CORS/安全头/CSRF | CORS 已由 `rs/cors v1.11.1` 处理标准 header/Vary/preflight，Go `CrossOriginProtection` 加固 unsafe cross-site；IAM 仍有严格 Origin + Session CSRF token；安全头保留三项显式静态 policy | **成熟协议机制 + 项目 fail-closed policy；保留 IAM CSRF；拒绝 unrolled/secure** | 第三方与标准库实现隐藏在 `pkg/httpx.CORS`；项目保留 exact/default-deny、handler-not-called 与 Problem，不开放 wildcard/credentials/PNA。IAM token 不被替代。HSTS/CSP/COOP 需 TLS/asset authority，不在当前 API 默认猜测 |
| 限流/过载 | 单进程速率门禁已使用 `x/time/rate v0.15.0`；`local/disabled` 显式启停；并发门禁保留非阻塞 channel；两者随 Application Generation 重建 | **成熟 token bucket + 项目 HTTP/生命周期边界，保留简单过载实现** | 第三方类型仅在 `pkg/httpx.RateLimiter` 内并使用 fail-fast Allow；项目拥有 429/Problem/Retry-After 与严格配置。channel 503 保持 generation-local；默认值只是待负载校准的 scaffold 起点。主体或分布式 quota 另立网关/共享计数研究 |
| 重试/熔断 | Execution 已以项目自有 policy 隔离 `backoff/v7 v7.0.0`；HTTP Client one-shot；旧 `pkg/resilience`、无消费者 breaker、RecoveringStore/AsyncRecorder 已退役 | **当前边界已收敛，按真实 failure domain 扩展** | 项目保留命名 profile、幂等、错误分类、attempt/total budget 与低敏观测。`sony/gobreaker/v2` 只在真实共享下游出现后进入 Adapter；不引入当前范围过宽且 pre-v1 的 failsafe-go |
| 序列化 | 标准 `encoding/json`、官方稳定 `go.yaml.in/yaml/v3 v3.0.5`、cache 私有 `msgpack/v5`；零消费者自研 `pkg/codec` 已退役 | **保留标准 JSON 与稳定 YAML v3；各协议 owner 直接使用所需实现；cache wire format 独立决策** | v4 当前仅 RC，不进入 production direct dependency。项目不建立无消费者的统一 Codec；MessagePack 仅留在 cache 私有边界，其 wire 选择归 CACHE 任务，不机械换格式 |
| 配置 | 项目实现 strict source merge、stable file、provenance/digest、binding/default 与 candidate transaction；YAML、mapstructure、fsnotify 位于窄接缝 | **保留，不引入 koanf/Viper** | `mapstructure/v2` 继续 strict decode，`fsnotify` 继续通知，YAML 按 R004 走官方稳定 v3；koanf 仍需重写冲突、稳定读取、owner 与 reload，不能形成净删除。新增远程 provider 时按来源重评 |
| 定时调度 | `gocron/v2` 触发器 + 项目 schedule binding/execution/Redis lease | **保留** | `gocron/v2` 继续只在内部 Adapter；项目契约拥有任务身份、execution、准入、失权和诊断；耐久任务/工作流不是该能力，需按真实需求另评 `Temporal`、`River` 或 `Asynq` |
| Messaging | 官方 `amqp091-go` + 项目 message contract/binding/consumer lifecycle | **保留，等待真实 RabbitMQ 门禁** | RabbitMQ Adapter 继续隔离 broker 类型；Kafka/NATS 不在没有业务语义时预选 |
| Observability | OTel provider/exporter 与 Prometheus 保持隔离；手工 HTTP TraceContext/server span/status instrumentation 已删除 | **采用官方 otelhttp，保留项目资源与诊断边界，已实施** | `otelhttp v0.70.0` + OTel v1.45.0 负责 HTTP propagation/semantic conventions/span/status；项目保留 Generation lease、稳定 operation、Prometheus metrics、trace ID bridge、bounded processor 和 exporter lifecycle，并在交给标准 instrumentation 前把 URL 收敛为低基数 route template |
| 前端运行时与 UI | console-web 完整工作区 frontend/ | Next.js 16、React 19、HeroUI v3、Tailwind v4 | 保留 Surface/Host/Plugin 边界，详见 [前端指南](../development/webui.md) |
| 前端运行时与 UI | console-web 完整工作区 frontend/ | Next.js 16、React 19、HeroUI v3、Tailwind v4 | 保留 Surface/Host/Plugin 边界，详见 [前端指南](../development/webui.md) |

## 需要架构解决的问题

### 1. 恢复静态对象图与动态资源平面分工

Application Generation 原先会一起重建底层资源、业务模块、路由、Scheduler、Messaging、管理面和纯静态 catalog/contract。R011 已区分真正需要候选事务的运行态与无 reload 价值的代码声明，当前已完成首个 owner 修正切片。

后续仍必须以真实配置变化和可用性收益逐项证明热重载价值。当前边界是：

- permission、WebUI、operation policy 和 HTTP contract definitions 已进入启动期 immutable `applicationBlueprint`，所有 Generation 与 CLI 共享；
- 只有能定义候选构造、准入、排空、回滚和资源所有权的能力进入动态平面；
- 不适合并存或热换的能力明确 `RestartRequired`，不为“无感”叠加兼容状态机；
- runtime Service/Handler 当前仍依赖当代 config/resource 与跨模块 port，暂留 Generation；没有稳定 handle 证据前不引入 proxy、Fx 或反射 DI。

该目标已经形成 owner/reload 矩阵，最小 `applicationBlueprint` 切片已通过 identity 和多 section reload 测试；Generation 仍拥有 runtime module、资源、participant、compatibility 与 route handoff，不允许一次性重写 Kernel。

### 2. 把技术策略从通用 Client 中拆出

HTTP 重试、熔断、限流、缓存加载和执行恢复都涉及不同的幂等、失败分类、budget 与观测。它们不能因为都叫“韧性”就共享一个万能状态机。基础 HTTP Client 只负责单次可靠 transport 和资源边界；真实下游 Adapter 决定是否重试或熔断。Execution 的命名 profile 只治理受幂等/记录托管的业务 attempt，并在内部复用 backoff/v7。没有真实外部 primary 或 failure domain 时，恢复与 breaker 状态应退役而不是预先抽象。

### 3. 让模块拥有业务查询和授权语义

通用 Repository、通用权限引擎或通用 HTTP DSL 不应替模块决定业务查询、授权模型和 operation 语义。成熟工具负责 SQL/ORM、policy evaluation 或 OpenAPI/JSON Schema 的通用机制；模块 port、permission key、事务边界和业务错误仍由项目拥有。

## 实施门禁与顺序

1. **安全止血**：升级受公告影响的依赖，重建与 Go 1.26 匹配的扫描工具，运行 `govulncheck`、测试和契约负向门禁。
2. **低耦合替换**：默认 L1 已退役；后续迁移官方稳定 YAML v3 路径并删除无消费者 Codec；以 `x/time/rate` 单轨替换 token bucket、修正显式启停配置但保留 channel 过载门禁；保留 jwx/v3 与 x/crypto/argon2 并补认证安全/演进语义。未来 L1、YAML v4 与 JWX v4 必须由真实需求、稳定版本和量化门禁重新授权。
3. **策略层重构**：以 backoff/v7 收敛 Execution retry；HTTP Client 改为 one-shot；删除无消费者 breaker 和没有真实外部 primary 的恢复/异步状态机。未来下游 breaker 或组合策略按真实 failure domain 另立研究。
4. **HTTP 单轨迁移**：先以代表性 operation 验证 Huma + OperationGate + Problem + static generation，再迁移全部模块并删除旧 contract/codec/kin-openapi validation。
5. **浏览器安全与标准 instrumentation**：CORS 已以 rs/cors/CrossOriginProtection 单轨替换手工协议部分；Huma 全量迁移后已以 otelhttp 替换手工 HTTP span/propagation。
6. **Data 单轨边界**：已建立受租约约束的 GORM session bridge，全部 module repo 使用 concrete record + direct GORM，generic Schema/Query/Repository 已删除；架构门禁拒绝 GORM 向业务核心传播和 production AutoMigrate。
7. **架构切片**：启动期 `applicationBlueprint` 已移出纯 catalog/policy/contract；runtime graph 继续由 Generation 原子切换，后续 owner 调整必须另以真实收益研究。

每一步都是非文档变更，必须使用 057 的明确任务 ID，在计划报告后的后续消息中获得确认；新事实改变依赖、公共接口、迁移或生命周期边界时重新研究和确认。
