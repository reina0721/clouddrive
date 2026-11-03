# R002 后端真实能力清单

> 研究快照：commit `c3a23c0`，研究/验证日期 2026-08-27。
> 本档案只回答「后端到底提供了哪些能力」，以真实代码、生成物与已发布文档为证据；目标设计、文档声明与代码不一致处一律单独标注为【推断】或【文档漂移观察】。

## 1. 研究问题与方法

### 1.1 问题

1. `internal/module/` 各模块（auth/iam/migration/navigation/openapi/ops/organization/settings/todo）的真实职责、边界与依赖方向；每模块 `binding/` 下 facet 清单。
2. 认证与授权：Auth 能力（Principal/JWT/webuiSession/Session Cookie/CSRF/审计 OperationAuditWriter/DecisionPoint）、IAM Core RBAC 与 Casbin evaluator、全部权限键目录、owner 语义、api token scope 模型。
3. 业务能力（按真实 HTTP operation）：IAM、Organization、Navigation、Ops、Settings、OpenAPI、Todo、Auth 审计。
4. 对外契约：operation 总量与分组、统一错误语义、分页与过滤、Bearer/CSRF 认证组合。
5. 数据模型与迁移集。
6. 管理端点与诊断。
7. 配置与可配置项。

### 1.2 方法与范围

- 以代码为唯一权威：模块 README 只作导航，凡与代码冲突处以代码为准并记录冲突。
- 关键证据：`api/openapi.yaml`、`internal/transport/http/api/operation_inventory.gen.go`（contract-gen 生成物，operation→scope→action 的权威映射）、`internal/composition/http_contracts.go`（HTTP/permission/WebUI 唯一汇总点）、`internal/composition/migration.go`（迁移集唯一汇总点）、各模块 `binding/http/huma.go`、`internal/permission/catalog.go`、`pkg/httpx/problem.go`、`internal/module/ops/binding/http/handler.go`、`docs/operations/runtime-capabilities.md`、`config.example.yaml`。
- 不修改任何代码/文档，不评估外部系统，不把 `old-backend/` 视为事实来源。

## 2. 证据清单

| 证据 | 定位 | 用途 |
| --- | --- | --- |
| OpenAPI 公开契约（55 operation） | `api/openapi.yaml`(1295-3403 paths 段) | operation 总量/分组/security/错误模型 |
| operation inventory 生成物 | `internal/transport/http/api/operation_inventory.gen.go` | operation→Policy/Scope/Action 权威映射 |
| HTTP 注册唯一汇总点 | `internal/composition/http_contracts.go`(34-42) | 「哪些模块提供 HTTP operation」的唯一清单：auth/iam/organization/navigation/todo |
| 权限目录唯一汇总点 | `internal/composition/http_contracts.go`(49-55) + `internal/permission/catalog.go` | 23 个权限键与 owner |
| WebUI 模块汇总点 | `internal/composition/http_contracts.go`(59-69) | 7 个启用 WebUI 模块（iam/organization/navigation/ops/auth/settings/openapi） |
| 迁移集唯一汇总点 | `internal/composition/migration.go`(37-54) | 5 个迁移 set（auth/iam/organization/navigation/todo） |
| IAM WebUI 绑定 | `internal/module/iam/binding/webui/binding.go` | 页面→ViewOperationID 门禁映射 |
| Auth/Org/Nav/Todo/OpenAPI/Settings WebUI 绑定 | `internal/module/{auth,organization,navigation,openapi,ops,settings}/binding/webui/binding.go` | 页面与菜单声明 |
| WebUI 契约 | `internal/webui/contract.go` | Manifest/Catalog/NavigationPolicy/Zone 契约 |
| WebUI 托管 | `internal/webuihost/{config,spa,build}.go` | webui.hosting 配置、SPA fallback、构建脚本执行 |
| 管理面绑定 | `internal/module/ops/binding/http/handler.go` | /management/{startupz,livez,readyz,build,diagnostics,metrics} |
| Problem JSON | `pkg/httpx/problem.go` | RFC 9457 错误契约与错误码 |
| identity-access 子装配 | `internal/composition/{identity_access,iam,http_api}.go` | Session→iam-rbac Principal、DecisionPoint、CSRF 守卫适配 |
| IAM 授权 runtime | `internal/module/iam/authorization/runtime.go` | evaluator 加载/发布/revision 刷新 |
| auth service | `internal/module/auth/service/service.go` | policy 执行、审计、DecisionPoint 消费 |
| 迁移 SQL | `internal/module/{iam,auth,organization,navigation,todo}/binding/migration/mysql/*.sql` | 数据模型 |
| 运行能力矩阵 | `docs/operations/runtime-capabilities.md` | 配置入口/owner/验证边界汇总 |

## 3. 模块清单与职责

### 3.1 模块总览（README + module.go 代码交叉验证）

