# 057 设计

## 设计概要

本变更不选择“一套框架接管一切”，而是建立两层决策：先判断通用实现是否应复用成熟方案，再判断当前架构是否为合适载体。输出是可追踪矩阵和分批实施队列，不是技术名录。

依据：[R001 当前实现与架构事实](research/R001-current-capability-and-architecture-audit/report.md)、[R002 外部候选与安全事实](research/R002-mainstream-options-and-security/report.md)、[R003 L1 必要性与候选适配](research/R003-cache-l1-necessity-and-candidate-fit/report.md)、[R004 序列化与 YAML 稳定路径](research/R004-serde-runtime-boundary-and-yaml-path/report.md)、[R005 HTTP 入口速率与过载边界](research/R005-http-entry-rate-and-overload-boundary/report.md)、[R006 认证库与凭据边界](research/R006-authn-library-and-credential-boundary/report.md)、[R007 resilience、Execution 与 HTTP Client 边界](research/R007-resilience-execution-and-http-boundary/report.md)、[R008 配置与 koanf](research/R008-config-pipeline-and-koanf-fit/report.md)、[R009 HTTP 与 Huma](research/R009-http-contract-framework-fit/report.md)、[R010 Data/ORM](research/R010-data-repository-and-orm-boundary/report.md)、[R011 owner/reload 与 Blueprint](research/R011-owner-reload-and-static-blueprint/report.md)、[R012 浏览器 HTTP 安全](research/R012-browser-http-security-boundary/report.md)、[R013 HTTP Observability](research/R013-http-observability-instrumentation/report.md)。

## 决策流程

```text
真实用例与消费者
  -> 当前定义 / composition / owner / 失败语义
  -> 标准库 / 成熟第三方 / 项目特有 / 自研通用 分类
  -> 官方维护、版本、安全、兼容与生产范围核验
  -> 实现适配收益 + 承载架构适配收益
  -> 保留 / 升级 / 替换 / 合理自研 / 退役 / 架构重构
  -> PoC 或迁移任务 -> 单轨验证 -> 当前 authority 同步
```

## 职责边界

| 层次 | 项目拥有 | 第三方可以拥有 | 禁止泄漏 |
| --- | --- | --- | --- |
| 业务模块 | 用例、Model、Repository port、permission/operation key、事务和业务错误 | 模块 Adapter 内的局部实现细节 | ORM model、policy engine object、HTTP framework context 进入 Service/Model |
| 项目能力 | 窄契约、配置/错误/安全策略、命名 profile、低敏诊断 | cache/codec/retry/breaker/schema 等通用算法 | 原样复制第三方全量 API 的 Wrapper |
| composition | 实现选择、共享资源 owner、Start/Ready/Stop、静态/动态分类 | 具体 Client、connection、exporter、trigger | 业务调用方创建第二套共享资源或查询容器 |
| transport/tooling | route binding、生成、验证、协议呈现 | chi、kin-openapi、Huma/ogen 候选、标准 instrumentation | 模块为适配框架而失去 operation 语义 ownership |

## 承载架构目标

### 静态 Blueprint

纯代码定义且不读取 Snapshot、不持有资源和运行状态的 permission、WebUI、operation policy 与 HTTP contract definitions，由显式构造函数在启动期构建为 immutable `applicationBlueprint`。当前 Service/Handler 仍依赖当代资源、配置和跨模块 port，暂留 Generation；未来若要静态化，必须先证明稳定 access、配置策略和排空语义。

### 动态资源平面

只有共享连接、listener、Consumer、exporter 等能证明运行期换代收益，且具备资源 owner、候选验证、Replacement 与失败保留旧代语义的能力进入动态 Generation。

### 迁移方式

R011 已形成 capability/consumer/owner/reload 矩阵，首片固定为静态 Blueprint。保持公开行为不变，比较构造次数、reload 状态、停止顺序和故障恢复证据；通过后也不自动扩大到 Service，不引入 Fx/反射 DI。

## 实施批次

### Batch A：安全与基线恢复

