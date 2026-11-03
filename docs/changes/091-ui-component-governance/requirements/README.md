# 091 需求

## 需求摘要

把 Web UI 从"同一项目内多套组件来源（成熟库 / 自研 / 原生 HTML 并存）"收敛为
**单一组件来源层级**：成熟组件库（HeroUI v3 / React Aria）→ 项目统一 UI 层 →
业务复合组件 → 页面。用户在不同页面之间不应再看到"这个 Select 怎么变成系统原生
的了""这个弹窗像另一个项目"这类观感分裂。

本需求是 090 后台控制台重构的组件治理补全：090 建立了 Layout/Token/页面骨架，
本需求解决**基础交互组件来源不统一**与**自研通用组件质量不足**的问题。

## 背景与客户目标

- 现状：列表页筛选下拉是浏览器原生 `<select>`（操作系统默认下拉 UI），与项目的
  圆角/阴影/字号/间距/Hover/Focus/Dark Mode 完全脱离；同一 FilterBar 内 select
  是原生、switch 是统一组件；表单 select 是 HeroUI Select 而筛选 select 是原生。
- 客户目标：整个 Web UI 明显来自**同一个设计系统、同一套组件基础设施和同一个产品**，
  而不是"自己拼出来的后台"。

## 使用场景

1. 管理员在账户列表按状态/角色筛选：下拉展开应是项目统一的下拉 UI（圆角、阴影、
   Hover、Selected、Dark Mode 一致），而不是浏览器默认列表。
2. 管理员切换每页条数（Pagination）：下拉与全站控件同风格。
3. 管理员在 Header 切换语言：下拉与全站控件同风格。
4. 管理员在表格行点击"更多"操作：弹出菜单应是统一 Dropdown（含键盘导航/焦点管理），
   而不是自研绝对定位 popover。
5. 管理员执行危险操作（归档/吊销）：确认对话框应是统一 Dialog（含焦点圈定/ESC），
   而不是自研 role=dialog。
6. 管理员在 API Token 创建时勾选 scope：复选框与全站 Check 组件同视觉。

## 范围

### 范围内

- 统一 Select/Checkbox/Input/DropdownMenu/Dialog/Popover/ContextMenu 的**组件来源**：
  优先使用 HeroUI v3 / React Aria 已提供且质量合格的实现，通过项目统一层薄封装暴露。
- 替换以下原生 HTML 控件为用户可见的统一组件：
  - FilterBar 的 select 分支与 input 分支（影响账户/角色/会话/API Token/审计/岗位筛选）
  - Pagination 的每页条数 select
  - AppHeader / AppShell 的语言切换 select
  - MenusPage 的父级 select 与 number input
  - AuditPage 的每页条数 select
  - ApiTokensPage 的 scope 原生 checkbox
- 替换以下自研通用组件为成熟方案：
  - DataTableRowMenu 自研 popover → HeroUI DropdownMenu / RAC Menu
  - data-table-columns 自研 details/summary 菜单
  - DangerZone confirm 自研 dialog → HeroUI Modal / RAC Dialog
  - WorkspaceTabs context-menu 自研 popover
  - ThemeDrawer 自研 tab（评估；小范围可延后）
- 确保所有控件遵守现有 Design Token（`--control-height-*`、`--radius-*`、`--surface-*`、
  `--border-*`、`--text-*`、focus/hover/selected/disabled/danger 状态语义）。
- 重构完成后**代码层二次扫描**：零原生 `<select>`（用户可见）、零页面级 checkbox、
  零自研 popover/dialog/menu 残留。

### 范围外（记录为后续项）

- RouteSearch 的 RAC ComboBox 替换（范围大、收益中，列为可选后续）。
- TreeView 的 RAC Tree 替换（业务复合组件，自研合理，暂保留）。
- 新增业务后端能力（Pagination/Filter/Sort/Batch/Audit 等后端已具备，无新增需求；
  如审计 time-range 日期选择器需要 DatePicker 后端支持已存在）。
- 视觉层的全面"TailAdmin 化"（不复制其颜色/卡片/布局，只迁移组件治理原则）。

## 约束

- 不引入第二套视觉组件库；在 HeroUI v3 / React Aria 覆盖不足时才评估补充 headless
  primitive（需论证并确认）。
- 不新增无收益重构：已有成熟实现（DataTable、SelectField、StatusBadge、Toast、
  Pagination 主体）保留。
- 业务语义复合组件（PermissionMatrix、StatusBadge 语义封装、RuntimeHealthPanel 等）
  保持自研。
- 遵循 AGENTS.md 3.8 单轨演进：替换后删除旧自研实现，不留双轨。

## 非目标

- 不重画所有页面视觉。
- 不引入 shadcn/ui 或其他新视觉库。
- 不改变后端契约。

## 可验收行为

1. 全站用户可见下拉（筛选/每页条数/语言/行菜单/危险确认）均为统一组件外观，
   在亮/暗主题下 Hover/Focus/Selected/Disabled 状态一致。
2. 代码层扫描：业务页面与宿主无用户可见的原生 `<select>`；无自研 popover/dialog/menu。
3. 现有功能不回归：mock E2E 19/19、Go 全绿、WebUI typecheck/vitest/eslint/build 全绿。
4. 二次扫描证据记录在 tasks.md。