| 模块 | 真实职责（代码证据） | 依赖方向 | binding/ facet |
| --- | --- | --- | --- |
| auth | 横切认证/授权/审计：Bearer `RequestAuthenticator`、operation/action policy、`DecisionPoint` port、低敏审计 Sink/Reader、JWT verifier(`adapter/jwt`,`jwx/v3`)、失败告警。不拥有 IAM repo/密码/会话表/Casbin。`internal/module/auth/module.go`(26-62) | 消费 IAM Authorization/Session facet（经 composition adapter）；不 import IAM/Casbin | config, http, migration, permission, webui |
| iam | 本地 Account/Credential/Session/Role/AccountRole/RolePermission + authorization revision；owner 初始化、登录锁定、MustChangePassword、账号禁用、SecurityRevision 会话失效、Core RBAC 发布；api-token、MFA/TOTP、口令治理、会话治理。`internal/module/iam/module.go`(23-54) | 不 import Auth；通过窄 facet 输出 Sessions/Authorization/Accounts/Administration/Mutation/ApiTokens | cli, config, http, migration, permission, webui |
| migration | 只编排 `status/up` 用例与 CLI 契约，不拥有业务表；通用 golang-migrate adapter 在 `pkg/database/migrate`。`internal/module/migration/README.md` | 消费各模块 `binding/migration.Set` 汇总 | cli, config |
| navigation | 只管理已注册菜单的运行策略（启停/父级覆盖/排序覆盖 + NavigationRevision）；Route/Entry/组件/图标/标题/查看权限由各模块 WebUI Binding 拥有。`internal/module/navigation/README.md`,`service/service.go`(110-172) | 消费 `NavigationCatalog` 窄端口（composition 注入 WebUI catalog）与 IAM 注入的 CSRF 守卫 | http, migration, permission, webui |
| openapi | 纯 WebUI 模块（API 文档 + Try it out），无后端 service/repo/migration/operation；契约快照是构建期生成物。`internal/module/openapi/README.md` | 无后端依赖；访问门槛 ViewOperationID=`iam.session.read` | webui |
| ops | management facade + 探针/诊断/build + management HTTP binding；消费 `pkg/observability` 项目契约，不 import Prometheus/OTel。`internal/module/ops/README.md` | 依赖 composition 注入的 RuntimeSource/management scope Access；不依赖顶层业务模块 | config, http, webui |
| organization | 部门无环树、岗位平面目录、账号部门/岗位分配（expectedVersion 乐观锁）；只维护目录，不授权限。`internal/module/organization/README.md` | `AccountDirectory` 窄端口由 composition 适配 IAM；不 import IAM/Auth/Navigation | http, migration, permission, webui |
| settings | 纯 WebUI：设置中心 8 分区页面与两级菜单；无后端 Service/Repo/Migration；Profile/Account/Security 复用 IAM HTTP，Appearance/Notifications/Language 均为前端偏好。`internal/module/settings/README.md` | 无后端依赖（页面内调用 IAM API） | webui |
| todo | 首个真实应用模块/纵向切片：创建/列表/读取/完成，owner 授权 + Version 乐观并发；HTTP 用 Bearer profile；保留作学习参考（不属管理控制台）。`internal/module/todo/README.md` | 依赖 Kernel Database Access；`ActorAccess` 由 composition 连接 Auth Principal | cli, config, http, i18n, migration, permission |

### 3.2 依赖方向要点（代码证据）

- composition 是唯一装配 root（`internal/composition/`）：`composeIdentityAccess`（`identity_access.go`）子装配把 IAM `Authorization` facet 适配为 Auth `DecisionPoint`（`iamRBACDecisionAdapter`）、IAM Session 适配为 `iam-rbac` Principal（`iamSessionAuthAdapter`）、IAM `MutationGuard` 适配为业务 mutation 守卫（`iamMutationGuardAdapter`，`iam.go`）。
- 模块互相不 import：Organization 用自有 `AccountDirectory` 窄端口（composition 适配 IAM）；Navigation/Organization 用自有同名 `MutationGuard` 窄接口（composition 注入同一 IAM 守卫实现）；Auth 不 import IAM（只依赖 `service.DecisionPoint` port）。
- 业务写操作审计：`auth.Module.OperationAudit`（`authmodel.OperationAuditWriter`）由 composition 适配为各业务模块自有窄 port 注入（`identity_access.go`(137-138)、`navigation/service/service.go`(42-72)、`organization/service`、`iam/service`）。
- 根 composition 不取得 `*iam.service.Service`（`Module` 只暴露窄 facet）；`HTTPModule.Service` 仅内部 HTTP 装配使用。

## 4. 认证与授权

### 4.1 Principal 模型（`internal/module/auth/model/model.go`）

- `AuthorizationSource` 二值互斥：`token-scopes`（Bearer/JWT/CLI/development，精确 Scope 直判，revision 必须为 0）与 `iam-rbac`（Scopes 必须为空、revision 非零、必须经注入 DecisionPoint）；未知来源 fail closed（`decide`，`service/service.go`(372-411)）。
- `Principal.Restricted`（MustChangePassword 受限会话）只允许自助权限 `iam:account:self:read`/`iam:account:self:password:write`（`authorization/runtime.go`(116-122)）。
- Scope 精确匹配、无通配符（`HasScope`）；`AuthorizationTokenScopes` 来源才可用 HasScope。
- 审计事件只携带低敏字段，Sink 负责脱敏（`model.go`(190-209)）。

### 4.2 Auth 模块能力（`internal/module/auth/`）

- 认证 profile：`development-anonymous`（loopback+development 限定，默认）或 `jwt`（jwx/v3 JWKS 校验，`adapter/jwt`）；`ChainVerifier` 按声明顺序尝试 JWT→API-Token（`service/service.go`(26-73)）。
- 操作授权：operation policy 目录（55 个 operation 全部注册，`composition/service.go`(212-225) 附加 ops.diagnostics/ops.metrics 两条 management policy）；`EnforceOperation`/`EnforceAction` 执行并低敏审计；`ReasonPublic/…/ReasonRBACDenied` 等低基数原因。
- 审计：`auth_audit_events` 表持久化（`adapter/audit/storage`），保留上限默认 100_000（`module.go`(66)）；无 DB 时回退 logger Sink；`WithAuditReader` 提供只读查询（无删除/篡改入口）。
- 认证失败告警：连续 5 次/10 分钟触发 `auth_failed` 告警事件（`service/service.go`(484-518)，079）。
- WebUI 会话：`SessionSource`（IAM Session 适配）与 Bearer 并存；`ManagementMiddleware` 允许 management 面使用 Bearer 或 WebUI Session（`module.go`(74-88)）。

