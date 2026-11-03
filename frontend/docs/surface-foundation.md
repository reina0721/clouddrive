# Surface Foundation

`packages/surface-foundation` 是首个成熟 Product-Surface Foundation，只依赖 Universal Foundation。

- `layout`：Page、Header、Toolbar、Filter、Section、Split View、Sticky Actions。`Section` 是 Panel 类 Section 容器（header + children）；需要「章节导航 + 内容共享父容器内容边界」的组合（如 `TabsView variant="section"` 作章节导航）时使用 `contentInset`（children 包进统一 horizontal inset）或 `SectionBody`（自定义 header 的 Panel body 复用同一 inset）。父容器负责区域分隔（divider/boundary）；Tabs 等子组件不自建 Surface。
- `shell-navigation`：Router Port 上的 Shell Grid、Sidebar Navigation 与响应式表现；不依赖 Next。展开态使用 **Active Path Anchored Accordion**（Shell Navigation UX/State Policy）：visual group 只是分类标题、不等于 Accordion parent——顶层所有 Branch 共享单一 `root` scope，真实嵌套 Branch 的下一层以该 Branch 的 navigationId 为 scope，规则递归；每个 scope 同时至多展开「1 个 active branch + 1 个 exploration branch」。active 状态与展开/探索状态是独立状态模型：active ancestor chain 由当前 Route 运行时推导并始终展开，不允许被普通 toggle 收起到隐藏当前 Route；`exploration` 是瞬时用户意图（绑定产生它的 routeKey），真实 Route Commit 后立即失效并清空、由新 Active Path 重算必要展开链，same-route no-op 保留；收起或替换 exploration branch 时同步清理其子树内全部 exploration scope（不残留历史展开）。展开状态由 Navigation Tree 统一管理（scope -> exploration branch），Menu Item 不各自维护 `isOpen`。Branch 使用整行 Disclosure Button，只有 Leaf 触发路由。Compact Sidebar 使用非模态 Submenu Flyout：Flyout 的打开（`openBranchId`）与 Expanded Tree 的 Accordion exploration 分离，hover/open Flyout 不写入 exploration；Pointer Hover 不转移焦点，Trigger/Content 共享关闭走廊，Keyboard Press 与 Escape 继续由 Overlay Contract 管理。
- `collection`：Collection 区域、筛选、结果、分页与 Bulk Action。
- `detail-settings`：Entity Summary、Settings Layout、Timeline。SettingsLayout 的 `persistentNavigation` 为可选空间策略：小于 xl 时分类区域在同一文档滚动流中 sticky，xl 起保持侧栏；默认关闭，不改变不需要持续导航的消费者。设置业务、Pattern 与 Archetype 共享此实现。
- `form-actions`：Create/Edit/Settings 的 lifecycle 与 sticky action composition。
- `states-operations`：与 Universal 一致的 loading/refreshing/background readiness、产品级 partial/readonly/denied/pending、四类结构化 Page Loading 与 Operation 恢复语义；不实现后端任务。
- `styles.css`：Surface-owned spacing/layout token 与 screen/content/bulk/state Motion Recipe。

`/page-patterns/*` 是公共 Pattern authority；`/page-archetypes/*` 只证明七类完整 Page Archetype。Feature 仍拥有字段、Schema、数据、权限、i18n 和状态选择，Foundation 不创建万能 CRUD Page。

## 与 Framework / Surface 的分工

- `packages/surface-foundation`：**可复用视觉与交互**——Layout、Shell 表现、Pattern、State/Motion Recipe；组件只接收业务已决定的内容、状态与动作。
- `packages/plugin-framework`：**契约与纯模型**——Plugin Contract、Route Target、Registry（canonical hierarchy / navigation inheritance / breadcrumb / command / permission）、Host Capability；不依赖 React Router/Next，不读取 pathname。详见 [Plugin Framework 与 Surface File Routes](plugin-framework.md)。
- `surfaces`：**具体 Surface 插件实现**（private workspace）。它组合 foundation 的视觉与 framework 的契约；`plugins/*` 不是公共 API，生成物位于 `generated/`。
- Host（`apps/web`）是唯一把 foundation/framework/surface 装配成可运行应用的地方。

Foundation 不得依赖 Framework 的生成物，也不得反向要求 Host 提供实现；运行时差异通过 Host Port 注入。

## 固定导航与滚动层级

