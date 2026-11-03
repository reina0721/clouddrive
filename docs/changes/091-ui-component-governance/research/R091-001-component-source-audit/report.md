# R091-001 组件来源审计与原生控件排查

## 研究问题

1. 当前 Web UI 的基础交互组件（Select/Checkbox/Switch/Input/Button/Dropdown/Modal/Tooltip/Popover/Pagination/Table/Tabs 等）分别来自哪里：成熟组件库、项目统一 UI 层、项目自研、浏览器原生 HTML、还是页面各自实现？
2. 是否存在"看起来组件化、实际视觉规则散落"或"同类组件多套实现"的情况？
3. 原生 `<select>`、`<input type="checkbox">` 等浏览器原生 UI 直接暴露给用户的位置在哪里？
4. 项目统一层（`webui/src/ui`）自身是否有低质量自研通用组件（Dropdown/Popover/Dialog 等）应替换为成熟方案？

## 证据与事实

### 依赖与技术栈（webui/package.json，快照 de1e2d9）

| 依赖 | 版本 | 角色 |
|---|---|---|
| `@heroui/react` | ^3.2.4 | HeroUI v3 视觉组件库（React Aria 之上） |
| `@heroui/styles` | ^3.2.4 | HeroUI 主题样式 |
| `react-aria-components` | ^1.20.0 | RAC headless primitives（被 HeroUI 与项目层使用） |
| `@tanstack/react-query` | ^5.90.0 | 服务端状态 |
| `lucide-react` | ^0.545.0 | 图标 |
| `tailwindcss` | ^4.3.3 | 原子样式基础 |

HeroUI v3 组件集（node_modules/@heroui/react/dist/components）覆盖：select、checkbox、switch、input、number-field、date-picker、date-range-picker、time 相关、button、dropdown、popover、tooltip、modal、alert-dialog、drawer、tabs、breadcrumbs、pagination、table、list-box、menu、radio、avatar、badge、chip、skeleton、progress、toast（经 @heroui/react toast API）、autocomplete、combo-box、empty-state、calendar、meter 等。**成熟组件库对通用 UI 能力覆盖充分。**

### 项目统一层（webui/src/ui）结构

- `index.tsx`：Pagination、Check、Switch、Drawer、DangerZone、SearchInput、FilterBar、ActiveFilters、InspectorPanel、TreeView、CodeText、EntityDetail、DetailDrawer、StickyActionBar 等
- `forms.tsx`：Field（HeroUI TextField 包装）、FormField、SelectField（**HeroUI Select 包装，含 Trigger/ListBox/Popover**）
- `feedback.tsx`：StatusBadge/StatusPill、CapabilityBanner、Skeleton、EmptyState、InlineAlert、BatchResultSummary、Toast（HeroUI 包装）
- `data.tsx`：DataTable（RAC Table）、DataTableRowMenu（**自研 popover**）、data-table-columns（**details/summary 自研菜单**）
- `layout.tsx`、`patterns.tsx`：PageFrame、ResourceIndex、BulkActionBar、StickyActionBar 等业务模式组件

### 原生 HTML 控件直接暴露清单（核心问题）

| 位置 | 控件 | 问题 |
|---|---|---|
| `webui/src/ui/index.tsx:442` | **FilterBar select 分支** → 原生 `<select className="field-input">` | 影响所有列表页筛选（账户/角色/会话/API Token/审计/岗位），下拉是浏览器原生 UI，脱离项目圆角/阴影/字号/Hover/Focus/Dark Mode；同页表单 SelectField 却是 HeroUI |
| `webui/src/ui/index.tsx:437` | FilterBar input 分支 → 原生 `<input>`（含 datetime-local） | 原生日期控件外观与项目脱离 |
| `webui/src/ui/index.tsx:108` | **Pagination pageSize** → 原生 `<select className="pagination-size">` | 影响所有分页列表的每页条数下拉 |
| `webui/src/components/shell/AppHeader.tsx:44` | 语言切换 → 原生 `<select>` | 宿主 Header 语言选择是原生 UI |
| `webui/src/components/AppShell.tsx:31` | 登录壳语言切换 → 原生 `<select>` | 同上（blank 布局） |
| `internal/module/navigation/binding/webui/web/MenusPage.tsx:127` | 菜单父级 → 原生 `<select className="field-input">` + `<input type="number">` | 页面绕过 SelectField/Field |
| `internal/module/auth/binding/webui/web/AuditPage.tsx:195` | 每页条数 → 原生 `<select>` | 页面重复实现（Pagination 已有） |
| `internal/module/iam/binding/webui/web/ApiTokensPage.tsx:156,161` | scope 多选 → 原生 `<input type="checkbox">` | 绕过统一 Check 组件 |