### 4.3 Session / Cookie / CSRF

- Session Cookie 名：`__Host-community-go_iam_session`（`internal/module/iam/service/service.go`(29)）；HttpOnly/Secure/SameSite=Lax（`binding/http/huma.go`(697-702)）。
- 【文档漂移观察】`api/openapi.yaml` security scheme `webuiSession` 声明 cookie 名为 `go_scaffold_session`（`openapi.yaml`(1286-1289)，来自 `internal/transport/http/huma.go`(29)），与运行时实际 Cookie 名 `__Host-community-go_iam_session` 不一致；浏览器端实际凭据以运行时 Cookie 名为准，WebUI 重构时不应依赖 OpenAPI 中声明的 cookie 名。
- 会话表只存 `id_hash`/`csrf_hash`（VARBINARY(32)）；列表响应只暴露 IDHash hex，不泄露明文 SessionID/CSRF。
- CSRF 双入口：
  - IAM 自有 mutation（`requireMutation`，`iam/binding/http/huma.go`(685-693)）：要求 `Origin` + `X-CSRF-Token`，失败返回 403 `csrf_rejected`；
  - 跨模块 mutation 守卫（`internal/composition/iam.go`(77-95)）：Navigation/Organization 的 mutation 中间件调用，失败返回 403 `csrf_invalid`（origin 缺失/不允许/token 无效区分）。
- session 读取会轮换 CSRF token（`iam.session.read` handler 调 `RotateCSRF`，`huma.go`(268-279)）。
- 登录（含 setup）要求 `Origin` 头（同源或 `http.cors.allowedOrigins` 白名单，`Handler.originAllowed`，`contract.go`(75-85)；`requireOrigin` 失败 403 `origin_rejected`）。

### 4.4 IAM Core RBAC 与 Casbin evaluator（`internal/module/iam/authorization/`, `adapter/casbin/`）

- `authorization.Runtime`：`Load`（Generation Prepare 加载）、`Decide`（fail-closed，revision 不一致时调用方 context 下合并刷新，`syncEvaluator`）、`ProjectPermissions`（同 revision 权限投影，仅体验用）、`Mutate`/`BuildCandidate`/`PublishCandidate`（事务+commit 后原子发布，`runtime.go`(176-212)）。
- evaluator 契约：Casbin v3 `SyncedEnforcer` 只执行固定 two-field Core RBAC 求值；从 Repository `PolicySnapshot`（稳定排序、去重、active/未归档过滤、Catalog 校验）构造；不承担 hierarchy/domain/deny/ABAC/ReBAC，不用 GORM Adapter/AutoLoad/Watcher/产物持久化（`internal/module/iam/README.md`(7)）。
- 授权关系 mutation 与 evaluator 发布同一事务协议；任何账号状态/角色权限变化都在事务内 bump `SecurityRevision`，旧 Session 随即失效。
- `Principal.AuthorizationRevision` 与 evaluator revision 不一致时拒绝（`ErrRevisionMismatch`），不使用旧 evaluator 放行。

### 4.5 owner 语义

- 系统 owner 角色：创建于首次 owner reconcile（`Administration.ReconcileOwnerCatalog`），不可归档、不可改写权限、始终拥有完整 Catalog；最后一个 active owner 账号与 owner 角色不可归档（`ErrImmutableOwner`/`ErrOwnerInvariant`，`iam/README.md`(17)）。
- 归档是终态：归档账号/角色不可登录、不可分配、不产生授权规则；不做物理删除与恢复。
- owner 语义同时存在于 Todo 对象授权：跨 actor 与不存在对象使用相同 Not Found（`todo/README.md`(28)）。

### 4.6 API-Token scope 模型（080）

- 权限知情创建：创建时服务端实时投影创建者有效权限（`creatorOwnedPermissions`），强制 `scopes ⊆ 创建者权限`，越权返回 403 `api_token_scope_not_owned`（`service/service.go`(1995-2003)）。
- 授权按令牌自身 scope 生效，不自动收缩（治理=禁用/轮换/吊销）；不替代 Session。
- 状态机：active/disabled/expired/revoked（`disabled_at`/`description` 列，migration 000008）；secret 只存 sha256、明文仅创建/轮换一次。
- 解析：Bearer 链上 IAM `ResolveApiToken` 适配为 Auth `CredentialVerifier`（`identity_access.go`(191-219)），解析为 token-scopes Principal；任何失败统一 401。

### 4.7 权限键目录（全量，23 键）

汇总点：`internal/permission/catalog.go`（BuildCatalog 校验唯一 owner + 无通配符）、`internal/composition/http_contracts.go`(49-55)。