- 升级 `kin-openapi` 到实施时经官方复核的安全版本，验证现有 code-first 生成和 request validation 负向场景。
- 使用 Go 1.26 构建/运行兼容的 `govulncheck`，建立全仓当前漏洞基线。

不等待 Huma PoC，不改变 HTTP authority。

### Batch B：低耦合升级与替换

- Cache：单轨退役当前无真实消费者、无容量上界且不能跨实例失效的默认 L1，删除 `patrickmn/go-cache`、本地 tag map、cleanup goroutine 与专属配置；保留 Redis typed cache/tag、序列化和 Kernel 共享资源 owner。
- Cache miss：`GetOrLoad`/`GetMany` 只有 `ErrNotFound` 可按 miss 处理，取消、disabled、backend 与 codec 错误必须完整返回。
- 不在本批引入另一 L1 库。未来真实消费者同时给出命中收益、内存 budget、陈旧预算和多实例一致性模型后，按高并发/weight 需求优先 PoC Otter v2，按简单 TTL/容量需求 PoC ttlcache v3。
- `CACHE-057-001` 实施结果：typed Client 已收敛为无资源的 Redis RemoteStore 编解码边界，`RemoteStore.Get` 不再为已删除 L1 返回 TTL，`InvalidateTags` 不再返回仅供本地失效的 key 列表；Redis client 的构造、关闭与 reload owner 仍归 Kernel Cache App。
- Serde：把全部项目直接 YAML import 从已归档 `gopkg.in/yaml.v3` 单轨迁移到官方稳定 `go.yaml.in/yaml/v3 v3.0.5`；v4 当前仍为 RC，不提升为 direct dependency。
- 删除零消费者 `pkg/codec`，不保留兼容包；标准 JSON 由协议 owner 直接使用，cache 私有 MessagePack wire format 不在本任务暗改。
- 用 config duplicate/strict/default golden、i18n fixture、OpenAPI generation golden、docs guard 和完整 Go 门禁验证；v4 stable 后另按格式、安全限制和可删除自研逻辑的实际收益评估。
- 限流：以 `golang.org/x/time/rate v0.15.0` 替换进程内 token bucket 数学与锁；项目薄边界继续拥有 fail-fast 429、Problem 与 Retry-After，不暴露第三方类型。
- 限流配置：增加有类型的 `local/disabled` 模式，缺省保持 `local`；`local` 必须使用正速率和 burst，构造不再静默修正错误。保留 `100/200` 作为现有 scaffold 起点并明确必须按负载/SLO 校准，不把它描述为生产容量保证。
- 过载：保留 channel-based 非阻塞 in-flight semaphore 与 503，不机械改用已有 `x/sync/semaphore`，也不变成等待队列或 weighted bulkhead。
- 生命周期：RateLimiter 与 OverloadLimiter 保持 generation-local；新代从新 policy 状态开始，旧代独立排空。不为跨代 token 复用新增 pool/handoff，整体 Generation 范围留给 Batch F。
- 范围排除：不在本任务增加 Principal/IP/Operation/租户维度、Redis/网关/集中计数、登录防爆破或分布式 quota。
- AuthN：保留 `jwx/v3` 和 `x/crypto/argon2` 两项成熟实现；修正 JWT 运行中取消传递并补安全负向矩阵。密码 port 使用项目 verification result + error，Adapter 在调用 Argon2 前完成受限 PHC 校验并返回 `NeedsRehash`，Service 在成功登录事务内迁移 hash。
- AuthN 不引入仍要求 `GOEXPERIMENT=jsonv2` 的 JWX v4，不引入高层 Argon2 Wrapper、OIDC 或新密码学实现。jsonv2 稳定或 v3 支持状态变化后再刷新选型。
- 浏览器安全：`SEC-057-002` 以 `rs/cors v1.11.1` 负责标准 CORS headers/Vary/preflight，以 Go `CrossOriginProtection` 负责 unsafe cross-site defense-in-depth；项目保留 exact allowlist、default deny、Problem 与 handler-not-called policy。
- IAM Session mutation 继续同时要求严格 Origin、已解析 Session 与 CSRF token；不允许全局 CORS/CSRF middleware 绕过模块 guard。
- 安全头保留项目三项显式 policy，不引入 `unrolled/secure`。HSTS/CSP/COOP 需要真实 TLS termination 与 WebUI asset authority，不在当前 API 默认猜测。

