# 058 研究索引

## 研究问题

1. 当前权限从代码声明、IAM 持久化、Session 解析到 HTTP operation decision 的真实调用链是什么？
2. 哪些是项目特有业务不变量，哪些是应由成熟 RBAC 库接管的通用 policy evaluation？
3. Casbin、Casbin GORM Adapter、OPA 与 OpenFGA 分别是否适合当前精确 Core RBAC？
4. A（Auth/operation 架构）与 B（IAM RBAC 配置能力）如何通过中间人通信，同时保持模块不互相 import、第三方类型不泄漏、变更即时 fail closed？
5. Application Generation 并存、配置 reload 与权限 mutation 并发时，内存 Enforcer 如何避免旧 policy 放行？
6. 当前动态账号角色/角色权限接口已经实现到什么程度，怎样升级为可并发控制、可审计、可即时生效的动态分配协议？
7. 怎样减少根 composition 的注入和内部实现知识，同时不引入万能依赖对象、自动扫描或 Service Locator？

## 检索与复用

- 已检索 `docs/**/research/**/metadata.yaml`，命中 053/R002；其刷新触发器明确包含 `Casbin becomes required`，本次因此重新研究，未直接套用“不引入 Casbin”的旧结论。
- 内部事实以 Commit `f83a58534c949a636a3a1b10f31c047fdeacf4af` 为快照，覆盖 Permission Catalog、Auth、IAM、HTTP operation gate、composition 与 Application Generation。
- 外部事实只使用 Apache Casbin 官方仓库/源码/文档、Go package 元数据、OpenFGA 官方文档与 OPA 官方集成文档；未以博客或热度代替适配性证据。

## 记录

| ID | 主题 | 状态 | 结论 |
| --- | --- | --- | --- |
| [R001](R001-current-authorization-path/report.md) | 当前授权链与承载边界 | active | IAM 关系表和 Session 安全语义完整，但 RBAC 展开与判断仍是项目手写；现有 composition 足以注入窄授权 port，Kernel Binding 与 request context 都不应承载业务 Service |
| [R002](R002-casbin-selection-and-mediation/report.md) | Casbin 选型、存储与中介设计 | active | 采用 Casbin v3 core 作为 IAM 内 evaluator；拒绝第二套 policy store，以 revision + immutable snapshot + composition adapter 保证 fail closed |
| [R003](R003-dynamic-assignment-contract/report.md) | 动态权限分配契约 | active | 保留现有角色/关系动态管理主线，升级为 Catalog 驱动的全量集合替换、expected version、事务 diff、Session 撤销和 evaluator 原子发布；权限定义继续由代码注册 |
| [R004](R004-hierarchical-composition-slimming/report.md) | 分级装配与根 composition 瘦身 | active | 以根生命周期编排、identity-access 子装配、模块局部装配三级结构收敛注入；模块输出窄 facet，不暴露整个 Service，也不建立万能 Contribution/Context |

## 研究门禁

当前调用链、数据 authority、第三方能力、事务/并发/Generation 风险和拟采用边界均已有可复核证据。事实、推断与目标设计已分离，剩余未知可作为实施期验证项而不影响形成计划。研究门禁通过；不代表非文档实施已获授权。