### 自研通用组件（应评估替换）

| 位置 | 组件 | 问题 |
|---|---|---|
| `webui/src/ui/data.tsx:112` | DataTableRowMenu 自研 popover（绝对定位 + 手动开关 + role=menu） | 无 Portal/定位碰撞/键盘导航/焦点管理；HeroUI DropdownMenu 或 RAC Menu 可替换 |
| `webui/src/ui/data.tsx:84` | data-table-columns 用 `<details>/<summary>` 自研菜单 | 同上有原生 details 展开 UI 问题 |
| `webui/src/ui/index.tsx:580-589` | **DangerZone 残留自研 dialog**：第 579 行已用 `ConfirmDialog`（RAC Modal）作确认弹层，但第 580-589 行 `open && <div role="dialog">` 自研块仍存在，会**与 RAC Modal 双份渲染** | 死代码/双弹层，应删除自研块 |
| `webui/src/components/shell/WorkspaceTabs.tsx:220` | WorkspaceContextMenu 自研（role=menu + 手动关闭，视觉复用 rac-menu-item 类） | 溢出标签菜单（181 行）已是 RAC Menu；仅 Shift+F10 上下文菜单自研 |
| `webui/src/components/ThemeDrawer.tsx:42-44` | 自研 tab（role=tab + 手动键盘 roving） | 抽屉本体已是 RAC Modal+Dialog；tab 面板可评估 RAC Tabs |
| `webui/src/components/RouteSearch.tsx:71` | 自研 listbox 搜索结果 | 可考虑 RAC ComboBox（范围较大，优先级低） |

### 已确认成熟（非自研，无需替换）

| 组件 | 依据 |
|---|---|
| `ConfirmDialog` | 已是 RAC Modal+Dialog（index.tsx:169-181，焦点/Escape/backdrop 由 react-aria 承担） |
| `Drawer`/`DetailDrawer` | 已是 RAC Modal+Dialog（index.tsx:183-192） |
| `Check`/`Switch` | 已是 RAC Checkbox/Switch（index.tsx:122-130） |
| `WorkspaceTabs` 溢出菜单 | 已是 RAC MenuTrigger/Popover/Menu（WorkspaceTabs.tsx:181-183） |
| `ThemeDrawer` 抽屉本体 | 已是 RAC Modal+Dialog（ThemeDrawer.tsx:39-40） |
| `DataTable` | 已是 RAC Table（data.tsx） |
| `Toast`/`StatusBadge`/`Skeleton`/`EmptyState`/`InlineAlert` | HeroUI 薄封装（feedback.tsx） |
| `SelectField`/`Field`/`FormField` | HeroUI Select/TextField 包装（forms.tsx） |

### Design Token 覆盖度（webui/src/styles.css）

已存在且较完善的语义 token：
- `--control-height-sm/md/lg`（含 density factor）
- `--radius-xs/sm/md/lg/xl/pill/round`
- `--surface-muted`、`--border-strong`、`--text-secondary`、`--state-indicator-width`
- 亮/暗双主题变量（`:root` 与 dark 覆盖）
- `--density-factor` 密度因子

**Token 体系本身不是主要问题**；主要问题是组件层绕过 Token 与统一组件（原生 select 使用 `field-input` 类但下拉 UI 是浏览器默认，不受这些 token 约束）。

### 与 TailAdmin 的差距（设计层观察）

