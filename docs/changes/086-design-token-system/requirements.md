# 086 需求规格：唯一 Design Token 系统与公共框架几何稳定化

引用研究：[R086-001](research/R086-001-current-style-audit/report.md)。

> 实施状态：已确认并全部实现（round 2–5），验收标准 1–6 已验证满足（逐项证据见
> [tasks.md](tasks.md) 的 QA-086-001）。mock e2e 10/10（含跨 5 路由逐像素几何断言、
> density/theme/preset 只经 token）、Go/TS/lint/build/docs-guard 全绿；dev e2e 15 项
> 失败经 stash 对比确认为既有基线（与 086 无关）。

## 1. 目标

建立仓库唯一的 Design Token 系统，使后台公共框架（AppShell/Header/Sidebar/WorkspaceTabs/
Table/Form 容器）在不同路由、light/dark、compact/default density 与主题 preset 切换下
几何尺寸逐像素稳定；任何尺寸/颜色/间距/排版调整只通过 token 生效，禁止 magic values、
页面特例 CSS、!important、重复变量或局部补偿。

## 2. 功能要求

| ID | 要求 |
| --- | --- |
| `REQ-086-001` | 建立三级 token：**primitive**（基础尺度 scale、spacing、font-size、line-height、radius、border-width、surface/text/primary 色板、control-height……）、**semantic**（page/surface/text/accents/status/border 等页面语义）、**component**（header/sidebar/workspace-tabs/table/form/button 等组件级）。 |
| `REQ-086-002` | `--workspace-tabs-height` 必须是组件 token，由全局 density/size primitive（如 `--size-control-*` 或 `--density-scale`）推导；不得在组件或样式里写死 42px。Header 高度、Sidebar 尺寸同理由组件 token 消费。 |
| `REQ-086-003` | AppShell 由根布局唯一渲染；**业务路由只能渲染 ContentViewport**。ContentViewport 提供唯一滚动容器与内容宽度语义（`data-page-width`），消除 fallback `.page-viewport` 与 panel `.workspace-panel-scroll` 的双 padding 复制。 |
| `REQ-086-004` | 公共组件（Header/Sidebar/WorkspaceTabs/Table/Form/Button 等）只能消费对应 component token；业务页面不得重新定义、覆盖或复制公共组件的尺寸、颜色、间距、typography token。 |
| `REQ-086-005` | 清除仓库内散落的 magic values（独立 px、hex、font-size、padding/margin 数值、z-index 等），统一改为 token 引用；删除失效/重复变量（如 `data-page-width` 死规则、重复 color-preset 色板、双 padding 定义）。 |
| `REQ-086-006` | 禁止 `!important` 用于样式纠正；现有 8 处 !important 与页面级特例覆盖必须从源头移除。 |
| `REQ-086-007` | light/dark、preset、compact/default density 全部只通过 token 系统（`:root`/`[data-color-scheme]`/`[data-theme-preset]`/`[data-density]` → semantic/component token）生效；删除散点 density 覆盖选择器。 |
| `REQ-086-008` | 业务模块 CSS（7 份 `*.module.css`）的 `:global` 裸选择器、裸色值、裸 px、重复语义全部裁决迁移到 token 或宿主 component token；模块不得再建立平行样式规格。 |
| `REQ-086-009` | 新增页面与组件必须复用现有 token（lint/脚本守护），不允许再创建平行的一套样式规格。 |

## 3. 非目标

- 不引入第三方样式/CSS-in-JS 库；继续使用 Tailwind v4 + HeroUI + 平台 styles.css。
- 不重设计视觉语言（不改变配色/圆角/间距的既有观感，只把数值收敛到 token）。
- 不迁移非 WebUI 的 frontend/ 目录。
- 不修改 Go 端任何样式/布局。
- 不一次性重写全部业务页视觉；只做 token 收敛与污染清扫，保持视觉回归可控。

## 4. 验收标准

1. 后台全部页面（≥24 路由）在 1440×1000 / 1024×768 / 390×844 下，Header/Sidebar/
   WorkspaceTabs 的几何尺寸（含顶部、底部、高度、边框）逐像素稳定；切换任何路由 Shell
   几何不变（Playwright computed-style 快照对比）。
2. light/dark、五种 preset、compact/default 切换后，Shell 与 ContentViewport 尺寸变化
   只来自 token（无样式警告、无 layout shift 补偿规则）。
3. `--workspace-tabs-height` 可由 density primitive 推导出两个及以上不同值（compact 与
   default 不同或证明其语义），且 `.workspace-tabs` 与 ShellSkeleton 同源消费。
4. 全库（host + 模块 CSS）grep 无新增裸 px/hex 于公共组件规则；`!important` 计数回 0；
   `data-page-width` 有生产端且无死规则。
5. Vitest、build、lint、Playwright dev/mock E2E 全绿；docs-guard 通过；authority 同步。
6. 业务模块不再出现与宿主 primitives 重复的色板/间距/字号定义（lint 脚本守护）。

## 5. 待确认决策

| ID | 决策 | 计划值 |
| --- | --- | --- |
| `DEC-086-001` | token 分层落点 | styles.css 内建 `:root`（primitive）+ semantic 层 + component 层；`@property` 声明类型化 token；每组件一个 `--<component>-*` 命名空间 |
| `DEC-086-002` | density 推导管道 | 全局 `--size-scale`/`--density-factor` primitive → `--size-control-{sm,md,lg}`、`--workspace-tabs-height`、`--shell-header-height` 等 component token；移除 `[data-density]` 散点覆盖 |
| `DEC-086-003` | ContentViewport 形态 | 宿主单个 `ContentViewport` 组件作为唯一滚动/宽度容器（融合 ScrollExperience + `data-page-width`）；fallback 与 mounted panel 共用它 |
| `DEC-086-004` | 模块 CSS 迁移策略 | 可映射的裸值改为 token 引用；模块专属复杂布局保留 `.module.css` 但只消费 token；确有公共语义的 `:global` 收敛到宿主 component token |
| `DEC-086-005` | 守护 | 新增 lint 脚本：禁止公共组件规则的 `!important`/裸 px/hex；禁止模块 CSS 覆盖宿主 component selectors |