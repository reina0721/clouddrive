# 组件契约与分层设计

## 1. HeroUI v3 与 Tailwind CSS v4 的互补边界

HeroUI 的直接依赖与 Tailwind 对其公开 compound parts 的 styling 在 `packages/ui-adapter` 内汇合，由项目契约向上收口；Tailwind 语义 utility 同时可在整个 `/frontend` 使用：

| 责任          | HeroUI v3                                                   | Tailwind CSS v4 / Design System                                     |
| ------------- | ----------------------------------------------------------- | ------------------------------------------------------------------- |
| 交互与状态机  | 选择、展开、关闭、提交、禁用、pending 等成熟 primitive 行为 | 只把项目状态映射为公开 Variant 与语义 class，不复制状态机           |
| Accessibility | ARIA 关系、键盘导航、Focus 管理、Focus Trap/Return          | Focus ring、对比度、可见状态和 reduced-motion 的项目视觉表达        |
| Overlay       | Portal、Overlay lifecycle、Escape、Outside Click、Collision | Surface、spacing、size、responsive placement 与 layer token         |
| 视觉系统      | 不把 vendor 默认外观当成项目规范                            | Semantic Token、Light/Dark、density、responsive layout、composition |
| 上层契约      | vendor props、documented slot/state、DOM 与类型止于 Adapter | Feature/Page/Host 与公共包可消费项目语义 class，不穿透 HeroUI       |

执行顺序是“先选择正确的 HeroUI primitive，再用项目 Token 和 Tailwind composition 表达产品视觉”。HeroUI 官方公开的 `className`、compound parts、documented data attributes/render props 和 responsive utility 是允许的结合点；多维 Variant 或 compound slots 在 UI Adapter 内使用已经安装的 `@heroui/styles` `tv`，必要时扩展官方 component variants，再收敛成项目 props。局部单态样式直接使用 semantic utility，不为使用工具而制造 Variant。

若 HeroUI 已提供完整交互能力，不用 Tailwind/React 重写；若需求只是布局或视觉差异，不新增自研交互组件。任何差异都不得依赖深层 selector、内部 DOM、arbitrary value 或 `!important`，应通过项目 Variant、size、density、state、slot composition 或 context 解决。

## 2. Foundations

Design System 补齐并集中映射：

- `control-height-sm/md/lg`、`icon-size-sm/md/lg`、`option-height`；
- `radius-control/panel/shell` 与明确的 `surface-default/raised/muted`；
- `focus-ring`、`motion-fast/standard`、`ease-product`、Overlay/Shell 层级；
- Light/Dark 下 Brand、Success、Warning、Danger、Info 的 foreground/soft surface 配对。

组件只消费语义 class/token。局部数字仅允许布局算法或显然字面量；稳定控件几何不得散落在页面。

## 3. UI Adapter / Element

### 3.1 Actions

- `Action`：命令/提交；稳定 Variant 为 primary、secondary、quiet、danger，支持 leading/trailing icon、sm/md/lg、disabled、loading、full width。
- `IconAction`：图标命令；支持 sm/md、neutral/danger、active、disabled、loading，始终要求 label。
- `ToggleGroup`：有真实互斥/多选语义的紧凑选择，复用 HeroUI Toggle Button Group；不把普通相邻 Button 自动变成 Group。

### 3.2 Identity / Display

- `Avatar`：image、fallback initials/icon、sm/md/lg、presence；presence 是状态 slot，不把业务 status enum 固化到底层。
- `UserIdentity`：Avatar + primary label + optional secondary label 的 Display Pattern；可用于 Shell 与 Table Cell。
- `DescriptionList`：稳定的 term/description 语义和 responsive layout，不承载编辑动作。
- `Badge` 与 `StatusPill` 保持当前分轨。

### 3.3 Navigation

