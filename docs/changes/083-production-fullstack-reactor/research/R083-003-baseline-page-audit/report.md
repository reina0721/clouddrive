# R083-003 设计基线逐页对照审计

> 研究档案（快照 `5a3def3`，研究/验证日期 2026-08-28）。判定以**真实页面代码为准**：任务给定 HEAD 为 `5a3def3`，实测仓库 HEAD 为 `1948975`（仅一条 docs/changes 计数修正提交：122→137，页面代码与 5a3def3 完全一致），本档案全部代码证据取自 HEAD 实测。所有样式/布局结论引用 R083-002 的精确清单；本档案不做浏览器渲染验证。
> 判定档位：**达标**（代码/文档证据直接支撑）、**部分**（机制在但接线/形态/覆盖有差距）、**重做**（旧结构沿用或缺陷需推倒该维度）。每页 13 个固定维度，N/A 表示该维度对页面不适用（不计入有效判定）。

---

## 1. 研究问题

082 已实施的每个页面相对 `docs/changes/admin-design-baseline.md`（27 节后台产品设计风格基准）是「达标 / 部分达标（差距清单）/ 旧结构沿用需重做」中的哪一档？按固定维度逐项打分并给出代码证据、达标率汇总、重做优先序（作为 083 页面迁移任务输入）与每页「重做 vs 保留+补齐」三档判定。

13 个固定维度（对应基线节号）：

| # | 维度 | 对应基线 |
| --- | --- | --- |
| D1 | 页面模板（List Workspace / Dashboard / Configuration / Detail / Blank …） | §七 |
| D2 | 业务 Feature 化（非原子组件堆砌、非单文件千行） | §五/§二十三 |
| D3 | DataTable 能力（列配置/排序/过滤/选择/批量/密度/Sticky/空载错/行操作） | §六/§十六 |
| D4 | FilterBar 能力（keyword/quick/advanced/chips/saved views/reset/result count） | §六/§五 |
| D5 | Detail 模式（Drawer/Modal/Page 合理选择、上下文保持） | §六 DetailDrawer |
| D6 | EntityHeader（详情实体头部：title/status/metadata/actions/breadcrumb） | §六 |
| D7 | MetricCard（KPI：label/value/trend/delta/chart/drill） | §六/§五 |
| D8 | StatusBadge 一致（统一状态集与颜色，禁每页自绘） | §六/§二十六 |
| D9 | Empty/Error/Loading 状态（状态全集逐页成语言） | §十七/§十八/§十九 |
| D10 | 危险操作确认（ConfirmDialog/输入确认/pending） | §二十 |
| D11 | 信息密度与视觉层级（§八/§十五/§二十六：不浪费空间、raw 技术标识降权） | §八/§十五/§八 |
| D12 | Table 操作列设计（1 主操作 + `...` 菜单 + 危险隔离 separator） | §十六 |
| D13 | 命名/样式污染（`:global` 泄漏、camelCase 变体、私有覆盖，R083-002 证据） | §二十三/11b |

## 2. 方法、样本与证据口径

- **样本**：`internal/module/{iam,ops,settings,organization,navigation,auth}/binding/webui/web/` 下 11 个页面组全部页面**逐页全文读取**（AccountsPage 191 行 / RolesPage 189 行 / PermissionsPage 72 行 / SessionsPage 79 行 / ApiTokensPage 138 行 / AuditPage 131 行 / DepartmentsPage 73 行 / MenusPage 92 行 / DashboardPage 146 行 + CapabilitiesPage 79 行 + monitoring-section 134 行 / Settings 8 页+Layout 25-112 行 / LoginPage+SetupPage 各 7 行 / PositionsPage+AssignmentsPage 参照）；平台组件 `webui/src/ui/index.tsx`（917 行）与 `webui/src/components/AppShell.tsx`（154 行）全文；`webui/src/sdk/query/unified.ts`、`webui/src/generated/webui-registry.ts`、`webui/src/styles.css` 定向核对。
- **证据口径**：判定必须带「文件+行号或关键结构摘录」；样式污染数字直接引用 R083-002（iam 25 / ops 75 / settings 8 / organization 5 / navigation 15 / auth 9，合计 137 处 `:global`，21 处死代码，2 处 `.toolbar` 私有覆盖，5 组 camelCase 命名分裂）。
- **历史纪律**：区分「072/080/081 已完成、082 保留的现状」与「082 迁移后新增」。Settings 页内导航/SectionNav 为 071/072 产物（`ui/index.tsx` 注释 071；`SettingsLayout.tsx` 注释 073）——按当前代码判定，不按旧记录；Ops Dashboard 为 081 产物；ApiTokens 为 080 产物。
- **与 R083-001 冲突证据的处置**：R083-001 §3/§4.10 声称「Audit 未采用 useListQueryParams」，HEAD 实测 AuditPage.tsx L44-51 **已采用**（仅 filters 部分，分页未 URL 化）；R083-001 §4.5 称 Audit FilterBar 含「since/until」，实测仅 4 个字段（operation/action/outcome/resourceType）。本档案以代码为准并修正（见 §8）。

### 2.1 平台能力存量（对照基线 §六/§七 的组件清单）

| 平台组件（ui/index.tsx） | 状态 |
| --- | --- |
| PageHeader（eyebrow/title/description/actions+zone） | 已建（L32-35） |
| DataTable（列/密度 3 档/Sticky/列显隐 persisted/选择/空态/载态 skeleton/行菜单） | 已建（L146-220）；**无排序 UI、无行详情展开、无导出/刷新、行菜单为按钮列非折叠菜单** |
| FilterBar（fields/clear/resultCount/searchInput） | 已建（L594-627）；**无 Saved Views/Active chips/高级条件形态** |
| SearchInput（防抖） | 已建（L633-660） |
| StatusBadge（SemanticStatus 10 态）与 StatusPill（CapabilityState 4 态） | **双套并存**（L686/L84），页面混用 |
| DetailDrawer（480/560/640/720 宽、identity/status/actions/loading） | 已建（L799-821） |
| BulkActionBar+ConfirmDialog | 已建（L443-464）；**全站唯一消费方 SessionsPage** |
| EmptyState / ErrorState（分级）/ InlineAlert / Toast / Skeleton | 已建；**EmptyState 仅 ApiTokens/Capabilities 消费；ErrorState 全站零消费** |
| DangerZone（含输入确认）/ ActionTrigger（权限钩子+pending） | 已建；DangerZone/FormSubmitActions 全站零消费 |
| PageSection/StatCard/StatGrid/DataCard（067-071 骨架） | 已建；**StatCard 无 trend/delta/mini chart/drill** |
| TreeView / InspectorPanel | 已建（L829-916） |
| **EntityHeader / MetricCard / ActivityTimeline** | **未建**（基线 §六 三个缺件，全站无对应组件） |

### 2.2 全站状态与能力共性（跨页面证据）

