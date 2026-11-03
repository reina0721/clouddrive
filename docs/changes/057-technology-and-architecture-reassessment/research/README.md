# 057 研究索引

## 研究问题

1. 当前业务模块和通用能力实际依赖什么，哪些属于标准库、成熟第三方、项目特有逻辑或自研通用机制？
2. 当前版本、维护状态、安全记录、稳定级别和生产适用范围是否仍支持继续采用？
3. 哪些问题应通过替换实现解决，哪些应保留，哪些实际来自 Kernel/Application Generation 承载架构？
4. 后续实施应如何分批，才能把安全止血、低耦合升级、高耦合 PoC 和架构重构分开验证？

## 检索与复用

- 已检索 `docs/**/research/**/metadata.yaml`，复核 030 HTTP 契约、037 调度、038 消息与根 `docs/research/001`、`002` 的既有结论。
- 初始全仓审计以 Commit `ae26ace97a7d4e0478a8238a787bc03513c387bf` 为快照；R003/R004 分别按各自 metadata 中的后续 Commit 重新追踪 cache 与 serde 当前事实，不能用初始快照覆盖深化研究。
- 外部事实优先使用项目官方仓库、release、安全公告、标准库文档和 OWASP 指南；GitHub 热度仅用于发现候选，不作为采用理由。

## 记录

| ID | 主题 | 状态 | 结论 |
| --- | --- | --- | --- |
| [R001](R001-current-capability-and-architecture-audit/report.md) | 当前能力与承载架构审计 | active | 现有实现混合成熟依赖、项目边界和多项自研通用机制；动态 Generation 范围需要重新收敛 |
| [R002](R002-mainstream-options-and-security/report.md) | 成熟候选、维护与安全核验 | active | 可形成明确保留/升级/替换/PoC 队列；安全升级与长期架构复核必须拆分 |
| [R003](R003-cache-l1-necessity-and-candidate-fit/report.md) | L1 必要性、一致性与候选适配 | active | 无 production typed cache 消费者且现有 L1 无容量/跨实例失效；先退役而非机械换库 |
| [R004](R004-serde-runtime-boundary-and-yaml-path/report.md) | 序列化边界与 YAML 稳定路径 | active | v4 仍为 RC；先迁移官方稳定 v3，并退役无消费者 Codec Wrapper |
| [R005](R005-http-entry-rate-and-overload-boundary/report.md) | HTTP 入口速率与过载保护边界 | active | 用 x/time/rate 替换 token bucket；保留简单 channel 503；修正 local/disabled 配置并保持 generation-local |
| [R006](R006-authn-library-and-credential-boundary/report.md) | 认证库与凭据校验边界 | active | 保留 jwx/v3 与 x/crypto/argon2；不引入实验性 v4 或小众 Wrapper，补取消、受限 PHC 与渐进重哈希 |
| [R007](R007-resilience-execution-and-http-boundary/report.md) | 重试、Execution 恢复与 HTTP Client 边界 | active | Execution 采用窄 backoff/v7；删除 HTTP 隐式重试、无消费者 breaker 和无真实外部 primary 的恢复/异步状态机 |
| [R008](R008-config-pipeline-and-koanf-fit/report.md) | 配置流水线与 koanf 适配性 | active | 成熟库已位于 YAML、strict decode 与 file notify 接缝；koanf/Viper 无净删除，保留项目候选事务 |
| [R009](R009-http-contract-framework-fit/report.md) | HTTP 契约框架与 Huma 适配性 | active | 选择 Huma v2 替换自研 contract/binding 通用机制；保留 chi、OperationGate、Problem 和模块 operation ownership |
| [R010](R010-data-repository-and-orm-boundary/report.md) | 数据 Repository 与 ORM 边界 | active | 保留 GORM 资源/事务；direct GORM concrete repo 单轨替换反射式 BaseRepository，当前拒绝 Gen/sqlc |
| [R011](R011-owner-reload-and-static-blueprint/report.md) | Owner/reload 与静态 Blueprint | active | Generation 保留运行态事务；纯 catalog/contract/policy 提升到启动期 applicationBlueprint |
| [R012](R012-browser-http-security-boundary/report.md) | 浏览器 HTTP 安全边界与成熟中间件 | active | rs/cors + CrossOriginProtection 承担标准机制；项目保留 fail-closed policy、Problem 与 IAM CSRF token；拒绝无收益 secure wrapper |
| [R013](R013-http-observability-instrumentation/report.md) | HTTP OpenTelemetry 标准 instrumentation | active | 官方 otelhttp 替换手工 propagation/span/status；项目保留 lease、低基数 operation、Prometheus 和 exporter lifecycle |

## 研究门禁

关键问题已有可复核证据，事实、推断和目标设计已分离；SEC-057-001 已完成当前工具链漏洞扫描。Config、HTTP、Data、浏览器安全、HTTP Observability 与 owner/reload 的剩余专项已经收敛为明确采用、拒绝和架构切片结论，057 的整体实施依赖与验收门禁不再留给实施期临时选型。研究门禁通过；尚未完成的非文档任务仍须在本次修订后整体计划报告之后获得确认。
