# 068 WebUI 全量采用 HeroUI 组件库 — 设计方案

> 支撑研究：[R068-001](research/R068-001-heroui-facts/report.md)、[R068-002](research/R068-002-migration-options/report.md)；需求：[requirements.md](requirements.md)

## 1. 目标

按用户指令把 WebUI 呈现层单轨整层替换为 HeroUI v3（+ Tailwind v4 + @heroui/theme），保持 `@webui/sdk/ui` 导出契约与全部平台业务契约（ActionTrigger 权限呈现、zone 注入、Reveal、滚动运行时、experience 派生配置、reduced-motion）不回归，模块页面仅校准类名/布局。

## 2. 术语

| 词 | 含义 |
| --- | --- |
| HeroUI 主题层 | `@heroui/theme` 插件 + Tailwind v4 生成的组件样式与设计 token |
| 平台契约层 | 项目自有逻辑：动作级权限、zone、reveal、滚动、体验配置、reduced-motion |
| SDK 原语 | `@webui/sdk/ui` 对模块暴露的组件导出（名称语义稳定） |

## 3. 依赖与工具链装配（HER-068-A）

```text
webui/package.json +=
  @heroui/react@^3.2     @heroui/theme@^2.4   @heroui/toast@^2.0
  tailwindcss@^4         @tailwindcss/vite
vite.config.ts += tailwindcss() 插件（置于 react() 之后）
```

- 主题装配：新建 `webui/src/heroui.ts`（或 `src/theme/heroui.ts`）：`extendTheme` 声明 light/dark 语义色映射到既有 `--primary/--surface/--text/--border/--danger/--warning` 五档 preset；导出 `heroui` 插件对象与 `darkMode: "class"`。
- `applyTheme`（`theme.ts`）：在写入 `data-color-scheme` 的同一处切换 `document.documentElement.classList.toggle("dark", …)`；preset 以 CSS 变量仍由 `:root[data-theme-preset]` 覆盖，HeroUI 主题层通过 `semanticColors` 引用变量最小化重复。
- `styles.css`：新增 Tailwind 入口（`@import "tailwindcss"` + `@plugin "…heroui…"` 或 JS 配置统一到 vite 插件）；public UI 分区的组件规则折叠为语义覆写；reset/token/scroll/motion/reduced-motion/experience 分区保留；`[data-motion="reduce"]` 全局近零规则继续覆盖 HeroUI 动效（时序/透明度）。

## 4. SDK 原语替换（HER-068-B）

| 现有导出 | HeroUI 底座 | 平台保留逻辑 |
| --- | --- | --- |
| Button | `Button`（isDisabled 揉和 disabled/busy/denied/disabledReason） | — |
| Field | `Input`（label/error 映射） | — |
| Select（field-input） | `Select`/`SelectItem` | — |
| StatusPill | `Chip`（状态色映射 available/degraded/unavailable/notImplemented） | — |
| CapabilityBanner | `Alert`/`Card`（语义色） | — |
| Skeleton | `Skeleton` | — |
| DataToolbar/FilterPanel | `Card`+`Button`/自定义布局（平台样式类） | — |
| DataTable(+选择列) | `Table`（headers/rows/selection checkbox 列） | 选择状态纯函数、wrapperProps 透传 |
| Pagination | `Pagination` | pageCount/ellipsis 纯函数保留 |
| EmptyState/InlineAlert | `Card`/`Alert` | — |
| Toast | `@heroui/toast`（ToastProvider 挂到 App 根） | — |
| ConfirmDialog | `Modal`（focus ring/trap 由 react-aria 提供，标题/按钮/确认语义保留） | — |
| Drawer | `Drawer`（或 Modal placement） | — |
| PageSection/StatCard/StatGrid/DataCard | `Card` 组合 + 平台布局类 | Reveal 内建 |
| ActionTrigger | `Button` 底座 | pending 防重复、denied 隐藏/禁用、aria-busy、data-action-state |
| BulkActionBar/FormSubmitActions | `Button`/`Modal` 组合 | 既有语义 |
| Reveal/RevealList | 保持自研（IO + transition） | — |

- `ActionTrigger` 实现：`useActionAccess` 不变；disabled = busy||disabledReason||denied(disabled 模式)；`deniedBehavior=hidden` 返回 null；HeroUI Button `isDisabled` 与 `aria-busy` 透传；`data-action-state` 保留供测试。
- `DataTable`：`Table` 组件 + `aria-label/aria-busy`/emptyState 语义保持；`wrapperProps`（067 滚动劫持）继续透传到容器。
- zone 渲染：`ZoneSlot/ZoneRenderer` 不改；HeroUI Button 等被 zone 组件使用不受限（模块仍只依赖 `@webui/sdk/*`，HeroUI 组件只经 SDK 暴露）。

