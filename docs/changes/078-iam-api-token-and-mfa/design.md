# 078 设计方案：API-Token 机器访问能力

## 1. 背景与目标形态

078 在 076/077 完成的管理面闭环上新增「机器访问」能力：API-Token 携带精确 scope、经既有 Bearer 认证与 token-scopes 授权直达业务 operation，管理面提供发证/轮换/吊销/审计。MFA/TOTP 完成选型归档（R078-002），实施边界清晰但不并入本批（除非用户确认）。

## 2. 方案对比

| 项 | 方案 | 结论 |
| --- | --- | --- |
| Token 凭据 | A（采纳）：新表 `iam_api_tokens`，secret 高熵随机、sha256 存储、明文仅一次 | 与密码凭据分离、不可逆、可吊销/轮换 |
| Token 存储 | B（不采纳）：复用 `iam_local_credentials` 加类型列 | 混淆凭据语义、迁移复杂 |
| 认证接入 | A（采纳）：Auth `ChainVerifier`（JWT→API-Token→development 语义保留），Bearer scheme 不变 | 最小侵入、无新 security scheme |
| 认证接入 | B（不采纳）：新增独立 security scheme/来源 | OpenAPI/gate 双路复杂度高、无需求 |
| 权限 | A（采纳）：新增 `iam:api-token:read/write`（owner=iam） | 新能力授权域必要扩展 |
| 权限 | B（不采纳）：复用 `iam:account:write` | 与技术员管理自己 token 的需求冲突 |
| MFA | A（R078-002）：自研 RFC 6238 | 标准可测、零依赖；实施独立 079（或用户确认并入） |

## 3. 数据流与实现位置

### 3.1 凭据模型（REQ-078-001，IAM module，migration 000006）

```
IAM 新增 repo：iam_api_tokens 表 + CreateApiToken/ListApiTokensByAccount/GetApiToken/FindApiTokenByHash/
UpdateApiToken/RevokeApiToken/TouchApiTokenUsage
service：
  CreateApiToken(ctx, accountID, name, scopes, expiresAt) (ApiTokenIssued{ID, Name, Scopes, ExpiresAt, Secret}, error)
    - scope 校验：全部 scopes ∈ catalog（ErrUnknownPermission）
    - secret = "iam_" + base64url(rand32)；token_hash = sha256(secret)
  ListApiTokens(ctx, accountID, offset, limit) ApiTokenList   // 不含 secret
  RotateApiToken(ctx, accountID, id) (ApiTokenIssued, error)   // 新 secret 替换 hash；旧立即失效
  RevokeApiToken(ctx, accountID, id) error                      // 终端
  ResolveApiToken(ctx, hash) (ApiTokenResolution, error)        // 认证用：账号ID/scopes/未吊销未过期
```

### 3.2 认证链（REQ-078-002，Auth + composition）

```
auth/service：新增 ChainVerifier struct{ verifiers []CredentialVerifier }
  Verify(ctx, credential) -> 顺序尝试；首个成功返回 Principal；全部失败 ErrUnauthenticated
composition：
  apiTokenVerifier = adapter{ resolve: iam API Token 窄 facet }
    Verify: 值剥 "iam_" 前缀 -> sha256 -> resolve -> model.NewPrincipal(accountID, ActorService, scopes, now, now)
  装配 bearer verifier = ChainVerifier{JWT(按模式), apiTokenVerifier}
  （development profile 语义不变：middleware 先查 Authorization 头，无头走 development）
```

### 3.3 管理面 HTTP（REQ-078-003/004，IAM binding/http）

```
opAPITokens        = "iam.api-tokens.list"
opAPITokenCreate   = "iam.api-tokens.create"
opAPITokenRotate   = "iam.api-tokens.rotate"
opAPITokenRevoke   = "iam.api-tokens.revoke"
路径均在 /api/v1/iam/api-tokens*，webuiSession + requireMutation（CSRF/Origin）
权限：list/read -> iamapipermission.ApiTokenRead；create/rotate/revoke -> ApiTokenWrite
响应：Issued 含 Secret 仅一次；List 为分页摘要（无 Secret）
```

- 权限键定义：`internal/module/iam/permission/keys.go` 增加 `ApiTokenRead/ApiTokenWrite`，`binding/permission/definitions.go` 登记（owner=iam），Catalog 自动进入 ReconcileOwnerCatalog（owner 自动获得）。
- operation inventory 与 `api/openapi.yaml` 经 contract-gen 重生成；`internal/composition/http_api_test.go` operation 计数更新（41→45）。

### 3.4 审计（REQ-078-005）

- `auditOperation(ctx, "iam.api-tokens.create|rotate|revoke", ...)`（resource=session? token id 摘要；不记录 Secret）。
- 认证成功/失败由 Auth 既有路径记录（失败含 subject 哈希）。

### 3.5 失败语义

- 未知/吊销/过期 token：Bearer 401（ChainVerifier 全失败）；scope 不足：403（token-scopes 既有）。
- 创建非法 scope/过期时间：400/409；轮换/吊销未知 id：404；重复创建同名：允许（id 唯一即可）。

## 4. 边界与安全牢记

- Secret 不进入日志/错误详情/审计/WebUI 持久化视图；创建/轮换响应的明文仅在内存中经过。
- `http.rateLimit.routes`（077）可对 `/api/v1/iam/api-tokens` 等施加路径限流（保护发证端点）。

## 5. 已确认决策

（待用户确认后填写；当前为推荐项。）

## 6. 验证方案

1. Go：secret 一次性与 hash 校验、scope 校验、轮换/吊销后认证失败、ChainVerifier 顺序（JWT→API-Token）、token-scopes 授权（403/允许）、审计事件（无明文）。
2. 契约：contract-gen golden / `api/openapi.yaml` / operation inventory / composition 测试计数。
3. WebUI（若计入）：安全页或账号页「API 令牌」区块；Vitest + e2e 覆盖创建一次显示/轮换/吊销；否则 API 闭环为限。（范围 D 待确认）
4. docs-guard、`go test ./...`、`go vet ./...` 全绿。