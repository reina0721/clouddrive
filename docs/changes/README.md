# 任务级变更记录

每项新变更使用递增三位序号和语义名称，固定包含 `README.md`、`research/`、面向客户的 `requirements/`、面向技术人员的 `design/` 和 checkbox 完成清单 `tasks.md`。需求与详细设计使用目录入口和语义分篇承载，不再以单个 `requirements.md` 或 `design.md` 作为新方案的唯一记录。历史变更保留原结构，不批量迁移。所有任务先通过研究门禁，再形成计划；非纯文档实现必须在计划报告后的独立消息中获得确认。完整规则以根 [AGENTS.md](../../AGENTS.md) 为准。

001–041 是随当前仓库导入的脚手架基线档案，保留作为历史证据；042 起是本仓库原生变更记录。两者都不能替代当前主题 authority，当前边界和来源见[脚手架基线来源](../scaffold-baseline.md)。

## 记录

- [001 默认配置契约与可选 CLI](001-default-config-cli-contracts/README.md)：已完成。
- [002 应用启动入口](002-application-entrypoint/README.md)：实现已保留，存在确认流程偏差，最终运行验证未完成。
- [003 变更确认流程](003-change-confirmation-workflow/README.md)：已完成。
- [004 Logger Capability 注入](004-logger-capability-injection/README.md)：已完成。
- [005 全量配置示例](005-full-config-example/README.md)：已完成。
- [006 Kernel App 多态装配基础](006-kernel-app-polymorphic-composition/README.md)：已完成。
- [007 Kernel 内置 Logger 的可选 App 替换](007-app-component-logger-injection/README.md)：已完成。
- [009 配置重载与生命周期修复](009-config-reload-lifecycle-repair/README.md)：已完成。
- [010 数据库单轨 GORM 与稳定访问边界](010-database-gorm-boundary/README.md)：已完成。
- [011 Cache、I18n 与 Storage 装配](011-cache-i18n-storage-composition/README.md)：已完成。
- [012 业务模块架构](012-business-module-architecture/README.md)：底层 CLI/Config/单候选/Supervisor/HTTP/诊断与治理闭环已实施；业务解锁条件已由 014 的真实 Todo 用例满足。
- [013 研究优先任务门禁](013-research-plan-implementation-gate/README.md)：已完成；将 012 的结构化研究方法提升为“研究 -> 计划 -> 实现”的仓库级前置门禁。
- [014 Todo 业务垂直切片](014-todo-business-vertical-slice/README.md)：已实现 Todo Model/Service/Repository、SQLite migration、HTTP 路由、Application CLI、配置绑定与进程组合闭环。
- [015 Todo 路由中间件示例](015-todo-route-middleware-example/README.md)：已实现模块级 JSON Content-Type middleware、创建路由显式绑定、415 安全错误与进程验收。
- [016 应用模块命名迁移](016-application-module-naming/README.md)：已完成；`internal/module`、`module.ID` 与 `module.todo` 已成为唯一现行命名。
- [017 应用模块能力评估门禁](017-module-capability-assessment-gate/README.md)：已完成通用 Agent 研究语境、项目级应用模块开发指南、能力评估表和生命周期契约缺口升级路径。
- [018 Cordis 启发的插件架构](018-cordis-inspired-plugin-architecture/README.md)：已废除；研究快照作为历史保留，所有插件架构实施任务失效。
- [019 HTTP API 成熟度缺口评估](019-http-api-maturity-gap-assessment/README.md)：已完成当前 HTTP API 运行链审计、成熟度参考、缺口优先级和分阶段路线；没有非文档实施授权。
- [020 复制型脚手架产品形态](020-scaffold-product-form/README.md)：已完成 copy-owned 单轨决策、两个独立副本的身份迁移、Todo 保留/移除和 Windows 门禁；Linux、正式复制指南与 release 能力仍待独立实施。
- [021 仓库身份迁移](021-repository-identity-migration/README.md)：已将 canonical remote、Go module/import、运行品牌与当前使用文档统一为 `clouddrive`；另一个 `go-scaffold` 仓库未进入范围。
- [022 HTTP API 脚手架成熟就绪度](022-http-api-template-readiness/README.md)：`Foundation-closed(current synchronous HTTP/CLI profile)` 已通过；024 已完成产品能力与 Windows 本地证据，但 Linux、容器、服务器数据库和远端 CI 总验收尚未通过。
- [023 全配置无感重载](023-full-configuration-seamless-reload/README.md)：已完成本地实施验收；Application Generation/ListenerHub 与七节配置重载已落地，Linux 真实 runtime 和真实 Redis 经用户批准跳过并保持未验证，未 push。
- [024 生产就绪模板一次性竣工](024-production-ready-one-shot-completion/README.md)：已确认并实施中；连续完成 `ONE-001..025` 与本地检查点提交，禁止 push、tag、远端 Release、GHCR 和外部 attestation。
- [025 业务模块边界收口](025-business-module-boundary-closure/README.md)：已完成；Todo 手写 HTTP Adapter 已收回模块，Auth/Todo 通过窄端口连接，入口与跨模块导入门禁已加固，OpenAPI 与运行行为保持不变。
- [026 Handler-first HTTP 路由绑定](026-handler-first-http-route-binding/README.md)：研究与计划已完成，待确认；拟把模块 operation Handler、应用静态 aggregate、单一生成 route binding 与外层 Router 分责，消除当前单模块假设。
- [027 第三方封装与分轨装配](027-business-module-third-party-isolation/README.md)：已确认并实施；新增业务能力先完整收口到模块，专属第三方留在模块 Adapter 并零泄漏，只有跨业务复用且由进程统一选择的资源才进入完整底层链。
- [028 开发日志基线与启动可见性](028-required-development-logging/README.md)：已完成；development 默认输出 Debug 及以上，production 默认保持 Info，Service/Generation/HTTP 已形成分级低敏事件链并由开发规范和架构测试守护。
- [029 本地启动与配置闭环](029-local-startup-config-closure/README.md)：已完成；generated config、Migration、Todo CLI 与 Service 共用 application-owned 配置集合，本地启动与配置说明已收束到根 README、本地启动指南和配置说明。
- [030 模块自有代码优先契约](030-module-owned-code-first-contract/README.md)：已完成；契约 authority 反转为模块自有 typed 声明，`contract-gen` 从代码生成 `api/openapi.yaml` 与 operation inventory，删除 oapi-codegen 生成链与 nethttp-middleware，transport 从同一份契约单一绑定。
- [031 模块顶层 HTTP Handler 分责](031-module-top-level-http-handler/README.md)：已完成；Todo 的 HTTP handler 层从 `binding/http` 迁移到模块顶层 `handler`，`binding/http` 只做代码优先契约与运行期装箱，每层职责分明。
- [032 i18n 配置职责边界与集中声明](032-i18n-config-boundary/README.md)：已完成；`kernel/app/i18n` 集中声明默认配置并统一 `./locales`，logger/database 组件自声明默认值（不再复用 `pkg/*.DefaultConfig()`），cache 的 `redisstore.DefaultTagPrefix` 作为基础默认常量回退保留，并把「应用层不得隐式依赖通用库默认值」纳入架构门禁与业务 i18n 接入文档。
- [033 业务模块统一契约与 binding 对齐](033-module-contract-alignment/README.md)：已完成；把统一绑定契约（HTTP/config/cli/migration/i18n/middleware）固化到模块开发指南，落地业务流程模块自有 i18n binding（Todo `binding/i18n`），文档化 Ops（独立 management）/Auth（横切）/Migration（纯 CLI）形态，并保留 032 的 pkg/kernel-app 配置边界。
- [034 业务模块装配纯度与文档一致性](034-module-wiring-purity/README.md)：已完成；`internal/composition` 通过 `applicationHTTPModules()` 收敛 HTTP 契约接入，消除 `ops.go`/`service.go` 对 `todohttp.ModuleContract()` 的直接反向读取，生成器注册点 `registeredModules()` 与装配流程文档化，并让权威文档与实现一致。
- [035 后台任务能力装配（幂等 / 重试 / 执行记录）](035-background-task-capabilities/README.md)：已完成；为需要幂等、失败重试、执行记录的业务模块（订单、支付、库存为例）装配 `pkg/execution -> kernel/app/execution -> composition` 底层执行能力（默认内存 backend + 组件开关），重试复用 `pkg/resilience`（`d42e044`）；并在 `pkg/execution` 追加外部依赖故障恢复治理 `RecoveringStore`（Healthy/Degraded/Recovering 状态机、有界记录缓冲 + 溢出策略、退避/抖动/最大频率探测、可用性验证、恢复后回放并原子切回主实现）与执行记录异步持久化 `AsyncRecorder`，`kernel/app/execution` 装配恢复治理 + 异步记录、按 `Config.Policies`/`Execution.PolicyName` 提供命令式按模块策略隔离，并经注入 Logger 输出状态变化日志、`Access.Recovery()`/`Access.Health()` 导出恢复治理观测；缓存 Cache-primary/数据库外部主存储接入列为下一增量。
- [036 业务模块接入 execution（Todo 落地）](036-business-module-execution-adoption/README.md)：接入指南（纯文档）已完成；为需要幂等、失败重试、执行记录的业务模块沉淀单一权威入口 `docs/development/execution-capability.md`（声明式命名策略、`OperationExecutor` 用法、错误语义、Trace、观测与多实例边界，并由模块开发指南索引）；非文档的 Todo 真实接入（service 窄 port + composition 注入 + 命名策略）待计划确认。
- [037 定时调度能力](037-scheduled-task-capability/README.md)：已确认并实施；模块通过显式 Schedule Binding 声明 cron/fixedDelay 与任务策略，Application Generation 统一治理触发、并发、Execution/Tracing、Ops 与基于 Cache Redis owner 的分布式执行权，严格任务不隐式本地降级并可在协调恢复后自动重新参与。
- [038 消息系统适配能力](038-messaging-adapter-capability/README.md)：已实现项目自有 Message Contract/Binding、显式多 Provider、RabbitMQ Adapter、Execution 可靠性协作与 Application Generation Consumer admission；本地工程门禁通过，RabbitMQ 4.3 真实协议门禁因本机无 Docker/WSL 保持未验证。
- [039 文档体系闭环整理](039-documentation-system-closure/README.md)：已完成；根 README、项目手册总目录、开发入口、架构入口和运维入口按项目生命周期形成闭环，并明确当前主题文档、研究快照与任务证据的 authority 边界。
- [040 项目文档体系系统重构](040-documentation-system-rebuild/README.md)：已完成；系统审计正式与历史文档、建立审计矩阵，按真实使用路径重构项目手册和 architecture/development/operations 入口，补齐 `pkg/execution` 局部说明，并修正 Kernel 局部 README 的过期阶段边界。
- [041 日志体系补齐与治理](041-logging-observability-governance/README.md)：已完成；在既有 Logger、Tracing、Execution Record、Health、Diagnostics 与 Observability 能力上补齐 migration、execution、messaging、management、scheduler 的低敏结构化日志、测试门禁和开发规范，避免重复建设平行观测体系。
- [042 Admin WebUI 模块化宿主](042-admin-webui-foundation/README.md)：保留为历史实施证据；项目自有 Admin 技术命名已由 043 单轨取代。
- [043 WebUI 契约命名单轨迁移](043-webui-contract-naming/README.md)：已完成；文件夹、契约、路由、CLI、Session、数据库对象和前端标识统一为 `webui`。
- [044 WebUI 本地启动闭环](044-webui-local-startup-closure/README.md)：已完成路由 prefix 与本地 HTTPS 修复；旧路径记录仅为历史证据。
- [045 WebUI Origin 策略闭环](045-webui-origin-policy/README.md)：已完成 CORS、Auth Origin、Vite 本地配置和 Setup Token 输入遮罩修复。
- [046 WebUI Setup 输入校验错误闭环](046-webui-setup-validation-errors/README.md)：已把用户名/密码输入错误从 500 收敛为稳定 400，并补齐页面约束、中文提示和前端测试。
- [047 Admin WebUI 产品化与模块化装配闭环](047-admin-webui-productization/README.md)：已停止继续实施；已提交代码作为当前事实和历史证据保留，未完成路线由 048 取代。
- [048 业务模块自有 WebUI 与通用 SDK 重构](048-full-stack-webui-modules/README.md)：已完成 SDK、模块边界、Binding/生成门禁、CSS Modules、资源加载隔离与 E2E/视觉验收；页面继续由 `internal/module/<id>` 持有，普通模块 core 零修改，只有真实新宿主能力才单独增加 SDK interface/adapter。
- [049 项目规范门禁语境核验](049-project-rule-gate-context/README.md)：已完成；核验模块、配置、日志、WebUI、质量、发布与许可证规范的真实覆盖，修复“命令通过但目标未被扫描”和“Go 门禁冒充全项目门禁”的项目文档语境。
- [050 项目门禁缺口实施](050-project-gate-implementation/README.md)：已确认并实施；WebUI 门禁改为动态发现模块，静态质量链接入本地脚本、CI 与 release，容器许可证标签与源码声明对齐。
- [051 项目文档体系治理闭环](051-documentation-system-governance-closure/README.md)：已确认并实施；系统修复当前文档入口、范围、使用路径、模块/能力索引、历史污染与缺失说明，并建立文档影响记录、跨平台门禁和 CI 约束；`old-backend/` 明确排除。
- [052 项目布局与可配置值集中声明](052-declarative-project-layout/README.md)：研究门禁已通过，计划待确认；拟集中声明 WebUI/模块 facet、生成物、工具/release 路径与开发 endpoint，并审计其他可配置化候选。
- [053 Admin 多业务模块基础平台](053-admin-module-foundation/README.md)：已完成；定向补齐 Permission、Migration、HTTP/Auth 与 WebUI NavigationPolicy 聚合契约，不实施 Admin 业务功能。
- [054 IAM 身份与访问管理模块](054-iam/README.md)：已完成；单轨接管本地账号/凭据/Session，并实现 Core RBAC、owner、用户/角色/权限 API 与 WebUI。
- [055 Organization 组织目录模块](055-organization/README.md)：已完成；拥有部门、岗位和账号组织关系，不包含部门数据权限。
- [056 Navigation 后台导航策略模块](056-navigation/README.md)：已完成；管理已注册菜单的启停、父子、排序和 NavigationRevision，不建立动态页面或第二套授权。
- [057 通用技术与承载架构重新审视](057-technology-and-architecture-reassessment/README.md)：研究门禁与纯文档规则/authority 更新已完成；Batch A 已把 kin-openapi 升级到 v0.147.0、补齐请求验证安全回归并重建 Go 1.26 漏洞扫描证据，Batch B–E 仍待逐项确认。
- [058 Casbin RBAC 注入与授权边界重构](058-casbin-rbac-integration/README.md)：已确认，实施中（001–009 已完成）；Casbin v3.10.0 以 IAM module-owned evaluator 单轨接管 Core RBAC 求值，Auth 经消费方 DecisionPoint 消费，authorization revision + 不可变 snapshot 保证 fail closed，动态分配升级为 expected version/409/Catalog 矩阵，`permissionsFor`/IAM-Scopes/HasScope 旧路径已删除。
- [059 WebUI 后台骨架与交互体验升级](059-webui-shell-experience-upgrade/README.md)：已确认，实施中；统一 Shell 视觉区域、动效与 reduced-motion 决策、Shell/Page/Data skeleton、overlay 进退场，页面由各模块 owner 校准，退役零消费者 HeroUI，不引入 Tailwind/动画库，静态可插拔与按路由 code splitting 保持。
- [060 WebUI 托管模式与构建产物配置管理](060-webui-hosting-modes/README.md)：已完成并提交 `86c2ca8`；WebUI 支持前后端分离与 Go 服务单进程托管双模式（`webui.hosting.enabled` 默认 true），新增 `webui.hosting` 配置节（托管路径默认 `webui/dist`、托管前构建脚本默认 node：registry 生成 -> 依赖安装 -> 构建打包）、SPA 托管处理器与 `webui build` CLI，并同步 Docker/release 产物纳入与文档 authority。
- [061 WebUI 多环境数据源兼容（含全 WebUI mock）](061-webui-ops-multi-env-compat/README.md)：研究已通过，计划待确认；拟修复默认启动（模式 B）下 Ops `运行状态`/`能力清单` 页 `/management/*` 恒 4xx：模式 B 业务 listener 挂载受保护 management facade；WebUI 显式声明数据源环境（`VITE_WEBUI_DATA_SOURCE`，默认 `server-hosted`=服务托管构建产物，`separated`/`mock` 可覆盖）；声明 `mock` 时整个 WebUI（宿主骨架 + 全部模块数据）走本地 mock（模块自有 mock 源 + 生成 registry + Go catalog 投影 mock manifest + 全局“模拟环境”双语徽标、零真实请求），真实模式叠加 Ops 可达性分级降级。
- [062 WebUI 骨架与注入点设计体系](062-webui-skeleton-injection/README.md)：已确认并实施完成；把 WebUI 从 route/menu/locale/mock 四类注入面升级为「分区骨架 + 类型化注入点 + 统一交互/权限契约」体系：五类分区注入点（顶栏操作区/侧边栏辅助区/页头区/页签栏操作区/底部状态区）与 Manifest actionPermissions 动作级权限投影、SDK zone capability（useZoneContributions/useActionAccess/ZoneSlot）、交互状态链原语（ActionTrigger/BulkActionBar/FormSubmitActions）、受控图标目录与导航缩进 token 化，并进阶骨架（分区渲染槽、`data-action-state` 状态契约）；Ops 落地首个 header-actions/footer-status 真实用例；保持静态插拔语义（生成 `webuiZoneRegistry` + Manifest 门禁），Go 测试/WebUI lint/typecheck/Vitest 79/build/Playwright 11 全绿，zone 组件独立 async chunk；支撑研究 R062-001/R062-002 结论为保留并演进自研静态插拔机制。
- [063 当前业务模块侧边栏菜单层级分类](063-webui-sidebar-menu-hierarchy/README.md)：已确认并实施完成；在 webui 契约内为 IAM（`iam.access` 身份与权限管理）与 Organization（`organization.directory` 组织管理）引入顶级组父节点并把同模块页面归入其下，ops 保持两级现状、navigation 保持平铺；未修改 webui 代码与契约核心，同步 locale/菜单管理页 mock/生成 registry 并新增组合测试 `TestApplicationWebUICatalogMenuHierarchy`，Go 全绿、WebUI 79 用例与 Playwright 11 用例通过。
- [064 账号与权限体系进阶](064-account-permission-advancement/README.md)：已确认并实施完成；首批为「可查询低敏审计（Auth 持久化 Sink + `auth.audit.list` 查询 + `auth:audit:read`）」与「账号会话集中管理（IAM `iam.sessions.list/revoke` + `iam:session:*`）」两个闭环，配套审计页/会话管理页 WebUI、迁移、测试与文档；MFA/TOTP、组织数据权限、外部身份/多租户/ABAC 列为下一批候选方向（仅记录，不实施）。
- [065 日志与审计体系进阶（业务操作审计）](065-logging-audit-system/README.md)：已确认并实施完成；日志体系已闭环保持现状、审计缺业务操作审计；在 Auth 暴露窄 `OperationAuditWriter` port 并让 IAM/Organization/Navigation 写操作复用同一低敏审计面（`auth_audit_events` + `auth.audit.list` + WebUI），`auth.audit.list` 支持 action/resourceType 过滤，`docs/development/logging.md` 固化操作审计规范；未建第二套审计/日志存储、未推翻 024/R005 Auth 收口决策、未引入外部日志平台。

