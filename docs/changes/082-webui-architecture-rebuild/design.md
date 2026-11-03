# 082 详细设计：WebUI 产品架构与 UI 体系重构

引用研究：[R001](research/R001-webui-current-state/report.md)（现状审计）、[R002](research/R002-backend-capability-map/report.md)（后端能力清单）、[R003](research/R003-proposal-gap-analysis/report.md)（差异分析，新旧编号映射 §4.11）。需求见 [requirements.md](requirements.md)（REQ-082-001..025、DEC-082-001..006）。方案输入 `docs/changes/temp-new-changes.md`（81 章，commit `3b758bd`）。本设计按 REQ 逐条给出**实现契约**：数据结构、Props/接口、内部结构、数据流、与既有底座的关系、测试点与验收断言。

---

## 1. 背景与总体架构

### 1.1 目标形态

当前 WebUI 已是可运行的声明式托管 Admin Shell（React 19 + Vite 7 + HeroUI v3 + Tailwind v4，24 路由/25 菜单/27 lazy entry，R001）。082 的目标是**在既有权衡边界内**把差距收敛为三段交付：平台底座（语义组件 + Query 层 + token 补齐）→ 页面模式迁移（Drawer/Tree/LogTable/Directory 化）→ 打磨验收（三层 QA + 五问）。红线：静态插拔（062）、HeroUI 单轨（068）、禁 fake（方案「六十五」）、强 i18n、模块页面 owner、Backend Contract 不动（方案「六十二」）。

### 1.2 分层结构（方案「五十八/五十九/六十」）

```
Design Tokens (styles.css: font.*/control.*/info/success)
  → Primitives (HeroUI/RAC 既有: Button/Field/Select/Table/Pagination/Modal...)
  → Semantic Components (本次新增: @webui/sdk/ui 导出面保持稳定)
  → Page Patterns (PageHeader/DataCard/FilterBar/DetailDrawer/LogTable/...)
  → Business Pages (internal/module/*/binding/webui/web/*.tsx)
```

- 组件全部走 `@webui/sdk/ui`（`webui/src/ui/index.tsx`）导出，模块不直接依赖 `webui/src/ui` 内部文件（lint-architecture 强制）。
- 语义组件命名表达职责，不建 `BlueCard/PrettyBox` 类视觉命名（方案「六十」）。

### 1.3 决策点对设计的影响（DEC-082-001..006）

| 决策 | 影响设计面 | 默认推荐 |
| --- | --- | --- |
| `DEC-082-001` WorkspaceTabs 去留 | 保留则 AppShell/WorkspaceTabs + 相关 e2e 不动；删除则删组件/测试并调整 AppShell 布局与 visited 页签逻辑 | 保留为导航辅助（历史页签有 roving 键盘/可关闭，已有测试；删除收益不明确） |
| `DEC-082-002` 表单库 | 启用 RHF/zod 则 FormField 包 `Controller`，全部表单页迁移 + 回归 Vitest 151；移除则 FormField 保持受控自研 | 正式启用 RHF/zod（声明已存在，迁移收益 > 手写 useState） |
| `DEC-082-003` DataTable 边界 | 仅列可见性/密度/Sticky/Row menu，还是扩展排序持久化 | 仅增强四项；排序持久化等真实排序 API 出现后再评估 |
| `DEC-082-004` IA 归位 | audit→Governance、openapi→Developer（manifest 声明）或保持平铺 | 纳入 082（仅声明调整，无能力变化） |
| `DEC-082-005` Directory org 过滤 | 前端组合过滤 vs 后端扩展 | 前端组合（list API 无 org 参数，R002 §12） |
| `DEC-082-006` Query 层范围 | 全部列表/表单页接入 vs 新组件渐进 | 平台先建契约，页面迁移逐页接入（避免一次大重写） |

---

## 2. 平台底座详细设计（REQ-082-001..011，PHASE 4–6）

### 2.1 REQ-082-001 DataTable 增强

