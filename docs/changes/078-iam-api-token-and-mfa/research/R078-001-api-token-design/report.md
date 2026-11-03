# R078-001 研究报告：API-Token 闭环设计

## 1. 研究问题

在既有 IAM（身份/凭据/会话）+ Auth（认证/授权/审计）边界内，API-Token 机器访问能力应如何设计：凭据模型、认证来源接入、管理面 HTTP、权限与审计，以及新增权限键的必要性。

## 2. 事实（代码证据，commit `edc8151`）

- **凭据现状**：`iam_local_credentials` 仅承载密码（Argon2id）；CLI/development 用 `LocalPrincipal`；Auth JWT verifier（JWKS）支持外部签发的 token-scopes Principal（`internal/module/auth/adapter/jwt`、`model.NewPrincipal(subject, ActorService, scopes,...)`）。
- **认证链现状**：`middleware.Source.AuthenticateRequest`（Bearer 头）→ `authService.Authenticate` → 单一 `CredentialVerifier.Verify`；`composition` 把 IAM Session 适配为 `iam-rbac` 来源，Bearer 来源目前只有 JWT 或 development 单 profile。
- **授权路径**：token-scopes Principal 经 `auth.service.decide` 的 `HasScope` 精确判断直接授权（`model.AuthorizationTokenScopes`），operation gate 现有路径完全可用——**API-Token 认证后授权无需任何改动**。
- **审计**：认证事件与业务写操作审计已有（064/065）；新增能力必须接入既有低敏审计面（077 决策 4 先例）。

## 3. 设计（推荐）

### 3.1 凭据模型（IAM module，migration 000006）

```
iam_api_tokens:
  id          TEXT PRIMARY KEY            -- idgen UUID（吊销/标识用）
  account_id  TEXT NOT NULL FK accounts   -- owner
  name        TEXT NOT NULL               -- 管理标识
  token_hash  TEXT NOT NULL UNIQUE        -- sha256(token secret)
  scopes      TEXT NOT NULL               -- JSON（稳定排序的精确 scope 集合）
  expires_at  DATETIME NULL               -- NULL=永不过期
  revoked_at  DATETIME NULL
  created_at  DATETIME NOT NULL
  last_used_at DATETIME NULL
```

- secret：`crypto/rand` 32 字节 → `iam_` 前缀 + base64url 无 padding（高熵，sha256 存储足够安全；不做 Argon2id，避免非交互凭据的无谓成本）。
- **明文只在创建/轮换响应返回一次**，之后任何读取只返回 hash 摘要管理视图。

### 3.2 认证来源（Auth 侧复合 verifier）

- `auth` 扩展 `CredentialVerifier` 组合：`ChainVerifier`（多个 verifier 顺序尝试，首个成功返回 Principal；全部失败 `ErrUnauthenticated`），development 与 JWT 语义保持。
- composition 把 IAM 的 API Token 窄 facet（`ResolveApiToken(ctx, hash) → (accountID, scopes, expiry)`）适配为 `authservice.CredentialVerifier`：`value` 剥 `iam_` 前缀 → sha256 → 查库 → 校验未吊销/未过期 → `model.NewPrincipal(accountID, ActorService, scopes, now, now)`。
- 装配：`ChainVerifier{JWT verifier(可选), apiTokenVerifier}` 作为 bearerSource 的 verifier；Bearer 头语义不变（OpenAPI `bearerAuth` 兼容，无新 security scheme）。

### 3.3 管理面 HTTP（IAM module，权限键为新增）

| Operation | 方法/路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| `iam.api-tokens.list` | GET `/api/v1/iam/api-tokens` | `iam:api-token:read` | 分页列表（不含明文） |
| `iam.api-tokens.create` | POST `/api/v1/iam/api-tokens` | `iam:api-token:write` | 返回明文 secret 一次 |
| `iam.api-tokens.rotate` | POST `/api/v1/iam/api-tokens/{id}/rotate` | `iam:api-token:write` | 旧 secret 立即失效，返回新明文 |
| `iam.api-tokens.revoke` | POST `/api/v1/iam/api-tokens/{id}/revoke` | `iam:api-token:write` | 终态吊销 |

- **新增权限键必要性**：API-Token 是新的可独立授权的管理面能力；复用 `iam:account:write` 会与技术员无账号写权限却需管理自己的 token 冲突。Catalog 新增 `iam:api-token:read/write`（owner=iam）是本能力的正常授权域扩展（R077-002 已预告）。
- 作用域语义：token 的 scopes 必须是 Catalog 内已知精确 scope（复用 `permissioncatalog.ValidateReferences` 校验？scope 是 operation policy 的 scope，create 时校验存在于 catalog 的策略 scope 集合——沿用 `ErrUnknownPermission` 语义）。

### 3.4 审计（复用既有低敏面）

- 创建/轮换/吊销：`auditOperation`（`iam.api-tokens.*`），**不记录明文 secret**。
- 认证成功/失败：Auth 既有认证审计路径（含 subject）。

### 3.5 WebUI（范围待确认）

- 最小闭环：API 面完整；WebUI 并入 IAM 安全/账号管理页的新「API 令牌」区块（列表/创建一次显示/轮换/吊销），或单独页面。
- 可选范围二：仅 API 闭环（079 再做 UI）。

## 4. 失败语义

- 未知/吊销/过期 token：401（与 JWT 一致）；scope 不足：403（token-scopes 直判路径既有）。
- 创建时未知 scope/过期时间非法：400/409 稳定错误码。
- 轮换/吊销不存在 id：404；并发轮换以 id 幂等约束（唯一 token_hash）。

## 5. 适用 / 不适用

- 适用：机器到服务、CI/CD、脚本与跨服务调用；与外部 JWT 并存（复合 verifier）。
- 不适用：代替 IAM Session（会话语义不变）；承载数据权限/ABAC（scope 仍为精确键）。

## 6. 对本任务的影响

API-Token 为 078 的推荐实施范围；设计闭环（发证→使用→轮换→吊销→审计）可行，工作量 M，落在 IAM+Auth 边界内，唯一扩展点是新权限键（需求阶段需用户确认）。