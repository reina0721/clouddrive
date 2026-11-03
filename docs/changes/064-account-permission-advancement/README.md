# 064 账号与权限体系进阶

## 状态

**已确认，实施完成**（2026-08-24 用户确认决策 1–5 推荐项；RES/PLAN/AUD/SESS/WEB/TEST/DOC/VER 全部完成，证据见 [tasks.md](tasks.md)）。

## 结果

在既有闭合体系上以「真实缺口 + 单一 owner + 可验证闭环」原则完成首批两闭环，未修改 Casbin Core RBAC/授权 authority、未引入外部身份/多租户/ABAC：

1. **可查询低敏审计（Auth）**：新增 `auth_schema_migrations` 与表 `auth_audit_events`；持久化 Sink（`adapter/audit/storage`）由 Auth 模块内部装配（composition 只注入数据库租约），logger Sink 保留为 debug 级补充；`auth.audit.list`（`GET /api/v1/auth/audit`）只读查询支持分页/过滤/稳定排序，事件只含脱敏字段（subject/resource 哈希）；权限键 `auth:audit:read` 进入 Catalog 且 owner 自动覆盖；默认受控保留上限（超出删除最旧事件，不自动归档）。
2. **账号会话集中管理（IAM）**：`iam.sessions.list`（`GET /api/v1/iam/sessions`）与 `iam.sessions.revoke`（`POST /api/v1/iam/sessions/revoke`），复用 `iam_sessions` 表无新 schema；列表只暴露 SessionID 摘要（hex），批量吊销沿用安全修订与 owner 不变量；权限键 `iam:session:read/revoke` 进入 Catalog 且 owner 自动覆盖。
3. **WebUI**：新增审计日志页（`/admin/audit`，Auth owner）与账号会话管理页（`/admin/sessions`，IAM owner，归入「身份与权限管理」组），双语 locale、模块自有 mock、zone/action 权限投影；宿主源码零改动。
4. **配套**：contract-gen/composition/迁移目录同步；Go 测试（storage sink 写入/查询/脱敏/保留上限、IAM 会话列表/吊销/owner 不变量、组合菜单/权限断言）与 WebUI 测试（Vitest 82、i18n/module/architecture lint、typecheck、generate:check、e2e 11）全绿。

## 明确不做（与计划一致）

- 不实施 MFA/TOTP、组织数据权限、外部身份/多租户/ABAC（列为下一批候选方向，仅记录）。
- 不改变 Casbin Core RBAC 模型与授权 authority；组织关系不进授权决策。
- 审计不提供删除/篡改；不做自动归档/导出（保留上限 + 显式配置）。

## 阅读顺序

1. [研究档案](research/README.md)：R064-001
2. [需求](requirements.md)：REQ-064-001..008
3. [设计](design.md)：方案对比、数据流、失败语义、已确认决策 1–5
4. [任务清单](tasks.md)：任务执行状态与验证矩阵