**现状**：`DataTable` 已存在（HeroUI Table = RAC 底座），支持选择列、loading、empty、`wrapperProps` 透传（R001 §4.4）。

**实现契约**（`webui/src/ui/data-table.tsx`，从 `ui/index.tsx` 的 DataTable 演进）：

```
interface DataTableEnhancements {
  columnVisibility?: { initial?: Record<ColumnId, boolean>; persisted?: boolean }  // 列显隐
  density?: "comfortable" | "compact" | "default"                                  // 行密度
  stickyHeader?: boolean                                                            // 粘性表头
  rowMenu?: (row) => MenuItem[]                                                    // 行操作菜单(仅渲染真实 operation)
}
```

- 列显隐：表头分组菜单（Dropdown），`ColumnId` 来自列定义；持久化存 `localStorage`（key=`webui:table:<page>:cols`），改列不触发请求。
- 密度：应用 `data-density` class → 行高 token（见 REQ-082-006 `control.tableRow`），默认 `default`。
- Sticky：`position: sticky` 于 `thead`，需 `max-height` 容器配合（页面级 `data-scroll-hijack` 场景注意滚动容器选择）。
- Row menu：每行 `⋯` 按钮展开动作菜单；**只放真实 operation**（经 ActionPermissions 投影或页面显式传入），无权限不渲染。
- 批量操作：单选/全选沿用选择列；`BulkActionBar` 已有——本次只把**会话批量吊销**（`iam.sessions.revoke` 按 IDHashes，R002 §5.2）接入；其余对象无批量后端 → 不提供批量按钮（禁 fake）。
- 测试点：列显隐切换持久化、密度档 class、sticky headers 渲染、rowMenu 权限过滤、sessions 批量吊销成功/部分失败逐项报告。

### 2.2 REQ-082-002 FilterBar / SearchInput / URL 状态同步

**现状**：各列表页自写 Toolbar + `useState` 过滤（R001 §4.5）；DataToolbar/FilterPanel 原语存在（R001 §4.4）；react-router `useSearchParams` 可用。

**实现契约**（新增 `webui/src/ui/filter-bar.tsx` + hook）：

```
// 语义组件
interface FilterBarProps<TFilters> {
  fields: FilterField<TFilters>[];          // 每个 filter: key/label/control(Select|Input|DateRange)/options/width
  value: TFilters;                            // 受控值
  onChange(value: TFilters): void;
  resultCount?: number;                       // “N 条结果”
  onClear(): void;                            // 清除全部 filter
}
interface SearchInputProps {
  value: string; debounceMs?: number;         // 默认 300
  placeholder?: string;                       // 走 i18n message ID
  onChange(v: string): void;                  // 已 debounce
}

// hook（新建 webui/src/sdk/query/useListQueryParams.ts 或 ui 内）
function useListQueryParams<TFilters>(schema: FilterSchema<TFilters>): {
  filters: TFilters; setFilters(f: TFilters): void;   // 写 URL query,非法值回退默认
  page: number; setPage(n: number): void;
  pageSize: number; setPageSize(n: number): void;
  sort: SortState | null; setSort(s): void;
}
```

- URL 映射：`/vehicles?status=active&role=admin&page=2&pageSize=20&sort=name:asc`；`useSearchParams` 读写，`replace: false` 保留 history（back/forward 可用）。
- 序列化：typed schema 声明每个 filter 的 query key 与解析（非法/缺失回退默认值，不 crash）。
- No Results 与 Empty 区分：`DataTable` 接收 `isEmptyData`（后端返回空列表）vs `hasActiveFilters`（有 filter 但 0 结果）→ 分别渲染 EmptyState(四要素) 与 NoResults(清除 filters 提示)。复用 `ui/empty-state.tsx`（REQ-082-004）。
- 测试点：hook 读写 URL（jsdom history）、debounce、非法值回退、clear filters、No Results 文案与动作、e2e refresh/back/share 稳定性。

### 2.3 REQ-082-003 FormField 规范化 + 表单库决策

