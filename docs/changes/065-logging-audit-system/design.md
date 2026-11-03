# 065 设计方案：日志与审计体系进阶（业务操作审计）

## 1. 背景与目标形态

研究结论（R065-001）：日志体系已闭环（sink 模型，无查询 API，保持现状）；审计体系在 064 已落地「Auth 授权决策审计」（`auth_audit_events` + `auth.audit.list` + WebUI + `auth:audit:read`），但业务写操作（IAM/Organization/Navigation 变更）没有任何操作审计记录。本方案补齐「业务操作审计」，与现有授权审计共用同一低敏审计面，不建第二套审计/日志存储。

## 2. 方案对比

| 方案 | 做法 | 结论 |
| --- | --- | --- |
| A（采纳） | Auth 暴露窄 `OperationAuditWriter` port（低敏字段域复用 `service.AuditSink`）；IAM/Organization/Navigation service 在写操作边界调用，composition 注入 | 真实缺口、模块边界清晰、符合 024/R005 + port 模式；复用既有 `auth_audit_events`/查询/WebUI |
| B（不采纳） | 新建独立 `audit` 业务模块，迁移审计存储/查询/权限 | 无额外收益且推翻 024/R005 既有决策；无 consumer 证据 |
| C（不采纳） | 日志数据库/全文检索/外部日志平台 | 041/028 判定非目标；10 个输入模型不支撑查询语义，属重复造轮子 |

## 3. 数据流与实现位置

### 3.1 Auth：窄业务操作审计 port

```
internal/module/auth/service：
  type OperationAuditRequest struct { Action string; ResourceType, ResourceID string; Outcome authmodel.AuditOutcome }
  type OperationAuditWriter interface { RecordOperation(context.Context, OperationAuditRequest) error }
  Auth Service 实现 OperationAuditWriter（复用现有 audit.audit/auditReader，组合 AuditSink.Record + subject hash）
```

- 字段域：actor_kind/subject_hash 从当前 Principal（`service.SessionFromContext`/Auth principal）取得；resource type/id 用既有 hash 语义（复用 `adapter/audit/storage.digest` 或统一函数）；action/outcome 由调用方给出。
- 不新增表：`auth_audit_events` 现有字段（operation/action/actor_kind/subject_hash/resource_type/resource_hash/decision/outcome）已足够；`operation` 约定为业务动作（如 `iam.accounts.create`）、`action` 可空或复用，`decision=allowed/failed` 语义在审计视图中保留。

### 3.2 业务模块：port 定义 + service 接入

- 各模块 service 定义自身窄 port（模块自有 interface），如：
  - IAM：`OperationAudit interface { RecordOperation(context.Context, AuditRequest) error }`，构造时注入；写操作成功/失败边界调用（`CreateAccount`、`SetAccountStatus`、`ResetPassword`、`ReplaceAccountRoles`、`CreateRole`、`ReplaceRolePermissions`）。
  - Organization：`CreateDepartment/UpdateDepartment/SetDepartmentArchived/.../ReplaceAssignment` 等。
  - Navigation：`Update`（菜单策略变更）。
- composition：在 identity-access 子装配中，把 Auth 的 `OperationAuditWriter` 适配成各模块 port（同 064 `asAuthDatabaseAccess` 窄 adapter 模式），模块不 import Auth 实现。

### 3.3 审计写入语义（决策 3）

- 成功/失败都记录（决定点：在 service 完成处记录 outcome；失败路径用 `defer`/最终分支确保记录）。
- **审计写入与业务事务解耦**：`RecordOperation` 在业务事务提交后调用（服务层最终 return 之前或 defer），审计失败只向上返回低敏错误、不回滚业务结果；由调用方（HTTP handler）决定是否呈现失败（按 028 唯一错误 owner：审计失败属于可恢复诊断，不应以故障阻断业务成功响应——设计确认）。
- subject 来源：HTTP 会话 principal 已在 handler/transport 注入；service 若无 principal 上下文，由调用方传入 actor 摘要或使用窄输入。

### 3.4 查询增强（决策 2，可选）

- `auth.audit.list` 增加 `action`/`resourceType` 过滤；WebUI 审计页增加模块/动作筛选与摘要；呈现不变（低敏、双语）。

### 3.5 规范 authority

- 在 `docs/development/logging.md` 增加「业务操作审计」节（或新增 `docs/development/audit.md` 并列 authority，决策 4）：哪些写操作必须审计、字段域、低敏、成功/失败语义、验证要求。

## 4. 文件影响（估算）

| 文件 | 动作 |
| --- | --- |
| `internal/module/auth/{service,model}` | 增加 `OperationAuditWriter`/`OperationAuditRequest` 与实现 |
| `internal/module/auth/binding/http/huma.go` | 查询过滤（action/resourceType，决策 2） |
| `internal/module/{iam,organization,navigation}/service` | 模块自有 port + 写操作接入 |
| `internal/composition/identity_access.go`（或新文件） | 把 Auth writer 适配为各模块 port |
| `internal/module/auth/binding/webui/**`、`iam/binding/webui/**` | 审计页筛选（决策 2） |
| `docs/development/logging.md`（或 audit.md）、`docs/operations/{security,runtime-capabilities}.md`、变更记录 | authority 同步 |
| 测试：auth/service、各模块 service（fake writer）、storage 低敏、查询过滤、WebUI Vitest | 覆盖 |

## 5. 失败语义与边界

- 审计写入失败：低敏错误向上返回（不吞错）；业务成功响应不被阻断（决策 3 确认）；不除日志重复记录。
- 低敏：subject/resource 只存 hash；action/resource_type 用稳定枚举（模块集中常量）；不存对象内容/before-after/password/策略全文。
- 权限：操作审计依赖已注册操作权限（`iam:account:*` 等）与既有 `auth:audit:read` 查询权限；不新增第二套授权。
- 兼容：不加新表、不改既有表语义；0 迁移（或仅查询索引可选）。

## 6. 验证方案

1. Go：auth service `OperationAuditWriter` 单元（fake sink 断言字段/outcome/低敏）；各模块 service 接入测试（fake writer 断言调用与字段）；storage 低敏与查询过滤测试；composition 适配测试。
2. WebUI：审计页筛选（决策 2）模块 lint/typecheck/Vitest；generate:check；e2e 本机可运行项。
3. 文档：docs-guard、logging/audit authority、runtime-capabilities/security 同步。

## 7. 待确认决策

- 决策 1（推荐）：采用方案 A——Auth 收口操作审计 writer 窄 port，IAM/Organization/Navigation 注入同一低敏审计面；不建第二套存储。
- 决策 2（推荐）：查询增强（按 action/resourceType 过滤）纳入本批；WebUI 审计页加模块/动作筛选。
- 决策 3（推荐）：业务写操作成功与失败都审计；审计写入与业务事务解耦，审计失败低敏上报但回滚业务成功结果。
- 决策 4（推荐）：规范 authority 固化进 `docs/development/logging.md` 新增「业务操作审计」节（不新建并列 audit.md，保持日志/审计同一 authority）。
- 决策 5（推荐）：本批不改动日志 sink 模型、不建日志查询 API、不引入外部日志平台（保持 041/028 判定）。

## 8. 明确不做

- 不建日志数据库/全文检索/外部日志平台；不建独立 audit 业务模块；不改 Casbin 授权模型；不实施 MFA/数据权限/外部身份（064 下一批）。
- 不引入第三方依赖；不在宿主实现业务页面。