- [066 账号与权限体系闭环缺口补齐](066-account-permission-gap-closure/README.md)：已确认并实施完成；首批为 IAM 账号生命周期（资料更新、归档）与角色生命周期（资料更新、归档）、WebUI 管理页按钮级权限接入（既有 ActionPermissions/ActionTrigger）、列表过滤分页与 409 差异确认/分配乐观锁，全部落在既有模块边界与机制内、不新增权限键；组织数据权限、角色-菜单绑定、动态菜单、按钮独立权限键列为候选方向（仅记录，不实施）。
- [067 业务页面布局骨架与滚动/动效体验](067-webui-page-layout-scroll-motion/README.md)：已确认并实施完成；修复组织模块报错（`assignments.*` 翻译键缺失占位 + 操作失败无反馈）；建立 TailAdmin 式平台布局骨架（PageSection/StatGrid/StatCard/DataCard/Reveal 等进入 `@webui/sdk/ui`）并迁移全部业务模块页面；实现滚动/动效运行时（Lenis 窄封装 SmoothScrollController、滚动条稳定插槽、边缘阻尼/橡皮筋、磁吸吸附、显式滚动劫持、弹入响应）与 `ThemePreferences.experience` 派生配置（ThemeDrawer「体验」面板、旧主题迁移、reduced-motion 统一降级）；唯一新增第三方 `lenis`，技术选型 authority 已记录（R067-002）。
- [068 WebUI 全量采用 HeroUI 组件库](068-heroui-ui-adoption/README.md)：已确认并实施完成；按方案 A 引入 HeroUI v3（@heroui/react/@heroui/theme/@heroui/toast/@heroui/styles + tailwindcss v4）单轨替换呈现层：`@webui/sdk/ui` 导出契约不变，Button/Field/SelectField/StatusPill/CapabilityBanner/InlineAlert/Skeleton/EmptyState/Toast/PageSection/StatCard/StatGrid/DataCard/DataTable/Pagination/ActionTrigger/IconButton 改用 HeroUI；平台契约层（权限呈现、zone、Reveal、滚动运行时、experience 配置、reduced-motion）不回归；样式 authority 收窄为 reset/token/平台行为 + Tailwind + `@heroui/styles`；暗色联动 `<html>.dark`；补装 HeroUI v3 组件静态样式（`@heroui/styles/css`）；记录边界：遮罩容器与 Switch/Checkbox 因 v3 复合组件限制暂自绘（R068-002）；e2e 新增 `068 heroui adoption` 与截图，Vitest 109 / Playwright 15 全绿；bundle 基线记录（~1.06 MB raw / ~310 KB gzip）。
- [069 WebUI 骨架 HeroUI 拼装与布局重构](069-heroui-skeleton-rebuild/README.md)：已确认四层方案并实施中（A/B1/B2/C/D 完成，E/F 收尾）；布局 token/preset 对齐 HeroUI 变量；Shell 控件 HeroUI/RAC 拼装（搜索/页签触发器、账号 RAC Menu、遮罩 RAC 受控 Modal/Dialog、开关/复选框 RAC 底座）；页面模板规范写入 webui 开发指南；RAC overlay 单测客户端化（renderClient）；e2e 新增 `069 shell is assembled…` 与亮暗/移动截图；Vitest 109 / Playwright 16 / typecheck / build / lint / generate / go 全绿。
- [070 设置中心与菜单层级「双向归属」架构升级](070-settings-center-and-menu-hierarchy/README.md)：已确认并实施完成（A..E 完成，F 提交收尾）；契约升级 `Navigation.ParentID` 跨 owner + 宿主导航声明 `HostNavigation`（owner=host，`host.center` 收纳设置组）；新业务模块 `settings`（Profile/Account/Appearance/Notifications + settings.center 两级菜单 + i18n/mock/受控图标/生成链）；双向第一实例 `iam.security` 挂入设置组；Go/WebUI/e2e 18 全绿并附 070 设置页截图。
- [071 设置中心页内侧边栏形态（第二类菜单层级）](071-settings-in-page-navigation/README.md)：已确认并实施完成；平台新增 `SectionNav` 页内分区导航原语（@webui/sdk/ui：navlist 语义、aria-current 高亮、键盘导航、≤720px 横向折叠）；settings 四分区接入 `SettingsNavLayout`（页内侧边栏 + 内容区，深链保留）；全局菜单树并存（两类层级规范写入 webui 开发指南）；e2e 新增 `071 settings in-page section navigation…` 与移动视口截图；typecheck/lint/vitest 110/build/Playwright 19 全绿。
- [072 设置套件细化：8 分区重组、IAM 自服务资料/软注销、SPA 页内导航修复](072-settings-suite-refine/README.md)：已确认并实施完成（A..E 全绿并提交 9c224ef/7f888a4）；IAM migration 004 资料字段 + 自服务 `PATCH /api/v1/iam/self/profile`（乐观锁）与 `POST /api/v1/iam/self/archive{,/confirm}`（两步软注销，复用归档语义）；`HostRuntime.navigate` SPA 导航修复；settings 8 分区重组；会话身份携带资料；Playwright 20 全绿。
- [073 全局菜单两级化 + 分组布局（固定页内导航）](073-two-level-settings-menu/README.md)：已确认并实施完成（bde2dbb + 布局修复 2de6737）；全局菜单收敛为两级（顶级「设置」→ 五主分区子项，移除 host.center 装配与 locale 键）；契约新增 `Route.GroupLayoutID` 分组布局——宿主 `ModuleGroupLayout`（懒加载布局 + Outlet children 注入）承载 settings 八路由共享 `SettingsLayout`（固定 SectionNav + 内容区，切换不重挂，e2e dataset 标记断言）；HostNavigation 契约能力保留；修复 CSS Modules 后代选择器导致的布局堆叠（作用域 class 放祖先）。
- [074 设置菜单一致性：页内导航与全局菜单 8 分区对齐](074-settings-menu-parity/README.md)：已确认并实施（验证与提交收尾中）；全局「设置」子项补全 8 分区与页内 SectionNav 完全一致（同名同序）；`iam.security` 归位 `iam.access`（页面职责边界：模块 UI 需求调用他模块接口自实现页面，不挂接他人页面）；「多分区页面通用范式」写入 webui 开发指南；跨 owner ParentID/HostNavigation 能力保留。
- [075 新增 openapi 模块：WebUI 可视化渲染 API 契约](075-openapi-webui-render/README.md)：已确认并实施完成（五轮演进）；终态为**融入后台设计语言的「API 文档 + 在线调试」模块（R075-006）**：平台组件列表（搜索/tag 筛选/DataTable）+ Drawer 详情（文档/调试双模式）+ 调试区响应卡片 + 模型 Drawer + Cmd+K + 深链 `?op=&mode=`；提取 Apifox 业务能力（文档查看、Try it out：参数/JSON/form-文件/urlencoded/Auth/发送/响应）但去除其外壳（afx token/自定义壳层已删）；执行语义（bearer 内存 token、session Cookie+CSRF、mock 禁用）与快照链不变；控件基座 HeroUI，JSON 高亮 highlight.js。
- [076 RBAC / HTTP API 未闭环缺口修复](076-rbac-http-api-gap-closure/README.md)：已确认并实施完成；修复五类未闭环/缺口——Gap1 org 认证断点（operation 由 bearerAuth 单轨迁移 webuiSession + mutation 接入既有 guard + 前端补 Origin/X-CSRF-Token）、Gap2 角色/权限反向查询（两个只读 GET，复用既有权限键）、Gap3 会话列表分页与 status 过滤、Gap4 账号列表多维过滤（status/archived/roleId）、Gap5 密码策略可配置化（iam.local.passwordPolicy，默认 15/128 兼容存量）；全部落在既有模块边界，不新增权限键、不改变授权 authority。
- [077 用户与权限体系企业级完善（口令治理/会话上限/登录限流）](077-iam-security-enterprise-gaps/README.md)：已确认并实施完成；R077-001 四维评估（核心闭环完整；企业级缺口在认证因素/外部身份/口令治理/会话上限/登录限流/多实例/数据权限/多租户），R077-002 完成六项可行性分析（操作/授权留痕已有基础；API-Token、异常告警边界内可后续立项；MFA、动态风险控制需先选型/设计研究）；本批实施边界内三项——P1 口令历史与过期（扩展 passwordPolicy，受限改密复用）、P2 单账号并发会话上限（超限主动剔最旧）、P3 登录 IP 限流（扩展 http.rateLimit 路径规则，与账号锁定双维度）；全部默认关闭/不限，不留新第二套留痕，MFA/OIDC/数据权限/多租户/授权语义增强/批量运营继续为候选。
- [078 API-Token 机器访问能力（+ MFA/TOTP 选型归档）](078-iam-api-token-and-mfa/README.md)：已确认并实施完成；R078-001 设计与 R078-002 选型（推荐自研 RFC 6238，官方向量验证互通）落地为：API-Token（iam_api_tokens 凭据、Bearer ChainVerifier 复合认证、4 个管理 operation、新权限键 iam:api-token:read/write、低敏审计、secret 明文仅一次）+ MFA/TOTP（adapter 自研、绑定/确认/解绑/一次性恢复码、登录两步 mfa_required 挑战、会话 mfa_verified 标记）+ 设置中心安全页 WebUI 区块（CSRF mutation 头对齐）；授权权威与会话语义不变。
- [079 安全告警最小版（+ 动态风险控制设计归档）](079-security-alerting/README.md)：已确认并实施完成；R079-001 落地安全告警最小版（pkg/alerting Webhook 通知 + application.alerting kernel 组件（异步队列/worker/签名/重试/生命周期）+ Auth/IAM 事件接驳：账号锁定/连续认证失败/MFA 连续失败/敏感权限写操作 + alerting 配置节默认关闭、URL 与密钥不进日志）；R079-002 完成动态风险控制设计归档（因子/数据源/与 MFA、告警联动/干跑路径，实施独立立项）；不影响授权权威与审计字段域。
- [080 API-Token 多令牌管理与权限知情创建](080-api-token-multi-manage/README.md)：已确认并实施完成；按用户立项输入（参考 Cloudflare/腾讯云等主流设计）升级 078 令牌能力——权限知情创建（服务端实时投影创建者有效权限并强制 scope ⊆ 创建者权限，越权 403/未知 404/受限拒绝）、多令牌与命名/描述、数量上限（默认 5，未吊销计数）与 TTL 默认、状态机 active/disabled/expired/revoked（migration 000008）、PATCH/disable/enable 与 status 过滤、审计与敏感写告警扩展、IAM 独立页 `/admin/api-tokens`（设置中心安全页入口化，遵循「复杂功能不堆页面」原则）；授权按令牌自身 scope 生效且不自动收缩。
- [081 运维监控可视化（运行状态报表 + 服务器/进程监控）](081-ops-monitoring-visualization/README.md)：已确认并实施完成；① 对运行中持久监听/输出服务实现可视化报表图状态（supervisor units 编入 diagnostics，Ops Dashboard「监控」分区：进程/组件状态卡 + 前端滚动窗口时序图）；② 服务器（进程级）监控（标准库 runtime 指标进 Diagnostics 与 /metrics（prometheus Go/Process collector），OS 级走 node-exporter 标准路径指引）；③ 自研 SVG 图表原语（Sparkline/LineChart 入 webui/src/ui，可复用）；监控低敏、management 鉴权沿用。
- [082 WebUI 产品架构与 UI 体系重构](082-webui-architecture-rebuild/README.md)：已确认，实施完成（dev e2e 待真实后端联调）；以 temp-new-changes.md 方案（81 章「前端产品能力系统性重构」，commit 3b758bd，旧 80 节编号映射见 R003 §4.11）为输入，R001/R002/R003 完成现状审计（24 路由/25 菜单/55 operation/23 权限键）与差异分析（已满足 28 节/部分满足 42/未满足 4/候选 6）；计划按「平台底座（DataTable 增强/FilterBar+URL 同步/FormField/状态反馈体系/语义组件/token 补齐/Query-Mutation 统一层/Backend 错误分类/Adapter 层）→ 页面迁移（IAM/Audit/Ops/Org/Navigation/Session/Tokens/UserDetail/Menu 归位）→ 打磨验收（三层 QA）」落地，决策点 DEC-082-001..006 已确认执行（DEC-004 IA 归位 governance/developer 组）；验证：go test/vet、Vitest 192、mock E2E 3、lint/build 全绿，Playwright dev 20 用例待真实后端环境。

