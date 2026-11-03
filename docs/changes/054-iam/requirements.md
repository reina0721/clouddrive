# 054 IAM 身份与访问管理需求

## 1. 产品目标

把当前单个本地 WebUI 用户与逗号 scopes 演进为可运营的本地身份与 Core RBAC，使 owner 能管理账号、角色和权限；Auth 继续执行通用认证授权决策。

## 2. 范围

| ID | 要求 |
| --- | --- |
| `IAM-REQ-001` | IAM 拥有 Account、LocalCredential、Session、Role、AccountRole、RolePermission 和 `owner` 不变量；Auth 不再拥有本地用户/密码/Session。 |
| `IAM-REQ-002` | Account 有稳定 ID、3..64 ASCII 规范化 username、display name、active/disabled、mustChangePassword、SecurityRevision、乐观版本和时间戳；username 首版不可改。 |
| `IAM-REQ-003` | 密码使用 IAM 内 Argon2id Adapter，长度 15..128 rune；密码、hash、setup token、Cookie、CSRF 不进入 DTO、日志或诊断。 |
| `IAM-REQ-004` | setup 原子创建唯一首个 Account、Credential、system owner role、Catalog 权限、assignment 和 Session；并发第二次 setup 返回 `setup_closed`。 |
| `IAM-REQ-005` | 新账号使用一次性初始密码并强制改密；禁用、改密、reset、账号角色或角色权限变化按影响范围更新 SecurityRevision，使旧 Session 下一请求失效。 |
| `IAM-REQ-006` | 授权只允许 Account -> Role -> PermissionKey；禁止账号直授权、角色继承、通配、deny 和任意 matcher。 |
| `IAM-REQ-007` | Role 有稳定 ID、唯一 code、name、description、active/archived、system、乐观版本和时间戳；owner role 不可改 code、归档或手工替换权限。 |
| `IAM-REQ-008` | 任何 mutation 不得使 active owner 数量为 0；最后 owner、关系更新和 SecurityRevision 在同一 IAM 事务内完成。 |
| `IAM-REQ-009` | IAM 消费 053 Permission Catalog，持久化只接受已注册 key；未知 active key 或 owner 未覆盖 Catalog 时 Application Generation 在 listener 前失败。 |
| `IAM-REQ-010` | IAM 权限至少为 `iam:account:self:read`、`iam:account:self:password:write`、`iam:account:read`、`iam:account:write`、`iam:role:read`、`iam:role:write`、`iam:permission:read`；不使用通配符。 |
| `IAM-REQ-011` | IAM 提供 setup/login/session/logout/change-password、accounts、roles、permissions、reset-password、account roles、role permissions typed HTTP API。 |
| `IAM-REQ-012` | IAM WebUI 拥有 Setup、Login、Security、Accounts、Roles、Permissions 页面和独立 Binding/locale/style；宿主不拥有 IAM DTO。 |
| `IAM-REQ-013` | IAM Session Resolver 经 composition 映射为 Auth Principal；Auth 保留 Bearer/JWT、operation/action decision 和低敏 authorization audit。 |
| `IAM-REQ-014` | `iam_schema_migrations` 从三驱动 000001 创建 IAM 最终 schema；不读取或迁移退休 `webui_users/webui_sessions`。 |
| `IAM-REQ-015` | `auth.local`、`auth/webuiauth`、旧 password Adapter、旧 CLI/WebUI/config/migration 调用方必须单轨迁移后删除，不保留 alias 或 fallback。 |

## 3. 验收

1. fresh IAM migration 后 setup 原子创建 owner；第二次 setup 冲突。
2. owner 创建角色与账号，首次登录只能改密；改密后旧 Session 401。
3. 角色/权限变化即时使受影响 Session 失效，重新登录后 allow/deny 与 Permission Catalog 一致。
4. 最后 active owner 无法被禁用、移除 owner role 或间接降权。
5. Bearer/JWT、Todo、management 不回归；旧 Auth local owner 和符号无残留。
6. 默认 `.data/app.db` 不被写入、移动或删除。

## 4. 非目标

- 不实现 Department、Position、MenuPolicy 或数据范围。
- 不实现 OIDC/LDAP/SSO/MFA/Passkey、注册、邀请、找回密码。
- 不实现角色继承、ABAC/ReBAC、deny、账号直授权或第三方策略引擎。
- 不实现登录日志/操作日志管理页面、多租户或在线会话管理页面。