**现状**：表单全手写 `useState`+submit（R001 §4.8）；`Field/SelectField/Check/Switch/FormSubmitActions` 原语存在（R001 §4.4）；`react-hook-form`/`zod` 声明但零使用（R001 §4.10-1）。

**实现契约**（`webui/src/ui/form-field.tsx`）：

```
interface FormFieldProps {
  label: string;                                // message ID
  description?: string;                         // message ID
  control: ReactElement;                        // Input/Select/Check/Switch...
  helper?: string;                              // 帮助文本
  error?: { messageId: string; params?: Record<string, string> };
  width?: "auto" | "sm" | "md" | "lg";          // 对应 width token: 240/320-480/480-640
  optional?: boolean;                           // 显示“可选”
  required?: boolean;
}
```

- 统一结构渲染：`<label>`(关联 control id) + description + control + helper/error（`aria-describedby`），placeholder 不替代 label。
- **DEC-082-002=RHF 启用**：`FormField` 内部兼容两种用法——页面用 `react-hook-form` `Controller` 包住，或直接受控；`zod` 提供 schema 校验，错误转 error code→message ID。
- 字段宽度按数据定义（方案「二十三」）：短值（日期/数量）`sm`、名称 `md`、长描述 `lg`，Settings 页整体收窄（`--content-max` 见 REQ-082-006）。
- 测试点：label/description/helper/error 关联、required/optional、RHF 校验错误映射 message ID、字段宽度 class。

### 2.4 REQ-082-004 状态与反馈语义体系

**现状**：`EmptyState`(HeroEmptyState)、`InlineAlert`、`Toast`(Heroui queue)、`ConfirmDialog`、`StatusPill`(Chip) 已存在（R001 §4.4）；SystemStatePage 七态（R001 §4.2）。

**新增/规格化**（`webui/src/ui/`）：

1. **EmptyState 结构化**（扩展既有）：`{ happened: string; why?: string; action?: { label; onAction } }` 三要素骨架（方案「三十一」），默认不显示“暂无数据”裸文案。
2. **ErrorState 分级**（`error-state.tsx`）：`kind: "page"|"section"|"inline"|"action"|"permission"|"connectivity"`；page → SystemStatePage 复用；section/inline → InlineAlert+Chip；action → 行内错误+重试按钮；permission → denied 隐藏/禁用说明；connectivity → “数据源不可达”横幅+重试（参照 Ops environment 既有能力）。局部失败不整页崩溃。
3. **StatusBadge 全状态集**（`status.tsx`）：语义枚举 `{active,inactive,enabled,disabled,pending,healthy,degraded,failed,expired,revoked}` → tone 映射；对照 080 Token 状态机、账号禁用/归档、会话状态、组织/审计状态（R002 §4.6/§5）。Badge 只用于状态/分类；ID/权限码/元数据走 `CodeText`（REQ-082-005），禁止全变 Badge（方案「二十九」）。
4. **DangerZone**（`danger-zone.tsx`）：`{ title; consequence; confirmText?; inputConfirmation?: string; onConfirm(): Promise; busy; }` → 效果说明 + ConfirmDialog + 可选输入实体名确认 + pending + 失败恢复（复用 ActionTrigger/ConfirmDialog 底座，方案「三十六」）。
5. **Feedback 分层规范**：Toast 仅 Created/Saved/Copied/Updated；Inline 校验/字段错误；Banner 全局警告/降级；Dialog 确认/危险操作（方案「三十五」）。规范写入 `docs/development/webui.md`，`lint` 不强制（documentation 约束）。

- 测试点：EmptyState 三要素、ErrorState 六分级渲染、StatusBadge 全状态 tone、DangerZone 确认流程（含输入确认、失败恢复）、Feedback 分层采用审计。

### 2.5 REQ-082-005 语义组件补齐

**现状**：Drawer 原语存在但业务零采用（R001 §4.4）；无 CodeText/TreeView/LogTable/PermissionMatrix。

**实现契约**（`webui/src/ui/`）：

