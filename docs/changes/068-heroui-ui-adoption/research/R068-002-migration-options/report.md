# R068-002 全量采用 HeroUI 的迁移方案与承载边界

## 研究问题

用户要求「全量使用 HeroUI 组件库」。研究可行引入形态、与既有平台契约的共存方式、样式 authority 安排、工作量与验证矩阵。

## 候选方案对比

### 方案 A：单轨整层替换（推荐候选）

- 新增依赖：`@heroui/react@^3.2`、`@heroui/theme@^2.4`、`@heroui/toast@^2.0`、`tailwindcss@^4` + `@tailwindcss/vite`（Vite 7 集成）。
- 主题：`@heroui/theme` 以 Tailwind 插件接入；`extendTheme` 声明 light/dark + 现有 preset 主色；`.dark` 与既有 `data-color-scheme="dark"` 对齐（applyTheme 同步切换 `document.documentElement.classList`）。
- 样式 authority：`styles.css` 保留 reset、design token（--motion/--reveal/--edge-band/--space/--z 等）、scroll & motion、reduced-motion、experience 分区；**UI 组件排版/边框/阴影/焦点环移交 Tailwind + HeroUI 主题层**（public UI 分区折叠为少量 `:where()` 语义覆写）。
- SDK 契约：`@webui/sdk/ui` 导出名与语义不变；`Button/Field/Select/StatusPill/CapabilityBanner/Skeleton/DataToolbar/FilterPanel/DataTable/Pagination/EmptyState/InlineAlert/Toast/ConfirmDialog/Drawer/PageSection/StatCard/StatGrid/DataCard` 内部改用 HeroUI 组件渲染；`ActionTrigger`（pending/denied/防重复/禁用原因）保留平台逻辑，按钮底座用 HeroUI `Button`（`isDisabled` 揉和 busy/denied/disabledReason）；Hidden-behavior 仍由平台决定；`zone` 注入、`Reveal/RevealList`、滚动运行时、`experience` 配置全部保留（HeroUI 无对等能力）。
- 迁移面：Shell（Sidebar/Navbar/Tabs/Search/AccountMenu/ThemeDrawer）→ HeroUI `Sidebar/Navbar/Tabs/Dropdown/Kbd/Switch/Modal/Select` 等；12+ 模块页面仅需对微量 class 依赖与布局断言校准；`styles.css` 业务 selector 禁令不变，模块 CSS 只保留专属内容。
- 收益：react-aria 底座（键盘/焦点/无障碍一致性）、受维护组件面、与 TailAdmin 同生态、社区主题资源。
- 成本：新增 Tailwind 构建层、bundle 显著增大（~几百 KB gzip）、视觉回归风险、既有 class 断言与快照需更新、一次性重构工作量大。
- 尾：3.8 单轨——迁移完成后删除被替换的自研视觉实现（保留平台逻辑原语），不允许新旧双轨。

### 方案 B：分层适配（否定为「不满足全量」）

- 只把部分页面级表单/表格换 HeroUI，Shell 与列表保留自研 → 不满足「全量」；双样式体系并存违背 3.8 单轨，长期维护成本最高。

### 方案 C：不引入（维持现状）

- 059/062/067 的既有决策；但用户明确要求全量采用，C 不满足指令。

## 承载边界（与既有平台契约共存）

| 平台层 | 处置 |
| --- | --- |
| 动作级权限（ActionTrigger denied 隐藏/禁用、actionPermissions 投影） | 保留平台逻辑；视觉底座换 HeroUI Button（aria-disabled/isDisabled 揉和 disabledReason） |
| zone 分区注入（Manifest zones、ZoneSlot、权限投影门禁） | 完全保留，不改 Binding/Manifest |
| Reveal/滚动运行时/体验派生配置/reduced-motion | 完全保留；reduced-motion 继续以 data-motion 统一降级，HeroUI 动画类能力（如 Modal 入场）以全局覆写近零化 |
| 路由/菜单/资源隔离/生成链 | 完全保留 |
| 样式 authority | `styles.css` 收窄到 reset/token/平台行为；组件视觉归 Tailwind v4 + @heroui/theme |

## 工作量化（整层替换）

1. 依赖与工具链装配（tailwindcss v4 + @tailwindcss/vite + 三个 heroui 包 + 主题插件）；
2. SDK UI 原语替换 ~25 个导出（含 ActionTrigger/DataTable/分页/弹窗/抽屉/Toast），导出名不变；
3. Shell 迁移（Sidebar/Navbar/Tabs/Search/AccountMenu/ThemeDrawer，含 a11y 语义保持）；
4. 模块页面校准（12+ 页面，多为类名/布局微调）+ 模块 CSS 收口；
5. 测试维护：ui.test/theme-drawer.test 等 class 断言改写；e2e 14 项以 role 为主，class 断言（.mock-badge/.policy-card/.revision code/.stat-card 等）校准；
6. 文档 authority 迁移（styles.css 分区说明、webui.md、technology-selection.md、webui/README、059 边界更新）。

## 事实与推断的区分

**事实**：HeroUI v3 需要 Tailwind v4；@heroui/theme 是 Tailwind 插件；本仓库 react 19 满足 peer；既有平台契约层（权限/zone/reveal/experience）是项目自有逻辑，HeroUI 不提供对等物。

**推断**：整层替换可在保持 `@webui/sdk/ui` 导出契约的前提下完成（模块页面改动可控）；HeroUI 动画可通过全局 reduced-motion 覆写对齐 `data-motion`；bundlesize 增大是用户选择的全量采用的可接受成本。

## 局限与剩余未知

- 未做 HeroUI v3 实测渲染与 Tailwind v4 与 Vite 7 的构建验证（实施阶段第一任务即为装配冒烟测试）；
- 视觉回归只能靠 Playwright 截图人工复核。

## 对本任务的影响

- 计划按方案 A（单轨整层替换）编写；首个任务为「依赖装配 + 主题冒烟」以尽早暴露 Tailwind 集成风险；
- 待用户确认是否推翻「不引入 Tailwind/组件库」决策并选择方案 A。