| 模块 owner | 权限键 | 用途（operation 证据） |
| --- | --- | --- |
| auth | `management:read` | ops.diagnostics / ops.metrics（`composition/service.go`(221-222)） |
| auth | `auth:audit:read` | auth.audit.list |
| iam | `iam:account:self:read` | iam.session.read、iam.sessions.list、iam.logout、iam.self.mfa.status |
| iam | `iam:account:self:password:write` | iam.self.password.change、iam.self.mfa.begin/confirm/disable |
| iam | `iam:account:self:profile:write` | iam.self.profile.update |
| iam | `iam:account:self:archive` | iam.self.archive、iam.self.archive.confirm |
| iam | `iam:account:read` | iam.accounts.list、iam.accounts.roles.read |
| iam | `iam:account:write` | iam.accounts.create/update/archive/password.reset/status、iam.accounts.roles.replace、**iam.sessions.revoke** |
| iam | `iam:role:read` | iam.roles.list、iam.roles.permissions.read、iam.roles.accounts.list |
| iam | `iam:role:write` | iam.roles.create/update/archive、iam.roles.permissions.replace |
| iam | `iam:permission:read` | iam.permissions.list、iam.permissions.roles.list |
| iam | `iam:session:read` | 【观察】目录中已声明但**无任何 HTTP operation 以其为 enforce scope**；文档（`runtime-capabilities.md`、`api/README.md`）声称会话管理用 `iam:session:read/revoke`，代码实际 enforcement scope 是 `iam:account:self:read`（列表/读取）与 `iam:account:write`（吊销） |
| iam | `iam:session:revoke` | 同上【观察】 |
| iam | `iam:api-token:read` | iam.api-tokens.list |
| iam | `iam:api-token:write` | iam.api-tokens.create/update/rotate/disable/enable/revoke |
| navigation | `navigation:menu:read` | navigation.menus.list |
| navigation | `navigation:menu:write` | navigation.menus.update |
| organization | `organization:department:read` | departments.list/tree、assignments.get |
| organization | `organization:department:write` | departments.create/update、assignments.replace |
| organization | `organization:position:read` | positions.list |
| organization | `organization:position:write` | positions.create/update |
| todo | `todos:read` | listTodos、getTodo |
| todo | `todos:write` | createTodo、completeTodo |

## 5. 业务能力清单（operation → 权限键 → 说明）

数据来源：`api/openapi.yaml`（55 个 operation）与 `internal/transport/http/api/operation_inventory.gen.go`（scope/action 权威映射）。按模块分组。

### 5.1 Auth（1 个 operation）

| operation | 方法/路径 | scope | 说明 |
| --- | --- | --- | --- |
| auth.audit.list | GET /api/v1/auth/audit | auth:audit:read | 低敏审计查询；过滤：operation/action/outcome/actorKind/subjectHash/resourceType/since/until；分页 offset/limit；同时承载 065 业务操作审计事件（IAM/Organization/Navigation 写操作经窄 port 注入同一审计面）；subject/resource 只返回摘要（`AuditEventViewResponse`：subjectHash/resourceHash） |

### 5.2 IAM（39 个 operation）

**引导与登录（公开，SecurityNone）：**
- iam.setup POST /api/v1/iam/setup — 首次 owner 初始化（setupToken + 账号创建，返回 Session+Cookie）
- iam.login POST /api/v1/iam/login — 账密登录；锁定返回 429 account_locked；MFA 已绑定时返回 409 mfa_required + challengeId
- iam.login.mfa-verify POST /api/v1/iam/login/mfa-verify — TOTP/恢复码第二步（public）

**会话自服务（webuiSession）：**
- iam.session.read GET /api/v1/iam/session — 当前身份+权限投影+轮换 CSRF；scope `iam:account:self:read`
- iam.logout POST /api/v1/iam/logout — 吊销当前会话、清 Cookie；scope `iam:account:self:read`
- iam.sessions.list GET /api/v1/iam/sessions — 会话分页列表（IDHash 摘要），status=all/active/revoked 过滤，可选 accountId；scope `iam:account:self:read`
- iam.sessions.revoke POST /api/v1/iam/sessions/revoke — 按 IDHashes 批量吊销；scope `iam:account:write`（见 4.7 观察）

**账号管理（webuiSession）：**
- iam.accounts.list GET /api/v1/iam/accounts — 分页 + query/status/archived/roleId typed 过滤（`repo.AccountFilter`）；scope `iam:account:read`
- iam.accounts.create POST /api/v1/iam/accounts — 创建账号（密码受 `iam.local.passwordPolicy` 约束）；scope `iam:account:write`
- iam.accounts.update PATCH /api/v1/iam/accounts/{id} — 改名（expectedAccountVersion 乐观锁，冲突 409）；scope `iam:account:write`
- iam.accounts.status PATCH /api/v1/iam/accounts/{id}/status — active/disabled 切换；scope `iam:account:write`
- iam.accounts.archive POST /api/v1/iam/accounts/{id}/archive — 归档（终态，撤销会话）；scope `iam:account:write`
- iam.accounts.password.reset POST /api/v1/iam/accounts/{id}/password-reset — 管理员重置密码（必须改密标记）；scope `iam:account:write`
- iam.accounts.roles.read GET /api/v1/iam/accounts/{id}/roles — 账号角色快照（entity version + authorizationRevision）；scope `iam:account:read`
- iam.accounts.roles.replace PUT /api/v1/iam/accounts/{id}/roles — 全量替换角色（expectedAccountVersion，返回 added/removed）；scope `iam:account:write`