Web Host 的 Header 与启用且固定的页面标签共享一个 sticky chrome。`pageTabsPinned` 缺省 true，
关闭时标签位于 chrome 之外并随文档滚动；页面标签本身的启用偏好维持原默认值。
Host 用 ResizeObserver 测量真实 chrome 高度，向其内容子树提供 `--shell-chrome-height`。
SettingsLayout 的持续分类导航和桌面侧栏只消费此运行时空间变量，不读取 DOM 或 Router。
动态字号、标签开关与视口变化不依赖固定像素叠加。浮层继续由 HeroUI Portal 管理。

派生的 `--surface-sticky-top` 必须在 SettingsLayout / SplitView 的 sticky 消费节点计算，
不能在 `:root` 提前计算：自定义属性继承的是已替换变量的值，根节点无法读取下层 Host
提供的 chrome 高度。移动入口直接贴合 chrome，桌面侧栏额外保留现有 spacing 间距。
顶层设置正文使用 outlined Section 与 contentInset；embedded 仅用于已有外壳内的组合。
桌面SettingsLayout分类区域以动态viewport减实际sticky偏移与既有spacing限制最大高度，
仅超出时内部滚动，保留原生滚动条与键盘focus reveal；手机入口不增加内部滚动层。

分类入口显示当前分类并打开正式 Drawer；搜索仍属于持久 settings layout 状态，具体分类由
Next route 决定。相同分类关闭抽屉而不跳页，字段搜索走明确 fragment / Host focus，浏览器
Back 使用 Next 原生恢复。没有第二个 Router 或公共滚动 Store。路由进入位移在
surface-route-content 使用 overflow-x:clip 收敛绘制范围，该属性不创建滚动容器。

页面标签保持访问顺序，水平溢出只在标签列表内发生；管理入口固定在列表外，桌面/手机均可
定位全部标签与关闭其他标签。选中使用标题和下划线，关闭属于 quiet 辅助操作：非当前标签
降低权重，hover/focus 加强，触屏仍可发现。关闭当前标签后优先邻居、无邻居才回首页，焦点回
新当前标签；不增加拖拽重排或额外动效系统。

验证见 [设置与导航回归](../apps/web/e2e/settings-ux-review.spec.ts)，审查理由见
[108 报告](changes/108-ui-ux-audit/README.md)。

## Shell 展开与纯图标模式

Shell 宽度分别为 surface-shell-expanded-width / surface-shell-compact-width；收缩态
以已有 control-lg 方形热区与 icon-lg 图标形成独立 Rail。分组使用边框与语义间距，
栏宽由 control-lg 加两侧 spacing×4 推导，收缩组保持 control-lg 宽度；顶层图文行内距
同时消费 control-lg/icon-sm，保证密度、增强点击区和模式切换共享图标轴线。
所有导航 list 保留 i18n 名称；ExpandedNode 的图标槽保持 icon-sm，文字/递归结构不变。
NavigationPresenter 只提供填满槽位的装饰图标；Route current 经 RouterPort 传递给
Host 的 aria-current。叶子使用 Adapter NavigationHint，父级使用带标题的同源 Flyout，
不为父级同时打开 Tooltip。切换模式保留 Accordion exploration 与 route current。

Nav 控制使用 data-navigation-control 标记：Flyout Trigger/侧栏模式切换按钮可直接
完成原操作，不让非模态浮层外部关闭机制吞掉第一次点击；其它外部关闭与 Escape
仍由 Overlay 管理。移动端小于 lg 保持完整 Navigation Drawer，不使用图标 Rail。
Host 的 remember 在原 v1 key 中追加可选上次模式字段，缺字段旧记录保持默认行为；
主题/语言等无关偏好更新不复位侧栏。设计与验证见
[Sidebar 专项](changes/109-ui-ux-optimization/design/sidebar-review.md)。

## 布局模式与菜单呈现覆盖（116）

- `ShellRoot` 接受 `layout?: 'vertical' | 'horizontal'`，并以 `data-layout` 切换网格：
  `horizontal` 时只有单列（侧栏由 Host 省略），`vertical` 保持 sidebar + content 两列。
  混合布局由 Host 在 `vertical` 网格内只渲染当前分组，不新增第三套网格。
- 三种布局（侧边 / 顶部 / 混合）共用同一 Navigation 模型、权限过滤和路由；导航正文仍由
  `ShellNavigation` 拥有，顶部导航只做分组入口重组。
- **菜单标题/可见性/排序/权限码覆盖属于 Host 运行期业务数据**（`clouddrive.navigation-admin`
  - `@clouddrive/plugin-framework/navigation-admin` Port），不是 Surface Foundation 契约；
    Surface 只消费已经决定好的 groups。部署期 Plugin Registry 仍是路由与组件唯一真相。
- 水印与锁屏属于 Host Shell 表现（需要当前身份与全局遮挡），不下沉到 Foundation；
  Foundation 不反向依赖身份或会话。
