# R083-001 新方案 vs 082 已实施现状差异分析

> 研究快照：本档案研究时仓库 HEAD 为 `08d5130`（仅 083 ledger 索引提交）；新方案与设计基线文本定格于 commit `5a3def3`（内容与 HEAD 一致）。研究/验证日期 2026-08-27。
> 输入：`docs/changes/temp-new-changes.md`（新方案 606 行，1-12 节 + 11b/11c/11d，下称「新方案」）、`docs/changes/admin-design-baseline.md`（27 节设计基线，下称「基线」）、082 记录（README/requirements/tasks/design + R001/R002/R003）、以及 HEAD 上的实际代码抽查（AppShell/styles.css/WorkspaceTabs/AppHeader/AppSidebar/ui/index.tsx/sdk/query/unified.ts/lint-architecture.mjs + 7 模块页面与 `.module.css`）。
> 判定口径：**已满足**（代码/文档证据直接支撑）、**部分满足**（机制在但形态/覆盖/接线有差距）、**未满足**（真实差距需新增）、**与已确认决策冲突**（需裁决）、**候选**（超出当前阶段或纯愿景）。正文【事实】为可复核证据；【推断】单独标注。

---

## 1. 研究问题

新方案（1-12 节、11b 样式权威、11c 布局骨架、11d 设计基线）每一节/每一项要求在 **082 已实施现状**下的判定与差距；强制裁决四个冲突点（推倒 App Shell、移除全局 Tab Bar、Backend Freeze、组件栈单轨）；给出可落地范围建议与对 083 规划文档的影响。

## 2. 方法与范围

- 方法：静态阅读 + 定向代码核对。先通读新方案与基线全文，再读 082 requirements/tasks/research（R001/R002/R003）建立「082 声称已实现」清单，最后在 HEAD 代码上逐项验证关键证据：AppShell JSX、styles.css Shell/workspace/viewport/footer 分区与 token、WorkspaceTabs、AppHeader、AppSidebar、ui/index.tsx 导出全集、sdk/query/unified.ts、lint-architecture.mjs、AccountsPage/AuditPage/RolesPage/PermissionsPage/SessionsPage/ApiTokensPage/DepartmentsPage/MenusPage/OpenAPIPage + 7 模块 `.module.css` 的 `:global` 统计。
- 范围：仅差异分析与判定，不修改任何代码/文档；后端判定引用 R002 55 operation/23 权限键事实，不重新枚举。
- 局限声明：视觉/交互类判定以「机制与代码状态」为准，不做浏览器实测（082 Playwright dev 20 用例尚未执行）；部分页面内容未逐页通读（见 §7）。

## 3. 事实基线速览（082 完成状态 @ HEAD）

| 主题 | 082 声称/代码实证 | 证据 |
| --- | --- | --- |
| 平台语义组件 | ui/index.tsx 60 项导出：DataTable(+列可见性/密度/Sticky/Row menu/selection)、FilterBar、SearchInput、FormField、EmptyState、ErrorState(分级)、StatusBadge、CodeText、CodeViewer、DangerZone、DetailDrawer、TreeView、InspectorPanel、Drawer、ConfirmDialog、BulkActionBar、PageHeader、PageSection、StatCard/Grid/DataCard、SectionNav、ActionTrigger 等 | `webui/src/ui/index.tsx`（876 行） |
| 页面模式迁移 | Accounts=DataTable+FilterBar+SearchInput+Create Drawer+DetailDrawer（无 card-grid 残留）；Audit=FilterBar+DataTable+DetailDrawer+CodeViewer；Roles=列表+分组权限矩阵；Permissions=DataTable+CodeText；Sessions/ApiTokens=DataTable；Departments=TreeView+InspectorPanel；Menus=TreeView+InspectorPanel；Ops=顶栏 Context(Version/Commit/Uptime) | `internal/module/*/binding/webui/web/*.tsx` |
| URL 状态同步 | `useListQueryParams`（useSearchParams 驱动，filters/page/pageSize/sort 契约，write=replace）落于 Accounts/Roles/Permissions；Audit 未采用 | `webui/src/sdk/query/unified.ts:93-157`；模块 grep |
| Query/Mutation 统一层 | `useWebUIQuery`/`useWebUIMutation`/`ProblemError` 契约已建；**模块页面零消费**（grep 无匹配；Ops 保持 `useGatedQueries`） | `webui/src/sdk/query/unified.ts`；tasks.md BASE-082-009「部分完成」 |
| 表单库 | react-hook-form@7.62/zod@4.0.17/@hookform/resolvers@5.2.2 声明于 package.json 但全仓零 import；DEC-082-002 已确认「正式启用」，BASE-082-003「RHF 契约保留待页面迁移接入」 | `webui/package.json`（实测）；tasks.md |
| 样式污染 | `.module.css` `:global` 共 **137 处**（iam 25 / ops 75 / settings 8 / organization 5 / navigation 15 / auth 9 / openapi 0）；平台语义类被全局定义（`.permission-matrix/.role-checklist/.form-error/.session-row/.permissions/.auth-panel` 等）；720px 断点内 `.iamModule :global(.toolbar){display:grid}` 私有覆盖平台类；命名分裂（`styles.pageMeta/formHint/shellSearchTrigger/footerStatus` camelCase vs 平台 `.page-meta/.search-trigger` kebab-case）；`lint-architecture.mjs` **不检查** `:global` 泄漏/平台类重复/私有覆盖 | 7 模块 `.module.css`（HEAD 实测计数）；`webui/scripts/lint-architecture.mjs`（56 行，仅 6 类检查） |
| 布局骨架 | `.app-shell{grid; min-height:100vh}`（L263-266）；`.app-sidebar{min-height:100vh; overflow:hidden}`（L273-283，**无独立滚动**）；`.app-workspace{height:100vh; overflow:hidden}`（L474-478，**非 100dvh**）；`.page-viewport{max-width:var(--shell-content-max)=1600px; margin:0 auto; overflow:auto}`（L820-828）；`.app-footer` 存在（AppShell.tsx:147，showFooter 默认 true）；WorkspaceTabs 在（AppShell.tsx:145，showTabs 默认 true）；宽度档 token `--content-max-wide/detail/settings/form`（1600/1200/960/760）已声明但 **styles.css 无任何消费方**（仅 `.page-viewport` 用 1600） | `webui/src/styles.css`、`webui/src/theme.ts:52`、AppShell.tsx |
| 后端能力 | 55 operation/23 权限键/分页 offset+limit/typed 过滤白名单；**无 sort 参数**；无单实体 detail GET；批量仅 sessions.revoke（IDHash）；树 departments.tree；reorder 仅 navigation override | R002 §5.1-5.4、§7.3 |
| 测试基线 | Vitest 192、mock E2E 3、lint/typecheck/build/go 全绿；Playwright dev 20 待真实后端 | 082 tasks.md 验证矩阵 |
| 组件栈 | HeroUI v3.2.4 + react-aria-components 1.20 + Tailwind v4.3.3 + TanStack Query 5.90 + react-router 7.8 + Vite 7 单轨（无 TanStack Table/Recharts/RHF 消费） | `webui/package.json`（实测） |