## 5. Shell 迁移（HER-068-C）

| 当前 | HeroUI | 平台保留 |
| --- | --- | --- |
| AppSidebar（brand/递归菜单/移动抽屉） | `Sidebar`+`Navbar`/`Menu`（或保留结构 + HeroUI 组件填充） | 菜单树构建、active 祖先、mobile inert/focus trap |
| AppHeader（topbar/breadcrumb/search/语言/主题/全屏/账号） | `Navbar`+`Dropdown`+`Kbd`+`Avatar`+`Switch` | 快捷键、语言、fullscreen |
| WorkspaceTabs | `Tabs`（roving 由 react-aria 提供） | visited 路由状态、close/refresh 语义 |
| RouteSearch | `Modal`+`Input`+`Kbd` | 路由过滤纯逻辑 |
| ThemeDrawer（含体验面板） | `Drawer`+`Switch`+`Select`+`Tabs` | experience 配置、旧主题迁移 |
| FooterStatus/MockBadge | `Chip` 等 | zone 注入点 |

- 迁移以「语义与 aria 断言不回归」为准绳；既有 e2e role 断言（Search pages/Theme settings/Sign in/Users 等）保持不变。

## 6. 页面校准（HER-068-D）

- 12+ 模块页面：仅修正被替换视觉类（如 `.item-card h3` → HeroUI Card 标题语义等）与少量布局类；操作 ID/权限/i18n 键/aria label 不动；模块 CSS 只保留专属 selector。
- org locale 一致性用例、o65/066 反馈语义、067 reveal/滚动断言全部保留。

## 7. 测试与质量门禁（HER-068-E）

- 单元：`ui.test.ts` class 断言改写为 HeroUI 语义断言；theme/theme-drawer/app-shell/blank-layout 断言校准；新增 `heroui-theme.test.ts`（dark class 切换、preset 变量、data-motion 近零）。
- e2e：14 项校准后全绿；新增 068 主题/视觉截图（亮暗、preset、桌面/移动）。
- 门禁：typecheck/lint(i18n+architecture)/lint:modules/vitest/build/generate:check/e2e/go build。

## 8. 单轨收口（HER-068-F）

- 删除被替换的自研视觉实现（`styles.css` public UI 组件规则、`ui/index.tsx` 中不再使用的视觉版式）；保留平台逻辑（纯函数、契约）。
- 迁移完成后全局搜索旧 class/旧导出残留，更新 authority 文档（webui.md、technology-selection.md、webui/README、changes/README），059「不引入 Tailwind/组件库/动画库」由 068 取代并标注。

## 9. 文件影响清单

| 区域 | 文件 |
| --- | --- |
| 依赖 | webui/package.json、pnpm-lock.yaml |
| 构建 | vite.config.ts（tailwindcss 插件） |
| 主题 | webui/src/theme.ts（dark class 联动）、新增 heroui 主题装配文件、styles.css（Tailwind 入口 + 分区重构） |
| 平台组件 | webui/src/ui/index.tsx（原语逐个替换）、webui/src/sdk/ui/index.tsx（不变）、webui/src/components/{AppShell,ThemeDrawer,RouteSearch}.tsx、webui/src/components/shell/* |
| 根组件 | webui/src/App.tsx（ToastProvider 等，如需） |
| 模块页面 | internal/module/{iam,auth,navigation,ops,organization}/binding/webui/web/*.tsx（类名/布局校准）、*.module.css（收口） |
| 测试 | webui/src 各 test、webui/e2e/webui.spec.ts、webui/playwright.config.ts、新增 heroui 主题测试 |
| 文档 | docs/changes/068-*/、docs/development/webui.md、webui/README.md、docs/architecture/technology-selection.md、docs/changes/README.md、documentation-impact.yaml |

## 10. 失败语义与验证

- Tailwind/主题装配失败 → 首任务冒烟即暴露，回退到本地基线重新装配（不进入组件替换）。
- 单组件替换后页面异常 → 该组件回滚为当前自研实现并在 tasks 记录，直到门禁绿再继续（单轨推进，不留双轨常驻）。
- 全部替换完成后必须通过 REQ-D 全部门禁与 068 截图复核。

## 11. 待确认决策

1. 采用方案 A（单轨整层替换，引入 Tailwind v4 + @heroui/theme + @heroui/toast）——推荐；
2. 推翻 059「不引入 Tailwind/组件库」边界并由本变更取代（authority 标注）——推荐；
3. 平台契约层（ActionTrigger/zone/reveal/滚动/experience/reduced-motion）保留自研，仅视觉底座换 HeroUI——推荐；
4. bundle 增大作为全量采用的可接受成本，迁移前后记录基线数字——推荐；
5. 迁移顺序：装配冒烟 → SDK 原语 → Shell → 页面 → 测试/e2e → 单轨收口与文档——推荐。