```
// CodeText —— monospace 技术标识符（方案「五十一」）
function CodeText({ value, copyable?: boolean, mono?: "id"|"hash"|"code" }): JSX
// CodeViewer —— JSON/结构化展示（复用 highlight.js 仅 json）
function CodeViewer({ value, language?: "json", maxHeight?: number, initiallyCollapsed?: boolean }): JSX
// TreeView —— 无环树展示（Org 目录/菜单管理；方案「四十四」）
interface TreeViewProps<T> {
  nodes: T[]; getChildren(n): T[]; renderNode(n): JSX;
  selectedId?: string; onSelect?(id): void;
  expandAll?: boolean; ariaLabel: string;
}
// InspectorPanel —— 选中节点的详情区
function InspectorPanel({ title, fields: {label,value,mono?}[], actions? }): JSX
// DetailDrawer —— 规格化 Drawer（方案「二十二」）
interface DetailDrawerProps {
  open; onClose; title; identity?: string; status?: ReactElement;
  actions?: ReactElement[]; tabs?: {id,label,content}[]; width?: 480|560|640|720;
  loading?: boolean; error?: ErrorStateProps; deepLink?: string;
}
// LogTable —— Audit 列表（方案「四十五」）
function LogTable({ rows, columns, onRowClick, loading, empty, urlState }): JSX
// PermissionMatrix —— 按真实 taxonomy 分组（方案「二十八」非 CRUD）
interface PermissionMatrixProps {
  groups: { domain: string; permissions: { key; label; description; granted: boolean }[] }[];
  onChange?(keys: string[]): void; readOnly?: boolean;
}
```

- DetailDrawer 深链：`?selected=<id>` 或 `/path/:id`（方案「二十」），打开时写 URL、关闭时清理（`useSearchParams`）。
- Drawer 内部 HeroUI/RAC 受控 `Modal+Dialog`（现有 overlay 自绘边界保留，069）；宽度档通过 `--drawer-*` token。
- 测试点：CodeText 渲染/复制、CodeViewer JSON 高亮与折叠、TreeView 递归/选中/键盘、InspectorPanel 字段、DetailDrawer 深链/关闭/loading/error、LogTable 行点击、PermissionMatrix 分组勾选与回读 keys。

### 2.6 REQ-082-006 Token 补齐（font/control/info/success + 宽度档）

**现状**：styles.css token 已含 surface/border/space/radius/shadow/motion/zIndex/shell（R001 §4.6）；缺 font.*/control.*/info/success。

**实现契约**（`webui/src/styles.css` token 分区新增）：

```
--font-sans: system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", "Inter", sans-serif;
--font-mono: ui-monospace, SFMono-Regular, "JetBrains Mono", Consolas, monospace;   // 方案「五十一」
--font-size-xs/sm/md/lg/xl: 12/13/14/16/18px;  --font-size-page-title: 24px; --font-weight-*: 400/500/600/700;
--font-line-height-*: tight/normal/loose;
--control-height-sm/md/lg: 32/36/40px;         // 方案「五十二」32-40
--control-*-horizontal-padding; --control-radius: var(--radius-sm, 6px);
--color-info/-soft/-strong; --color-success/-soft/-strong;   // 与 081 语义对齐
--content-max-settings: 960px; --content-max-form: 760px; --content-max-detail: 1200px;  // 方案「十四」宽度档
--table-row-height-*: 40/44/48px;              // 供 data-density 使用
```

- HeroUI/Tailwind 联动：preset 语义色同步驱动 `--heroui-primary*`（既有机制延续）。
- 字体应用：body/标题/控件按 token；**技术字段**（Permission ID、Token ID、审计 hash、SessionID 摘要）默认 monospace（CodeText）。
- 测试点：token 存在性/取值断言（新增 Vitest 或 lint 校验），页面宽度档 class 应用，字体栈 fallback 顺序。

### 2.7 REQ-082-007 Command Search 入口常驻化

