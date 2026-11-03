# 073 全局菜单两级化 + 分组布局（页内导航固定单实例） — 需求与设计

> 支撑研究：[R073-001](research/R073-001-current-hierarchy/report.md)

## 1. 目标

1. **全局菜单两级**：顶级「设置」（Settings，落地 /settings/profile）→ 五分区子项；移除「管理中心」宿主分组层（host.center 不再装配）。
2. **页内导航只加载一次、固定**：/settings/* 共享一个分组布局（模块贡献固定布局 entry：SectionNav 常驻 + 内容区），切换分区只替换内容，SectionNav 不卸载重挂（不再由每个分区页面各自渲染）。

## 2. 菜单两级化改动

| 位置 | 改动 |
| --- | --- |
| internal/composition/http_contracts.go | 删除 `applicationWebUIHostNavigation()` 装配（HostNavigation 契约能力保留在 internal/webui，文档记录） |
| internal/module/settings/binding/webui/binding.go | `settings.center` 去掉 `ParentID`（顶级组，title 已是「设置/Settings」），Order 20 |
| webui/src/i18n/locale/*.json | 删除无引用的 `webui.host.navigation.center.title` |
| composition 测试 / e2e | settings.center 顶级边断言；侧栏顶层「Settings」、不再出现「Management center」；059 `Expand submenu` 仍 `.first()`（侧栏两可展开组） |

## 3. 分组布局（页内导航固定）

### 3.1 契约（internal/webui）
- `Binding.Route` 增加可空 `GroupLayoutID string`：引用**本模块** entry 作为布局入口；同一 GroupLayoutID 的一族路由共享一个布局。
- validate：非空时 GroupLayoutID 必须存在且属于本模块 entry（勿引用他人）；布局 entry 同时可被路由作为页面入口（无冲突）。
- `ManifestRoute.GroupLayoutID`（omitempty）随 manifest 输出；registry 生成带出新字段。

### 3.2 宿主路由（webui/src/App.tsx）
- app 组渲染：按 `route.groupLayoutId` 分组——无 group 路由保持现状；有 group 的路由包进 `<Route element={<ModuleGroupLayout route={route}/>}>{子路由}</Route>`；
- `ModuleGroupLayout`：lazy 加载布局 entry（`entryComponents[route.groupLayoutId]`）→ `ensureRouteLocale(groupRoute)`（组内同 namespace）→ 渲染 `<Layout><Outlet/></Layout>`（布局组件只接收 `children`，无 router 依赖，模块边界保持）。

### 3.3 settings 模块
- 新 entry `settings.layout` → `SettingsLayout.tsx`：固定 `SectionNav`（8 分区，`currentSettingsSection(pathname)` 高亮，`useOptionalHostRuntime().navigate` SPA 切换）+ `<div class="settings-content">{children}</div>`；
- binding：八个路由 `GroupLayoutID: "settings.layout"`；
- 八个分区页面去掉各自 `SettingsNavLayout` 包裹（还原为 PageHeader + page-sections），不再重复渲染导航；`SettingsNavLayout` 退役（单轨，逻辑并入 SettingsLayout）。

### 3.4 e2e「固定」断言
- 切换分区前后对同一 `nav.section-nav` 节点打 dataset 标记，断言标记保留（卸载重挂会丢失）——验证「只加载一次、固定」。

## 4. 验证

- Go：`go test ./internal/webui/... ./internal/composition/... ./internal/module/settings/...`；`go run ./cmd/app webui generate`；openapi/inventory 生成物（GroupLayoutID 进 schema？为最小，ManifestRoute.groupLayoutId 属 webui manifest，不进 OpenAPI——确认无 huma 关联）。
- WebUI：typecheck/lint/i18n/modules/vitest/build/generate:check。
- Playwright 20（070/071/072 断言适配 + 新增固定导航标记断言与截图 073-settings-layout.png）。

## 5. 边界

- HostNavigation 机制（internal/webui 能力）保留，当前应用不再装配 host.center；
- 页内分区仍 8 个、深链 /settings/* 不变；语言/关于/鸣谢/资料/注销能力不变。