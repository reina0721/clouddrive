# 101 Admin Framework / Surface File Routes

## 范围与状态

本变更落地 Admin 的「Plugin Contract → Registry → Surface → Host」文件路由体系：

- `packages/admin-framework`：Admin Surface 插件契约（Plugin Contract）、Route Target、
  Registry（canonical hierarchy / navigation inheritance / breadcrumb / command / permission）、
  Host Port / Host Capability Contract。
- `surfaces/admin`（`@clouddrive/admin-surface`）：Admin Surface 私有 workspace，
  只公开 `shell`、`generated/*`；`plugins/*` 永不对外暴露。
- 确定性 codegen：`tooling/admin-codegen` 只做 Discovery / Contract Validation /
  Framework Descriptors / Catalog / i18n 聚合 / Module Bridges / Host 薄入口，
  并执行 Static Export Host capability gate（`[param]` 路由硬失败）。
- 参考插件 `reference-resources`：列表 / 创建 / 详情 / 编辑四条静态文件路由，
  覆盖 navigation contribution、create/detail/edit inheritance、canonicalParentOverride、
  Route Target Link 与 imperative navigation、Route Context 发布、Registry 派生 Sidebar。

本阶段只实现 Framework、Surface 私有边界、Reference Plugin、Generator、Registry、
gates 与最小 Shell bridge；完整 Shell 视觉、既有页面迁移、Legacy Navigation、
Shell CSS 与 Host 路由迁移推迟到后续 Migration Phase（见 tasks.md）。

研究门禁：已通过 `R101-001`。
计划状态：已确认，实施、验证与任务提交完成。

## 阅读顺序

1. [Surface 文件路由与 codegen 约束研究](research/R101-001-surface-file-routes/report.md)
2. [需求](requirements/admin-surface-file-routes.md)
3. [设计](design/README.md)
4. [任务与证据](tasks.md)

## 关键决策

- Next.js App Router 是唯一真实 Router；Framework 永不读取 pathname、不维护 history、
  不复制 Next Route Runtime。Host Port 属于 application runtime context（Root Provider 安装一次）；
  Route Context 属于当前被选中的 Route（每个 Generated Route Entry 发布一次）。
- Plugin 只能导入 `@clouddrive/admin-framework/plugin`；禁止 `next/*`、
  `generateStaticParams`/`generateMetadata`/Next route config exports、
  手写 URL、用全局 location/history 做应用内导航。
- `routeId`/`navigationId` = `${pluginId}.*`（根 Route = pluginId）；跨 Plugin 引用禁止；
  覆盖必须同 Plugin 并附 rationale。
- `page.tsx` 与同目录 `route.meta.ts` 必须 1:1 配对；支持 `[param]` 段，
  禁止 catch-all / parallel / route group / handler。
- Static Export Host 不能承载动态 Plugin Route：进入 descriptors / catalog / 测试，
  但 Host entry 生成前必须失败（`UNSUPPORTED_DYNAMIC_PLUGIN_ROUTE`），
  不降级、不生成 `generateStaticParams`。Framework Contract 合法 ≠ 当前 Host 可部署。
- Registry 只消费 generated catalog 静态 descriptors，在运行时统一派生
  canonical hierarchy、navigation inheritance、tree/group ordering、breadcrumb、
  command/permission 与 Route Target 解析；Generator 不复制 Registry 逻辑。
- `pnpm codegen:admin` / `pnpm codegen:admin:check`：freshness 通过逐文件重建比较
  （missing / drift / stale），原子替换，生成物带 `// @generated` 头。