- `BreadcrumbTrail`：items 含 label、可选 href/disabled、最后项 current；内部使用 HeroUI Breadcrumbs。
- `PaginationControl`：page、totalPages、onPageChange、disabled、可访问 label；内部使用 HeroUI Pagination。
- `TextLink`：普通 anchor/外部导航；Web `RouterLink` 通过 Host-owned Adapter 映射 React Router，不泄露第三方 UI props。
- `TabsView`：Content View Selection；只在真实场景需要时增加受控 appearance。Workspace 生命周期不进入该 Element。

### 3.4 Feedback / Async

- `AlertBanner`、`NotificationCard`、`StatusPill`、`StateSurface`、`ProgressMeter`、`Skeleton` 保留并补齐必要 dismiss/announcement 组合。
- `BusyIndicator`：非确定局部等待，支持可访问 label 与 sm/md/lg；内部使用 HeroUI Spinner。
- `FeedbackProvider` + `useFeedback()`：显式装配 Toast Region，公开 project tone/title/description/optional action；禁止 Feature 直接 import vendor toast queue。
- 页面级 Loading 由 Skeleton + busy container Pattern 组合，不新增万能全屏 Loading Overlay。

### 3.5 Surface

- `Panel`：无内容 Anatomy 的布局 Surface，appearance 为 elevated/outlined/embedded。
- `Card`、`CardHeader`、`CardContent`、`CardFooter`：有独立内容单元语义；Card 自己是唯一 Surface owner，slot 不再创建第二层边框/圆角/阴影。
- Page Section、Toolbar、Filter Bar、Footer Actions 继续作为 Pattern，各自只拥有一层 Surface。

### 3.6 Overlay

- `MenuButton` 要求可见 item 全部可处理；disabled item 除外。Trigger 支持稳定的 text/icon/content slot，不暴露 HeroUI slot。
- `DialogSurface` 负责普通短期决策/表单容器；确认动作必须有 handler，并支持 pending/disabled。
- `ConfirmDialog` 与 `DestructiveConfirmDialog` 是 Pattern，固定 Question/Impact/Actions 结构，不把 danger 做成任意 modal color。
- `PopoverCard`、`TooltipAction`、`DrawerSurface`、`CommandMenu` 保持独立语义；placement 只有真实用例才扩展。

### 3.7 Form

- 新增 `RadioGroupField`；`ToggleGroup` 只用于紧凑即时选择，不替代带 Label/Description/Error 的表单 Radio。
- `SearchBox` 单轨重命名/收敛为 `SearchField` 时同步全部调用方并删除旧导出，不留兼容别名。
- Field Frame 内部复用 Label/Hint/Error 规则；Control 只拥有一次 Border/Background/Radius/Focus Surface。

### 3.8 Data

- DataTable 增加受控排序与 single/multiple selection union，项目类型不暴露 HeroUI `Key`/`Selection`/`SortDescriptor`。
- `PaginationControl` 不进入 DataTable；`CollectionPagination`、`BulkActionBar`、Search/Filter 与 Table 在 Pattern 层组合。
- Row Header、Empty Content、Horizontal Scroll、Density 和 Keyboard Selection 继续是 DataTable 不变量。

## 4. Pattern 与 Feature 边界

稳定后台 Pattern 包括 PageHeader、PageToolbar、PageFilterBar、PageSection、SplitView、FooterActions、CollectionPagination、BulkActionBar、Confirm Dialog、UserIdentity、DescriptionList 和 State Composition。Pattern 不读取业务 API，也不拥有业务 status 字符串。

Feature 负责记录集合、筛选/排序/分页状态、业务文案、权限/离线/错误选择和操作结果。Page 只编排 Feature 与 Layout。

## 5. 单轨迁移与删除

被替换的页面私有 Breadcrumb、Spinner、Account identity、Warning/Success surface、Card-like Panel 和无行为按钮必须同步迁移并删除旧实现/导出/测试。不得保留 `old`、`legacy`、compatibility alias 或静默回退。
