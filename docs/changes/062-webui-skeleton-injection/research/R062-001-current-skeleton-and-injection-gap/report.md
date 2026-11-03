# R062-001 当前 WebUI 骨架、注入面、导航与交互规范的事实与差距

## 研究问题

用户要求一套以「骨架 + 注入点」为核心、覆盖菜单/导航/Shell 布局/交互状态链/权限控制的 Web UI 设计体系。回答（a）当前注入面有哪些、（b）骨架分区处于什么状态、（c）导航/图标/激活态能力如何、（d）交互与权限契约是否缺失，以及（e）轻量接入目标在现有结构上是否可达。

## 方法与范围

- 只读检查：`internal/webui` 契约、`internal/composition/webui_registry.go` 生成器、`webui/src` 宿主与 SDK、模块 Binding 与代表页面、`.scaffold/layout.json`、`docs/development/webui.md` 与 048–061 变更记录（快照 commit 见 metadata）。
- 不修改任何文件；不下结论与运行期行为冲突。
- 外部样本（TailAdmin、WAI-ARIA APG）仅用于判断交互模式参考价值，不进入本报告事实层。

## 证据：当前实现事实（快照 20a634c..eb895e0）

### 1. 注入面（模块可声明、宿主可装载的内容）

| 注入面 | 声明位置 | 生成/投影 | 运行时装载 | 权限门禁 |
| --- | --- | --- | --- | --- |
| Route（内容区页面） | `webui.Binding.Routes`（ID/Path/EntryID/Title/ViewOperationID/Layout/DeliveryState/Default） | 生成 `webuiEntryRegistry` lazy import；Manifest `routes` | `App.tsx` 按 manifest 装配 app/blank 两种 layout，`ManifestPage` 懒加载 entry | route 级 `ViewOperationID → access`（allowed/authentication-required/denied）+ availability（available/degraded/unavailable） |
| Navigation（菜单） | `webui.Binding.Navigation`（ID/ParentID/RouteID/Title/IconID/Order）+ NavigationPolicy 覆盖（enabled/parent/order） | Manifest `menu`（含默认策略或 DB policy 快照） | `SidebarMenu` 递归渲染 | 仅当 route 可加载且 menu 可见时进入 menu |
| Locale（语言资源） | `Binding.Locales`，namespace 归模块 | `webuiLocaleRegistry` | `ensureRouteLocale` 按 route 懒加载 | 无（强制 i18n 契约） |
| Mock 数据 | `Binding.MockSource`（模块自有 `mock.ts`） | `webuiMockRegistry` + `webuiMockManifest` | `readWebUIDataSource()==="mock"` 时 mock router 接管 | 无（显式环境声明） |

### 2. 骨架分区现状

- 宿主区域组件：`AppSidebar`（品牌+递归菜单+移动抽屉）、`AppHeader`（topbar：trigger/breadcrumb/search/主题/语言/全屏/账号）、`WorkspaceTabs`（已访问页签、roving keyboard）、`AccountMenu`、`ShellSkeleton`/`PageSkeleton`、Footer（`app-footer`）。
- 区域都是硬编码 JSX 结构 + `styles.css` token；**没有把「某区域可插入模块贡献」作为类型化概念**。模块唯一能进入骨架的路径是 `route`（内容区）与 `menu`（侧边栏导航）。
- 页面级原语已存在：`PageHeader`（eyebrow/title/description/actions）、`Surface`、`DataToolbar`、`FilterPanel`、`DataTable`（含选择列）、`Pagination`、`EmptyState`、`InlineAlert`、`Toast`、`ConfirmDialog`、`Drawer`、`StatusPill`、`CapabilityBanner`、`Skeleton`。这些是模块可用的公共能力，但没有统一的交互状态链和动作权限契约。

### 3. 导航能力

- 多级：`Navigation.ParentID` 任意层级，`validateBindings`/`BuildNavigationPolicySnapshot` 做无环与父引用校验；`SidebarMenu` 递归渲染，缩进 `paddingLeft: 11 + level*14`（硬编码像素，非 token）。
- 激活态：`menuContainsRoute` 祖先链高亮、`findMenuAncestors` 自动展开；collapsed 态保留 icon/tooltip；移动抽屉 inert/focus trap。
- 图标：`iconId` 是字符串，宿主 `MenuIcon` 只映射 `activity`/`user`，其余渲染 fallback span；**没有受控图标目录、没有服务端校验 iconId 取值**。

### 4. 交互与权限契约