**现状**：`RouteSearch`（RAC Modal，Ctrl/Cmd+K、按标题/path 过滤、仅可访问路由）已存在（R001 §4.2）；缺 Topbar 常驻输入框。

**实现契约**（`webui/src/components/shell/AppHeader.tsx`）：

- AppHeader 右侧新增搜索触发输入框（HeroUI Button 样式的只读输入框，聚焦或点击打开 RouteSearch Modal）；`Cmd/Ctrl+K` 快捷键沿用。
- 实体检索（Users/Roles）不立项（R003 候选）：不新增假搜索。
- 测试点：Topbar 输入打开 Modal、快捷键、列表过滤、仅可访问路由、Enter 跳转。

### 2.8 REQ-082-008 Skeleton 分级

**现状**：`ShellSkeleton`/`PageSkeleton`/路由级 Skeleton 已存在（R001 §4.2/4.4）。

**实现契约**（`webui/src/ui/skeleton.tsx`）：

```
<PageSkeleton />（既有）→ <TableSkeleton rows={8} columns={5} /> → <PanelSkeleton height? /> → <InlineSpinner label? />
```

- 按真实内容布局生成几何占位（表头+行、卡头+body），不用全屏 Spinner 兜底（方案「三十」）。
- 测试点：各分级渲染结构与 aria-label。

### 2.9 REQ-082-009 Query / Mutation 统一层

**现状**：仅 Ops 用 react-query（`useGatedQueries`）；模块手写 api.ts+useState（R001 §4.3/4.5）。

**实现契约**（`webui/src/sdk/query/`，仅平台层，模块经 `@webui/sdk/query`）：

```
// 统一查询：为 Spec 化请求提供缓存/失效/取消/错误链
function useWebUIQuery<T>(opts: {
  key: QueryKey; enabled?: boolean; staleTime?: number;
  queryFn: (signal: AbortSignal) => Promise<T>;       // 内部 fetch(signal)
  onError?: (err: ProblemError) => void;
}): { data?; isPending; isError; error; refetch }

// 统一 Mutation：写操作 + 失效
function useWebUIMutation<TIn, TOut>(opts: {
  mutationFn: (input: TIn) => Promise<TOut>;          // 内部注入 CSRF/Origin
  invalidates?: QueryKey[];                           // 成功后失效
  onError?: (err) => void;
}): { mutate; isPending; isError; error; reset }
```

- 错误链：`ProblemError { status; code; detail; requestId?; traceId? }` → message ID 映射（REQ-082-010）；不把 HTTP 文本直出。
- 取消/防抖：列表查询 `queryFn` 接收 `AbortSignal`，FilterBar debounce 期间取消上一请求；缓存默认 `staleTime: 30s`。
- 接入策略（DEC-082-006）：平台底座先建契约 + 测试；页面迁移逐页把 `useState+api.ts` 换成 `useWebUIQuery`（先 Ops 全域、再 IAM 列表页），不一次重写全部。
- 测试点：契约 Vitest（cache/invalidate/cancel/error）、至少两个模块接入、lint 约束新增自写 fetch 报警。

### 2.10 REQ-082-010 Backend 错误分类呈现

**现状**：`InlineAlert`/错误显示为后端文本直出可能（未系统化）；无 Request ID/Trace ID 呈现。

**实现契约**（`webui/src/ui/error-state.tsx` + sdk/http）：

```
// 稳定错误码 -> message ID（模块维护映射表，如既有 setupErrorMessages 模式）
类型化 ProblemError { status, code, detail, requestId?, traceId? }
呈现：
  普通用户: "无法加载用户列表。"（messageId）
  可展开: <details> 错误详情/Request ID/Trace ID </details>（低敏字段，R002 §4.1 无 request metadata 则不显示）
```

- 禁止直出：`500 Internal Server Error`/`SQL error`/`JSON parse error`（方案「三十四」）。
- 测试点：错误映射渲染、技术详情折叠、缺失 code 时 fail-closed 低敏文案。

### 2.11 REQ-082-011 Frontend Adapter / View Model 层

