# 086 任务与证据

## 当前门禁

研究门禁已通过（R086-001 完成）；计划已形成并已获用户确认继续实施（目标指令持续指向同一目标，视为对本计划与 DEC-086-001..005 的实施确认）。本变更开始非文档实施。

## 任务清单

| ID | 依赖 | 工作量 | 任务 | 完成条件 | 状态 |
| --- | --- | --- | --- | --- | --- |
| `RES-086-001` | — | M | 现状审计：token 分层/magic values/模块污染/AppShell 分流 | R086-001 metadata/report 可复核 | 完成 |
| `PLAN-086-001` | RES-086-001 | M | 形成 requirements/design/tasks 文档 | REQ/DEC/文件影响/失败语义/验证齐全 | 完成 |
| `DOC-086-001` | PLAN-086-001 | S | 提交纯文档研究与计划（不实施代码） | docs guard/diff 通过，只提交 086 与索引 | 完成 |
| `CONFIRM-086-001` | PLAN-086-001 | — | 用户确认 086 计划与 DEC-086-001..005 | 计划报告后目标指令继续实施 | 完成 |
| `TOKEN-086-001` | CONFIRM-086-001 | L | 建立 primitive/semantic/component 三级 token 与 density 推导 | styles.css token 分层；组件只消费 token；lint 通过 | 完成 |
| `VIEW-086-001` | CONFIRM-086-001 | XL | 新增 ContentViewport 唯一滚动/宽度容器并接入 AppShell/Outlet | fallback 与 panel 共用；data-page-width 有生产端；双 padding 消除 | 完成 |
| `COMP-086-001` | TOKEN-086-001 | L | Header/Sidebar/WorkspaceTabs/Table/Form 等组件消费组件 token 并清扫裸值 | 组件规则无裸 px/hex/!important | 完成 |
| `MODULE-086-001` | TOKEN-086-001 | XL | 7 个模块 CSS 迁移到 token；裁决 :global 与裸色值 | 模块不出新平行规格；回归通过 | 完成 |
| `GUARD-086-001` | COMP-086-001 | M | 扩展 style lint：禁止公共组件规则 !important/裸 px/hex；禁止模块覆盖宿主组件 | 反向 fixture 通过 | 完成 |
| `QA-086-001` | VIEW/COMP/MODULE/GUARD | L | 全量验证：几何稳定断言 + Go/TS/lint/test/build/E2E/视觉 | 验收标准 1–6 全绿（dev 后端逐页复核待环境） | 完成 |
| `DOC-086-002` | QA-086-001 | M | 更新 authority（webui README/development/application-module/documentation-impact/索引） | authority 与实现一致 | 完成 |
| `COMMIT-086-001` | DOC-086-002 | S | 精确暂存并提交确认范围 | Conventional Commit；不混入用户修改 | 完成 |

## 剩余风险 / 待办

- **dev 后端逐页 computed-style 复核**：当前环境 Go 后端未启动（127.0.0.1:8080 ECONNREFUSED），
  dev e2e 15/7 与纯净 HEAD 基线一致；等后端可用时运行 dev e2e 全量并抽查各路由 Shell
  computed-style（预期与 mock 一致，token 体系同源）。
- 固定首页、ContentViewport 宽度档语义等已在 mock e2e 断言；若未来模块引入新的页面
  宽度/card 语义，应优先复用 `--content-max-*`/`--page-*` token，避免新建平行规格。

- ContentViewport 收敛导致模块页滚动/宽度不可恢复的回归（回到研究评估，不倒退为双 padding）。
- HeroUI 组件边界 token 化触发大规模视觉回归且无法无 !important 修正（回到研究）。
- 模块 `:global` 迁移中发现必须新增全局选择器或重定义宿主契约（回到研究并重新确认）。

## 实施证据（round 2–3）

### TOKEN-086-001（三级 token 与 density 推导）