用户参考 TailAdmin：其稳定感来自**单一组件来源**（同一套 Form 控件/Table/Card 贯穿所有页面）+ 克制且一致的 Surface/Spacing/Typography + 严格统一的控件高度与下拉样式。当前项目的差距核心不是"缺 Token"而是"组件来源不统一"：同一 FilterBar 内 select 是原生、表单 select 是 HeroUI，导致不同页面、甚至同一页面内控件观感分裂。

## 结论：组件来源层级建议

目标层级（对齐用户要求）：

```
成熟 Primitive/Headless（HeroUI v3 / RAC）
↓
项目统一 UI Component（webui/src/ui —— 薄封装，视觉与交互统一）
↓
业务复合 Component（DataTable、ResourceIndex、FilterBar、StickyActionBar……）
↓
具体 Page
```

### 保留 / 重构 / 替换结论

| 能力 | 结论 | 依据 |
|---|---|---|
| Select（表单） | **保留** SelectField（HeroUI Select 包装） | 已是成熟实现，覆盖 Trigger/Popover/ListBox/键盘/ARIA |
| Select（筛选） | **替换** FilterBar select 分支为 HeroUI Select（复用 SelectField 或轻量 Trigger 形态） | 现状原生 select 是用户指出的核心问题 |
| Select（每页条数） | **替换** Pagination pageSize 原生 select 为统一控件 | 同上 |
| Select（语言切换） | **替换** AppHeader/AppShell 原生 select | 同上 |
| Checkbox | **替换** ApiTokensPage 原生 checkbox 为统一 Check；DataTable 列菜单 checkbox 评估保留（RAC Table 内部） | 统一 Check 已存在 |
| Input/NumberInput | **替换** MenusPage 原生 number input 为 Field；FilterBar input 分支评估统一 | Field（HeroUI TextField）已存在 |
| DropdownMenu | **替换** DataTableRowMenu 自研 popover → HeroUI DropdownMenu/RAC Menu | 自研缺 Portal/定位/键盘/焦点 |
| Dialog/AlertDialog | **替换** DangerZone confirm 自研 dialog → HeroUI Modal | 自研缺焦点管理 |
| ContextMenu | **替换** WorkspaceTabs context-menu → RAC Menu（经 Popover） | 自研缺定位/键盘 |
| Tabs | **评估** ThemeDrawer 自研 tab → HeroUI Tabs | 范围小，可延后 |
| Table | **保留** DataTable（RAC Table） | 已成熟 |
| Pagination 主体 | **保留**（HeroUI Pagination 包装） | 已成熟，仅 pageSize 控件替换 |
| Tree / TreeSelect | **保留** TreeView（自研但业务复合，评估 RAC Tree） | 业务语义组件可自研；RAC 提供 Tree 可评估 |
| Toast | **保留**（HeroUI toast） | 已成熟 |
| FilterBar 结构 | **重构**：统一字段控件来源 + 保持 ActiveFilters/结果数/清除语义 | 结构合理，问题在控件来源 |

### 页面级自定义检查（业务语义组件可自研）

`UserStatusBadge`（StatusBadge 语义封装）、`PermissionRiskBadge`、`PermissionMatrix`、`AccountSecuritySummary`、`RuntimeHealthPanel`（MetricCard）、`RoleAssignmentEditor`（Check 组合）、`AuditTimeline`（DetailDrawer 内容）——这些是业务复合组件，自研合理，保留。

## 完整组件来源矩阵（用户要求逐项审计的基础交互组件）

