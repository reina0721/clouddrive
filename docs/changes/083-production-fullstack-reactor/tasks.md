# 083 任务清单：Production-grade 全栈产品重构（WebUI 产品化二期）

## 状态

研究门禁已通过（[R083-001](research/R083-001-proposal-vs-082/report.md)、[R083-002](research/R083-002-style-layout-baseline/report.md)、[R083-003](research/R083-003-baseline-page-audit/report.md)）；**计划已确认（2026-08-28 用户确认「确认，实施」）**，进入实施阶段。方案输入 `docs/changes/temp-new-changes.md` 与 `docs/changes/admin-design-baseline.md`。决策点结论：`DEC-083-001` App Shell 分治（结构保留 + 样式骨架与装配段重写）；`DEC-083-002` 移除 Tab Bar（变更 082 DEC-001，删除 WorkspaceTabs 组件/状态/偏好/测试；Settings 双导航收敛）；`DEC-083-003` 后端仅 sorting 必补（其余按需求评估，审计元数据/User Activity 不补）；`DEC-083-004` 状态组件统一（StatusPill/StatusBadge 归一套）；`DEC-083-005` 启用 RHF+zod 并迁移表单。

## 任务

按「档 1 样式权威 → 档 2 布局骨架 → 档 3 页面产品化与后端补足」三档切片；红线段（组件栈不动、Backend 兼容红线、禁止 fake、lint/单轨）作为全局约束。

### 档 1：样式权威重建（REQ-083-001..003，优先）

| ID | 工作量 | 依赖 | 内容 | 完成条件 | 状态 |
| --- | --- | --- | --- | --- | --- |
| `RES-083-001/002/003` | M | — | 研究：差异分析 / 样式布局基线 / 页面对照 | metadata/report 齐全；门禁通过 | 完成 |
| `PLAN-083-001` | S | RES | 计划（requirements/design/tasks/README）+ 决策点 DEC-083-001..005 | 文档齐全；用户确认 | 完成 |
| `STYLE-083-001` | M | 确认 | lint-architecture.mjs 扩展 CSS 扫描 + 反向 fixture | 故意违规失败；lint 全绿 | 完成 |
| `STYLE-083-002` | M | 确认 | 21 处死代码删除 | grep 无消费方；lint/vitest 全绿 | 完成 |
| `STYLE-083-003` | L | 确认 | `:global` 收敛与模块局部化 | lint 新规则通过 | 完成 |
| `STYLE-083-004` | S | 确认 | 命名唯一与 kebab-case 平台语义类 | lint 断言；无重复语义类 | 完成 |

### 档 2：布局骨架重写（REQ-083-004..008）

| ID | 工作量 | 依赖 | 内容 | 完成条件 | 状态 |
| --- | --- | --- | --- | --- | --- |
| `LAYOUT-083-001` | L | 确认 | 视口与滚动：`100dvh`、Sidebar/Main 独立滚动 | class 断言 + mock E2E；移动视口仿真受限 | 完成（移动受限） |
| `LAYOUT-083-002` | M | 确认 | 宽度档接线 | 各宽度 class 断言 | 完成 |
| `LAYOUT-083-003` | L | 确认（DEC-002） | 移除 WorkspaceTabs 与 Footer | e2e 无残留 selector；单轨无旧文件 | 完成 |
| `LAYOUT-083-004` | M | 确认 | Settings 双导航收敛 | Settings e2e 单导航断言 | 完成 |

### 档 3：页面产品化与后端补足（REQ-083-009..012）