**现状**：`api.ts` 直接返回后端 DTO 到页面（R001 §4.5）；权限码直接显示（PermissionPage 现状待核）。

**实现契约**（各模块 `binding/webui/web/api.ts` 演进）：

```
api.ts: 唯一 HTTP 入口（既有）
→ view-model.ts: adapter/mapper 函数（DTO -> VM）
→ 页面只消费 VM；原始 permission code 保留于 VM.technicalCode 供授权/复制

示例（权限呈现，方案「六十三/六十四」）：
DTO permission -> { label, description, domain, action, technicalCode: "iam.account.self.password.write" }
页面显示 label + CodeText(technicalCode)；授权仍用原始 code。
```

- 允许前端派生：分组/排序/派生标签/格式化/组合/渐进披露（方案「六十四/六十六」），不要求后端新增接口。
- **不虚构**：VM 只映射真实响应字段；不造 Activity/位置/历史（方案「六十五」）。
- 测试点：mapper 单测（DTO→VM 字段映射、缺字段不造假）、首个 Adapter 落地（IAM Permission 或 Token）。

---

## 3. 页面模式迁移详细设计（REQ-082-012..022，PHASE 7–8）

页面迁移统一规则：页面 owner 不变；只依赖 `@webui/sdk/*`；locale/mock/CSS Module 四步接入（binding→locale→mock→css）不变；`pnpm generate:check` 守护。

### 3.1 REQ-082-012 IAM 账号 Directory（`internal/module/iam/binding/webui/web/AccountsPage.tsx`）

- 现状：AccountsPage 已实现 search/status/role 过滤 + 表格，但呈现 card-grid（R001 §4.10-6）。
- 目标结构：
  ```
  PageHeader(标题/描述/创建动作)
  → FilterBar(status/role/archived + SearchInput)   [REQ-002]
  → DataCard(DataTable: 列=显示名/用户名/角色/状态/最近活动/创建时间/行菜单)
  → 分页(URL 化)
  Create User → DetailDrawer/Modal 依复杂度（方案「二十四」不默认巨大 Form）
  ```
- 数据：`iam.accounts.list` typed filters（R002 §5.2）；org 过滤前端组合（DEC-082-005）。
- 状态：`StatusBadge`（active/disabled/archived）；行内操作（Edit/Roles/Reset pwd/Archive）经 ActionTrigger + 真实 operation。

### 3.2 REQ-082-013 User Detail（新增 `UserDetailDrawer.tsx`）

- 结构：Overview（基本资料/状态）+ Roles（roles.accounts 关联）+ Sessions（iam.sessions.list 按账号）+ Security（MFA/令牌摘要/密码策略，只读或自服务操作）。
- **不实现 Activity timeline**（后端无明细，R003 否决）——"活动"区省略，不用占位。
- 深链：`/admin/accounts?selected=<id>` 或独立路由（取值以 082 实施时确认）。

### 3.3 REQ-082-014 Role List/Detail

- Role list DataTable（名称/描述/成员数/权限数/更新时间）+ DetailDrawer：Overview + Members（roles.accounts.list）+ Permissions（roles.permissions.read，只读呈现或改权限走 PermissionMatrix）。

### 3.4 REQ-082-015 Permission Catalog

- PermissionsPage → DataTable（权限/域/操作/描述）+ CodeText(技术码) + "被 N 个角色使用"（permissions.roles.list 影响分析，R002 §5.2）+ 详情 Drawer。

### 3.5 REQ-082-016 Audit Log Explorer + Audit Detail（Auth owner）

- AuditPage → FilterBar(operation/action/resourceType/outcome/since/until 全真实，R002 §5.1) + LogTable（时间/操作/结果/摘要 subject/resource）+ 行点击 → AuditDetailDrawer（事件 ID/时间/操作/结果 + CodeViewer 展示 hash 摘要元数据）。
- **不实现 Request metadata/Related metadata**（低敏，R003 否决）。

### 3.6 REQ-082-017 Ops Dashboard 顶栏 Context（`DashboardPage.tsx`）