| 组件能力 | 来源 | 状态 |
|---|---|---|
| Select（表单） | HeroUI Select 经 `SelectField` | ✅ 成熟 |
| Select（筛选） | 原生 `<select>`（FilterBar） | 🔴 替换 |
| Select（每页条数） | 原生 `<select>`（Pagination/AuditPage） | 🔴 替换 |
| Select（语言切换） | 原生 `<select>`（AppHeader/AppShell） | 🔴 替换 |
| Combobox / Search Select | 未使用（RouteSearch 自研 listbox 近似） | 🟡 可选 |
| Cascader | 未使用 | — |
| DatePicker / DateRangePicker / TimePicker | 未使用（AuditPage 用原生 datetime-local） | 🟡 后续 |
| Checkbox | RAC Checkbox 经 `Check`（业务页面大部分）+ ApiTokensPage 原生 | 🟡 部分替换 |
| Radio | 未使用 | — |
| Switch | RAC Switch 经 `Switch` | ✅ 成熟 |
| Input / Textarea | HeroUI TextField 经 `Field` + FilterBar 原生 input | 🟡 部分统一 |
| NumberInput | 原生（MenusPage） | 🔴 替换 |
| PasswordInput | HeroUI TextField（Field type=password） | ✅ 成熟 |
| Button | 项目 `Button`（HeroUI Button 底座） | ✅ 成熟 |
| DropdownMenu | 自研 popover（DataTableRowMenu）+ RAC Menu（WorkspaceTabs 溢出） | 🔴 部分替换 |
| ContextMenu | 自研（WorkspaceContextMenu） | 🔴 替换 |
| Popover | RAC Popover（SelectField/溢出菜单）+ 自研（行菜单） | 🟡 部分替换 |
| Tooltip | 未使用（无需求） | — |
| Command / CommandPalette | 自研（RouteSearch/CommandPalette） | 🟡 可选 |
| Dialog / AlertDialog | RAC Modal（ConfirmDialog/Drawer）+ DangerZone 自研残留 | 🟡 清理残留 |
| Drawer / Sheet | RAC Modal+Dialog（Drawer/DetailDrawer/ThemeDrawer） | ✅ 成熟 |
| Tabs | 自研（ThemeDrawer tab） | 🟡 评估 |
| Breadcrumb | 未使用（布局选项） | — |
| Pagination | 项目 `Pagination`（HeroUI 底座）+ 原生 pageSize select | 🟡 部分替换 |
| Table / DataTable | RAC Table 经 `DataTable` | ✅ 成熟 |
| Tree | 自研 `TreeView`（业务复合） | ✅ 保留 |
| TreeSelect | 未使用 | — |
| Tag / Chip / Badge | HeroUI Chip 经 `StatusBadge`/`StatusPill` | ✅ 成熟 |
| Avatar | 未使用 | — |
| Skeleton | HeroUI Skeleton 经 `Skeleton` | ✅ 成熟 |
| Toast / Notification | HeroUI toast 经 `Toast` | ✅ 成熟 |
| Upload | 未使用 | — |
| Progress | HeroUI Progress（chart/metric 相关） | ✅ 成熟 |
| Empty / Loading / Error State | HeroUI 经 `EmptyState`/`ErrorState`/`Skeleton` | ✅ 成熟 |

结论：约 2/3 基础能力已走成熟组件；**约 1/3 存在来源分裂**（原生 select/checkbox/input 与自研 popover/dialog/menu），正是本次重构要收敛的部分。

## 局限与有效期

- 本快照基于 commit de1e2d9；`webui/src/ui` 与业务页面在后续轮次如有组件层变更需刷新本档案。
- HeroUI v3 组件能力以 node_modules 已安装版本为准；具体 Select/Dropdown 的 API 形态在实施计划中再确认（research 不承诺 API 细节）。
- 未评估：RouteSearch 的 RAC ComboBox 替换（范围大、收益中），列为可选项。

## 对本任务的影响

- 实施计划必须覆盖：FilterBar select/input 分支、Pagination pageSize、语言切换（宿主两处）、MenusPage select/number、AuditPage pageSize、ApiTokensPage scope checkbox 的**统一替换**。
- 自研通用组件（DataTableRowMenu、data-table-columns、WorkspaceContextMenu、ThemeDrawer tabs）**替换为 HeroUI/RAC**；DangerZone **删除自研双弹层残留**（确认弹层已是 RAC ConfirmDialog）。
- 替换后必须二次扫描确认零原生 select/零自研 popover/零页面级 checkbox。
- 设计层：以现有 Token 为基础，补齐 FilterBar 控件高度/间距一致性，不新增第二套视觉。
