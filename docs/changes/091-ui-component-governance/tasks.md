# 091 任务与证据

## 研究与计划

- [x] R091-001 组件来源审计与原生控件排查；证据：`research/R091-001-component-source-audit/`（组件来源清单、原生控件定位、保留/重构/替换结论）。
- [x] R091-002 TailAdmin 设计规律研究；证据：`research/R091-002-tailadmin-design-study/`（统一组件来源/克制表面层级/一致控件度量/稳定内容边界；web_search 不可用，为内部复核并标注）。
- [x] PLAN-091-001 完成需求、详细设计与任务清单；证据：`requirements/`、`design/`。
- [x] CONFIRM-091-001 用户确认 091 当前方案；前置：全部研究和计划已完成；完成条件：用户在本计划报告之后明确确认；证据：用户消息（确认 091 计划，开始实施）+ 本目录 README 状态更新。

## 实施基线

- [x] BASELINE-091-001 记录确认时 revision 与 Git 状态；前置：CONFIRM-091-001；完成条件：记录当前 commit 与工作区状态，确认用户未提交改动不受影响；证据：revision `de1e2d9`（与 R091-001/002 快照一致，无漂移）+ 工作区状态（用户改动保持不变）。

## 统一控件实现

- [x] UI-091-001 实现 FilterBar select 分支统一（紧凑 HeroUI Select，替代原生 `<select>`）；前置：CONFIRM-091-001；完成证据：FilterBar 的 select 控件渲染为 HeroUI Select（`FilterSelect`，含 Trigger/Popover/ListBox/键盘/ARIA），`FilterBarField` 契约不变；E2E 断言 `.filter-bar select` 计数改为 `.filter-select-control` 统一控件（隐藏的原生 select 为 HeroUI 读屏 fallback，源码零用户可见原生 select）；084b mock E2E 通过。
- [x] UI-091-002 实现 Pagination pageSize 控件统一；前置：CONFIRM-091-001；完成证据：Pagination 每页条数下拉为统一 `FilterSelect`；typecheck + mock E2E 通过。
- [x] UI-091-003 实现宿主语言切换统一（AppHeader + AppShell）；前置：CONFIRM-091-001；完成证据：两处语言切换下拉为统一 `FilterSelect`（保持图标形态）；mock boot E2E（语言切换断言）通过。
- [x] UI-091-004 实现 DataTableRowMenu 自研 popover → HeroUI DropdownMenu；前置：CONFIRM-091-001；完成证据：行菜单弹出层为 HeroUI Dropdown（RAC MenuTrigger/Menu 底座，Portal/定位/键盘/焦点由库承担），危险项隔离保留（`variant="danger"`），`renderRowMenu` 契约不变；data-table-enhancements 单测通过。
- [x] UI-091-005 实现 data-table-columns 菜单 → DropdownMenu + Check；前置：CONFIRM-091-001；完成证据：列显隐菜单为 HeroUI Dropdown，勾选为统一 `Check`（RAC Checkbox），原生 checkbox/details 移除；单测更新通过。
- [x] UI-091-006 删除 DangerZone 自研 dialog 残留块（双弹层），确认弹层统一为 RAC ConfirmDialog 并保留输入标识符确认语义；前置：CONFIRM-091-001；完成证据：DangerZone 无双弹层、自研 `role="dialog"` 块删除、`inputConfirmation` 由 ConfirmDialog `confirmInput` 承载（RAC Modal）；status-semantics 单测通过。
- [x] UI-091-007 实现 WorkspaceContextMenu → RAC Menu；前置：CONFIRM-091-001；完成证据：Shift+F10 上下文菜单为 RAC MenuTrigger/Menu（与溢出菜单同源），自研 `role="menu"` 块删除；WorkspaceTabs 单测更新（查询 body portal）通过。
- [x] UI-091-008 评估 ThemeDrawer 自研 tab；前置：CONFIRM-091-001；完成条件：评估 RAC Tabs 替换；结论：**保留自研 tab**——当前实现已具备正确 ARIA roving tab 语义（role=tab/aria-selected/tabIndex roving + Home/End/Arrow 键盘，`getThemePanelTargetIndex` 单测覆盖），抽屉本体已是 RAC Modal+Dialog；RAC Tabs 替换收益低（键盘/焦点已达标）且结构变动大（TabList/Tab/TabPanel 重写 + 测试重写），按设计「若与面板交互冲突则记录为后续项」条款记录为保留项；证据：theme-drawer.test.ts。

