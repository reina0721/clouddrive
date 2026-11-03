# R001 Admin WebUI 基础与模块接入研究

## 1. 研究问题与方法

本研究从根 README、项目手册、应用模块开发指南、模块契约、HTTP Contract、Composition、Auth、Ops、Todo、i18n 和管理路由开始，追踪真实定义、装配点、调用方、权限语义和资源 owner；外部选型只使用 React、Vite、HeroUI 与 OWASP 官方资料。

当前 Git 快照需要特别说明：`HEAD` 仍为 `2b9462e`，工作树包含尚未提交的架构迁移。本报告描述的是“该 HEAD 加当前未提交迁移”的可见事实，不把它冒充已提交基线。

## 2. 当前项目事实

### 2.1 Module、Binding 与 Composition

- `internal/module/contracts.go` 的 `Contribution` 当前只输出模块 ID、生命周期 Participant、Schedule Binding 和 Message Contribution，没有 Admin 字段。
- `internal/module/README.md` 与应用模块开发指南明确：模块只建立真实需要的 HTTP/config/cli/migration/i18n/middleware/schedule/message Binding，不为目录对称制造空层。
- HTTP 的当前单轨是“模块 Handler 与 `binding/http` 声明 -> `internal/composition` 聚合 -> transport 一次绑定 -> contract-gen 生成 OpenAPI”。
- `applicationHTTPModules()` 是应用当前 HTTP 契约的显式汇总点；项目禁止自动扫描、`init` 注册、Service Locator 和全局可变 Registry。
- Todo 是完整 Binding 示例，但“完整”不意味着每个模块都要拥有所有 Binding。Auth、Ops、Migration 已经采用不同的按需形态。

**推断：** Admin 接入应新增项目自有、纯数据、可校验的 Admin Binding，由模块按需声明并由 Composition 显式聚合；不应把 React Router、菜单对象或动态插件注册器传入业务模块。

### 2.2 Auth 与权限

- Auth 当前支持 `development-anonymous` 与 JWT 两种 HTTP profile，JWT Adapter 留在 Auth 模块内部。
- Auth Service 已拥有 operation/action policy authority、Principal、scope 判断与低敏 Audit，但当前 HTTP middleware 在应用 Router 上全局挂载，公开 operation 与可选凭据解析仍需拆分。
- 当前没有本地管理员用户、密码哈希、首次设置 Token、服务端 Session Repository、Session Cookie 或 CSRF 能力。
- Todo HTTP Contract 使用 Bearer security 和 operation policy；WebUI Session 不应成为 Todo 等普通业务 API 的隐式替代凭据。

**推断：** 新认证路径必须限定为 Admin/Auth 与 management，普通 API 继续保留现有 Bearer JWT 或开发匿名语义。页面权限只引用 operationID；服务端 operation policy 继续是唯一授权 authority。

### 2.3 Ops 与真实页面数据

- Ops 模块拥有独立 management HTTP，提供 startup、liveness、readiness、build、diagnostics 和可选 metrics。
- diagnostics/metrics 受 `management:read` policy 保护，公开探针与受保护诊断已经有明确区分。
- Ops 不参与公开 OpenAPI contract-gen，但由模块 `ManagementHTTP` 输出并经 Composition 挂载到独立 Listener。

**推断：** Ops 可以贡献首个真实 Admin 看板；该页面只消费既有 management 能力，不制造模拟系统状态，也不把 management 路由错误地改成普通公开 API。

### 2.4 i18n

- 当前后端 i18n 由 Kernel 统一构造 Translator，业务模块通过 `binding/i18n` 贡献自身资源并由 Composition 聚合。
- Todo 使用模块自有消息文件和 `<domain>.<type>.<key>` 消息 ID，Handler 消费注入的 Translator。

**推断：** 浏览器无法直接调用 Go Translator，但应复用“模块拥有资源、Composition 聚合、宿主只有一个实例、消息 ID 有 owner”的治理方式。Admin 页面贡献 JSON namespace，由 WebUI 宿主唯一 i18n 实例加载，不允许模块创建第二套全局翻译中心。

### 2.5 当前前端边界

- 当前 `frontend/` 是独立 Nuxt 应用，不是本任务的 Admin 宿主。
- `old-backend/` 仅是迁移中的历史参考，不能复制、恢复或形成第二条现行实现。
- 当前仓库尚无目标 `webui/`、Admin Binding、Admin manifest 或生成 registry；这些均属于目标设计。

## 3. 外部主源结论

