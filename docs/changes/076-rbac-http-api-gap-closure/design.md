# 076 设计方案：RBAC / HTTP API 未闭环缺口修复

## 1. 背景与目标形态

058/054 已建立「账号—角色—权限键 Core RBAC」闭环，066 补齐生命周期与 WebUI 交互，064 补齐审计与会话管理。本批修复管理面五个未闭环/缺口：org 认证断点（Gap1）、反向查询（Gap2）、会话分页（Gap3）、账号过滤（Gap4）、密码策略配置（Gap5）。全部落在既有 IAM/Organization/Auth 模块边界与既有机制内，不新增权限键、不改变授权 authority、不引入候选方向能力。

## 2. 方案对比

| 缺口 | 方案 | 结论 |
| --- | --- | --- |
| G1 | A（采纳）：org operation 单轨迁移 `webuiSession`；mutation 接 `iamMutationGuardAdapter`（对齐 navigation 先例，`composition/generation.go:509` 已装配 `mutationGuard`）；org 前端 mutation 补 Origin/X-CSRF-Token | 缺口真实（R076-001 §2.1）、owner 清晰、与其余模块完全同构；security profile 单一语义保持 |
| G1 | B（不采纳）：保留 `bearerAuth` 并为 gate/humabinding 增加多 security profile 支持 | 需扩展契约/gate/OpenAPI 多 security 语义，当前无 Bearer 机器访问 org 的真实消费方；契约从「单 profile」退化为「多 profile」，成本高、无收益证据 |
| G2 | A（采纳）：复用既有 repo 查询 + 新增两个只读 GET 端点（分页），权限复用 `iam:role:read`/`iam:permission:read` | 影响分析闭环；不新增权限键 |
| G2 | B（不采纳）：新增独立权限键（如 `iam:role:members:read`） | 无真实需求、违反「不新增权限键」稳定边界（066） |
| G3 | A（采纳）：repo 分页查询 + service offset/limit/status 过滤 + HTTP `pageInput`，真实 total | 契约与 accounts/roles 列表同构 |
| G3 | B（不采纳）：维持全量返回 | 会话数不可控、伪分页契约不可接受 |
| G4 | A（采纳）：repo Count/List 扩展 typed 过滤（status/archived/roleId），HTTP 扩展 query 参数 | List 与 Count 同语义，防翻页漂移 |
| G4 | B（不采纳）：透传任意过滤表达式/仅前端过滤 | 破坏 typed 契约或不安全/不可控 |
| G5 | A（采纳）：`iam.local.passwordPolicy` 配置（min/max 默认 15/128 + 复杂度开关默认 false），构造时冻结到 Service，model 参数化校验 | 默认值不变即存量兼容；开关默认关避免破坏存量密码 |
| G5 | B（不采纳）：每次校验读配置/DB；默认开启复杂度 | 破坏「Service 构造即冻结」语义；破坏存量账号兼容 |

## 3. 数据流与实现位置

### 3.1 Gap1：org 认证断点（REQ-076-001）

```
internal/module/organization/binding/http/huma.go
  organizationOperation / organizationJSONOperation
    Security: SecurityBearer  ->  SecurityWebUISession        // 读操作
    mutation operation（create/update/replace）额外挂 Middlewares:
      mutationMiddleware(guard)  // 对齐 navigation/huma.go:37 先例
```

- `navigation` 已示范模式：`HumaRegistration(operations, mutationGuard)`（`binding/http/huma.go:37`、`composition/generation.go:509`）；org 改为 `HumaRegistration(operations, mutationGuard)`，composition 传入既有 `identity.MutationGuard`（`generation.go:368` 已构造，目前只传给 navigation）。
- mutation 守卫语义复用 `iamMutationGuardAdapter.ValidateMutation`（`internal/composition/iam.go:77-95`）：Origin 同源/白名单 + Session + CSRF。
- 前端 `organization/binding/webui/web/api.ts`：mutation 请求头从 `json(...)` 扩展为 `mutationHeaders()` 模式（Origin + X-CSRF-Token，csrfToken 来源见 `iam/.../web/api.ts:12-15`；org 页面已有 session 上下文可复用 `@webui/sdk/runtime` 的 session/csrf 投影）。
- 生成物：`api/openapi.yaml` org 路径 security 由 `bearerAuth` → `webuiSession`（contract-gen 自动）；WebUI manifest/route 引用（`organization.departments.list` 等 ViewOperationID）不变。
- 失败语义：无 session → 401；有 session 无权限 → 403；mutation 缺 Origin/CSRF → 403 `csrf_invalid`（与 navigation 一致）。

