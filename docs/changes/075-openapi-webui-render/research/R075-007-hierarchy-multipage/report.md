# R075-007 层级分类与多页面：openapi 从单页堆叠改为分组多页面

## 研究问题

用户第六轮要求「请做层级分类，不要放到一个页面上」。当前 72ba96f 的单路由 `/openapi` 页面把全部内容堆叠在同一页：搜索 + tag 筛选 + 全量接口 DataTable、模型区、命令面板、详情 Drawer。用户要求改为**层级分类**（分类/分组 → 接口列表 → 接口详情）且**不要都放一个页面**（多页面结构）。

需要回答：

1. 平台路由契约是否允许模块内多页面（多个路由）？动态选择（tag/接口/模型）如何在不引入路径参数的前提下表达？
2. 平台是否已有「多页面 + 页内层级导航」的成熟模式可复用，而不是再自绘一套导航壳？
3. openapi 的层级数据（tag、模型、操作）在快照中如何组织，静态路由如何映射？

## 方法与范围

- 读取 `internal/webui/contract.go`：`Route` 的 `GroupLayoutID`、`validateBindings`/`validPath` 的路由校验（静态路径、无 query/fragment/参数）。
- 读取 settings 模块（073 的承载实现）：`binding.go` 8 个分区路由共享 `GroupLayoutID: settings.layout`；`webui/src/App.tsx` 的 `renderAppRoutes`/`ModuleGroupLayout`（同 groupLayoutId 一族路由由共享布局承载，`<Outlet/>` 注入内容区）；`SettingsLayout.tsx`（SectionNav 固定页内导航 + children 内容区，路由切换布局不卸载）。
- 读取 openapi 现状组件与数据层：`OpenAPIPage.tsx`（单页堆叠）、`OperationDrawer.tsx`/`ModelDrawer.tsx`（Drawer 详情）、`CommandPalette.tsx`、`openapi-data.ts`（`groupedOperations` 按 tag 分组）、契约快照 tag 集合（Auth/IAM/Navigation/Organization/Todo）。
- 检查宿主导航函数（`webui/src/App.tsx` runtime.navigate 注入 react-router navigate）与 SectionNav 组件（`webui/src/ui/index.tsx`，071 页内侧边栏导航：id/href/activeId/onSelect）。

## 事实

- 路由契约：`Route.Path` 必须通过 `validPath` —— 以 `/` 开头、无 host/query/fragment、非 `/`；**不支持路径参数**。但模块可以声明**多个静态路由**（settings 有 8 个），每个路由有自己的 `EntryID`（页面入口）与 `TitleMessageID`。
- `GroupLayoutID`（073）：同族路由共享一个模块布局入口 entry；宿主按 groupLayoutId 分组渲染，`ModuleGroupLayout` 渲染布局组件并把 `<Outlet/>` 作为 children 传入；**布局在族内路由切换时不卸载重挂**，内容区切换。
- SectionNav（071）：页内垂直分区导航原语（navlist + aria-current + 键盘上下/Home/End），`items` 是 `{id, label, icon?, href?}` 数组，`activeId` 高亮，`onSelect(id)` 回调（href 存在时以链接渲染 + preventDefault 交给宿主 navigate）。
- 宿主 runtime 提供 `navigate(path)`（react-router navigate）；模块布局组件通过 `useOptionalHostRuntime()` 取用（SettingsLayout 范式）。
- openapi 数据：`groupedOperations(spec)` 按操作首个 tag 分组，tag 集合来自快照（Auth/IAM/Navigation/Organization/Todo，共 5 组）；模型 `components.schemas` 键集合；`OperationRow` 带 `tag` 字段（075 已加）。
- 现状深链：`?op=<id>&mode=docs|debug`（operation）、`?model=<name>`（model），用 `history.replaceState` + popstate 同步，Drawer 内呈现。

## 推断