| ID | 工作量 | 依赖 | 内容 | 完成条件 | 状态 |
| --- | --- | --- | --- | --- | --- |
| `PAGE-083-001` | M | STYLE/LAYOUT | P0：全页样式清理 + 宽度档接线扫尾 | lint/vitest 全绿 | 完成（平台视口单位、宽度档与模块样式门禁已收敛） |
| `PAGE-083-002` | M | 确认 | P1：Audit 分页（offset/limit URL 化）；时间戳格式化（Sessions/Audit/Ops 人类可读+相对时间） | e2e 断言；无 raw ISO 直出 | 部分完成（分页与 Audit/Sessions/Ops 人类可读及相对时间已落地；Audit/Sessions tooltip 保留绝对时间，本轮修复 Ops uptime/sampled locale 插值；真实后端 e2e 待补） |
| `PAGE-083-003` | M | 确认 | P1：Settings 双导航 + 宽度 640-960 收敛 | Settings e2e | 完成（单页内 SectionNav、settings 宽度档与既有 SPA e2e 已验证） |
| `PAGE-083-004` | L | 确认 | P2：FilterBar 接线（Accounts/Sessions 后端 typed filters surface） | filter 参数真实请求 | 完成（本轮） |
| `BACKEND-083-001` | L | 确认（DEC-003） | 后端 sort 参数（iam accounts/roles/sessions/api-tokens list）+ 白名单 SQL 映射 | operation 生成链同步；Go 测试 | 完成（本轮） |
| `PAGE-083-005` | M | BACKEND-001 | 前端 sort URL 契约接线（Accounts/Roles/Sessions/API Tokens → 列表查询） | sort 参数真实请求 | 完成（本轮） |
| `PAGE-083-006` | M | 确认 | P3：MetricCard/EntityHeader 组件化 + 操作列「1 主操作 + ...折叠 + 危险隔离」（ApiTokens 优先） | 组件 Vitest + 页面采用 | 完成（公共组件已由 Ops/DetailDrawer 消费） |
| `PAGE-083-007` | M | 确认 | P4：危险确认（Accounts/Roles/ApiTokens/Departments archive/revoke → Confirm/DangerZone）+ 空载态规格 | 确认 e2e；Empty/Loading 组件采用 | 部分完成（确认、主要列表空态/loading、五个主要列表 connectivity 错误态及统一 Retry 动作已完成；Accounts Retry 恢复 E2E 已通过；详情错误态与危险确认 E2E 仍待补） |
| `PAGE-083-008` | M | 确认 | P5：Feature 拆解（EntityHeader/MetricCard/ActivityTimeline/CommandPalette 业务采用按需求） | 对照 R083-003 每页验收 | 部分完成（MetricCard 已由 Ops 监控消费，EntityHeader 已由 DetailDrawer 消费，CommandPalette 已由 OpenAPI 消费；无真实活动数据契约，不虚构 ActivityTimeline） |
| `POL-083-001` | M | 上述 | 状态组件统一（StatusPill/StatusBadge 归一套，DEC-004）+ 视觉校准 | StatusPill 复用 StatusBadge；视觉截图复核 | 部分完成（组件单轨；已审阅当前 mock 最终态截图并修复 Ops uptime 字面量插值，状态组件专门截图复核待执行） |
| `QA-083-001` | M | 上述 | 页面达标率复核（R083-003 105 项重跑，目标 ≥70% 达标或收敛）+ 三层 QA | 达标率提升记录 | 部分完成（已确认基线口径为 105 项、30 达标/60 部分/15 重做；mock E2E 3/3、Accounts Retry 恢复 E2E 通过、全量 Vitest 199、lint/build 已通过；当前五个列表错误态均可 Retry；真实后端/移动视口与逐项重跑记录待补） |
| `DOC-083-001` | M | 上述 | 文档同步：webui 指南（样式权威规则/布局规范/宽度档）、webui README、documentation-impact.yaml、changes 索引 | docs-guard 通过 | 完成（本轮） |
| `VER-083-001` | M | 全部 | 全量验证与提交（go test/vet、Vitest ≥192、Playwright mock ≥3、lint/build/generate） | 无失败；受限项如实标注 | 待实施 |

## 验证矩阵（预期，实施后实测填写）

| 门禁 | 命令/入口 | 预期结果 |
| --- | --- | --- |
| Go | `go test ./...` / `go vet ./...` | 全绿 |
| WebUI | typecheck/lint（modules/i18n/architecture 含新样式规则）/generate:check/Vitest ≥192/Playwright mock ≥3/build | 通过 |
| 文档 | docs-guard | 通过 |

## 验证矩阵（实测结果 2026-08-28）

| 门禁 | 命令/入口 | 结果 |
| --- | --- | --- |
| Go 全量 | `go test ./...` / `go vet ./...` | 全绿（含 sort 后端、contract-gen artifacts 匹配） |
| 契约生成 | `go generate ./...` + `generate.mjs --check` | current（sort 参数入 openapi + operation inventory + openapi-spec） |
| WebUI 类型 | `tsc --noEmit` | 通过 |
| WebUI lint | lint:modules / lint:i18n / lint:architecture（含样式规则） | 通过 |
| Vitest | `vitest run` | **199 全过**（当前全量测试） |
| Playwright | mock 项目 4 用例 | 全过（样式清理/布局/Tab Bar 移除/Settings 收敛/sort 无回归/083 视觉截图） |
| Build | `vite build` | 成功 |

## 视觉验证轮（2026-08-28，通过本机 codex 0.150.1 多模态复核）

