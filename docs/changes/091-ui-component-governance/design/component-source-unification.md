# 091 详细设计：统一组件来源与基础交互组件治理

## 摘要与关键决策

- 决策 1：**以 HeroUI v3 / React Aria 为唯一成熟组件来源**，项目统一层 `webui/src/ui`
  只做薄封装（视觉/API 收敛），不重新实现通用交互（Select/Checkbox/Dropdown/Dialog/
  Popover/Menu 等）。
- 决策 2：**FilterBar 是本次重构的核心**：其 select/input 分支从原生 HTML 改为
  HeroUI/RAC 统一控件，消除"同一筛选区三种来源"。
- 决策 3：**自研通用组件替换为成熟方案**（DataTableRowMenu、data-table-columns、
  WorkspaceContextMenu、ThemeDrawer tabs），**删除已替换后的自研残留**（DangerZone
  双弹层中的自研 dialog 块）；业务复合组件保留。
- 决策 4：**不新增视觉组件库**，不复制 TailAdmin 视觉，只迁移组件治理原则。

## 组件来源层级（目标）

```
HeroUI v3 / React Aria（成熟 Primitive）
  └─ webui/src/ui（项目统一 UI 层：SelectField/Check/Switch/Field/DataTable/
     Pagination/FilterBar/StatusBadge/DangerZone/…）
       └─ 业务复合组件（PermissionMatrix、AccountSecuritySummary、
          RoleAssignmentEditor、RuntimeHealthPanel…）
            └─ 具体 Page
```

## 模块边界与统一控件契约

### 1. Select 统一

现状：`SelectField`（HeroUI Select 包装，表单用）与原生 `<select>`（筛选/分页/语言）并存。

目标：所有用户可见 Select 走同一实现。设计两种形态：

- `SelectField`（已有）：Label + HeroUI Select，用于表单字段。
- FilterBar 筛选 select：复用 HeroUI Select 但保持紧凑行内形态（Label 内联 + Trigger）。
  实现方式：在 `webui/src/ui` 增加内部 `FilterSelect`（基于 HeroUI Select 的紧凑包装），
  供 FilterBar 使用；对外不暴露为页面 API，避免再造第二个公共 Select。

替换点：
| 位置 | 现状 | 改为 |
|---|---|---|
| `ui/index.tsx:442` FilterBar select 分支 | 原生 `<select className="field-input">` | HeroUI Select 紧凑包装 |
| `ui/index.tsx:108` Pagination pageSize | 原生 `<select className="pagination-size">` | 同紧凑 Select |
| `components/shell/AppHeader.tsx:44` 语言 | 原生 `<select>` | 同紧凑 Select（无边框 icon 形态可保留 trigger 样式） |
| `components/AppShell.tsx:31` 登录壳语言 | 原生 `<select>` | 同紧凑 Select |
| `MenusPage.tsx:127` 父级 | 原生 `<select className="field-input">` | `SelectField` |
| `AuditPage.tsx:195` pageSize | 原生 `<select>` | 同紧凑 Select |

### 2. Input / NumberInput 统一

现状：`Field`（HeroUI TextField 包装）已有；FilterBar input 分支与 MenusPage number input 是原生。

目标：
- FilterBar input 分支：保持原生 `<input>`（文本搜索/时间输入不需要自定义下拉，原生
  语义合理）但**统一视觉**：改用与 HeroUI Input 相同的样式 token（`field-input` 类已
  有，评估是否切换到 HeroUI Input 的紧凑形态）。时间范围（datetime-local）因原生
  日期选择器不可定制，**保留原生但样式统一**，并在设计中标注（DatePicker 替换列为
  后续项，避免范围膨胀）。
- MenusPage number input：改为 `Field type="number"`（HeroUI）。

### 3. Checkbox / Switch 统一

现状：`Check`/`Switch`（RAC 包装）已有，AppearancePage/NotificationsPage/RolesPage/
AccountsPage/AssignmentsPage 均用统一组件。ApiTokensPage scope 用原生 checkbox。

目标：ApiTokensPage scope 多选改为 `Check` 组件。

### 4. DropdownMenu 统一

现状：`DataTableRowMenu` 自研 popover（绝对定位 + 手动开关 + role=menu，无
Portal/定位碰撞/键盘导航/焦点管理）。