- [083 Production-grade 全栈产品重构（WebUI 产品化二期）](083-production-fullstack-reactor/README.md)：已确认，实施完成（dev e2e/移动视口真机待真实环境）；以 temp-new-changes.md 新方案与 admin-design-baseline.md 为输入，R083-001/002/003 完成差异分析与事实基线；三档落地——样式权威（lint CSS 规则+反向 fixture+137 处 :global 平台类清零）、布局骨架（100dvh/独立滚动/宽度档接线/Tab Bar 与 Footer 移除/Settings 单入口）、页面产品化（Audit 分页+时间戳、FilterBar typed filters、后端 account sorting 白名单、操作列折叠、危险操作确认、状态组件统一）；codex 多模态视觉验证闭环（P0 插值泄漏/相对时间缺键、P1 圆角 10px/行菜单折叠/Settings 宽度/统计卡圆角，5 页终审无新缺陷）；验证 go test/vet、contract-gen、Vitest 199、lint、mock E2E 4、build 全绿。
- [084 WebUI 产品化重构：逐页推翻低质量布局（第三期）](084-webui-product-ux/README.md)：已确认，实施完成（2026-09-01 全 24 路由严格可用性终审无真实 P0/P1 交互缺陷；残余为主观密度/留白意见与移动视口真机验证）。以 R084-001 全 24 路由截图 + codex 多模态审计 + 代码核对为事实基线；覆盖组织三页（目录/名录/两栏分配）、Menus（右栏截断修复+跨 namespace 标题翻译）、OpenAPI（默认选中+可操作空态）、权限目录描述解析修复、Settings 行/单选组、密码表单确认、ApiTokens 创建分组、登录/初始化产品化、会话按账号过滤、账号批量启停/归档（后端契约+逐条错误码）、FilterBar 排序分组、行操作 chip、仪表盘密度；平台新增 field-grid/split-workspace/row-actions/form-panel-bounded/trailingFields/rowMenuHeader/BulkActionBar 多动作；验证 go test/vet、contract-gen、Vitest 199、mock E2E 7、lint、build、docs-guard 全绿。
- [085 页面标签栏：自动页面标签](085-workspace-tabs/README.md)：已确认，实施完成（Rev.2 需求反转：顶部标签栏代表已打开的页面，所有正式路由自动创建并保留标签，不再要求路由显式声明；Dashboard 为固定首页标签，动态详情按实体独立，Drawer/Modal/Popover 不生成标签）。Go/TS 契约移除 WorkspaceTabPolicy；宿主 WorkspaceRegistry（12/10 上限、pinned/fixedHome、dirty/beforeClose 关闭管线、reconcile）+ 版本化低敏 localStorage（principal 隔离、allowlist 投影）+ mounted WorkspaceOutlet（inactive hidden+inert）+ 42px 标签栏（底部指示线、溢出菜单、APG 键盘）+ runtime 窄会话契约；单轨清理旧样式与 workspace-tabs zone。验证：Go build/vet/test 全绿、Vitest 234、dev/mock E2E 26 通过（仅存 5 个基线上既有失败，与 085 无关）、lint/build 全绿；视觉截图 6 张（1440/1024/390 × light/dark）。
- [086 唯一 Design Token 系统与公共框架几何稳定化](086-design-token-system/README.md)：已确认，实施完成。以 R086-001 审计为基线（styles.css 3363 行 token/规则混排：Shell/Tabs/Sidebar 约 105 处裸 px、8 处 !important、裸 hex、data-page-width 死规则、density 散点覆盖、double semantic colors、模块 :global 泄漏、双 padding），建立 primitive→semantic→component 三级唯一 token（typography/radius 补齐 10/11/15px 与 4/5/7/12px 档；preset 单源 --prim-primary*；--density-factor 推导 --workspace-tabs-height 等组件 token，删除散点覆盖）；AppShell 根布局唯一渲染 + 业务路由只渲染 ContentViewport（data-page-width 生产化、删除 .workspace-panel-scroll 双 padding、fixed bars flex:0 0 auto 修复跨路由几何漂移）；7 个模块 CSS token 化并合并宿主重复类；style lint 扩展 L2/L4/L5 守卫。验证：mock E2E 10/10（含「086 shell geometry is pixel-stable」5 路由逐像素 + compact/default 只经 factor）、Vitest 234、Go build/test、generate --check、typecheck、ESLint、build、lint-architecture 全绿；dev E2E 15/7 与纯净 HEAD 基线一致（后端未启动的环境性失败，与 086 无关）。
- [087 Settings 导航与 Workspace 隔离修复](087-settings-workspace-navigation/README.md)：已确认，实施完成（2026-08-28）。恢复默认 disabled 的 typed workspace policy：Settings/Accounts 等普通页面走单 Router Outlet，OpenAPI 保留显式 singleton；Settings 共享 `settings.layout`，workspace storage 只接纳 restorable opt-in，Accounts query 不再由隐藏 mounted panel 重放。Playwright 运行态审计记录点击目标、URL、active workspace 与可见 panel；mock 087 E2E 2/2、Vitest/Go/生成/Lint/Build 通过。
- [088 研究基线复用与增量漂移检查](088-research-baseline-reuse/README.md)：纯文档治理已完成；研究门禁通过后直接复用证据快照、适用边界和 `refresh_triggers`，实施入口只做快照后变更路径的增量判定；未命中触发器时禁止重复全量研究，失败用例和修改后回归明确归类为实施验证。