- **URL 状态同步实为「query filter 仅」**：`useListQueryParams` 声明的 filters/page/pageSize/sort 契约齐全（unified.ts L93-157），但所有消费页（Accounts/Roles/Permissions/Audit）只接 `filters`；Accounts/Roles 分页用局部 `useState(page)`，Audit 分页硬编码，`sort` URL 契约全站零消费（后端无 sort，R002 §7.3）。
- **DataTable `loading` prop 全站仅 CapabilitiesPage 使用**（CapabilitiesPage.tsx L73）；Accounts/Roles/Sessions/Audit/ApiTokens 均未接线载态。
- **DataTable 空态 5/7 页用 `<p className="page-meta">` 段落**（AccountsPage.tsx:129 / RolesPage.tsx:152 / SessionsPage.tsx:58 / AuditPage.tsx:100 / PermissionsPage.tsx:65），仅 ApiTokensPage.tsx:116 与 CapabilitiesPage.tsx:73 用 `EmptyState` 组件。
- **Pagination 平台组件仅 CapabilitiesPage 消费**（CapabilitiesPage.tsx L70，含 pageSize 档）；Accounts（L111）/Roles（L135）手写 `[...Array(pages).keys()].map(<Button>)` 页码按钮；**Audit 无任何分页 UI**（只取前 50 条）。
- **危险操作普遍缺确认**：账号归档、角色归档、Token revoke/disable、部门归档均为 ActionTrigger 直接执行；全站仅两个路径有确认（Sessions 批量 revoke 经 BulkActionBar+ConfirmDialog；Settings 账号软关闭经 ConfirmDialog）。
- **时间戳 raw 呈现**：Sessions 4 列（createdAt/lastSeenAt/idleExpiresAt/absoluteExpiresAt）直接 `CodeText` 渲染 ISO 原文（SessionsPage.tsx:45-48）；Audit occurredAt 同（AuditPage.tsx:90）。已格式化的仅有 ApiTokens expiresAt/lastUsedAt（`toLocaleString`，ApiTokensPage.tsx:121-122）、Ops formatUptime（DashboardPage.tsx:18-25）。

---

## 3. 逐页对照

### 3.1 AccountsPage（iam，191 行）——**中改（保留主结构，补齐产品化缺口）**

| 设计基线维度 | 基线要求 | 页面现状（证据） | 判定 | 差距描述 | 收敛为 083 任务输入 |
| --- | --- | --- | --- | --- | --- |
| D1 页面模板 | List Workspace：Header/Toolbar/FilterBar/Table/Bulk/Detail Drawer | Header✓ + DataTable✓ + Create Drawer✓ + DetailDrawer✓，但选中项管理用页内 `PageSection`（L139-157）、分页为手写按钮（L111） | 部分 | 有「列表+选中管理」主从形态但非标准模板；分页未组件化/未 URL 化 | 列表页模板化时统一 Pagination 组件 + page/pageSize URL 化 |
| D2 Feature 化 | feature 子目录、避免千行单文件 | 单文件 191 行；已抽 `accountStatusCell/accountSecurityCell/checklistCandidates`（L9-21） | 部分 | 未按 `features/users/{components,hooks}` 拆；业务逻辑+UI 同文件 | 拆 UserToolbar/UserDataGrid/UserDetailDrawer/UserCreateDrawer + 接 useWebUIQuery |
| D3 DataTable 能力 | 列/排序/过滤/选择/批量/密度/Sticky/空载错/行操作 | 列✓4 列（L120-125）、density✓、stickyHeader✓、columnVisibility persisted `iam-accounts`✓（L130-136）、行菜单✓（L98-107）；**排序✗（后端无 sort）**、过滤✗（FilterBar fields=[]）、选择✗批量✗、空态✗ page-meta（L129）、载态✗ | 部分 | 后端已有 query/status/archived/roleId typed 过滤（R002 §5.2）只 surface 了 query；无批量后端可保留 | DataTable 排序等后端 sort 落地后接线；空态改 EmptyState、接 loading |
| D4 FilterBar 能力 | keyword/quick/advanced/chips/saved views/reset/count | `fields={[]}` 只接 query（L112-118） | 部分 | 状态/归档/角色过滤未 surface（后端能力在，R002 §5.2） | FilterBar 补 status/archived/roleId 三字段 + active chips |
| D5 Detail 模式 | 按上下文选 Drawer/Modal/Page | Create Drawer✓ + DetailDrawer 560✓（L171-189，identity/status 头尾数据真实） | 达标 | 无 | — |
| D6 EntityHeader | 实体头 title/status/metadata/actions | 无独立 EntityHeader；选中项用 PageSection 标题（L140）+ page-meta 版本（L141） | 部分 | Detail 头语义由容器承担而非业务组件 | 业务组件库补 EntityHeader 后收编 DetailDrawer head |
| D7 MetricCard | KPI 组件 | 不适用 | N/A | — | — |
| D8 StatusBadge 一致 | 统一状态色 | `accountStatusCell` 映射 active/disabled/revoked/pending（L13-17）与 StatusBadge 语义状态集一致 | 达标 | 无混用 | — |
| D9 状态全集 | Empty/Error/Loading/Permission denied… | 空=page-meta 段落（L129）；错=page-meta（L154）；载=未接线；权限=ActionTrigger deniedBehavior 隐藏✓ | 部分 | Empty/Loading 未组件化；错误只是文字 | EmptyState 组件 + DataTable loading + ErrorState 分级 |
| D10 危险操作确认 | 危险须确认 | archive 直接执行（L92-95，L104）；status 切换无确认 | 重做 | 归档/禁用无确认弹窗 | archive→ConfirmDialog（或 DangerZone） |
| D11 信息密度/层级 | 不浪费空间、raw 降权 | 列表+管理双区合理；securityRevision 用 CodeText secondary✓（L20）；username CodeText✓ | 部分 | PageSection 卡片包裹偏重；模块两种密度并存 | 密度/层级随模板 QA |
| D12 Table 操作列 | 1 主操作+`...`+危险隔离 | row menu 渲染为**按钮列**（DataTableRowMenu，index.tsx L223-231 每项独立 button），danger 仅 class | 部分 | 非「1+…」折叠；无菜单分隔；危险未隔离 | RowMenu 改折叠菜单（Menu 触发）+ danger separator |
| D13 命名/样式污染 | 平台类单一 authority | iam.module.css 25 处 `:global`（R083-002 §3.2.2）：`.role-checklist/.permission-row/.form-error/.permissions` 等平台级类模块定义；`.toolbar` 720px 私有覆盖（L111-113） | 重做 | 平台类泄漏 + 私有覆盖 + 死类 session-* | 平台类收归 styles.css；lint 新增 :global 检查（档 1） |

**小节**：达标 2 / 部分 8 / 重做 2 / N/A 1。D5+D8 达标；D10/D13 为真实缺陷。

### 3.2 RolesPage（iam，189 行）——**中改（权限矩阵保留，补状态与确认）**