每个项目可以独立确认和回退，不做互相绑定的大提交。

### Batch C：策略层重构

R007 已证明当前没有真实出站 HTTP Client 消费者或 breaker failure domain，Execution 也没有外部 primary。Batch C 不再引入组合大框架，而按实际边界单轨收敛：

- `pkg/httpx` 删除 `RetryCount/RetryWaitTime/RetryMaxWaitTime` 和隐式 transport/status retry；基础 Client 每次只发送一次。未来真实下游 Adapter 自行声明幂等依据、`Retry-After`、错误分类、budget 和观测。
- `pkg/execution` 使用项目自有 retry policy；命名 profile 明确 max attempts、initial/max delay、jitter、attempt timeout 与 total timeout。内部以 `cenkalti/backoff/v7 v7.0.0` 承担 retry/backoff，每次调用创建独立实例，显式关闭库默认 15 分钟 elapsed budget，由 context 成为总 budget authority。
- 不可重试错误保留原错误链；caller cancellation/deadline 保留；只有实际 attempts 耗尽才附加 `ErrRetryExhausted`。第三方类型不进入业务、`Execution` 或 Kernel Access 契约。
- 删除 `pkg/resilience` 及无消费者 breaker；`sony/gobreaker/v2` 只在真实共享下游 failure domain 出现后按 Adapter 重新研究，不建立全局 breaker。
- 删除 `RecoveringStore`、`AsyncRecorder`、Recovery API/配置/diagnostics 和 goroutine。当前 MemoryStore 直接同步承载幂等与记录，Health 只表达 enabled/ready；未来 durable Store 先设计跨副本 Claim 与不可用时 fail-closed/degraded 语义。
- RabbitMQ broker redelivery/重连、Scheduler coordination retry、配置稳定读取和 HTTP 入口 overload 各自保留协议 owner，不并入通用策略层。

实施结果（2026-08-22）：本批已按上述设计完成，没有保留旧 API 或兼容层。Execution memory backend 不再拥有 shutdown finalizer；重试 observer 经既有 Logger 依赖输出受控 Debug 字段。忽略的本地 `config.yaml` 未被任务改写，现行配置迁移以 `config.example.yaml` 与配置 authority 为准。

### Batch D：HTTP 契约单轨迁移

R009 已完成候选比较并选择 Huma v2，不再把技术选型推迟到实施期：

1. `HTTP-057-001` 以公开 JSON body、受保护 path/query list、乐观锁 mutation 和统一 Problem 为代表性第一片。模块 binding 定义 typed input/output 与同点 registration；Huma metadata 携带项目 operation/security/policy，OperationGate 仍在 handler 前 fail-closed。
2. 第一片必须同时服务 runtime 和无资源 contract generation，验证 OpenAPI/inventory、tailing JSON、unknown/invalid parameter、content type/body budget、取消、认证/授权和低敏错误。
3. 第一片门禁通过后，`HTTP-057-002` 迁移所有 IAM/Organization/Navigation/Todo operation；删除旧 `pkg/httpx/contract`、dispatcher、手工 codec/renderer 和 kin-openapi request validation。若 kin-openapi 无直接消费者则删除依赖。
4. 第一片失败则单轨撤回 Huma，不保留 compatibility layer；失败结论需回到计划重新确认。

Huma 只进入 transport binding，Service/Model 不导入其类型；chi、项目 Problem、server/listener 和生产 middleware 不变。

HTTP 全量迁移后执行 `OBS-057-001`：引入官方 `otelhttp v0.70.0`，把 OTel core/sdk/exporter 对齐 v1.45.0，并删除手工 TraceContext extraction、server span、HTTP semantic attributes/status。项目 Telemetry wrapper 继续持有完整 request lease、解析 Huma 冻结后的低基数 operation、记录项目 Prometheus 指标并治理 bounded processor/exporter lifecycle；不得产生双 server span 或第二套 OTel metrics。

### Batch E：Data Repository 单轨迁移