- 权限：只存在 route 级 `ViewOperationID → Manifest.access` 与 `principal.scopes`（账号权限 key 列表）。页面内动作（创建/禁/重置/保存等）**没有权限投影**，也没有前端动作级可用性判断；页面通过 route 可加载性进入后，按钮一律可点（真正授权靠服务端拒绝后前端把错误映射为 message ID）。
- 交互状态：`Button` 只有 variant；无 pending（提交中）状态、无防重复提交、无禁用原因分类（permission/unavailable/busy/form-invalid）。模块页面（如 `AccountsPage`）手写 `useState` 管理提交状态与消息文本（`saved +N −M` 拼字符串在客户端，部分未遵守「error code → message ID」链路之外的自有反馈文本）。
- 成功/失败反馈：`Toast`/`InlineAlert` 存在但未被页面统一采用；表单无统一提交/重置行为契约。
- ARIA：Dialog/Drawer 有 trap；按钮 pending 无 `aria-busy` 约定。

### 5. 轻量接入现状

普通模块接入路径：实现模块 + `binding/webui/binding.go` + `web` facet（页面/api/locale/mock/CSS Module）+ composition 唯一 module 列表 + 重新生成。宿主/SDK/generator 源码在既有能力内零修改。接入「页面+菜单+语言+mock」已经轻量；但一旦需要顶栏入口、侧边栏面板、页头扩展、页签操作、底部状态等骨架区域内容，**当前没有可声明的契约**，模块只能停在 route/menu 面上。

## 事实与推断的区分

**事实（有代码证据）**：注入面四类；骨架区域组件存在但无类型化注入点；多级菜单、祖先激活、递归渲染已实现；缩进为硬编码像素；iconId 无受控目录；无动作级权限投影；无统一 pending/禁用/反馈状态链；`principal.scopes` 携带权限 key 但页面不消费；route 级 access 由服务端判定后投影进 Manifest（不是客户端自行判定）；mock 环境通过生成 registry 全量覆盖。

**推断（需要设计确认）**：
- 用户可以接受「注入点 = 静态源码级插拔」语义（与 048/056/059 排查结论一致，用户在本变更起始消息与后续消息中均未要求运行时插件）。
- 动作级权限的呈现控制（隐藏/禁用按钮）不应构成真实授权，真实授权仍由服务端 operation policy 决定（与现有「manifest 访问状态不构成授权」文档一致）。
- 图标目录采用宿主受控集合 + 服务端校验，可避免图标字符串漂移；自定义 icon entry 属于后续议题。

## 差距清单（按用户需求逐项）

| 用户需求 | 现状差距 | 判定 |
| --- | --- | --- |
| 导航多级 + 图标 + 缩进 + 激活态 | 多级/激活已具备；图标目录缺失、缩进非token、深层视觉未规范 | 需要升级（中等） |
| 骨架分区注入点（顶栏/侧边栏/内容/页头/页签栏/底部） | 无类型化注入点；content 只有 route、menu 只有导航 | 结构性缺失（大） |
| 注册/渲染/路由/权限钩子 | 注册/路由有（Binding→registry→Manifest）；渲染只覆盖 content；权限只有 route 级 | 需要扩展（大） |
| 交互状态链 + 权限控制全部可交互元素 | 无统一状态链、无动作权限投影、无禁用原因分类 | 结构性缺失（大） |
| 轻量接入 | 现状已轻量（页面菜单语言 mock）；骨架区域接入无契约 | 需要扩展契约并保持轻量 |
| 骨架本身 | 分区组件存在但单薄：无 zone、页头/批量条/页签操作/底部状态无规范容器 | 用户已确认需要升级进阶 |

## 适用与不适用场景

- 适用：为当前仓库新增骨架分区注入点、统一交互规范、图标目录与动作权限投影；升级骨架视觉与容器原语。
- 不适用：运行时插件/远程模块（明确非目标）；把前端权限当作授权边界；引入微前端或替换组件库（见 R062-002）。

## 局限与剩余未知

- 未运行浏览器人工验收（E2E/视觉不属于只读研究），运行期观感以既有 059/061 提交证据为准。
- 交互状态链的最终视觉细节（尺寸/颜色/动效）依赖设计 token 扩展与真实页面校准，属于实施期验证项。
- 骨架注入点在 mock 环境的呈现细节（占位/徽标）未实测，设计按 mock 覆盖既有机制（生成 registry 聚合）推演。

## 对本任务的影响

- 结论：在现有静态插拔主线上做结构性扩展（分区注入点 + 交互/权限契约 + 骨架进阶），不需要更换承载架构。
- 契约演进方式：`webui.Binding` 增加类型化 zone 字段（保持既有字段语义不变），生成器/manifest/SDK/宿主分区组件按 zone 分型扩展，保证 053「不建立万能 Contribution」红线不被突破。
- 研究门禁：关键问题证据充分，足以形成计划。