| 设计基线维度 | 基线要求 | 页面现状（证据） | 判定 | 差距描述 | 收敛为 083 任务输入 |
| --- | --- | --- | --- | --- | --- |
| D1 页面模板 | List Workspace | Header + DataTable + create Drawer + 页内权限矩阵区（L162-176） | 部分 | 权限编辑为主体工作区，非标准 List 模板 | 权限矩阵 Feature（RolePermissionEditor）化 |
| D2 Feature 化 | feature 拆解 | 单文件 189 行；已抽 groupByOwnerModule/diffKeys/roleKindCell（L12-42） | 部分 | 未拆 Summary/Matrix/Search/ChangeDiff 子组件 | 拆 RolePermissionEditor（Summary/Matrix/ChangeDiff） |
| D3 DataTable 能力 | 同上 | 列✓3 列、density/sticky/colvis persisted `iam-roles`✓、row menu✓（L143-160）；排序/过滤/选择/批量✗；空态✗ page-meta（L152）；载态✗ | 部分 | 同 3.1；仅 query 过滤 | 同 3.1 |
| D4 FilterBar 能力 | 同上 | `fields={[]}`（L136-142） | 部分 | 同 3.1 | 补 ownerModule/系统态过滤（可本地派生） |
| D5 Detail 模式 | 上下文保持 | create Drawer✓；权限编辑直接页面内矩阵（L166） | 达标 | 编辑态在页面内合理（无独立 Drawer 必要） | — |
| D6 EntityHeader | 实体头 | 同 3.1（PageSection title + code + revision page-meta L163-168） | 部分 | 无 EntityHeader 组件 | 同上 |
| D7 MetricCard | 不适用 | N/A | N/A | — | — |
| D8 StatusBadge 一致 | 统一状态色 | roleKindCell system/archived/custom（L38-42）一致 | 达标 | — | — |
| D9 状态全集 | 同上 | 空=page-meta；错=page-meta（L119/L167）；载=未接线 | 部分 | 同 3.1 | 同上 |
| D10 危险操作确认 | 危险须确认 | archive 直接执行（L117-120，L128） | 重做 | 角色归档无确认 | archive→ConfirmDialog |
| D11 信息密度/层级 | 复杂权限不「名称+Checkbox」 | 分组矩阵 fieldset 按 ownerModuleId（L166）+ 权限描述 + pending diff 计数（L168）+ 版本 | 部分 | 基线 §21 的 ChangeDiff 可视化/Unsaved 态/继承呈现未实现（实现有 diff 计数，无 diff 列表与保存态） | ChangeDiff 列表 + StickySaveBar + Unsaved 标记 |
| D12 Table 操作列 | 1+… | 同 3.1 row menu 按钮列 | 部分 | 同上 | 同上 |
| D13 命名/样式污染 | 平台类单一 | iam 25 处 :global（含 `.permission-matrix/.permission-description/.admin-note` 平台级类，R083-002） | 重做 | 权限矩阵相关平台类全部泄漏在模块 | 权限矩阵类收归 styles.css（档 1） |

**小节**：达标 2 / 部分 8 / 重做 2 / N/A 1。

### 3.3 PermissionsPage（iam，72 行）——**小改（结构合理，补状态与污染）**

| 设计基线维度 | 基线要求 | 页面现状（证据） | 判定 | 差距描述 | 收敛为 083 任务输入 |
| --- | --- | --- | --- | --- | --- |
| D1 页面模板 | List/目录 | 权限目录：按 ownerModuleId 分组多 DataTable（L49-68），无分页/无详情 | 部分 | 目录陈列合理但无模板化（无 FilterBar 行/计数） | 模板化或保留目录形态+分页 |
| D2 Feature 化 | — | 单文件 72 行；groupByModule 抽离（L11-19） | 部分 | 未拆 UsedBy 面板组件 | 拆 PermissionCatalog/PermissionUsedBy |
| D3 DataTable 能力 | — | 列✓（key CodeText + 描述 + usedBy 懒加载展开 L52-66）；**无 enhancements（无密度/sticky/colvis/行菜单）**；内存过滤✓（L31-35）；载态✗ | 部分 | usedBy 懒加载是好实践；增强档缺失 | 补 density/sticky/loading |
| D4 FilterBar | — | 无 FilterBar，SearchInput 本地过滤（L48） | 部分 | 无结果计数/清除按钮 | 用 FilterBar 或 SearchInput+count |
| D5 Detail 模式 | — | used-by 内联展开（permissionRoles 懒加载 L37-41） | 达标 | 无 Drawer 必要 | — |
| D6 EntityHeader | — | 不适用 | N/A | — | — |
| D7 MetricCard | — | 不适用 | N/A | — | — |
| D8 StatusBadge 一致 | — | used-by 角色用 StatusBadge enabled（L59） | 达标 | — | — |
| D9 状态全集 | — | 空=page-meta（L65）；permissionRoles 失败 `catch setUsage([])` 静默吞错（L40）；载态无 | 部分 | 错误被吞成「未使用」——错误与空数据语义混淆（违反 AGENTS 3.3/基线 §17） | ErrorState + 区分 loading/error/empty |
| D10 危险操作 | — | 不适用 | N/A | — | — |
| D11 信息密度/层级 | — | key/description 双呈现、secondary 技术标识（CodeText）符合 §8 human-readable+secondary | 达标 | — | — |
| D12 Table 操作列 | — | 不适用（无行操作） | N/A | — | — |
| D13 命名/样式污染 | — | `.permissions` 平台级类在 iam.module.css L32-43 :global 定义 | 重做 | 平台类泄漏 | 收归 styles.css（档 1） |

**小节**：达标 3 / 部分 5 / 重做 1 / N/A 4。结构最简且合理，无重做必要。

### 3.4 SessionsPage（iam，79 行）——**中改（批量+确认保留，补格式化与过滤）**

| 设计基线维度 | 基线要求 | 页面现状（证据） | 判定 | 差距描述 | 收敛为 083 任务输入 |
| --- | --- | --- | --- | --- | --- |
| D1 页面模板 | List Workspace | Header + DataTable + BulkActionBar，结构纯正（L37-77） | 达标 | — | — |
| D2 Feature 化 | — | 单文件 79 行；toggleSelection/sessionStatusCell 抽离（L9-20） | 部分 | 未拆 SessionTable/BulkRevoke 子组件 | 拆分 + 接统一 Query 层 |
| D3 DataTable 能力 | — | 选择✓ selectable + selectedKeys（L54-57）；密度/sticky✓；**排序✗/过滤✗（后端 status/accountId typed 过滤未接线，R002 §5.2）/colvis✗/载态✗**；空态✗ page-meta（L58）；时间戳 4 列 raw ISO（L45-48） | 部分 | 时间戳占主视觉（基线 §8 raw 降权）；过滤能力未用 | 时间戳 human-readable（如 formatDateTime）+ status/accountId 过滤接线 |
| D4 FilterBar | — | 无搜索/过滤控件（场景可接受，但后端过滤能力闲置） | 部分 | status 快速过滤可 surface | 轻量 status 过滤（SelectField 即可） |
| D5 Detail 模式 | — | 会话无详情必要（批量操作主场景） | N/A | — | — |
| D6 EntityHeader | — | 不适用 | N/A | — | — |
| D7 MetricCard | — | 不适用 | N/A | — | — |
| D8 StatusBadge 一致 | — | sessionStatusCell active/revoked（L17-20）一致 | 达标 | — | — |
| D9 状态全集 | — | 空=page-meta（L58）；错=page-meta conflict（L35）；载=revoking pending✓ 但列表载态未接线 | 部分 | Empty/Loading 未组件化 | EmptyState + loading |
| D10 危险操作确认 | 危险须确认 | **BulkActionBar+ConfirmDialog 批量 revoke 确认✓**（L61-75，confirmTitle/Description/pending 齐全） | 达标 | 全站唯一真实批量+确认 | 作为批量交互范本保留 |
| D11 信息密度/层级 | — | 6 列中 4 列 raw 时间戳为主视觉→信息密度差 | 部分 | 时长/相对时间可提炼 | 格式化+列收缩 |
| D12 Table 操作列 | 1+… | 无行操作，选择+批量模式正确（D10） | 达标 | — | — |
| D13 命名/样式污染 | — | iam.module.css `session-*` 7 处死代码（L81-98，R083-002）+ `.toolbar` 覆盖 | 重做 | 死代码 + 私有覆盖 | 删除死类、上收 toolbar 断点（档 1） |

**小节**：达标 4 / 部分 5 / 重做 1 / N/A 3。批量模式是全站范本。

### 3.5 ApiTokensPage（iam，138 行）——**中改（操作列与确认重做）**