- 顶部 Context 行：Environment？/Health（语义横幅既有）/Version（/management/build）/Uptime（/management/diagnostics）/Last Refresh/Refresh（轮询控制器既有）。
- 无数据层级：Dependencies/Instances/Host Resources → "未配置/不可用"态（复用 ErrorState connectivity），不 fake 图表（R002 §8）。

### 3.7 REQ-082-018 Organization Tree+Detail

- DepartmentsPage → TreeView（部门无环树，departments.tree）+ InspectorPanel（名称/父级/成员/岗位，assignments.get 真实，R002 §5.3）；无 Move/Reorder/Archive（后端无）→ 不提供 DnD/Archive。

### 3.8 REQ-082-019 Navigation Menus 复核

- MenusPage → Tree + Inspector（Label/Route/Icon/Permission/Visibility/Parent/Order 以 navigation.menus.list/update 字段为准，R002 §5.4）；DnD 仅当真实 reorder override 支持时允许；否则用表单控件编辑顺序。

### 3.9 REQ-082-020 Menu 归位 + Sidebar 细化

- manifest 声明调整：`auth.audit` ParentID→Governance 组、`openapi.docs`→Developer 组（不新增能力，DEC-082-004）。
- Sidebar：`SidebarMenu` 增加 Group Label 渲染（manifest 顶级组概念已有）；宽度 token 收敛（`--shell-sidebar-expanded/collapsed` 复核 232–248/64–72 或保留现状，实施确认）。

### 3.10 REQ-082-021 Session Management 完善（`SessionsPage.tsx`）

- 按真实字段呈现：User（关联）、SessionID 摘要、Created、Last active、Expires、Status（StatusBadge）；**无 Device 字段**（后端无，R002）→ 不生成（方案「四十二」）。
- 批量吊销：BulkActionBar + ConfirmDialog + 逐项结果（REQ-001 落地）。

### 3.11 REQ-082-022 API Token 成熟管控（`ApiTokensPage.tsx`）

- Token List：Name/Status/Scopes/Created/Expires/Last used（以 API 返回为准）+ Actions（disable/enable/rotate/revoke，真实）。
- 创建：Drawer 向导 Identity→Expiration→Scopes（owner 模块分组+搜索，scope⊆创建者权限 硬约束）→Review→Create→Reveal（Secret 仅一次，复制按钮）。
- **不假装可再读 Secret**（方案「四十三」，R002 §4.6 secret 只存 hash）。

---

## 4. 打磨与验收详细设计（REQ-082-023..025，PHASE 9–10）

### 4.1 REQ-082-023 交互态/响应式/a11y 复核

- 检查单（写入 `webui/e2e/` 新增 spec 或人工 QA 清单）：Focus 可见、键盘导航（Tab/方向/Home/End/Esc）、Contrast、Semantic HTML、Dialog focus trap、reduced-motion 降级；Icon-only 按钮含 Tooltip+aria-label（方案「五十六」）。
- 响应式：Tablet 断点（720px 既有）+ 桌面流体栅格（仅跨段页面）、页面宽度档、density 档复核。

### 4.2 REQ-082-024 三层 QA

- **Design QA**：同 header/table/filter/button hierarchy/drawer/form/status/feedback/spacing/typography 一致性（Playwright 截图 + class 断言，参照 068/069 模式）。
- **Interaction QA**：hover/focus/keyboard/loading/disabled/success/failure/back/refresh/deep link/permission denied 状态链。
- **Backend Compatibility QA**：旧能力 read/create/update/delete/authorize/revoke/configure/diagnose 全保活（清单映射 R002 55 operation，页面迁移后逐 operation 核对不丢）。

### 4.3 REQ-082-025 页面五问验收 + 性能

- 每页验收五问：Where am I / What is here / What matters / What can I do / What happened（方案「七十八」）。
- 性能（方案「七十」）：迁移后列表请求数不增、懒加载/代码分割不劣化、bundle 增量记录基线（068 记录过 ~1.06MB raw/310KB gzip，082 复核并记录）。