---

## 4. 逐节差异矩阵

### 4.1 新方案 §1「先推翻错误骨架」（App Shell）

| 要求 | 082 现状（证据） | 判定 | 差距/裁决 | 建议动作 |
| --- | --- | --- | --- | --- |
| Sidebar 固定在 viewport，不随业务页面滚动 | Sidebar 是 `app-shell` grid 列，页面滚动发生在 `.page-viewport`（`app-workspace` 100vh+overflow:hidden），Sidebar 不随内容滚动（styles.css L263-283、L467-478） | 已满足（效果） | 无 | —（保留 grid 结构） |
| Sidebar 自己需要滚动时独立滚动 | `.app-sidebar{overflow:hidden}`（L283），nav 区无独立滚动容器 | 未满足 | 长菜单会裁切，真实缺陷（11c-1 已点名） | 骨架重写时给 sidebar-nav 独立 overflow-y（消费新 `--shell-sidebar-*` token） |
| Main Workspace 独立滚动 | `.app-workspace{height:100vh;overflow:hidden}` + `.page-viewport{overflow:auto}`，滚动在内容容器内而非 Workspace 层 | 部分满足 | 机制存在但滚动容器是 `page-viewport`（带 max-width 居中），符合效果、不符合「独立 Main Workspace 滚动条」的语义与 11c-4 | 骨架重写：滚动容器上移到 workspace 层或保留 viewport 但去掉居中 max-width |
| 不允许整个 document 带着 Sidebar/Header/Footer 一起滚动 | `app-shell` min-height:100vh + workspace 100vh，document 不滚动 | 已满足 | 无 | — |
| 移除现有全局「打开页面标签条」 | WorkspaceTabs 仍在（AppShell.tsx:145，showTabs 默认 true；theme.ts:52） | **与已确认决策冲突** | DEC-082-001 保留 WorkspaceTabs 为导航辅助；新方案 §1/§11c-5 明确移除 → 裁决见 §5-A | 裁决后删除组件+测试（单轨 3.8）或维持偏离并更新 083 requirements |
| 不再同时存在 Sidebar + Tab Bar + 多套二级导航 | Sidebar + TabBar + Settings 页内 SectionNav + 面包屑并存 | 部分满足 | Settings 双导航真实存在（§11-4 缺陷清单）；Tab Bar 去留同上 | 移除 TabBar 后仅剩 Sidebar+Local Nav+面包屑，与 §9 一致 |
| 删除固定 Footer 对工作区的占用 | `.app-footer` 占 workspace 固定行（AppShell.tsx:147，showFooter 默认 true；styles.css L866-877）；版本信息已在 sidebar-meta（AppSidebar.tsx:33）+ About 页 | 未满足 | 与新方案 §1/§11-2 直接冲突；082 未实现「版本入 Sidebar/About」的最终形态（R003 #64 曾判已满足，但 Footer 组件仍渲染） | 移除 `.app-footer` 渲染与 showFooter 偏好；footer-status zone 迁移或收编 |
| 禁止主工作区无意义水平滚动 | `.page-viewport{overflow:auto}` 双轴 | 部分满足 | 机制允许整页横向滚动（当子内容超过 1600 或窄屏） | 垂直滚动专用（overflow-x:hidden）+ 表格横向滚动窗按列语义处理（11c-6） |
| 1440/1600/1920 宽度必须充分利用空间 | `.page-viewport` `max-width:1600px + margin:0 auto`（L820-828）：1920 下两侧共约 320px 留白；1440/1600 刚好 | 未满足 | 与 11c-2/11c-4 一致，真实缺陷 | 宽度场景档接线：Table/Dashboard 全宽（去居中），Settings/Detail 引用 `--content-max-settings/detail` |
| 旧 Layout 不满足即删除重写 | 组件结构（grid/移动抽屉/焦点圈养/zone/manifest 装配）本身达标 | 部分满足 | **裁决**：重写对象是骨架样式层与 JSX 装配细节（workspace/viewport/footer/tabs），不是 AppShell 组件整体推倒（证据见 §5-A） | 保留组件结构，重写 styles.css Shell/workspace 分区 |

**小节判定**：部分满足（组件结构达标；滚动模型、宽度模型、footer/tab 三处为真实未满足项，全部为新方案 §11c 点名缺陷）。

### 4.2 新方案 §2「不要继续 Card-first」

| 要求 | 082 现状（证据） | 判定 | 差距 | 建议动作 |
| --- | --- | --- | --- | --- |
| 禁止 Page→Large Card→One component 作为复杂功能实现方式 | Accounts/Roles/Permissions/Sessions/ApiTokens/Audit 已用 DataTable+FilterBar+Drawer；Org/Menus 用 TreeView+Inspector；平台原语无 Card 骨架（ui/index.tsx 导出集） | 已满足 | 无 card-grid 残留（AccountsPage.tsx 实测） | — |
| 页面按任务选 Table/Tree/Split/Inspector/Drawer/Modal/Matrix/Timeline/Log/Dashboard/Form | 各页面模式已按任务选择（§3 基线速览） | 已满足 | LogTable 未组件化（Audit 用 DataTable 承担形态）；Split View 无产品组件（Org/Menus 用 TreeView+InspectorPanel 近似） | 083 可不新增 LogTable/SplitPane，除非业务组件库要求（见 §5-B） |
| Card 只承担局部分组 | `PageSection/StatCard/DataCard` 用于局部分组；但 `page-sections` 仍逐页包裹（styles.css L1959） | 部分满足 | 页面级容器仍为 section 结构，属于容器优先的轻度残留 | 页面模板化（11d §七）时统一 Page Header+Toolbar+Data View 骨架 |

**小节判定**：已满足为主（复杂功能已去 Card-first）；局部容器残留随页面模板落地消除。

### 4.3 新方案 §3「基于当前组件栈，缺口用成熟技术补齐」→ **确认无冲突**

| 要求 | 082 现状（证据） | 判定 | 说明 |
| --- | --- | --- | --- |
| 不替换当前组件栈（HeroUI v3 + RAC + Tailwind v4） | 与 082 单轨一致（068 边界；package.json 实测 HeroUI 3.2.4/RAC 1.20/Tailwind 4.3.3） | 已满足（确认兼容） | 新方案 §3 与 082 DEC/非目标「不引入第二套 UI 栈」**同向**，无冲突 |
| 不要混用第二套视觉体系 | 全站 HeroUI/RAC + styles.css token；无第二套视觉 | 已满足 | — |
| 当前栈无法满足的新控件→优先成熟第三方→再自研 | 自研面 = 业务复合组件（BulkActionBar/ActionTrigger/TreeView/DetailDrawer 等业务语义组件）；基础原语复用 HeroUI/RAC | 已满足（方法论一致） | 与 AGENTS 3.2「成熟技术优先」一致 |
| 基础组件不自行重复实现（Button/Input/Select/Tree/Pagination/Form Control…） | 全部复用 HeroUI/RAC（ui/index.tsx 为薄封装+业务语义层） | 已满足 | 唯一自绘边界：Switch/Checkbox/overlay 容器（R001 §4.10-1，HeroUI v3 机制限制） |
| 成熟技术候选评估 | 基线 §二十二 点名 TanStack Table、React Hook Form、Recharts/ECharts 等 | 候选（仅记录，不引入） | 083 候选清单：【事实】RHF+zod 已声明未用且 DEC-082-002 已确认启用——083 应承接迁移或显式退役；【推断】DataTable 若需列固定/虚拟化/多列排序超 HeroUI Table 能力，可评估 TanStack Table（需 R002 无 sort 后端先决）；复杂图表沿用 081 自研 SVG（R003 候选：真实需求出现再评估图表库） |

