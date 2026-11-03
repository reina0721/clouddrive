# 安全响应

## 报告与分级

正式公开 release 前，repository owner 必须配置私密漏洞报告渠道和响应责任人；当前仓库文档不虚构邮箱或 SLA。不要在公开 Issue 中提交凭据、利用细节或生产数据。

收到报告后先固定受影响 tag/commit、可达调用路径和泄露范围，再区分：代码漏洞、依赖漏洞、凭据事件、配置误用和基础设施事件。日志、Problem Details、diagnostics、trace 和 SBOM 都只能作为证据，不能包含 Token、密钥或完整 DSN。

## 修复与传播

1. 在隔离环境复现并建立负向测试。
2. 修复项目自有 contract/Adapter 边界；不要让业务调用方直接接管第三方客户端。
3. 运行 quality、security、DB、container 和 release gates。
4. 发布新版本和安全说明，列出受影响 baseline、修复 commit、迁移步骤、临时缓解和验证命令。
5. copy-owned 消费者人工评估并迁移修复；上游不会自动覆盖副本。

疑似凭据泄露时应先轮换/撤销，再调查使用记录；删除 Git 文件不能撤销已经暴露的 secret。发现 artifact、checksum、SBOM 或签名不一致时停止发布并重新从固定 source commit 构建，不允许覆盖证据继续发布。

## WebUI Session 当前约束

当前本地 WebUI 使用 IAM 服务端有状态 Session。首次设置要求 `APP_IAM__LOCAL__SETUPTOKEN`，密码使用 Go 官方 `x/crypto/argon2` 的 Argon2id（当前目标为 64 MiB、3 次、并行度 2）；存量 PHC 参数先经过受限解析，匹配但偏离当前 policy 时在成功登录事务内自动重哈希，损坏或超预算记录 fail-closed。默认连续 5 次失败锁定 15 分钟；Session 默认空闲 30 分钟、绝对 12 小时。Session 保存签发时的 `SecurityRevision`，账号、密码、AccountRole 或 RolePermission 变化会使旧 Session 失效。Session 不得作为普通业务 API 的 Bearer/JWT 替代凭据。

浏览器请求使用 `__Host-community-go_iam_session` 安全 Cookie；不安全请求必须同时满足同源校验和绑定 Session 的 `X-CSRF-Token`。密码、setup token、Session ID、CSRF token 和 Authorization 不进入日志、Web Storage 或错误详情。

应用入口的 CORS 标准机制由 `rs/cors v1.11.1` 处理，Go 标准库 `http.CrossOriginProtection` 对 unsafe cross-site 请求提供 defense-in-depth。项目只允许配置中的 exact HTTP(S) Origin，空列表默认拒绝；不开放 wildcard、credentials 或 Private Network Access。被拒绝的 unsafe 请求在业务 Handler 前返回低敏 Problem。该入口策略不替代下述 IAM Session Origin/CSRF 守卫：无浏览器来源头的非浏览器请求可能通过标准库检查，但仍不能绕过 IAM mutation token。

IAM 在 composition 提供普通 WebUI 业务 mutation 共用的窄 Origin/CSRF 守卫；Navigation 策略修改使用该守卫，但业务模块不读取 IAM Repository 或 Session 表。菜单隐藏不构成授权，所有 Navigation operation 仍由服务端 `navigation:menu:*` 权限判断。

## 授权决策当前约束

服务端授权只经 Auth `DecisionPoint`：`token-scopes` 来源（Bearer/JWT、CLI/development）按凭据携带的精确 Scope 直判；`iam-rbac` 来源（IAM Session）不携带 Scope，必须由 composition 注入的 IAM RBAC evaluator 判断。Casbin evaluator 只执行固定 exact Core RBAC（账号→角色→精确 PermissionKey），由 `PolicySnapshot` 构造不可变快照，发布后不再改写；任何关系变更都在事务内撤销受影响 Session 并 bump authorization revision。Principal 携带的 revision 与 evaluator 不一致时同步刷新，刷新失败、取消或仍不一致一律拒绝，不使用旧 policy 放行；多实例部署在 revision 协议下可 fail-closed，但尚未作为已验证的分布式承诺。授权审计只记录低基数 operation、结果、reason 与 revision 类别，完整 policy、角色/权限集合、token、Cookie 与 matcher 细节不进入日志或响应。

## HTTP 认证 profile 与 mutation 守卫（076）

所有业务操作（IAM/Organization/Navigation/Auth/Todo）统一使用 `webuiSession`（WebUI Session Cookie）认证 profile；`bearerAuth`（Bearer/JWT/development principal）只保留给 token-scopes 来源场景。Organization 的 mutation（部门/岗位/分配创建、更新、替换）与 Navigation 一致，经 composition 注入的 IAM Origin/Session/CSRF 守卫校验（`X-CSRF-Token` + Origin），前端 mutation 请求必须显式携带这两个头；不携带或校验失败一律 403 `csrf_invalid`，不静默放行。

