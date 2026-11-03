# R002 成熟候选、维护状态与安全适用范围核验

## 研究方法

外部事实只采用官方仓库、release、安全公告、Go 标准库文档和 OWASP 指南。候选必须能落到当前项目的具体职责边界；本报告不以下载量、Star 或“更现代”作为选择理由。

## 已核验事实

### 官方证据索引

| 主题 | 官方来源 | 本次用途 |
| --- | --- | --- |
| kin-openapi | [Releases](https://github.com/getkin/kin-openapi/releases)、[fail-open 公告](https://github.com/getkin/kin-openapi/security/advisories/GHSA-r277-6w6q-xmqw)、[request validation DoS 公告](https://github.com/getkin/kin-openapi/security/advisories/GHSA-jpcw-4wr7-c3vq)、[response header panic 公告](https://github.com/getkin/kin-openapi/security/advisories/GHSA-74vm-87hj-r66f) | 当前/修复版本与触发范围 |
| L1 Cache | [patrickmn/go-cache releases](https://github.com/patrickmn/go-cache/releases)、[Otter](https://github.com/maypok86/otter)、[ttlcache](https://github.com/jellydator/ttlcache) | 维护状态、容量/TTL/生命周期候选；Otter 为 Apache-2.0，ttlcache 为 MIT |
| HTTP/SQL/韧性 | [Huma](https://github.com/danielgtaylor/huma)、[sqlc](https://github.com/sqlc-dev/sqlc)、[failsafe-go](https://github.com/failsafe-go/failsafe-go) | code-first/chi、类型安全 SQL、组合韧性能力；三者均为宽松开源许可证候选 |
| 序列化与身份 | [YAML maintained fork](https://github.com/yaml/go-yaml)、[JWX releases](https://github.com/lestrrat-go/jwx/releases) | v3 stable/v4 RC 维护边界与 JWX major 演进 |
| 授权 | [Apache Casbin](https://github.com/apache/casbin)、[OpenFGA](https://github.com/openfga/openfga) | domain/ABAC 与 ReBAC 候选边界；两者为 Apache-2.0 |
| 标准机制与安全基线 | [`x/time/rate`](https://pkg.go.dev/golang.org/x/time/rate)、[OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) | token bucket 与 Argon2id 当前最低建议 |

许可证只是候选资格的一项。实施前仍需由项目许可证/NOTICE 门禁复核具体版本及其 transitive dependency；本报告没有把“宽松许可证”等同于可直接采用。

### 需要优先处置

- `patrickmn/go-cache` 最新 release 仍是 2017 年的 `v2.1.0`。它能工作不等于仍是当前默认候选，尤其当前项目还缺少 L1 容量上界。
- 当前 `kin-openapi v0.142.0` 低于本次研究时最新 `v0.147.0`。官方公告显示 `<=0.143.0` 存在请求验证未授权拒绝服务和 `ValidationHandler` fail-open 问题，`<=0.145.0` 还有响应 header 验证 panic；项目当前调用路径并不等同于全部公告触发路径，但旧版本仍应优先升级并做负向验证。
- 原 `gopkg.in/yaml.v3` 仓库已归档；官方 YAML 组织维护的 `go.yaml.in/yaml/v3` 提供稳定安全修复线，持续开发迁往 v4。R004 复核时 v4 仍只有 RC，因此不能直接作为生产依赖。

030-R002 的版本更新刷新条件已经触发，因此其 metadata 标记为 `needs-refresh`。该历史记录仍能证明当时的生成路径可行性，但不能继续作为 `kin-openapi v0.142.0` 当前维护或安全状态的证据。

### 候选与适用边界

| 能力 | 官方能力事实 | 当前项目中的候选职责 | 不能据此得出的结论 |
| --- | --- | --- | --- |
| L1 Cache | Otter v2 提供泛型、容量/权重、TTL 与并发缓存；ttlcache v3 提供泛型 TTL、capacity 和显式 Start/Stop | 仅在真实消费者证明本地缓存收益、内存和陈旧预算后承担 L1 存储与淘汰；项目保留必要的 key/tag/L2 语义 | 候选成熟不等于当前必须存在 L1；R003 已据实际调用与一致性证据修订直接换库计划 |
| HTTP 契约 | Huma v2 可使用现有 chi、code-first 生成 OpenAPI 3.1，并提供标准错误；ogen 是 spec-first 生成器 | Huma 用于保持 code-first 的替代 PoC；ogen 只在 authority 改为 spec-first 时比较 | 不能因功能覆盖就直接删除项目 operation/policy 语义 |
| ORM/SQL | GORM 当前 release 与生态仍活跃；sqlc 从 SQL 生成类型安全 Go 并支持 PostgreSQL/MySQL/SQLite | GORM 保留连接/事务基线；sqlc 与 GORM Gen 在真实复杂查询上比较，模块保留 Repository port | 不能按“ORM 对 SQL”偏好一次性全仓迁移 |
| 韧性 | failsafe-go 组合 Retry、Circuit Breaker、Rate Limiter、Bulkhead、Timeout 并有 HTTP 集成；gobreaker/v2 提供更窄 breaker | 由项目命名 profile 决定错误分类、幂等和观测，第三方实现通用状态机 | 不能把同一 retry policy 套给所有 HTTP 方法和后台任务 |
| 限流 | `golang.org/x/time/rate` 是 Go 官方扩展库 token bucket | 替换进程内通用算法；composition 仍拥有 limiter 生命周期和配置 | 不能把进程级 load shedding 宣称为分布式业务 quota |
| AuthN/AuthZ | `jwx` 有活跃 v4；`coreos/go-oidc/v3` 提供 OIDC；Casbin v3 覆盖 RBAC/ABAC/domain；OpenFGA 面向 ReBAC | 按 JWT/OIDC、domain/ABAC、ReBAC 的真实需求分别选择，模块仍拥有 permission key 与业务授权入口 | 当前 Core RBAC 不需要为了未来可能性引入外部 policy engine |
| 配置/调度 | koanf v2 以 provider/parser 组合配置；gocron v2 当前仍活跃 | koanf 只比较解析/provider；项目保留 owner、strict candidate 和 reload 失败语义。gocron 继续承担触发器 | durable workflow 不能由 gocron 或 Kernel reload 冒充 |
| 日志/观测 | zap v1.28 仍在维护；Go 提供 `log/slog`；OpenTelemetry Go 提供 `otelhttp` 等标准 instrumentation | 保留当前窄 Logger/zap；新 HTTP 观测优先标准 instrumentation | 没有收益数据，不启动 slog 迁移或第二套日志体系 |

### 密码和安全中间件

- OWASP 当前对 Argon2id 给出最低内存/迭代组合；当前项目参数高于最低建议，因此问题不是“换一个密码库”，而是正确解析存量参数、限制资源、恒定语义比较和提供 rehash 路径。
- `rs/cors`、`unrolled/secure` 可作为 CORS/安全头专项比较对象，但项目的 Session Same-Origin/CSRF、代理终止 TLS 和具体 CSP 仍是部署与业务边界，不能机械外包给 middleware 默认值。

## 事实、推断与目标设计分离

- **事实：** 上述库在本次验证日期有官方维护、release 或安全文档；这只证明候选资格。
- **推断：** `kin-openapi` 升级、默认 L1 退役、YAML 官方稳定 v3 路径迁移和标准 token bucket 是低耦合优先项；是否重新引入 L1 或采用 YAML v4 必须由真实收益和稳定版本决定。
- **目标设计：** Huma、sqlc/GORM Gen、failsafe-go、koanf、JWX v4 和静态/动态架构分工必须经项目真实用例 PoC 后才能成为实施结论。

## 局限与刷新条件

- 未核验所有 transitive dependency 的完整 CVE/OSV 图；当前 `govulncheck` 工具链不匹配，必须在安全任务中重建扫描证据。
- 官方仓库声明的生产用户或功能不能替代项目自己的负载、错误、资源与迁移验证。
- release、安全和 Go 版本易漂移；实施每个任务前都要重新核验官方当前状态，不可只引用本报告快照。

## 对当前任务的影响

形成明确的保留/升级/替换/合理自研/架构重构矩阵，并支持按安全风险和耦合度分批实施。候选清单已经收敛到项目职责边界，而不是无优先级技术名录。

## 实施刷新（2026-08-22）

`SEC-057-001` 已按本研究完成安全止血：

- `kin-openapi` 从 `v0.142.0` 单轨升级到本次复核时最新 `v0.147.0`，`go.sum` 不再保留旧版本；
- 当前 production 继续直接调用 `ValidateRequest`，不使用 `ValidationHandler.Load()` 或 `ValidateResponse`；OpenAPI `AuthenticationFunc` 只校验安全方案引用，真实凭据认证与授权继续由项目 `OperationGate` fail-closed 执行；
- 新增 GHSA-jpcw-4wr7-c3vq 回归，证明合法文档中的无 schema `content` 参数返回错误而不 panic，并证明 Gate 拒绝后不会调用业务 Handler；
- PATH 中 Scanner v1.3.0 已用 Go 1.26.6 重建。全仓 `govulncheck -show verbose ./...` 报告 0 个可达符号漏洞、0 个 imported-package 漏洞；模块层仍报告当前代码不可达的 GO-2026-6222（`x/image`）和 GO-2026-5932（`x/crypto/openpgp`），不在 Batch A 内无证据扩张升级。

这关闭了安全升级任务，不代表 Huma 或当前 typed DSL 的高耦合 PoC 已完成或获得授权。

## Cache 计划刷新（2026-08-22）

[R003](../R003-cache-l1-necessity-and-candidate-fit/report.md) 进一步确认当前没有 production typed cache 消费者，现有 L1 无容量上界且没有跨实例失效。成熟候选只能替换本地容器，不能解决该一致性缺口。因此 `CACHE-057-001` 修订为先退役默认 L1 与 `patrickmn/go-cache`、保留 Redis typed cache/tag 边界；Otter v2/ttlcache v3 只在真实消费者给出量化收益与一致性预算后再做 PoC。

## Serde 计划刷新（2026-08-22）

[R004](../R004-serde-runtime-boundary-and-yaml-path/report.md) 确认 `go.yaml.in/yaml/v4` 当前仍只有 `v4.0.0-rc.6`，不满足稳定 production dependency 门禁；官方稳定安全维护线为 `go.yaml.in/yaml/v3 v3.0.5`。项目自研 `pkg/codec` 又没有仓库内消费者。因此 `SERDE-057-001` 修订为先迁移官方稳定 v3 import、删除无边界价值的 Codec Wrapper，并在 v4 stable 后按实际收益重新评估。

## HTTP limit 计划刷新（2026-08-22）

[R005](../R005-http-entry-rate-and-overload-boundary/report.md) 确认 `golang.org/x/time/rate v0.15.0` 的并发安全 token bucket 与 fail-fast `Allow` 精确覆盖当前自研通用算法；Go 官方 module metadata 显示其要求 Go 1.25，兼容当前 Go 1.26.6。现有 channel semaphore 已精确表达固定权重、非阻塞 503，换用 `x/sync/semaphore` 没有可验证收益。`LIMIT-057-001` 因发现 0/0 实际回落默认值的配置歧义而材料性修订：增加 `local/disabled` 严格模式，保持 limiter generation-local，并继续排除主体与分布式 quota。

[R007](../R007-resilience-execution-and-http-boundary/report.md) 进一步确认当前没有 production `pkg/httpx.Client` 构造或真实 breaker failure domain，而 Execution production 的 primary/local 均是 MemoryStore。原“failsafe-go 组合策略首选”推断因此被修订：当前真实有界 retry 选择零运行时依赖、错误原因清晰的 `cenkalti/backoff/v7 v7.0.0`；HTTP 隐式重试、无消费者 breaker、RecoveringStore/AsyncRecorder 直接退役。`failsafe-go v0.9.7` 维护活跃但 pre-v1 且范围/依赖过宽，`sony/gobreaker/v2 v2.4.0` 成熟但没有当前接入位置，均保留为有真实用例后的条件候选。

## 整体方案刷新（2026-08-22）

R002 的候选资格不是最终采用结论，后续专项已完成当前任务所需判断：

- [R008](../R008-config-pipeline-and-koanf-fit/report.md)：拒绝引入 koanf/Viper，保留项目 strict configuration transaction；
- [R009](../R009-http-contract-framework-fit/report.md)：选择 Huma v2，按代表性第一片后全量单轨迁移；
- [R010](../R010-data-repository-and-orm-boundary/report.md)：选择 direct GORM concrete repository，当前拒绝 GORM Gen/sqlc；
- [R011](../R011-owner-reload-and-static-blueprint/report.md)：冻结 `applicationBlueprint` 首片，Generation 保留运行态事务。
- [R012](../R012-browser-http-security-boundary/report.md)：选择 rs/cors + Go CrossOriginProtection，保留项目 fail-closed/IAM CSRF，拒绝无收益的 security-header wrapper；
- [R013](../R013-http-observability-instrumentation/report.md)：选择官方 otelhttp，保留项目 Telemetry lease、低基数 operation、Prometheus 与 exporter lifecycle。

因此本报告早期“必须经真实用例 PoC 才能成为实施结论”的概括，已由 R008–R013 的代码级专项研究收窄。HTTP 仍以可撤回的 production first slice 验证协议细节，但技术选择和目标删除范围不再留到实施期临时决定。