### 3.2 Gap2：反向查询（REQ-076-002 / REQ-076-003）

```
repo.Unit（新增，或复用）：
  ListAccountRolesByRole(ctx, roleID)                    // 已存在（unit.go:244）
  ListRolePermissionsByKey(ctx, key, activeOnly)         // 新增：rolePermissionTable Where permission_key + active
  CountAccountRolesByRole(ctx, roleID, activeOnly)       // 新增：分页 total
  CountRolePermissionsByKey(ctx, key, activeOnly)        // 新增：分页 total

service：
  RoleAccountsSnapshot(ctx, roleID, offset, limit) (AccountListView, error)
    -> 校验角色存在（RoleByID）-> Count/List（join iam_account_roles active 关系 -> account 摘要）
  PermissionRolesSnapshot(ctx, key, offset, limit) (RoleListView, error)
    -> 校验 key 在 catalog（s.catalog.Lookup，未知 -> ErrUnknownPermission -> 404）
    -> Count/List（join active 关系 -> role 摘要）

HTTP：
  GET /api/v1/iam/roles/{id}/accounts   权限 iam:role:read      （roleID path 参数，分页 pageInput）
  GET /api/v1/iam/permissions/roles    ?key=<permissionKey>     （权限 iam:permission:read；key 含冒号用 query，
                                                                 分页 pageInput；未知 key -> 404）
```

- 账号摘要复用 `accountResponse`（不暴露凭据/哈希）；角色摘要复用 `roleResponse`。
- 只读查询不 bump revision、不产生业务操作审计。

### 3.3 Gap3：会话列表分页（REQ-076-004）

```
repo.Unit（新增）：
  CountSessionsByAccount(ctx, accountID, includeRevoked) (int64, error)
  ListSessionsByAccount(ctx, accountID, offset, limit, includeRevoked) ([]SessionRecord, error)
    // 保留 created_at DESC, id_hash ASC 稳定排序；includeRevoked=false -> revoked_at IS NULL

service.ListSessions(ctx, accountID string, offset, limit int, status SessionListStatus) (SessionList, error)
  // status: all|active|revoked；active = 未吊销 且 idle/absolute 未过期（服务端时钟判断）
  // 过期判断复用会话过期语义（idle/absolute 到期即视为不再 active，revoked 单独过滤）

HTTP GET /api/v1/iam/sessions：
  query: accountId（自服务缺省=当前账号）、offset、limit、status（enum all|active|revoked，默认 all）
  响应 listResponse[sessionInfoResponse]（真实 offset/limit/total；IDHash 摘要不变）
```

- 自服务/管理员双入口行为保留（`huma.go:277-300` 现有 accountId 空→当前账号逻辑）。
- 分页参数复用 `pageInput`（offset/limit）加 status 字段。

### 3.4 Gap4：账号列表多维过滤（REQ-076-005）

```
repo.Unit（重构 CountAccounts(Matching) / ListAccounts 为 typed filter）：
  type AccountFilter struct { Query string; Status *model.AccountStatus; Archived *bool; RoleID string }
  CountAccounts(ctx, filter) / ListAccounts(ctx, offset, limit, filter)
    // Query -> username/display_name LIKE（现状语义）
    // Status -> status = ? ；Archived -> archived = ?
    // RoleID -> EXISTS (SELECT 1 FROM iam_account_roles r WHERE r.account_id = iam_accounts.id
    //            AND r.role_id = ? AND r.active = 1)

service.ListAccounts(ctx, offset, limit, filter) // 透传

HTTP GET /api/v1/iam/accounts：
  query 增加：status（enum active|disabled，可选）、archived（bool，可选）、roleId（可选）
  响应/分页/排序（username ASC）不变；Count 与 List 同 filter
```

