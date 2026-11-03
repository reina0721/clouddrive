# 080 研究档案：API-Token 多令牌管理与权限知情创建

## 研究范围

本档案核实任务提示词（080 立项输入）与现有 `iam.api-tokens` 实现的逐项差距，并回答：权限知情创建（scope ⊆ 创建者有效权限）的实现路径、令牌状态机与迁移设计、数量上限/TTL 配置语义、契约变更清单与既有 token-scopes 授权语义的复核。

## 检索方式

- 按 `docs/changes/README.md` 确认下一个变更序号为 `080`；工作树 clean（commit `baacb08`，079 完成）。
- 复用：`R078-001`（API-Token 设计）、`R079-001`（敏感写告警）、`058`（授权语义）。
- 代码证据（commit `baacb08`）：
  - `internal/module/iam/service/service.go`：`CreateApiToken`（1945，scope 仅 Catalog 校验）、`ListApiTokens`（1982）、`RotateApiToken`（2009）、`ResolveApiToken`（2045）；
  - `internal/module/iam/repo/repository.go`（ApiTokenRecord：无 description/disabled 列）、`binding/http/{contract,huma}.go`（4 个 operation，list 无 status 过滤）；
  - `internal/module/iam/authorization/runtime.go`（`ProjectPermissions(ctx, subject, revision, restricted)` 可用于创建者有效权限实时投影）；
  - `internal/module/settings/binding/webui/web/SecurityPage.tsx`（078 已含基础令牌区块：创建/列表/轮换/吊销）。
- 平台对照（Cloudflare API Tokens / 腾讯云 CAM / GitHub PAT / AWS IAM Access Keys）由任务提示词给出，本档案引用并落实为本项目取舍。

## 逐项差距核实（对照任务提示词）

| 提示词差距 | 现状（代码） | 结论 |
| --- | --- | --- |
| 1) 无「scope ⊆ 创建者权限」校验 | `validateApiTokenScopes` 只查 Catalog 存在 | **真实越权路径**：任意已知 Catalog scope 可被任何会写权限的账号授予 |
| 2) 无启用/禁用、上限、TTL 默认 | 表仅 revoked_at/expires_at；无 disabled 状态；无数量上限；expiresAt 创建时可传但无默认策略 | 真实；需 disabled_at 列与上限/默认 TTL 配置 |
| 3) 观测仅 last_used，无状态聚合 | last_used_at 有；列表无 status 过滤 | 真实；补派生状态与过滤 |
| 4) 无 WebUI 管理页 | **078 已有基础区块**（创建/列表/轮换/吊销，明文 InlineAlert 一次） | 校准：升级为完整管理页（状态/开关/过期/权限勾选向导），非从零建页 |

## 权限知情创建设计（R2 关键）

- **创建者有效权限来源**：`authorization.Runtime.ProjectPermissions(ctx, accountID, currentRevision, restricted)`——revision 取 `repo.CurrentAuthorizationRevision`（实时权威，避免会话投影陈旧）；restricted=true 强制返回仅自助权限（与 077 password-revision 语义一致）。
- **受限会话**：`MustChangePassword=true` 的账号禁止创建/管理令牌（403），避免被限制账号借令牌扩展攻击面；前端据 session identity.mustChangePassword 隐藏入口。
- **服务端校验**（权威，不依赖前端）：`requested scopes ⊆ 创建者有效权限`；未知 scope 404（沿用 ErrUnknownPermission）；越权 403（新错误 `ErrApiTokenScopeNotOwned`，映射 403）。
- **建议清单**：复用 `SessionIdentity.Permissions`（登录/刷新已投影）作为前端勾选建议；不新增「可用权限」端点（减少契约面）；UI 注明以服务端校验为准。
- **授权语义复核**：token 经 ChainVerifier → token-scopes Principal → operation gate `HasScope`；令牌授权按**自身 scope** 判断，与创建者后续权限变化解耦——符合提示词「已发放令牌不得扩大、不自动收缩」；管理员治理路径为禁用/轮换/吊销（无降权自动收缩，文档明示）。

## 状态模型与迁移

- 新增列（migration 000008）：`description TEXT NULL`、`disabled_at DATETIME NULL`。
- 派生状态（不建冗余 status 列，与 066「独立列 vs 枚举」先例一致）：
  - `active`：disabled_at IS NULL 且未过期未吊销；
  - `disabled`：disabled_at NOT NULL（可逆）；
  - `expired`：未吊销且 expires_at 已过（或永不过期则永不 expired）；
  - `revoked`：revoked_at NOT NULL（终态）。
- `ResolveApiToken` 认证判定新增：disabled → 401（与 revoked/expired 同路径）；列表 status 过滤沿用派生条件；Count/List 同条件防翻页漂移。
- 数量上限口径：**未吊销令牌数**（active+disabled+expired）> 上限 → 409；revoked 不占额度（终态可清理）。默认 5，0=不限（沿用 maxSessionsPerAccount 配置惯例）。
- TTL 默认：创建未指定 expiresAt 时按 `apiTokenDefaultTTL`（默认 0=永不过期，可配置如 90d）。

## 契约变更清单（talk）

- `PATCH /api/v1/iam/api-tokens/{id}`：name/description/expiresAt 更新（expiresAt 可清空=永不过期）；
- `POST /api/v1/iam/api-tokens/{id}/disable`、`POST /api/v1/iam/api-tokens/{id}/enable`：可逆状态切换；
- `GET /api/v1/iam/api-tokens?status=active|disabled|expired|revoked|all`：状态过滤；
- 权限键：复用 `iam:api-token:read/write`（不新增）；
- 审计：disable/enable/update 走 `auditOperation`（敏感写告警集合加入 disable/enable）；
- 响应：视图增加 description/status/lastUsed/expiresAt（既有字段）+ 明文仍仅 create/rotate 一次。

## 适用 / 不适用

- 适用：多令牌自助管理、最小权限继承、状态机与 TTL 治理；与 078 既有链式认证/审计/告警兼容。
- 不适用：Cloudflare 式资源级（zone/app）作用域（无该模型，候选）、跨账号委派、使用配额/强制轮换（候选）。

## 对本任务的影响

研究门禁结论：任务提示词的差距核实现实（WebUI 项修正为升级已有的基础区块）；实现路径落在既有模块边界（migration 000008 + service 校验/状态 + HTTP 扩展 + settings WebUI 升级 + config 上限/TTL）；权限知情创建的关键安全语义（服务端实时投影 + 受限拒绝 + 越权 403）可验证。可进入计划阶段。