- 新增 `083 visual snapshots` e2e 用例：生成 Dashboard/Accounts/Roles/Settings/Audit 整页截图至 `test-results/083-visual-*.png`。
- codex 视觉评审发现 2 个 P0 缺陷并已修复（codex 复核确认）：
  1. **单花括号插值泄漏**：locale 键用 `{page}`/`{total}`（i18next 只认 `{{var}}` 双花括号），分页文本渲染为字面 `{page} · {total}`——全模块 locale 迁移为双花括号（auth/iam，commit `bdba71b`/`9ecae92`）。
  2. **相对时间缺键 + 命名空间错配**：`formatRelativeTime` 用 `webui.host.relative.*` 键但 Audit/Sessions 传模块命名空间 t（`nsSeparator:false` 无法跨 ns）→ 单元格显示「翻译资源缺失」——host locale 补 7 个 relative 键（`e6b5f98`），调用方改传 hostT（`d722820`）；codex 复核 Occurred at 现显示 `3d ago`。
- 视觉评审剩余 P1 打磨项（记录，不阻塞）：Dashboard 产品化（Trend/Alerts/Activity/Drill-down）、Accounts 菜单展开态行操作外观、Settings 两栏布局利用率。
- **圆角收敛已修复**（codex 复核确认）：radius token（md 12→8、lg 14→10）+ HeroUI Card 内覆盖 10px（原默认 ~22-24px 超基线）；e2e 断言内容卡片 ≤12px；codex 视觉复核 KPI/Diagnostic 均 10px、阴影 2/5 克制（commit `fa45ff7`）。
- **行操作折叠已修复**（codex 复核确认）：DataTableRowMenu 从「平铺全部项」改为「1 主操作内联 + … 弹出菜单，危险隔离」——Accounts 4 链接平铺收敛为 View detail + …（commit `cc4aa9d`）；平台组件级修复惠及 Roles/Sessions/ApiTokens 等所有 renderRowMenu 页面。
- **Dashboard 现状复核**（codex 2026-08-28）：已具备运营总览核心（健康标签/上下文行 Version-Commit-Uptime/KPI 摘要 6-6-0/依赖健康卡/Runtime 快照/Refresh）；监控趋势区（monitoring-section 5s 轮询 rolling window）已实现，截图全页含 fold 下趋势图。无真实数据支撑的表面「产品化」不实施（AGENTS 红线：不伪造数据视图）；结构性运营中心扩展（告警流/活动时间线）留待真实运营数据接入。
- **Settings 配置区宽度修复**（codex 复核确认）：`[data-page-width=settings] .module-page` 用 `margin-inline:auto` 无显式宽度 → 块收缩到固有 229px，配置卡过窄 + Introduction 截断；改 `width:100%` 后配置卡 ~698px（占内容 69-75%）、表单 624px、Intro 完整可见；e2e 断言 Settings 宽度（commit `04b8706`）。
- **最终系统性视觉终审**（codex 2026-08-28 5 页）：无新 P0/P1；唯一遗留——Dashboard 顶部统计卡圆角 ~20px（StatCard/MetricCard 内 HeroUI Card 未纳入此前覆盖）→ 已统一 10px，codex 复核三卡一致（commit `5a41ccc`）。终审后 5 页全部通过：无 {total} 字面、无「翻译资源缺失」、行操作 1 主+ 菜单、Settings 宽、圆角 10px。

**关键达成指标（实证）**：
- 样式 `:global` 平台类重复清零；剩余 95 处全为模块专属（`lint-architecture` L1/L3 守护 + 反向 fixture）
- Tab Bar（WorkspaceTabs）与固定 Footer 移除（组件/状态机/偏好/locale/测试单轨删除）
- `100dvh` 视口（app-shell/sidebar/workspace）、Sidebar 独立滚动、页面滚动收敛 Main Workspace
- Settings 全局菜单 8 子项 → 单入口 + 页内 SectionNav
- 后端 account sorting（白名单列 + 防注入）上线，前端排序条 URL 化
- 危险操作确认（ConfirmActionTrigger）：Accounts/Roles 详情归档接入确认
- 操作列收敛：ApiTokens 主操作内联 + 菜单折叠（危险隔离）
- 状态组件语义域分离：业务态统一 StatusBadge，capability 态 StatusPill（DEC-004 落地）

## 未执行/受限项

- 移动视口（`100dvh`）需真机/移动仿真验证，桌面环境仅 class 断言与模拟，如实标注。
- Playwright dev 项目（20 用例）沿用 082 待真实后端联调。
- 后端 detail/batch/counts/org reorder 按 DEC-083-003 确认范围评估，不在默认实施面。
- 审计完整元数据、User Activity、TanStack Table 替换、Command 实体检索：候选，不立项。
