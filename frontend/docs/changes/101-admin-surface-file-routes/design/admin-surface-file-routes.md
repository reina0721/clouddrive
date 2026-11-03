# Admin Framework / Surface File Routes 详细设计

设计由 `R101-001` 支撑。本节描述 101 已确认范围内的模块边界、数据与控制流、生命周期、
错误语义与治理方案。

## 1. 分层与所有权

```text
packages/admin-framework      Surface 契约层：Plugin Contract / Route Target / Registry /
                              Host Capability / Host Port / Route Context
surfaces/admin (private)      Surface 实现：plugins/*（业务）+ src/（shell、taxonomy、composition）
                              + generated/*（codegen 产物，只暴露 catalog/composition/routes）
apps/admin-web                Runtime Host：Next Router / Shell 装配 / Host Navigation Port /
                              i18n 聚合 / Registry 派生导航消费
```

- Framework 不读取 pathname、不维护 history、不复制 Next Route Runtime。
- `surfaces/admin` 的 `exports` 只暴露 `./shell`、`./generated/catalog`、
  `./generated/composition`、`./generated/routes/*`；`plugins/*` 永不对外暴露，
  治理门禁禁止 Host/公共包导入 `@clouddrive/admin-surface/plugins*`。
- 依赖方向：surface → universal 或同 surface；host → universal 或同 surface；
  `@clouddrive/admin-surface` 只允许 `apps/admin-web` 消费。

## 2. 文件路由输入契约

每个插件目录：

```text
plugins/<plugin-id>/
  plugin.ts                 export const pluginDefinition = { pluginId, mount } satisfies ...
  i18n.ts                   export const pluginI18nResources（可选）
  routes/
    page.tsx + route.meta.ts          → 根 Route（routeId = pluginId）
    create/page.tsx + route.meta.ts   → 子 Route（routeId = pluginId.create）
    detail/page.tsx + route.meta.ts
    edit/page.tsx + route.meta.ts     → canonicalParentOverride → pluginId.detail
```

- `route.meta.ts` 只允许：`navigation{navigationId,labelKey,groupId}`、`titleKey`、
  `canonicalParentOverride{routeId,rationale}`、`activeNavigationOverride{navigationId,rationale}`、
  `permissions`；不得声明 path/parent/page import。
- `page.tsx` 必须是 `'use client'` 组件文件，恰好一个具名组件导出；
  禁止 Next 专用导出（`generateStaticParams`/`generateMetadata` 等）。
- 文件树支持 `[param]` 段；禁止 catch-all / parallel / route group / handler。
- 动态 Route 是 Framework 合法项，进入 descriptors/catalog/测试；但 Static Export Host
  在生成 Host 入口之前必须硬失败（`UNSUPPORTED_DYNAMIC_PLUGIN_ROUTE`），不降级为 warning，
  不生成 `generateStaticParams`。

## 3. Registry（运行时纯模型）

`createAdminRegistry(catalog)` 输入 generated catalog，输出：

- `routes`：每条 descriptor + `canonicalParentRouteId`（文件树最近祖先 page，或 override）、
  `ancestorRouteIds`、`activeNavigationId`（navigation inheritance：自身声明或最近可见祖先）、
  `orphan`（无可见导航且无可见祖先 → 诊断 `ORPHAN_ROUTE`）、`breadcrumbLabelKey`。
- `navigationTree`：只有声明 navigation 的 Route 进入；按 `groupId` 分组，组内保持 catalog 顺序。
- `breadcrumbs`：沿 canonical hierarchy 派生（不含自身，末位 current）。
- `commands`：有 navigation 或 titleKey 的 Route（命令检索用）。
- `permissions`：`routeId -> permissions[]`。
- `diagnostics`：重复 id/pattern、跨 Plugin override、缺 rationale、orphan 等。

Route Target 解析 `resolveAdminRouteTarget(registry, target)`：未知 routeId → `UNKNOWN_ROUTE`；
缺失/多余 params → `MISSING_PARAMS` / `EXTRA_PARAMS`；按段编码构造 href。

## 4. Codegen（确定性管线）

`tooling/admin-codegen/codegen.mjs`：

