# 098 Universal Frontend + Admin Product Foundation

## 范围与状态

本变更把 `/frontend` 收敛为 `Universal Foundation -> Product Surface Foundation -> Surface × Runtime Application` 三层架构，并把 Admin 建设为首个完整 Product Surface。

研究门禁：已通过 `R098-001`、`R098-002`。
计划状态：已确认，实施、最终全量门禁与任务提交完成。

## 阅读顺序

1. [当前边界与缺口研究](research/R098-001-current-foundation-boundaries/report.md)
2. [Form/i18n 与官方契约研究](research/R098-002-universal-contracts/report.md)
3. [需求](requirements/frontend-product-foundation.md)
4. [设计](design/foundation-architecture.md)
5. [任务与证据](tasks.md)

## 关键决策

- `packages/*` 按 Universal 与 Product Surface 分类，`apps/*` 必须表达 Surface × Runtime。
- 当前应用单轨迁移为 `apps/admin-web`；没有真实 Product Surface 的 Desktop 占位退役。
- HeroUI、React Hook Form 与 i18next 分别收口在 UI、Form 与 i18n Universal 边界。
- Admin Layout、Pattern、Page Archetype 与 Motion Recipe 进入 `packages/admin-foundation`。
- `/ui-elements`、`/motion`、`/admin-patterns`、`/admin-reference` 分别承担不同层级的可执行权威。
