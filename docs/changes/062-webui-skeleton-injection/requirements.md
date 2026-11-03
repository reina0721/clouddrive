# 062 需求规格：WebUI 骨架与注入点设计体系

状态：研究门禁已通过（R062-001/R062-002），计划待确认。本文件描述目标设计和验收标准；实现只执行 tasks.md 中已被确认的任务 ID。

## 1. 背景与目标

当前 WebUI 已具备模块化的静态插拔链路（`webui.Binding` → 生成 registry → Manifest 投影 → 宿主懒加载），但注入面只有 Route（内容区页面）、Navigation（菜单）、Locale、Mock 四类；骨架分区组件存在却没有类型化注入点，交互元素没有统一状态链与动作级权限契约，图标目录硬编码。用户目标是建立以「骨架 + 注入点」为核心的 Web UI 设计体系，并确认当前骨架设计单薄、需要升级进阶。

本变更的目标：

- **G1 分区注入点**：骨架核心区域（顶栏操作区、侧边栏辅助区、页头区、标签页栏操作区、底部状态区）提供类型化注入点；内容区继续由 Route 承担。
- **G2 骨架进阶**：升级骨架本身——页头/批量操作/内容容器/页签栏/底部状态形成可复用的规范容器与视觉基调，各分区组件支持 zone 注入。
- **G3 交互规范**：全部可交互元素纳入统一行为契约与状态链（hover/active/disabled/loading/成功/失败），并支持动作级权限呈现控制。
- **G4 轻量接入**：新增业务模块声明自身骨架/交互内容时，只写模块内 Binding 声明与 web facet，不修改宿主核心、SDK adapter 或生成器源码；宿主/SDK/generator 只随真实平台能力变更升级。
- **G5 可插拔语义**：保持源码/构建期静态插拔（生成 lazy registry + Manifest 门禁），不引入运行时插件、远程模块或第二套路由/授权。

## 2. 范围

### 2.1 实现范围

- `internal/webui` 契约：`Binding` 增加类型化 zone 字段（分区注入点）、受控图标目录校验、动作级权限引用校验、zone locale 覆盖校验。
- Manifest/投影：新增 `zones`（含动作级 access）投影，沿用 access/availability/导航策略门禁；mock manifest 同步投影。
- 生成器：生成 zone 懒加载 registry 与 mock 支持；`generate:check` 覆盖。
- SDK：新增 `@webui/sdk/zone` capability（v1）；`@webui/sdk/ui` 增加交互状态链原语（action/pending/禁用原因/反馈契约）；`@webui/sdk/runtime` 增加动作权限查询。
- 宿主骨架：AppHeader 注入区、AppSidebar 面板区、WorkspaceTabs 操作区、Footer 状态区、PageHeader zone、页面容器与批量操作条原语；design token 扩展（层级缩进、状态 token）。
- 图标目录：宿主受控 IconID 目录（Lucide 映射集中声明），`MenuIcon` 单轨迁移，服务端校验 iconId。
- 真实用例：至少一个业务模块实际声明并校准一个分区注入点与一组交互原语（与模块既有页面同轨升级），其余模块保持只读兼容。
- 文档与质量链：`docs/development/webui.md`、模块开发指南、`webui/README.md`、文档影响记录；Go/WebUI 门禁、反向 fixture、E2E、视觉矩阵、chunk 冷加载验证。

### 2.2 依赖与既有基线

- 保留：React、React Router、i18next、TanStack Query、React Hook Form、Zod、Lucide（依赖结论沿用 059）。
- 继承边界：048「业务模块持有 WebUI、宿主只装装配线」；053「不建立万能 Contribution」；056「Navigation 只管理已注册菜单启停/父子/排序，不建第二套路由或授权」；059「静态可插拔、生成 registry 唯一 import 汇合点、不引入 Tailwind/动画库/UI 运行时」；060/061「托管与数据源环境、全 WebUI mock」。

### 2.3 非目标（明确不做）

- 不引入运行时插件、远程模块、热安装/卸载、多前端独立发布、动态页面或第二套路由。
- 不引入微前端框架（single-spa/qiankun/Module Federation）、无头组件库（Radix/Headless UI）、Tailwind/动画库（059 结论保留）。
- 不建立万能 `module.Contribution`、Service Locator、`init` 注册或目录扫描。
- 不改变服务端授权模型与 operation policy（IAM Casbin Core RBAC 由 IAM 模块继续拥有）；动作级权限投影只控制呈现（显示/禁用/加载），不构成授权。
- 不新增业务页面，不把模块页面迁移进根 `webui/`；模块页面表现仍由各模块 owner 校准。
- 不改变既有 Binding 字段语义（Routes/Navigation/Locales/MockSource/Requires 兼容演进，只增加新字段）。
- 不改变数据库 schema、config、HTTP API 契约、CLI 或部署文件。

