# 076 需求规格：RBAC / HTTP API 未闭环缺口修复

引用研究：[R076-001](research/R076-001-rbac-http-api-gap-audit/report.md)。

## 1. 目标

按「真实缺口 + 单一 owner + 可验证闭环」原则，修复 IAM RBAC 管理与 HTTP API 的五类未闭环/缺口：**org 认证断点（Gap1）**、**角色/权限反向查询（Gap2）**、**会话列表分页（Gap3）**、**账号列表多维过滤（Gap4）**、**密码策略可配置化（Gap5）**。全部落在既有 IAM/Organization/Auth 模块边界与既有机制内，不新增权限键、不改变授权 authority、不引入候选方向能力。

## 2. 功能要求（推荐范围，待用户确认）

| ID | 要求 |
| --- | --- |
| `REQ-076-001` | **Gap1 org 认证断点修复**：Organization 全部 HTTP operation 的 security profile 由 `bearerAuth` 单轨迁移为 `webuiSession`（对齐 IAM/Navigation/Auth 先例）；mutation operation 接入 composition 注入的 `iamMutationGuardAdapter`（Origin + CSRF，复用既有 `newIAMMutationGuard` 装配）；org 前端 `binding/webui/web/api.ts` 的 mutation 请求补齐 `Origin` + `X-CSRF-Token` 头（对齐 `iam/binding/webui/web/api.ts` 的 `mutationHeaders()` 模式）；`api/openapi.yaml` 与 operation inventory 经 contract-gen 重生成。授权语义、权限键、业务行为不变。 |
| `REQ-076-002` | **Gap2 角色→账号反向查询**：IAM 新增只读快照服务方法（基于既有 `repo.ListAccountRolesByRole`）与 HTTP 端点 `GET /api/v1/iam/roles/{id}/accounts`（分页 offset/limit，返回账号摘要 + total），权限沿用 `iam:role:read`，不新增权限键。 |
| `REQ-076-003` | **Gap2 权限→角色反向查询**：IAM 新增只读查询（基于既有 `ListActiveRolePermissions` 过滤或新增 `ListRolePermissionsByKey`）与 HTTP 端点 `GET /api/v1/iam/permissions/roles?key=<permissionKey>`（key 含冒号，使用 query 参数；分页），权限沿用 `iam:permission:read`，不新增权限键；未知 key 返回 404。 |
| `REQ-076-004` | **Gap3 会话列表分页与过滤**：`GET /api/v1/iam/sessions` 支持 offset/limit 分页与 status 过滤（`active`/`revoked`/`all`，默认 `all`；active = 未吊销且按服务端时钟未过期），响应返回真实 offset/limit/total；完整保留 IDHash 低敏语义与自服务/管理员双入口行为。 |
| `REQ-076-005` | **Gap4 账号列表多维过滤**：`GET /api/v1/iam/accounts` 在既有分页/关键字基础上扩展可选过滤 `status`（active/disabled）、`archived`（bool）、`roleId`（仅统计 active 关系），Count 与 List 同语义；排序保持既有 `username ASC`。 |
| `REQ-076-006` | **Gap5 密码策略可配置化**：`iam.local` 配置节新增密码策略（`passwordPolicy`：`minLength` 默认 15、`maxLength` 默认 128，可选 `requireComplexity` 默认 false），`Decode` 校验（min≥1、max≥min 且 ≤ 既有上限）；`service.Config` 构造冻结策略并用于 Setup/ChangePassword/ResetPassword/CreateAccount 四路径校验；`model` 提供参数化校验并保留既有 `ValidatePassword` 兼容入口；`config init` 模板/示例同步。复杂度开关默认关闭，保证存量账号/既有配置兼容；新策略只约束创建/重置/修改密码路径，不重验存量哈希。 |
| `REQ-076-007` | 保持既有边界：Casbin Core RBAC 模型固定；不新增权限键；不改 Session/Cookie/CSRF/Origin 语义；不改授权 authority 与 fail-closed 行为；不引入数据权限、MFA、外部身份/多租户/ABAC、角色继承/deny/SoD、自助找回密码与 IP 限流。 |
| `REQ-076-008` | 契约与生成物单轨同步：新增/修改的 HTTP operation、过滤参数、security profile 必须经 contract-gen/WebUI generate 重生成并保持 `api/openapi.yaml`、operation inventory、webui registry 与文档一致；Go 与 WebUI 测试覆盖新语义。 |

## 3. 候选方向（仅记录，不实施）

- **登录 IP 级限流 / 验证码**：当前仅账号级锁定（429），IP 级防护属运维/产品决策，064 未列、本批不实施。
- **自助找回密码**（邮箱/短信验证）：需要外部消息通道与用户资料体系，超出本地账号闭环，另行立项。
- **行为审计的权限集合 diff（before/after）**：与 065「低敏字段域不携带权限集合原文」冲突，不实施。
- **角色/权限影响报告的聚合视图（WebUI 页面）**：本批只落地 API 闭环；管理页面呈现按真实需求另行立项。

## 4. 非功能要求

- 新增/修改 HTTP operation、security profile、配置与前端请求必须按模块开发指南与 051 文档治理执行；不新增第三方依赖。
- 日志与审计沿用低敏规范：新增只读查询不产生业务操作审计事件；安全相关变更（改密等）沿用既有审计路径。
- 并发与事务：Gap2-Gap4 均为只读查询，不涉及写事务；沿用既有分页/乐观并发契约；会话过期判断依赖服务端时钟（clock.System）。
- org 迁移不改变业务语义，仅改变认证 profile 与 mutation 守卫；`docs/operations/security.md` 的「业务模块不读取 IAM Repository/Session 表」边界不变。

## 5. 验收标准

1. 托管模式（模式 B、IAM Session）下 org 部门/岗位/分配页面读写真实 API 全链路可用；mutation 携带 Origin + CSRF，缺失时 403 `csrf_invalid`（Go 测试断言）。
2. `GET /api/v1/iam/roles/{id}/accounts` 与 `GET /api/v1/iam/permissions/roles?key=…` 返回正确分页结果与 total；无权限（非 role:read/permission:read）denied；未知角色/权限 key 404。
3. `GET /api/v1/iam/sessions` 分页/status 过滤正确（active 排除已吊销与过期），IDHash 摘要不泄露明文；`api/openapi.yaml` 同步。
4. `GET /api/v1/iam/accounts` 的 status/archived/roleId 过滤与分页/关键字组合正确（Count 一致）；无过滤时行为与现状一致。
5. 密码策略经 `iam.local.passwordPolicy` 配置生效（min/max/复杂度开关）；默认值 15/128 行为不变；存量配置缺省字段安全回退默认；改动配置后创建/改密立即生效，登录存量账号不受影响。
6. `go test ./...`、`go vet ./...`、`pnpm generate:check`、WebUI lint/typecheck/Vitest、`docs-guard` 全绿；模式 B 下 org 页面真实请求 e2e 通过。

## 6. 非目标

- 不实施多实例一致性、MFA、外部身份/多租户/ABAC、数据权限、角色继承/deny/SoD（均为候选方向或产品决策项）。
- 不新增权限键（Gap2 复用 `iam:role:read`/`iam:permission:read`）。
- 不改变 Casbin evaluator 模型、Session/CSRF/Cookie 语义、授权 authority。
- 不做会话/角色的物理删除或恢复流程；不改动归档语义。
- 不实现登录 IP 级限流、自助找回密码、复杂度默认开启（避免破坏存量兼容）。