| 设计基线维度 | 基线要求 | 页面现状（证据） | 判定 | 差距描述 | 收敛为 083 任务输入 |
| --- | --- | --- | --- | --- | --- |
| D1 页面模板 | List+创建 | 创建表单内嵌 PageSection form-panel（L76-104）+ 列表区（L106-135） | 部分 | 大型创建流程不应与列表同区平铺（基线 §26「一个 Card 承载复杂业务」风险） | 创建流程移 Drawer/Wizard；列表独立 |
| D2 Feature 化 | — | 单文件 138 行；groupScopesByModule 抽离（L9-18）；scope 矩阵 ✓（L88-98） | 部分 | 未拆 TokenCreateWizard/TokenTable | 拆子组件 + 接 Query 层 |
| D3 DataTable 能力 | — | 过滤✓ status SelectField（后端 typed，L107-113）；空态**EmptyState 组件✓**（L116）；**排序✗/选择✗/批量✗/密度✗/sticky✗/colvis✗/行菜单✗/载态✗** | 部分 | 过滤未 URL 化（局部 state）；增强档缺失 | status 过滤 URL 化（useListQueryParams） |
| D4 FilterBar | — | status SelectField 直接过滤，无 FilterBar 结构 | 部分 | 可并入 FilterBar | FilterBar 承接 status 过滤 |
| D5 Detail 模式 | — | 无详情抽屉；一次性 secret 用 InlineAlert success + CodeText copyable✓（L73） | 部分 | secret 呈现合理；创建流程位置（D1） | secret 呈现保留 |
| D6 EntityHeader | — | 不适用 | N/A | — | — |
| D7 MetricCard | — | 不适用 | N/A | — | — |
| D8 StatusBadge 一致 | 统一状态色 | 状态列用 **StatusPill**（available/degraded/unavailable，L120）而非 StatusBadge——平台双套并存的实际案例 | 部分 | CapabilityState 语义用于 Token 生命周期语义错配 | 统一为 StatusBadge 语义状态集 |
| D9 状态全集 | — | EmptyState✓；restricted InlineAlert✓ 权限态（L72）；`listApiTokens().catch(()=>undefined)` 吞错（L41）；载态无 | 部分 | 错误吞掉、无载态 | ErrorState + loading |
| D10 危险操作确认 | — | revoke/disable 直接执行（L125-128） | 重做 | revoke 无确认 | revoke→ConfirmDialog |
| D11 信息密度/层级 | — | expiresAt/lastUsedAt 已 toLocaleString✓；name+description 双行 ✓ | 达标 | — | — |
| D12 Table 操作列 | 1 主操作+…+危险隔离 | **actions 列内联最多 4 个 ActionTrigger**（enable/disable + rotate + expireNow + revoke，L123-130），revoke 危险按钮与普通按钮同排 | 重做 | 违反基线 §16 操作列规范 | 折叠为行菜单（1 主+…+danger separator） |
| D13 命名/样式污染 | — | 页面无模块 :global 类（api-token-scope-* 为平台类 styles.css L2240）；但 **`page-check` 类无任何样式定义**（ApiTokensPage.tsx L92 悬空类） | 部分 | 悬空类（无样式） | 定义或改平台类 |

**小节**：达标 1 / 部分 9 / 重做 2 / N/A 2。操作列（D12）与危险确认（D10）最严重，达标率全站最低。

### 3.6 AuditPage（auth，131 行）——**中改（补分页与格式化；FilterBar 为全站范本）**

| 设计基线维度 | 基线要求 | 页面现状（证据） | 判定 | 差距描述 | 收敛为 083 任务输入 |
| --- | --- | --- | --- | --- | --- |
| D1 页面模板 | List Workspace | Header + FilterBar 区 + DataTable 区 + DetailDrawer，结构最完整（L64-109） | 达标 | 仅分页缺失（见 D3） | 补分页后模板完全达标 |
| D2 Feature 化 | — | 单文件 131 行；outcomeTone/auditDetailFields 抽离（L10-38） | 部分 | 未拆 AuditFilterBar/EventTable/EventDetailDrawer | Feature 拆解 |
| D3 DataTable 能力 | — | 过滤✓（FilterBar 真接线）、density compact✓、sticky✓、colvis persisted `auth-audit`✓、row menu✓（L101-107）；**排序✗/选择✗/批量✗/空态✗ page-meta（L100）/载态✗**；**分页✗：PAGE_SIZE=50 + offset 0 硬编码（L42，L61），total 仅 resultCount（L83）** | 部分 | **后端只能看前 50 条，无翻页能力（数据不可达）**；occurredAt raw（L90） | 分页 UI（Pagination 组件）+ occurredAt 格式化 |
| D4 FilterBar 能力 | keyword/quick/advanced/count | operation/action/outcome(select)/resourceType 4 字段 + clear + resultCount（L68-85）——全站最完整；URL 化✓（L44-51） | 达标 | 无 Saved Views/active chips（可后续） | 保留为 FilterBar 范本；Saved Views 候选 |
| D5 Detail 模式 | 上下文保持 | DetailDrawer 640 + CodeViewer JSON（L111-129）；字段低敏（hash 摘要，R002 §5.1）✓ | 达标 | 低敏设计合规 | — |
| D6 EntityHeader | — | DetailDrawer head 有 status（outcomeCell，L115），无独立 EntityHeader 组件 | 部分 | 同上 | 同上 |
| D7 MetricCard | — | 不适用 | N/A | — | — |
| D8 StatusBadge 一致 | — | outcomeCell healthy/degraded/failed（L15-23）一致 | 达标 | — | — |
| D9 状态全集 | — | 空=page-meta（L100）；列表失败无 ErrorState（useEffect 无 catch，L55-62 未处理 rejection → 静默 unhandled）；载态无 | 部分 | 错误路径无呈现 | ErrorState + loading |
| D10 危险操作 | — | 不适用（只读审计） | N/A | — | — |
| D11 信息密度/层级 | raw 降权 | operation/action/hash 等 CodeText secondary ✓；occurredAt raw ISO 主列（D3） | 部分 | 时间戳列格式化 | formatDateTime |
| D12 Table 操作列 | — | row menu 仅 detail 一项（L105） | 达标 | 少即是多 | — |
| D13 命名/样式污染 | — | **auth.module.css 全部 9 处 :global 为死代码**（audit-table-head/audit-row/audit-scroll/audit-mono/audit-empty/audit-meta，R083-002 §3.2.1） | 重做 | 整文件是 082 DataTable 迁移后遗留 | 整文件删除（低风险） |

**小节**：达标 5 / 部分 5 / 重做 1 / N/A 2。FilterBar/DetailDrawer 为范本；分页缺口最影响用户价值。

### 3.7 DepartmentsPage（organization，73 行）——**小改（树+Inspector 保留，补状态与确认）**

| 设计基线维度 | 基线要求 | 页面现状（证据） | 判定 | 差距描述 | 收敛为 083 任务输入 |
| --- | --- | --- | --- | --- | --- |
| D1 页面模板 | Tree/Split | TreeView + InspectorPanel（org-tree-inspector，L44-67）+ 创建表单行（L34-41） | 部分 | 创建用 toolbar 行内 3 字段+按钮（非 Drawer）；无独立形式化 | 创建流程可移 Drawer（小） |
| D2 Feature 化 | — | 单文件 73 行；flatten/getChildren/getKey 抽离（L9-14） | 部分 | 未拆 DepartmentTree/DepartmentInspector | 拆分 |
| D3 DataTable | — | 不适用（树形） | N/A | — | — |
| D4 FilterBar | — | 不适用 | N/A | — | — |
| D5 Detail 模式 | 上下文保持 | InspectorPanel（字段/status/actions，L56-65）master-detail ✓ | 部分 | Inspector 无 loading；create 表单位置（D1） | Inspector loading 态 |
| D6 EntityHeader | — | InspectorPanel title/status/actions/fields 为**轻量 EntityHeader 现成形态**（L56-65） | 部分 | 未一般化为 EntityHeader 组件 | EntityHeader 组件化后直接复用 |
| D7 MetricCard | — | 不适用 | N/A | — | — |
| D8 StatusBadge 一致 | — | archived/active（L63）一致 | 达标 | — | — |
| D9 状态全集 | — | 树空无 EmptyState 引导（items 空只渲染空树）；错=InlineAlert danger✓（L43）；载=未接线 | 部分 | 空树/初次加载无引导 | EmptyState + loading |
| D10 危险操作确认 | — | archive toggle 直接执行（L28-30） | 重做 | 归档无确认 | archive→ConfirmDialog |
| D11 信息密度/层级 | — | code 用 CodeText secondary✓；parent/status 字段清晰 | 达标 | — | — |
| D12 Table 操作列 | — | 不适用 | N/A | — | — |
| D13 命名/样式污染 | — | organization.module.css 5 处 :global：`fieldset/legend/label` 元素级（L54 消费）+ `.permission-row` 平台类 + `.toolbar` 720px 覆盖（R083-002 §3.2.6） | 重做 | 元素级泄漏 + 私有覆盖 | 显式类名 + 收归平台（档 1） |