**角色与权限（webuiSession）：**
- iam.roles.list GET /api/v1/iam/roles — 分页 + query；scope `iam:role:read`
- iam.roles.create POST /api/v1/iam/roles — scope `iam:role:write`
- iam.roles.update PATCH /api/v1/iam/roles/{id} — 名称/描述（展示字段，expectedRoleVersion）；scope `iam:role:write`
- iam.roles.archive POST /api/v1/iam/roles/{id}/archive — 归档（走完整授权发布链路）；scope `iam:role:write`
- iam.roles.permissions.read GET /api/v1/iam/roles/{id}/permissions — 角色权限快照（roleVersion + authorizationRevision）；scope `iam:role:read`
- iam.roles.permissions.replace PUT /api/v1/iam/roles/{id}/permissions — 全量替换 PermissionKeys（expectedRoleVersion）；scope `iam:role:write`
- iam.permissions.list GET /api/v1/iam/permissions — 权限目录（按 OwnerModuleID 分组的完整清单，无分页）；scope `iam:permission:read`
- iam.roles.accounts.list GET /api/v1/iam/roles/{id}/accounts — 影响分析：角色→持有账号（分页）；scope `iam:role:read`
- iam.permissions.roles.list GET /api/v1/iam/permissions/roles?key= — 影响分析：权限键→使用角色（分页）；scope `iam:permission:read`

**自服务 profile/软注销/MFA（webuiSession）：**
- iam.self.profile.update PATCH /api/v1/iam/self/profile — nickname/bio/birthDate（expectedVersion 乐观锁，不撤销会话）；scope `iam:account:self:profile:write`
- iam.self.password.change POST /api/v1/iam/self/password — 改密（current+new）；scope `iam:account:self:password:write`
- iam.self.archive POST /api/v1/iam/self/archive — 软注销第一步，返回 confirmationId；scope `iam:account:self:archive`
- iam.self.archive.confirm POST /api/v1/iam/self/archive/confirm — 第二步确认（归档+吊销会话）；scope `iam:account:self:archive`
- iam.self.mfa.status GET /api/v1/iam/self/mfa — registered 布尔；scope `iam:account:self:read`
- iam.self.mfa.begin POST /api/v1/iam/self/mfa — 返回 secret/URI（TOTP 绑定预览）；scope `iam:account:self:password:write`
- iam.self.mfa.confirm POST /api/v1/iam/self/mfa/confirm — 确认绑定，返回恢复码；scope `iam:account:self:password:write`
- iam.self.mfa.disable POST /api/v1/iam/self/mfa/disable — 解绑（需当前 TOTP 码）；scope `iam:account:self:password:write`

**API-Token 管理（webuiSession，080）：**
- iam.api-tokens.list GET /api/v1/iam/api-tokens — 当前账号令牌列表，status=active/disabled/expired/revoked/all 过滤；scope `iam:api-token:read`
- iam.api-tokens.create POST /api/v1/iam/api-tokens — 权限知情创建（scope ⊆ 创建者权限）；scope `iam:api-token:write`
- iam.api-tokens.update PATCH /api/v1/iam/api-tokens/{id} — 名称/描述/过期/neverExpires；scope `iam:api-token:write`
- iam.api-tokens.rotate POST /api/v1/iam/api-tokens/{id}/rotate — 轮换（明文一次）；scope `iam:api-token:write`
- iam.api-tokens.disable / enable / revoke POST — 状态机迁移；scope `iam:api-token:write`

### 5.3 Organization（9 个 operation，全部 webuiSession）

| operation | 方法/路径 | scope | 说明 |
| --- | --- | --- | --- |
| organization.departments.list | GET /api/v1/organization/departments | organization:department:read | 分页 + activeOnly/query |
| organization.departments.tree | GET /api/v1/organization/departments/tree | organization:department:read | 部门无环树 |
| organization.departments.create | POST /api/v1/organization/departments | organization:department:write | code/name/parentId |
| organization.departments.update | PATCH /api/v1/organization/departments/{id} | organization:department:write | 引用保护（子存在/归档限制） |
| organization.positions.list | GET /api/v1/organization/positions | organization:position:read | 分页 + activeOnly/query |
| organization.positions.create | POST /api/v1/organization/positions | organization:position:write | code/name |
| organization.positions.update | PATCH /api/v1/organization/positions/{id} | organization:position:write | 引用保护 |
| organization.assignments.get | GET /api/v1/organization/accounts/{id}/assignment | organization:department:read | 账号部门/岗位分配（含 version） |
| organization.assignments.replace | PUT /api/v1/organization/accounts/{id}/assignment | organization:department:write | 全量替换，expectedVersion 乐观锁（`organization_account_departments.version`，冲突 409 `conflict`） |

mutation（create/update/replace）均需 `Origin` + `X-CSRF-Token`（composition IAM 守卫）。

### 5.4 Navigation（2 个 operation，webuiSession）

| operation | 方法/路径 | scope | 说明 |
| --- | --- | --- | --- |
| navigation.menus.list | GET /api/v1/navigation/menus | navigation:menu:read | 静态定义+策略合并视图（enabled/parent/order/overridden/version） |
| navigation.menus.update | PUT /api/v1/navigation/menus/{id} | navigation:menu:write | 策略修改（enabled/parentOverride/orderOverride/version 乐观并发，`ErrConflict` 409；`ErrCatalogChanged`/`ErrCycle`/`ErrInvalidParent`）；返回 NavigationRevision；需要 Origin+CSRF |

- NavigationRevision 是对同一 Catalog revision 的策略快照 SHA-256（`internal/webui/contract.go`(638-690)；保存菜单后宿主 `refreshManifest` 刷新 manifest）。
- 首版每次 Manifest 请求读取一致策略快照，无 cache/watcher。

### 5.5 Todo（4 个 operation，Bearer profile，保留作参考）

| operation | 方法/路径 | scope | 说明 |
| --- | --- | --- | --- |
| listTodos | GET /api/v1/todos | todos:read | 按 owner 与 status 分页 |
| createTodo | POST /api/v1/todos | todos:write | title 校验 `todo.titleMaxRunes` |
| getTodo | GET /api/v1/todos/{id} | todos:read | owner 授权；跨 actor 与不存在对象同 Not Found |
| completeTodo | PATCH /api/v1/todos/{id}/complete | todos:write | 幂等完成；Version 并发冲突保护 |

