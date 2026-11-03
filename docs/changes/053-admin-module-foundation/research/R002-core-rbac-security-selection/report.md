# R002 Core RBAC、安全语义与策略引擎选择

## 1. 研究范围

本研究只为当前本地账号管理选择首版权限模型和安全不变量，不把所有 IAM 能力一次性纳入。主源为 NIST RBAC、OWASP Authorization/Session/Password 指南和 Apache Casbin 官方源码/文档。

## 2. 主源事实

### 2.1 Core RBAC 的最小关系

NIST 把 Core RBAC 定义为最小完整模型，核心包含用户—角色分配与权限—角色分配；角色层级、静态职责分离和动态职责分离是独立增强组件，不是首版 Core RBAC 的必选项。

对当前项目，真实需求只要求：

- 账号可以被分配一个或多个角色；
- 角色拥有一个或多个稳定权限键；
- operation policy 要求一个精确权限键；
- 资源 owner 约束继续由业务 action authorization 处理。

没有证据要求角色继承、显式 deny、职责分离、ABAC 或多租户 domain，因此首版不提前建设。

### 2.2 授权必须默认拒绝并逐请求执行

OWASP Authorization 指南要求默认拒绝，并在每个请求校验权限。前端菜单、route guard、按钮隐藏或 manifest access 只能改善体验，不能替代服务端 operation gate。

当前 Auth 的精确 scope 判断、缺失 policy 拒绝和服务端 operation gate 已符合这个方向。Account 只提供当前账号的有效权限集合，不接管最终 decision。

### 2.3 权限变化必须处理 Session

OWASP Session 指南要求在权限级别变化后更新 Session ID，并要求 logout/过期在服务端主动失效。账号禁用、密码改变、角色分配改变和角色权限改变都是权限或风险状态变化。

本方案选择更明确的首版语义：相关 mutation 与受影响 Session 撤销在同一数据库事务中完成；旧 Session 下个请求必然失败，用户重新登录取得新 Session。Account Resolve 同时从数据库读取当前账号状态和有效权限，不信任登录时缓存的 scopes。

### 2.4 密码存储复用现有 Argon2id

OWASP 当前仍推荐 Argon2id，并给出最低 19 MiB、2 次迭代、并行度 1。仓库现有模块内 Adapter 已实现这组参数和带 salt 的编码 hash，首版应迁移 owner 并复用，不新增第二个 password library。

## 3. Casbin 适配性

### 3.1 成熟能力

Apache Casbin 官方说明它支持 ACL、RBAC、带 domain 的 RBAC、ABAC、自定义 matcher、role hierarchy、policy storage 和 role mapping，属于成熟的通用 authorization library。

### 3.2 当前不适配点

Casbin 官方同时明确：

- 不负责 Authentication；
- 不管理用户或角色实体，只管理 policy 和 user-role mapping；
- 多实例 policy 一致性需要 watcher/dispatcher 等额外组件；watcher 不在核心库中。

053 无论是否使用 Casbin，都必须自行实现账号、凭据、角色元数据、生命周期、Session、API、页面和迁移。当前授权只做“Principal 是否含 operation 所需精确权限键”，没有 matcher、层级、domain 或 deny 需求；引入 Casbin会增加：

- Casbin model/policy 与项目 operation policy 两份 authority；
- Casbin adapter 表与项目 Account 表之间的事务一致性；
- Generation 构造、缓存 reload 和多实例同步；
- 第三方类型封装、错误转换、观测和替换成本。

这些成本没有被当前用例抵消。

## 4. 选型结论

首版使用项目自有、关系表驱动的 Core RBAC：

```text
Account --< AccountRoleAssignment >-- Role
Role    --< RolePermissionAssignment >-- PermissionKey
Operation Policy -----------------------> PermissionKey
```

- 只允许角色授予；不允许用户直授权，避免两条授权来源。
- Permission Catalog 来自当前应用已注册 operation policy，是只读 contract，不提供创建/删除权限 API。
- `owner` 系统角色拥有全部当前权限，禁止删除、归档或编辑其权限集合。
- 未知 permission、缺失 policy、disabled account、无效 Session 和目录不兼容全部 fail closed。
- Auth 继续执行精确 operation/action decision；Account 不实现第二个 Enforcer。

## 5. 重新研究触发器

出现以下真实需求时重新比较 Casbin、OpenFGA 或其他成熟方案，不能在 053 内顺手扩张：

- 角色继承、显式 deny、静态/动态职责分离；
- 多租户 domain 或同一账号在不同租户拥有不同角色；
- 基于资源/环境属性的 ABAC/ReBAC；
- 跨服务、跨语言统一 policy decision；
- 权限集合大到必须建立多实例缓存与一致性同步。

## 6. 局限与门禁

本结论面向当前单应用、同一数据库和精确 permission key。它不是“自研通用策略引擎”的授权；服务只实现当前关系查询、不变量和 set membership。外部资料可能变化，触发器命中后必须刷新。

技术选型证据足以支撑 053 计划，研究门禁通过；未安装 Casbin、未修改依赖。
