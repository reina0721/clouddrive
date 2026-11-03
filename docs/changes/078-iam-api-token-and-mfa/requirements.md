# 078 需求规格：API-Token 机器访问能力（+ MFA/TOTP 选型归档）

引用研究：[R078-001](research/R078-001-api-token-design/report.md)、[R078-002](research/R078-002-mfa-totp-selection/report.md)。

## 1. 目标

在既有 IAM+Auth 边界内实现 **API-Token**（机器访问凭据）完整闭环：发证→使用（Bearer 认证）→轮换→吊销→审计，权限独立授权（新增权限键）；同时完成 **MFA/TOTP** 技术选型与研究归档（RFC 6238 自研结论），其实施是否并入本批由用户确认。

## 2. 功能要求（推荐范围，待用户确认）

| ID | 要求 |
| --- | --- |
| `REQ-078-001` | **API-Token 凭据模型**：新增 `iam_api_tokens` 表（migration 000006）：id(UUID)、account_id(owner FK)、name、token_hash(sha256，唯一)、scopes(JSON 稳定排序)、expires_at(NULL=永不过期)、revoked_at、created_at、last_used_at；secret 为 `crypto/rand` 32 字节、`iam_` 前缀+base64url，**明文只在创建/轮换响应返回一次**，后续只提供摘要管理视图。 |
| `REQ-078-002` | **Bearer 认证链**：Auth 新增 `ChainVerifier`（多 verifier 顺序尝试），composition 把 IAM API Token 窄 facet 适配为 `CredentialVerifier`（sha256 查库、吊销/过期校验、返回 token-scopes Principal），与既有 JWT/development 语义并存；Bearer 头与 OpenAPI `bearerAuth` scheme 不变。 |
| `REQ-078-003` | **管理面 HTTP**（webuiSession+CSRF，对齐 IAM）：`GET /api/v1/iam/api-tokens`（分页列表）、`POST /api/v1/iam/api-tokens`（创建返回明文）、`POST /api/v1/iam/api-tokens/{id}/rotate`（轮换返回新明文、旧立即失效）、`POST /api/v1/iam/api-tokens/{id}/revoke`（终端吊销）；scope 必须为 Catalog 已知精确 scope（沿用 `ErrUnknownPermission` 语义），过期时间受控校验。 |
| `REQ-078-004` | **权限键（新增）**：Catalog 新增 `iam:api-token:read`（列表/查看）、`iam:api-token:write`（创建/轮换/吊销），owner=iam；这是新能力授权域的必要扩展（R077-002 已预告），非同既有键语义。 |
| `REQ-078-005` | **审计**：创建/轮换/吊销走既有操作审计（`iam.api-tokens.*`，不记录明文 secret）；认证成功/失败走既有 Auth 认证审计。 |
| `REQ-078-006` | 保持既有边界：不改变 Casbin/i-rbac 授权权威、不改变 Session/Cookie/CSRF 语义；token-scopes Principal 直达既有 `HasScope` 授权与 operation gate，授权路径零改动；API-Token 不替代 IAM Session。 |
| `REQ-078-007` | **MFA/TOTP 选型归档**：R078-002 结论（自研 RFC 6238，std 库实现；第三方候选当前无法在线复核不作为默认）写入变更记录；MFA 实施（登录两步/绑定/恢复码/会话标记/WebUI）作为独立变更（079）候选，是否并入本批由用户确认。 |
| `REQ-078-008` | 契约与生成物单轨同步：新增 operation/权限键经 contract-gen/`api/openapi.yaml`/WebUI generate 与文档一致；Go 与 WebUI 测试覆盖新语义；`config init` 不变（API-Token 无新配置，或按需 `iam.local.apiToken` 上限配置——待确认）。 |

## 3. 候选方向（仅记录，不实施）

- **MFA/TOTP**：选型结论见 R078-002；实施（绑定/确认/登录两步/恢复码/会话标记/审计/WebUI）建议独立 079 立项（体量 M+，涉及登录流程与前端）。
- **异常告警**（审计→规则→webhook）：R077-002 判定边界内可落地，规则集与通道需产品决策，另行立项。
- **动态风险控制**：需独立设计研究（因子采集/数据源/与 MFA、告警联动），另行立项。
- **操作/授权留痕增强**（权限集合 diff、审计导出/归档）：产品决策项。

## 4. 非功能要求

- secret 是敏感字段：不进入日志、错误详情、审计与 WebUI 持久化视图；无 `gitleaks`/敏感泄露风险（只返回一次）。
- WebUI 范围（D 决策）：本批最少做到 **API 闭环**；WebUI「API 令牌」管理区块（列表/创建一次显示/轮换/吊销）是否计入本批由用户确认。
- 分页/过滤沿用既有 offset/limit 契约；revoked/expired token 在列表标记（不强制隐藏，管理员可见）。

## 5. 验收标准

1. 创建返回明文 secret 一次；再次读取只有摘要；轮换后旧 secret 立即认证失败（401）、新 secret 可认证；吊销后认证失败。
2. Bearer `iam_<secret>` 认证 → token-scopes Principal → 既有 operation gate 精确 scope 授权（403/允许语义正确）；与 JWT/development 并存无回归。
3. 4 个管理 operation 权限键正确（`iam:api-token:read/write`）；范围外 scope 创建被拒；分页/摘要视图正确。
4. 创建/轮换/吊销审计事件落库（低敏、无明文）；认证成功/失败审计正常。
5. `go test ./...`、`go vet ./...`、contract-gen golden、`api/openapi.yaml` 同步、docs-guard 全绿。
6. （若 WebUI 计入）安全页 API 令牌区块可用，Vitest/e2e 覆盖创建一次显示。

## 6. 非目标

- 不实施 MFA/TOTP（除非用户确认并入）、动态风险控制、异常告警、操作/授权留痕增强（候选）。
- 不改变授权 authority、Session/Cookie/CSRF 语义、token-scopes 语义。
- 不以明文形式持久化 secret；不提供 secret 第二次读取或导出。