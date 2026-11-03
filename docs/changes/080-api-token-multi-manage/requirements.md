# 080 需求规格：API-Token 多令牌管理与权限知情创建

引用研究：[R080-001](research/R080-001-token-gap-and-inheritance/report.md)。立项输入（任务提示词）已由用户提供并确认。

## 1. 目标

在既有模块边界内，将 API-Token 升级为「权限知情 + 多令牌 + 完整生命周期」的企业级能力：创建权限受限于创建者当前有效权限（防越权/提权）、多令牌与命名/描述、启用/禁用/轮换/过期/吊销状态机、使用观测与低敏审计、WebUI 完整管理页；交互与信息架构对齐 Cloudflare API Tokens / 腾讯云 CAM 等主流设计。

## 2. 功能要求

| ID | 要求 |
| --- | --- |
| `REQ-080-001` | **多令牌与命名**：每账号可创建多个令牌（上限可配置，默认 5、0=不限）；令牌含 name 与 description（migration 000008 加列）；列表分页 + status 过滤（Count/List 同条件）。 |
| `REQ-080-002` | **权限知情创建（关键安全）**：创建时服务端用 `authorization.ProjectPermissions(ctx, accountID, currentRevision, restricted)` 实时投影创建者有效权限并强制校验 `requested scopes ⊆ 创建者有效权限`；未知 scope 404（沿用 ErrUnknownPermission）；越权 403（新错误 `ErrApiTokenScopeNotOwned`）；受限（MustChangePassword）账号禁止创建/管理令牌（403）。前端勾选建议复用 `SessionIdentity.Permissions`（注明以服务端校验为准）。 |
| `REQ-080-003` | **生命周期状态机**：`active / disabled（可逆）/ expired / revoked（终态）`（新增 `disabled_at` 列，expired 由 expires_at 派生，revoked 沿用）；`ResolveApiToken` 对 disabled/expired/revoked 一律 401；端点 `PATCH /{id}`（name/description/expiresAt，可清空=永不过期）、`POST /{id}/disable`、`POST /{id}/enable`，轮换/吊销沿用（明文仍仅 create/rotate 一次）。 |
| `REQ-080-004` | **数量上限与 TTL 默认**：`iam.local.apiTokenMaxPerAccount`（默认 5；按未吊销令牌数计数，revoked 不占额度，超限 409）；`iam.local.apiTokenDefaultTTL`（默认 0=永不过期；创建未指定 expiresAt 时生效）；进入 config init/example 与 Decode 校验。 |
| `REQ-080-005` | **使用观测**：列表呈现 created_at/last_used_at/expires_at/status（派生），有效刷新最后使用时间（既有 TouchApiTokenUsage）。 |
| `REQ-080-006` | **审计与告警**：create/rotate/revoke 既有 + 新增 update/disable/enable 全部走 `auditOperation`（不记录明文）；敏感写告警集合（079）加入 disable/enable；权限键复用 `iam:api-token:read/write`，不新增。 |
| `REQ-080-007` | **WebUI：独立管理页 + 入口**（不堆页面）：API-Token 完整管理为 IAM 模块**独立路由页面**（`/admin/api-tokens`，列表+创建向导+明文一次弹窗+状态开关+轮换/吊销+过期/status 过滤）；设置中心「安全」页只保留**入口与摘要**（跳转链接 + 当前令牌数量/最近使用简况），不承载创建/开关等实操控件；尊重「复杂功能可作入口、不作实操页」原则。MFA 操作较简单保留在安全页。 |
| `REQ-080-008` | 保持既有边界：质量「授权按令牌自身 scope 生效，与创建者后续权限变化解耦（不自动收缩，治理路径=禁用/轮换/吊销）」，文档明示；不引入资源级（zone/app）作用域、跨账号委派、使用配额/强制轮换（候选）。 |

## 3. 候选方向（仅记录）

- Cloudflare 式资源级作用域、细粒度资源授权：当前无资源模型，需产品决策。
- 跨账号委派/管理员代建、使用次数配额、强制轮换策略：候选。
- 令牌到期自动回收/清理任务：候选。

## 4. 验收标准

1. 越权：无权限账号创建含他人权限的令牌 403；未知 scope 404；受限账号创建/管理 403；权限内创建成功。
2. 生命周期：上限 409（未吊销计数）；禁用后立即 401、启用恢复；轮换旧令牌立即 401；过期令牌 401；吊销终态。
3. 观测：status 过滤分页与 Count 一致；last_used_at 刷新；视图不含明文。
4. 审计/告警：create/rotate/revoke/update/disable/enable 事件落审计（无明文）；privilege_changed 对新端点生效。
5. WebUI：勾选仅含当前账号权限；明文一次弹窗且关闭不可再读；状态/开关/过期展示正确；Vitest/e2e。
6. 门禁：`go test ./...`、`go vet ./...`、contract-gen golden（新 operation/参数）、migration 000008 三驱动、docs-guard 全绿。

## 5. 非目标

- 资源级作用域、跨账号代建、配额/强制轮换（候选）。
- 不新增权限键（复用 read/write）。
- 不自动收缩已发放令牌权限（文档化治理语义）。
- 物理删除/恢复（沿用吊销终态语义；上限口轻考虑 revoke 清理为后续项）。