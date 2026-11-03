# 101 Admin Framework / Surface File Routes — 完成清单

研究门禁：`R101-001` 已通过。
计划状态：已确认，实施、验证与任务提交完成。

## 研究与计划

- [x] `R101-001` 核实 File Route 契约、codegen 可行性与 Static Export Host 边界；证据：research/R101-001-*。
- [x] `PLN-101-001` 完成需求、设计与任务并获得用户确认；证据：本变更 requirements/design/tasks 与确认消息。

## Framework（packages/admin-framework）

- [x] `FRW-101-001` 建立 Plugin Contract 静态类型（plugin definition、route.meta、descriptors、catalog、segment helpers）；
      证据：`packages/admin-framework/src/contract.ts`。
- [x] `FRW-101-002` 建立 Route Target（route()/encode/resolve）与 Diagnostics；证据：`target.ts`、`diagnostics.ts`。
- [x] `FRW-101-003` 建立 Registry：canonical hierarchy、navigation inheritance、tree/group、breadcrumb、
      command/permission、target 解析、orphan/cross-plugin/override 诊断；证据：`registry.ts` + framework.test.ts。
- [x] `FRW-101-004` 建立 Host Port / Host Capability（`UNSUPPORTED_DYNAMIC_PLUGIN_ROUTE` 硬失败）；
      证据：`host.ts` + framework.test.ts。
- [x] `FRW-101-005` 建立 Plugin API（route/AdminRouteLink/useAdminNavigation/稳定 Page props）与
      Route Context（provider/hook）；证据：`plugin.tsx`、`route-context.tsx` + plugin.test.tsx。
- [x] `FRW-101-006` 16 个 framework 单测通过；证据：`corepack pnpm --filter @clouddrive/admin-framework test`。

## Surface（surfaces/admin）

- [x] `SUR-101-001` 建立 `@clouddrive/admin-surface` workspace：exports 只暴露 shell/generated/*；
      证据：`surfaces/admin/package.json`。
- [x] `SUR-101-002` 建立 shell taxonomy、Registry→Shell model 转换与 i18n Composition 聚合；
      证据：`src/shell-model.ts`、`src/composition.ts`、`src/i18n.ts` + shell.test.ts。
- [x] `SUR-101-003` 参考插件 `reference-resources`：plugin.ts + i18n + data + 四条静态文件路由；
      证据：`plugins/reference-resources/**`。
- [x] `SUR-101-004` surface 单测（taxonomy/转换/聚合/generated composition）7 个通过；
      证据：`corepack pnpm --filter @clouddrive/admin-surface test`。

## Codegen（tooling/admin-codegen）

- [x] `GEN-101-001` Discovery + Contract Validation（1:1、禁止段/导出、namespace、override、冲突）；
      证据：`tooling/admin-codegen/codegen.mjs`。
- [x] `GEN-101-002` 生成 catalog / composition / i18n / module bridges / Host 薄入口（全部 Prettier 序列化）；
      证据：`surfaces/admin/generated/**`、`apps/admin-web/src/app/reference-resources/**`。
- [x] `GEN-101-003` Static Export Host capability gate：动态 Route 硬失败，不生成入口；
      证据：codegen 对 `[param]` 抛 `UNSUPPORTED_DYNAMIC_PLUGIN_ROUTE`（framework.test.ts 覆盖语义）。
- [x] `GEN-101-004` `pnpm codegen:admin` / `codegen:admin:check` freshness（missing/drift/stale）纳入 `pnpm check`；
      证据：根 `package.json` scripts；`node tooling/admin-codegen/codegen.mjs --check` 输出 `Admin codegen is fresh.`。

## 治理与 Host 装配

- [x] `GOV-101-001` foundation policy `kind`（foundation/framework/surface）与命名/依赖 fixture；
      证据：`tooling/foundation-policy.{json,mjs}`、`check-foundation-fixtures.mjs`（14 cases）。
- [x] `GOV-101-002` governance/dependency 扫描增加 `surfaces/`；framework/surface Contract registry；
      证据：`check-foundation-governance.mjs`、`check-dependencies.mjs`、`foundation-contracts.json`。
- [x] `GOV-101-003` boundary 支持 `surfaces/`：Surface 禁止浏览器 Host API、plugins 私有边界、
      公共包禁止依赖 surface；证据：`check-boundaries.mjs`、`boundary-policy.mjs`。
- [x] `HST-101-001` Host 装配：transpilePackages、i18n 聚合、Route Target resolver、
      Host Navigation Port（Root Provider 外、Router 上下文内安装）、Registry 派生导航合并；
      证据：`apps/admin-web/src/{host,shell,i18n}/**`。

## 验证

- [x] `VER-101-001` foundation/architecture/dependency/lint/format 全绿；
      证据：三组 gate + `corepack pnpm lint` + `corepack pnpm format:check`。
- [x] `VER-101-002` 全 workspace typecheck 通过（framework/surface/web 等 11 个 workspace）；
      证据：逐 workspace `--filter typecheck`，admin-web `next typegen` 成功。
- [x] `VER-101-003` 全 workspace 单测通过（framework 16、surface 7、admin-web 46 等合计 89）；
      证据：逐 workspace `--filter test`。
- [x] `VER-101-004` `pnpm --filter @clouddrive/admin-web build` 33 个静态路由生成成功；
      `performance:check` 通过（initial 329,213 B、maxRoute 419,489 B < 430,080 B）。
- [x] `VER-101-005` Playwright：reference-resources 6 条（含 Axe、视觉基线、窄屏英文）；
      navigation/admin-foundation 回归 13 条通过；证据：`apps/admin-web/e2e/reference-resources.spec.ts`
      与运行输出。已知两个既有视觉基线（`universal-motion-desktop`、`ui-elements-family-status-async`）
      在 HEAD 同样漂移（本会话用 stash 复核），与 101 无关，未擅自更新基线。
- [x] `COM-101-001` 精确暂存 `/frontend` 任务文件并创建 Conventional Commit，不推送；
      证据：任务提交仅包含 `frontend/` 路径，提交前后均复核 staged Diff。
