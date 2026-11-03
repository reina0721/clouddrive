# 080 设计方案：API-Token 多令牌管理与权限知情创建

## 1. 背景与目标形态

080 在 078 的 API-Token 基础（创建/列表/轮换/吊销 + ChainVerifier 认证）上升级：权限知情创建（scope ⊆ 创建者有效权限）、多令牌与状态机（active/disabled/expired/revoked）、数量上限与 TTL 默认、WebUI 完整管理页。

## 2. 方案对比

| 项 | 方案 | 结论 |
| --- | --- | --- |
| 创建权限校验 | A（采纳）：创建时 `ProjectPermissions` 实时投影创建者有效权限，服务端校验 scopes ⊆ 该集合（越权 403、未知 404）；前端建议=SessionIdentity.Permissions | 权威在后端、与 fetch 权限实时一致、无新端点 |
| 创建权限校验 | B（不采纳）：仅依赖前端勾选或 session 快照 | 有陈旧/绕过后端风险 |
| 状态模型 | A（采纳）：独立 `disabled_at` 列 + expires_at/revoked_at 派生 active/disabled/expired/revoked | 与 066 独立列先例一致、无冗余枚举 |
| 状态模型 | B（不采纳）：单一 status 枚举列 | 一致性维护成本高、迁移语义弱 |
| 上限口径 | A（采纳）：未吊销令牌数（active+disabled+expired）> 上限 409；revoked 不占额度 | 终端清理不阻塞后续创建；沿用 0=不限 |
| TTL 默认 | A（采纳）：`apiTokenDefaultTTL`（默认 0=永不过期），创建未指定 expiresAt 时生效 | 配置化、向后兼容 |
| WebUI | A（采纳）：**独立管理页 + 入口**——IAM 模块新路由 `/admin/api-tokens` 承载全部令牌实操（列表/向导/明文弹窗/开关/轮换/吊销）；settings 安全页只放入口卡片与摘要；遵循「复杂功能可作入口、不作实操页」 | 职责单一、页面不堆积；与既有 IAM 管理页（accounts/roles）同构 |

## 3. 数据流与实现位置

### 3.1 权限知情创建（REQ-080-002）

```
service.CreateApiToken(ctx, accountID, name, description string, scopes []Key, expiresAt *time.Time)
  -> account = AccountByID（受限 MustChangePassword -> ErrAccountDisabled 语义 403）
  -> revision = repo.CurrentAuthorizationRevision
  -> owned = s.authorization.ProjectPermissions(ctx, accountID, revision, restricted=false)
  -> 对每个 scope：catalog.Lookup 未知 -> ErrUnknownPermission(404)；
                     不在 owned 集合 -> ErrApiTokenScopeNotOwned(403)
  -> 数量上限：CountApiTokens（未吊销）>= max -> ErrApiTokenLimit(409)
  -> expiresAt 为空 -> now+apiTokenDefaultTTL（0=永不过期）
  -> 既有创建路径（hash/明文一次/审计）
```

- `ErrApiTokenScopeNotOwned` / `ErrApiTokenLimit` 加入 service 错误与 HTTP 映射（403 not_owned / 409 conflict）。
- 前端：settings SecurityPage 创建表单用 `loadSession().identity.permissions` 作勾选建议；受限账号隐藏区块（mustChangePassword）。

### 3.2 状态机与迁移（REQ-080-003/005，migration 000008）

```
ALTER TABLE iam_api_tokens ADD COLUMN description TEXT NULL;
ALTER TABLE iam_api_tokens ADD COLUMN disabled_at DATETIME NULL;

repo：ApiTokenRecord + Description/DisabledAt（gorm tags）；UpdateApiTokenMeta（name/description/expiresAt）、
     SetApiTokenDisabled(id, accountID, *time.Time, now)；既有 Has/List 保持
service：
  status 派生函数 derivedStatus(record, now) -> active|disabled|expired|revoked
  ListApiTokens 增加 status 过滤（Count/List 同条件；revoked 单独，expired 优先于 disabled? 定义：revoked>expired>disabled>active）
  UpdateApiToken/DisableApiToken/EnableApiToken + auditOperation + 敏感写告警（disable/enable）
ResolveApiToken：disabled/expired/revoked 一律 ErrSessionInvalid(401)
```

### 3.3 HTTP 契约（REQ-080-003/004/006）

```
PATCH  /api/v1/iam/api-tokens/{id}         （name/description/expiresAt，expiresAt 空=永不过期）
POST   /api/v1/iam/api-tokens/{id}/disable
POST   /api/v1/iam/api-tokens/{id}/enable
GET    /api/v1/iam/api-tokens?status=active|disabled|expired|revoked|all
（create/rotate/revoke 沿用；权限键复用 iam:api-token:read/write；mutation webuiSession+CSRF）
op 常量：iam.api-tokens.update / iam.api-tokens.disable / iam.api-tokens.enable
响应 apiTokenResponse 增加 description/status（派生，服务端计算返回）
```

### 3.4 配置（REQ-080-004）

```
iamconfig.Local 增加 ApiTokenMaxPerAccount int（默认 5）与 ApiTokenDefaultTTL time.Duration（默认 0）
Decode 校验：Max>=0；TTL>=0；defaults 输出；config init/example 同步
service.Config 携带并用于创建路径
```

### 3.5 WebUI（REQ-080-007，独立页 + 入口）

```
IAM 模块（internal/module/iam/binding/webui）：
  新增 ApiTokensPage（/admin/api-tokens）：
    - 列表（status 过滤/分页；状态 Pill active|disabled|expired|revoked；过期与 last_used 展示）
    - 创建向导（名称/描述/权限勾选=当前账号可授予权限清单（复用 session identity.permissions）/过期可选/数量提示）
    - 明文一次性弹窗（关闭后不可再读）
    - 行操作：禁用/启用/轮换/吊销（ActionTrigger + actionPermissions）
  Binding：entries/routes/navigation/actionPermissions/locale/mock 同步；导航挂入既有 iam.access 分组
settings 模块（SecurityPage）：
  API 令牌区块降级为「入口 + 摘要」：当前令牌数量/最近使用简况 + 跳转 /admin/api-tokens；
  移除创建/开关等实操控件（MFA 区块保留在安全页，其操作简单）
受限（MustChangePassword）账号：APIToken 页与入口均隐藏
```

- 遵循「复杂功能可作入口、不作实操页」：路由/信息架构与既有 IAM 管理页（accounts/roles）同构；设置中心只保留导航与摘要能力。

## 4. 失败语义、并发与审计

- 越权 403 / 未知 404 / 上限 409 / 受限 403：稳定错误码映射（contract.go serviceError）。
- disable/enable/update 为非授权字段变更（meta/状态），不 bump authorization revision；轮换/吊销保持终态语义。
- 审计：新三个端点接入 auditOperation（operation 命名 `iam.api-tokens.update/disable/enable`）；敏感写告警集合增加 disable/enable（create/rotate/revoke 已有）。
- last_used 更新沿用 TouchApiTokenUsage（认证成功路径）。

## 5. 已确认决策

（待用户确认后填写；当前为推荐项。）

## 6. 验证方案

1. Go：越权/未知/受限/上限/状态派生/禁用启用/过期/轮换/吊销矩阵；status 过滤 Count/List 一致；审计与告警断言；migration 000008 三驱动。
2. 契约：contract-gen golden（3 新 operation + status 参数 + 响应字段）。
3. WebUI：设置安全页令牌区块升级（Vitest 组件断言 + mock 路由扩展 + Playwright 页面渲染）。
4. 文档：security/runtime-capabilities/配置说明/api/模块 README 同步；docs-guard。