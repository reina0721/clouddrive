# clouddrive 前端

`/home/downloads` 使用独立DownloadsPort，由HostFilesRuntime显式注入；Host拥有任务请求、账号失效处理、可见性刷新订阅与私有来源复制，Surface复用Page/Section、UIAdapter与动态中英资源。离线真实来源浏览器夹具只对隔离测试服务显式启用，预算和使用方式以[文件管理运行说明](../docs/operations/file-management.md)为准。

同一下载入口支持实例已配置的BT v1磁力与种子。Host负责受限种子文件读取，Surface显示真实清单和保存位置，按需加载选文件界面。选中的字节、任务状态和结果目录由服务端确认。

当前与根目录 Go 后端一起运行，默认 backend + server 模式；业务地址 /api/console/v1，通过 Next.js 同源代理访问。完整启动和部署命令以 [项目 README](../README.md) 为准。下文保留 console-web 组件、插件、布局和质量检查的工程说明。

文件插件位于 `/home`，分享管理在 `/home/shares`，持久上传传输中心在 `/home/transfers`；独立访客插件 `/share` 由 Host 放入不含认证品牌框架的 `(file-shares)` 组，消费 `surfaces/src/files` 的语义 Port。认证应用框架中的 Host TransferRuntime 拥有 File、增量 SHA-256、tus 客户端和暂停/接续队列，应用内切换页面保持上传；owner 变化或框架卸载时取消并等待请求。Web Host 同时拥有文件/目录选择器、拖拽/剪贴板、快捷键、网络、媒体 URL 释放和视图偏好，Surface 不持有 File/DOM/Session。大文件下载交给浏览器原生保存。使用、预算和专用预览统一见[文件管理运行说明](../docs/operations/file-management.md)。

`/frontend` 是统一后台管理产品的前端 Monorepo。当前首要成果不是组件库或模板发行，而是可持续演进的 Product Foundation：普通后台业务只选择既有 Layout、Element、Form、State、Motion 与 Page Pattern，Feature 负责业务语义、Schema、数据、权限和 i18n。

## 分层架构

```text
Universal Frontend Foundation
  design-system / ui-adapter / form-foundation / i18n / core / schemas / types
        ↓
Current Product Surface
  packages/surface-foundation  可复用 Layout、Pattern、State、Motion、Shell 表现
  packages/plugin-framework    Plugin Contract、Route Target、Registry、Host Capability
  surfaces                     唯一 Surface 的 Shell、Composition、Plugin 与生成物
        ↓
Application = Product Surface × Runtime Host
  apps/web                     Next.js、Browser Runtime、Host Port 实现、Composition Root
```

- Universal：`design-system`、`ui-adapter`、`form-foundation`、`i18n`、`core`、`schemas`、`types`。禁止 Product 或 Host 特有页面语义。
- Product Surface：`packages/surface-foundation`（Layout/Shell Navigation/Collection/Detail/Settings/Form Action/State/Operation 与 Surface Motion Recipe）、`packages/plugin-framework`（Plugin Contract、Route Target、Registry、Host Capability；不读取 pathname、不复制 Next Route Runtime）、`surfaces`（具体 Surface 插件实现与 generated 产物）。
- Web Host：`apps/web`，只拥有 Next 启动、Router、Browser API、生命周期、持久化和 Surface 装配。

Product Surface 与 Runtime Host 是正交职责。当前只有一个 Surface 和一个 Web Host，所以目录不重复产品限定词；只有真实并列产品出现时才引入用于同级区分的限定词，不预造空 Package 或 Runtime Contract。

完整文档入口见 [Frontend 文档手册](docs/README.md)；详细边界见
[Universal Frontend Foundation](docs/frontend-foundation.md)、
[Surface Foundation](docs/surface-foundation.md)、
[Plugin Framework 与 Surface File Routes](docs/plugin-framework.md) 与
[Foundation 扩展治理](docs/foundation-extension-governance.md)。

## 运行与验证

```powershell
pnpm install
pnpm dev
pnpm check
```

本地入口为 `http://127.0.0.1:4173`（默认监听 `0.0.0.0:4173`，可通过 `WEB_HOST` / `WEB_PORT` 环境变量或 `apps/web/.env` 自定义）。验证 authority 分层如下：

- `/ui-elements/*`：46 个 Universal UI Element 的 Variant、状态、DOM、键盘与 Overlay 验收。
- `/motion`：Async readiness、Viewport Reveal、Content Swap、Disclosure 与 development Motion Inspector。
- `/page-patterns/*`：Layout/Navigation、Collections/Data、Forms/Actions、States/Feedback、Detail/Settings。
- `/page-archetypes/*`：Overview、Resource List、Detail、Create/Edit、Settings、Master-Detail、Operation 七类完整 Page Archetype。
- `/reference-resources/*`：Surface File Route / Route Target 参考插件（list/create/detail/edit）的浏览器验收。

所有场景使用确定性本地数据，只证明前端语义，不模拟后端业务、API、Session、权限计算或任务状态机。