1. Discovery：遍历 `surfaces/admin/plugins/*`，加载 `plugin.ts`，扫描 `routes/` 树。
2. Contract Validation：1:1 配对、禁止段/导出、namespace、override、冲突。
3. Descriptors/Catalog：写 `generated/catalog/catalog.ts`（plugins + routes 静态 descriptors）。
4. Composition/i18n：写 `generated/composition/composition.ts`
   （`createAdminRegistry(catalog)` + 聚合 surface/plugin i18n resources）。
5. Module Bridges：每个 Route 一个 `generated/routes/<routeId>.tsx`：接收稳定 params，
   发布 Route Context（`AdminRouteContextProvider`），委托 plugin 具名组件。
6. Host Capability Gate：存在 `[param]` Route → 抛出并停止（硬失败）。
7. Host 薄入口：为静态 Route 写 `apps/admin-web/src/app/<pattern>/page.tsx`
   （`await params` 后转发 bridge）。
8. 全部产物经 Prettier 序列化后写入，带 `// @generated` 头。

`--check`：不落盘，重新构建期望文本并逐文件比较 `missing / drift / stale`；
`pnpm codegen:admin:check` 纳入 `pnpm check`。

## 5. Host 装配（本阶段最小）

- `next.config.ts`：`transpilePackages` 增加 framework 与 surface。
- `apps/admin-web/src/i18n/i18n.ts`：把 `generatedSurfaceI18nResources` 合并进 Host resources
  后创建 `adminI18n`（Composition 聚合）。
- `apps/admin-web/src/host/admin-route-target-resolver.ts`：Host 唯一 Route Target → href 解析
  （用 `generatedSurfaceRegistry` + `resolveAdminRouteTarget`，失败抛错保持语义）。
- `apps/admin-web/src/host/admin-navigation-port.tsx`：`AdminHostNavigationPortProvider`
  在 AppShell 内（Router 上下文内）一次性安装：`renderLink` 用 Next `Link`，
  `navigate/replace` 用 Next `router.push/replace`，全部走 markForwardRouteIntent/beginNavigation。
- `apps/admin-web/src/shell/plugin-navigation.ts` + `navigation.ts`：
  `convertRegistryToShellNavigation(registry)` 派生 NavigationGroup，合并进
  `combinedShellNavigationGroups` 供 Sidebar 与 Command 消费。

## 6. 错误与失败语义

- Validation / Capability 失败直接抛错（codegen 退出非零、列出可定位信息），不静默降级。
- Route Target 校验失败在 Host resolver 抛错（`UNKNOWN_ROUTE`/`MISSING_PARAMS`/`EXTRA_PARAMS`）。
- Plugin 在缺少 Navigation Port Provider 时抛明确错误。

## 7. 治理扩展

- `foundation-policy.json`：`kind: foundation|framework|surface`；命名规则分别要求
  `packages/<surface>-foundation`、`packages/<surface>-framework`、`surfaces/<surface>`。
- `check-foundation-governance.mjs` / `check-dependencies.mjs`：扫描增加 `surfaces/`；
  公共 package/surface 必须有 Contract registry；dependency policy 登记 framework/surface 边界。
- `check-boundaries.mjs`：`workspaceOf` 支持 `surfaces/`；surface 源码禁止浏览器 Host API；
  Host/公共包禁止导入 `@clouddrive/admin-surface/plugins*`；
  公共包禁止依赖 `@clouddrive/admin-surface`。

## 8. 参考插件 `reference-resources`

固定四条静态路由验证：list（navigation contribution，`admin.reference` 分组）、
create（继承 list）、detail（继承 list）、edit（`canonicalParentOverride → detail`）。
i18n 覆盖 zh-CN/en；页面只使用 `route()`/`AdminRouteLink`/`useAdminNavigation` 跳转。

## 9. 验证方案

- 单元：framework registry/target/host-capability/plugin API；surface taxonomy/composition；
  generated composition（4 条路由模型断言）。
- 门禁：foundation / architecture / dependency / codegen freshness / lint / format。
- 类型：framework、surface、web 各自 typecheck。
- 浏览器：Playwright 覆盖列表/创建/详情/编辑、Route Target 导航、imperative 导航、
  Axe WCAG AA、视觉基线、窄屏英文无溢出。

## 10. 推迟到 Migration Phase（本阶段不做）

- 既有页面与既有静态导航迁移进 Registry；Legacy Navigation 冻结冲突处理。
- 完整 Shell（Sidebar/Breadcrumb/Command/Permission 全量呈现）、Shell CSS、
  Host 路由迁移清单与 i18n 索引治理。