1. **多页面可用**：模块可声明 4 个静态路由 `/openapi`、`/openapi/tags`、`/openapi/operation`、`/openapi/models`，共享 `GroupLayoutID: openapi.layout`；宿主分组布局一次挂载，SectionNav 提供层级导航，内容区为各页面。这完全复用 settings（073）范式，不引入任何新导航壳。
2. **动态选择用 query**：tag 集合来自快照、非编译期固定，不能为每个 tag 生成路由；tag 选择落在静态路由 `/openapi/tags?tag=<tag>`，接口选择 `/openapi/operation?op=<id>&mode=<docs|debug>`，模型选择 `/openapi/models?model=<name>`。这延续既有深链习惯，只是从「同页 Drawer 内 replaceState」升级为「跨页 navigate」。
3. **层级呈现**：
   - 总览页 `/openapi`：分类卡片（每个 tag：名称 + 操作数 + 方法徽标）→ 点击进入 `/openapi/tags?tag=X`；模型入口卡片 → `/openapi/models`；
   - 分类页 `/openapi/tags`：该 tag 下接口 DataTable（方法/路径/操作 ID/操作），行操作「文档/调试」→ `/openapi/operation?op=...&mode=...`；
   - 接口页 `/openapi/operation`：单个接口文档 + 调试（页内分段切换，替代 Drawer 的定位语义），执行/响应卡片保留；
   - 模型页 `/openapi/models`：模型列表 + 属性表（`?model=` 定位）。
   - SectionNav 条目 = 总览 + 各 tag + 数据模型（动态计算），active 由 pathname+query 推断。
4. **组件与数据层复用**：`openapi-data`/`run-store`/`highlight`/`api.ts`/`mock.ts`/`MethodBadge` 不动；`OperationDrawer`/`ModelDrawer` 内容改造为页面分区（Drawer 外壳移除，内容区复用）；`CommandPalette` 保留（选择后 navigate 到对应页面）。
5. **Workspace 标签页兼容**：宿主 WorkspaceTabs 按 visited route id 建标签；多路由会产生多个模块标签（settings 8 分区同样如此），符合平台语义。
6. **约束**：`?tag=`/`?op=` 等是 query，不进入 `Route.Path`（validPath 拒绝），只在运行时 URL 上出现；路由校验、locale 覆盖（路由 TitleMessageID 必须在 locale 中）、entry 与 mock 声明等门禁与 settings 一致。

## 结论

- 【采用】openapi 模块改为 **GroupLayout 多页面层级结构**（沿用 settings 073 范式 + SectionNav 动态条目）：
  - 4 个静态路由：`/openapi`（总览）、`/openapi/tags`（分类接口列表）、`/openapi/operation`（接口文档/调试）、`/openapi/models`（模型）；
  - 共享布局 `OpenAPILayout.tsx`（SectionNav：总览 / tags / 模型；内容区 = children）；
  - 详情从 Drawer 升级为独立页面（`?op=&mode=`、`?model=` 深链不变）；模型浏览独立成页；
  - 命令面板保留，选择后 navigate 到页面；
  - 数据/执行/mock/快照链/图标/别名全部复用，仅重组呈现层与 binding 声明。
- 【不采用】为每个动态 tag 建路由（违反静态契约与冻结路由集）；自绘树形导航壳（平台已有 SectionNav + GroupLayout）。

## 适用与不适用场景

- 适用：模块内按业务层级拆多页面、共享页内导航；动态分组映射 query 选择；详情独立成页。
- 不适用：路径参数路由；每动态项一个路由；重新引入自定义导航/树外观（R075-006 已否决）。

## 局限与剩余未知

- 页内导航条目为动态（tags 来自快照），SectionNav 以 flat 列表呈现 tag 分类；若未来 tag 数量很大（>20）需评估折叠/滚动，当前 5 个 tag 无压力。
- tag 无层级（如 `iam.accounts` 式点分）时只有单层分类；本契约 tag 为扁平集合，层级即「分类 → 接口」两层，模型独立分支。
- 视觉细节以用户对照为准（与 R075-006 相同局限）。

## 对当前任务的影响

- requirements/design/tasks 在本记录（R075-007）基础上更新：多页面层级结构替代单页堆叠；复用既有数据层与执行语义；测试（vitest/Playwright）按新路由与页面重写；binding/registry 重新生成。
