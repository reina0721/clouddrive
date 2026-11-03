# 042 Admin WebUI 模块化宿主与可选 Admin Binding 设计

## 总体结构

```text
业务模块 binding/admin Contract
  -> internal/composition applicationAdminBindings()
  -> Admin Catalog 校验与稳定 revision
     -> Admin Host runtime manifest
     -> admin-webui-gen 静态 registry/locales
        -> WebUI 宿主 Router/Menu/i18n
           -> 模块拥有的 React 页面
              -> 模块自身 HTTP/management operation
```

Admin WebUI 不进入 Kernel Plan，不创建运行时插件 Registry。Composition 仍是唯一同时知道应用选择与模块契约的位置。

## Admin Contract

新增项目自有 Admin 类型：

```go
type AdminBinding struct {
    ModuleID   ID
    Entries    []AdminEntry
    Routes     []AdminRoute
    Navigation []AdminNavigation
    Locales    []AdminLocale
}

type AdminEntry struct { ID, SourcePath string }

type AdminRoute struct {
    ID, Path, EntryID, TitleMessageID string
    ViewOperation                    string
    State                            AdminCapabilityState
    Default                          bool
}

type AdminNavigation struct {
    ID, ParentID, RouteID, TitleMessageID, IconID string
    Order                                           int
}

type AdminLocale struct { Language, Namespace, SourcePath string }
```

`SourcePath` 只供生成器使用，runtime manifest 转换时必须剥离。`State` 只允许 `available` 或 `preview`。真实路由必须引用 policy inventory 中存在的 operationID；访问模式从 operation policy 派生，不在 Admin Binding 重复 scope/action。

Catalog 校验全局 ID、route path、Entry/Navigation 引用、父导航环、默认路由、BCP 47 language、namespace/message ID、资源文件存在性和确定性排序。规范化后的 Catalog 计算 SHA-256 revision。

## 模块所有权与生成装配

- Auth 和 Ops 分别在自身 `binding/admin` 返回纯 Contract；Todo 不新增该目录。
- React 页面、模块 API Adapter 和 JSON locale 位于模块 `binding/admin/web`，只依赖 React/HeroUI、生成的稳定前端契约和模块自身 API 类型。
- `applicationAdminBindings()` 显式返回 Auth、Ops Contract，是 runtime 与 codegen 的共同 authority。
- `admin-webui-gen` 输出 lazy import registry、locale registry 和 revision 常量；生成文件禁止手改，并纳入 clean-generation 门禁。
- Vite alias 只开放宿主 contracts/generated 与被选模块 Admin Web 源码；ESLint/测试禁止模块页面导入宿主内部 Router、menu、store、layout 和 Session 实现。

## Admin Host 与权限数据流

Admin Host 是普通应用模块，拥有 manifest HTTP operation，不拥有业务页面。`GET /api/v1/admin/manifest` 使用可选 Principal：

- 未登录时，公共路由标记 `allowed`，保护路由标记 `authentication-required`；
- 登录后，Auth Service 按每个 `ViewOperation` 计算 `allowed/denied`；
- manifest 返回 module/entry ID、route、navigation、message ID、state、default、access 和 revision；
- manifest 结构可公开，但不得包含 source path、scope 以外的内部 policy 数据、配置或凭据；
- 页面可见性不产生授权能力，模块实际 operation 仍经过现有 operation gate。

宿主从 manifest 构造 Router 与 Menu：`/` 跳转到当前主体有权访问的唯一默认路由；Auth 提供 `/setup`、`/login`、`/account/session` 且不进入主导航；Ops 提供 `/dashboard` 并设为默认；`/appearance`、403、404和 revision mismatch 属于宿主自身页面。

## Auth 本地用户与 Session

Auth 模块新增本地用户和 WebUI Session Repository、migration、config、HTTP Handler/Contract、CLI reset-password 与 Admin 页面。数据模型至少包含：

