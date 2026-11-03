# 057 通用技术与承载架构重新审视

## 状态

- 研究门禁：**已通过**。
- 纯文档实施：**已完成，按纯文档例外直接验证并提交**。
- 整体方案：**已通过完成性审计**。R001–R013 已覆盖全部当前能力、剩余技术选择和 owner/reload 承载架构；R012/R013 补齐了原计划遗漏的浏览器安全与标准 HTTP instrumentation，实施任务、依赖和停止条件已冻结。
- 非文档实施：**已完成**。Batch A 至 `ARCH-057-002` 的实施任务和 `VER-057-001` 最终审计均已按冻结依赖完成。

## 范围

本变更以实际代码、依赖、composition root、调用方和官方外部证据为基础，重新建立通用能力的技术决策基线，并同时判断现有 Kernel/Application Generation 架构是否仍适合作为承载基础。

当前结论、候选与边界已同步到[技术选型与架构复核基线](../../architecture/technology-selection.md)。后续非文档实施只允许覆盖 [`tasks.md`](tasks.md) 中经用户确认的任务 ID。

## 阅读顺序

1. [R001 当前能力与承载架构审计](research/R001-current-capability-and-architecture-audit/report.md)
2. [R002 成熟候选、维护与安全核验](research/R002-mainstream-options-and-security/report.md)
3. [R003 L1 缓存必要性、一致性与候选适配复核](research/R003-cache-l1-necessity-and-candidate-fit/report.md)
4. [R004 序列化真实边界与 YAML 稳定迁移路径复核](research/R004-serde-runtime-boundary-and-yaml-path/report.md)
5. [R005 HTTP 入口速率与过载保护边界复核](research/R005-http-entry-rate-and-overload-boundary/report.md)
6. [R006 认证库与凭据校验边界复核](research/R006-authn-library-and-credential-boundary/report.md)
7. [R007 重试、Execution 恢复与 HTTP Client 策略边界复核](research/R007-resilience-execution-and-http-boundary/report.md)
8. [R008 配置流水线与 koanf 适配性复核](research/R008-config-pipeline-and-koanf-fit/report.md)
9. [R009 HTTP 契约框架与 Huma 适配性复核](research/R009-http-contract-framework-fit/report.md)
10. [R010 数据 Repository 与 ORM 边界复核](research/R010-data-repository-and-orm-boundary/report.md)
11. [R011 Owner/reload 与静态 Blueprint 边界复核](research/R011-owner-reload-and-static-blueprint/report.md)
12. [R012 浏览器 HTTP 安全边界与成熟中间件复核](research/R012-browser-http-security-boundary/report.md)
13. [R013 HTTP OpenTelemetry 标准 instrumentation 复核](research/R013-http-observability-instrumentation/report.md)
14. [需求](requirements.md)
15. [设计](design.md)
16. [任务与确认状态](tasks.md)

## 关键结论

- 保留有成熟生态支撑且边界合理的能力，例如 `zap`、`chi`、GORM 的连接/事务基线、`golang-migrate`、`go-redis`、`gocron`、`amqp091-go`、OpenTelemetry 和 Prometheus。
- `kin-openapi` 的直接 request-validation 路径已随 HTTP 全量迁移删除；它当前仅作为 Huma 的间接依赖存在。31 个业务 operation 已统一到 Huma registration，OperationGate 与项目 Problem 仍是项目边界。
- cache 深化追踪确认当前没有 production typed L1 消费者，默认 L1 又缺少容量上界和跨实例失效；`CACHE-057-001` 已单轨退役 L1 与 `patrickmn/go-cache`，Redis 成为唯一 authority，并收紧 miss/error 语义。Otter v2/ttlcache v3 只保留为满足明确收益、内存和陈旧预算后的候选。
- YAML v4 当前仍为 RC，不符合稳定生产依赖基线；修订计划先迁移到官方维护的稳定 `go.yaml.in/yaml/v3 v3.0.5`，并删除无仓库内消费者的 `pkg/codec`。JSON 继续使用标准库，MessagePack 只保留在 cache 私有边界并由 CACHE 任务决定其 wire 语义。
- HTTP 自研 token bucket 应由 `golang.org/x/time/rate v0.15.0` 替换，但现有非阻塞 channel semaphore 直接表达 503 过载策略，应保留。限流修订计划增加显式 `local/disabled` 模式，保持 generation-local，不冒充分布式或主体 quota。
- AuthN 保留成熟且活跃维护的 `jwx/v3` 与 Go 官方 `x/crypto/argon2`；不为版本号迁移到仍强制实验性 jsonv2 的 JWX v4，也不引入无法消除敌对 PHC 资源风险的小众 Argon2 Wrapper。项目只保留认证策略、生命周期、受限 PHC 与 `NeedsRehash` 边界，不自行实现 JOSE 或密码学。
- resilience 深化研究确认 `failsafe-go` 对当前需求范围过宽且仍为 pre-v1；修订计划改为用成熟、窄且零运行时依赖的 `cenkalti/backoff/v7` 承担 Execution retry loop，删除 HTTP 通用隐式重试、无消费者自研 breaker，以及没有真实外部 primary 支撑的 Execution 恢复/异步状态机。`gobreaker/v2` 只在出现真实下游 failure domain 后进入 Adapter 级候选。
- `RESIL-057-001` 已完成上述单轨收敛：Execution 公开策略不暴露第三方类型，区分不可重试、caller cancellation/deadline 与 attempts exhausted；HTTP Client 对 status/transport failure 均只发送一次；memory Store 同步记录且不再启动推测性 lifecycle。
- 配置流水线保留：不引入 koanf/Viper。当前 YAML、mapstructure、fsnotify 已占据成熟通用接缝，项目继续拥有重复/形状冲突、稳定文件、provenance/digest、binding owner 与候选事务。
- HTTP 契约已采用 Huma v2：它只接管 typed binding、OpenAPI/JSON Schema、validation 和 route registration；chi、OperationGate、项目 Problem、module operation/policy ownership 与 server lifecycle 保持项目 authority。自研 contract/codec、dispatcher 和重复 kin-openapi request-validation 路径已删除。
- Data 保留 GORM 连接/事务/错误/租约，拒绝当前无收益的 GORM Gen/sqlc；全部 module repo 已使用 concrete record + direct GORM，反射式 BaseRepository/Schema/Query 已删除，业务 port 和 migration SQL 不变。
- 浏览器安全采用 `rs/cors v1.11.1` 处理标准 CORS header/Vary/preflight，并用 Go `CrossOriginProtection` 加固 unsafe cross-site 请求；项目保留 default-deny/Problem 与 IAM Session CSRF token。显式三项安全头继续保留，不引入无法决定 HSTS/CSP 部署策略的 `unrolled/secure`。
- HTTP Observability 采用官方 `otelhttp v0.70.0` 并对齐 OTel v1.45.0，删除手工 TraceContext/server span/status instrumentation；Generation lease、低基数 operation、项目 Prometheus、trace ID bridge 与 exporter lifecycle 保持项目边界。
- 模块自有 Repository port、permission key、migration SQL 和 operation 语义具有项目特有价值；通用算法和框架机制不应继续默认自研。
- Application Generation 继续承载 resource/server/participant/runtime module 的候选事务；纯 permission/WebUI/policy/HTTP contract 声明已移到启动期 `applicationBlueprint`，所有 Generation 与 CLI 共享同一实例。当前不强行静态化全部 Service，也不做一次性 Kernel 重写。
- 030、037、038 等历史任务是实施证据，不再自动构成继续沿用其依赖或承载架构的理由；安全、维护状态和新用例必须按本基线刷新。