**小节**：达标 2 / 部分 5 / 重做 2 / N/A 4。结构与 082 最终形态一致（R083-001 已判无 DnD 合理）。

### 3.8 MenusPage（navigation，92 行）——**小改（结构保留，样式清理）**

| 设计基线维度 | 基线要求 | 页面现状（证据） | 判定 | 差距描述 | 收敛为 083 任务输入 |
| --- | --- | --- | --- | --- | --- |
| D1 页面模板 | Tree/Split | TreeView + InspectorPanel + policy-controls 内联编辑（L58-88）；revision 显示（L57） | 部分 | 无 NavigationPreview；保存无未保存变更态（直接 Save） | Preview/变更态属产品化候选（无后端差异接口时从列表 diff 派生） |
| D2 Feature 化 | — | 单文件 92 行；buildTree/effectivePolicy 抽离（L8-28） | 部分 | 未拆 NavigationTree/PolicyEditor | 拆分 |
| D3 DataTable | — | 不适用 | N/A | — | — |
| D4 FilterBar | — | 不适用 | N/A | — | — |
| D5 Detail 模式 | — | InspectorPanel 内联编辑合理（菜单策略粒度小） | 达标 | — | — |
| D6 EntityHeader | — | InspectorPanel 轻量形态（L70-86） | 部分 | 未一般化 | 同 3.7 |
| D7 MetricCard | — | 不适用 | N/A | — | — |
| D8 StatusBadge 一致 | — | enabled/disabled（L78）一致 | 达标 | — | — |
| D9 状态全集 | — | 空/错/载显式态未设计（菜单列表一般非空；加载无 skeleton）；disabled 树节点 CodeText 标记✓（L63） | 部分 | 载态缺失 | Tree loading |
| D10 危险操作 | — | 无危险（策略编辑非破坏性） | N/A | — | — |
| D11 信息密度/层级 | — | id/route/module 技术字段 mono（L73-75）为 secondary，符合 §8 human-readable+secondary 模式 | 达标 | — | — |
| D12 Table 操作列 | — | 不适用 | N/A | — | — |
| D13 命名/样式污染 | — | navigation.module.css 15 处 :global（单行压缩文件）：`policy-grid/policy-card` 死类 5 处 + `policy-controls` 等 live + **`dl/dt/dd` 裸元素 selector 4 处**（R083-002 §3.2.3） | 重做 | 元素级全局 + 死类 | 死类删除、裸元素改类名（档 1） |

**小节**：达标 3 / 部分 4 / 重做 1 / N/A 5。

### 3.9 DashboardPage(ops，146 行) + CapabilitiesPage（ops，79 行）——**中改（MetricCard 组件化是最大缺口）**

| 设计基线维度 | 基线要求 | 页面现状（证据） | 判定 | 差距描述 | 收敛为 083 任务输入 |
| --- | --- | --- | --- | --- | --- |
| D1 页面模板 | Dashboard：Context Header/KPI/Trend/Alerts/Overview/Activity | Context 行（Version/Commit/Uptime/source，L126-131）+ StatGrid KPI 3 卡（L132-136）+ CapabilityBanner（L138）+ Overview 卡组（L139）+ MonitoringSection（L140，5s 轮询，monitoring-section.tsx L10） | 达标 | 形态完整（081 产物） | 轮询边界（R083-001 §8）确认后保留 |
| D2 Feature 化 | feature 拆分 | **全站最深**：BuildSummaryCard/RuntimeSnapshotCard/HealthSummaryCard/MetricsSummaryCard + dashboard-data/metrics-data/operations/environment/monitoring-* 拆分 | 达标 | — | — |
| D3 DataTable | — | CapabilitiesPage 为**全站 DataTable 能力最完整消费方**：loading✓（L73）+ EmptyState✓ + FilterPanel✓ + Pagination 组件（含 pageSize 档）✓（L70） | 部分 | DashboardPage 无表格；DataTable 仍无排序 | 保留为 DataTable 范本 |
| D4 FilterBar | — | CapabilitiesPage 用 FilterPanel（展开式，L71）而非 FilterBar | 部分 | 两套过滤形态并存（FilterBar/FilterPanel） | 明确 FilterPanel 与 FilterBar 职责边界 |
| D5 Detail 模式 | — | CapabilitiesPage Drawer 详情（L77）✓ | 达标 | — | — |
| D6 EntityHeader | — | 不适用 | N/A | — | — |
| D7 MetricCard | KPI 组件 | **平台 StatCard 无 trend/delta/mini chart/drill**（index.tsx L534-547，仅 value/label/tone）；MonitoringSection 的 `ServerMetricCard` 自研近似：value+usage bar+Sparkline+StatusPill+trend（monitoring-section.tsx L31-39，ops-metric-card 私有类） | 重做 | **基线 §五/§六 MetricCard 组件缺失**；ops 已自研近似但私有命名、无平台化 | StatCard 升级或新建 MetricCard（trend/delta/sparkline/drill），ServerMetricCard 收编 |
| D8 StatusBadge 一致 | — | ops 全模块 StatusPill（CapabilityState）**模块内统一**，但与 iam 的 StatusBadge 语义状态集是两套 | 部分 | 模块间状态语言分裂 | StatusBadge/StatusPill 统一策略（裁定） |
| D9 状态全集 | — | **skeleton 逐卡✓（L120）+ retry✓ + CapabilityBanner 分级✓ + missing→「—」fallback✓（valueOrFallback L27-29）**；refresh Toast success/danger✓（L144） | 达标 | 全站状态全集最好 | 作为范本 |
| D10 危险操作 | — | 不适用（只读监控 + 刷新） | N/A | — | — |
| D11 信息密度/层级 | — | renderGroup 失败态用 `pre` 输出 **raw JSON**（`JSON.stringify(query.data, null, 2)`，L120）——API Viewer 倾向（基线 §8 禁令） | 部分 | 原始结果应降权为可折叠技术细节 | 结果 preview/导出，raw 收进 Drawer 二级 |
| D12 Table 操作列 | — | CapabilitiesPage actions 列 1-2 个 ghost 按钮（view/retry，L61）——主次尚可 | 部分 | 未用行菜单形态 | QA 微调 |
| D13 命名/样式污染 | — | **ops.module.css 75 处 :global（全站最大）**：60 个去重 selector 多数为 ops-* 模块专属但全 :global 化；**`:global(.header-zone-action)` 是全仓唯一无前缀真全局**（L87）；`.form-error` 平台缺失重复定义（L13，与 iam 重复） | 重做 | 模块专属语义类泄漏全局 + 真全局 + 平台类重复 | 局部类化 + 真全局收编 + form-error 上收（档 1） |