- [118 clouddrive 前后端整合](118-clouddrive-integration/README.md)：本地实现及功能验证完成，视觉基线待人工确认。

下一个任务序号为 `130`。已完成记录只保存历史证据；当前行为必须回到根 [README](../../README.md) 和对应主题文档确认。

- [124 分享快捷方式与侧栏固定](124-share-shortcuts/README.md)：第五批 F81–F100，研究、实现、集中验收及交付证据。

- [125 高级搜索与文件视图](125-file-discovery/README.md)：第六批 F101–F120，有界检索、普通分页、列偏好和范围选择。
- [126 私有标签与属性](126-file-annotations/README.md)：第七批 F121–F140，标签、属性、个性化、批量CAS及v9持久化。

- [127 文件浏览交互](127-explorer-interactions/README.md)：第八批 F141–F160，响应式导航、路径/选择菜单及同账号剪切复制粘贴。
- [128 私有版本历史](128-file-version-history/README.md)：第九批 F161–F180，覆盖保留、旧版读取/恢复/另存与比较。
- [129 HTTP离线下载](129-offline-downloads/README.md)：第十批 F181–F200，持久任务、受控来源、断点与批量管理；验收状态见任务清单。

- [130 分享链接协作](130-share-collaboration/README.md)：第十一批 F201–F220，链接权限与访客协作、真实上传和目录整理。
- [131 统一文件工作区](131-file-workspace/README.md)：第十二批 F221–F240，共用导航、全局创建/搜索、队列与账户工具已交付；文件专项48例通过，其全站4组截图检查已由132定向收口。