**小节判定**：无冲突，确认保持 HeroUI/RAC/Tailwind 单轨；候选清单仅 RHF/zod 迁移（已确认决策）与 TanStack Table（条件候选）。

### 4.4 新方案 §4「三层组件架构」

| 层 | 要求 | 082 现状（证据） | 判定 | 差距 |
| --- | --- | --- | --- | --- |
| 基础层 | Design System / Library Primitives | styles.css token（color/surface/border/radius/shadow/spacing/font.*/control.*/content-max/motion/z）+ ui/index.tsx 原语 | 部分满足 | token 齐备；视觉数值未按新方案 §7/基线校准（主色/宽度，见 4.7） |
| 产品层 | AppShell/PageHeader/FilterBar/DataTable/DetailDrawer/SplitPane/CommandPalette/StatusBadge/EmptyState/ErrorState/DangerDialog | 已建 10/11：AppShell✓、PageHeader✓、FilterBar✓、DataTable✓、DetailDrawer✓、StatusBadge✓、EmptyState✓、ErrorState✓、DangerDialog≈DangerZone+ConfirmDialog✓；**缺 SplitPane、CommandPalette**（现有 RouteSearch 是路由搜索 Modal，非常驻命令面板） | 部分满足 | SplitPane 无真实承载（Org/Menus 已用 TreeView+Inspector 近似，可不建）；CommandPalette 常驻入口未落地（REQ-082-007 BASE「待实施」；AppHeader 是 Button trigger 不是常驻输入，实测 AppHeader.tsx:31） |
| 业务层 | UserDirectory/UserDetail/RolePermissionEditor/SessionManager/AuditExplorer/OrganizationTreeManager/NavigationEditor/TokenManager/RuntimeOverview | 全部业务页面存在且模式正确（§3 速览） | 部分满足 | 页面均为单文件组合（如 AccountsPage.tsx 191 行），未按 feature 拆分为 `features/users/{components,hooks,...}`（基线 §二十三/新方案 §5） |
| Page 只负责 Route/Data orchestration/Feature composition | 页面承担数据获取（api.ts + useState/useEffect 手写扇出）+ 业务逻辑 + UI 组合 | 未满足（页面职责） | 单文件页面含业务逻辑与大量 UI；Query 统一层零采用（§3 速览） | 083 按 feature 拆组件 + 接入 useWebUIQuery/useWebUIMutation |

**小节判定**：部分满足。

### 4.5 新方案 §5「一个复杂功能必须设计成完整 Feature」

| 功能 | 082 现状 | 判定 | 差距 |
| --- | --- | --- | --- |
| UserManagement（Toolbar: Search/Status/Role/Create; DataGrid; Detail/Create Drawer; Bulk） | Search✓（SearchInput）、Create Drawer✓、DetailDrawer✓、DataTable+Row menu✓；**Status/Role 过滤未接线**（FilterBar fields=[] 只接 query，AccountsPage.tsx:112-118；后端 typed filter 全在：query/status/archived/roleId，R002 §5.2）；Bulk 无（accounts 无批量后端） | 部分满足 | 前端 FilterBar 未 surface 后端已有过滤；Bulk 依后端评估（§6） |
| RoleManagement（List + PermissionEditor: Summary/Search/Matrix/ChangeDiff/StickySaveBar） | 列表✓ + 分组权限矩阵✓（RolesPage `permission-matrix` fieldset 按 ownerModuleId 分组，RolesPage.tsx:166） | 部分满足 | PermissionSearch/ChangeDiff/StickySaveBar/Summary 未实现（无后端差异计算接口；ChangeDiff 可由 replace 返回 added/removed 近似，R002 §5.2） |
| AuditExplorer（QueryBar/FilterBar/EventTable/EventDetailDrawer） | FilterBar✓（operation/action/resourceType/outcome/since/until 等全真实，AuditPage.tsx:68）+ DataTable✓ + DetailDrawer+CodeViewer✓（audit 摘要字段，AuditPage.tsx:111-129） | 已满足 | 无 |
| NavigationEditor（Tree/Inspector/Preview/Save-State） | TreeView+InspectorPanel✓（MenusPage.tsx:2,59-86；navigation.menus.list/update 策略字段全真实，R002 §5.4） | 部分满足 | NavigationPreview（菜单渲染预览）与「Save/Change State」（未保存变更态）未实现 |
| Organization（Tree + Detail Inspector） | DepartmentsPage TreeView+InspectorPanel✓（成员/岗位经 assignments.get 真实，R002 §5.3） | 已满足 | 无 DnD/Archive（R002 §5.3 无承载；R003 已否决） |

**小节判定**：部分满足——页面级模式全部到位，Feature 级拆解（独立子组件/子目录）与若干产品化子功能（Status/Role 过滤接线、ChangeDiff、NavigationPreview、Saved Views）未落地。

### 4.6 新方案 §6「Backend Compatibility ≠ Backend Freeze」→ **与 082「不扩展后端」决策冲突，需裁决**（§5-C）

逐能力对照 R002（55 operation）：

