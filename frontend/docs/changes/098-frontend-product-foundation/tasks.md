# 098 Frontend Product Foundation — 完成清单

研究门禁：`R098-001`、`R098-002` 已通过。
计划状态：已确认，实施、验证与任务提交完成。

## 研究与计划

- [x] `R098-001` 审计 Universal/Surface/Host 当前边界与占位实现；证据：research/R098-001-*。
- [x] `R098-002` 核实 Form/i18n/UI/Motion 当前与官方契约；证据：research/R098-002-*。
- [x] `PLN-098-001` 完成需求、设计与任务并获得用户确认；证据：本变更 requirements/design/tasks 与确认消息。

## Universal Foundation

- [x] `UNI-098-001` 建立 workspace/contract registry 与三层依赖门禁；证据：`tooling/foundation-policy.json`、`foundation-contracts.json` 与 10 个 fixture。
- [x] `UNI-098-002` 建立 Form Foundation，迁移 RHF/Zod 重复编排；证据：`packages/form-foundation`、Reference/Preferences 调用方与单元测试。
- [x] `UNI-098-003` 建立 i18n Foundation，迁移 runtime/hook/formatter；证据：`packages/i18n`、Admin Host 装配与 formatter 调用方。
- [x] `UNI-098-004` 补齐 Accessibility、Form、Navigation、Collection Element 与 Universal Motion Primitive；证据：45/45 UI Element authority、`/motion` 与 DOM/键盘测试。
- [x] `UNI-098-005` 清理 Universal 包中的 Admin/Reference/Host 语义；证据：schemas/types/core 导出与 foundation registry 检查。

## Admin Surface 与 Host

- [x] `ADM-098-001` 建立 Admin Foundation Layout/Shell/Pattern/Motion 公共子路径；证据：`packages/admin-foundation` 的 7 个显式子路径与测试。
- [x] `ADM-098-002` apps/web 单轨迁移为 apps/admin-web 并完成 Router/Browser 装配；证据：workspace、Next 构建与 29 个静态路由。
- [x] `ADM-098-003` 删除 apps/desktop、packages/reference 与全部旧符号；证据：workspace 分类、旧路径扫描与单轨 Diff。

## Authority 与可执行场景

- [x] `SHOW-098-001` 分离并补全 /ui-elements、/motion、/admin-patterns 权威页面；证据：对应路由、导航分组与视觉快照。
- [x] `SHOW-098-002` 完成七类 /admin-reference Page Archetype；证据：7 类 × 4 视口、Axe 与 overflow 自动验证。
- [x] `DOC-098-001` 同步 README、AGENTS、Foundation authority 与变更索引；证据：`docs/frontend-foundation.md`、`admin-foundation.md`、扩展治理与质量证据。

## 验证与提交

- [x] `VER-098-001` architecture/foundation/dependency/lint/type/unit/build/performance/format 全绿；证据：最终 `pnpm check` 全绿，29 个 Vitest、29 个静态路由，最大路由 414,676 B < 440,320 B。
- [x] `VER-098-002` Playwright、Axe、Responsive、Dark/English/Compact/Reduced Motion 与视觉矩阵全绿并人工复核；证据：41/41 Playwright 通过，七类 Archetype × 四档视口和代表性快照人工复核。
- [x] `VER-098-003` 旧路径、旧 package、未登记 Contract、vendor 越界与脏 Diff 扫描为零；证据：Foundation/Architecture/Dependency gates、源码与 workspace 旧符号扫描、`git diff --check` 均通过。
- [x] `COM-098-001` 精确暂存 `/frontend` 任务文件并创建 Conventional Commit，不推送；证据：任务提交仅包含 `frontend/` 路径，提交前后均复核 staged Diff。
