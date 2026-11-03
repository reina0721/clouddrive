# 054 IAM 身份与访问管理设计

## 1. 边界

```text
WebUI/HTTP -> IAM Handler -> IAM Service -> IAM Repository
                    |             |
                    |             +-> Account/Credential/Session/Role/Permission
                    +-> composition adapters -> Auth Principal/decision
```

目标目录按真实职责形成 `account`、`credential`、`session`、`role`、`permission` 功能分区，以及模块自有 handler、adapter、binding 和 `module.go`。内部保持单向依赖，不为对称创建空 package。

## 2. 模型与事务

IAM schema 包含 accounts、local_credentials、sessions、roles、account_roles、role_permissions。Account 不包含 Department/Position 字段。

Session 保存签发时 SecurityRevision；Resolve 每次校验 Account active、must-change、revision 与当前 active RolePermission。密码、账号状态、AccountRole 和 RolePermission mutation 更新受影响 Account revision。清理旧 Session 行是维护行为，授权正确性只依赖 revision 校验。

setup、最后 owner 保护和单次关系替换都使用 IAM 自有 transaction。若三驱动需要 row lock/conditional mutation，只增加项目自有最窄数据库契约，不泄漏 GORM。

## 3. Permission 与 Auth

IAM 向 053 Catalog 贡献自己的 definitions，并消费完整应用 Catalog 同步 system owner。RolePermission 只保存精确 key。

IAM 输出 SessionIdentity，composition 转为 Auth Principal；IAM 定义自己需要的 Authorizer/ActorAccess port，composition 适配 Auth。054 删除 Auth 旧本地账号、密码和 Session 实现，同一 profile 只有 IAM resolver。

## 4. API、配置与 WebUI

HTTP 使用 053 的 `none/webuiSession` profile。IAM Session boundary 统一处理 Origin、CSRF、Cookie 与登录枚举保护。

配置从 `auth.local` 单轨迁到 `iam.local`，包含 setup token、密码、lockout 与 Session timeout；allowed origins 仍由 application HTTP CORS authority 注入。

WebUI Binding 使用 `iam.*` ID 和 `webui.iam` locale namespace，拥有 Setup/Login/Security/Accounts/Roles/Permissions。角色权限页读取完整 Catalog 并按 owner/menu/action 投影，提交仍是 PermissionKey 集合。

## 5. Migration 与文件影响

IAM 通过 053 Migration Catalog 贡献 `iam_schema_migrations`。三驱动 000001 只创建 IAM-owned schema，不创建 Organization/Navigation 表，也不处理旧本地数据。

主要影响：新增 `internal/module/iam/**`；收缩 `internal/module/auth/**`；更新 composition、config、CLI、HTTP/OpenAPI、WebUI registry 与当前 Auth/IAM authority 文档。

## 6. 验证

- Model/Service：username、password、lockout、must-change、RBAC、owner、SecurityRevision、错误链和取消；
- Repository：三驱动 unique/FK/transaction/optimistic conflict/checksum；
- Auth/HTTP：session resolver、Origin/CSRF、401/403、Bearer/Todo/management 回归；
- WebUI：生成、i18n/style、六类页面、首次改密与冲突视觉；
- E2E：setup -> owner -> role -> account -> first login/change -> allow/deny -> revision invalidation；
- Project：旧 `webuiauth/auth.local/account` 巨型草稿符号残留门禁。
