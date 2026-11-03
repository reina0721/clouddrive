# 083 需求规格：Production-grade 全栈产品重构（WebUI 产品化二期）

引用研究：[R083-001](research/R083-001-proposal-vs-082/report.md)（新方案 vs 082 现状差异与裁决）、[R083-002](research/R083-002-style-layout-baseline/report.md)（样式权威与布局骨架事实基线）、[R083-003](research/R083-003-baseline-page-audit/report.md)（设计基线逐页对照）。方案输入 `docs/changes/temp-new-changes.md`（Production-grade 全栈产品重构，下称「方案」）与 `docs/changes/admin-design-baseline.md`（下称「基线」）。

## 1. 目标

在 082 已实施平台底座与页面迁移之上，按新方案把 WebUI 推进为**生产级 Administration Control Plane**：修复样式污染与布局骨架缺陷（方案 11b/11c）、按设计基线完成页面产品化（11d）、按「兼容 + 需时补足」评估后端能力（6）。研究门禁已通过：四裁决点 A（App Shell 分治：结构保留、样式骨架重写）、B（移除 Tab Bar）、C（Backend 兼容 + sorting 必补）、D（组件栈确认无冲突）；页面对照显示 105 项有效判定仅 28.6% 达标，需按重做优先序 P0-P5 收敛。

## 2. 功能要求

### 2.1 样式权威重建（方案 11b，档 1，优先）

| ID | 要求 | 来源/证据 |
| --- | --- | --- |
| `REQ-083-001` | **lint 规则扩展**：`lint-architecture.mjs` 增加 CSS 扫描——禁止模块 `*.module.css` 中 `:global` 定义平台级通用语义类、禁止平台类重复/私有覆盖、禁止 `:global` 真全局泄漏；验收以「故意违规会失败的反向 fixture」为保证（仿 049 门禁）。 | R083-002 §6.1；805R 11b |
| `REQ-083-002` | **137 处 `:global` 清理**：21 处死代码（auth audit-* 9、iam session-* 7、navigation policy-grid/policy-card 5）直接删除；其余归类收敛——平台级语义类并入 `styles.css` 或平台原语、模块专属类改 CSS Modules 局部类；1 处真全局（ops header-zone-action）改受控平台类。 | R083-002 §3/§5 |
| `REQ-083-003` | **命名唯一**：消灭 camelCase 变体（`pageMeta/formHint/shellSearchTrigger/footerStatus` 等）与平台 kebab-case 同名近义类；统一到平台命名。 | R083-002 §3.3 |

### 2.2 布局骨架重写（方案 11c，档 2）

| ID | 要求 | 来源/证据 |
| --- | --- | --- |
| `REQ-083-004` | **视口单位**：`.app-workspace` 等核心固定规则改 `100dvh`（styles.css 11 处 100vh 中的核心 3 处必改，其余按需）；移动端地址栏伸缩不截断底部。 | R083-002 §4.2 |
| `REQ-083-005` | **独立滚动**：页面滚动收敛到独立 Main Workspace（`.page-viewport` 不再承担居中限宽 + 自身滚动）：Sidebar 固定在 viewport 且内部独立滚动；主工作区独立滚动；document/body 不承担页面滚动。 | R083-002 §4.3 |
| `REQ-083-006` | **宽度档接线**：`.page-viewport` 取消固定 `max-width:1600 + margin auto` 单一路径；接线既有 `--content-max-*`（wide/detail/settings/form 4 个零消费 token）：Table/Dashboard 全宽、Settings 640–960、Detail 中宽 800–1200。 | R083-002 §4.4；方案 §8/§11 |
| `REQ-083-007` | **移除 Tab Bar 与 Footer**：卸载 `WorkspaceTabs` 装配（AppShell showTabs + visitedRoutes 状态机 + theme.layout.showTabs 偏好）——裁决变更 DEC-082-001；移除 `showFooter` 工作区占用（方案 §1「删除固定 Footer 对工作区的占用」）；删除相关组件与测试（单轨 3.8）。 | R083-001 裁决 B；R083-002 §4.5 |
| `REQ-083-008` | **Settings 双导航收敛**：设置区 Sidebar 8 项与页内 SectionNav 并存收敛为「全局菜单单入口 + 页内 Local Navigation」单一形态。 | R083-001 裁决 B-2 |