- HeroUI 官方 Quick Start 给出 React 组件包与样式包的直接安装方式，并要求先导入 Tailwind CSS、再导入 HeroUI 样式；官方当前 React v3 资料要求 React 19 与 Tailwind CSS 4。
- Vite 官方提供 React TypeScript 模板、React Fast Refresh 和 TypeScript 转译，但明确类型检查必须由独立 `tsc`/构建门禁负责。
- HeroUI 官方 Theming 使用 CSS variables 和 Tailwind CSS 4 语义变量，适合由宿主集中实现明暗模式和可导入主题文档。
- OWASP 要求 Session ID 使用 CSPRNG、内容无业务含义且状态保存在服务端；Cookie 应使用 Secure、HttpOnly、显式 SameSite，`__Host-` 前缀要求 Secure、无 Domain、Path=/。
- OWASP 明确 SameSite 只是 CSRF 的纵深防御，不能替代 CSRF Token；有状态 Session 的不安全方法仍需 Token 和来源校验。
- OWASP Password Storage 推荐 Argon2id；本任务已确认最低19 MiB、2次迭代、并行度1。

这些是技术可行性和安全设计依据，不表示相关依赖或行为已经进入仓库。

## 4. 能力评估

| 维度 | 结论 |
| --- | --- |
| 用例 | 管理员首次设置、登录、查看会话与运行看板；未来业务模块按真实后台需求贡献页面。 |
| 现有能力 | 复用 Database、Migration、Clock、ID/Secrets、Logger、i18n、HTTP Contract、Auth policy、Ops management 与 Composition。 |
| 新能力 | 新增 Admin Binding/Catalog/manifest/codegen、浏览器 WebUI、Auth 本地用户与服务端 Session；前端新增 React/HeroUI 等依赖。 |
| 归属 | Admin 宿主拥有承载能力；Auth 拥有用户/Session/认证页面；Ops 拥有看板页面；Todo 不接入。 |
| 资源 | Session 与本地用户使用现有 Database；Session Repository 由 Auth 拥有，不新增独立数据库或后台 goroutine。 |
| 运行 | WebUI 构建为静态资源；开发期由 Vite HTTPS server 提供，生产由外部同源 HTTPS 代理托管。 |
| 配置 | Auth local setup Token 和 Session 超时由 Auth config binding 拥有；品牌是集中、类型化的 Vite 构建配置。 |
| Reload | Admin Binding 与静态 registry 属于构建期固定目录，不运行时热插拔；Auth 配置遵循现有 Generation 候选失败保留旧代语义。 |
| 契约适配 | 当前 Binding/Composition 原则可表达 Admin 扩展，但需新增 Admin Contract、manifest 与生成器；不需要 Kernel Capability 或插件系统。 |
| 失败 | Catalog/revision 不匹配 fail closed；Session 无效返回未认证；CSRF/Origin 不通过拒绝；manifest 不泄露源码路径。 |
| 日志 | Auth 只记录低敏 setup/login/session outcome 和错误类型，不记录密码、Token、Cookie、Session ID、原始请求或配置快照。 |
| 影响 | Composition、Auth、Ops、HTTP Contract、migration、CLI、WebUI、codegen、测试和主题文档需要同轮收敛。 |

## 5. 用户已确认决策

- Admin WebUI 是统一宿主，业务模块按需贡献页面；Admin 能力不是全模块强制契约。
- 页面源码放在 `internal/module/<name>/binding/admin/web`，通过生成 registry 静态装配。
- 首批只有 Auth 与 Ops，Todo 明确不接入。
- 前端使用 React 19、Vite、TypeScript、HeroUI v3、Tailwind CSS 4，不使用 MUI/Vue 双栈。
- 浏览器登录使用服务端有状态 Session；普通 API Bearer JWT 保留。
- Cookie 使用高熵随机 Session ID、HttpOnly、Secure、SameSite 和 `__Host-` 约束；不把认证信息写入 Web Storage。

## 6. 局限与剩余未知

- 当前工作树不是提交后的稳定快照；迁移提交可能改变路径或契约，实施前必须重新核验。
- 具体前端依赖补丁版本应在实施时从官方 registry 解析并锁定，研究不把“latest”写成稳定合同。
- 本轮没有安装依赖、生成代码、启动服务或验证浏览器页面。
- 外部 HTTPS 反向代理和正式部署不属于首版实施范围。

## 7. 计划影响与研究门禁

实施应按以下单轨推进：Admin Contract 与校验 -> Auth 本地用户/Session -> Admin Host/manifest -> 生成 registry -> WebUI 宿主 -> Auth/Ops 页面 -> 测试、视觉证据与权威文档。任何动态插件、Todo Admin、MFA、多用户治理或部署要求都必须另行研究。

关键问题已有代码、文档、用户决策和官方主源证据，事实与目标设计已经分离，研究门禁通过。非文档实施仍受前置迁移未提交阻塞。