- [132 视觉回归收口](132-visual-regression-closeout/README.md)：修复131留下的4组截图检查，逐图审阅8张基线，相关41例通过；功能累计仍为240项。
- [133 压缩包浏览与选择解压](133-archive-browser/README.md)：第十三批F241–F260，真实ZIP/7Z、安全预览下载、目标选择及原子解压；验收状态见任务清单。

- [135 分享受众与子项继承](135-share-audience/README.md)：第十五批F281–F300，链接内账号/角色受众、独立权限、继承与实际权限预览，验收与交付见任务清单。

- [136 文件工作区视觉密度](136-file-workspace-density/README.md)：20项局部视觉与交互修正已交付，验收和提交见任务清单。

- [137 文件偏好同步与目录设置](137-file-preferences/README.md)：20项使用行为接通，包含目录视图同步、重置及文件夹点击；验证与交付以任务清单为准。

- [138 私有目录树导航](138-directory-tree/README.md)：20项使用行为，真实分支分页、路径跟随、设备开关、键盘及移动导航；验证与交付以任务清单为准。

- [139 文件时间与时区](139-file-time-zones/README.md)：20项使用行为，统一文件时间和区域偏好、自定义到期转换与DST消歧；验证与交付以任务清单为准。

- [140 账号版本保留设置](140-history-preferences/README.md)：20项使用行为，服务器策略、扩展名、数量限制和原子覆盖；验证与交付以任务清单为准。

