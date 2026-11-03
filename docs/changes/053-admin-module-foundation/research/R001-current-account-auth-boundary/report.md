# R001 当前账号、Auth 与装配边界

## 1. 研究问题与方法

本研究回答：当前仓库是否已经具备账号权限体系；若没有，哪些现有能力应复用，哪些 owner 和基础契约必须先收口。

按 `README -> docs/README -> 应用模块开发指南` 进入当前 authority，检索既有 metadata 后，追踪 `cmd/app -> internal/composition -> Auth/HTTP/WebUI/Migration -> Database` 的定义、装配、调用方、错误语义和资源 owner。`old-backend/` 按项目范围明确排除。

## 2. 当前实现事实

### 2.1 已实现的认证与授权基础

- `auth.Service` 已拥有项目自有 `Principal`、精确 `Scope`、operation/action `Policy`、默认拒绝的 `EnforceOperation`/`EnforceAction` 和低敏 Audit。
- Bearer profile 支持 `development-anonymous` 与 JWT；JWT 第三方类型封装在 Auth Adapter 内，没有泄漏给 Todo。
- `webuiauth.Service` 已实现首次 setup、Argon2id password、固定成本失败路径、失败锁定、服务端 opaque Session、CSRF、Origin、idle/absolute timeout、logout 和离线 reset-password。
- Session 数据库只保存 Session ID/CSRF 摘要；Cookie 使用 Secure、HttpOnly、SameSite 与 `__Host-` 约束。
- Todo 通过 composition 的窄 Adapter 消费 Auth，不直接导入 Auth；服务端 operation gate 是 API 授权 authority，WebUI manifest 只呈现 access view。

这些能力应演进复用，不应再建一套 JWT、密码哈希、Session Cookie、CSRF 或前端权限判断。

### 2.2 账号模型不是完整权限体系

当前 `userRecord` 只有：

- `ID`、`Username`、`PasswordHash`；
- 逗号分隔的 `Scopes`；
- `FailedAttempts`、`LockedUntil` 和时间戳。

setup 只允许创建一个用户，并硬编码 `management:read`。仓库没有：

- 多账号创建、查询、禁用、恢复或分页；
- 角色实体、账号—角色关系、角色—权限关系；
- 只读权限目录、角色生命周期或最后 owner 约束；
- 强制改密、管理员密码重置后的状态门禁；
- 账号/角色变更导致的 Session 统一失效；
- 账号与角色管理 API、WebUI 页面和业务错误契约。
- 用户 display/组织资料、部门树、岗位目录和用户—岗位关系；
- 对现有静态 Navigation 的启停、层级、排序策略和菜单权限管理页面。

因此当前事实是“单个本地 WebUI 登录用户 + scopes”，不是可运营的账号与权限业务模块。

### 2.3 模块 owner 冲突

运行代码把本地用户和 Session 放在 `internal/module/auth/webuiauth`，但三驱动表由 `internal/module/todo/binding/migration/*/000004_create_webui_auth` 创建，Todo migration set 的 `CurrentVersion=4` 和 checksum manifest 负责其历史。

这与当前模块规则冲突：Todo 不拥有账号数据，Auth/Account 也不能长期依赖 Todo 才知道自己的现行 schema。已发布 migration 文件属于历史，不能改写 checksum；目标方案必须用新的 Account migration 完成数据迁移和当前 owner 转移，并保留旧文件作为迁移历史证据。

### 2.4 HTTP 仍是假多模块装配

- `applicationHTTPModules()` 当前只返回 Todo。
- `newContractDispatcher` 固定接收 Todo Operations，并只取 `modules[0]`。
- 全局 Auth middleware 对 `/api/v1/webui` 特殊跳过，Bearer Principal 在路由绑定前注入。
- `contract.Security` 只支持无认证和 Bearer；route binding 的 `OperationGate.Authenticate` 只能检查 context 中已有 Principal。
- WebUI setup/login/session/logout 使用独立手写 handler，没有进入模块 code-first HTTP contract。

所以 Account 不能仅“追加一个 contract”。必须先把 dispatcher、authentication profile 和 route binding 泛化为多模块、按 operation 认证，并继续保持单一 transport binder。

### 2.5 Migration runner 只有一个 set

`pkg/database/migrate.Set` 已支持自定义 `MigrationsTable`，但 `internal/module/migration.Service` 和 composition 只接收 Todo 单 set、单 completion，CLI status 也只返回一组版本。Account 需要自己的三驱动 SQL 与版本表，因此必须把 Migration module 泛化为具名 set catalog、确定顺序、逐 set status/up/completion；不需要新数据库或第二个 migration 框架。