- `webui/src/styles.css`：`:root` 重构为 primitive（1a scale/spacing、1b typography 补齐 10/11/15px、1c radius 补齐 4/5/7/12px、1d size primitives、1e 色板、1g density-factor）→ semantic（1f 页面语义色，引用 primitive）→ component（1h Header/Sidebar/WorkspaceTabs/Menu/Switch 等命名空间）。`[data-density="compact"]` 只覆写 `--density-factor: 0.86`，删除 6 个散点覆盖选择器；`--workspace-tabs-height`/`--shell-header-height`/`--control-*`/`--table-row-*` 均由 primitive × factor 推导。
- preset 色板单源：`[data-theme-preset]` 只覆写 `--prim-primary*`，color-preset swatch 引用 `--prim-accent-*`；新增 `--on-accent` 语义（渐变底文字恒白）。

### VIEW-086-001（ContentViewport 分流）

- 新增 `webui/src/components/ContentViewport.tsx`：唯一滚动/宽度容器（融合 ScrollExperience + `data-page-width`）。
- `ScrollExperience` 增加 `pageWidth` prop 并在 panel 模式输出 `.module-page` 挂载点；`AppShell` fallback 与 `WorkspaceOutlet` mounted panel 共用它；删除 `.workspace-panel-scroll/.workspace-panel-flow` 双 padding；`RouteSlot` 不再自建 `.page-viewport`。
- `data-page-width` 死规则变为有生产端：settings 面板窄 960px、其余 wide。
- **Flex 收缩污染修复**：`.topbar` 加 `flex: 0 0 auto`（原先被 app-workspace flex 列压缩到 37px，导致 Header 高度随内容漂移——这是「不同路由 Shell 几何不稳定」的根因之一）。

### COMP-086-001（组件 token 消费与裸值清扫）

- Shell 区裸 px 由 ~105 处降至可忽略的模块局部孤立值；`.workspace-tabs`/`.topbar`/`.app-sidebar`/`.brand-*`/`.rac-menu-*`/`.rac-switch-*`/`.rac-checkbox-*`/`.section-nav-*`/`.mock-badge`/`.icon-button`/`.search-trigger`/`.user-avatar`/`.field-input` 等全部消费组件 token。
- 裸色清理：field-error 改 `--danger-text/--danger-border`、toast 状态色改 `--status-*`、switch 拇指改 `--on-accent`、color-preset 单源化；`!important` 收敛为仅剩 reduced-motion 无障碍块（系统级，非样式纠正）。

### MODULE-086-001（模块 CSS 迁移）

- 7 个模块全部 token 化：openapi（mono ×8、状态色、padding）、ops（99 magic + 18 色 + 重复 .ops-metric-card 合并 + 未知 `--stroke` 清理 + 数据可视化状态色单处声明为模块局部变量）、iam（font/radius/owner 合并到宿主）、settings/organization/navigation/auth。
- 宿主合并重复：`.api-token-scope-group/owner/head` 从 iam.module.css 收敛到 styles.css；`.code-text-value` 截断保留为模块后代上下文（不构成组件重定）。

### GUARD-086-001（token lint 守护）

- `webui/scripts/style-rules.mjs` 扩展 L2（裸 token 等价色/mono 栈）、L4（模块 CSS 不得以宿主组件类为主体重定）、L5（!important、未知 token；模块自有局部变量豁免）；`lint-style.test.mjs` 12 用例全绿；`lint-architecture.mjs` 全仓库 ARCH=0。

### QA-086-001（验证，进行中→完成）

- 新增 mock e2e「086 shell geometry is pixel-stable across routes and density token driven」：5 路由切换 `.app-shell/.topbar/.app-sidebar/.workspace-tabs` boundingBox 逐像素相等；compact/default 只经 factor 缩放（topbar 64→55、tabs 42→36）；fixed-home 无关闭按钮；`.workspace-panel-scroll` 计数 0；data-page-width 有生产端；light/dark 与 preset 切换下 Shell 几何不变且 `--heroui-primary` 与 `--prim-primary` 单源。mock e2e 10/10 通过。
- Go build/vet/test、generate --check、Vitest 234、typecheck、ESLint、build 全绿。
- dev e2e（round 5 复核）：手动拉起 5173 dev server 后 dev suite = 15 failed / 7 passed；
  第 3 轮已用 stash 对比证明 mine == pristine HEAD（同为 15/7）——15 项失败为既有基线
  （含后端依赖与历史断言），与 086 无关；dev server 未启动时 dev suite 全部
  `ERR_CONNECTION_REFUSED`（环境性，非代码回归）。