## 3. 约束

- 分区注入点必须是类型化窄契约（每类 zone 有自己的结构、校验与渲染 adapter），禁止单字段万能 map/any。
- zone 贡献组件只通过 SDK zone 契约接收有限 typed props，不得访问宿主 internal、Router singleton、Store 或隐藏全局状态；不得跨模块 import。
- 生成 registry 仍是唯一允许出现模块 SourcePath import 的构建产物。
- 所有用户可见文案继续遵守强制 i18n 契约（message ID 链路、模块自有 namespace、双语覆盖）。
- 业务 selector 不得进入宿主全局 `styles.css`；zone 渲染样式由宿主 token + 模块 CSS Module 分工。
- 动效/骨架/overlay 沿用 059 的 motion token 与 reduced-motion 决策，zone 反馈不得绕过。
- 权限、availability、i18n、资源加载任何门禁 fail closed。
- 模块声明 zone 的 source path 继续校验 owner（模块 web facet 内、符号链接不逃逸）。
- 性能：zone 贡献必须 lazy 装载，初始 Shell 不加载业务 zone chunk；禁用/未启用模块的 zone 不进入 registry 与构建图。

## 4. 验收标准

- **REQ-062-001 分区注入点**：`webui.Binding` 支持五类分区注入点（HeaderActions、SidebarPanels、PageHeaderItems、WorkspaceTabActions、FooterStatusItems），每类有独立 typed 结构、校验与渲染 adapter；内容区仍由 Route 承担。
- **REQ-062-002 声明与投影**：zone 贡献通过「模块 Binding 声明 → 生成 zone registry（lazy import）→ Manifest `zones` 投影（access/availability/策略门禁）→ 宿主分区渲染」闭环；未启用/未实现/无权限/不可用的贡献不进入 manifest 与 registry。
- **REQ-062-003 动作级权限**：Manifest 为每个动作贡献投影 access（allowed/authentication-required/denied）；SDK 提供 `useActionAccess` 与禁用原因分类（permission/unavailable/busy/invalid），页面按钮/触发器的禁用与隐藏遵循呈现权限且不构成授权。
- **REQ-062-004 交互状态链**：SDK ui 提供统一动作原语，覆盖 idle(hover/focus/active) → pending（防重复提交、aria-busy）→ success/failure 反馈（error code → message ID 链路）与禁用状态；批量操作条、表单提交/重置、卡片入口、弹窗触发器均映射该契约。
- **REQ-062-005 导航进阶**：≥3 级菜单渲染正确；层级缩进改为 token 化（`--menu-indent-step`）；祖先链激活高亮与自动展开保持；图标使用受控 IconID 目录（服务端校验取值，宿主集中映射），删除硬编码二图标 + fallback 的现状。
- **REQ-062-006 骨架进阶**：页头规范容器（zone 化 actions/status）、批量操作条、内容容器原语、页签栏操作区、底部状态区均已落地并可被模块复用；与 059 视觉基调（token/动效/skeleton）一致。
- **REQ-062-007 轻量接入**：新增模块按文档示例只写自身 Binding 与 web facet 即可接入全部注入面；除 SDK 主版本升级这一平台事件外，不需要修改宿主/SDK 核心/generator 源码。
- **REQ-062-008 mock 兼容**：显式声明 mock 环境时，zone 注入点与动作权限投影使用与真实模式一致的 mock 数据与投影（生成 registry 聚合），并保持「模拟环境」徽标语义。
- **REQ-062-009 性能与隔离**：production build 中 zone 贡献为 async chunk，初始 Shell 请求不含业务 zone；模块/宿主 import 边界继续由 `lint:architecture` 守护；新增 zone 时提供故意违规会失败的反向 fixture。
- **REQ-062-010 验收门禁**：`go test ./...`、`go vet ./...`、`pnpm lint`（含 architecture/i18n）、`pnpm lint:modules`、`pnpm typecheck`、`pnpm test`、`pnpm generate:check`、`pnpm build` 全绿；`pnpm e2e -- --workers=1` 覆盖 zone 装载、权限呈现、交互状态链与 mock；视觉矩阵（桌面/移动/深浅色）人工复核；chunk graph 审阅确认懒加载。

## 5. 关联 authority 与本文件关系

- 本文件是 062 变更的需求规格；当前行为 authority 仍是根 README 与 `docs/development/webui.md` 等主题文档。
- 实施完成后，当前结论必须同步进 `docs/development/webui.md`、模块开发指南等 authority；变更记录不成为第二套现行规范。
- 需求或验收标准发生实质变化时，返回研究阶段并重新确认。