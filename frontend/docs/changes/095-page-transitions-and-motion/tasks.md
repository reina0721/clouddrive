# 095 页面转场与动效分层 — 完成清单

研究门禁：R095-001 已通过（证据与刷新触发器见 [metadata.yaml](research/R095-001-view-transition-facts/metadata.yaml)）。
计划状态：已确认并完成实施与验证。

## 研究与计划

- [x] `R095-001` 核实 Next.js 16/React ViewTransition 运行时、类型缺口、项目 Token 与门禁约束；证据：`research/R095-001-view-transition-facts/{metadata.yaml,report.md}`（含三次实测补充：popstate 不触发转场、视口外触发器锚定竞态与预滚动修复、hydration/reveal 无类型提交不应用样式）。
- [x] `PLN-095-001` 产出需求、设计与任务清单并提交确认；证据：`requirements/`、`design/`、本文件；状态：已确认。

## 实施

- [x] `FND-095-001` 新增 `packages/design-system/src/motion.css` 并导出 `./motion.css`；完成条件：样式只引用动效/色彩 Token，含锚定抑制、pointer-events、无 `!important` 的 reduced-motion 块；证据：文件 + `pnpm build` 通过 + architecture:check 通过（111 源文件）。
- [x] `WEB-095-001` 新增 `apps/web/src/types/react-view-transition.d.ts`（`import type {} from 'react/canary'`）与 `host/page-transition.tsx` + `host/page-transition-constants.ts`；证据：`tsc --noEmit` 通过（next typegen + 全仓）。
- [x] `WEB-095-002` 16 个路由页面包裹 `PageTransition`（ui-elements 重定向页与 layout 除外）；证据：diff + 转场/导航 e2e 回归。
- [x] `WEB-095-003` 导航类型标记（navigation-tree 三处、app-shell 命令/账户菜单、router-text-link）与 Header/侧栏 `viewTransitionName` 锚定；证据：diff + e2e。
- [x] `TST-095-001` 新增 `apps/web/e2e/transition.spec.ts`（4 用例：完整滑动+样式还原、Family 拆帧容错、reduced-motion、后退无方向滑动）；`apps/web/e2e/overlays.spec.ts` DatePicker 用例增加预滚动；证据：全新 server（CI=1）下 `repeat-each=3` 12/12 通过；DatePicker 用例 4/4、Flyout 2/2 通过；全量 36/36 通过。

## 验证

- [x] `VER-095-001` 全新 `pnpm build` + `pnpm check` 全量门禁；证据：
  - architecture:check 通过（fixtures 10 例 + 111 源文件）；dependency:check 通过（18 个治理依赖）；lint 通过（0 警告）；typecheck 通过；unit 通过；build 通过；performance:check 通过（css gzip 43,940B ≤ 48KiB，低于改动前 44,056B）；browser 36/36 通过；**format:check 例外**：`apps/web/src/test/providers.test.tsx` 与 `eslint.config.mjs` 在 HEAD 基线同样失败（已 stash 对照证实为既有格式违规，不属于本任务文件，未修改）；本任务全部文件通过 `prettier --check`。
  - 验证环境注意：Playwright 复用旧 dev server 会吃到陈旧编译产物导致断言误报；本任务全部结论以全新 server（`CI=1`）为准。
- [x] `VER-095-002` CSS gzip 预算基线：43,940 B（预算 48 KiB），无回归。
- [x] `VER-095-003` 视觉基线复核：全量 browser 36/36 通过（含 visual.spec 9 项历史基线），**无基线变化、无需更新快照**。
- [x] `VER-095-004` Reference 大页面转场核对：`/reference` 与全部路由导航在 e2e 中无异常动画时长（观察到的最大动画 ≤500ms 预算）；方向感、锚定与观感强度待用户人工确认。

## 文档同步

- [x] `DOC-095-002` 权威文档同步完成：`frontend/README.md`（转场能力条款）、`docs/ui-element-system.md` §10（页面级转场边界条款）、`docs/changes/README.md`（095 登记）；095 变更内 README/需求/设计/研究档案与最终实现一致。
- [x] `COM-095-001` 审阅完整 diff、仅提交本任务文件并创建 Conventional Commits 提交；证据：`c2854031 feat(frontend): add view-transition page motion with hierarchy anchoring`（38 个文件；用户既有 webui/ 等改动保持未暂存）。

## 待人工确认

- [ ] `MANUAL-095-001` 用户在浏览器中核验转场观感：方向滑动（旧内容左移、新内容右入）、Header/侧栏锚定不动、Dark/Light 一致、无需动画系统下无位移；如需要更慢/更强的方向感，按 design §3/§4 调整时长（仍复用 Token 语义）。