- [143 BitTorrent下载与节点接入](143-bittorrent-downloads/README.md)：已交付受信节点 BT v1 磁力、种子、文件选择和转存。

- [144 后台解压任务](144-background-archive-tasks/README.md)：独立任务页、ZIP/7Z 后台解压、取消待处理任务及结果，验收见任务清单。

- [145 后台创建 ZIP](145-background-zip-creation/README.md)：文件和目录压缩、保存目标、任务结果与下载，验收见任务清单。
- [146 后台任务汇总](146-unified-background-tasks/README.md)：统一 ZIP、解压及两类离线下载的查看、筛选和分页。
- [147 视频外挂字幕](147-external-video-subtitles/README.md)：本人视频自动匹配、手动切换及关闭同目录 VTT、SRT 和 ASS 字幕。
- [148 回收站永久移除](148-trash-permanent-removal/README.md)：单项、多选、清空及确认范围校验。
- [149 回收站保留规则](149-trash-retention/README.md)：本人设置、期限快照和限量后台清理。
- [150 文件直链](150-file-direct-links/README.md)：批量获取、免登录读取和本人撤销。
- [151 管理端文件清单](151-admin-file-inventory/README.md)：跨账号过滤、排序、分页和只读详情。
- [152 管理端文件 Blob](152-admin-blob-catalog/README.md)：已引用对象、版本归属与主存储存在性。
- [153 文件 Blob 回收](153-blob-reclamation/README.md)：持久候选、保护期与实际主存储回收。
- [154 文件系统参数](154-filesystem-settings/README.md)：有界管理覆盖、重启生效及实际策略校验。
- [155 全局文件属性定义](155-property-definitions/README.md)：属性定义、类型编辑与旧值保留。
- [156 管理端分享清单与撤销](156-admin-share-management/README.md)：跨账号查询、活动计数及原子撤销。
- [157 管理端后台任务](157-admin-background-tasks/README.md)：跨账号文件任务查询、清理预览与逐项结果。
- [158 文件维护运行历史](158-maintenance-run-history/README.md) 记录回收站到期扫描与定时 Blob 回收的执行结果。
- [159 文件任务节点](159-file-worker-nodes/README.md) 查看节点职责、通信、统计和关联任务。
- [160 默认存储策略](160-storage-policy/README.md) 查看发布后端和 Blob 用量，管理上传限额。
- [161 存储策略文件名规则](161-storage-name-rules/README.md) 配置并试测扩展名及文件名正则。
- [162 工作区文件分页](162-workspace-pagination/README.md) 管理翻页方式、页大小和搜索游标。
- [163 文件列表连续浏览](163-continuous-file-list/README.md) 滚动追加、恢复加载和传统跳页。
- [164 文件图标规则](164-file-icon-rules/README.md) 按扩展名设置图形、主题色及图片。
- [165 EPUB 阅读器](165-epub-reader/README.md) 支持目录、章节及包内图片。
- [166 Markdown 编辑器](166-markdown-editor/README.md) 支持源码、渲染和同目录图片。
- [167 文件浏览应用](167-file-applications/README.md) 管理内置应用、平台和默认打开方式。
- [168 文件应用扩展名](168-file-app-extensions/README.md) 编辑、清空和恢复应用关联。
- [169 新建文件映射](169-file-creation-mappings/README.md) 配置文本和 Markdown 的新建菜单。
- [170 网页式文件应用](170-web-file-viewers/README.md) 配置外部阅读器和当前文件限时预览。
- [171 WOPI 发现与预览](171-wopi-view/README.md) 导入阅读器并打开当前文档。
- [172 WOPI 编辑与保存](172-wopi-edit/README.md) 授权编辑、锁定文件并保存新版本。
- [173 站点信息](173-site-profile/README.md) 管理公开名称、描述、标志、浏览器图标及法律链接。
- [174 站点地址](174-site-origins/README.md) 选择主站和备选地址，应用于分享、直链、快捷方式和文档回调。
- [175 图片编辑](175-image-editor/README.md) 裁剪、旋转、镜像、调整尺寸和保存独立副本。
- [176 音乐播放器](176-music-player/README.md) 在文件区播放本人歌曲、切歌、循环及查看内嵌标签。
- [177 Markdown 编写](177-markdown-authoring/README.md) 支持格式、链接、撤销及同目录上传图片后插入。
- [178 EPUB 续读](178-epub-reading-progress/README.md) 支持续读、双栏或单栏翻页及本机书签。
- [179 私有 HLS 视频](179-hls-playback/README.md) 支持 M3U8、自动和手动清晰度、直播及私有分片。
- [180 文本与代码编辑](180-text-code-editor/README.md) 支持代码高亮、搜索替换、跳行和编码切换。
- [181 照片查看工作区](181-photo-viewer/README.md) 支持同目录切图与按需查看拍摄信息。
- [182 Draw.io 在线编辑](182-drawio-editor/README.md) 支持新建、编辑、版本保存和下载草稿。
- [183 图片标注](183-image-annotations/README.md) 支持形状、画笔、文字、历史和带标注副本。
- [184 图片外观调整](184-image-appearance/README.md) 提供色彩微调、滤镜、原色对比和文字水印。
- [185 图片水印与 WebP 编辑](185-raster-watermarks/README.md) 提供本机图片水印、文字叠加及 WebP 编辑和副本。
- [186 图片编辑视图与导出设置](186-image-editor-viewport/README.md) 提供画布实际尺寸、缩放、平移、原图对比及有损导出质量。
- [187 图片版本保存与另存目录](187-image-version-save/README.md) 支持同格式发布新版本、过期草稿保护及另存目录。
- [188 图片标注叠层](188-image-annotation-overlays/README.md) 支持本机图片放置、变形、叠放及像素合成。