**小节**：达标 4 / 部分 4 / 重做 2 / N/A 3。D9（状态全集）与 D2（feature 化）是全站范本。

### 3.10 Settings 模块（settings，8 页 + Layout 25-112 行）——**中改（双导航与宽度修整，Configuration 模板）**

| 设计基线维度 | 基线要求 | 页面现状（证据） | 判定 | 差距描述 | 收敛为 083 任务输入 |
| --- | --- | --- | --- | --- | --- |
| D1 页面模板 | Configuration：左导航+右工作区 | SettingsLayout = SectionNav + settings-content（L44-46）；**但 Sidebar 同时列出 settings.center 8 项**（webui-registry.ts L437-522）+ 页内 SectionNav = 双导航 | 部分 | 基线 §七 Configuration 模板要「左侧 Settings Navigation」单一；R083-001 裁决 B-2 收敛单入口 | Sidebar 收敛为 Settings 单入口（或去 SectionNav）二选一 |
| D2 Feature 化 | — | 8 个单文件页（25-112 行）；API 共用 api.ts（跨模块 HTTP，R083-002 已注）；**RHF/zod 声明但零 import**（R083-001 §3：DEC-082-002 已确认启用未落地） | 部分 | 表单全手写 useState+onSubmit；PageScope 单文件 | 表单迁移（RHF+zod，DEC-082-002）或显式退役 |
| D3 DataTable | — | 不适用（无表格） | N/A | — | — |
| D4 FilterBar | — | 不适用 | N/A | — | — |
| D5 Detail 模式 | — | 表单页内平铺（无 Drawer）；Account closure ConfirmDialog✓（L40）；Security MFA 三步内联（L82-101） | 部分 | MFA 多步状态内联可接受；跳转 `/admin/api-tokens` 用 `window.location.href` 硬跳转（SecurityPage.tsx L62-65，非 SPA navigate） | 硬跳转改 SPA 导航 |
| D6 EntityHeader | — | 不适用 | N/A | — | — |
| D7 MetricCard | — | 不适用 | N/A | — | — |
| D8 StatusBadge 一致 | — | Profile/Security 用 StatusPill degraded（ProfilePage.tsx:29、SecurityPage.tsx:68）| 部分 | 同 3.9 双套并存 | 统一策略 |
| D9 状态全集 | — | 各页 message=`page-meta` 段落；AccountPage loading 用文字（L31）；Profile 无加载态（identity undefined 时 username 空）；无 ErrorState | 部分 | 表单加载/错误未组件化 | FormField error + ErrorState |
| D10 危险操作确认 | — | **Account 两步软关闭（beginSelfArchive→confirm）+ ConfirmDialog✓（L18-24，L40）** | 达标 | 复杂危险流程有确认 | — |
| D11 信息密度/层级 | 表单有效宽度 640-760 | **`.form-panel`/`.settings-content` 无 max-width**（styles.css L2501；R083-002：`--content-max-settings/form`（960/760）零消费）→ 输入框可横跨到 1600 | 重做 | 基线 §九/§11 宽度缺陷；AppearancePage Switch/Select 平铺（L82-102）无层级分组无实时 Preview（R083-001 §4.9 未满足） | 宽度档接线（settings-content/form-panel 引 960/760）+ Appearance 分组+Preview |
| D12 Table 操作列 | — | 不适用 | N/A | — | — |
| D13 命名/样式污染 | — | settings.module.css 8 处 :global（settings-summary/settings-stack/settings-inner/settings-content，全部 live 模块专属，R083-002 §3.2.7） | 部分 | 模块专属类 :global 化（内层不哈希）；LanguagePage **复用 `section-nav-item` 平台类做语言选项按钮**（LanguagePage.tsx L25）——语义误用 | 局部类化 + LanguagePage 改用专属 radio 按钮样式 |

**小节**：达标 1 / 部分 5 / 重做 1 / N/A 5（重做维度 = D11「宽度与层级」）。Configuration 结构成立，双导航与宽度为准一缺陷。

### 3.11 LoginPage / SetupPage（iam，Blank 布局，各 7 行）——**小改（形态达标，反馈补齐）**

| 设计基线维度 | 基线要求 | 页面现状（证据） | 判定 | 差距描述 | 收敛为 083 任务输入 |
| --- | --- | --- | --- | --- | --- |
| D1 页面模板 | Blank auth（独立居中面板） | `Surface className={styles.iamModule + ' auth-panel'}`（LoginPage.tsx:7，SetupPage.tsx:7）；Blank 布局由 AppShell BlankLayout 承载（AppShell.tsx L21-28） | 达标 | — | — |
| D2 Feature 化 | — | 单文件紧凑（7 行）；无堆砌 | 达标 | — | — |
| D3-D7 | — | 不适用 | N/A | — | — |
| D8 StatusBadge | — | 不适用（无状态陈列） | N/A | — | — |
| D9 状态全集 | Loading/Error | error=`form-error` 段落（L6）；**提交无 pending/loading**（Button 直接 submit） | 部分 | 登录慢时无反馈（基线 §19/§20） | Button loading + error 组件化 |
| D10 危险操作 | — | 不适用 | N/A | — | — |
| D11 信息密度/层级 | — | auth-panel 居中 480px（iam.module.css L3-8，min(480px, 100vw-32px)）+ 表单 14px gap 紧凑 | 达标 | — | — |
| D12 Table 操作列 | — | 不适用 | N/A | — | — |
| D13 命名/样式污染 | — | iam.module.css L3-30：`auth-panel/auth-heading/iam-form/form-error` 共 6 去重 :global（R083-002 §3.2.2）；`.form-error` 平台缺失（模块定义） | 部分 | 平台 form-error 缺失 → 模块 :global 兜底 | form-error 上收平台（档 1） |

**小节**：达标 3 / 部分 2 / 重做 0 / N/A 8。Setup 5 字段（token/username/name/password）合理。

---

## 4. 达标率汇总表

口径：13 维度 × 11 页面组 = 143 项；N/A=38 项；有效判定 105 项。

| 页面组 | 达标 | 部分 | 重做 | N/A | 有效达标率（达标/有效） | 三档 |
| --- | --- | --- | --- | --- | --- | --- |
| AccountsPage | 2 | 8 | 2 | 1 | 16.7%（2/12） | 中改 |
| RolesPage | 2 | 8 | 2 | 1 | 16.7%（2/12） | 中改 |
| PermissionsPage | 3 | 5 | 1 | 4 | 33.3%（3/9） | 小改 |
| SessionsPage | 4 | 5 | 1 | 3 | 40.0%（4/10） | 中改 |
| ApiTokensPage | 1 | 9 | 2 | 2 | 9.1%（1/11） | 中改 |
| AuditPage | 5 | 5 | 1 | 2 | 45.5%（5/11） | 中改 |
| DepartmentsPage | 2 | 5 | 2 | 4 | 22.2%（2/9） | 小改 |
| MenusPage | 3 | 4 | 1 | 5 | 37.5%（3/8） | 小改 |
| DashboardPage+Capabilities | 4 | 4 | 2 | 3 | 40.0%（4/10） | 中改 |
| Settings（8 页） | 1 | 5 | 1 | 5 | 12.5%（1/8） | 中改 |
| Login/Setup | 3 | 2 | 0 | 8 | 60.0%（3/5） | 小改 |
| **合计** | **30** | **60** | **15** | **38** | **28.6%（30/105）** | — |

