# 架构说明

本目录是当前架构阅读入口。项目采用显式 composition root，把启动期 immutable `applicationBlueprint`、底层能力、Application Generation、业务模块和进程生命周期连接成单轨运行模型；不依赖包扫描、运行期 Service Locator 或隐式全局状态。

## 阅读主线

1. [当前运行结构](#当前运行结构)：先确认入口、composition、Application Generation、模块和 `pkg` 的实际关系。
2. [应用模块边界](../../internal/module/README.md)：业务模块如何收口 Model、Service、Adapter、Handler、binding 和 contribution。
3. [Kernel 与 App 组件装配](../../internal/kernel/README.md)：底层组件如何通过 Plan、typed Input、Lease、Replacement、生命周期和重载治理进入进程。
4. [Kernel App 组件开发](../../internal/kernel/app/README.md)：跨业务复用且由进程统一选择的底层能力如何声明、构造、输出和验证。
5. [技术选型与架构复核基线](technology-selection.md)：判断现有能力应保留、升级、替换、自研还是通过架构重构解决，并记录当前候选与实施顺序。
6. [pkg 封装规范与能力清单](../../pkg/README.md)：面向业务模块开放的项目自有能力、第三方封装边界和暂缓路线。
7. [应用模块开发指南](../development/application-module-development.md)：新增模块时如何做能力评估、选择模块专属 Adapter 或底层 Capability，并接入 HTTP/config/cli/migration/i18n/schedule/message binding。

## 当前运行结构

- `cmd/app` 只负责进程 I/O、基线日志、参数分支和信号入口。
- `internal/composition` 是唯一应用 composition root，显式装配 Bootstrap CLI、migration one-shot 与长期 Service。
- `Application.New` 一次构造并校验 `applicationBlueprint`，冻结 permission/WebUI/operation policy/HTTP definition；长期 Service 的所有 Generation 与 one-shot CLI 都只引用该 Blueprint。
- 长期 Service 通过 Application Generation 管理配置快照、资源复用、runtime module/Handler、listener、HTTP route、定时任务、消息 Consumer 准入、compatibility、ready 状态和优雅停止。
- 业务模块位于 `internal/module/<name>`，通过 typed contribution 交给 composition 聚合，不扫描、不隐式注册。
- `pkg/<name>` 只暴露项目自有能力契约；第三方具体类型留在 Adapter 或 Kernel App 实现内。

## 关键边界

| 边界 | 当前规则 |
| --- | --- |
| 进程入口 | `cmd/app` 不装配业务对象；所有模式进入 `internal/composition.Application`。 |
| 配置 owner | `internal/composition/configuration.go` 集中应用配置节，Kernel composition 补齐底层配置节；未知配置在资源副作用前失败。 |
| HTTP 契约 | `applicationHTTPModules()` 是公开业务 HTTP 模块聚合点；`internal/transport/http` 是唯一 route binding owner。 |
| 模块贡献 | `module.Contribution` 只输出 Participant、Schedule Binding 和 Message Contribution；composition 校验后集中安装。 |
| 技术与承载架构 | 先按[技术选型与架构复核基线](technology-selection.md)比较成熟候选和实际收益；现有 Kernel/Generation 形态不是不可调整前提。 |
| 底层能力 | 只有跨业务复用且由进程统一选择、并且确有进程级生命周期治理收益的资源进入 `pkg -> internal/kernel/app -> internal/kernel/composition`。 |
| 历史设计 | `docs/research/**` 和 `docs/changes/**` 保留研究与任务证据；当前架构以本页链接的正式主题为准。 |

## 生命周期治理

Service 使用 `applicationBlueprint -> GenerationCoordinator -> GenerationFactory -> typed resource pools -> ListenerHub`。候选 Generation 从同一配置快照构造 Logger、Database、Cache、I18n、Storage、Execution、Scheduler、Messaging、IAM、Organization、Navigation、Todo、Auth、Ops、HTTP route 和 management route，并引用启动期 Blueprint；Prepare 失败时 current 不变，Commit 后旧代排空并释放资源，清理失败进入 cleanup debt 并撤销 readiness。Navigation 每次 Manifest 请求读取当前数据库策略并投影 Blueprint 的静态 Catalog，不创建 watcher、cache 或独立生命周期资源。

one-shot CLI 走 Bootstrap 或 invocation-scoped Kernel 路径，不启动长期 watcher、HTTP listener、schedule 或 messaging Consumer。

## 当前权威与历史证据

当前架构说明以本页链接的主题文档为准。历史研究和设计过程保存在 [研究档案](../research/README.md) 与 [任务级变更记录](../changes/README.md)，用于解释决策来源和验证证据，不作为并列的当前规范。新增架构能力必须同步更新本页或对应主题页，不能只在最近代码目录旁新增说明。
