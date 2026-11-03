# 068 WebUI 全量采用 HeroUI 组件库 — 需求规格

> 支撑研究：[R068-001](research/R068-001-heroui-facts/report.md)（HeroUI 现状事实）、[R068-002](research/R068-002-migration-options/report.md)（迁移方案对比）

## 1. 目标与范围

用户要求「Web UI 全量使用 HeroUI 组件库」。研究确认（R068-001）：HeroUI 并非「已接入未使用」，而是在 059 中被正式退役；当前仓库无任何 `@heroui/*`。本变更按用户指令**重新引入 HeroUI v3 并单轨整层替换 WebUI 呈现层**（方案 A，R068-002 推荐），同时保留本项目自有平台契约层（动作级权限、zone 分区注入、弹入响应、滚动体验、reduced-motion 与 experience 派生配置）。

范围：WebUI 平台（依赖、`@webui/sdk/ui` 原语实现、Shell 组件、`styles.css` 分区、主题装配）与全部业务模块页面的类名/布局校准。不改模块 Binding/Manifest/路由/权限/服务端契约/数据库/Go 行为。

## 2. 需求项

### REQ-068-A 依赖与主题装配

- REQ-A1：新增 `@heroui/react@^3.2`、`@heroui/theme@^2.4`、`@heroui/toast@^2.0`、`tailwindcss@^4`（Vite 集成 `@tailwindcss/vite`）；`pnpm add` 更新 lockfile。
- REQ-A2：`@heroui/theme` 以 Tailwind 插件接入，`extendTheme` 声明 light/dark 与既有五档 preset 主色；`data-color-scheme` 与 HeroUI `.dark` class 同步切换；`data-motion=reduce` 时 HeroUI 动效类能力近零化。
- REQ-A3：`styles.css` 保留 reset/design token（--motion/--reveal/--edge-band/--space/--z 等）/scroll & motion/reduced-motion/experience 分区；组件视觉与排版移交 Tailwind v4 + HeroUI 主题层；业务 selector 禁令不变。

### REQ-068-B SDK 原语替换（契约稳定）

- REQ-B1：`@webui/sdk/ui` 全部现有导出（Button/Field/Select/StatusPill/CapabilityBanner/Skeleton/DataToolbar/FilterPanel/DataTable/Pagination/EmptyState/InlineAlert/Toast/ConfirmDialog/Drawer/PageSection/StatCard/StatGrid/DataCard/ActionTrigger/BulkActionBar/FormSubmitActions/Reveal/RevealList 等）**导出名与调用语义保持不变**，内部改用 HeroUI 组件渲染。
- REQ-B2：`ActionTrigger` 的 pending/防重复/disabledReason/权限 denied 呈现逻辑归平台；按钮底座用 HeroUI Button（isDisabled/aria-busy 揉和 busy/denied/disabledReason；denied hidden 行为仍由平台决定）。
- REQ-B3：`zone` 分区注入、`Reveal`/`RevealList`、滚动运行时、`ThemePreferences.experience` 派生配置与 reduced-motion 完全保留（HeroUI 无对等能力）。
- REQ-B4：模块页面仅校准类名/布局（若其依赖被替换的视觉类）；模块 CSS 只保留模块专属 selector。

### REQ-068-C Shell 迁移

- REQ-C1：Sidebar/Navbar/WorkspaceTabs/AccountMenu/RouteSearch/ThemeDrawer 迁移到 HeroUI 组件（Sidebar/Navbar/Tabs/Dropdown/Kbd/Switch/Modal 等），保持既有键盘语义、focus trap、roving tabs 与 aria 断言。
- REQ-C2：移动抽屉（inert/trap）、全屏、搜索快捷键等平台交互保持不变。

### REQ-068-D 测试与质量门禁

- REQ-D1：`webui/src/ui.test.ts`、`theme-drawer.test.ts`、`app-shell.test.ts` 等 class 断言更新为新组件语义；role/aria 断言保持不变。
- REQ-D2：Playwright 14 项以 role 为主；`.mock-badge/.policy-card/.revision code/.stat-card/.data-reveal` 等 class 断言校准后全部通过，新增 068 视觉与主题截图证据。
- REQ-D3：typecheck/lint(i18n+architecture)/lint:modules/vitest/build/generate:check/e2e/go build 全绿（与 067 验证矩阵一致）。

### REQ-068-E 单轨与文档

- REQ-E1：迁移完成后删除被替换的自研视觉实现与失效样式（3.8 单轨），不保留新旧双轨。
- REQ-E2：更新 `docs/development/webui.md`、`webui/README.md`、`docs/architecture/technology-selection.md`、`docs/changes/README.md` 与 068 变更文档；059「不引入 Tailwind/组件库」边界在 authority 中标注由 068 取代。

## 3. 验收标准

- 全站（Shell + 全部业务页面）可见组件来自 HeroUI（可通过 DOM 类/role 抽查），平台契约层（权限/zone/reveal/滚动/体验配置/reduced-motion）行为不回归；
- `@webui/sdk/ui` 导出契约对模块页面兼容（模块源码改动仅限类名/布局微调）；
- 全部质量门禁绿；Playwright 截图人工复核新视觉。

## 4. 非目标（明确不做）

- 不改模块 Binding/Manifest/路由/权限/服务端契约/数据库/Go 行为；
- 不把动作级权限、zone、reveal、滚动体验等平台契约交给组件库；
- 不引入运行时插件/远程模块；不保留新旧两套 UI 双轨；
- 不做无收益的「为统一而统一」重构（组件库确无对等能力的平台层保留自研）。

## 5. 风险与未决项

- Tailwind v4 + Vite 7 + @heroui/theme 的构建集成需首任务冒烟验证（R068-002 局限）；
- bundle 显著增大（用户全量采用选择的可接受成本，设计文档给出基线测量点）；
- 视觉回归依赖截图人工复核。