| 新方案 §6 能力 | 后端现状（R002 证据） | 判定 | 差距/建议 |
| --- | --- | --- | --- |
| server-side search | 多数列表已带 `query`：accounts/roles（§5.2）、departments/positions（§5.3）；sessions/api-tokens 用 typed status 过滤（§5.2）；audit 7 个 typed filter（§5.1） | 已存在 | 前端 FilterBar 未全量接线（见 4.5） |
| pagination | 所有列表 `offset/limit` + envelope `{items,offset,limit,total}`（§7.3） | 已存在 | — |
| filter | typed 白名单过滤（§7.3：accounts query/status/archived/roleId、sessions status/accountId、api-tokens status、audit 7 项、org activeOnly/query） | 已存在 | 任意表达式过滤后端不做（§7.3）；前端组合补足（REQ-082-011 Adapter 层） |
| sorting | **任何列表均无 sort 参数**（§7.3 只列 offset/limit+typed filter） | **未满足（后端缺失）** | 建议 083 最优先补：按列 sort（白名单列名 + asc/desc）；前端 `useListQueryParams` 已有 sort URL 契约（unified.ts:107-108,140-147）但无后端消费 |
| entity detail | 无单实体 detail GET（accounts/roles/sessions/tokens/audit 均无 `/{id}` GET）；详情由 roles.read（§5.2）、assignments.get（§5.3）、roles.accounts.list 拼装 | 部分满足 | 11d DetailDrawer/Detail Page 如需完整实体元数据（created/lastActive/expires 等），按需补 detail 端点；否则前端从列表行数据组装 |
| batch operations | 唯一批量 mutation：`iam.sessions.revoke` 按 IDHash 批量（§5.2）；账号/角色/令牌均单条 | 部分满足 | BulkActionBar 目前只对会话真实（REQ-082-001）；若产品需要用户批量状态/批量归档，需后端补批量 operation（候选，需真实场景） |
| counts / aggregates | 列表 envelope `total`（§7.3）；无独立聚合端点（用户状态分布/角色成员数等） | 部分满足 | Dashboard 级 KPI 可用现有 total + 前端派生；11d MetricCard 需要区间的真实聚合时再补（候选） |
| tree operations | `organization.departments.tree`（§5.3）、navigation menus 含 parent/order（§5.4） | 已存在 | — |
| reorder | navigation `parentOverride/orderOverride`（§5.4）✓；organization 部门无 move/rearrange 端点（§5.3 仅 create/update） | 部分满足 | 菜单 reorder 已真实；部门树重排若做 DnD 需后端补能力（R003 已否决 org DnD，除非 083 立项） |
| detail metadata | 审计只返回 hash 摘要（§5.1）；无用户活动明细（§5.1）、无 request/related metadata（§4.1 低敏设计）；无监控 Dependencies/Instances 数据（§8） | **未满足（后端不存在且为低敏设计）** | 不建议为审计补完整元数据（违反低敏审计设计）；如需 User Activity timeline 属新增数据模型（major 变更，谨慎评估） |

**小节判定**：冲突（范围决策层面）已确认——082 明确「不做后端能力扩展」（082 requirements 非目标；tasks.md 未执行项「后端能力扩展…不纳入」；R003 §11-5），新方案 §6 明确「需要时补后端」。裁决见 §5-C。能力缺口最小集：**sorting（真实缺失）**，其余按需求评估（detail/batch/counts/org reorder）。

### 4.7 新方案 §7「重新建立统一视觉系统」

| 要求 | 082 现状（证据） | 判定 | 差距 |
| --- | --- | --- | --- |
| Sidebar 232–248px | `--shell-sidebar-expanded:264px`（styles.css:115） | 部分满足 | 超出范围 16–32px；collapsed 80px vs 基线 64–72px |
| Topbar 52–56px | `--shell-header-height:64px`（styles.css:117） | 部分满足 | 64 在新方案 52–56 之外（基线八 允许 56–64、十 56-64；**按基线取 56** 为裁决建议） |
| Page padding 24–32 / Input 36–40 / Button 32–36 / Table row 40–48 / Body 14 / Radius 6–10 | padding=`--space-6` 24px✓；`--control-height-{sm,md,lg}=32/36/40`✓；`--table-row-height-*` 36/40/48✓；`--font-scale-md` 14✓；`--radius-xs` 6 + HeroUI radius✓。Button 高随 HeroUI 默认（未按 control token） | 部分满足 | Button 尺寸未 token 化接线；radius 上限存在 16（`--radius-xl`）个别使用需复核 |
| 大量 neutral bg / 1px border / 明确层级 / 少阴影 | `--page:#f5f7fa`、`--border:#e5e7eb`、shadow 仅 overlay（styles.css L18-53、L53-59） | 已满足 | — |
| 减少大圆角/大白 Card/大面积留白/彩色 KPI Block/装饰 Shadow | PageSection 白色 surface + 大 spacing 仍为页面骨架常态 | 部分满足 | 页面模板落地时按基线 §二十七/§八 复核 |
| Blue 主要用于 Primary/Link/Selection/Focus | 默认 `--primary:#3b82f6`（styles.css:26）；基线要求 `#4F46E5` 或 `#2563EB` | 部分满足 | 主色需校准为唯一主色（基线 §十二）；4 套 preset（cyan/green/violet/orange）与「Blue 主色」的关系需裁定（保留预设系统或收敛默认档） |

**小节判定**：部分满足。

### 4.8 新方案 §8「页面必须像成熟后台，而不是 API Viewer」

| 要求 | 082 现状（证据） | 判定 | 差距 |
| --- | --- | --- | --- |
| 不直接暴露 raw UUID/ISO timestamp/i18n key/permission code/backend placeholder/{page}/{total}/undefined/null | 技术标识符经 CodeText/CodeViewer 作 secondary 呈现（AccountsPage username/securityRevision、Audit hash 摘要 CodeViewer）；权限码=责任（PermissionsPage key + description 双呈现，RolesPage matrix `key + t(description)`；基线 §六 StatusBadge 统一状态色）；占位用「—」fallback（Ops context/FooterStatus）；`{page}/{total}` 经 t() 模板参数（AccountsPage:111 非 raw 泄漏） | 部分满足 | 时间戳格式化（Sessions created/expires、Tokens lastUsed 等）未抽查全量；formatUptime 已有先例（DashboardPage.tsx:18-24）；「human-readable + secondary technical」模式已局部确立，需逐页收尾 |
| human-readable + secondary technical metadata | 已确立（CodeText 作 secondary、正文为人读文案） | 已满足 | — |

**小节判定**：部分满足（模式已确立，逐页格式化收尾属 QA 轮）。

### 4.9 新方案 §9「Settings 单独重构」

| 要求 | 082 现状（证据） | 判定 | 差距 |
| --- | --- | --- | --- |
| Settings = Local Navigation + Content | settings.center 顶级组 + 每页 SectionNav（Local Navigation）+ settings-content（settings.module.css:29-39；SettingsLayout.tsx:43-46） | 已满足（结构） | Sidebar 仍列 8 个 settings 项 + 页内 SectionNav = 两套导航（见 §11-4 裁决） |
| 表单有效宽度 640–760px | `--content-max-settings/form`（960/760，styles.css:111-112）**声明但 styles.css 无消费方**；`.form-panel`/`.settings-content` 无 max-width（styles.css:2501-2504）→ 输入框可横跨到 1600 | **未满足** | 宽度档接线：settings-content/form-panel 引用 `--content-max-settings/form`（或 640-760 归一） |
| Appearance 要有真实设置层级与 Preview | AppearancePage 为 Switch/Select 平铺（AppearancePage.tsx:82-95） | 未满足 | 按层级分组 + 实时 Preview（与主题 preset/theme.ts 联动，数据真实） |

**小节判定**：部分满足（双导航裁定 + 宽度档接线 + Appearance 层级为真实差距）。

### 4.10 新方案 §10「数据页面统一使用成熟 Data Management Pattern」

