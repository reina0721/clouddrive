# 057 需求

## 状态与依据

- 研究门禁：已通过，依据 [R001](research/R001-current-capability-and-architecture-audit/report.md)、[R002](research/R002-mainstream-options-and-security/report.md) 及各专项深化研究。
- 已实施授权：纯文档规则、研究、计划、当前 authority 更新、Batch A，以及用户于 2026-08-22 分别确认的修订后 `CACHE-057-001`、`AUTHN-057-001`、`RESIL-057-001`。
- 整体方案已依据 R001–R013 收敛，并完成逐能力缺口审计；其余非文档变更待用户在本次修订后完整计划报告的后续消息中统一确认。

## 目标

建立一套长期可执行的技术决策基线：成熟通用能力优先复用，项目特有语义合理自研，第三方按边界价值隔离，现有架构允许被质疑和演进，最终以可靠性、长期维护成本、工程复杂度和真实项目收益决定。

## 必须满足

### REQ-057-001 当前事实优先

每次选型先追踪当前代码、依赖、composition、真实消费者、配置、资源 owner、错误/安全语义和测试；文档只能作为待复核声明。

### REQ-057-002 成熟候选主动研究

缓存、日志、HTTP Client、ORM、鉴权、权限、安全、限流/熔断、序列化、配置、调度及其他通用能力不得默认沿用或继续自研。重要候选必须核验官方维护、版本、安全、许可证、兼容性、生产适用范围和退出成本。

### REQ-057-003 实现与承载架构双重判断

每项结论同时回答：

1. 当前实现应保留、升级、替换、合理自研还是退役；
2. 当前模块、composition、Kernel/Application Generation 生命周期是否仍适合承载；
3. 若架构阻碍合理接入，重构的可验证收益是否高于迁移风险。

### REQ-057-004 稳定而有价值的项目边界

业务 Service/Model 不直接依赖易变第三方类型。项目拥有业务语义、错误/安全策略和共享资源生命周期；纯局部实现细节不机械复制 Wrapper。

### REQ-057-005 单轨迁移

选定替代方案后，同一实施任务迁移调用方、配置、测试和当前文档，删除失效旧入口与依赖；不保留无截止条件的兼容层、隐藏回退或第二套实现。

### REQ-057-006 分批验证和重新确认

安全止血、低耦合升级、高耦合 PoC、策略重构和承载架构切片分开实施。PoC、benchmark 或安全证据改变公共接口、依赖选择、模块边界、migration 或外部副作用时退回研究并重新确认。

## 当前决策范围

详细矩阵以[技术选型与架构复核基线](../../architecture/technology-selection.md)为当前 authority。至少包括：

- 保留：zap、chi、GORM 连接/事务、golang-migrate、go-redis、gocron、amqp091-go、OpenTelemetry/Prometheus 和当前简单 Core RBAC。
- 已完成安全升级：kin-openapi v0.147.0，并保持项目 OperationGate 为真实认证/授权 owner。
- 已完成退役：当前无真实消费者且一致性边界不完整的默认 L1 与 `patrickmn/go-cache` 已移除，Redis 是唯一缓存 authority，typed Client 不再拥有本地状态或生命周期。
- 已完成 resilience 收敛：`cenkalti/backoff/v7` 隐藏在 Execution 内部，项目拥有完整 budget 与错误语义；HTTP Client one-shot；旧自研 resilience、无消费者 breaker 和没有真实 primary 的恢复/异步状态机已退役。
- 后续升级：把已归档 `gopkg.in/yaml.v3` 直接依赖迁移到官方稳定 v3，并退役无消费者 `pkg/codec`；用 `x/time/rate` 替换 HTTP 自研 token bucket，同时保留简单非阻塞过载门禁并修正显式启停语义。未来 L1、YAML v4、JWX v4、breaker 与组合 resilience 框架都只能在真实需求和稳定门禁满足后重新选型。
- 合理自研：模块 Repository port、permission/operation/migration 业务语义，以及认证 Adapter 内的项目安全策略、受限 PHC 格式和凭据演进；JOSE 与 Argon2 算法继续由成熟库实现。
- 配置：保留 strict candidate 流水线，不引入 koanf/Viper；成熟解析、strict decode 与 file notify 继续由窄第三方接缝提供。
- HTTP：采用 Huma v2 作为 typed contract/binding 目标；迁移后删除自研 Schema/renderer/codec/dispatcher 与重复 request validation，但保留项目 OperationGate、Problem、chi 与 operation/policy authority。
- Data：保留 GORM resource/transaction/migration 基线；module repo 使用 concrete record + direct GORM，单轨退役反射式 BaseRepository/Schema/Query；当前不引入 GORM Gen/sqlc。
- 浏览器安全：以 rs/cors + Go CrossOriginProtection 复用标准 CORS/cross-site 机制；项目保留 fail-closed policy、Problem 与 IAM CSRF token；不引入无边界收益的通用 security-header wrapper。
- Observability：以官方 otelhttp 替换手工 HTTP propagation/span/status；项目保留 Telemetry lease、低基数 operation、Prometheus metrics、diagnostics 与 exporter lifecycle。
- 架构：建立启动期 immutable `applicationBlueprint`，只提升纯 catalog/policy/contract 定义；动态资源、server、participant 与 runtime module 暂留 Generation。

## 非目标

- 未经任务级确认不修改源码、配置、依赖、生成物或测试，不启动/停止服务，不写数据库或外部系统；已确认任务仅按其范围实施。
- 不一次性替换全部基础设施，不引入统一大框架、Service Locator 或反射 DI。
- 不因候选更流行或版本更新就迁移，也不因现有代码多就保留。
- 不把 `old-backend/` 纳入当前项目决策。
- 不在没有真实需求时引入 OIDC、ABAC/ReBAC、durable workflow、分布式 quota、Kafka/NATS 或第二套 ORM。

## 验收标准

1. 根规则、研究规范、模块开发指南和 architecture/pkg authority 一致表达新基线。
2. 当前能力矩阵逐项给出结论、明确候选、项目职责边界与接入位置。
3. 研究报告包含代码/依赖事实、官方外部证据、局限和刷新条件。
4. 非文档任务有稳定 ID、依赖、验证、停止条件和确认状态。
5. Config/HTTP/Data/Security/Observability/Architecture 不再以笼统 PoC 或“后续补齐”留到实施期选型；采用、拒绝、接入边界、单轨删除范围和失败撤回条件均有明确研究依据。
6. 文档拓扑校验与 `git diff --check` 通过；未执行的 runtime slice、漏洞扫描和迁移验证如实保留为实施门禁。
