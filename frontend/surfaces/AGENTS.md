# Product Surface 实现约束

本目录是 `@clouddrive/surface`（private workspace）：只承载 Product Surface 的
Plugin 业务、shell 模型、Group Alias / icon vocabulary 与 generated 产物，为
dependency ownership、module resolution、typecheck 与 test 服务。

- 具体 Plugin 不是 Package，也不是 Surface 公共 API。对 Host 只开放
  `./shell`、`./preferences-model`、`./identity`、`./identity/runtime`、`./administration`、`./administration/runtime`、`./api-workbench`、`./icon-presentation`、`./icon-components`、`./generated/composition`、
  `./generated/catalog`、`./plugin-routes/*`；
  禁止把 `plugins/*` 加入 exports，禁止通过相对路径绕开 generated shim 导入 Plugin internals。
  `./identity` 只开放当前产品的身份、用户、角色授权、注册策略、账户安全、通知及只读审计模型、Schema 与具体语义 Port/Provider/hook；
  Web 注入实现，Plugin 与 Shell 消费同一契约。不公开 Plugin 私有组件或 Store，
  不在 Surface 契约实现 HTTP、Storage、Session 或后端授权。
  `./administration` 开放当前产品的组织、菜单、字典、待办、运维、Token 和账户偏好模型及 Port；`./administration/runtime` 仅开放 Provider 与 hook，避免将响应校验载入初始 Shell。
- Route Catalog、业务 Route IDs 与 module shims 全部位于 `generated/`；
  产物带 `// @generated` 头，**禁止手改**——修改后运行 `pnpm codegen:plugins` 重新生成，
  并用 `pnpm codegen:plugins:check` 复核 freshness。
- Plugin `routes/` 是一棵**真实 Next App Router 子树**（authority = Next App Router
  本身，不是 Framework 维护的固定文件白名单）：page/layout/template/loading/error/
  not-found 为当前支持的 Next convention（按需存在），采用 **default export**（Next
  惯例）。Plugin 可像正常 app/ 一样 colocate components/services/lib/schema/styles/
  tests/_private 等普通实现文件——Framework 完全忽略它们，不增加 Plugin 语义。
  普通导航可用 `next/link`/`next/navigation`（受控白名单），跨 Plugin 稳定引用可用
  `route()`（`@clouddrive/plugin-framework/target`，Server/Client 均可 import）/
  `RouteLink`/`usePluginNavigation`/`usePluginLocale`
  （`@clouddrive/plugin-framework/plugin`，client）。
- **不存在第二套 Route Contract**：不引入 route.meta.ts / plugin.route.ts /
  route.config.ts 或任何逐 Route 显式声明文件；不要求 page.tsx 配 Framework 契约。
  Route identity 由 Framework 从 pluginId + Next 文件树确定性派生。Next 有语义但
  当前不装配的 convention（route.ts/default.tsx）由 codegen 报
  `UNSUPPORTED_NEXT_CONVENTION`（Host capability 诊断，不静默忽略）。
- 允许依赖 Universal、`surface-foundation`、`plugin-framework`、`form-foundation`、
  `schemas` 与 Surface 基础设施（lucide-react 仅限 surface src 基础设施，不进 Plugin）；
  禁止依赖 `apps/*`、Browser/Desktop API、后端 DTO、请求、Session 或权限实现。
- 新建 File Route / Navigation Contribution 前先读
  [Plugin Framework 与 Surface File Routes](../docs/plugin-framework.md)。
- Sidebar Navigation Contribution（`plugin.navigation.ts`）：
  - 模型固定 Group → Parent → Child；`groupId` **选择** plugins 公共 Group Alias
    （`plugins/navigation-groups.ts` 的 `management` 身份与访问 / `administration` 系统管理 / `system` 个人入口 / `development` 开发中心），
    **不定义** Group；新增 Group Alias 属 plugins 范围公共 IA Contract 变更
    （改 navigation-groups.ts + surface i18n labelKey），不是单个 Plugin 私有声明。
  - `navigationId` 必须 `${pluginId}.` namespace；层级用内嵌 `children`（无
    parentNavigationId / 跨 Plugin parent）；Child 必须带 `routeId` 且静态可解析；
    Parent 无 routeId 为纯 Disclosure（点击只展开/收起），无 routeId 且无 children
    报 orphan。未知 Alias 由 codegen gate 报 `UNKNOWN_NAVIGATION_GROUP` 硬失败，
    禁止 silent drop。
- `navigation.iconId`（可选）是 Plugin Navigation Contribution 的 semantic
  presentation metadata（不是 Plugin capability / 能力协商），必须命中 Product
  Surface icon vocabulary（唯一 authority：`surfaces/src/navigation-icon.ts`，
  受控、不动态化）；未知 iconId 由 codegen gate 报 `UNKNOWN_NAVIGATION_ICON`
  硬失败，禁止静默 fallback。插件只声明语义 id，不贡献 ReactNode/SVG/Lucide 组件；
  扩展 vocabulary 属 Surface 治理。