### 5.6 Ops 管理面（非 openapi.yaml；见第 8 节）

### 5.7 Settings / OpenAPI / WebUI 宿主能力

- Settings：8 分区页面（Profile/Account/Security/Appearance/Notifications/Language/About/Acknowledgement），**无后端 operation**；Profile/Account/Security 复用 IAM HTTP（跨模块调用先例：Organization 调 IAM accounts）；Appearance/Notifications/Language 为前端偏好（localStorage/i18n）。语义：settings 页面的「自服务」边界 = 后端只提供 IAM 能力，页面本身不进 operation inventory。
- OpenAPI：单路由 `/openapi`，访问门槛 ViewOperationID=`iam.session.read`；在线调试使用同源 fetch（bearer 内存 token/WebUI Session Cookie+CSRF/mock 禁用）；契约快照 `webui/src/generated/openapi-spec.ts` 由 `cmd/app webui generate` 渲染，构建期 `--check` 防漂移（`api/README.md`(21)）。
- WebUI 宿主：`GET /api/v1/webui/manifest`（`internal/composition/service.go`(164-168)）返回 Manifest（catalogRevision/navigationRevision/routes/menu/zones/actionPermissions）；manifest 端点**不在 openapi.yaml 中**（属内部 WebUI 契约，security 由同一 Auth policy 门禁）。

## 6. 数据模型与迁移集

迁移集唯一汇总点：`internal/composition/migration.go`(37-54)，5 个 set（auth/iam/organization/navigation/todo）；版本表各模块独立（`*_schema_migrations`）。三驱动 SQL（mysql/postgres/sqlite）由 `pkg/database/migrate` 通用 adapter 执行。

【文档漂移观察】`internal/module/migration/README.md`(15) 称「当前生产 Catalog 包含 IAM 与 Todo」，与 `internal/composition/migration.go` 注册 5 个 set（含 auth/organization/navigation）冲突；以代码为准（README 可能过时）。

### 6.1 IAM（8 个迁移，000001..000008）

| 迁移 | 表/列 | 说明 |
| --- | --- | --- |
| 000001 | iam_accounts、iam_local_credentials、iam_roles、iam_account_roles、iam_role_permissions、iam_sessions | 基表；sessions 存 id_hash/csrf_hash/security_revision/过期 |
| 000002 | iam_authorization_state | 单行（id=1）authorization revision |
| 000003 | iam_accounts.archived | 账号归档终态列 |
| 000004 | iam_accounts.nickname/bio/birth_date | profile |
| 000005 | iam_local_credentials.password_changed_at、iam_password_history | 口令治理（历史只存哈希） |
| 000006 | iam_api_tokens | token_hash/scopes/expires_at/revoked_at |
| 000007 | iam_sessions.mfa_verified、iam_totp_secrets、iam_mfa_recovery_codes | MFA/TOTP |
| 000008 | iam_api_tokens.description/disabled_at | API-Token 状态机扩展 |

### 6.2 Auth / Organization / Navigation / Todo

- Auth：`auth_audit_events`（occurred_at/operation/action/actor_kind/subject_hash/resource_type/resource_hash/decision/outcome，occurred DESC 索引），000001（`auth/binding/migration/mysql/000001_create_auth_audit_events.up.sql`）。
- Organization：`organization_departments`（parent_id 自引用、ON DELETE RESTRICT）、`organization_positions`、`organization_account_departments`（000002 加 version 乐观锁列）、`organization_account_positions`。
- Navigation：`navigation_menu_policies`（navigation_id 主键、enabled、parent_override、order_override、catalog_revision、version）。
- Todo：`todos`（owner_subject、status、version、status/owner 索引）。

## 7. 对外契约

### 7.1 operation 总量与分组

- **55 个 operation / 46 个路径**（`api/openapi.yaml`；方法分布：GET 19、POST 24、PATCH 8、PUT 4）。
- 分组（tags）：Auth 1、IAM 39、Organization 9、Navigation 2、Todo 4。
- 前缀统一 `/api/v1/`；WebUI manifest `GET /api/v1/webui/manifest` 不在 openapi.yaml（内部契约）。
- 契约生成链：模块自有 typed 声明（`binding/http/huma.go`）→ `internal/tools/contract-gen`（`go generate ./...`）→ `api/openapi.yaml` + `internal/transport/http/api/operation_inventory.gen.go`；Go 代码是唯一权威，openapi.yaml 是产物；CI 以 `oasdiff breaking` 对照基线（`api/README.md`）。
- 运行时路由单一 owner：`internal/transport/http`（Huma → chi；operation gate 统一执行认证+授权；Huma 校验错误转项目 Problem）。

### 7.2 统一错误语义（RFC 9457 Problem Details）

- 媒体类型 `application/problem+json`；字段 `type`（`urn:clouddrive:problem:<code>`）、`title`、`status`、`detail`、`instance`、`code`、`violations`（`pkg/httpx/problem.go`(21-30)）。
- 稳定错误码（代码证据）：
  - `unauthenticated` 401（gate/路由绑定）
  - `permission_denied` 403（受保护 operation 不满足 scope/RBAC）
  - `csrf_invalid` 403（composition 跨模块 mutation 守卫：origin 缺失/不允许/token 无效）
  - `csrf_rejected` 403、`origin_rejected` 403（IAM requireMutation/requireOrigin）
  - `api_token_scope_not_owned` 403（token scope 越权）
  - `account_disabled` 403、`mfa_required` 409、`invalid_credentials` 401、`account_locked` 429（`iam/binding/http/contract.go`(301-323)）
  - `conflict` 409（覆盖 expectedVersion 乐观锁 `ErrVersionConflict`、owner 不变量、未知权限、重复、口令复用、api token 上限等）
  - `not_found` 404（`repo.IsNotFound`；对象授权与不存在同语义）
  - `invalid_request` 400、`invalid_json` 400、`unsupported_media_type` 415、`request_body_too_large` 413、`route_not_found` 404、`method_not_allowed` 405、`request_timeout` 504、`request_canceled` 408、`internal_server_error` 500