- 向后兼容：无过滤参数时行为与现状完全一致。
- 显式 typed struct 过滤，不引入任意表达式透传。

### 3.5 Gap5：密码策略配置（REQ-076-006）

```
configbinding.Config.Local 新增：
  PasswordPolicy struct {
    MinLength   int  `mapstructure:"minLength"`   // 默认 15
    MaxLength   int  `mapstructure:"maxLength"`   // 默认 128
    RequireComplexity bool `mapstructure:"requireComplexity"` // 默认 false
  }

Decode 校验：MinLength >= 1；MaxLength >= MinLength；MaxLength <= 既有上限（如 512 防御上限）；
  默认值经 Default() 与 defaults 输出到 config init 模板。

model：
  type PasswordPolicy struct { MinLength, MaxLength int; RequireComplexity bool }
  func ValidatePasswordWith(value string, policy PasswordPolicy) error   // 参数化：长度 + 可选复杂度
  func ValidatePassword(value string) error                              // 保留：用默认策略调用（兼容既有一致性）

service.Config 增加 PasswordPolicy 字段；New 构造时校验合法并冻结到 *Service；
  Setup/ChangePassword/ResetPassword/CreateAccount 四处 model.ValidatePassword 改为
  s.passwordPolicy 校验（service.Config.PasswordPolicy 或 Service 字段）。

配置示例/文档：config.example.yaml 与配置说明新增 iam.local.passwordPolicy 默认段。
```

- 复杂度规则（若开关开启）最小实现：必须同时含大写、小写与数字（中文字符按 rune 计数，复用现有 `len([]rune())` 语义）；实施前在计划确认范围。
- 兼容性：默认 15/128 与现状一致；存量配置缺省字段回退默认；开关默认关闭。

## 4. 失败语义、并发与审计

- Gap2-Gap4 纯只读：无事务、无 revision 影响；错误沿用 `serviceError` 映射（not_found 404、unknown key 404、分页非法 400）。
- Gap1 迁移只改认证 profile 与 mutation 守卫；业务错误、权限键、审计路径不变；CSRF 校验失败 403 与 navigation 一致。
- Gap5 配置非法在 `Decode`（配置加载期）失败，早于任何资源副作用（与既有安全预算校验一致）；运行时策略在 Service 构造期冻结。
- 全部新 operation 遵循「缺省拒绝」：权限不足 → 403 `permission_denied`。

## 5. 已确认决策

1. 全部 5 组缺口（G1-G5）纳入本批 `076` 实施。
2. G5 密码策略采用 `minLength`/`maxLength`/`requireComplexity`（默认 15/128/false）；`requireComplexity` 开启时最小规则集为「必须同时包含大写字母、小写字母与数字」（按 rune 计数）。
3. G1 org 认证单轨迁移 `webuiSession`，不保留 `bearerAuth` 机器访问 profile（当前无消费方）。
4. 会话 `status` 过滤语义：`active` = 未吊销且按服务端时钟未过 idle/absolute 过期；`revoked` = 已吊销；`all` = 不过滤（默认）。

## 6. 验证方案

1. Go 单元/集成：org security 迁移后 gate 行为（session 401/403、CSRF 缺失 403）；反向查询（分页、未知 key 404、权限拒绝）；会话分页/status 过滤（active 排除过期与吊销）；账号多维过滤 Count/List 一致性；密码策略（默认值、自定义 min/max、复杂度开关、配置非法拒绝、存量登录不受影响）。
2. 契约生成：`go generate ./...` 后 `api/openapi.yaml`（org security 变更 + 新 operation/参数）diff 稳定。
3. WebUI：org 页面 mutation 头（Vitest/mock 断言 X-CSRF-Token 存在）；Mode B 真实 e2e 验证 org 读写页闭环；既有页面无回归。
4. 文档：更新 `docs/operations/security.md`、`runtime-capabilities.md`、配置说明、模块 README、变更记录；docs-guard 全绿。