| 要求 | 082 现状（证据） | 判定 | 差距 |
| --- | --- | --- | --- |
| Page Header / Toolbar / Search / Filter / Data View / Pagination / Detail / Action Feedback 统一语言 | PageHeader✓、FilterBar/SearchInput 部分页✓、DataTable✓、Pagination✓、DetailDrawer✓、Toast/InlineAlert/page-meta✓ | 部分满足 | Audit 未入 useListQueryParams（URL 态）；FilterBar 未全量接线（4.5）；页面模板未统一（11d §七） |
| 区分 Loading/Empty/No Results/Error/Permission Denied/Read-only/Saving/Success/Failure | 机制齐备（Skeleton 分级/DataTable loading、EmptyState、ErrorState 分级、ActionTrigger 权限、pendingLabel、Toast）但页面采用不完全：AccountsPage:129 empty 直接用 `page-meta` 段落而非 EmptyState 组件 | 部分满足 | 「状态全集」未成为逐页强制语言；082 DEV 未做（POL-082-003 页面五问验收待实施） |

**小节判定**：部分满足。

### 4.11 新方案 §11「必须修掉当前截图中体现出的架构问题」（13 项逐项）

| 缺陷（§11 清单） | 082 现状 @ HEAD（证据） | 判定 |
| --- | --- | --- |
| Sidebar 跟随页面滚动 | 不跟随（滚动在 page-viewport 内） | 已修复 |
| 页面底部固定无意义 Footer | `.app-footer` 仍渲染（AppShell.tsx:147） | **未修复** |
| 顶部堆十几个页面 Tab | WorkspaceTabs 仍在（AppShell.tsx:145，默认开） | **未修复**（裁决 §5-A） |
| Settings 同时出现两套重复导航 | Sidebar settings 组 8 项 + 页内 SectionNav 并存 | **未修复**（裁决 §5-A-2） |
| 页面出现整页水平滚动 | `.page-viewport{overflow:auto}` 双轴，未禁止横向 | 部分（风险存在，需实测确认） |
| Inspector 被挤出 viewport | `.app-workspace` 100vh 固定（styles.css:476）移动端截断（11c-1） | **未修复** |
| 一个输入框横跨整个主区域 | Settings `.form-panel` 无 max-width（styles.css:2501） | **未修复** |
| 一个复杂功能只由 Card+Button+Table 拼成 | 已消除（DataTable/FilterBar/Drawer/Tree/Inspector，§3 速览） | 已修复 |
| 空白 Card 占据大量空间 | PageSection 仍逐页包裹；Settings 内容页（About/Acknowledge/Appearance）为纯 section 文案页 | 部分 |
| Raw i18n key 暴露 | lint-i18n 强制翻译，无证据 | 已修复 |
| Raw backend placeholder 暴露 | 占位统一「—」（Ops/FooterStatus），mock 禁托管；无证据 | 已修复 |
| UUID、时间戳未经格式化占据主要视觉空间 | 技术标识经 CodeText/CodeViewer 作 secondary；时间戳逐页未全量核实 | 部分（4.8） |
| 页面之间间距/字号/按钮/圆角/表格行为不一致 | token 已统一（font.*/control.*/radius/table-row），页面级收敛未 QA（POL-082-003/REQ-082-023 待实施） | 部分 |

### 4.12 新方案 §11b「修复样式污染，重建统一样式权威」→ **与现状一致，需实施**

| 硬性要求 | 082 现状 @ HEAD（证据） | 判定 |
| --- | --- | --- |
| 平台级语义类只存在于统一样式层，模块不得 `:global` 重定义 | 6 模块 `.module.css` 共 **137 处 `:global`** 定义平台语义类（`.permission-matrix/.role-checklist/.form-error/.session-row/.permissions/.auth-panel/.settings-stack` 等） | **未满足**（方案主张 = 现状事实，差距为未实施） |
| 模块样式只允许模块专属 selector（CSS Modules 局部类） | 平台类泄漏全局（上）；`lint-architecture.mjs` 不检查 `:global` 泄漏/平台类重复/私有覆盖 | **未满足** |
| 命名唯一（平台统一 kebab-case，消灭 camelCase 变体） | `styles.pageMeta/formHint/shellSearchTrigger/footerStatus`（OpenAPIPage/RequestPane/FooterStatus）vs 平台 `page-meta/.search-trigger` | **未满足** |
| 禁止私有覆盖平台类（含 media query） | 720px 内 `.iamModule :global(.toolbar){display:grid}`（iam.module.css:111-113） | **未满足** |
| 验收：lint:architecture 全面执行 | 当前仅查 6 类既有规则（业务 selector 不入 styles.css / alias / query 入口 / 平台 internal / 跨模块 / moduleId 分支） | **未满足** |

**小节判定**：未满足。修复路径 = 模块 CSS 平台类收归 styles.css + 局部类化 + lint 扩展（§6 档 1）。

### 4.13 新方案 §11c「重写布局骨架，修复滚动与视口缺陷」→ **与现状一致，需实施**

| 硬性要求 | 082 现状 @ HEAD（证据） | 判定 |
| --- | --- | --- |
| Sidebar 固定 viewport（独立可滚动） | grid 列 + `min-height:100vh`（L263-283）+ `overflow:hidden`（L283）——非真固定、无独立滚动 | **未满足** |
| 主工作区独立滚动；document/body 不承担滚动 | workspace `height:100vh;overflow:hidden` + `.page-viewport{overflow:auto}` | 部分满足（滚动在内容容器；document 不滚） |
| 视口高度用 100dvh | 全部 `100vh`（`.app-shell` L266、`.app-sidebar` L278、`.app-workspace` L476） | **未满足** |
| 横向空间按场景充分使用；取消「一切压中央 max-width」唯一路径 | `.page-viewport` `max-width:1600px + margin:0 auto`（L820-828）；`--content-max-*` 档声明未接线 | **未满足** |
| 移除全局打开页面标签条；只保留主导航+面包屑+浏览器历史 | WorkspaceTabs 仍渲染（AppShell.tsx:145） | **未满足**（裁决 §5-A） |
| 禁止主工作区无意义水平滚动 | `.page-viewport{overflow:auto}` 双轴 | **未满足**（需 overflow-x 治理） |

**小节判定**：未满足（方案 5 项主张全部与 HEAD 代码一致，属未实施）。

### 4.14 新方案 §11d「后台产品设计风格基准」（基线 27 节聚类对照）

