# 083 设计方案：Production-grade 全栈产品重构（WebUI 产品化二期）

引用研究：[R083-001](research/R083-001-proposal-vs-082/report.md)、[R083-002](research/R083-002-style-layout-baseline/report.md)、[R083-003](research/R083-003-baseline-page-audit/report.md)。需求见 [requirements.md](requirements.md)（REQ-083-001..012、DEC-083-001..005）。

## 1. 背景与总体策略

082 已交付平台底座与页面迁移（Vitest 192/mock E2E 3 全绿），但样式污染（137 处 `:global`）与布局骨架缺陷（100vh/居中限宽/内容容器滚动）导致新增需求易破坏交互（R083-002）。083 按新方案三档落地：**样式权威重建 → 布局骨架重写 → 页面产品化与后端补足**。组件栈确认不动（HeroUI/RAC/Tailwind 单轨，裁决 D）；App Shell 分治（裁决 A：结构保留、样式骨架与装配段重写）。

## 2. 档 1：样式权威重建（REQ-083-001..003）

### 2.1 lint 规则扩展（`webui/scripts/lint-architecture.mjs`）

```
新增 CSS 扫描（sourceFiles 扩展收 *.css）：
- 规则 L1：模块 *.module.css 不得包含 `:global(` 定义平台级语义类
  （平台类清单 = styles.css 中导出的公共语义类，白名单机制，可演进）
- 规则 L2：不得以 `:global` 定义/覆盖平台布局类（.toolbar/.page-meta/.filter-bar/...）
- 规则 L3：裸 `:global(...)`（无模块根前缀）= 真全局泄漏，禁止
- 反向 fixture：新增故意违规的 test fixture 模块（或固定样本文件）保证规则生效
```

- 依据 R083-002 §6.1：现有 lint-architecture 只检查 ts/tsx 的平台/模块 import 边界；扩展收 css 后与 `lint:i18n`/`lint:modules` 同链。
- 回归：`pnpm lint` 包含新规则；git pre-commit 或 lint 门禁守护。

### 2.2 137 处 `:global` 清理（按模块）

```
auth.module.css（9 处全死代码）     -> 整个文件删除（AuditPage 已迁 DataTable，R083-002 §3.2.1）
iam.module.css（25）                -> session-* 7 处死代码删；.form-error/.permission-*
                                      平台类并入 styles.css 或改局部类；.auth-panel 等模块专属改局部
navigation.module.css（15）         -> policy-grid/policy-card 5 处死代码删；其余局部化
ops.module.css（75）                -> .header-zone-action（真全局）改受控平台类；ops-* 局部化
organization.module.css（5）        -> 局部化 + 720px 私有覆盖 .toolbar 移除（响应式归平台）
settings.module.css（8）            -> 局部化
openapi.module.css（0）             -> 已纯局部，仅对齐命名（camelCase 局部类可保留或迁移 kebab）
```

- 每步以 `pnpm lint` + Vitest + mock E2E 回归；删除死代码后确认无 tsx 消费（R083-002 已核验 21 处）。

## 3. 档 2：布局骨架重写（REQ-083-004..008）

### 3.1 视口与滚动（styles.css + AppShell）

```
styles.css：
  .app-workspace { height: 100dvh; overflow: hidden; }        // 100vh -> 100dvh（REQ-004）
  .app-shell     { height: 100dvh; grid-template-columns: var(--shell-sidebar-current) minmax(0,1fr); }
  .app-sidebar   { height: 100dvh; overflow-y: auto; }        // Sidebar 固定 + 独立滚动（REQ-005）
  .app-main      { height: 100dvh; overflow: auto; }          // 独立 Main Workspace 滚动
AppShell.tsx：
  装配段改为 Sidebar(固定) + Topbar + Main Workspace(独立滚动)
  .page-viewport/.page-flow 语义保留为内容流容器（不再自身 max-width 居中）
```

- 移除 `WorkspaceTabs` 装配（showTabs + visitedRoutes + theme.layout.showTabs）与 `showFooter`（REQ-007）；删除 `components/shell/WorkspaceTabs.tsx` 与相关测试、`ShellSkeleton` 中页签区。
- MockBadge/AccountMenu/RouteSearch 等其余 Shell 能力保留。

### 3.2 宽度档接线（REQ-006）

```
styles.css token（已有，零消费）：
  --content-max-wide:1600 / --content-max-detail:1200 / --content-max-settings:960 / --content-max-form:760
落地：
  .module-page 默认全宽（Table/Dashboard）
  [data-page-width="settings"]/.settings-module -> max-width: var(--content-max-settings)
  [data-page-width="detail"]/.detail-module     -> max-width: var(--content-max-detail)
  form-panel 字段区 -> max-width: var(--content-max-form)
页面声明：各模块页面根节点加 data-page-width 语义（Settings 8 页=settings、Audit/Roles 详情=detail、其余默认 wide）
```

### 3.3 Settings 双导航收敛（REQ-008）

- 全局菜单保留 `settings.center` 入口；页内 `SettingsLayout`（SectionNav）为唯一 Local Navigation。
- 移除「全局 Sidebar 8 子项 + 页内 SectionNav 并存」中的重复面（073/074 引入 GroupLayout 承接设置路由；收敛为入口 + 页内导航，e2e 同步）。

## 4. 档 3：页面产品化与后端补足（REQ-083-009..012）

### 4.1 页面迁移（按 R083-003 优先序）

```
P0：样式清理 + 宽度档接线（全局）
P1：Audit 分页（listAuditEvents 已 support offset/limit，加 Pagination + URL 化）;
     时间戳格式化（Sessions 4 列/Audit/Ops -> 人类可读 + 相对时间，方案 §8）;
     Settings 双导航收敛
P2：FilterBar 接线（Accounts/Sessions 后端 typed filters surface）+ 后端 sort（REQ-010）
P3：MetricCard/EntityHeader 组件化（ui/index.tsx）; 操作列「1 主操作 + ...菜单 + 危险隔离」（ApiTokens 4 按钮折叠最优先，R083-003）
P4：危险确认（Accounts/Roles/ApiTokens/Departments 归档/revoke -> ConfirmDialog/DangerZone）;
     空态/载态规格（5 页 page-meta 段落 -> EmptyState/LoadingState，基线 §18/19）
P5：Feature 拆解（EntityHeader/MetricCard/ActivityTimeline/CommandPalette 按需求补组件的业务采用）
每页对照 R083-003「083 任务输入」列逐项验收
```

### 4.2 后端 sort（REQ-010）

- 列表 operation 增加 `sort` 查询参数（如 `sort=name:asc|desc`），R002 §7.3 现行无 sort；涉及 `iam.accounts.list`、`iam.roles.list`、`iam.sessions.list`、`iam.api-tokens.list`。
- 前端 `useListQueryParams` sort 契约接线到各列表查询；契约优先 typed 校验（非法 column 拒绝）。
- 在 `001-default-config-cli-contracts`/模块 migration 无破坏前提下加；OpenAPI/operation inventory 生成链同步（api/README code-first）。

### 4.3 危险确认与状态（REQ-011/012）

- 归档/吊销/删除统一经 ConfirmDialog（复杂危险输入名称复核）——复用 082 DangerZone/ConfirmDialog。
- 后端 detail/batch/counts/org reorder：按 DEC-083-003 确认范围单独立项评估；审计元数据不补（低敏）。

## 5. 失败语义、并发与审计

- 样式清理逐模块提交，lint 门禁封锁回归；删除死代码前 grep 消费方（R083-002 已核验）。
- 布局骨架重写影响全部 app 页面：以 mock E2E（全 WebUI 零后端）+ Vitest 回归 + 手动视口检查为验收；`100dvh` 需真机/移动仿真验证（环境受限标注）。
- 后端 sort：参数校验失败返回 4xx Problem JSON（现有错误契约）；不改变认证/授权语义。
- 危险操作确认不改变服务端授权（fail closed 延续）；审计写操作语义不变（R002 §4）。

## 6. 验证方案

| REQ | 验证 |
| --- | --- |
| 001-003 | lint 新规则反向 fixture；137 处 :global → 0；Vitest/lint 全绿 |
| 004-006 | `100dvh`/独立滚动/宽度档 class 断言；mock E2E 页面浏览；移动视口仿真（受限标注） |
| 007-008 | Tab Bar/Footer 移除后 e2e 无残留 selector；Settings 单导航 e2e |
| 009 | 逐页对照 R083-003 任务输入验收记录；P0-P4 完成率 |
| 010 | sorting 后端测试 + 前端 sort URL e2e |
| 011-012 | 危险确认 e2e；后端评估项按 DEC |
| 全量 | `go test ./...`、`go vet ./...`、Vitest ≥192、Playwright mock ≥3、typecheck/lint/build/generate:check |

## 7. 文件影响总览

- lint 扩展：`webui/scripts/lint-architecture.mjs`（+反向 fixture 样本）。
- 样式清理：`internal/module/*/binding/webui/web/*.module.css`（137 处收敛；auth 整文件删）、`webui/src/styles.css`（平台类补齐）。
- 布局骨架：`webui/src/styles.css`（100dvh/滚动/宽度档）、`webui/src/components/AppShell.tsx`、删除 `components/shell/WorkspaceTabs.tsx` + 相关测试。
- 页面产品化：各模块 `binding/webui/web/*.tsx`（逐页按 R083-003）。
- 后端 sort：`internal/module/{iam}/binding/http/*`、`api/openapi.yaml`（code-first 生成链同步）。
- 文档：`webui/README.md`、`docs/development/webui.md`（样式权威规则/布局骨架规范）、`docs/changes/083/` 三文档、`docs/changes/README.md`。
- 决策点 DEC-083-001..005 结论影响上述范围（DEC-002 移除 Tab Bar 时连带删除组件与测试）。