---

## 5. 失败语义、并发与审计

- URL 状态解析容错：非法 query 回退默认，不 crash。
- 批量吊销：逐项成功/失败报告（3.3 错误链）。
- Query 层：AbortSignal 取消；Mutation 注入 CSRF/Origin（沿用模块 mutation 契约，R002 §4.5）；服务端授权 fail closed 不变。
- 语义组件为纯客户端呈现，无新后端依赖；审计/账号/令牌写操作沿用既有 CSRF/乐观锁（409 expectedVersion 差异确认机制保持）。
- 新增 token/组件/navigation 变化必须同步 `docs/development/webui.md` 与 `documentation-impact.yaml`（单轨）。

---

## 6. 验证方案（每个任务的验收底线）

| REQ | 验证 |
| --- | --- |
| 001 | DataTable 增强组件 Vitest；sessions 批量 e2e |
| 002 | useListQueryParams Vitest + 列表页 URL 状态 e2e（refresh/back/share） |
| 003/004/005/008 | 各语义组件 Vitest；StatusBadge 状态集用例 |
| 006 | token 取值断言 |
| 007 | AppHeader 搜索入口 e2e |
| 009/010/011 | 契约 Vitest；错误链用例；mapper 单测 |
| 012..022 | 各页面 e2e 场景（Drawer/深链/URL 状态/无 fake 字段） |
| 023/024/025 | a11y 检查单 + 三层 QA + 五问验收记录 |
| 全量 | `go test ./...`、`go vet ./...`、generate:check、typecheck/lint（modules/i18n/architecture）、Vitest ≥151、Playwright ≥22、build、docs-guard |

回归基线：每个已确认任务以「不劣化 Vitest 151 + Playwright 22」为底线；决策点结论影响测试面按 DEC 调整。

---

## 7. 文件影响总览

**新增（平台底座）**：`webui/src/ui/{filter-bar,form-field,status,error-state,danger-zone,code-text,tree-view,drawer,log-table,permission-matrix,skeleton}.tsx` + 对应 `*.test.tsx`；`webui/src/sdk/query/`（useWebUIQuery/useWebUIMutation + useListQueryParams + 测试）。

**修改（平台底座）**：`webui/src/ui/index.tsx`（re-export 保持 `@webui/sdk/ui` 契约）、`webui/src/ui/data-table.tsx`（增强）、`webui/src/ui/empty-state.tsx`（结构化）、`webui/src/styles.css`（font/control/info/success/宽度档 token）、`webui/src/components/shell/AppHeader.tsx`（Command Search 入口）。

**修改/新增（业务页面）**：`internal/module/iam/binding/webui/web/{AccountsPage,UserDetailDrawer,RolesPage,PermissionsPage,SessionsPage,ApiTokensPage}(.tsx 及 view-model.ts)`、`internal/module/auth/binding/webui/web/{AuditPage,AuditDetailDrawer}.tsx`、`internal/module/ops/binding/webui/web/DashboardPage.tsx`、`internal/module/organization/binding/webui/web/{DepartmentsPage,PositionGroups+}.tsx`、`internal/module/navigation/binding/webui/web/MenusPage.tsx`；菜单归位改 `binding.go` 的 Navigation.ParentID。

**修改（Shell/文档）**：`webui/src/components/shell/SidebarMenu.tsx`（Group Label）、`webui/e2e/*.spec.ts`、`docs/development/webui.md`（样式附录/语义组件规范/Query 契约）、`webui/README.md`、此目录 `documentation-impact.yaml`、`docs/changes/README.md`。

**决策点 DEC-082-001 若删除 WorkspaceTabs**：删除 `webui/src/components/shell/WorkspaceTabs.tsx` 与相关测试（单轨 3.8）。

---

## 8. 已确认决策

（待用户确认后填写；当前为 requirements.md 的 DEC-082-001..006 推荐项，本设计按推荐项展开，确认调整则同步修订对应小节。）