R010 已确认当前没有复杂 join/SQL-heavy 用例，选择 direct GORM 而非 GORM Gen/sqlc：

1. `DATA-057-001` 建立受 `Client/Tx/Borrow` lifetime 约束的 GORM session callback；先迁移 Todo/Navigation concrete record/repository。
2. `DATA-057-002` 迁移 IAM/Organization 的 multi-repository Unit 与 transaction，覆盖 unique/FK/not-found/version conflict/session revoke/catalog reconcile。
3. `DATA-057-003` 删除 generic `BaseRepository/Schema/Query/Changes`、反射 model 和全部旧测试/文档；migration SQL 保持唯一 schema authority，禁止 AutoMigrate。

GORM 只能出现在 technology-specific bridge 与 module repo Adapter。若迁移需要让 GORM 泄漏到 Service/Model/port，或三方言出现大量不可控分支，则停止并重新研究。

### Batch F：静态 Blueprint 架构切片

R011 已建立 owner/reload 矩阵。`ARCH-057-002` 在 Huma registration 形态冻结后引入启动期 immutable `applicationBlueprint`，提升 permission/WebUI/operation policy/HTTP contract definition；Generation 继续拥有 resource/server/participant/runtime module 与候选兼容性检查。

验收必须证明多 section reload 时 Blueprint identity/构造次数不变，而 generation ID、资源 build/reuse、route handoff、auth/readiness、migration compatibility 和排空语义不退化。当前不把全部 Service 静态化，不新增 proxy、Service Locator、Fx 或反射 DI。

### Config 决策

`CONFIG-057-001` 已由 R008 以纯文档研究完成：不引入 koanf/Viper。现有 YAML、mapstructure 与 fsnotify 是成熟接缝；项目 strict merge、stable file、provenance/digest、binding owner 和 candidate transaction 保留。无生产实施批次。

## 失败、回退与验证语义

- 依赖升级失败：保留错误链和测试证据，不能降级为旧漏洞版本并宣称成功。
- PoC 不满足核心语义：记录拒绝原因和退出结论，删除 PoC 代码，不增加兼容层。
- 单轨替换或退役：先证明目标语义、取消、并发、错误和观测门禁，再迁移调用方并删除旧依赖；不得用新库保留没有收益的旧架构。
- 架构切片：启动、reload、旧代保留、stop/wait 和 race 测试必须覆盖；无法安全热换的能力明确 RestartRequired。
- 所有批次执行 `go test ./...`、`go vet ./...`、`go test -race ./...`（适用平台范围）、文档与生成物门禁；安全任务另执行与当前 Go 工具链匹配的 `govulncheck`。

## 文件影响预测

实际文件以确认后的任务设计复核为准：

- Batch A：`go.mod`、`go.sum`、`internal/transport/http/`、`pkg/httpx/contract/`、安全验证记录。
- Batch B：`pkg/cache/`、`internal/kernel/app/cache/`、缓存文档与依赖清单、配置/codec 消费者、`pkg/httpx/production_middleware.go`、IAM auth Adapter。
- Batch C：`pkg/httpx/`、`pkg/resilience/`（删除）、`pkg/execution/`、`internal/kernel/app/execution/`、Todo/Schedule/Messaging 调用方、composition/config/docs 及 `go.mod/go.sum`。
- Batch B 的浏览器安全追加范围：`pkg/httpx.CORS`、IAM/composition CSRF 回归、`go.mod/go.sum`；不改写 IAM token 或新增 credentialed CORS。
- Batch D：`go.mod/go.sum`、模块 `binding/http`、`internal/transport/http/`、composition、生成器、OpenAPI/inventory 与旧 `pkg/httpx/contract` 删除范围；随后覆盖 `internal/kernel/app/observability/`、OTel modules 与 Telemetry tests。
- Batch E：`pkg/database/` technology-specific session bridge、四个模块 repo Adapter/contract tests，以及 generic repository/schema/query 删除范围。
- Batch F：`internal/composition/` 的 Blueprint/factory/generation、静态 catalog/contract 入口与 reload/lifecycle 测试；不改变 Kernel generation transaction。
