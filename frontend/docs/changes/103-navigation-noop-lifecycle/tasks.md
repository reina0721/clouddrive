# 103 导航 no-op 生命周期 — 完成清单

研究门禁：`R103-001` 已通过。
计划状态：已确认，实施、验证与任务提交完成。

## 研究与计划

- [x] `R103-001` 审计重复点击当前 Route 的完整导航链路根因（Sidebar → Route Target →
      Host Navigation Port → Next Router → Global Progress）；证据：research/R103-001-*/metadata.yaml + report.md。
- [x] `PLN-103-001` 完成需求、设计与任务并获得用户确认；证据：本变更 requirements/design/tasks 与确认消息。

## Core：resolved location 等价语义

- [x] `CORE-103-001` 在 `packages/core/src/navigation.ts` 增加 `parseResolvedHref`、
      `normalizePathnameForComparison`、`normalizeSearchForComparison`、`isResolvedNavigationEqual`
      纯函数并导出；证据：文件 diff。
- [x] `CORE-103-002` 单元测试（11 用例：解析、尾斜杠、search key 无序/值敏感、空 search 与 `?` 等价、
      hash 精确、URLSearchParams 语义、重复 key）；证据：`packages/core/src/navigation-lifecycle.test.ts`，
      15 tests passed。

## Host：导航事务层与 commit 观测

- [x] `HOST-103-001` 新建 `apps/admin-web/src/host/navigation-lifecycle.ts`
      （shouldProceedWithNavigation / completeRouteNavigation / cancelRouteNavigation /
      failRouteNavigation / commitResolvedHref / 状态簿记）；证据：文件。
- [x] `HOST-103-002` `navigation-progress.ts` 增加显式 `cancelNavigation`；
      证据：文件 diff。
- [x] `HOST-103-003` `route-transition.tsx` 对 pathname/search/hash 任一 resolved 变化 complete，
      序列化防误触发，转场标记与 lifecycle 解耦；证据：文件 diff。
- [x] `HOST-103-004` 单元测试（13 用例：no-op 短路、基线未建防御、commit 收敛、连续导航不叠加、
      重定向收敛、cancel/fail 幂等、no-op 不打断活跃事务）；证据：
      `apps/admin-web/src/test/navigation-lifecycle.test.ts`，admin-web 59 tests passed。

## 入口短路矩阵

- [x] `ENTRY-103-001` Sidebar Leaf（navigation-tree renderLink）no-op 短路保留 onNavigate；
      证据：文件 diff + e2e 移动端/Compact Flyout 用例。
- [x] `ENTRY-103-002` CommandMenu / MenuButton（app-shell）短路；证据：文件 diff。
- [x] `ENTRY-103-003` Plugin Link / navigate / replace（admin-navigation-port）短路；证据：文件 diff。
- [x] `ENTRY-103-004` RouterTextLink 短路；证据：文件 diff。
- [x] `ENTRY-103-005` redirect 页（not-found、ui-elements 索引）统一 helper；证据：文件 diff。
- [x] `ENTRY-103-006` AppErrorBoundary 改调 failRouteNavigation；证据：文件 diff。

## Playwright 验证

- [x] `E2E-103-001` navigation-noop.spec.ts 6 用例全绿：同路由 no-op（URL/转场标记/Progress/RSC）、
      A→B 收敛、快速连点 A→B→C 收敛、移动端抽屉、Compact Flyout；
      证据：6 passed。
- [x] `E2E-103-002` top-progress.spec.ts（关键回归 8 条）+ navigation.spec + reference-resources.spec
      联合运行 20 passed；navigation.spec 全量 + admin-foundation.spec 中 7 passed；
      证据：对应命令输出。
- [x] `E2E-103-003` 已知基线问题（与 103 无关，A/B stash 复核 HEAD 同样复现，未擅自更新）：
      transition.spec「无 Suspense」在 next dev 环境失败（3 passed / 1 failed，clean HEAD
      同样失败）；admin-foundation.spec `universal-motion-desktop` 视觉基线漂移
      （1440x900 vs 1466，101/102 已记录）。

## 门禁与构建

- [x] `GATE-103-001` lint、format:check、typecheck（core + admin-web）、docs:check 全绿；
      证据：命令输出。
- [x] `GATE-103-002` architecture（202 源文件）/foundation（11 workspaces/10 contracts）/
      dependency（23）/codegen（fresh）门禁全绿；证据：命令输出。
- [x] `GATE-103-003` build 成功（33 静态路由）+ performance:check 通过
      （initial 329,838 B、maxRoute 420,118 B，均在预算内）；证据：命令输出。

## 提交

- [x] `COM-103-001` 精确暂存并创建 Conventional Commit，不推送；证据：任务提交仅包含 103 文件，
      提交前后均复核 staged Diff。