目标：改为 HeroUI DropdownMenu（或 RAC Menu + Popover）。`DataTableRowMenu` 保留其
"主操作内联 + 其余折叠"的业务结构，但弹出层用成熟 DropdownMenu：
- Trigger = 主操作按钮 + "更多"按钮
- Popover = HeroUI DropdownMenu，含危险项隔离（DangerItem 样式）
- 键盘/焦点/定位由 HeroUI/RAC 提供

### 5. Dialog / AlertDialog 统一

现状：`ConfirmDialog`/`Drawer` 已是 RAC Modal+Dialog（焦点/Escape/backdrop 由 react-aria
承担）。**`DangerZone` 存在双弹层残留**：第 579 行已用 `ConfirmDialog`（RAC Modal），
但第 580-589 行 `open && <div role="dialog">` 自研块仍存在并会双份渲染。

目标：**删除 DangerZone 的自研 dialog 残留块**，仅保留 RAC ConfirmDialog（并补上
inputConfirmation 输入确认能力到 ConfirmDialog 或 DangerZone 内联表单——确认对话框
需支持"输入标识符以确认"的业务语义）。`ConfirmDialog` 保持 RAC 实现。

### 6. ContextMenu 统一

现状：`WorkspaceTabs` 的溢出标签菜单已是 RAC Menu（181-183 行）；仅
`WorkspaceContextMenu`（Shift+F10 上下文菜单，220 行）是自研 `role="menu"`（视觉复用
rac-menu-item 类、交互自研）。

目标：`WorkspaceContextMenu` 改为 RAC Menu（经 MenuTrigger/Popover），与溢出菜单同源。

### 7. data-table-columns 菜单统一

现状：`<details>/<summary>` + 原生 checkbox 的列显隐菜单。

目标：改为 HeroUI DropdownMenu + Check（列勾选）。保留列显隐业务逻辑。

### 8. Tabs（ThemeDrawer）——评估项

现状：ThemeDrawer 自研 tab（role=tab + 手动键盘）。

目标：评估改用 HeroUI Tabs / RAC Tabs；若改动面小（仅 ThemeDrawer 内两三个面板）
则替换，否则记录为后续项。**计划默认替换**（RAC Tabs 已有键盘/焦点管理）。

### 9. 保留的自研/业务组件（不替换）

- `DataTable`（RAC Table）——保留
- `TreeView`——业务复合，保留（RAC Tree 评估列为后续）
- `StatusBadge`/`StatusPill`/`CapabilityBanner`/`InlineAlert`/`BatchResultSummary`/
  `Skeleton`/`EmptyState`/`Toast`——HeroUI 薄封装，保留
- `SelectField`/`Field`/`FormField`/`Check`/`Switch`——统一层，保留
- `PermissionMatrix`/`PermissionRiskBadge`/`AccountSecuritySummary`/
  `RuntimeHealthPanel`（MetricCard）/`RoleAssignmentEditor`——业务复合，保留
- `SearchInput`——保留（搜索框，原生 input 语义合理 + 统一样式）

## 设计 Token 与样式约束

- 所有替换控件必须使用现有 token：
  - 高度：`--control-height-sm/md/lg`（含 density factor）
  - 圆角：`--radius-*`
  - 表面：`--surface-muted`/`--surface-raised`/`--surface-overlay`
  - 边框：`--border`/`--border-strong`
  - 文本：`--text-primary`/`--text-secondary`
  - 状态：focus ring（现有 focus token）、hover/selected/disabled/danger（现有语义）
- 禁止在页面/组件里新增 magic number 覆盖这些 token；必要的新 token 由 `styles.css`
  统一声明。
- FilterBar 控件一致：同一高度（`--control-height-sm`）、同一圆角、同一 Label 样式、
  同一 gap；筛选字段间距统一。

## 数据与控制流

- 替换不改变数据流：FilterBar 的 `FilterBarField` 契约（key/label/control/value/
  onValueChange/options/placeholder/inputType/active）保持不变，仅渲染实现更换。
- DataTableRowMenu 的 `renderRowMenu` 契约（items: key/label/onSelect/danger）保持，
  仅弹出层实现更换。
- DangerZone 的 props（title/consequence/confirmTitleText/inputConfirmation/confirmLabel/
  cancelLabel/busy/onConfirm）保持，仅确认弹层实现更换。
