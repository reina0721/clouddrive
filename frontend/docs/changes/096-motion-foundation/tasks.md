# 096 Motion Foundation 与语义动效分层 — 完成清单

研究门禁：R096-001 已通过（证据与刷新触发器见 [metadata.yaml](research/R096-001-current-motion-assets/metadata.yaml)）。
计划状态：已确认并完成实施与验证。

## 研究与计划

- [x] `R096-001` 盘点现有动效资产、映射两层模型、核实 HeroUI Disclosure 与 Tailwind 默认时长事实；证据：`research/R096-001-current-motion-assets/{metadata.yaml,report.md}`。
- [x] `PLN-096-001` 产出需求、设计与任务清单并提交确认；证据：`requirements/`、`design/`、本文件；状态：已确认。

## 实施（Foundation 落地）

- [x] `FND-096-001` tokens.css 新增用途语义 Token（`--motion-duration-control/feedback/page`、`--motion-distance-page`）与 `@theme`（`--default-transition-duration` → control、`--transition-duration-page`）；motion.css 位移/时长引用语义 Token 并分节 + 配方登记表；证据：diff + 构建 + 浏览器基线零变化（36/36）。
- [x] `FND-096-002` 退役 `packages/design-system/src/motion.ts` 与 `./motion` 导出，并移除已无 TS 输入的 design-system typecheck 脚本与 tsconfig（包转为纯 CSS 包）；完成条件：全仓无 `design-system/motion` 引用；证据：grep 残留 0 + typecheck 通过。
- [x] `WEB-096-001` `PageTransition`/`page-transition-constants` 从 `apps/web/src/host/` 移入 `apps/web/src/layouts/`，更新全部 19 处引用；完成条件：typecheck + 全量 e2e 回归通过；证据：diff 与 36/36 测试输出。

> 实施备忘：批量替换期间曾发生一次编码损坏（PowerShell `Set-Content` 与 UTF-8 不兼容，19 个含中文文件被乱码化），已通过 `git checkout` 恢复全部文件并以 .NET UTF-8 无 BOM 方式重新应用替换；最终 diff 无编码噪声（中文内容校验通过）。

## 文档与条款

- [x] `DOC-096-001` 新增 `docs/motion-foundation.md`（Motion 主题唯一权威：归属矩阵、容器目录与触发条件、Reduced Motion Policy、Layout Contract、配方登记表、验证矩阵规格）。
- [x] `DOC-096-002` `frontend/AGENTS.md` 新增 §4.2 Motion 分层与治理条款（5 条，指向权威文档；§4.1/§4.2 顺序已校正）。
- [x] `DOC-096-003` 同步 `frontend/README.md`（稳定契约加 Motion 治理条）、`docs/ui-element-system.md` §12（判定流程第 1 步改为先查 Motion 配方登记表与容器目录）、`docs/changes/README.md`（096 登记，下一序号 097）。
- [x] `DOC-096-004` 本变更 README 状态更新为已完成并保持一致。

## 验证

- [x] `VER-096-001` `pnpm check` 全量门禁：architecture ✓ / dependency ✓ / lint ✓（0 错误）/ typecheck ✓ / unit ✓ / build ✓ / performance ✓（css gzip 43,992B ≤ 48KiB）/ browser 36/36 ✓ / format:check 仅剩两个既有基线例外（`apps/web/src/test/providers.test.tsx`、`eslint.config.mjs`，HEAD 同样失败，不属本任务）。
- [x] `VER-096-002` 浏览器全量回归（transition/navigation/overlays/visual 等，CI=1 全新 server）：36/36 通过，**视觉基线零变化**；performance css 43,992B（相对 095 的 43,940B 仅 +52B）。
- [x] `VER-096-003` 语义一致性检查：业务代码（apps/web/src、packages/ui-adapter/src）零裸露时长/缓动/位移字面量（grep 命中仅第三方 node_modules）；`host/page-transition` 与 `design-system/motion` 残留引用均为 0；容器目录与代码现状一致（PageTransition 位于 layouts 的页面转场容器，无幻影容器）。
- [x] `COM-096-001` 审阅完整 diff、仅提交本任务文件、Conventional Commits；证据：`86697e24 feat(frontend): formalize motion foundation and semantic transition layers`（39 个文件，含 2 个 rename；用户既有 webui/ 等 26 个改动保持未暂存）。

## 未来任务（登记触发条件，本变更不实施）

- [ ] `FUTURE-096-001` ui-adapter Motion Primitive（Presence/Transition，≤2）：首个语义容器需要 JS 生命周期协调时，随实现任务引入，配 Playwright 中断测试。
- [ ] `FUTURE-096-002` Disclosure/Accordion：折叠面板需求出现时复用 HeroUI `./disclosure`/`./accordion`（官方复核），经 ui-adapter 包装；不自研 Collapse。
- [ ] `FUTURE-096-003` AsyncContentTransition：reference `sceneMode`/真实数据页迁移时实现（initial/refresh/blocking/background 语义）。
- [ ] `FUTURE-096-004` FeedbackTransition / ContentSwapTransition：Toast/Inline Alert 强化、Tabs/筛选联动需求出现时。
- [ ] `FUTURE-096-005` `/motion` 参考验证页：首个新容器落地时按 design §8 规格实现。
- [ ] `FUTURE-096-006` 共享层下沉评估：第二个 Runtime Host（desktop 选型）出现时评估 PageTransition 下沉与"Host 生命周期 + 共享语义容器"模式。
