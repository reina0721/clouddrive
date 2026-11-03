# 077 设计方案：口令治理 / 会话上限 / 登录限流

## 1. 背景与目标形态

076 后「用户与权限体系」核心闭环完整；本批补齐企业级差距中边界内可补的三项：口令历史与过期（P1）、会话数量上限（P2）、登录 IP 限流（P3）。全部落在 IAM/transport 既有机制内，不新增权限键、不改授权 authority、默认关闭保证存量兼容。

## 2. 方案对比

| 缺口 | 方案 | 结论 |
| --- | --- | --- |
| P1 口令历史 | A（采纳）：新增 `password_history`（account_id, password_hash, created_at）表，`passwordPolicy.historySize` 控制保留 N 条；创建/重置/修改时追加并裁剪，校验时逐条比较 hash | 表语义清晰、不污染凭据行、可独立查询 |
| P1 口令历史 | B（不采纳）：在 `iam_local_credentials` 加历史哈希列 | 定长列无法表达可变 N、演进语义混乱 |
| P1 口令过期 | A（采纳）：凭据行新增 `password_changed_at`（migration 000005），`passwordPolicy.maxPasswordAge` 启用后登录/解析时按服务端时钟判定过期→受限改密（复用 `MustChangePassword`/restricted 语义） | 仅加一列，复用既有受限会话与自助改密路径 |
| P1 口令过期 | B（不采纳）：新增独立「过期会话」类型 | 违背「不新增会话类型」边界，复杂度高 |
| P2 会话上限 | A（采纳）：`iam.local.maxSessionsPerAccount`，会话创建事务内计数 active 会话，超限拒绝（`ErrSessionLimit`→429） | 语义最简、可预期；与「管理员批量吊销」并存 |
| P2 会话上限 | B（不采纳）：超限自动踢最旧 | 隐式吊销与审计语义复杂、用户不可预期 |
| P3 登录限流 | A（采纳）：`iam.login`/`iam.setup` 挂来源 IP token bucket（transport 层局部门禁，`cache` 不可用时进程级；与 `http.rateLimit` 并列受控配置） | 复用既有 local token bucket 语义与 429/503 Problem；与账号级锁定双维度 |
| P3 登录限流 | B（不采纳）：仅依赖全局 `http.rateLimit` | 全局门禁不分路径/来源，无法防定向爆破 |

## 3. 数据流与实现位置

### 3.1 口令历史（REQ-077-001）

```
configbinding.PasswordPolicy 增加 HistorySize int `mapstructure:"historySize"`（默认 0）
model.PasswordPolicy 增加 HistorySize；ValidatePasswordWith 不感知历史（历史校验在 service 层，因需要数据库）

repo：
  新增 passwordHistoryTable = "iam_password_history"
  RecordPasswordHistory(ctx, accountID, hash, now) error
  PasswordHistoryHashes(ctx, accountID, limit) ([]string, error)   // 最近 N 条，含当前口令?（设计：不含当前，只查历史）
  TrimPasswordHistory(ctx, accountID, keep) error

service：
  createWithPassword / ChangePassword / ResetPassword 的成功路径：
    事务内：校验新口令 != 历史最近 N 条 -> 写入新 hash -> 裁剪历史至 N-1
    （历史比较用 argon2 Verify 逐条；N=0 时跳过全部）
```

- 迁移：`000005_alter_iam_local_credentials_add_password_changed_at.up/down.sql`（P1 过期用）与 `000005_create_iam_password_history.up/down.sql`（历史表）——按 IAM 既有 migration set 递增版本，不改写既有文件。
- 失败语义：历史命中 → `ErrPasswordReused`（映射 409 conflict，语义与既有 conflict 一致）；历史写入失败 → 整体事务回滚，不改口令。

### 3.2 口令过期（REQ-077-002）

```
configbinding.PasswordPolicy 增加 MaxPasswordAge time.Duration `mapstructure:"maxPasswordAge"`（默认 0=不过期）
repo：CredentialRecord 增加 PasswordChangedAt time.Time；凭据表加列
service：
  Login/Resolve：口令过期 = maxPasswordAge>0 && now.Sub(passwordChangedAt) > maxPasswordAge
    -> 会话构造时置 MustChangePassword=true（复用 restricted 语义：只能自助权限+改密）
  ChangePassword 成功路径：PasswordChangedAt=now 并清除过期（MustChangePassword 由改密语义自然恢复）
```

- 受限会话语义复用：`runtime.go:116-122` 已实现「restricted 仅自助权限」；`auth model.NewIAMRBACPrincipal(restricted)` 已通。无需新会话类型。
- 默认 0 完全兼容存量（密码未存 changed_at 时按创建时间回退或视为未过期——迁移时用 `updated_at` 回填）。