**汇总结论**：
1. **没有任何页面整体「达标」**（单页达标率最高 Login/Setup 60%，最低 ApiTokens 9.1%）。「达标」集中在结构级维度：模板形态（D1）、Detail 模式（D5）、StatusBadge 一致性（D8）。
2. **「重做」15 项几乎全部落在两个维度**：D13 样式污染（8/11 页重做：iam 相关 Accounts/Roles/Permissions/Sessions、Audit、Departments、Menus、ops）与 D10 危险操作确认（Accounts/Roles/ApiTokens/Departments 4 页重做）。另 D7 MetricCard（ops）与 D11 Settings 宽度（表单超宽）各 1 项重做。
3. **「部分」60 项的共性问题**：DataTable 排序（后端无 sort，全站 0 项）、过滤接线（后端 typed filter 只 surface query）、载态/空态组件化（5 页空态 page-meta、1 页用 loading）、Feature 单文件、时间戳 raw（Sessions 4 列/Audit）、URL 状态只含 filter 不含分页。
4. 未做浏览器渲染验证（视觉类推断见 §8 局限），不改变上述结构性结论。

## 5. 重做优先序（作为 083 页面迁移任务输入）

按「真实缺陷严重度 × 依赖关系」排序，前导为 R083-001 三档（档 1 样式权威 / 档 2 骨架重写 / 档 3 产品化）的接入点：

| 优先级 | 事项 | 涉及页 | 证据 | 依赖 |
| --- | --- | --- | --- | --- |
| P0 | **样式权威清理**（6 模块 137 处 :global：auth 9 全删/iam 25/ops 75/navigation 15/organization 5/settings 8；21 处死代码；2 处 `.toolbar` 私有覆盖；`header-zone-action` 真全局；form-error 上收；camelCase 命名分裂） | 全部 11 页（D13） | R083-002 §3/§6.1 + 本档案各页 D13；本档案 3.6 证据（auth.module.css 全文件死代码） | 无（对应 R083-001 档 1，可单独先行） |
| P0 | **布局骨架 + 宽度档接线**（100dvh/侧栏独立滚动/滚动容器语义；`.settings-content`/`.form-panel` 引用 `--content-max-settings/form` 960/760） | Settings（D11 重做）、全部页骨架 | R083-002 §4/§6；styles.css L109-112 四档零消费；L2501 | 无（对应 R083-001 档 2；Settings 宽度依赖它） |
| P1 | **Audit 分页**（后端 50 条截断、无分页 UI；total 已有） | AuditPage（D3） | AuditPage.tsx L42/L61/L83；R002 分页契约已有 | 无（纯前端，P0 后即可做） |
| P1 | **时间戳/技术标识格式化收尾**（Sessions 4 列 ISO、Audit occurredAt；ApiTokens/Ops 已格式化） | SessionsPage/AuditPage | SessionsPage.tsx L45-48、AuditPage.tsx L90 | P0（样式基线稳定后统一格式组件） |
| P1 | **Settings 双导航收敛 + Appearance 层级/Preview**（裁决 B-2：Sidebar 单入口 or 去 SectionNav；Appearance 平铺→分组+实时 Preview） | Settings（D1/D11） | webui-registry.ts L437-522、SettingsLayout.tsx L44-46、AppearancePage.tsx L82-102 | P0 宽度档 |
| P2 | **FilterBar 全量接线**（accounts status/archived/roleId；sessions status/accountId；后端 typed filter 全在 R002 §5.2） | Accounts/Roles/Sessions | AccountsPage.tsx L112-118、SessionsPage.tsx（无 FilterBar） | 无（后端已支持） |
| P2 | **server-side sort 后端补足 → DataTable 排序 UI**（裁决 C 必补项） | 全部列表页（D3） | R002 §7.3 无 sort；unified.ts L107-108/L140-148 sort 契约零消费 | 后端补 operation（oasdiff 基线） |
| P3 | **MetricCard 组件化 + Dashboard KPI 升级**（trend/delta/sparkline/drill；ServerMetricCard 收编平台） | DashboardPage（D7 重做） | index.tsx L534-547（StatCard 无 trend）、monitoring-section.tsx L31-39 | P0；081 图表自研 SVG 先复用 |
| P3 | **EntityHeader 组件化**（DetailDrawer head / InspectorPanel 一般化收编） | Accounts/Roles/Audit/Departments/Menus（D6） | index.tsx L799-821、L893-916 | 无 |
| P3 | **Table 操作列折叠**（1 主操作 + `...` 菜单 + danger separator；RowMenu 改下拉） | **ApiTokens（D12 重做，4 按钮内联）**、Accounts/Roles/Audit | ApiTokensPage.tsx L123-130、index.tsx L223-231 | P2 排序同批改造 DataTable |
| P4 | **危险操作确认补齐**（archive/revoke/disable → ConfirmDialog/DangerZone） | Accounts/Roles/ApiTokens/Departments（D10） | AccountsPage.tsx L92-95/L104、ApiTokensPage.tsx L125-128、DepartmentsPage.tsx L28-30 | 无（ConfirmDialog 已建） |
| P4 | **空态/载态组件化**（5 页 page-meta → EmptyState；DataTable loading 接线；ErrorState 落地；Permissions 错误吞并修正） | Accounts/Roles/Sessions/Audit/Permissions（D9） | 本档案 §2.2 共性证据 | P0 |
| P5 | **Feature 拆解 + Query 统一层接入**（`useWebUIQuery/useWebUIMutation` 落地；RHF/zod 迁移 per DEC-082-002） | Accounts/Roles/Dashboard 范本 | R083-001 §4.4/§5；unified.ts 零消费 | P1/P2 稳定后 |

**依赖图**：P0（样式+骨架）为一切页面模板化基底；P1 数据可达性（分页/时间戳）可与 P0 并行；P2 依赖后端决策（sort）；P3-P5 在 P0-P1 后排队。Audit 分页是唯一「纯前端即可立刻提升用户价值」的 P1 项。

## 6. 每页「重做 vs 保留+补齐」三档判定

| 页面 | 档位 | 保留（无需重做） | 需重做/补齐 |
| --- | --- | --- | --- |
| AccountsPage | **中改** | DataTable 增强、Create/Detail Drawer、URL 过滤、ActionTrigger 权限、StatusBadge | 归档确认、Empty/Loading、FilterBar 接线、RowMenu 折叠、P0 样式清理、Feature 拆解 |
| RolesPage | **中改** | 分组权限矩阵（fieldset 结构）、diff 计数、版本乐观锁、create Drawer | 归档确认、ChangeDiff 可视/Unsaved 态、FilterBar、P0 样式清理（矩阵类收归平台） |
| PermissionsPage | **小改** | 目录+used-by 懒加载（信息架构正确） | Error 吞并修正、增强档（density/sticky/loading）、`.permissions` 平台化 |
| SessionsPage | **中改** | **批量选择+ConfirmDialog（全站范本）**、selectable DataTable、StatusBadge | 时间戳格式化、status/accountId 过滤、Empty/Loading、死类删除 |
| ApiTokensPage | **中改** | scope 矩阵、secret 一次性呈现、EmptyState、toLocaleString | **操作列 4 按钮内联→折叠**、revoke 确认、StatusPill→StatusBadge、状态/过滤 URL 化、创建流程位置 |
| AuditPage | **中改** | **FilterBar（全站范本）**、DetailDrawer+CodeViewer 低敏、colvis/sticky、row menu | **分页（50 条截断）**、时间戳格式化、ErrorState、auth.module.css 整文件删除 |
| DepartmentsPage | **小改** | TreeView+InspectorPanel 主从（082 最终形态） | 归档确认、树空态/loading、元素级 fieldset 类名化、`.toolbar` 覆盖 |
| MenusPage | **小改** | TreeView+Inspector+policy-controls、revision、refreshManifest | 载态、死类/裸元素 selector 清理；NavigationPreview/变更态为产品化候选 |
| DashboardPage | **中改** | Context 行、StatGrid、CapabilityBanner、MonitoringSection、状态全集（范本）、feature 化（范本） | **MetricCard 组件化**、raw JSON pre 降权、ops 75 处 :global 局部化、StatusPill/Badge 统一 |
| Settings（8 页） | **中改** | Configuration 模板（SectionNav+content）、Account 两步关闭确认、API 共用层 | **双导航收敛（裁决 B-2）**、表单宽度档、Appearance 分组+Preview、硬跳转改 SPA、RHF 迁移按需 |
| Login/Setup | **小改** | Blank 面板形态、Setup 5 字段、紧凑密度 | 提交 pending、form-error 平台化、:global 清理 |