- WorkspaceTabs context-menu 的 items/onSelect 契约保持，仅弹出层实现更换。

## 状态与生命周期

- 各弹出层（DropdownMenu/Popover/Modal）的 open 状态由 HeroUI/RAC 管理，替换自研
  `useState(open)` 手动管理；组件卸载时由库负责清理。
- 无新增资源所有权；无新增并发。

## 错误与失败语义

- 替换不改变错误语义；FilterBar/表单校验（error 态）由 Field/SelectField 已有机制承载。

## 并发与安全

- 无并发新增；无安全边界变化（CSRF/权限不变）。

## 配置与迁移

- 无新增配置。
- 单轨演进：替换完成后删除自研旧实现（data-table-row-menu-popover CSS、
  data-table-columns details/summary CSS、danger-zone-confirm 自研 dialog 逻辑、
  workspace-context-menu 自研逻辑），不留双轨。

## 文件影响清单

| 文件 | 动作 |
|---|---|
| `webui/src/ui/index.tsx` | FilterBar select/input 分支、Pagination pageSize、DangerZone confirm 替换 |
| `webui/src/ui/forms.tsx` | 增加紧凑 FilterSelect（内部），SelectField 微调（如需） |
| `webui/src/ui/data.tsx` | DataTableRowMenu → HeroUI DropdownMenu；data-table-columns → DropdownMenu + Check |
| `webui/src/ui/feedback.tsx` | 无（保留） |
| `webui/src/ui/patterns.tsx` | 如涉及（BulkActionBar 等确认） |
| `webui/src/ui/action.tsx`（如有） | 确认 |
| `webui/src/components/shell/AppHeader.tsx` | 语言 select → 统一 Select |
| `webui/src/components/AppShell.tsx` | 登录壳语言 select → 统一 Select |
| `webui/src/components/shell/WorkspaceTabs.tsx` | context-menu → RAC Menu |
| `webui/src/components/ThemeDrawer.tsx` | 自研 tab → RAC Tabs |
| `internal/module/navigation/.../MenusPage.tsx` | 父级 select → SelectField；number → Field |
| `internal/module/auth/.../AuditPage.tsx` | pageSize select → 统一 Select |
| `internal/module/iam/.../ApiTokensPage.tsx` | scope checkbox → Check |
| `webui/src/styles.css` | 删除被替换的自研 CSS；新增/调整统一控件样式（token 驱动） |
| 测试 | FilterBar/Select/Dropdown/DangerZone 单测更新；mock E2E 断言更新（如依赖原生 select 的 selector） |
| 文档 | `docs/development/webui.md` 组件来源层级小节 |

## 验证方案

1. 单元：`ui` 层组件测试（FilterBar select 渲染为 HeroUI Select、DangerZone 用 Modal、
   DataTableRowMenu 用 DropdownMenu）。
2. 类型：`pnpm typecheck`。
3. lint：`eslint .`、`lint-architecture`、`lint-i18n`。
4. 单测：`vitest`（现有 251 不回归）。
5. E2E：mock Playwright 19/19 不回归；新增/更新依赖原生 select selector 的断言
   （原 084 测试断言 `.filter-bar select` 数量——需改为 HeroUI Select 的语义断言）。
6. 二次扫描：grep 确认业务页面与宿主无用户可见原生 `<select>`、无自研
   popover/dialog/menu 残留；证据记录 tasks.md。
7. Go 侧不受影响（纯前端）；`webui generate --check` 不受影响（无新契约）。

## 风险与未决项

- 风险：HeroUI Select 在 FilterBar 紧凑形态下的高度/间距需调试，可能暴露 HeroUI
  默认样式与项目 token 的差异；计划预留"FilterSelect 紧凑样式"实现任务。
- 风险：mock E2E 中原生 select 相关 selector（084 测试 `.filter-bar select`）需改为
  统一组件的可访问名断言，避免脆弱。
- 未决：datetime-local 时间范围控件（AuditPage 筛选）保留原生样式统一，DatePicker
  替换列为后续项（避免本任务范围膨胀）——设计中已标注。
- 未决：ThemeDrawer Tabs 替换范围小，计划默认做；若 HeroUI Tabs 与该面板交互冲突
  则记录为后续项。