## 审计持久化与会话管理（064/065）

- 认证/授权审计默认写入持久化低敏表 `auth_audit_events`（Auth module 自有迁移；`auth:audit:read` 权限键只读查询，owner 自动覆盖）。日志记录保留为 debug 级补充，不作为查询 authority。事件只保存脱敏字段（operation/action/actor_kind/subject_hash/resource_type/resource_hash/decision/outcome），查询结果同样脱敏；表默认受控保留上限（超出删除最旧事件，不自动归档）。审计查询不提供删除/篡改接口，支持按 operation/action/resourceType/outcome/actorKind/时间窗过滤。
- **业务操作审计（065）**：IAM、Organization、Navigation 的写操作（创建/变更/替换/启停等）经模块自有窄 port 注入同一低敏审计面，记录「谁在何时对什么资源做了什么、结果如何」；不包含对象内容、before/after、密码、token、权限集合或策略全文。审计写与业务事务解耦：失败低敏上报但不回滚业务结果。
- IAM 提供账号会话集中管理：`iam:session:read`/`iam:session:revoke` 权限键控制列表与批量吊销；列表只暴露 SessionID 摘要（hex）与过期信息，不泄露明文；列表支持分页与 `status` 过滤（`all`/`active`/`revoked`，`active` = 未吊销且按服务端时钟未过期）；批量吊销沿用既有安全修订与 owner 不变量语义（当前登录会话是否包含在集合内由调用方决策）。

## 影响分析与账号过滤（076）

- IAM 提供角色→账号（`GET /api/v1/iam/roles/{id}/accounts`，`iam:role:read`）与权限键→角色（`GET /api/v1/iam/permissions/roles?key=…`，`iam:permission:read`）只读反向查询，用于角色归档/权限退役前的影响分析；查询不改变授权状态、不 bump revision。权限键含冒号，使用 query 参数传递；未知角色 404、未知权限键 404。
- 账号列表支持 `status`（active/disabled）、`archived`、`roleId`（仅统计活跃关系）typed 过滤，与关键字/分页组合使用；Count 与 List 同条件，保证 total 不漂移。

## 密码策略（076）

创建/重置/修改密码的强度策略由 `iam.local.passwordPolicy` 配置（`minLength`/`maxLength` 默认 15/128，`requireComplexity` 默认 false）；策略在 Service 构造时冻结，只约束新建密码路径、不重验存量哈希，默认值保持与历史硬编码一致。`requireComplexity` 开启时要求密码同时包含大写字母、小写字母与数字（按 rune 计数）。HTTP 契约的密码字段只做非空与长度上限防御校验，真实策略统一由服务端判定（避免契约静态校验与配置策略双 authority）。

## 口令治理与会话治理（077）

- **口令历史**：`passwordPolicy.historySize`（默认 0=不启用）启用后，创建/重置/修改口令的新口令不得与最近 N 条历史口令相同（历史只存 Argon2id 哈希，逐条验证）；历史按最近 N 条裁剪。复用命中返回稳定 409 `conflict`。
- **口令过期**：`passwordPolicy.maxPasswordAge`（默认 0=不过期）启用后，口令超过期限的账号登录/会话解析进入既有受限改密语义（MustChangePassword：只能使用自助权限并修改密码），改密成功后清除过期；不新增会话类型。
- **会话上限（主动剔最旧）**：`iam.local.maxSessionsPerAccount`（默认 0=不限）启用后，新登录在账号 active 会话达到上限时主动吊销最旧 active 会话并建立新会话（会话总数保持上限）；踢除行为按低敏操作审计（`iam.session.evict`）记录，管理员批量吊销与分页列表能力不变。

## 登录限流（077）

`http.rateLimit` 扩展按路径前缀规则（`rateLimit.routes`，默认空=不启用）：命中路径使用独立 token bucket，未命中继续使用全局规则。`/api/v1/iam/login`、`/api/v1/iam/setup` 可配置更严限流（IP 维度），与账号级锁定（MaxFailedAttempts）构成「IP+账号」双维度防爆破；429 `rate_limited`/503 Problem 与全局门禁同语义，`setup` 仅 loopback/同源语义不变。限流为 per-generation 进程级 token bucket，多实例一致性沿用既有边界。

## 机器访问令牌（API-Token，078）