### 2.6 WebUI 模块边界可以复用

048 已完成：

- 模块自有 `binding/webui/web` 页面、locale、CSS Modules 和测试；
- composition 显式 registration/activation；
- 生成 registry、通用 SDK、access/availability/load gate；
- 宿主只理解通用 Principal/Access，不理解 Account DTO。

Account 应新增自己的 WebUI Binding 并单轨替换 Auth 的 setup/login/session 页面。普通模块新增不应修改 WebUI core；若 Account 真实需要新的 host-level identity SDK，必须先独立证明现有 SDK 不足。

当前菜单是 `Binding.Navigation` 的构建期定义，包含稳定 NavigationID、RouteID、ParentID、TitleMessageID、IconID 和 Order；manifest 再按 view operation/availability 过滤。目标菜单管理必须在这个 Catalog 上增加受控 policy，不能把数据库字符串升级成页面或 component authority。详细边界见 `R003`。

## 3. 能力评估

| 维度 | 结论 |
| --- | --- |
| 真实用例 | 首次 owner、多个本地账号、角色授权、账号禁用/改密、部门/岗位关系、菜单策略、权限管理、浏览器 Session 与后台页面。 |
| 现有能力 | 复用 Database/Transaction/Repository、Migration Adapter、Clock、ID、Logger、Validation、Argon2id、Auth Principal/Policy/Audit、HTTP Contract、WebUI SDK/Binding。 |
| 新底层 Capability | 不需要；Account 是业务模块。需要扩展已有 HTTP Contract/transport 与 Migration module 的多模块表达能力。 |
| 第三方边界 | Argon2id Adapter 迁入 Account；JWT 留 Auth。首版不新增 Casbin 或外部 IAM 依赖。 |
| 资源 owner | Database 连接仍由 Kernel App 管理；Account 只借用 Access。账号、凭据、角色、关系和 Session schema 由 Account 拥有。 |
| 生命周期 | Account 无后台 goroutine；随 Application Generation 构造，候选阶段校验 migration compatibility 和 permission catalog。 |
| Reload | Account 安全配置属于 Generation reload；账号、角色和权限关系是数据库运行数据，不依赖配置 reload。 |
| Composition | composition 显式连接 Account Session Identity -> Auth Principal、Account actor port -> Auth authorizer、Account contract/handler -> dispatcher。 |
| 失败 | migration/catalog 不兼容在 listener 前失败；未知 permission 默认拒绝；账号禁用/Session 失效返回稳定未认证；越权返回 403。 |
| 外部副作用 | 实施会重建首发 migration baseline、新增数据库表并改变 API/WebUI；本轮计划不执行这些副作用。 |

## 4. 推断与目标影响

### 推断

Account 和 Auth 必须分责：Account 负责“谁、凭据、角色关系和 Session 状态”，Auth 负责“已验证 Principal 对 operation/action 是否允许”。若继续把全部业务塞进横切 Auth，模块职责会继续膨胀；若 Account 再建 Enforcer，则形成双 authority。

### 目标影响

计划需要同时覆盖：

1. 多 set migration、Todo/Account 干净首发 baseline 与退休 baseline 拒绝；具体取舍由 R004 更新；
2. `account` Model/Service/Repository/Adapter/Binding；
3. 多模块 HTTP dispatcher 与 WebUI Session security profile；
4. composition 中 Account/Auth 窄 Adapter；
5. WebUI 页面、生成、i18n、E2E 和视觉证据；
6. Auth、Account、HTTP、migration、configuration、security 和首次使用 authority 同步。
7. 部门/岗位目录、Navigation Catalog policy 与角色权限树投影。

## 5. 适用、不适用与局限

适用于当前单应用、同一数据库、本地账号和静态模块集合。它不自动适用于 OIDC/SSO、LDAP、MFA、跨服务 token exchange、多租户权限、角色继承、外部策略服务或超大规模权限缓存。

本轮没有写数据库、生成 OpenAPI/registry、安装依赖、启动服务或执行浏览器验收。具体 DTO 字段和函数名属于目标设计，实施前必须以 contract tests 冻结。

## 6. 研究门禁

当前事实、现有能力、结构缺口、owner、生命周期、composition 和外部副作用已可复核，足以形成 053 计划，研究门禁通过；不构成非文档实施授权。