- local user：稳定 ID、规范化用户名、Argon2id PHC、scope、失败次数、锁定截止、创建/更新时间；
- session：Session ID 摘要、用户 ID、CSRF 摘要、创建/最后活动、空闲/绝对过期、撤销时间；
- 数据库唯一约束保证初始管理员和用户名不重复；创建用户与首次 Session 在事务中完成。

Session ID 使用 `crypto/rand` 生成32字节并 base64url 编码；客户端只收到 Cookie，数据库只保存 SHA-256 摘要。CSRF Token 独立生成并与 Session 绑定，通过 Session 响应提供给页面内存；不安全请求同时校验 `X-CSRF-Token`、Origin 和 Session。

Cookie 始终使用 `__Host-community_go_admin_session; Secure; HttpOnly; SameSite=Lax; Path=/`，不设置 Domain。本地 Vite 使用 HTTPS 和同源代理，避免开发环境降低 Cookie 安全属性。

认证入口分轨：

```text
普通 /api/v1 业务 operation -> Bearer 或现有开发匿名 profile
Admin/Auth operation         -> WebUI Session（setup/login 为 public）
management operation         -> Bearer 优先，或 WebUI Session
```

应用 Router 的 Auth 处理拆为可选凭据解析与 operation policy 校验。普通业务 Router 不解析 Session Cookie，防止 Session 获得 Todo 等业务 API 权限。

Auth Admin operation：

- `GET /api/v1/admin/auth/setup`
- `POST /api/v1/admin/auth/setup`
- `POST /api/v1/admin/auth/login`
- `GET /api/v1/admin/auth/session`
- `POST /api/v1/admin/auth/logout`

登录失败使用一致响应并执行固定成本密码校验。连续5次失败锁定15分钟；设置/登录创建新 Session，注销/密码重置/过期服务端撤销。默认 idle 30分钟、absolute 12小时，last-seen 节流更新。

## WebUI 宿主

`webui/` 使用 pnpm 锁定依赖，提供 `dev/lint/typecheck/test/build/e2e/generate:check`。Vite 开发代理：

- `/api/v1` -> 业务 Listener；
- `/management` -> management Listener 并移除前缀；
- 浏览器入口为 HTTPS，所有请求使用 `credentials: "include"`。

宿主稳定契约包括 `AdminHttpClient`、`useAdminAccess(operationID)`、`useAdminI18n(namespace)`、`navigate(routeID)` 和 `notify(result)`。模块只能通过这些契约使用公共交互，不直接写全局状态。

浏览器只维护一个 i18n 实例，默认 `zh-CN`、回退 `en-US`；模块 locale 按 namespace 聚合。API 错误继续由 Go `pkg/i18n` 呈现，页面文案由浏览器 Catalog 呈现，两者共享消息 ID 规则但不互相读取内部对象。

品牌通过集中 typed Vite env 提供，默认 `Community Go Admin`。主题基于 HeroUI/Tailwind CSS variables，支持 system/light/dark、default/ocean/violet/graphite 和受 Zod 约束的编辑、导入导出；只保存主题文档，不保存认证信息或任意 CSS/URL/脚本。

## 失败与日志语义

- Binding/Catalog 无效：构建或 Generation prepare 失败，不启动不完整 Admin Host。
- registry/manifest revision 不一致：WebUI fail closed，显示部署不匹配，不尝试猜测加载。
- Session/CSRF/Origin 无效：返回稳定未认证/禁止结果，不回显凭据。
- Ops 部分不可用：页面按真实探针呈现 degraded/error，不回退模拟数据。
- Auth 只在决定 setup/login/session outcome 的边界记录结构化低敏日志；禁止记录密码、setup Token、Cookie、Session/CSRF ID、Authorization 或原始请求体。

## 文件影响与实施门禁

实施将影响 Admin Contract/Composition、Auth、Ops、HTTP Contract/codegen、migration/CLI、`webui/`、主题文档和测试。Todo 只参加“不存在 Admin Binding”的边界测试，不修改业务实现。

若实施发现必须改变普通 API 认证语义、Kernel Capability、公共 HTTP wire contract、数据库引擎支持、动态插件边界或部署方式，必须返回研究并重新确认。