## 7. 对 R083-001/R083-002 的证据修正（冲突已解释）

| 项 | R083-001/002 声称 | HEAD 实测 | 处置 |
| --- | --- | --- | --- |
| Audit URL 状态 | R083-001 §3/§4.10「Audit 未采用 useListQueryParams」 | AuditPage.tsx L44-51 **已采用**（operation/action/outcome/resourceType 四 filter 全 URL 化；分页未 URL 化——offset 0 硬编码） | 以代码为准修正；R083-001 的「Audit 未入 URL 态」不成立（filters 部分成立，分页不成立） |
| Audit FilterBar 字段 | R083-001 §4.5「operation/action/resourceType/outcome/since/until 等全真实」 | 实测仅 4 字段，**无 since/until**（AuditPage.tsx L70-80） | 以代码为准修正（描述偏乐观） |
| :global 计数 | R083-001 §3「137 处（实测）」；083 README 原写 122 | HEAD 1948975 提交恰为 122→137 修正；本档案复核 iam/ops/settings/organization/navigation/auth 合计 = 137 | 一致（本档案沿用 137） |
| HEAD commit | 任务给定 `5a3def3` | 实测 HEAD `1948975`（仅 docs 提交） | 页面代码内容一致，无判定影响；已在 metadata 记录 |
| ApiTokens 过滤 | —（R083-001 未详） | status SelectField 局部 state，**未 URL 化**（ApiTokensPage.tsx L26/L40-42/L107-113） | 本档案新增：过滤接线清单应含「ApiTokens status URL 化」 |
| Accounts/Roles 分页 | R083-001 §3「URL 状态落于 Accounts/Roles/Permissions」 | 实测仅 **query filter** URL 化；page 为局部 useState（AccountsPage.tsx L42/L111、RolesPage.tsx L60/L135），pageSize 固定 10 无档位 | 本档案修正：URL 状态 ≠ 分页状态 |

## 8. 局限

- **未做浏览器渲染验证**：D1/D11 的「信息密度/视觉层级」与空树/载态等视觉结论为机制判定 + 推断（R083-002 同类口径）；不改变结构性缺口（分页/操作列/确认/组件缺失均为代码级事实）。
- **页面行为未互操作实测**：耗时交互（Audit 翻页不存在、Sessions 批量、Settings MFA 三步）为静态代码判定，Playwright dev 20 用例（082 遗留）未执行。
- **动态类名**：ops `ops-metric-${key}` 动态类（R083-002 §9）在本档案未逐键核验后端 metrics 契约。
- **ApiTokens `page-check` 悬空类**为全仓类名搜索零命中（包括 styles.css 与全部模块 CSS），但未排除 Tailwind 实用类生成路径（HeroUI 语义），故措辞为「无样式定义（悬空类）」。
- 平台态判定（StatusPill/StatusBadge 双套）以机制为准，未做视觉比对。

## 9. 剩余未知

1. **StatusPill vs StatusBadge 的统一策略**未被任何既有裁决覆盖（R083-001 §5 无此项）——影响 D8 判定收敛（ops 用 CapabilityState、iam 用 SemanticStatus、ApiTokens 混用）。
2. **FilterBar 与 FilterPanel 两个过滤形态**的职责边界未裁定（Capabilities 用 FilterPanel，列表页用 FilterBar）。
3. Audit 分页的后端 total 可靠性（50 条上限外的业务价值）与「导出」是否列入 083 候选。
4. MetricCard 组件化后 Ops Dashboard 的 KPI 集（哪些指标、区间对比数据端是否有）——R083-001 §8 遗留。
5. Playwright/E2E fixture 对死类名（audit-*/session-*/policy-*）的引用未核验（R083-002 §9.3）。
6. Settings 表单迁移（RHF/zod）的实际工作量与回归面（DEC-082-002 已确认但未落地）。

## 10. 对 083 requirements/design/tasks 的影响

1. **requirements.md**：
   - 页面产品化 REQ 可直接引用本档案逐页差距清单；「每个页面达标/部分/重做」作为验收口径（§4 汇总表）。
   - 新增 REQ（本档案首次出现、R083-001 未列）：**Audit 分页**（P1，数据可达性）、**ApiTokens status 过滤 URL 化**、**操作列 1+… 折叠（ApiTokens 最严重）**、**危险操作确认补齐清单（4 页）**、**StatusBadge/StatusPill 统一策略（待裁）**、**FilterBar/FilterPanel 边界**、**Permissions 错误与空数据语义分离**（AGENTS 3.3 相关）。
   - 决策补充：R083-001 §5 四裁决之外新增「状态组件双套统一」与「FilterPanel 定位」两个待裁点。
2. **design.md**：
   - 页面模板落地时以 D1 判定为输入（List Workspace=Accounts/Roles/Audit/Sessions/ApiTokens；Dashboard=ops；Configuration=Settings；Blank=Login/Setup；Tree/Split=Departments/Menus）。
   - DataTable 增强路线图：RowMenu 折叠（P3）与排序（P2 后端）同批改造；Pagination 组件在 Accounts/Roles/Audit 接线（Audit 无分页为 P1）。
   - MetricCard/EntityHeader 组件契约可参照 monitoring-section ServerMetricCard（已有 sparkline/bar/status 实践）与 DetailDrawer head / InspectorPanel（EntityHeader 现成消费形态）。
3. **tasks.md**：
   - 逐页任务切片按 §5 优先序标注来源（本档案表格行 + R083-001 档号 + R002 证据节号）；每页任务完成条件绑定其「重做项清零 + 部分项收敛」清单。
   - 样式清理任务（P0）的死类删除清单可直接取本档案 3.6（auth 9 处全删）、3.4（session-* 7 处）、3.8（policy-* 5 处）与 R083-002 §3.3。
   - 验证矩阵：D9/D10/D3 相关用例（EmptyState 组件覆盖、危险确认弹窗、分页翻页）加入 Vitest/Playwright 回归基线。

---

### 事实/推断标注汇总

- 【事实】全部页面代码行号、类名、`:global` 计数（R083-002 复核一致）、平台组件能力清单、URL 状态/分页实现、D10 缺确认路径、时间戳 raw 呈现、切分页缺失、StatusPill/StatusBadge 双套、`page-check` 悬空、Settings 双导航（registry 8 项 + SectionNav）、表宽度档零消费。
- 【推断】D1/D11 视觉层级类判定（未浏览器渲染）；「Audit 50 条以外数据不可达」的用户价值判断；「StatusPill/StatusBadge 统一」的方向建议；优先序 P1-P5 的排期判断（基于缺陷严重度，非工作量度量）。
- 与 R083-001 冲突的两处修正（Audit useListQueryParams、Audit FilterBar 字段集）已在 §7 以代码证据解释。