- 429 响应带 `Retry-After`（`problem.go`(106-110)）。

### 7.3 分页与过滤约定

- 分页：`offset`（min 0，默认 0）+ `limit`（min 1，max 100，默认 20）；响应 envelope `{items, offset, limit, total}`（`contract.go`(159-164)）；审计/会话/API-token 等列表同构。
- 过滤：账号列表 query/status/archived/roleId typed 白名单（Count/List 同条件）；API-token status（active/disabled/expired/revoked/all）；会话 status（all/active/revoked）；审计 operation/action/outcome/actorKind/subjectHash/resourceType/since/until；Organization activeOnly/query。
- 不做任意表达式过滤（typed 白名单）。

### 7.4 认证组合（security profile）

- `none`（public）：iam.setup、iam.login、iam.login.mfa-verify（均要求 Origin 头）。
- `bearerAuth`：Todo 4 个 operation（JWT 或 API-Token 链 verifier）。
- `webuiSession`：其余全部 operation（Cookie `__Host-community-go_iam_session` → IAM Session → iam-rbac Principal → DecisionPoint RBAC）。
- mutation 一律要求 `Origin` + `X-CSRF-Token`（webuiSession profile 下；Todo 的 POST/PATCH 经 bearerAuth 无 CSRF）。
- 菜单隐藏不等于授权：manifest 投影做呈现门禁，服务端 operation 授权独立执行（`api/README.md`(31)）。

## 8. 管理端点与诊断

- 提供者：`internal/module/ops`（facade 绑定 `binding/http/handler.go`）+ composition runtime 采样（`internal/composition/ops.go`）+ `pkg/observability`/`internal/kernel/app/observability`。
- 独立管理 listener（默认 `127.0.0.1:9090`）；模式 B（webui.hosting.enabled）下业务 listener 挂载同一受保护 facade `/management/*`，供托管 WebUI 同源读取（`composition/service.go`(169-182)）。
- 端点（`ManagementRoutePaths`，`ops/binding/http/handler.go`(25-27)）：

| 端点 | 语义 | 鉴权 |
| --- | --- | --- |
| GET /management/startupz | 首次 generation commit 后 pass | 公开（probe） |
| GET /management/livez | 进程仍可治理生命周期 | 公开 |
| GET /management/readyz | generation admission + Auth verifier Ready + Database ping + scheduler 策略（严格任务 pause/fail 阻止 ready，skip/local 以 degraded 呈现） | 公开 |
| GET /management/build | version/commit/buildTime/goVersion/dirty（构造时冻结） | 公开 |
| GET /management/diagnostics | typed 脱敏 RuntimeSnapshot（Process/GGeneration/Supervisor Units/Scheduler/Messaging/Telemetry/ProcessSsnapshot） | 始终需要 `management:read`（403 Problem otherwise） |
| GET /management/metrics | Prometheus 文本（Go/Process collector：go_goroutines、process_resident_memory_bytes、process_start_time_seconds 等） | 按 `management.metricsAccess`：disabled=不注册、public=公开、protected=`management:read` |

- 无 `/debug/pprof/*`（未注册）。响应统一 `Cache-Control: no-store`、`X-Content-Type-Options: nosniff`。
- OS 级（CPU/磁盘/网络）指标由宿主机 Prometheus node-exporter 补齐（文档指引，非后端提供，见 `runtime-capabilities.md`(12)）。
- 081 持久监听可视化：Dashboard 页「监控」分区 = 进程/组件状态卡 + 滚动窗口时序报表（自研 SVG Sparkline/LineChart），数据来自 /management/diagnostics 与 /metrics（前端侧能力，后端只提供端点）。

## 9. 配置与可配置项（与 WebUI 相关）

来源：`config.example.yaml`、`internal/webuihost/config.go`、`internal/module/{auth,iam,ops}/binding/config/*.go`。

| 配置节 | 字段 | 说明/默认 |
| --- | --- | --- |
| `webui.hosting` | enabled（默认 true=模式 B）、dir（默认 `./webui/dist`）、buildScript（默认 `webui/scripts/build-webui.mjs`）、buildRuntime（node/bash）、buildTimeout（10m） | Go 服务托管/分离开发双模式；development 缺产物启动前自动构建，production 缺产物快速失败（`webuihost/config.go`(50-83)） |
| `iam.local` | setupToken、idleTimeout（30m）、absoluteTimeout（12h）、maxFailedAttempts（5）、lockDuration（15m）、passwordPolicy{minLength 15/maxLength 128/requireComplexity false/historySize 0/maxPasswordAge 0s}、maxSessionsPerAccount（0=不限）、apiTokenMaxPerAccount（5）、apiTokenDefaultTTL（0=永不过期） | `iam.local` 管理 setup/lockout/Session budget/口令治理/令牌配额（`iam/README.md`(38)、`config.example.yaml`(229-252)） |
| `auth` | mode（development-anonymous/jwt）、anonymousSubject/Scopes（默认 `[management:read, todos:read, todos:write]`）、jwt{issuer/audience/jwksURL/algorithms RS256/scopesClaim scope/超时预算} | production 强制 jwt + HTTPS JWKS；development-anonymous 限定 loopback+development（`auth/binding/config/config.go`(102-127)） |
| `management` | addr（127.0.0.1:9090）、超时/限额、metricsAccess（disabled/public/protected，默认 public） | 独立 listener 安全预算（`ops/binding/config/config.go`(65-75)） |
| `http` | rateLimit（local 默认，requestsPerSecond 100/burst 200，routes 路径级覆盖——登录/setup 可更严）、cors.allowedOrigins（默认 Vite 本地 Origin 列表）、maxInFlight、trustedProxyCIDRs 等 | 登录限流（IP 维度）+ 账号级锁定构成双维度（077） |
| `alerting` | enabled（默认 false）、webhookUrl、signingKey、重试/队列 | 079 安全告警 |
| `observability`/`scheduler`/`messaging`/`execution`/`cache`/`storage`/`i18n` | 对应平台能力配置 | 与 WebUI 无直接契约 |

