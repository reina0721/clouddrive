# clouddrive 前端

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
