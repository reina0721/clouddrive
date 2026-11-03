# R101-001 Admin Surface 文件路由、确定性 codegen 与承载边界

## 1. 研究问题

在「Next.js App Router 是唯一真实 Router」的前提下，Admin Surface 如何让 Plugin 用文件路由贡献业务页面，
同时保证：Framework 不复制 Next Route Runtime；生成结果确定性可复核；Static Export Host
不能承载的动态路由在生成 Host 入口之前以硬失败暴露，而不是运行时 404。

## 2. 已核实事实

- `apps/admin-web/next.config.ts` 为 `output: 'export'`，页面 `params` 在 Next 16 是 `Promise`，
  薄入口必须 `await` 后转发稳定 params（官方 page.md 文档核实）。
- `routeId`/`navigationId` 采用 `${pluginId}.*` namespace 时，Registry 可用
  `routeId.split('.')[0]` 判定 plugin 归属，跨 Plugin 引用可静态检测。
- Node v24 原生 type-stripping 可加载含 `import type`/`satisfies` 的 `.ts` 元数据模块，
  因此 Generator 直接动态 import `route.meta.ts`，不需要 tsx 依赖。
- 现有 Shell（`AdminShellNavigation`）已通过 `NavigationGroup[]` + `AdminRouterPort` 抽象，
  Host 的 `usePathname`/`Link` 只在 `apps/admin-web` 出现；Surface 派生模型可以纯函数转换后接入。
- 现有治理脚本 `check-foundation-governance.mjs` 与 `check-dependencies.mjs` 只遍历
  `apps/` 与 `packages/`；`check-boundaries.mjs` 的 `workspaceOf` 同样只认识这两个前缀，
  不扩展就无法治理 `surfaces/` 的私有边界与 Host 泄漏。
- Prettier 按根配置格式化：生成物若不经过 prettier 序列化，`format:check` 与
  codegen freshness 会互相打架；生成器必须内置 prettier 格式化后再写入/比较。

## 3. 推断

- Framework 应只拥有静态契约（descriptors/catalog/meta）、纯 Registry 与 Host Port/Capability
  契约；Registry 在运行时统一派生 hierarchy/inheritance/breadcrumb/command/permission/target
  解析，Generator 不复制该逻辑。
- Plugin 页面不能暴露 Next Module API：bridge 接收稳定 params，发布 Route Context，
  再委托 plugin 具名组件；Host 薄入口只做 `await params` 转发。
- Static Export Host 对 `[param]` 路由必须硬失败：把 capability 判定放在任何
  Host 入口生成之前，错误即 codegen gate 失败，符合「错误完整向上导出，不静默降级」。
- 治理工具必须扩展 `surfaces/`：workspaceOf、governance 扫描、dependency policy、
  foundation policy kind（framework/surface），否则 Surface 私有边界无法机器可执行。

## 4. 对 101 的强制影响

1. 新建 `packages/admin-framework`（Plugin Contract / Registry / Host Capability / Route Context）。
2. 新建 `surfaces/admin` 私有 workspace：只导出 `shell`、`generated/*`，`plugins/*` 永不暴露。
3. 新建 `tooling/admin-codegen`：Discovery → Validation → Emission（含 prettier 序列化）
   → Host capability gate → freshness `--check`。
4. 扩展 foundation/dependency/boundary 治理以覆盖 `surfaces/` 与 `kind` 分类。
5. Host 装配：transpilePackages、i18n 聚合、Root Provider 安装 Host Navigation Port、
   AppShell 消费 Registry 派生 Navigation 分组。
6. 参考插件 `reference-resources` 固定四条静态路由验证全链路（本阶段不引入 `[param]`，
   其 Framework 合法性与 Host 硬失败语义由单测覆盖）。

## 5. 局限与刷新

本研究不判断非静态 Host、后端路由、权限引擎或 Server Component 数据源。出现新 Runtime、
Next 文件契约变化、pnpm/Node 版本变化或新增 Product Surface 时，应定向复核并更新本记录，
不把 101 结论默认为永久权威。
