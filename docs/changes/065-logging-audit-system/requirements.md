# 065 需求规格：日志与审计体系进阶（业务操作审计）

引用研究：[R065-001](research/R065-001-logging-audit-baseline/report.md)。

## 1. 目标

在既有「日志体系（已闭环，无查询 API，保持现状）」与「审计体系（064：Auth 授权决策审计）」之上，补齐 **业务操作审计**：让 IAM、Organization、Navigation 的写操作（创建/变更/替换/启停等）可审计「谁在何时对什么资源做了什么、结果如何」，与现有授权决策审计共用同一低敏审计面（`auth_audit_events` + 查询 + WebUI），**不新建第二套审计存储、不推翻 024/R005 的 Auth 收口决策、不引入日志自建查询或外部日志平台**。

## 2. 功能要求

| ID | 要求 |
| --- | --- |
| `REQ-065-001` | Auth 暴露窄 **业务操作审计写入 port**（如 `OperationAuditWriter`，复用 `service.AuditSink` 语义的低敏字段域：actor_kind/subject_hash/resource_type/resource_hash/action/outcome；时间由 Sink 定）供业务模块与 composition 注入；不得暴露原始 token/claims/对象内容。 |
| `REQ-065-002` | IAM 写操作接入操作审计：创建账号、账号启用/禁用、重置密码、替换账号角色、创建角色、替换角色权限（至少这些）；每条记录含账号/角色 resource type+hash、动作与 succeeded/failed outcome，且不包含密码/权限集合原文。 |
| `REQ-065-003` | Organization 写操作接入操作审计：创建/更新部门、归档/恢复、创建岗位、更新岗位、修改账号组织分配；不包含部门树全量或岗位内容原文。 |
| `REQ-065-004` | Navigation 写操作接入操作审计：更新菜单策略（enabled/parent/order 变更）；不包含策略全文。 |
| `REQ-065-005` | 审计写入不得阻断业务主路径：失败按低敏错误向上返回（不吞错），但不得因审计失败使业务 mutation 回滚或产出成功假象（写入语义与业务事务解耦，设计确认）。 |
| `REQ-065-006` | 失败也审计：写操作最终失败时记录 failed outcome（决策 3 确认范围），与 succeeded 一致保留低敏字段。 |
| `REQ-065-007` | 审计查询增强（可选，决策 2）：现有 `auth.audit.list` 支持按 action/resource_type 过滤；WebUI 审计页增加模块/动作筛选与结果摘要，保持低敏。 |
| `REQ-065-008` | 审计规范 authority：在 `docs/development/logging.md`（或并列 `audit.md`）固化「业务操作审计」要求（哪些写操作必须审计、字段域、低敏、成功/失败语义、验证方式），与 041/064 authority 一致。 |
| `REQ-065-009` | 保持边界：不修改 Casbin Core RBAC、不改变授权 authority、不新增路由级权限以外的操作权限（操作审计由已注册操作权限覆盖），不引入日志数据库/全文检索/外部日志平台。 |

## 3. 非功能要求

- 审计事件继续低敏：subject/resource 只存 hash；不含对象内容、before/after 全文、密码、token、DSN、完整 URL/query。
- port 由各业务模块定义窄契约（模块自有 interface），composition 是唯一连接点；模块 service 不 import Auth 实现。
- 不新增第三方依赖；不改变既有 `auth_audit_events` 表语义（已有字段可承载动作/resource）。
- 保持既有 i18n、WebUI 接入四步、权限投影契约。

## 4. 验收标准

1. 业务写操作（IAM/Organization/Navigation 指定集合）全部产生低敏操作审计事件，`auth.audit.list` 可查询且 outcome/action/resource 正确标注。
2. 审计事件不包含明文 subject、密码、权限集合、部门树或策略全文；`adapter/audit/storage` 持久化测试覆盖。
3. 业务 mutation 主路径不因审计失败受阻；失败用例产生 failed outcome 且不吞错（按决策 3）。
4. WebUI 审计页（按决策 2）可筛选模块/动作并保持双语与低敏呈现。
5. `docs/development/logging.md`（或 audit.md）固化操作审计要求；`runtime-capabilities.md`/`security.md` 同步。
6. Go 测试（service 级注入 fake writer、持久化 low-sensitivity、查询过滤）、WebUI 测试（Vitest/lint/typecheck）、generate:check、e2e 不回归。

## 5. 非目标

- 不建日志查询 API / 日志数据库 / 全文检索 / 自建日志平台（041/028 判定保持）。
- 不建独立 audit 业务模块、不推翻 024/R005（Auth 收口）。
- 不实施 MFA/数据权限/外部身份/多租户（064 下一批候选）。
- 不在宿主集实现业务页面；不新增第三方依赖。