# R069-001 当前 Web UI 骨架是否已由 HeroUI 拼装（068 后的现状复核）

## 研究问题

- （a）068 之后哪些 UI 元素已 HeroUI 化；
- （b）Shell/页面骨架与遮罩容器哪些仍是旧自绘实现；
- （c）HeroUI v3 对骨架拼装的组件面与关键装配机制。

## 证据

### 1. 068 已 HeroUI 化的部分（控件层）

`@webui/sdk/ui` 内部已换 HeroUI/RAC：Button/IconButton、Field（TextField+Label+Input+Description+FieldError）、SelectField（Select 复合）、StatusPill（Chip）、CapabilityBanner/InlineAlert（Alert）、Skeleton/EmptyState、队列式 Toast（@heroui/toast）、PageSection/StatCard/StatGrid/DataCard（Card 复合 + Tailwind，保留 class 钩子与 `data-reveal`）、DataTable（Table/RAC）、Pagination（复合）、ActionTrigger/BulkActionBar/FormSubmitActions（HeroUI Button 底座）。暗色联动 `<html>.dark`、Tailwind v4 + `@heroui/styles/css` 已装配。

### 2. 仍为旧自绘（骨架层）

| 区域 | 现状 |
| --- | --- |
| AppShell 网格 | 自绘 `.app-shell/.app-workspace/.page-viewport/.page-flow` |
| AppSidebar | 自绘 `<aside class="app-sidebar">`：品牌行、递归菜单（`SidebarMenu` 自绘 link/toggle/submenu）、移动抽屉 inert/焦点 |
| AppHeader | 自绘 `.topbar` 布局；内部按钮已 IconButton、语言 select 原生 |
| WorkspaceTabs | 自绘 `role=tablist` + tab 按钮 + close/refresh |
| RouteSearch | 自绘遮罩 + `role=dialog` + 原生 input 组合框 |
| ThemeDrawer | 自绘 `.theme-drawer` 遮罩 + 自绘 tab 面板 |
| ConfirmDialog / SDK Drawer | 自绘 backdrop + dialog（focus/inert 自管） |
| PageHeader 与页面布局 | 自绘 `.page-header` + `.page-sections/.toolbar/.card-grid/.item-card` 等布局容器 |

用户判断正确：「全量 HeroUI」主要指控件层，骨架仍大量自绘，且旧骨架的间距/圆角/阴影/暗色 token 与 HeroUI 视觉语言存在张力。

### 3. HeroUI v3 骨架拼装机制

- `Modal/Drawer` Root 内部为 RAC `DialogTrigger`（触发式、客户端挂载；受控 `isOpen` 时 SSR 输出为空是**有意设计**）——不适合当前「命令式受控 open」的 ConfirmDialog/Drawer/ThemeDrawer/RouteSearch，需要 RAC 受控 `Modal`/`Dialog`（或保留自绘容器）承载。
- `Switch/Checkbox` 复合不含交互 input（纯展示 Field/Control/Thumb），交互需 RAC `Switch`/`Checkbox`（label+input，`role=switch/checkbox`）。
- 可用于拼装的 HeroUI 组件面：`Surface/Header/Toolbar/Tabs/TextField/Kbd/Avatar/Badge/Dropdown/Menu/Link/Tooltip/Separator/Alert/Spinner/CloseButton/EmptyState/Chip` 等。

## 事实与推断

**事实**：骨架全部自绘（见上表）；HeroUI Modal/Drawer 为 DialogTrigger 模式；Switch/Checkbox 无 input；组件面列表来自本地 package exports。

**推断**：骨架「HeroUI 拼装」= HeroUI 控件/布局组件 + RAC 受控交互底座（Modal/Switch/Checkbox） + Tailwind 布局原语；SSR 空输出使部分现有 `renderToStaticMarkup` 断言需改为客户端渲染或 e2e 级验证。

## 对本任务的影响

- 第 2 点（重新设计骨架与布局）：以 HeroUI 视觉语言（半径/阴影/间距/语义色/暗色）重写 Shell 与页面骨架规范，并把模块页面按新骨架重排（R069-002）。