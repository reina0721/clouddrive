# Web Authentication

认证属于 Web Host。当前用户来自 `controller.ts` 的唯一内存 Store，页面经 `useAuth`
调用统一 `AuthService`，不判断运行模式。Surface、Feature 和 Plugin Contract 不依赖
HTTP、浏览器会话或认证配置。真实数据权限由服务器执行，前端 Gate 只管理呈现。

Root 共享主题、i18n、Motion 和反馈；Next route groups 将布局分为公共 `(public)`、
认证 `(auth)` 和受保护 `(app)`。后者验证会话后才挂载 AppShell 与业务子树。
Plugin 生成器输出 Host adapter 到 `(app)`，URL、Plugin manifest 和唯一 Router 不变。

## 配置与演示

复制 `apps/web/.env.example` 到 `.env.local`，或在启动/构建环境中设置：

```dotenv
NEXT_PUBLIC_AUTH_MODE=mock
```

开发缺省为 Mock；生产缺省或非法模式显示配置错误，禁止自动降级。生产演示必须显式
选择 Mock。所有 `NEXT_PUBLIC_*` 是构建期公开值，部署后改变需要重新构建；本实现
没有部署后动态配置端点。真实服务器密钥不得放入前端环境变量。

Mock 演示账户：`demo@community.test` / `CommunityDemo2026!`。可在 `/register` 创建
演示账户；不要输入真实密码。注册记录只保存随机盐和 PBKDF2-SHA256 摘要（100000
次迭代），不保存明文。模拟会话持续 30 分钟，刷新可恢复。客户端记录可任意修改，
不是安全认证或服务器授权。账户持久化键为 `clouddrive.auth-mock`，当前 version 5；
v1/v2/v3/v4 原地迁移，保留账户、会话及已有业务记录。注册提交在同一业务写队列内
检查当前开放策略并分配默认角色，页面不会提交 roleId 或 permissions。
公开注册页只读取 `/auth/registration-policy` 的 enabled 状态；系统策略读写由
`/system/registration` 与 settings.read/update 权限管理。完整字段、版本冲突与后端
授权责任见 [产品实施与 REST 契约](../../../../docs/changes/108-ui-ux-audit/product-implementation.md)。

损坏记录和不兼容版本显示错误并保留原值，不静默重建。开发人员修复该记录或明确
清除演示记录后可重试；清除会丢失本机演示账户。存储不可用显示独立错误。

## Backend 接入

```dotenv
NEXT_PUBLIC_AUTH_MODE=backend
NEXT_PUBLIC_AUTH_API_BASE_URL=/api
```

API base 可用同源相对地址，或 HTTPS 地址。开发仅允许 localhost HTTP。正式 API
尚未提供，以下是可替换 Cookie-session 提案，**全部待真实后端联调**：

| 方法与 base 后路径    | 请求或响应                                                  |
| --------------------- | ----------------------------------------------------------- |
| GET `/auth/csrf`      | `{token:string}`                                            |
| POST `/auth/login`    | `{email,password}`；成功 204、建立 Cookie 会话              |
| POST `/auth/register` | `{name,email,password}`；成功 204、建立 Cookie 会话         |
| GET `/auth/session`   | `{user:{id,name,email},expiresAt:number}`；时间为 Unix 毫秒 |
| POST `/auth/logout`   | `{logout:true}`；成功 204、销毁 Cookie 会话                 |

所有请求 `credentials:include`、`cache:no-store`；写请求先获取 CSRF token 并带
`X-CSRF-Token`。登录/注册后重新读取会话，当前资料只存内存，不保存 JWT 或会话
凭据到 LocalStorage。每次请求含 CSRF 步骤最长 15 秒，网络、超时、协议、服务不可用、
401、403 和 409 保留独立错误语义。恢复 401 表示匿名；已有会话恢复为空表示过期。
任何 Backend 失败都不会返回模拟身份。

接入前由后端确认实际协议：Cookie 属性、Origin/CSRF 验证、跨源 credentials/CORS、
会话轮换/失效和所有数据授权。本层不预设 JWT；协议不同只替换 Backend adapter，
不重写表单。找回密码、密码重置、邮箱验证、OAuth、条款和隐私文档均未提供真实能力，
因此页面没有占位链接。403 使用现有拒绝反馈，没有虚构角色权限引擎。

## 生命周期与账户边界

