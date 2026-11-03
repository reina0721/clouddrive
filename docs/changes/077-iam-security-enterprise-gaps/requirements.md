# 077 需求规格：用户与权限体系企业级完善（口令治理 / 会话上限 / 登录限流）

引用研究：[R077-001](research/R077-001-enterprise-iam-gap-audit/report.md)。

## 1. 目标

按「真实缺口 + 单一 owner + 可验证闭环」原则，补齐企业级能力差距中「边界内可直接补」的三项：**口令策略增强（历史/过期）、会话数量上限、登录 IP 限流**。MFA、外部身份、数据权限、多租户、授权语义增强、批量运营等候选项仅记录与触发条件，不进入本批（对应 R077-001 §2.2 判定）。

## 2. 功能要求（推荐范围，待用户确认）

| ID | 要求 |
| --- | --- |
| `REQ-077-001` | **口令历史**：`iam.local.passwordPolicy` 新增 `historySize`（默认 0=不启用；启用后新密码不得与最近 N 次历史口令相同，rune 级比较并预哈希存储）。实现位于 IAM 边界内：新建 `password_history` 表（或复用凭据表扩展列——设计决策 D1），创建/重置/修改密码时写入历史并裁剪至 N 条；`Setup` 首装不适用历史。默认关闭保证存量兼容。 |
| `REQ-077-002` | **口令过期**：`passwordPolicy` 新增 `maxPasswordAge`（默认 0=不过期；启用后口令超过期限的账号登录后进入受限状态并要求改密——复用既有 `MustChangePassword`/受限会话语义，不新增会话类型）。过期判定在登录/会话解析边界按服务端时钟执行；改密成功后清除过期标记。 |
| `REQ-077-003` | **会话数量上限**：`iam.local` 新增 `maxSessionsPerAccount`（默认 0=不限；启用后账号并发 Session 达到上限时**主动吊销最旧 active 会话**并建立新会话），复用 `iam_sessions` 表与吊销语义；踢除行为按低敏操作审计记录（`iam.session.evict` 类目）；管理员批量吊销与分页列表能力不变。 |
| `REQ-077-004` | **登录 IP 限流**：扩展 `http.rateLimit`——保留全局 mode/requestsPerSecond/burst，新增按路径前缀规则（`/api/v1/iam/login`、`/api/v1/iam/setup` 默认 provision，可配置）；每个路径使用独立 token bucket（复用 `pkg/httpx` 限流与 429/503 Problem 语义）；与账号级锁定叠加构成「IP+账号」双维度；`setup` 仅 loopback/同源语义不变。 |
| `REQ-077-005` | 保持既有边界：不新增权限键；不改 Casbin Core RBAC、不改变 Session/Cookie/CSRF 语义；不改授权 authority 与 fail-closed 行为；受限会话语义不扩展为新会话类型。**新增行为的操作留痕/授权留痕**（口令历史写入、会话踢除、登录限流拒绝）必须纳入既有低敏审计面（`auth_audit_events`/`RecordAuthenticationFailure` 类目），不建立第二套留痕（R077-002 决策 4）。MFA、OIDC、数据权限、多租户、角色继承/deny/SoD、批量导入导出继续为候选。 |
| `REQ-077-006` | 契约与生成物单轨同步：新增/修改配置节、HTTP 行为（429/403/409 语义）、`config init` 模板、`config.example.yaml`、`api/openapi.yaml`（如涉及）与文档一致；Go 与 WebUI 测试覆盖新语义。 |

## 3. 候选方向（仅记录，不实施）

- **MFA/TOTP**（064 候选）：需先完成技术选型研究（totp 库/QR/恢复码/绕过流程/审计），单独立项。
- **外部身份 OIDC/SSO/LDAP**（054/058 候选）：触发身份来源重构，先研究后确认。
- **授权语义增强（角色继承/deny/SoD）**（058 触发条件）：先重建 Casbin model 或 OpenFGA/OPA 对比研究。
- **数据权限（组织数据范围）**（055/066 候选）：进入授权决策属重大边界突破，单独确认四级 scope 模型。
- **多租户 domain、批量导入导出/邀请、授权审计 diff、运行时权限管理**：产品决策项。
- **多实例授权一致性**：可基于既有 `pkg/messaging` 设计失效广播研究后决定承载路径。

## 4. 非功能要求

- 新增配置默认值必须保持既有行为（全部开关默认关闭/不限）；既有部署缺省字段安全回退默认。
- 日志与审计沿用低敏规范：口令历史只有哈希、会话上限拒绝与登录限流拒绝按低基数记录（不记录原始口令/IP 全文与 token）。
- 并发与事务：口令历史写入与会话创建沿用既有事务/乐观并发路径；会话上限校验在会话创建事务内原子执行。
- 每项能力独立配置开关，可单独启用/关闭，不互相耦合依赖。

## 5. 验收标准

1. `passwordPolicy.historySize>0` 时重复使用最近 N 次口令被拒绝；历史按「最近 N 次」裁剪；默认 0 行为不变；`maxPasswordAge>0` 时过期口令登录进入受限改密路径，改密后恢复。
2. `maxSessionsPerAccount>0` 时并发会话达到上限后新登录被拒绝（或按 D3 踢最旧）；既有批量吊销/分页列表不受影响；默认 0 行为不变。
3. `iam.login`/`iam.setup` 在配置启用后按 IP 限流生效（429 稳定错误码）；账号级锁定语义不变；未配置时限流不启用。
4. `config init` 模板与 `config.example.yaml` 生成全部新配置节；Go 测试覆盖三项能力的开关默认与启用路径；`go test ./...`、`go vet ./...`、docs-guard 全绿。

## 6. 非目标

- 不实施 MFA/TOTP、外部身份、数据权限、多租户、角色继承/deny/SoD、批量导入导出、授权审计 diff、运行时权限管理（候选或产品决策项）。
- 不改变 Casbin evaluator 模型、Session/Cookie/CSRF 语义、授权 authority、受限会话语义。
- 不新增权限键；不改动组织关系与授权决策边界。