| 基线节 | 要求 | 082 现状 | 判定 |
| --- | --- | --- | --- |
| 一/二 定位与关键词 | Modern Enterprise Admin Console；避免廉价/默认库样式/大量蓝按钮/满地 Card/大圆角/玻璃拟态/大阴影/模板页 | 产品定位已确立；避免项未系统复核 | 部分满足 |
| 三 不把现有页面骨架当约束 | 从 User Goal→Workflow→IA→Functional→UI 推导 | 082 已重排页面但沿用旧表单/区块布局 | 部分满足（083 执行规则） |
| 四 从业务任务开始 | 禁止 Header→Card→Table→Button 直排 | 已基本遵循 | 已满足 |
| 五 禁止原子组件堆砌 | FilterBar=Query Builder；MetricCard=label/value/trend/delta/chart/drill | FilterBar 已建（无 Saved Views/高级条件形态）；MetricCard **未组件化**（现 StatCard 无 trend/chart） | 部分满足 |
| 六 Business Components | DataTable/FilterBar/EntityHeader/MetricCard/StatusBadge/ActivityTimeline/DetailDrawer/BulkActionBar | 已建 DataTable(增强)/FilterBar/StatusBadge/DetailDrawer/BulkActionBar；**缺 EntityHeader/MetricCard/ActivityTimeline** | 部分满足 |
| 七 页面模板体系 | Dashboard/List Workspace/Detail Page/Configuration/Analytics 5 模板 | List Workspace 最近形（部分页）；Configuration≈SectionNav；**Dashboard/Detail/Analytics 模板未建** | 部分满足 |
| 八 布局系统 | Sidebar 240、Topbar 56–64、Content 不机械限宽、8px spacing | spacing✓；sidebar 264（超）；content 1600 居中（未按场景）；header 64 | 部分满足 |
| 九 Sidebar 设计 | sticky/fixed + 独立滚动；禁止撑高/错位/随滚动消失 | 当前 grid 列 + min-height:100vh + overflow:hidden（不独立滚动） | 部分满足（11c 承接） |
| 十 Header 设计 | Breadcrumb/全局搜索/命令/通知/Help/User；支持 紧凑 | Breadcrumb✓/搜索 trigger✓/语言/主题/用户✓；**命令面板/通知/Help 缺** | 部分满足 |
| 十一 Page Header | 左标题+上下文；右主/次/溢出操作 | PageHeader✓ | 已满足 |
| 十二 视觉色板 | bg#F6F7F9/surface#FFF/text/border/primary#4F46E5 或 #2563EB/success/warning/danger/info | `--page:#f5f7fa`、`--surface:#fff`、`--border:#e5e7eb`、primary `#3b82f6`(+strong #2563eb) | 部分满足（主色校准） |
| 十三 圆角 | Button/Input 6–8、Card 8–10、Modal 10–12 | `--radius-xs:6` + HeroUI radius；上限 16 个别使用 | 已满足（复核） |
| 十四 阴影 | 仅 Popover/Dropdown/Modal/Floating/Command palette | overlay 专用 shadow | 已满足 |
| 十五 字体层级 | Page 24-28/600、Section 16-18/600、Body 14、Secondary 13、Label/Meta 12 | font.*/weight/lineheight token 已建（styles.css:80-94）；页面级用法未全量复核 | 部分满足 |
| 十六 Table 核心工作区 | sticky/sort/filter/search/pagination/selection/row action/列配置/密度/状态/bulk/hover/overflow | 已实现列可见性/密度/sticky/row menu/selection；**sort/filter 无后端**；列配置 UI/导出/上下文菜单未全量 | 部分满足 |
| 十七 状态设计 | 全状态集 | 机制齐，页面覆盖不全（4.10） | 部分满足 |
| 十八 Empty State | 为什么/能做什么/动作 | EmptyState 组件已建；AccountsPage 未采用（page-meta 段落） | 部分满足 |
| 十九 Loading | Skeleton/Table skeleton/Button loading 非整页 Spinner | 分级 Skeleton ✓ | 已满足 |
| 二十 交互反馈 | 成功 Toast/失败+retry/危险确认/复杂危险确认输入 | Toast/InlineAlert/ConfirmDialog/DangerZone(含 inputConfirmation)✓；规范文档（DOC-082-001）待实施 | 部分满足 |
| 二十一 复杂功能设计 | Role & Permission：Members/Matrix/Summary/继承/Search/Partial/Unsaved | 分组矩阵✓；Summary/Unsaved 变更态/继承呈现未全 | 部分满足 |
| 二十二 Design System/组件库 | 不自研基础 UI；库仅是基础设施；建 Design Tokens/Business Components | 与 082/新方案 §3 一致；候选见 4.3 | 已满足（含候选） |
| 二十三 代码层组件架构 | `features/users/{components,hooks,services,types,utils,...}`，禁千行单文件 | 单文件页面（AccountsPage 191 行未达千行但未 feature 化） | **未满足** |
| 二十四 响应式 | 1366×768/1440×900/1920×1080；Tablet collapse；小屏数据优先 | 720px 断点+抽屉✓；三档量化验收未做 | 部分满足 |
| 二十五 每次重构前分析 | Existing Problems→User Goal→…→实现 | 工作方法（083 执行约束） | 已满足（约束） |
| 二十六 禁止行为清单 | 不换皮、不旧 Card 换新、不单 Card 承载复杂、不一致状态色、自研基础组件… | 已基本避免 | 已满足（红线延续） |
| 二十七 最终标准 | 商业产品质感；不达标继续重构 | 验收愿景（082 五问标准近似） | 候选（验收输入） |

**小节判定**：部分满足——大量设计意图已在 082 token/组件层具备基础；真实缺口集中在布局数值接线（§4.7）、页面模板（七）、feature 代码架构（二十三）、MetricCard/EntityHeader/ActivityTimeline 业务组件、状态全集逐页化。

### 4.15 新方案 §12「工作方式」与最终验收标准

| 要求 | 082 现状 | 判定 |
| --- | --- | --- |
| 顺序：Audit→确认栈→Replace Shell→Design tokens→共享产品组件→业务组件→Extend backend→迁移→QA | 082 已执行 Audit/确认栈/token/部分产品组件/迁移/QA；**Replace Shell（骨架重写）与 Extend backend 未执行** | 部分满足（流程与 083 规划对齐） |
| 不要先逐页面修 CSS / 不要保留错误架构 / 直接修改真实项目 | — | 执行红线（083 采纳） |
| 最终验收：隐藏 Logo 仍像成熟 Admin Console；Backend compatibility+enhancement+mature FE+统一组件+统一视觉+生产可用；只「更漂亮」视为失败 | 当前仍带 TabBar/Footer/居中 max-width/Preset 青主色等「旧影像」，达不到「一眼成熟」 | 候选（验收标准；差距即 §4.11-4.14 未满足项） |

---

## 5. 冲突裁决表（必须裁决点）