## Foundation Contract

- UI Element 只通过 `packages/ui-adapter` 直接依赖 HeroUI/React Aria。
- Form 生命周期只通过 `packages/form-foundation` 直接依赖 React Hook Form/Resolver。
- locale runtime 与 `Intl` formatter 只通过 `packages/i18n` 直接依赖 i18next/react-i18next。
- Universal Motion Token/Recipe 位于 `packages/design-system`，公共 readiness/presence/media contract 位于 `packages/ui-adapter`；方向性页面转场、Shell 锚定和 Surface 状态 Recipe 位于 `packages/surface-foundation`，Router/Observer/Policy 生命周期止于 `web` Host。
- Plugin Framework（`packages/plugin-framework`）定义 Plugin Contract、Route Target、Registry、Host Capability 与 Route Context；唯一真实 Router 是 Next App Router，Framework 不读 pathname、不维护 history。
- Product Surface 插件实现位于 `surfaces`（private workspace）：对 Host 只开放 `shell`、`generated/composition`、`generated/catalog`、`plugin-routes/*`，`plugins/*` 永不公开；生成物由 `pnpm codegen:plugins` 确定性地产生并纳入 `pnpm check` freshness。
- Reference 场景归验证 Host，不进入公共 Feature Package。
- 公共 exports、owner、成熟度、authority route 与证据登记在 `tooling/foundation-contracts.json`。

扩展顺序固定为：`Element → Variant → Composition → Pattern → Feature Component`。页面特例不得直接扩展全局 Token、公共 Variant 或组件默认行为。

## 自动门禁

- `foundation:check`：Workspace 分类、Surface × Runtime 命名、层级依赖、Contract registry 与 vendor owner。
- `architecture:check`：HeroUI/Host/CSS/Token/DOM 边界与正反 fixtures。
- `dependency:check`：运行时依赖职责和允许 Workspace。
- `typecheck`、`test`、`build`、`performance:check`、Playwright/Axe/Visual 与 `format:check`：共同构成交付证据。

任务研究、需求、设计和实施证据从 [变更记录索引](docs/changes/README.md) 进入；当前说明以 [Frontend 文档手册](docs/README.md) 与主题 authority 为准，历史变更不再作为当前架构 authority。

Files 提供 `/home/connections` 连接管理。Surface消费ConnectionsPort，Host复用JSON/CSRF客户端并拥有剪贴板；一次性密码只保留在当前弹窗内存，账号变化重置Provider。WebDAV客户端使用管理响应给出的实际服务地址；Next开发代理仅处理管理JSON，不承载整文件PUT。能力与部署限制统一见[文件管理](../docs/operations/file-management.md)。

Files 提供 `/home/shared` 和 NavigationPort，统一保存引用、固定项与集合版本。Host 负责同实例分享地址校验、保存意图片段与受保护的新标签打开；Surface 不操作 location、网络或 Session。Auth 登录/注册返回路径只放在 returnTo query，返回片段单独保留在登录页 fragment，实际导航时重组。浏览器真实验收与当前限制见[文件管理](../docs/operations/file-management.md)。

Files 高级搜索使用 Surface 自有类型与规范化条件编码，Host 负责查询参数、按账号隔离的视图偏好和 DOM 焦点。普通网格/列表由服务端分页，选择与范围锚点只覆盖当前页；列、缩略图和目录优先沿用同一偏好契约。无效 URL 明确报错，不偷偷降级为无条件查询；日期采用 UTC 整日，条件编码有独立长度上限。具体预算与键盘操作统一见[文件管理](../docs/operations/file-management.md)。

ApplicationChrome 使用既有 Next dynamic 与共享加载界面延后 FilesRuntime、AppShell 脚本。FilesRuntime 在组件树中保持同一位置，不随文件/管理路由切换重建，传输队列仍只有一个所有者；异步边界不改变认证、账号隔离和资源关闭策略。

压缩浏览窗口只在本人ZIP/7Z打开时挂载，使用cover大小的DialogSurface；普通确认维持lg。Host拥有包内图像URL，关闭预览及运行域销毁均归还资源，密码只留在当前窗口。当前范围与预算见[文件管理](../docs/operations/file-management.md#本人压缩包浏览与提取)。

私有PDF由Host通过`FileDocument`/`FileDocumentProps`注入，Surface契约位于`surfaces/src/files/pdf-contract.ts`，只携带元数据、普通预算和关闭意图。Host拥有有界HTTP、当前版本围栏、同源frame、显式module Worker、SDK及临时URL；第三方对象不穿越Surface。固定本地PDF资产在dev/build准备，`performance:check`同时校验其摘要和独立预算，不提高主应用预算。组件来源及许可见[PDF资源](apps/web/src/files/pdf/README.md)，用户行为和限制仍以[文件管理](../docs/operations/file-management.md#本人-pdf-阅读与临时批注)为准。

PDF frame源码不由Next HMR转译；修改其源码后重启开发进程，统一准备步骤重新生成本地frame资源。常规Host React界面仍使用Next开发流程。