- Host Deployment Mode（属 Host 构建/部署配置，不属于 Plugin Contract；Plugin 写法不随
  Mode 改变）：`apps/web/.env` 设 `WEB_DEPLOYMENT_MODE=static |
static-enumerated | server`（缺省 static）。**static** 下动态 `[id]` 段报
  `HOST_MODE_CANNOT_DEPLOY`（措辞指向 Mode 非 Plugin 非法）；**static-enumerated** 下
  动态 page 必须自带 `generateStaticParams`（Server Component，不写 'use client'；
  `output:"export"` 构建期枚举），否则报
  `DYNAMIC_ROUTE_REQUIRES_GENERATE_STATIC_PARAMS`；**server** 放行动态与 request-time
  能力。Next build 始终是最终 authority。参考插件 `reference-resources` 使用固定路径
  完成浏览器验证。

## 当前后台产品设计体系约束（Plugin / 业务页开发规范）

这些是**当前 Product Surface 的开发规范，不是 Plugin Contract**。Plugin ownership
独立只表示业务可独立拥有/删除/演进，**不表示视觉、交互、状态、Motion、Page Pattern
可以脱离当前后台产品设计体系**。业务页开发时优先复用和组合项目已有能力；
以下细则禁止逐条另行设计平行实现。

1. **Design Token**：必须使用 `packages/design-system` 已有语义 Token（spacing/
   radius/shadow/typography/motion 等）；不得在业务页硬编码一套新视觉规格
   （hex/rgb/阴影/圆角/动画时长等）。差异经 variant/size/density/slot 表达。
2. **UI Adapter / UI Elements**：优先复用已有 Button、Input、Select、Dialog、
   Drawer、Tabs、Table 等语义组件；不得因 Plugin 独立而重新封装同类基础组件。
   需要新基础能力时先按 frontend/AGENTS §7/§9 判断 Variant、Composition 或扩展
   Foundation（走 Contract 门禁），禁止在 Plugin 内自建第二套基础组件库。
3. **Surface Foundation / Page Pattern**：页面顶层使用 `Page`（`surface-foundation/
layout`），区段优先组合 `PageHeader`、`Section`、`Toolbar`、
   `FilterBar`、`SplitView`、`StickyActions` 等已有 Pattern；业务差异
   通过 composition / slot / variant 表达，不得复制一套新页面骨架（裸 `space-y-*`
   手写 header 的整页结构）。Plugin 页面不得 import `apps/web` 私有实现。
4. **Motion**：正常页面使用已有 Motion Token / Recipe / Page Pattern 提供的统一动效；
   不得自行定义另一套 page-enter / drawer / dialog / overlay / async 动画。
   - Page Enter 是统一页面体验（Host RouteTransition 自动提供）；正常页面**不**手工
     为整页包 ViewportReveal 或自定义进入动画。
   - Page 自动装配 ViewportReveal items scope；独立语义项随滚动首次进入视口，首屏短错峰。设置字段、Card、阅读 List Item 分别触发，禁止把多项 Section 作为单一动画单元；快滚、恢复位置和焦点进入直接稳定。
   - reduced-motion 由项目级 Motion Policy 统一控制，页面不自行判断。
   - 方向过渡（forward/back）由 Host `data-route-kind` + Motion Token 纯 CSS 自动
     提供（`surface-enter-forward`）；同路由内容替换用 `ContentSwapTransition`
     （TabsView 已接入）。Plugin 页无需、也不得自行接动画；**禁止依赖 React
     `ViewTransition` 组件**（stable react 不导出，运行时 undefined）。
5. **State**：Plugin 私有状态放 Plugin `stores/`（filesystem ownership），用
   `@clouddrive/state-foundation` 创建（createAppStore/createPersistStore，持久化
   经 definePersistConfig 显式 opt-in）；禁止直接 import zustand、禁止 import
   Host/Shell/其它 Plugin 的私有 store、禁止 import testing subpath 到 production。
   跨 Host/Plugin Runtime boundary 的能力经正式 Port（locale/navigation），不为
   Store 建 Port。UI 呈现态（StateSurface/AsyncRegion/productStates）仍属
   surface-foundation，与 state-foundation 的 Store 机制职责分离。
6. **Loading / Error / Empty / Feedback**：优先使用已有统一 State / Feedback Pattern
   （StateSurface、AsyncRegion、Feedback 等）；不得各 Plugin 自行设计一套视觉语言。
7. **i18n**：业务文案遵守现有 i18n runtime 与 ownership 规则（见下），不硬编码本可
   进入项目语言体系的产品文案。i18n 顶层 namespace 分三类 owner：
   - **Plugin-private**：仅该 Plugin 消费（如 `uiElements.*`），放 Plugin i18n.ts；
   - **Shell-private**：Host Shell UI 自身文案（`shell.*` 等），放 Host resources；
     禁止 Shell 引用任何 Plugin 的 namespace（删 Plugin 后 Shell 必须完整运行）；
   - **Product Surface shared**：跨 Plugin/跨模块共享词（Group Alias `shellNavigationGroups.*`
     等），放 surface src/i18n.ts。
     不同 owner 声明同名顶层 namespace 由 codegen i18n namespace collision gate 拦截。
8. **Navigation / Route**：Route 用 Next 原生能力；Navigation 用 Plugin Navigation
   Contract（plugin.navigation.ts）；不得为追求统一 UI 重新包装第二套 Router。

**Showcase 与业务同源**：`/ui-elements`、`/motion`、`/page-patterns`、
`/page-archetypes`、`/states`、`/foundations` 是 Authority/Showcase，其页面使用与
真实业务页面同一套 Foundation/Pattern/Recipe（当前均已走 `Page` 统一结构）；
禁止「Showcase 一套、业务另一套」。
