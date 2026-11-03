# UI 视觉校准基线

- 最近复核：2026-09（Next.js App Router 迁移后，权威面迁至 `/ui-elements` 9 个 Family 页面）
- 外部基准：[TailAdmin React Demo · UI Elements](https://react-demo.tailadmin.com/)
- 内部权威：`/ui-elements` 的 9 个 Family 页面与 `packages/ui-adapter`

## 1. 职责边界

TailAdmin 的 `UI Elements` 用于校准后台产品的视觉秩序和组件完整度；HeroUI 提供 Accessibility、Keyboard Navigation、Focus Management、Overlay 与 Portal 等成熟交互基础；本项目的 Semantic Design Token、UI Adapter 与 `/ui-elements` 目录决定最终产品规范。

校准只学习 Typography、信息层级、比例、留白、语义色、Border、Radius、Shadow、Icon/Text 关系及完整状态表达。禁止复制 TailAdmin 的源码、DOM、CSS、图片资产和具体尺寸数值，也不得为了接近参考而绕过 HeroUI 自行实现 Overlay。

优先级固定为：

1. 业务页面遵守内部 `/ui-elements` 目录和 UI Adapter。
2. 内部缺少合理能力时，复核对应 TailAdmin 页面并扩展 Design System。
3. HeroUI 负责交互与可访问性；项目 Token 和 Adapter 负责产品视觉。
4. TailAdmin 与内部规范冲突时，以已经验证并记录的内部规范为准；若冲突暴露明显漂移，则先修订 `/ui-elements` 对应 Family 页面，不在业务页打补丁。

## 2. 已确认的视觉规律

- 信息层级：页面背景低噪声，Section 使用轻边框 Surface 分组，只有 Overlay 和主要操作使用更高视觉层级。
- Typography：标题、正文、帮助文本和状态文本层级明确；粗体用于标题与关键动作，不用大面积高字重制造层级。
- 尺寸与留白：同一组件族保持一致高度、图文间距和触控面积；紧凑不等于压缩可点击区域。
- 颜色语义：Brand 只突出主要动作和 Selected；Success、Warning、Danger、Info 在 Alert、Badge、Notification 与状态表面中保持同义。
- Border、Radius、Shadow：页面内分组主要靠 Border 与 Surface；Shadow 只用于 Elevated Surface 和 Overlay。嵌套 Surface 主动移除重复边框、圆角和阴影。
- Icon/Text：Icon 辅助识别，不代替文本语义；Icon 与文本共享基线和一致间距。
- 状态完整性：Default、Hover、Focus、Active、Selected、Disabled、Loading、Error、Open、Closed 都属于组件契约，不能只验证静态 Trigger。
- Overlay：Trigger 和浮层使用同一视觉语言；浮层需同时治理背景、边框、圆角、阴影、间距、文字、Hover、Selected、Focus、Disabled 和 Motion。

本轮实际逐页复核 TailAdmin 当前可访问的 22 个 UI Elements 页面，完整快照见 R094-001。Alerts 以 Success、Warning、Error、Info 的同构层级保持语义一致；Avatar、Badge、Button 与 Button Group 展示尺寸、状态和组合边界；Cards、Images、Carousel、Ribbons 与 Videos 主要提供内容/媒体结构输入；Dropdown、Popover、Tooltip、Modal 与 Notification 强调 Trigger、浮层、动作和关闭层级；Basic/Data Table、Pagination、Tabs 与 Progress 展示集合、导航和确定状态。外部样本只用于识别后台场景与视觉规律，不用于推导项目具体数值。由此确认项目不应按页面分别塑造控件或 Popup，也不应为了凑齐菜单创建无调用方 Wrapper；共享 Form Control、Data Display、Overlay Surface、Option State 与父级 Composition 分别承担各自职责。

HeroUI 当前 `Select`、`ComboBox` 和 `Popover` 继续承担 ARIA、Keyboard、Focus、Portal、Placement 与 Collision；项目利用其 Trigger 宽度变量实现表单选择浮层的 `match-trigger` 策略，不自行重写定位系统。内部分类与完整契约见 [UI Element System](ui-element-system.md)。

## 3. UI Elements 校准矩阵

| TailAdmin 页面                                                  | 本轮观察重点                                                  | 项目内部落点                                     | 当前结论                                                                     |
| --------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------- |
| [Alerts](https://react-demo.tailadmin.com/alerts)               | 四类语义、Icon/标题/说明/动作层级、轻底色与边框协作           | `AlertBanner`、Showcase `Alert` 区               | 已采用项目语义 Token 重新实现                                                |
| [Avatar](https://react-demo.tailadmin.com/avatars)              | 尺寸序列、圆形裁切、Online/Offline/Busy 指示                  | `Avatar`、`UserIdentity`、Shell 与数据 Cell      | 已建立 fallback/size/presence 和身份组合，真实接入 Shell、列表与详情         |
| [Badge](https://react-demo.tailadmin.com/badge)                 | Soft/Solid、语义色、左右 Icon、短文本密度                     | `Badge`、`StatusPill`、Showcase `Badge` 区       | 已采用 Soft/Solid 与语义 Tone                                                |
| [Breadcrumb](https://react-demo.tailadmin.com/breadcrumb)       | 层级、分隔符、当前位置、Icon 可选性                           | `BreadcrumbTrail` / `PageHeader`                 | 已迁移页面私有实现；current/disabled/ARIA 由项目契约收口                     |
| [Buttons](https://react-demo.tailadmin.com/buttons)             | Primary/Secondary、左右 Icon、统一高度与字重                  | `Action`、Showcase `Action Variants`             | 已固定命令边界、Variant、尺寸、Pending/Disabled/Focus 契约                   |
| [Button Groups](https://react-demo.tailadmin.com/buttons-group) | 连续边框、首尾圆角、Active 与邻项层级                         | `ToggleGroup` / Preferences Density              | 仅对真实互斥选择建立 HeroUI Toggle Group；普通 Action 不伪装成静态按钮组     |
| [Cards](https://react-demo.tailadmin.com/cards)                 | 图片/文字/动作节奏、横向与纵向层级、链接语义                  | `Card` Anatomy、`Panel` 与 Showcase              | Card Header/Content/Footer 与 Layout Panel 分轨，支持 elevated/outlined/flat |
| [Carousel](https://react-demo.tailadmin.com/carousel)           | Controls、Indicators、Controls+Indicators、媒体比例           | 未来媒体浏览场景                                 | 已复核；无真实产品用例前不引入轮播依赖                                       |
| [Dropdowns](https://react-demo.tailadmin.com/dropdowns)         | Trigger Active、浮层 Shadow、Item 密度、Divider、Icon         | `MenuButton`、Showcase 与打开态快照              | Content Width；与 Form Selection 共享 Surface/Option，不共享选择语义         |
| [Images](https://react-demo.tailadmin.com/images)               | Responsive、2/3 Grid、裁切、资源 readiness 和容器比例         | `ReadyImage` + Feature Composition               | 公共层只管理 reserved layout/load/decode/error；Grid 与内容布局仍归 Feature  |
| [Basic Tables](https://react-demo.tailadmin.com/basic-tables)   | 横向滚动、Header/Cell 密度、复合身份 Cell、Status Badge       | `DataTable`、Showcase `Data Display` 区          | 保留 HeroUI Table 交互；项目只治理语义 Token、Density 与 Cell Composition    |
| [Data Tables](https://react-demo.tailadmin.com/data-tables)     | Page Size、Search、分页信息与结构化数据的组合边界             | `/reference` Filter + Table Pattern              | 搜索、筛选、分页属于真实数据 Pattern，不堆入基础 `DataTable`                 |
| [Links](https://react-demo.tailadmin.com/links)                 | 语义色、Underline、Hover、Opacity 的辨识度                    | `TextLink` / Host Router Link                    | 导航不再伪装 Action；UI Adapter 与 React Router 保持隔离                     |
| [List](https://react-demo.tailadmin.com/list)                   | Ordered/Unordered、Icon、Action、Disabled、Checkbox/Radio     | Feature Composition 与 Form Control              | 按语义组合；不建立万能 List Wrapper                                          |
| [Modals](https://react-demo.tailadmin.com/modals)               | Default/Centered/Form/Fullscreen、Scrim、Close、Footer Action | `DialogSurface`、Confirm、Drawer 与快照          | Dialog/AlertDialog 分轨，Pending/Disabled/取消/危险确认与焦点恢复均验证      |
| [Notification](https://react-demo.tailadmin.com/notifications)  | Announcement、Toast、语义通知、Dismiss 与操作层级             | Alert、Notification、FeedbackProvider / Toast    | 静态/流内/短暂反馈分轨；Feature 不直接访问 vendor queue                      |
| [Pagination](https://react-demo.tailadmin.com/pagination)       | Text/Icon、Current、Disabled、Ellipsis                        | `PaginationControl` / Reference Collection       | 已连接 48 条真实确定性集合、筛选/排序页码归一与批量选择                      |
| [Popovers](https://react-demo.tailadmin.com/popovers)           | 四方向、Default/Button/Link 内容组合；打开态仍待稳定复核      | `PopoverCard`、Showcase 打开态快照               | 外部类型与方向已复核；项目保持单一真实语义，不机械暴露全部 Placement         |
| [Progressbar](https://react-demo.tailadmin.com/progress-bar)    | Size、Inside/Outside Label、确定进度                          | `ProgressMeter`、Showcase `Status` 区            | 固定单一确定进度语义；HeroUI 管理数值/ARIA，项目管理 Surface 与文字层级      |
| [Ribbons](https://react-demo.tailadmin.com/ribbons)             | 角标与容器关系、Hover、Filled                                 | Feature Composition                              | 已复核；Badge 能表达时不新增 Ribbon                                          |
| [Spinners](https://react-demo.tailadmin.com/spinners)           | 多种 Loading 表达、按钮内 Spinner                             | Action Pending、`BusyIndicator`、Skeleton、State | Loading 按按钮/局部/内容/页面作用域选择，不建立万能全屏遮罩                  |
| [Tabs](https://react-demo.tailadmin.com/tabs)                   | Filled/Underline/Icon/Badge/Vertical、Selected                | `TabsView`、Showcase 状态组合                    | 保持 HeroUI Primary Tabs 原有结构与内部留隙；由父 Surface 提供外部内边距     |
| [Tooltips](https://react-demo.tailadmin.com/tooltips)           | Light/Dark、方向、Arrow、Hover/Focus                          | `TooltipAction`、Showcase 打开态快照             | 已采用 HeroUI Tooltip；同时支持键盘 Focus 与悬停                             |
| [Videos](https://react-demo.tailadmin.com/videos)               | 16:9、4:3、21:9、1:1 比例                                     | Feature Composition                              | 以内容比例契约实现，不新增播放器 Wrapper                                     |

## 4. 内部 UI Elements 权威范围

`/ui-elements` 下的 9 个 Family 页面是以下能力的项目级当前权威：

- 目录完整度：46 个公开可见 UI Element 各有独立预览和状态声明，9 个 Family 各有独立视觉基线；自动化按名称逐项验证 46/46，不接受混合 Demo 代替。

- Button：Primary、Secondary、Quiet、Danger、Small、Loading、Disabled。
- Identity / Display：Avatar fallback/size/presence、UserIdentity、DescriptionList。
- Navigation / Async：Breadcrumb、TextLink 边界、Pagination、Busy Indicator。
- Alert：Success、Warning、长文本和可选操作。
- Badge：Neutral、Success、Warning、Danger、Info，Soft/Solid 与尺寸变化。
- Card：Elevated、Outlined、Embedded 的层级、Padding、动作与嵌套规则。
- Dropdown：Trigger、Icon Item、Disabled、Danger、打开层、Focus 与 Escape。
- Modal：Scrim、Header、Close、正文、Footer、表单、Focus Trap 与 Escape。
- Form Control：Default、Hint、Error、Disabled、Selected，以及 Select、Combobox、DatePicker Popup。
- Overlay：Menu、Popover、Tooltip、DatePicker、Command、Dialog、Drawer 的完整打开态。
- Notification / Toast：标题、说明、Dismiss、一主一次操作、Provider queue 与确定性直接 URL。
- Data Display：Row Header、Comfortable/Compact、Sort、Single/Multiple Selection、Keyboard Selection 与 Empty Collection。

当前视觉证据共 31 张 PNG，其中 9 张按 Family 单独截取 Actions、Feedback、Status/Async、Identity/Display、Navigation、Data、Surfaces、Forms 和 Overlays；长分区截图排除 Host sticky Header，避免外壳污染 Element 基线。

业务页面不得创造与上述权威冲突的 Radius、Shadow、控件高度、语义色或 Overlay Surface。合理差异通过已记录的 Variant、Size、Tone、State 与 Composition 表达。

## 5. 复核触发器

出现任一情况时，必须重新打开对应 TailAdmin UI Element，并在变更说明中记录对照结果：

- 新增或修改公共 Button、Alert、Badge、Card、Dropdown、Modal、Form Control、Notification 或 Overlay。
- 修改 Typography、Density、Control Height、Radius、Border、Shadow、Semantic Color、Focus Ring 或 Motion Token。
- 新增 HeroUI 组件、升级 HeroUI/Tailwind、改变 Portal/Overlay 装配方式。
- 视觉回归显示组件族之间的间距、密度、圆角、阴影或状态表达开始分叉。
- 业务页面提出内部 Design System 尚未覆盖的基础能力。

复核步骤固定为：关闭态 → Hover/Focus/Active/Selected → Disabled/Loading/Error → 打开态与 Escape/焦点返回 → Light/Dark → 中文/英文长文本 → 窄屏/桌面/超宽屏。外部参考发生变化时，只更新本矩阵中的观察结论；是否改变内部规范必须通过 `/ui-elements` 对应 Family 页面和视觉回归验证。

## 116 新增元素与图表的视觉校准说明

- `charts` 属新增 Universal Element。TailAdmin React Demo 没有等价图表页，因此不以它作为
  形状基准；校准依据为：Design System 语义色（`chart-1..5` 与 `ink/border/surface`）、
  Typography 层级、间距与圆角 Token、以及与产品内表格/卡片一致的边界和留白。
  图表禁止引入第三方色板或默认主题。
- `collection-tools`（列设置/密度/导出）与 DataTable 的固定列/树形行按 TailAdmin
  `UI Elements → Tables` 的表格规律复核：列头层级、行高与分隔、工具栏密度、图标按钮尺寸；
  不复制其 DOM/CSS/数值。
- 这两类新增均已进入 `/ui-elements` 对应 Family 页面（`#data-productivity` 与
  `#data` 的图表示例），后续修改必须同步 Showcase，不允许业务页成为隐式权威。