| ID | 冲突点 | 082 侧证据 | 新方案侧证据 | 裁决建议 | 理由 |
| --- | --- | --- | --- | --- | --- |
| **A** | 「推倒错误骨架/重写 App Shell」vs 082 AppShell 已实现 | `app-shell` grid+移动抽屉+焦点圈养+zone/manifest 装配（AppShell.tsx 全量；R001 §4.2）是 059/071 成品；AppSidebar/AppHeader 结构与方案 §1 目标一致 | §1「旧 Layout 无法满足就删除重写」；§11c 5 项骨架缺陷（100vh/居中 max-width/侧栏不可独立滚动/footer/tab） | **分治裁决**：真实缺陷（§11c 5 项 = §1 中「Sidebar 独立滚动/滚动容器/宽度利用/Footer/TabBar」5 项）必须重写的是**样式骨架层 + AppShell JSX 装配细节 + ScrollExperience 语义**；**组件结构（grid 装配、移动端行为、manifest 驱动、zone 注入、焦点/a11y）已达标，保留并复用**，不整组件推倒。重写范围严格限定在 styles.css Shell/workspace/viewport 分区与 AppShell.tsx 的 workspace/footer/tabs 段 | 「OKR 已达标的部分重写」违反 AGENTS 3.8/无收益重构；未达标部分（滚动/宽度/Footer/TabBar）正是新方案点名缺陷，必须重写 |
| **B** | 「移除全局 Tab Bar」vs DEC-082-001「保留 WorkspaceTabs 为导航辅助」 | DEC-082-001 确认「保留，不删除」（082 tasks.md 决策结论）；WorkspaceTabs 有 roving 键盘/可关闭/测试（WorkspaceTabs.tsx；R001 §4.2） | §1「移除现有全局打开页面标签条」、§11「顶部堆十几个页面 Tab」、§11c-5「移除全局打开页面标签条；只保留主导航+面包屑+浏览器历史」 | **变更决策**：083 采纳移除 —— 删除 WorkspaceTabs 渲染、`visitedRouteIDs` 状态、showTabs 偏好与其测试（单轨 3.8）；保留 route access/menu 导航与面包屑。理由：新方案经用户重写为本任务当前权威目标，且 §1/§11/§11c 三处点名；「历史页签」无真实 multi-document workspace 用例（R003 早列候选），保留即双轨风险 | 【事实】方案文本强制移除；【推断】无真实跨文档工作流支撑保留；浏览器 history 已足够（react-router） |
| **B-2** | Settings 双导航（Sidebar 组 + 页内 SectionNav） | Sidebar settings.center 8 项（webui-registry 菜单）+ SettingsLayout SectionNav（SettingsLayout.tsx:45） | §9「Settings ├── Local Navigation └── Content」；§11-4「Settings 同时出现两套重复导航」 | **随 B 一并裁决**：移除 TabBar 后主导航仅 Sidebar；Settings 的 Sidebar 组收敛为**单入口（Settings 首页）**，分区导航由页内 SectionNav 承担（Local Navigation = 唯一二级导航）；或保留 Sidebar 全列表但去掉 SectionNav（二选一，禁并存） | 消除「多套二级导航」目标（§1）；与基线 §七 Configuration 模板一致 |
| **C** | 「Backend Compatibility ≠ Backend Freeze（需要时补后端）」vs 082「不扩展后端」 | 082 requirements 非目标「不改变 Backend Contract…」（且 082 范围 = R003 裁剪；tasks.md「后端能力扩展…不纳入 082（R002 边界）」；R003 拒绝项清单） | §6「成熟前端确实需要而 Backend 缺失的能力，应直接补齐 Backend」列 10 类能力 | **变更决策**：083 采纳「兼容 + 需时补足」—— 现有 55 operation 契约保持兼容（AGENTS 3.8、R002 §13 红线不变），新增后端能力**逐项立项**（带真实产品价值证据 + R002 现状对照 + oasdiff breaking 基线 + 迁移集），不得为 UI 虚构。**最小必补 = sorting**（真实缺失，证据 §4.6）；detail/batch/counts/org reorder 按需求评估；审计完整元数据/User Activity 判不改（低敏设计） | 新方案为本任务权威目标；「Backend Freeze」只是 082 的范围裁剪而非已验证技术边界（R003 明确「不属 062/068/069 已验证边界」类）；sorting 缺口已有前端契约等待消费 |
| **D** | 「基于当前组件栈，缺口用成熟技术补齐」vs 082 HeroUI 单轨 | 068 单轨边界 + 082 非目标「不引入第二套 UI 栈」；package.json 单轨 | §3「不替换当前组件栈」「不要混用第二套视觉体系」 | **确认无冲突**：继续 HeroUI v3 + RAC + Tailwind v4 单轨；083 只评估候选：RHF/zod（已声明未用，DEC-082-002 已确认启用 → 083 承接表单迁移或显式退役）、TanStack Table（仅当 DataTable 需列固定/虚拟化/多列排序超 HeroUI 能力，且先有后端 sort，条件候选）、图表库（真实需求出现再评估，081 自研 SVG 先用）；Trace：这些候选只评估不默认引入 | §3 与 068/082 同向；AGENTS 3.2 要求候选有真实用例才引入 |

**其他已确认兼容点（无冲突）**：静态插拔主线（062）、overlay/Switch 自绘边界（069）、单调 Styles authority 方向（057/059/082）、强 i18n、模块页面 owner、禁 fake（方案 §6 自身强调「不制造假数据/假操作」与 AGENTS 一致）。

## 6. 可落地范围建议（三档）

按「方案硬性要求 + 真实缺陷证据 + 工作量可控」分档（083 requirements/design/tasks 的直接输入）：

### 档 1：样式权威重建（对应 §11b；工作量 L，先行）
- 扩展 `lint-architecture.mjs`：模块 `.module.css` 的 `:global` 平台类泄漏 / 平台类重复定义 / media query 私有覆盖 / camelCase 平台语义变体 → fail；新增页面样式必须落平台原语或模块局部类。
- 迁移 6 模块 `.module.css`（137 处 `:global`）：平台语义类（`.permission-matrix/.role-checklist/.form-error/.session-row/.permissions/.auth-panel/.settings-stack/.pageMeta 类` 等）收归 `styles.css` 并统一 kebab-case；模块专属类改局部选择器；删除私有覆盖（iam.module.css:111-113）。
- 验收：`pnpm lint:architecture` 全绿 + 新增样式走原语/局部类；同步 `docs/development/webui.md` 样式 authority 附录。
- 影响文件域：`webui/scripts/lint-architecture.mjs`、`webui/src/styles.css`、6 模块 `*.module.css`、引用 camelCase 的 tsx（OpenAPIPage/RequestPane/FooterStatus 等）。

### 档 2：布局骨架重写（对应 §1/§11c；工作量 L，先行）
- 滚动模型：`100vh` → `100dvh`（app-shell/app-sidebar/app-workspace）；滚动容器语义收敛（Main Workspace 独立滚动，`.page-viewport` 不再承担居中 max-width）；Sidebar 固定 + 独立滚动（`position:sticky/fixed` 或等效 grid 语义，sidebar-nav overflow-y auto）；`overflow-x` 治理（禁整页横向滚动，表格横向由列语义容器承担）。
- 宽度场景档接线：消费 `--content-max-*`（Table/Dashboard 全宽、Settings 640–960、Detail 中宽、Form 640–760）；删除「一切压 1600 居中」唯一路径。
- Footer/TabBar：按裁决 A/B 删除 `.app-footer` 渲染与 WorkspaceTabs（含 visitedRouteIDs/showTabs 偏好与测试）；Settings Sidebar 组收敛为单入口（裁决 B-2）。
- 保留：AppShell grid/移动抽屉/焦点圈养/zone/manifest 装配结构与既有测试基座（Vitest 192/mock E2E 3 回归）。
- 影响文件域：`webui/src/styles.css`（Shell/workspace/viewport 分区）、`webui/src/components/AppShell.tsx`、`webui/src/components/shell/WorkspaceTabs.tsx`（删除）、`webui/src/theme.ts`（showTabs/showFooter 清理）、`webui/src/scroll/ScrollExperience.tsx`（wrapper 语义）、相关 Vitest/Playwright 用例。