## 10. 适用/不适用场景

**适用**：
- WebUI 产品架构重构的后端能力基线（页面→operation→权限键映射的唯一事实来源）；
- 管理控制台页面与后端能力的映射（本档案第 5 节可直接转化为页面数据需求）；
- 权限目录审计、前端动作权限钩子（ActionPermissions/Zone OperationID）与真实 enforce scope 的核对。

**不适用**：
- 外部系统接入评估（无外部契约兼容性承诺）；
- 历史 `old-backend/` 目录（已单轨退役，`migration.go` 中 `RetiredTables` 仅作 preflight 拒绝项）；
- 前端实现细节（HeroUI 组件、布局动画等产品呈现决策）；
- 多实例/分布式部署形态评估（后端管理面与监控数据只为单进程视角）。

## 11. 局限

- 以静态代码/生成物/文档为证据，未启动进程做运行时验证（未运行 `go generate`、`oasdiff`、Go 测试、Playwright/E2E）。
- 未逐行核对 `organization/service` 与 `navigation/repo` 的全部错误路径（引用保护、父级周期等边界以 README/handler 证据为准）。
- 审计过滤 `since/until` 的解析格式（如 RFC 3339）未在代码中确认边界。
- 文档与代码冲突处（migration README、session 权限键、cookie 名）已记录，但未追查历史变更记录确认其成因。

## 12. 剩余未知

- 会话列表 `accountId` 参数的管理员语义边界：`iam.sessions.list`/`iam.sessions.revoke` 的 enforce scope 是 self-read/account-write，服务层是否对不同账号查询做额外 owner 校验未逐行确认（handler 按 `SessionFromContext` 回退当前账号，但显式 accountId 路径的授权细节需读 `service.ListSessions`/`RevokeSessions` 确认）。
- `expectedVersion` 冲突的确切 HTTP 呈现（同 409 `conflict`）已在 `contract.go` 确认；Navigation `ErrCatalogChanged` 的稳定错误码未在 `navigation/binding/http` 中逐条确认（其 handler 经 `httpx.NewProtocolProblemError` 呈现）。
- `webuihost` 的 SPA fallback 排除前缀清单在 composition 中的最终装配（`/assets` immutable 缓存头等）以 `spa.go` 与 `service.go` 为准，未运行验证。

## 13. 对当前任务（WebUI 产品架构重构立项）的影响

1. **后端能力是确定性的、可枚举的**：55 个 operation + 23 个权限键 + 1 个 manifest 端点 + 6 个 management 端点构成全部后端事实来源；WebUI 产品架构重构可以 operation 清单为基线建立「页面 ↔ operation ↔ 权限键 ↔ ViewOperationID/ActionPermission」映射表，本档案第 5、4.7 节可直接引用。
2. **权限键与 enforcement scope 存在文档/代码漂移**：`iam:session:read/revoke` 已声明未使用；会话管理实际按 self-read/account-write 生效。重构时前端权限呈现（如会话页按钮显隐）应绑定 operation 的真实 scope，而不是目录键名。
3. **Settings/OpenAPI 是纯前端模块**：后端不提供专用 operation，重构不得为这些页面臆造后端能力；其数据边界 = IAM HTTP + manifest + management 端点。
4. **mutation 契约是硬约束**：所有管理控制台写操作需 `Origin` + `X-CSRF-Token`（webuiSession profile），且 IAM 会话读取会轮换 CSRF；前端请求库必须按此组合建模，不能只用 Bearer。
5. **Session Cookie 名以运行时为准**：`__Host-community-go_iam_session`（非 OpenAPI 声明的 `go_scaffold_session`）；重构时凭据模型应以运行时 Cookie 名 + go_scaffold_session 仅为 OpenAPI 声明做兼容说明。
6. **管理模式 B 依赖固定路径语义**：`/management/*` facade 供同源读取（diagnostics 需 `management:read`，metrics 按 metricsAccess），托管 WebUI 的监控页可直接消费，无需新后端。
7. **Todo 不在管理控制台范畴**：其 4 个 operation 为学习切片参考，重构时按「保留现状」处理，不必纳入产品能力基线。

---

### 事实/推断标注说明

- 本档案正文全部为【事实】（可复核的代码/生成物/已发布文档引用）；未标注段落的推断（如第 13 节影响判断）已明确以结论性措辞给出并标注依据。
- 【文档漂移观察】条目为代码与文档的冲突记录，结论以代码为准。
- 未做运行时验证的结论见第 11、12 节，不作为已实现事实使用。