自管 API-Token 支持机器/脚本/CI 访问：secret 为 `crypto/rand` 32 字节（`iam_` 前缀 + base64url），**只以 sha256 哈希持久化，明文仅在创建/轮换响应返回一次**；Bearer 认证链（`ChainVerifier`）在外部 JWT 之后尝试 API-Token，解析为 token-scopes Principal 直达既有精确 scope 授权，授权路径零改动。管理面（`iam.api-tokens.list/create/rotate/revoke`，权限键 `iam:api-token:read/write`）支持列表/发证/轮换（旧立即失效）/终端吊销；scope 创建时须为 Catalog 已知精确键；创建/轮换/吊销走低敏操作审计（不记录明文）。API-Token 不替代 IAM Session（webuiSession 语义不变）。

## MFA/TOTP（078，RFC 6238）

本地账号支持 TOTP（RFC 6238，标准库自研，官方向量验证与 Google Authenticator 等互通）：自助绑定（enroll 生成 base32 secret 与 otpauth URI）→ 确认（验证激活并生成 10 条一次性恢复码，只存哈希）→ 登录两步（密码通过后已绑定账号返回 `mfa_required` + 一次性短 TTL 挑战，`login/mfa-verify` 用 TOTP 或恢复码完成，建立 `mfa_verified` 会话）；解绑需当前验证码或恢复码复核。会话标记仅作用于认证（授权权威不变）；绑定/确认/解绑与登录验证成功/失败均接入既有低敏审计；challenge 进程内短 TTL、单次成功、尝试上限内可重试。

## API-Token 权限知情与生命周期（080）

在 078 令牌基础上升级为**权限知情创建**：创建时服务端用 authorization runtime 实时投影创建者有效权限并强制校验 `token scope ⊆ 创建者当前有效权限`（越权 403、未知 scope 404、受限需改密账号禁止创建/管理 403）；前端勾选建议来自会话投影，以服务端校验为准。**授权按令牌自身 scope 生效，与创建者后续权限变化解耦（不自动收缩），治理路径为禁用/轮换/吊销**（文档明示）。生命周期：状态机 active/disabled（可逆）/expired（派生）/revoked（终态）；每账号未吊销令牌上限（`iam.local.apiTokenMaxPerAccount` 默认 5，revoked 不占额度）、未指定过期时间的默认 TTL（`apiTokenDefaultTTL` 默认永不过期）；禁用/过期/吊销立即 401；创建/更新/禁用/启用/轮换/吊销全部走低敏审计并触发敏感写告警（不记录明文）。WebUI 为 IAM 独立管理页 `/admin/api-tokens`（列表/创建向导权限勾选/明文一次/开关/轮换/吊销），设置中心安全页仅保留入口与摘要。

## 安全告警（079）

安全运营基线告警基于既有认证/写操作边界（`alerting` 配置节，默认关闭）：账号锁定（critical）、连续认证失败、MFA 连续失败、敏感权限写操作（账号/角色归档、账号角色或角色权限替换、API 令牌创建/轮换/吊销/禁用/启用）触发低敏 Webhook 事件（`pkg/alerting` → `application.alerting` kernel 组件：有界异步队列 + 单 worker、可选 HMAC-SHA256 签名、超时/重试/合并窗口）。告警事件不携带 token、密码、IP 全文、URL query 与配置密钥；URL 与签名密钥为配置秘密不进入日志/审计；投递失败只记录稳定类目（不阻断业务与审计）。连续失败计数为进程内窗口（多实例不跨副本合并，与限流同边界）。动态风险控制（来源 IP/设备指纹/地理数据源、风险档位与 MFA/告警联动）设计已归档为后续立项依据（R079-002），未实施。

## 可观测性低敏边界（081）

运行监控（`/diagnostics`、`/metrics`、Ops「监控」分区）只暴露低敏状态：进程内存/goroutine/GC/uptime、supervisor unit 名称与状态、调度执行计数、消息消费计数；不含凭据、路径、URL query、subject、队列内容或配置快照。OS 级（CPU/磁盘/网络）由宿主机 Prometheus node-exporter 按部署方安全策略接入（不进入进程内采集）。management 鉴权沿用（AccessMode protected 下需 management scope）。

## 账号与角色生命周期（066）

- 账号/角色资料更新与归档共用 `iam:account:write` / `iam:role:write` 权限键与既有乐观并发（版本 409）语义；账号改名与归档属安全变更，成功变更在事务内 bump SecurityRevision 并撤销该账号全部 Session。
- 归档是终态：归档账号不可登录、不可被组织分配（`RequireAssignableAccount` 拒绝），归档角色移出可分配集合且不再产生授权规则（沿用快照 `archived` 过滤 + `authorizeMutation` 完整发布链路，受影响持有者 Session 撤销）。最后一个 active owner 账号与 owner 角色（`ErrImmutableOwner`）不可归档。不提供物理删除或恢复流程；恢复能力若需要须另行立项。
- 角色名称/描述更新是展示字段变更，不改变授权关系，因此不触发 authorization revision、不撤销 Session；角色归档则视为授权变更，触发完整候选 evaluator 发布。
