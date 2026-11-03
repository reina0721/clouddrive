# R001 当前 WebUI 骨架与交互缺口

## 1. 研究问题与范围

本研究核对当前 WebUI 是否真的“缺少后台骨架”，以及用户感受到临时感的根因位于功能、视觉、动效、loading state、响应式还是代码组织。范围只覆盖宿主和公共 UI，不把业务页面内容、后端 API 或权限模型扩大进来。

## 2. 已实现事实

### 2.1 宿主能力不是空白

`AppShell` 已经承载以下真实能力：

- desktop sidebar 展开/收起与 mobile drawer；
- Header、breadcrumb、workspace tabs 和当前页刷新；
- route search、全屏、语言、明暗主题、主题抽屉和账号退出；
- Manifest 驱动的递归菜单、访问过滤与模块路由承载；
- Footer、暗色主题、内容密度和显式减少动效偏好。

`App.tsx` 已用 `Suspense`、locale resource boundary、route error boundary 和状态页表达模块加载、资源失败、权限与交付状态。当前问题不能描述成“完全没有骨架”。

### 2.2 公共 UI 已形成项目自有边界

模块通过 `@webui/sdk/ui` 使用 Button、Field、Surface、StatusPill、Skeleton、DataTable、Pagination、Toast、ConfirmDialog 和 Drawer。业务页面、locale 与 CSS Module 仍由业务模块持有；根平台样式只应持有 reset、token、Shell 和公共 SDK UI。

源码中没有 `@heroui/react` import；当前活跃边界是项目自有 UI SDK，而不是 package.json 中仍声明的 HeroUI。

### 2.3 已有视觉证据

现有 Playwright 产物覆盖 App Shell desktop/mobile、dark desktop，以及 Auth login desktop/mobile。截图证明当前布局可用、信息真实、暗色与移动断点可工作；它们也显示出紧凑字号、Header 操作拥挤、侧栏层次弱、认证页留白单调、surface/detail 层次有限等可见问题。

## 3. 代码与交互缺口

### 3.1 Shell 状态过度集中

`AppShell.tsx` 当前约 212 行、19.5KB，同时管理 collapsed、mobile、search、theme、logout、visited tabs、expanded menu、viewport 与 focus restoration。单个组件既做状态协调又输出 Sidebar/Header/Tabs/Footer/菜单树，增加了局部交互迭代和针对性测试成本。

### 3.2 布局动画不同步

侧栏自身对 `width` 做 200ms transition，但 `.app-shell` 的 grid column 在 collapsed class 切换时立即变化。结果是侧栏宽度和内容位移不是同一个时间轴，容易形成跳变。移动侧栏使用固定 `translateX(-1000px)`，而不是由自身尺寸驱动的 transform token。

### 3.3 overlay 与菜单进退场不完整

- 子菜单通过条件渲染直接挂载/卸载，仅 chevron 有旋转 transition；内容高度与 opacity 不过渡。
- `RouteSearch` 在关闭时直接返回 `null`，overlay 和 dialog 没有退出态。
- 账号入口使用原生 `<details>`，没有统一的 click-outside、Escape、focus return 和进退场模型。
- Drawer、ConfirmDialog 和 backdrop 已有基础 transition，但 Toast、按钮 active、页面内容进入和多数 surface state 没有统一 motion token。

### 3.4 loading skeleton 只覆盖文本线

当前 `Skeleton` 是三条 opacity pulse 文本线；route locale 和 lazy entry 加载使用三个跳点。它们不保留 Header/PageHeader/card/table 的近似几何，真实内容出现时会产生明显的视觉重排，也无法区分 Shell boot、页面资源加载和表格加载。

### 3.5 减少动效没有完整消费系统偏好

主题的 system mode 会监听 `prefers-color-scheme`，但 motion 只由 `theme.reduceMotion` 写入 `data-motion`。当用户没有显式打开开关而操作系统请求 `prefers-reduced-motion: reduce` 时，当前实现仍写入 `full`。

### 3.6 平台样式难以持续维护

`styles.css` 为 28.5KB，约 329 个规则块，却只占 35 个物理行，大量规则压在单行。Token、Shell、overlay、表单、表格、响应式和后续增量混合排列；已有少量中文原因注释，但不足以支撑逐组件视觉校准和完整 Diff 审阅。

## 4. 推断

- 用户感受到的“临时感”主要不是缺少菜单或路由，而是比例、层次、微交互、loading geometry 和状态协调没有形成统一语言。
- 直接替换技术栈不会自动解决这些问题；先收敛宿主组件、token、motion 和视觉门禁能以更小风险获得可验证收益。
- module-owned 页面边界已经正确，不应为了视觉升级把业务页面重新搬回根 `webui/`。

## 5. 适用与不适用

适用于 Shell、overlay、公共 UI primitive、loading state、responsive 和 visual regression。它不授权修改 Go Manifest、业务 API、Session/CSRF、权限判定、模块页面 owner、数据库或生产托管。

## 6. 局限与剩余未知

- 本轮没有启动本地服务或重新生成截图；现状视觉复核使用仓库已有 Playwright 产物和当前源码。
- Header/Sidebar 的最终像素值仍需在实施时以 1440、1024、390 三个视口做同轮截图校准；计划先冻结 token owner 和验收边界，不把单张参考截图当作绝对像素规范。
- 当前工作区存在独立 RBAC 未提交变更；059 必须持续避开并只提交自己的文件。

## 7. 对当前任务的影响

研究门禁可通过。实施应保留现有功能边界，单轨重构 Shell 组件和平台样式，补充 motion/skeleton/overlay 交互与视觉验收，不另建第二套宿主。

