# 065 日志与审计体系进阶（业务操作审计）

## 状态

**已确认，实施完成**（2026-08-24 用户确认决策 1–5 推荐项；RES/PLAN/AUDW/IAM/ORG/NAV/WIRE/WEB/TEST/DOC/VER 全部完成，证据见 [tasks.md](tasks.md)）。

## 结果

在既有「日志体系（已闭环，保持 sink 现状、不建查询/外部平台）」与「审计体系（064 授权决策审计）」之上，补齐**业务操作审计**：

1. **Auth**：新增 `OperationAuditWriter` 窄 port（`RecordOperation`，低敏字段域 operation/action/resource type+id/outcome，actor 从当前 Principal 推导并摘要），复用 `auth_audit_events`/`auth.audit.list`/WebUI；无新表。
2. **IAM**：创建账号、启用/禁用、重置密码、替换账号角色、创建角色、替换角色权限接入操作审计。
3. **Organization**：部门创建/更新、岗位创建/更新、账号组织分配变更接入。
4. **Navigation**：菜单策略更新接入。
5. **查询增强**：`auth.audit.list` 支持 action/resourceType/operation/outcome/actorKind 过滤；审计页增加动作/资源类型筛选。
6. **规范**：`docs/development/logging.md` 新增「业务操作审计」节；security/runtime-capabilities/webui/application-module-development 同步。

实现遵循：业务模块各自定义窄 `OperationAuditWriter` port（不 import Auth），composition 是唯一连接点（`internal/composition/operation_audit.go` 三个窄 adapter + 注入点）；审计写与业务事务解耦（失败低敏上报但不回滚业务结果）；成功与最终失败都记录。

## 验证摘要

- Go：`go test ./...` 全绿（新增 auth storage record/filter、IAM/ORG/NAV fake-writer 测试）、`go vet ./...` 通过；
- WebUI：`generate:check`、lint-modules/architecture/i18n、`tsc --noEmit`、Vitest 82、eslint 0 error、Playwright e2e 11 全通过；
- 文档：docs-guard 通过。

## 明确不做

- 不建日志查询 API / 日志数据库 / 全文检索 / 外部日志平台（041/028 判定保持）；不改日志 sink 模型。
- 不建独立 audit 模块、不推翻 024/R005（Auth 收口）；不改 Casbin/授权 authority。
- 不实施 MFA/数据权限/外部身份/多租户（064 下一批）。

## 阅读顺序

1. [研究档案](research/README.md)：R065-001
2. [需求](requirements.md)：REQ-065-001..009
3. [设计](design.md)：方案对比、数据流、失败语义、已确认决策 1–5
4. [任务清单](tasks.md)：任务执行状态与验证矩阵