### 3.3 会话数量上限（REQ-077-003，已确认语义：剔最旧）

```
configbinding.Local 增加 MaxSessionsPerAccount int `mapstructure:"maxSessionsPerAccount"`（默认 0=不限）
service.createSession（事务内）：
  if MaxSessionsPerAccount > 0:
    active = CountSessionsByAccount(accountID, now, activeOnly=true, revokedOnly=false)
    if active >= MaxSessionsPerAccount:
      最旧 = ListSessionsByAccount(accountID, now, activeOnly=true, revokedOnly=false, 0, 1).Items[0]
      RevokeSession(最旧.IDHash)          // 主动剔最旧（已确认决策 2），会话总数保持上限
```

- 复用 076 的 `CountSessionsByAccount`/`ListSessionsByAccount`（activeOnly 语义一致）。
- 踢除行为按低敏审计记录（operation audit：`iam.session.evict` 类目、resource=account/session 摘要），不泄露明文。
- 默认 0 完全兼容既有行为。

### 3.4 登录 IP 限流（REQ-077-004，已确认承载：扩展 http.rateLimit）

```
pkg/httpx：
  RateLimitConfig 保持 mode/requestsPerSecond/burst（全局），新增可选
  Routes []RateLimitRoute{Path string; RequestsPerSecond, Burst int}  // 按路径前缀规则
  RateLimiter 增加按 path 分发的中间件（默认取全局规则；命中 path 规则用专用 limiter）

internal/kernel/composition/http.go：
  HTTPServerConfig/defaults/validate 同步 Routes 字段与 config init 模板

internal/composition/service.go（既有装配点 140-147）：
  生成全局 RateLimiter.Middleware()（含路径规则分发）
  路径规则示例（默认配置 provision）：
    /api/v1/iam/login  -> 登录专用限流（如 2 rps/burst 5，可配置）
    /api/v1/iam/setup  -> setup 专用限流（默认相对更严；loopback 同源语义不变）

账户锁定（MaxFailedAttempts/LockDuration）保持不变：限流挡来源 IP，锁定挡账号，
构成「IP+账号」双维度；两套语义互不影响。
```

- 429/503 Problem 呈现与既有 `http.rateLimit` 完全一致（`rate_limited`）。
- 与全局 rate limit 一致，per-generation 进程级 token bucket（多实例一致性沿用既有边界）。

## 4. 失败语义、并发与审计

- 历史复用/会话超限/限流耗尽均映射稳定 429/409 Problem 与低基数审计（不记录原始口令、IP、token）。
- 会话上限校验在事务内原子执行（与 createSession 同事务）。
- 口令历史与过期写入沿用既有事务路径；失败整体回滚。
- 全部新配置默认关闭/不限，存量配置缺省字段安全回退默认。

## 5. 已确认决策

1. 077 范围按用户确认：P1 口令治理 + P2 会话上限 + P3 登录限流全部实施（R077-001 §3）。
2. **P2 会话超限语义：主动剔最旧**（新登录在并发会话达到上限时吊销最旧 active 会话后建立新会话，用户体验连续；踢除行为按低敏审计记录，不产生新会话类型）。
3. **P3 登录限流承载：扩展 `http.rateLimit`**（在既有全局 rateLimit 之外增加按路径规则，复用 `pkg/httpx` token bucket 与 429/503 Problem 语义；不为 IAM 建独立限流配置）。
4. 六项企业能力可行性结论（R077-002）：操作留痕/授权留痕复用 065/Auth 既有审计面，077 新增行为（口令历史写入、会话踢除、限流拒绝）纳入低敏审计；API-Token、异常告警为后续候选批次；MFA/TOTP、动态风险控制需先完成选型/设计研究再立项；六项均不进入 077 验收。
5. 口令过期复用受限会话语义（MustChangePassword/restricted），不新增会话类型。

## 6. 验证方案

1. Go 单元/集成：口令历史（启用/裁剪/复用拒绝/默认关）、口令过期（过期登录受限/改密恢复/默认关）、会话上限（超限拒绝/计数准确/默认不限）、登录限流（bucket 语义/429/禁用态）。
2. 迁移：`000005` 三驱动 up/down 可重复。
3. 契约/生成：`config init` 模板与 `config.example.yaml` 生成新配置节；涉及 HTTP 行为文档（security.md/runtime-capabilities.md/配置说明）同步；docs-guard 通过。
4. WebUI：会话管理页/安全页展示受限改密路径（沿用既有页面语义，最小改动）；必要时补充页面断言。