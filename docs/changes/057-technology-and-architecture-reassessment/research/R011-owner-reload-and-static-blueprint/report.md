# R011 Capability owner/reload 与静态 Blueprint 边界复核

## 结论

现有 Application Generation 不是整体错误，但范围过宽。它仍适合承载需要 candidate/commit/retire 的资源与运行态；纯代码声明不应在每次配置变化时重复构造和校验。

最小且可证明收益的架构切片是新增启动期 `applicationBlueprint`，一次构建并冻结 permission catalog、WebUI catalog、operation policies、HTTP contract definitions/inventory 和其他无配置、无资源、无运行状态的声明。Generation 只引用 Blueprint，并继续构建需要当前 config/resource/service 的 runtime graph。

本轮不把全部 Service/Handler 静态化。当前模块 Repository 绑定数据库借用生命周期，IAM/Auth/Organization/Navigation 存在跨模块 runtime 依赖，且 Todo/Auth 直接读取可 reload 配置；在没有稳定 resource/config handle 与排空模型前强行静态化，会把 generation 问题转化为隐式可变代理和更复杂状态机。

## 当前完整重建证据

`TestEachConfigurationSectionCreatesOneCompleteGeneration` 明确规定任一 section 变化都创建完整新代。即使 logger、i18n 或 Todo 单节变化，resource pool 只能复用 digest 相同的底层 resource；以下对象仍重新构建：telemetry、messaging、IAM、Organization、Navigation、Auth、Todo、Ops、Scheduler、HTTP router/server 与 management server。

每代还重复执行：

- `operationPolicies()`、`applicationPermissionCatalog()`、`applicationWebUICatalog()`；
- module contract/contribution 完整性收集；
- OpenAPI build/load、route dispatcher 与静态 inventory 相关工作；
- migration compatibility、IAM owner catalog 与 navigation catalog compatibility。

其中 catalog/contract/policy definitions 是代码常量或纯函数，不随 Snapshot 或 resource 变化，属于错误 owner；数据库 compatibility/reconciliation 则依赖当前 resource，仍应留在 candidate 阶段。

## Owner/reload 矩阵

| 能力/对象 | 当前 owner | reload 收益 | 并存/准入/排空 | 目标归属 |
| --- | --- | --- | --- | --- |
| config Loader/Watcher/Coordinator | process | 高；提供候选事务 | 单线程候选、失败保留旧代 | process，保留 |
| logging/database/cache/i18n/storage/execution resource | Generation factory pool | 配置变化时有收益；相同 digest 可复用 | acquire candidate、引用计数、retire close | dynamic resource plane，保留 |
| metrics provider | pool 中固定 `process` digest | 当前不随配置变化 | 全代复用 | 后续可提升 process；不并入首片 |
| listener hubs | process/factory | 高；同端口 route handoff | prepare/commit/drain/release | process，保留 |
| HTTP/management server 与 route | Generation | 高；handler/config 原子切换 | 双代并存、旧请求排空 | Generation，保留 |
| messaging/scheduler/telemetry participant | Generation | 高；依赖 config/resource/代 ID | candidate ready、commit、stop | Generation，保留 |
| IAM/Auth/Organization/Navigation/Todo/Ops runtime module | Generation | 当前有 config/resource/cross-module 依赖 | 随 route/participant 一起换代 | 暂保留；待稳定 handle 证据 |
| permission/WebUI/operation policy/contract definition | 每个 Generation | 无；纯代码声明 | 无资源、无停止 | startup `applicationBlueprint` |
| migration compatibility/catalog reconciliation | 每个 Generation | 高；依赖候选 DB 与代码 catalog | candidate 准入，失败保留旧代 | Generation validation，保留 |

## `applicationBlueprint` 设计

Blueprint 在 `newApplicationGenerationFactory` 之前或其中一次构建；构造失败阻止应用启动。它是只读值，不暴露可变 slice/map，包含：

- permission catalog；
- WebUI catalog；
- operation policy catalog；
- 各模块 HTTP operation definitions、OpenAPI/inventory 所需静态 schema metadata；
- Huma 迁移后所需的静态 registration descriptor，但不持有 runtime handler、Huma Context 或 router。

Generation 从 Blueprint 取得只读定义，绑定当代 Service/Handler、OperationGate 和 runtime availability。数据库 reconciliation 继续使用 Blueprint catalog + candidate database 执行。

## 实施顺序与验收

该切片依赖 HTTP framework 第一片先明确 contract definition 形态，否则会先为旧 DSL 建临时 Blueprint 再立即迁移。实施顺序：

1. 完成 Huma 第一片并冻结单轨 contract registration 结构。
2. 引入 Blueprint，移动纯静态构造；删除 Generation 内重复调用，不留旧 helper 双入口。
3. 增加测试：多 section reload 的 Blueprint identity 不变；runtime generation ID、资源 build/reuse、route handoff、auth/readiness 和 compatibility 行为不变。
4. 记录构造次数和 Generation `ResourceBuilt`/状态步骤差异；若只增加 Adapter 而没有删除重复构造与状态，则撤回切片。

## 后续而非本轮的架构问题

要进一步把 Service 静态化，必须先有：稳定且不泄漏关闭权的 database/config/resource access、每个 Service 对配置变化的明确策略、跨模块依赖的稳定 port，以及请求/后台任务的 generation lease。没有这些证据前，不建立万能 proxy、service locator 或第二套 component framework。

metrics provider 从 pool 提升为 process owner 可能有价值，但与 observability config/SDK reload 决策相关，应在出现实际配置需求时单独研究。

## 局限

本研究没有生产 reload 时延或内存 profile，收益证据目前是消除确定的重复构造和 owner 纠偏，而不是性能承诺。因此只批准最小 Blueprint 切片，不批准一次性拆分整个 Generation。