### 档 3：产品化 Feature 与后端补足（对应 §4/§5/§6/§8/§9/§10/11d；工作量 L+，依赖档 1/2）
- 后端补足（裁决 C）：**sorting 必补**（每列表白名单列 + asc/desc，挂 `useListQueryParams` 已有 sort 契约；新增 operation 走 contract-gen + oasdiff breaking）；按真实需求评估 detail 端点/batch（用户批量）/counts 聚合/org 树重排——每项立项需 R002 现状对照与产品价值证据。
- Feature 拆解：复杂页面按 §5/基线 §二十三 拆分 feature 子组件与目录（UserToolbar/UserDataGrid/UserDetailDrawer/UserCreateDrawer、RolePermissionEditor 的 Summary/Matrix/Search/ChangeDiff、NavigationPreview、Saved Views），接入 `useWebUIQuery/useWebUIMutation`（统一 Query/Mutation 层落地）；FilterBar 全量接线后端已有 typed filters（accounts status/archived/roleId 等）。
- 页面模板与状态全集（§10/§11d §七/§十七-十八）：List Workspace/Detail Page/Dashboard/Configuration 模板化；Loading/Empty/No Results/Error/Permission denied/Read-only/Saving/Success/Failure 逐页成语言（AccountsPage 等改 EmptyState 组件）。
- Settings（§9）：宽度档接线（表单 640–760）、Appearance 层级 + Preview、双导航收敛（裁决 B-2）。
- 视觉校准（§7/§11d §十二/十五）：主色收敛（`--primary` 对齐基线 #4F46E5 或 #2563EB，或裁定默认档）、sidebar 232–248/64–72、topbar 56、Button 尺寸 token 接线、页面级字体/圆角/密度复核；preset 系统与「Blue 主色」关系的裁定。
- 时间戳/技术标识格式化收尾（§8）+ 三层 QA（Design/Interaction/Backend Compatibility）+ 响应式三档（1366/1440/1920）量化验收 + 文档同步（webui 开发指南/documentation-impact.yaml）。
- 影响文件域：`webui/src/ui/index.tsx`（新业务组件）、模块 `binding/webui/web/*`、`webui/src/sdk/query/unified.ts`（消费）、`internal/module/*/binding/http/*`（后端补足）、`api/openapi.yaml`/`operation_inventory.gen.go`（生成物）、`docs/development/webui.md`。

依赖关系：档 1/2 可并行先行（无互相依赖）；档 3 依赖档 1/2 骨架稳定（页面模板建立在新的滚动/宽度模型之上）。

## 7. 局限

- 纯静态验证：未运行浏览器（082 Playwright dev 20 用例仍未执行），「整页水平滚动是否实际出现」「Inspector 被挤出」等以代码机制判定，未做 1440/1920 实测。
- 逐节判定以 HEAD 代码抽查 + 082 记录为准；未逐页通读全部页面（Sessions/ApiTokens/Roles 详情交互、Settings Account/Notifications 细节、OpenAPI 工作台内部），个别页面形态可能存在记录外的差异。
- 视觉类判定（克制度、层级、主色观感）以 token/机制为准，最终由 R083-003 逐页对照 + 人工 QA 完成。
- `:global` 137 处计数为 HEAD 实测（R001 快照 122 处，navigation 因 082 菜单页新增而增长），非 082 快照值；不影响结论方向。
- 后端补足建议基于 R002 快照（55 operation），若 HEAD 后 operation 清单变化需复核 oasdiff 基线。

## 8. 剩余未知

- Playwright dev（真实后端联调）20 用例未执行——082 页面的真实浏览器交互/滚动行为未验证，直接影响档 2 验收基线。
- 各页面时间戳/ID 直接呈现的逐页清单（§8 收尾范围未全量盘点）。
- HeroUI v3 Table 对列固定/虚拟化/多列排序的精确能力边界（若评估 TanStack Table 需浏览器实测）。
- sort 后端扩展的具体契约形态（列名白名单语义、默认排序、多列）；跳转 oasdiff breaking 基线。
- 主题预设（cyan/green/violet/orange 4 套）与「Blue 主色」收敛的取舍（影响档 3 视觉校准范围）。
- Ops Dashboard 轮询（约 5s×60 点）与 11d Dashboard 模板（Alerts/Insights/Trend）重做边界。
- RHF/zod 迁移成本（082 未迁移表单；083 承接需评估 Vitest/Playwright 回归基线）。

## 9. 对 083 requirements/design/tasks 的影响

1. **requirements.md**：
   - 硬性架构要求（REQ）：§11b 样式权威（lint 扩展 + 137 处 `:global` 清理 + 命名唯一 + 禁私有覆盖）与 §11c 布局骨架（100dvh/独立滚动/宽度档接线/移除 Footer/TabBar）为必须项，验收绑定 `lint:architecture` 与浏览器三档实测。
   - 决策变更项（写入 DEC-083-0x，引用本档案 §5）：App Shell 分治裁决（A）、移除 WorkspaceTabs（B，覆盖 DEC-082-001）、Settings 双导航收敛（B-2）、后端补足立项（C，sorting 必补 + 其余按需求）、组件栈确认无冲突（D）。
   - 页面产品化（REQ）：Feature 拆解、页面模板/状态全集、Settings 宽度与层级、视觉校准、Query 统一层落地、时间戳/技术标识格式化。
   - 非目标：不引入第二套 UI 栈；审计完整元数据/User Activity timeline 不补（低敏设计）；无真实场景的批量/图表/多实例不立项；「不扩展后端」的旧裁剪结论被 C 取代，但**新增后端能力必须逐项立项并保留现有 55 operation 兼容**。
2. **design.md**：三档落地顺序（样式权威重建 → 布局骨架重写 → 产品化 Feature 与后端补足）；样式权威架构（lint 规则清单 + 平台类收编方案）；布局骨架目标（滚动/宽度/footer/tab 模型图）；后端补足设计（sort 契约 + 候选清单与评估标准）；模块 CSS 迁移策略（单轨、无旧副本）。
3. **tasks.md**：按三档切片（T1 样式权威、T2 骨架重写、T3 产品化+后端），逐条标注来源（新方案节号 + 本档案判定/裁决 ID + R002 证据节号）；验证矩阵保留 Vitest 192/mock E2E 3 回归基线并新增 dev 联调轮与 lint 新规则用例。
4. **文档同步**：`docs/development/webui.md`（样式 authority 附录更新）、`webui/README.md`、`documentation-impact.yaml`、`docs/changes/README.md`；任何新增后端 operation 更新 `api/openapi.yaml` + `operation_inventory.gen.go` + `api/README.md`（生成链）。

---

### 事实/推断标注汇总

- 【事实】§3 基线速览全部条目、§4 各节证据列、§4.11-4.14 缺陷清单、§4.12/4.13 全部证据（HEAD 代码实测 + R002 节号）。
- 【推断】裁决 A/B/C/D 的建议（§5 理由列已标注依据）；「无真实多文档工作流支撑保留 TabBar」「navigation 模块 :global 增长主因」等；档 3 中「sorting 必补后其余按需求」属优先级判断。
- 未经浏览器实测的结论在 §7/§8 如实标注，不作为已实现事实使用。