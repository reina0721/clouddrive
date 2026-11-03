# 102 Frontend 文档体系

## 范围与状态

本变更把 `frontend/docs/` 整理成连贯的当前文档体系：统一入口手册、分层主题 authority、
与 101（Admin Framework / Surface File Routes）同步的架构图与数字、补全变更索引，
并新增 `pnpm docs:check` 结构门禁。`docs/changes/**` 只保留历史证据与索引，
不承担任何当前 authority。

研究门禁：已通过 `R102-001`。
计划状态：已确认，实施、验证与任务提交完成。

## 阅读顺序

1. [Frontend 文档体系现状审计](research/R102-001-frontend-docs-audit/report.md)
2. [需求](requirements/README.md)
3. [设计](design/README.md)
4. [任务与证据](tasks.md)

## 关键决策

- 新建 `docs/README.md` 作为前端文档唯一入口，入口链为
  `frontend/README.md -> docs/README.md -> 主题 authority -> 局部 README/AGENTS`。
- 新建 `docs/admin-framework.md` 当前 authority，把 101 从“变更记录”升级为文档体系
  一部分；变更记录保持历史定位。
- 同步 README / AGENTS / frontend-foundation / admin-foundation / quality-evidence 到
  101 之后事实；quality-evidence 重构为“当前证据 + 历史证据入口”。
- 补全 `docs/changes/README.md`（100/101/102），删除过期句。
- 新增 `surfaces/admin/AGENTS.md` 与 `packages/admin-framework/AGENTS.md` 局部约束。
- 新增 `tooling/check-docs.mjs`（结构门禁：入口、必备 authority、当前 authority 链接、
  变更索引覆盖），接入 `pnpm check`；不校验数字断言（避免脆弱门禁）。