## 页面替换

- [x] PAGE-091-001 迁移 MenusPage 父级 select → SelectField、number input → Field；前置：UI-091-001；完成证据：MenusPage 无原生 select/number input（父级用 `SelectField`、排序用 `Field type="number"`）；typecheck 通过。
- [x] PAGE-091-002 迁移 AuditPage pageSize select → 统一 Select；前置：UI-091-002；完成证据：AuditPage pageSize 用 `FilterSelect`（游标分页自身控件，非统一 Pagination 的 pageSize）；typecheck + mock E2E 通过。
- [x] PAGE-091-003 迁移 ApiTokensPage scope 原生 checkbox → Check；前置：CONFIRM-091-001；完成证据：scope 多选与"全选"均用统一 `Check`（RAC Checkbox）；api-token mock E2E 更新（点击 label 切换）通过。

## 样式与 Token

- [x] STYLE-091-001 删除被替换的自研 CSS；前置：UI-091-004/005/006/007；完成证据：`.data-table-row-menu-item*`、`.data-table-columns`（容器/菜单/item）、`.danger-zone-confirm*`、`.workspace-context-menu`（自研 fixed 容器）已删除；`.data-table-row-menu-popover` 改为仅宽度（RAC Popover 承担定位）；`.rac-menu-item:disabled` 通用化。
- [x] STYLE-091-002 统一筛选控件度量；前置：UI-091-001；完成证据：FilterSelect 与筛选控件遵守 `--control-height-md` 等 token（`.filter-select-control [data-slot="trigger"] min-height: var(--control-height-md)`），`.filter-select`/`.filter-bar-fields .filter-select`/响应式选择器同步更新；build 通过。

## 验证与收尾

- [x] VERIFY-091-001 全量验证；前置：全部实施任务；完成证据：Go `build`/`test ./...` 全绿、`git diff --check` 干净；WebUI `typecheck`、`vitest`（251 tests）、`eslint`（0 errors，仅 4 条既有测试文件 warning）、`lint-architecture`、`build` 全绿；mock Playwright E2E 19/19 通过。
- [x] VERIFY-091-002 代码层二次扫描；前置：全部实施任务；完成证据：grep 扫描确认业务页面与宿主 `webui/src` 零用户可见原生 `<select>`（仅 HeroUI Select 内部隐藏 fallback）、零页面级原生 checkbox（除 DataTable 行选择，已记录为后续项）、零自研 popover/dialog/menu 残留（`data-table-row-menu-item`/`danger-zone-confirm`/`workspace-context-menu` 自研实现已删除）。
- [x] CLEANUP-091-001 删除已替换的自研组件旧实现；前置：UI-091-004/005/006/007、PAGE-091-*；完成证据：自研 popover/dialog/menu 代码与死 CSS 已删除（单轨），旧符号零引用。
- [x] DOC-091-001 同步 `docs/development/webui.md`；前置：CLEANUP-091-001；完成证据：新增「组件来源层级与禁止页面级重复造轮子（091）」小节（层级图、各控件来源、保留自研边界）。
- [x] GIT-091-001 按仓库规则审阅、精确暂存并提交本任务；前置：全部验证通过；完成证据：Conventional Commit：`feat(webui): unify selects via HeroUI FilterSelect`（b4c275c）、`feat(webui): replace self-built overlays with HeroUI/RAC and unify page controls`（f8ca65c）、`refactor(webui): keep data-table row selection native, add Check ariaLabel`（542ac60）、`refactor(webui): drop unused DangerZone busy props and imports`（02f9cb8）等；用户与其他 agent 并行改动（AppearancePage/e2e 润色）未纳入暂存。

## 范围外（记录，不实施）

- RouteSearch 的 RAC ComboBox 替换（可选后续）。
- TreeView 的 RAC Tree 替换（业务复合，保留）。
- AuditPage datetime-local 的 DatePicker 替换（后续项，本任务仅样式统一）。