### 2.3 页面产品化与设计基线落地（方案 11d，档 3）

| ID | 要求 | 来源/证据 |
| --- | --- | --- |
| `REQ-083-009` | **按重做优先序迁移页面**：P0 样式+宽度接线 → P1（Audit 分页、时间戳格式化、Settings 双导航）→ P2（FilterBar 接线、后端 sort）→ P3（MetricCard/EntityHeader 组件化、操作列 1+…折叠）→ P4（危险确认、空载态）→ P5（Feature 拆解）。每页对照 R083-003 表格的「083 任务输入」列实施。 | R083-003 重做优先序 |
| `REQ-083-010` | **后端 sort 支持（必补）**：为真实缺失的列表 sorting 增加后端参数（R003 §7.3 无 sort），前端 `useListQueryParams` 已有 sort URL 契约接线；涉及 account/role/session/api-token 列表。 | R083-001 裁决 C |
| `REQ-083-011` | **危险操作确认补齐**：Accounts/Roles/ApiTokens/Departments 的归档/吊销/删除操作接入 ConfirmDialog/DangerZone 确认流程（当前直接执行，R083-003 D10）。 | R083-003 重做项 |
| `REQ-083-012` | **后端能力按需补足（评估制）**：detail/batch/counts/org reorder 等按真实业务需求评估后补充（非默扩展）；审计完整元数据、User Activity **判不补**（低敏设计，R002 §5.1/§4.1）。 | R083-001 裁决 C |

### 2.4 决策点（计划确认阶段）

| ID | 决策 | 选项 | 研究建议 |
| --- | --- | --- | --- |
| `DEC-083-001` | App Shell 重写范围 | 结构保留 + 样式骨架重写（分治）/ 整体重写 | 分治（R083-001 裁决 A）：grid/移动抽屉/manifest/zone/a11y 结构已达标保留 |
| `DEC-083-002` | Tab Bar 移除 | 移除（删除组件+测试）/ 保留 | 移除（裁决 B；变更 082 DEC-001） |
| `DEC-083-003` | Backend 补足范围 | 仅 sorting（必补）/ sorting+按需评估其他 | 仅 sorting 必补，其余按需求评估（裁决 C） |
| `DEC-083-004` | 状态组件统一 | StatusPill/StatusBadge 归一套 / 双轨保留 | 归一套（R083-003 新增裁决点） |
| `DEC-083-005` | 表单库 | 启用 RHF+zod 并迁移 / 继续手写 | 启用（082 DEC-002 已确认；R083-001 候选） |

## 3. 候选方向（仅记录）

- TanStack Table：条件候选（需先有后端 sort 再评估是否替换现有 DataTable 内部实现）。
- Recharts/ECharts：复杂图表真实需求出现时评估（延续 081 结论）。
- 全局实体检索（Command Palette 实体级）：候选，不立项。
- 审计完整元数据、User Activity、多实例/远程模块：无真实数据/低敏设计，不补。

## 4. 非目标

- 不替换组件栈（HeroUI/RAC/Tailwind 单轨确认，方案 §3 = 083 裁决 D）。
- 不为样式重建引入第二套 CSS 体系（仍以 `styles.css` + Tailwind + CSS Modules 为 authority）。
- 不机械扩展后端（仅 sorting 必补 + 明确评估项）；不伪造后端数据视图（红线延续）。
- 不处理 `frontend/`（Nuxt，未接入）与 `old-backend/`（排除目录）。

## 5. 验收标准

1. 样式权威：lint 新规则有反向 fixture 且全库 137 处 `:global` 清理后 0 泄漏；平台类唯一命名无 camelCase 变体。
2. 布局骨架：`100dvh` 视口、Sidebar 固定独立滚动、Main Workspace 独立滚动、宽度档接线（Table 全宽/Settings 收窄）、Tab Bar 与 Footer 移除后装配无残留。
3. 页面产品化：R083-003 重做优先序 P0-P4 完成后逐页对照达标率明显提升（目标 ≥70% 有效判定达标或部分→达标收敛），危险操作全确认、空载态全规格。
4. 后端：sorting 上线且前端 sort URL 契约消费；其余评估项按确认范围实施。
5. 回归：`go test ./...`、`go vet ./...`、Vitest ≥192、Playwright mock ≥3、typecheck/lint（含新规则）、build、generate:check 全绿。