首次恢复前隐藏受保护子树；安全内部 `returnTo` 保留路径、查询和锚点，拒绝外站、
认证自身和不合法路径。注册成功先显示反馈，继续后进入目标；已有会话访问认证页
返回目标。到期计时和可见性恢复重新验证；退出等待服务器前先清空当前用户。
失败退出保持受保护内容隐藏并提供重试。

`account-boundary.ts` 在授权子树挂载前清除前一账户的工作台、草稿、收藏、页签和
私有通知等命名空间记录，并重置 Host 内存 Store。身份 owner 持久化用于同账户刷新
保留私有状态。设备主题/语言保留；Mock 账户记录保留。登录/退出、跨标签页会话变化
和已登录身份切换采用新文档，清除旧 Plugin 的内存缓存；新身份切换期间不挂载后台。
个人账户页提供资料、身份和账户安全；账户菜单姓名与邮箱使用统一会话来源。

Mock 持久化变更由 Storage Event 同步；两种模式完成登录/注册/退出后通过
`clouddrive.auth-session` BroadcastChannel 发出无身份资料的失效信号。
接收方加载新文档并重新读取会话，不信任消息提供身份。退出信号在服务器确认后发出；
该 API 不可用的环境继续在恢复焦点时验证会话。

## 验证

单元覆盖配置、重定向、Adapter 协议/超时、摘要持久化、损坏/版本、并发生命周期和
密码控件语义。`authentication.spec.ts` 用空匿名上下文验证 Mock 全流程；已有后台
回归从正常持久化演示会话启动，仍通过真实 Gate。`authentication-backend.spec.ts`
运行独立 4174 Backend 配置，用受控 API 响应验证同一页面和实际 Backend adapter。
它证明适配契约和失败关闭，**不证明真实后端认证已接入**。两个 project 均纳入
`pnpm check`。视觉基线必须人工确认后限定更新。

## 账户安全契约

Surface 的 `AccountSecurityPort` 由 Web Host 注入，Plugin 不访问 Host 私有实现。密码修改要求当前密码与 12～128 字符的新密码，成功后撤销全部会话并重新登录；有效会话只暴露撤销用的 ID 与设备、活动、到期摘要，不暴露凭据。Mock v5 保留已有数据，并记录真实模拟登录产生的会话；客户端模拟不代表服务端安全保证。Backend 的 Cookie/CSRF 与严格响应校验沿用统一 transport。

新接口为 `POST /auth/password`、`GET /auth/sessions`、`DELETE /auth/sessions/:id` 和 `POST /auth/sessions/revoke-others`；完整业务接口、Mock 与待联调责任见 [本轮实施](../../../../docs/changes/110-management-completion/README.md)。

## 演示身份、重置与锁屏边界（116）

显式 `NEXT_PUBLIC_AUTH_MODE=mock` 部署下，登录页与会话过期页提供三个**真实可登录**的演示身份
（单一事实源 `demo-accounts.ts`，邮箱与目录种子一致，密码复用 fixture 常量）：

| 角色          | 用户       | 邮箱                    | 可体验范围                    |
| ------------- | ---------- | ----------------------- | ----------------------------- |
| administrator | Rin        | demo@community.test     | 全部权限                      |
| operator      | Alex Chen  | operator@community.test | 用户维护，无角色授权/系统配置 |
| viewer        | Morgan Lee | viewer@community.test   | 只读体验与自助账户            |

- 快捷身份按钮执行真实 `AuthService.login`，不是填充表单；失败仍走统一错误码。
- “上次使用”仅记录演示身份 id（`clouddrive.auth-demo`），不保存密码或会话。
- “重置演示数据”清除 `clouddrive.*` 中除 `clouddrive.shell` 以外的记录（目录、会话、
  菜单覆盖、部门、字典、待办等），随后整页重载重新播种；界面偏好保留。
- Backend 模式不渲染任何演示入口；Backend 失败永不返回 Mock 身份。

**锁屏不是安全边界**：Host 的锁屏（`shell/lock-screen.tsx`）只是客户端遮挡 + 当前账号密码
复核（复用同一 `AuthService`），会话有效期不变；清除本地存储或新开标签页即可绕过。
产品文案明确说明这一点，不把它当作授权或防篡改能力。空闲/后台锁定只读取偏好，
账号切换时丢弃上一账号的锁定状态。
