# R001 IAM 与 Auth 所有权边界

## 1. 问题与证据

当前 Auth 同时拥有通用 Principal/Policy/Bearer 与本地 WebUI 用户、密码和 Session；后者又由 Todo migration 建表。053 R001/R002 已验证当前实现与 Core RBAC 缺口，R005 已否决 Account 巨型模块和 Account/Authorization 过度拆分。

## 2. 事实与推断

- 最后 owner 同时依赖 Account 状态和 AccountRole；
- 账号角色、角色权限和密码变化都必须使 Session 安全状态失效；
- setup 同时创建 Account、Credential、owner Role/Permission 和 Session；
- 这些不变量共享一个数据库和事务边界，拆成 Identity/Authorization 顶层模块只会引入协调器或补偿；
- Principal、Bearer/JWT、operation/action decision 不需要知道 Role、Credential 或 Session schema。

因此 IAM 共同拥有本地身份和 Core RBAC，Auth 保留通用执行，是当前最窄稳定边界。

## 3. 能力与生命周期

IAM 复用 Database、Clock、ID、Logger 和 053 的 Permission/Migration/HTTP/WebUI 契约；Argon2id 继续封装在模块 Adapter。IAM 不拥有共享资源、不新增 goroutine；Session 是数据库运行数据，不属于 Kernel reload resource。

## 4. 单轨迁移

054 必须迁移调用方并删除 `auth/webuiauth`、旧 password Adapter、`auth.local`、相关 CLI/WebUI/migration 引用。053 提供的认证来源契约允许 composition 从旧 owner 切换到 IAM，但不授权永久并存。

## 5. 局限与门禁

本研究不覆盖外部 IAM、MFA、多租户、数据范围或组织/导航模型。053 未完成或其契约变化时必须刷新。当前证据足以形成 054 计划，研究门禁通过，不构成实施授权。

## 6. 053 完成后复核（2026-08-22）

已按提交 `7c716d578571b7b205edb24fae7b702ad76d515b` 复核：Permission Catalog、Migration Catalog、多 HTTP Module dispatcher、`none/bearer/webuiSession` 和 NavigationPolicy 均已落地；Auth 当前本地账号 schema 已从 Todo baseline 退休，fresh database 不再具备旧 Setup/Login 持久化。这强化了“054 由 IAM 单轨接管本地身份、Auth 只保留通用决策”的原结论，没有引入新的目标、依赖或跨模块事务。研究门禁继续有效。
