# UI Element System

本文是 `/frontend` 基础 UI 分类、组件语义和组合边界的当前权威。它不按 TailAdmin 菜单或 HeroUI 导出列表复制组件；分类只服务于项目长期治理、复用和验证。

## 1. 分层职责

```text
Semantic Design Token
  -> Interaction Primitive（HeroUI / React Aria）
  -> UI Element（项目稳定语义）
  -> Composite / Pattern（跨 Element 组合）
  -> Feature Component（业务语义）
  -> Page / Host（路由与平台装配）
```

- HeroUI 负责 Accessibility、Keyboard、Focus、Selection、Overlay、Portal 和 Collision。
- `packages/design-system` 负责颜色、尺寸、空间、圆角、阴影、层级和动效语义。
- `packages/ui-adapter` 把底层能力收敛为项目 UI Element；不得暴露 HeroUI props 或 DOM。
- Tailwind CSS v4 可在整个 `/frontend` 消费项目 Semantic Token，负责布局、响应式、主题、密度和视觉组合；只有 HeroUI 直接依赖以及 Tailwind styling HeroUI compound parts 必须止于 UI Adapter。
- Composite 只组合已有 Element 与 Layout，不重新定义控件、浮层或状态视觉。
- Feature 拥有业务文案和状态选择，不创建第二套基础组件。

## 2. 当前分类

| Family                | 稳定语义                     | 当前 Element / Pattern                                                                                                                     | 不应混入                     |
| --------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| Actions               | 发起命令或提交               | `Action`、`IconAction`                                                                                                                     | 导航链接、值选择             |
| Form Controls         | 输入、编辑或选择表单值       | `TextField`、`PasswordField`、`TextAreaField`、`SelectField`、`ComboField`、`DatePickerField`、`RadioGroupField`                           | Action Menu、Navigation Menu |
| Selection             | 独立布尔或集合选择           | `CheckboxField`、`SwitchField`、`ToggleGroup`                                                                                              | 用 Switch 代替即时动作       |
| Identity / Display    | 展示身份、媒体与键值信息     | `Avatar`、`UserIdentity`、`ReadyImage`、`DescriptionList`                                                                                  | 业务权限或在线状态机         |
| Navigation            | 页面、层级、集合或视图切换   | `TextLink`、`BreadcrumbTrail`、`PaginationControl`、`TabsView`、Host Router Link、Shell Navigation                                         | 表单值提交                   |
| Feedback              | 解释操作结果或风险           | `AlertBanner`、`NotificationCard`、`FeedbackPresence`、`FeedbackProvider` / Toast                                                          | 长期数据状态标签             |
| Status / Async        | 表达对象状态或等待范围       | `Badge`、`StatusPill`、`StateSurface`、`ProgressMeter`、`BusyIndicator`、`Skeleton`、`AsyncRegion`                                         | 交互按钮、万能全屏遮罩       |
| Data Display          | 展示结构化数据               | `DataTable`；Collection Toolbar / Filter / Pagination / Bulk Action 留在 Pattern                                                           | 表单输入与操作菜单           |
| Overlay / Floating UI | 在普通页面层之上承载短期交互 | `MenuButton`、`PopoverCard`、`TooltipAction`、`DialogSurface`、`ConfirmDialog`、`DestructiveConfirmDialog`、`DrawerSurface`、`CommandMenu` | 普通 Card / Panel 外壳       |
| Surface / Layout      | 建立内容与页面空间关系       | `Card` Anatomy、`Panel`、Page Layout Contract                                                                                              | 业务状态和数据请求           |

`ReadyImage` 只管理非 Avatar 图片的 reserved layout、load/decode/error 与 crossfade；图片网格、视频比例和内容排版仍留在 Feature Composition。Avatar 保留 HeroUI 自身 Image/Fallback readiness，不嵌套第二套状态机。

## 3. Action Family

`Action` 用于执行即时命令或提交表单，`IconAction` 用于空间受限且图标语义稳定的同类操作。页面跳转和外部地址必须使用 Link 或 Router Navigation，不得把导航伪装为 `onPress` 命令。

- Primary 表达当前 Surface 的一个主要动作；Secondary 承担普通辅助动作；Quiet 用于低强调工具动作；Danger 只用于具有破坏后果的动作。
- `loading` 是受调用方控制的 Pending 状态：保留原按钮文字、显示进度、通过 HeroUI/React Aria 标记 Pending 并阻止重复触发；它不是普通 Disabled 的视觉别名。
- `disabled` 表达当前动作不可用。业务组合应在相邻上下文说明原因，不得只依赖降低透明度传达限制。
- `sm`、`md` 与 `lg` 只改变稳定的控件高度和横向 Padding；Feature 不得自行覆盖按钮高度制造第四套密度。
- 纯图标操作必须使用 `IconAction` 并提供可访问名称；不得传入空文字的 `Action` 充当 Icon Button。
- **内部内容契约**：`Action` 自己是唯一成形交互容器；`leadingIcon`/`trailingIcon` 必须作为 Action 内容的一部分（label + icon），icon 只经内部统一 wrapper 表达 semantic size、alignment、shrink、`currentColor` 与 `aria-hidden`。禁止传入 IconAction/Button/其它成形组件作为 icon 形成「Button 内嵌 IconButton」的视觉（独立 border/background/radius/focus surface）；wrapper 不得改变 Action 高度。icon 与 label 必须共轴且垂直居中（由同一 content row 的 `align-items: center` 承担），不同 variant/size/pending/disabled 下相对位置一致。

## 4. Identity、Display 与 Navigation Family

- `Avatar` 统一 image、fallback、size 与 presence；`UserIdentity` 只组合 Avatar、名称和说明，不承担用户菜单、权限或在线状态推导。Shell 账号入口与 DataTable/详情身份展示共享该契约。
- `DescriptionList` 负责 term/description 关系、缺失值与窄屏重排，不把详情键值对伪装成表格，也不拥有业务字段格式化。
- `TextLink` 保留 anchor 语义与可访问导航；SPA 路由由 Host Router Link 注入，UI Adapter 不依赖 React Router。Action 不承担导航。
- `BreadcrumbTrail` 表达层级和当前位置；`PaginationControl` 表达 current、previous/next、ellipsis 与总页数。筛选、排序、页码归一和远端请求属于集合 Pattern。
- `TabsView` 只表达同一内容域中的视图选择，并以稳定 tab ID 接入 `ContentSwapTransition`；键盘、Selection 与 Focus 仍由 HeroUI 主持。应用级 Workspace Tabs 需要保活、关闭和恢复生命周期，当前没有该场景，不与 Content Tabs 合并。
- `TabsView` 按三个正交维度组合，页面不得用局部 CSS 改写公共 Tabs，也不暴露 HeroUI visual variant 或通用 className 逃生口：
  - Visual Variant：`line`（默认，普通内容导航：透明 TabList + 轻 baseline + bottom brand indicator）、`section`（Card/Form/Settings/Panel 内部章节导航：透明 TabList、不创建灰色 Toolbar 或独立 rounded Surface、不强制整条 baseline，内容分隔由父容器决定）、`soft`（TabList 自身形成轻量选择区域：muted surface 容器 + 紧凑 padding，selected Tab 用 elevated/default surface 凸显，无 line underline）。`soft` 仍是内容切换，不等同于 `ToggleGroup` 的值/模式选择。
  - **宿主职责边界**：`section` Tabs 是父 Surface 内部的章节导航；TabList 与内容共享父容器的 horizontal inset、稳定 gap 与区域分隔由宿主 Panel/Section composition 提供（见 `docs/surface-foundation.md` 的 Section `contentInset` / `SectionBody`），TabsView 不自建 Surface/Toolbar 制造分区感，页面也不得手写 padding/gap/divider 拼凑宿主布局。
  - Orientation：`horizontal`（默认）/ `vertical`。Vertical 不创建新业务 Variant，只改变 indicator/布局表达（line/section 用 side indicator + foreground 无 selected surface；soft 用 selected surface）；窄 viewport 自动回退为顶部横向可滚动 TabList + 下方内容，使用项目既有 responsive breakpoint，不写 Tabs 私有断点。
  - Item Content：item 原生支持 `{ id, label, icon?, badge? }`；不建立 icon/badge 业务 Variant。icon 位于 label 前（统一 semantic size、跟随 foreground、不硬编码颜色）；badge 为受控 `number | string`，由公共 `Badge` primitive 渲染（size/tone/alignment 由 TabsView 控制），selected/unselected 均可读且不明显改变 Tab 高度。
  - 各 Variant 共享同一状态模型（Active/Inactive/Hover/Focus/Disabled/Keyboard）与 Semantic Token；视觉职责（background/foreground/border/indicator/radius/spacing/shadow/focus/hover/selected）必须通过 semantic token/recipe 表达，禁止 HeroUI 胶囊残留（rounded-3xl/h-8/vendor p-1 叠加）与页面级 CSS override。
- `ToggleGroup` 负责即时互斥的成形值/模式选择（segmented 语义），与 `TabsView` 的内容切换语义不可互换：切换内容区域用 Tabs；选择一个值/模式用 ToggleGroup。
- `Tree` 是**多级层级数据集合**（hierarchical data collection）的浏览/展开/行选择/行动作，与其它 Navigation/Collection 成员的边界固定为：
  - `ListBox`（`ui-option`）= 扁平可选集合；`Disclosure` = 单一内容区展开；`StepNavigation` = 有限有序过程；Shell Navigation（Sidebar Tree/Accordion）= 页面导航拓扑。**不要把业务导航树与通用数据 Tree 混为一个 Contract**，本 Tree 不承担页面导航。
  - Tree 自身为 lightweight transparent hierarchical collection：默认不拥有 Card/Panel-like border/background/radius，Surface 由宿主（Panel/Section）提供；只拥有层级结构所需内部 layout/state geometry。
  - Row anatomy（稳定）：`DisclosureSlot`（叶子保留布局占位、不渲染假 affordance）→ optional `LeadingIcon` → `Content(label required; description optional)`；label-only 行不自带富行高度。深度缩进用稳定 semantic depth step。
  - 底层使用 React Aria Tree；其 treegrid/row/gridcell DOM 是 RAC 为 row focus/selection/interactive child 提供的实现（accessibility/keyboard 由 RAC 主持），属于 accessibility implementation detail，不因 DOM role 形态自建 ARIA/keyboard。
  - 完整 accessible name 不因视觉 truncate 丢失；如需 overflow reveal 复用既有 Tooltip 能力，不形成 Tree 私有 title 规则。

## 5. Feedback 与 Status Family

Feedback 解释刚发生的结果、风险或可恢复问题；Status 描述对象当前所处的稳定状态。两者可以共享 Tone Token，但不得因为颜色相同而互换语义。

- `AlertBanner` 是页面流内的信息块，默认不加入 Live Region。只有内容在用户操作后动态出现且需要辅助技术及时播报时，才选择 `polite`；会阻断当前安全操作的紧急失败才选择 `urgent`。
- `NotificationCard` 是可操作的静态通知组合，不等同于全局 Toast。它固定包含主要动作和关闭动作；可选次要动作必须同时提供文案与处理函数。
- `FeedbackProvider` 显式拥有全局 Toast queue 与 Region；Feature 只通过 `useFeedback` 发送 tone、title、description 和可选 action，不直接访问 HeroUI queue。Toast 用于用户动作后的短暂反馈，不能代替流内 Alert、长期 Notification 或对象 Status。
  Queue 在 Provider 生命周期内始终同步可用；Region 的显示模块首次反馈时加载，之后保留实例，继续由同一 HeroUI queue 管理时长、关闭和操作。加载边界不创建第二个队列，不改变 Feature Contract、Toast anatomy、Portal、Focus 或视觉 Token。
  Provider 的 `loadingLabel` 与 `closeLabel` 均由装配方传入已本地化文案；首次显示模块加载期间使用正式 BusyIndicator，位于浮层且不改变页面 Layout。
- 动态 Inline Alert/Notification 需要完整 Enter/Exit 时使用 `FeedbackPresence`；退出阶段立即设置 inert/aria-hidden，动画结束再卸载，并允许快速反转。Toast 继续由 HeroUI queue 主持，不嵌套该 Presence。
- `Badge` 表达类别、属性或短元数据，可使用 Soft/Solid、Icon 与尺寸；`StatusPill` 专门表达对象生命周期状态，保持 Dot + Soft 的单一结构。
- `StateSurface` 承担 Empty、Error、Offline、Permission 等大范围内容状态；恢复动作的文案与处理函数必须成对，禁止渲染无行为按钮。静态状态默认不进入 Live Region；只有用户操作后动态出现的结果才显式选择 `polite`，会阻断安全操作的紧急失败才选择 `urgent`。
- `ProgressMeter` 只表达已知的确定进度；它复用 HeroUI/React Aria 的 ProgressBar 数值与 ARIA 语义，并由项目样式固定 Label、Output、Track 和 Fill。未知等待使用 `Action loading`、Skeleton 或 Loading State，不伪造百分比。
- `BusyIndicator` 表达非确定等待并保留可访问 label；按钮 Pending、局部 Busy、内容 Skeleton 与页面 Loading 按作用域组合，不建立默认阻断整个工作区的万能 Loading Overlay。
- `Skeleton` 只提供视觉占位并保持 `aria-hidden`；所属 Composition 必须另有可访问的 Loading 文案与 Busy 容器。`data-slot="skeleton"` 只用于稳定的组合回归定位，不承载产品语义。

## 6. Form Control Family

`RangeSlider` 复用 HeroUI 单轴滑块，应用于媒体时间轴、音量以及有相邻数值标签的场景。`/ui-elements/forms` 展示指针、键盘和禁用状态，控件样式消费语义色。

`PasswordField` 经既有 `form-field` Contract 导出，复用 HeroUI TextField + InputGroup。
`purpose=current|new` 映射账号密码自动填充；`purpose=transient` 用于压缩包临时密码并设为 `autocomplete=off`，不声明账号密码语义；显示切换使用公开 Button suffix，保留输入值、
Label/Hint/Error、禁用和键盘语义，不提交表单。`TextField` 的 `purpose=text|email`
默认 text，普通消费者不改变行为。两者均在 `/ui-elements/forms` 展示，认证表单消费
同一实现；密码内容不进入 Token、UI Store 或组件持久化。
密码可见性切换支持图标呈现，按钮始终保留完整可访问名称；窄屏和大字号场景保留输入空间。

所有 Form Control 共享以下不变量：

- Control Height、Typography、Background、Border、Radius、Placeholder、Focus、Disabled 和 Invalid 来自同一语义样式。
- Label、Description 与 Validation Message 使用同一层级；Error 替代 Hint，不同时制造两条互相竞争的说明。
- Text Input、Textarea、Select Trigger、ComboBox InputGroup 与 DateField Group 在同一密度下必须可以并排比较。
- 复合控件只允许最外层 InputGroup 负责 Border、Background、Radius 和 Focus Surface；内部 `Input` 必须保持透明、无边框的 Primitive 形态。
- `fullWidth` 是表单列中的稳定默认；局部宽度由布局容器控制，不由 Popup 内容反向决定。
- `RadioGroupField` 负责单选表单值；`ToggleGroup` 负责即时互斥视图偏好。两者可以视觉相近，但不得交换提交时机和 ARIA 语义。
- **内部 indicator / option 契约**：外层 option（Radio Choice Card、ToggleItem）拥有 surface/border/radius/selected/pressed；带圆点的 option 行必须保持 control 与 label 同行的 row 布局（覆盖 vendor 默认列堆叠），indicator（Radio 外圈 + 内 dot）只拥有几何/对齐/状态色。Radio indicator 的 selected/unselected/disabled 只改变内 dot 显隐与 ring 状态，不改变尺寸；unselected 保持空心 ring、不出现实心 dot；indicator 不创建独立 shadow/surface。ToggleGroup 的 ToggleItem 是唯一成形 owner，内部 icon/label 不得再次获得 border/background/radius/shadow/selected surface；内部 icon wrapper 保持透明、无边框、固定 semantic size。
- **ToggleGroup selection-mode composition**：single = coherent segmented mode switch（shared group container、items 连续组织、无 per-item gap、连续 segmented 几何）；multiple = independent toggle items（每个 item 独立拥有 surface/border/radius，四边边界不因 sibling position 被清零/合并，hover/selected/focus-visible 在自身 control boundary 内表达，focus ring 不被 sibling 裁剪/合并，items 之间使用稳定 semantic gap；group 只负责排列与 gap，不承担单个 item 的 selected/focus surface）。

当前语义尺寸由 `--spacing-control` 管理，Option 触控高度由 `--spacing-option` 管理。业务页面不得复制对应数值。

## 7. Anchored Overlay

Anchored Overlay 负责 Trigger 与 Popup 的空间关系，定位和碰撞继续由 HeroUI 管理。项目只固定产品语义：

| Width Strategy  | 语义                                       | 当前使用                       |
| --------------- | ------------------------------------------ | ------------------------------ |
| `match-trigger` | Popup 宽度等于 Trigger，表单列保持几何连续 | `SelectField`、`ComboField`    |
| `min-trigger`   | Popup 不窄于 Trigger，允许内容扩张         | 预留；出现真实复用场景前不公开 |
| `content`       | Popup 根据操作或说明内容决定宽度           | Action Menu、Popover、Tooltip  |

普通 Select 与 Combobox 固定使用 `match-trigger`。它们依赖 HeroUI 提供的 `--trigger-width` 与 Portal/Collision，不把 Popup 放入普通文档流，也不通过业务页宽度补丁修正。

Listbox 的滚动属于列表内部责任：Overlay Surface 提供外壳，Listbox 负责 Maximum Height、Overflow 和 Option 排列。

`/ui-elements/forms` 中的 Select 与 Combobox 必须保留足以触发内部滚动的大集合，并包含 Disabled Option。交互回归需同时证明内容高度超过 Listbox 可视高度、键盘能够滚动到末项以及筛选后仍能完成选择；仅检查 `overflow: auto` 声明不构成滚动能力证据。

## 8. Data Display

`DataTable` 只负责结构化数据的行列语义、密度、横向滚动、排序状态与可选的单选/多选，不内置搜索、筛选、分页、批量动作或请求状态。后者属于拥有真实数据状态的 Feature Composition。

- 默认表格是纯展示；只有显式传入 `selection` 才启用 HeroUI `Table.Content` 的 single/multiple、Selected 与 Keyboard Navigation。Selection Contract 使用项目 ID，不泄露 HeroUI `Selection` 类型；不得给每行挂载无行为的 `onAction` 来伪造可操作性。
- 只有显式传入 `sort` 的列才暴露排序交互与 `aria-sort`；DataTable 回传 column ID/direction，Feature 负责稳定排序、筛选后页码归一和数据请求。
- 每张表必须提供 `emptyContent`，由 HeroUI `Table.Body.renderEmptyState` 保证空集合仍有可读反馈。需要说明原因、恢复操作或离线语义时，Feature 可以用 `StateSurface` 替换整个表格 Composition。
- 至少一个能够唯一识别行的列应声明为 `rowHeader`；状态和确定进度分别组合 `StatusPill` 与 `ProgressMeter`，不在 Cell 中创造第二套视觉。
- Comfortable 与 Compact 只改变稳定的 Cell Padding，不改变触控、选择和键盘语义。
- `Table.ScrollContainer` 是横向溢出的唯一所有者；父 Section 不再增加第二层横向滚动。
- 搜索、筛选、分页和 Footer 只有接入真实集合、总量和请求状态后才能进入 Pattern；禁止为展示完整度添加静态假分页或空操作列。

## 9. Overlay Surface 与 Option State

分组菜单由 HeroUI 管理浮层可用高度，外部具名滚动区域负责短窗口滚动及键盘访问，
不修改 Collection 的焦点契约。
此区域的 `tabIndex=0` 对应 [W3C 可滚动内容键盘访问规则](https://www.w3.org/WAI/standards-guidelines/act/rules/0ssw9k)，
与泛化的非交互元素 tabindex lint 规则冲突；仅该属性标注有依据的误报说明，保持全局规则、Axe 和键盘 End 验证。

`ui-overlay-surface` 是 Dropdown、Select、Combobox、Popover、DatePicker、Dialog、Drawer 和 Command 共用的 Surface 语义，统一 Background、Border、Radius、Shadow 和文字颜色。不同 Overlay 只决定内容 Padding、宽度策略和结构，不复制一套 Surface。

Dialog 的外层不叠加 vendor padding 或相邻 slot margin，Header / Body / Footer 各自拥有项目边距。`DialogSurface layout="workspace"` 用于连续阅读与编辑：桌面保留轻量外边距，窄屏和短窗口贴合视口；关闭入口固定在标题栏，不再附加只含关闭按钮的 Footer。正文把高度交给内容的 flex 布局，滚动由阅读内容或独立侧栏拥有，不用页面级 ResizeObserver 反算弹窗尺寸。标准表单与确认 Dialog 保留 Footer 和短窗口滚动。两种构成均在 `/ui-elements/overlays` 验证。

DialogSurface 的 `footerAction` 用于由业务拥有的提交或结果操作，保留统一取消入口与 Footer 布局。Action 的 `form` 指向正文中的原生 form，不能以额外的点击处理模拟提交。外部 `busy` 与确认中的 pending 共同阻止 Escape、背景和关闭按钮提前丢失结果；业务同时禁用提交以避免重复操作，完成后决定展示结果或关闭。权威示例为 `/ui-elements/overlays` 的固定操作表单，真实消费者为文件分享。

`MenuButton` 使用互斥的平铺 `items` 或分组 `groups`。组可包含动作或单选偏好
（当前值、selectedId、options）；身份摘要组合在首组Header，装饰头像隐藏重复名称。
Section/Header/Separator、SubmenuTrigger、单选Menu和ItemIndicator使用HeroUI公开
anatomy。`submenuLayout` adjacent用于桌面、stacked用于窄屏触摸，Host提供尺寸判断。
两者都在同一Dropdown浮层树，碰撞处理、外部关闭、Escape层级返回、焦点及指针跨层
由HeroUI管理。Menu的轻量淡入淡出复用现役Motion Primitive与control duration，避免
缩放改变聚焦滚动计算；视口宽度和最大高度受限，overflow保留可操作内容。

`MenuButton` 支持可选 `isOpen/onOpenChange`，供文件右键等语义入口打开同一菜单，不另建浮层或焦点系统；默认仍由 HeroUI 管理非受控状态。`CheckboxField` 的 `presentation="control-only"` 只隐藏可见标签，保留完整 accessible name 和原有选择/键盘行为，用于已经显示文件名的紧凑条目。

Dialog/Confirm 的主操作与普通 Action 消费同一 `bg-brand` / `text-on-brand` 配对；危险操作使用 `bg-danger` / `text-on-danger`。不得固定白色文字：深色主题的强调背景较亮，前景必须随主题与强调色一起变化，并在真实打开态验证对比度。

`PopoverCard` 当前只承载与 Trigger 直接相关的短说明，使用内容宽度和稳定的 `bottom start` Placement；打开时 HeroUI 将焦点移入 Popover Dialog，Escape 关闭后再返回 Trigger。它不是表单值选择、命令列表或强制确认。更短且不可交互的补充说明使用 `TooltipAction`，操作集合使用 `MenuButton`，必须阻断主流程并等待决策时使用 `DialogSurface`。外部参考出现更多方向或内容组合，不自动扩大项目 API；只有真实产品场景需要时才新增可验证的交互内容或 Placement 语义。

`ui-option` 是 Listbox 与 Menu Item 的共享状态基线：

- Default：普通文字与透明背景。
- Hover / Keyboard Focus：使用低强调 Surface，表达当前指向位置。
- Selected：使用 Brand Soft、Brand 文字和更高字重，表达持久选择。
- Disabled：降低强调且不可操作。
- Danger：保留 Option 的尺寸与 Focus 规则，只替换语义色。

Hover/Focus 与 Selected 不得合并为同一种状态；Selected 不能只依靠 Hover 才可见。

## 10. Composition Rules

- 一个视觉 Surface 只能由一层负责 Border、Radius、Shadow、Background 和外部 Padding。
- 父 Surface 通过内边距拉开子 Element；不得为了解决贴边问题改写子组件自身 Variant。
- 已有外壳进入 Panel、Dialog、Drawer 或 Form 时，应使用 Primitive、Embedded 或 Slot，而不是完整组件套完整组件。
- Scroll Container 由实际拥有滚动内容的一层负责；父子不能重复声明滚动和固定高度。
- Page Header、Toolbar、Filter Bar、Section、Split View 与 Footer Actions 通过 Layout Contract 组合，不在每个 Page 重写同类骨架。
- `Card` 拥有 Header/Content/Footer 的内容 anatomy；`Panel` 只作为 Layout Surface。已经存在父 Surface 时使用 flat/embedded composition，不叠加第二套 Border、Radius 和 Shadow。
- 承载文字的 Page 与 Surface 不参与整体 Opacity 动画；否则进入中间帧会改变 Semantic Token 的实际对比度。Opacity Motion 只用于 Scrim 等无文字装饰层，内容型 Overlay 使用自身成熟交互契约。
- 路由级页面转场是浏览器 View Transitions API 快照层的例外路径：Host `RouteTransition` 对深入导航播放 `nav-forward` 方向滑动；无导航类型的 route/Suspense content 使用克制的 `content.enter`，hydration 不重复页面滑动。转场样式与时长/缓动只能来自 Motion authority；页面不得自建转场 Wrapper。
- 异步数据区域由 `AsyncRegion` 编排 `initial/ready/refreshing/background/empty/error`：initial 使用 Skeleton，refresh 保留旧内容并 busy，background 保留内容且静默，只有无内容进入有内容才绑定 `content.enter`。区域容器承担 `aria-busy` 与 `data-phase` 语义；Surface `StateRegion` 复用相同 readiness，再扩展 partial/readonly/denied/pending。

## 11. UI Elements 与质量证据

- `/ui-elements` 是公开 UI Contract 的可执行目录，按 9 个 Family 拆分为独立页面。当前 46 个可见 Element 必须各自拥有一个独立 `ComponentPreview`，展示准确名称、支持状态清单和真实交互；9 个 Family 页面负责导航与逐族视觉基线，禁止再用一个混合 Demo 代替完整度声明。
- 每个状态清单都是验收声明，必须能在同一 Preview、确定性 URL、自动化交互或该 Family 的视觉基线中找到对应证据；不能展示的状态不得写入清单。
- `/ui-elements` 按 Family 暴露 Variant、Size、Tone、Icon、Disabled、Loading、Long Content、Edge Case、Dark Theme 和可交互状态；不适用于某个 Element 的维度由其稳定职责裁决，不创建无语义 Variant 凑矩阵。
- Action 必须验证 Focus、Pending、Disabled 和尺寸序列；Pending 与 Disabled 不得合并成同一状态证据。
- Identity / Display 必须验证 Avatar image/fallback/size/presence、ReadyImage decode/error/reserved layout、UserIdentity 长文本与 DescriptionList 缺失值；Navigation 独立验证 Breadcrumb、TextLink、Pagination、Tabs Content Swap 与真实 Host Router 边界；Busy 归入 Async。
- Feedback 的可见动作必须具备真实处理函数；静态 Alert 不得自动声明为 Live Region，动态 Announcement 必须按影响选择播报强度。
- Status Family 必须在 `/ui-elements` 对应 Family 页面中并排暴露生命周期 Tone 与确定进度；`/states` 长期覆盖 Loading、Empty、Error、Success、Warning、Disabled、Pending、Offline 与 Permission Denied。Progress 边界值、Skeleton 的辅助技术可见性、Busy 容器和 Error 恢复路径必须进入自动化回归。
- Data Display 必须在 `/ui-elements/data` 中暴露 Row Header、Density、Selected、Keyboard Selection 与 Empty Collection；Pattern Reference 继续验证筛选、Master-Detail 与异常状态组合。
- Select、Combobox、Dropdown、Popover、Tooltip、DatePicker、Command、Dialog、Confirm 与 Drawer 必须保留打开态视觉基线；Toast 必须通过显式 Provider 和确定性 URL 验证。
- Form Selection 的视觉回归必须断言 Popup 使用 Trigger 宽度且 Listbox 自己滚动。
- 关键 Overlay 必须验证 Escape、焦点返回、Keyboard Navigation、ARIA 与 Axe WCAG AA。
- `/reference` 与 `/reference/form` 是 Pattern Reference，用于验证 Element 进入 Toolbar、Filter、Table、Master-Detail、Split View 和复杂 Form 后仍保持契约。
- `architecture:check` 额外禁止空 Suspense fallback、非权威 keyframes、组件数值 duration/delay、Host 外 Observer/media query，以及 Feature 写入 Motion 属性。

## 12. 演进规则

新增基础能力前按顺序判断：

1. 该能力是否属于动效：先查 [Motion Foundation 与语义动效分层](motion-foundation.md) 的配方登记表与容器目录，确认是否已有配方、语义容器或 HeroUI 浮层能力可复用。
2. 已有 Element 是否已经表达该语义。
3. 是否只是已有 Element 的稳定 Variant 或 Density。
4. 是否应由 Composition、Slot、Primitive 或 Feature 局部结构完成。
5. 只有存在跨 Feature 的独立语义、状态和验证价值时才新增 UI Element。

公共 Token、Form Control、Overlay Surface、Option、Layout 或 Adapter 改动必须同步检查全部调用方、`/ui-elements` 对应 Family 页面的打开态、Pattern Reference、Dark Mode、Locale 扩张、窄屏和 Accessibility。外部成熟产品只用于复核设计规律，内部权威始终是本文、Semantic Token、UI Adapter 与可运行回归证据。

## 响应式空间、配置行与可调整数据列

- SearchBox 根、输入组与所在 Grid 必须允许收缩；清除和图标保留命中区。Field 的说明和错误占独立区域，不由父 Grid 拉长单行输入。 TextField 的 `presentation="control-only"` 仅供紧凑工具栏，label 仍必填并作为无障碍名称保留；不隐藏表单所需说明。SearchBox 的 inputRef 和 IconAction 的 ref 用于明确的用户操作焦点，不在普通刷新时抢焦点。 SelectField 的 toolbar 呈现受父容器宽度约束，长选中值只在关闭态省略；无障碍名称和弹出选项保留全文。在 `/ui-elements/forms` 的窄容器示例与分享管理筛选中共同验证。
- RadioGroupField 的 cards 默认保留解释型选项表面；rows 用于短配置选项。SwitchField 的 card 默认不变，row 适用于已有容器内的紧凑配置行。TextField 的 ref 指向输入控件，供 Form Foundation 注册、首错定位和显式用户偏好焦点使用。
- RadioGroupField 的 tiles 用于少量互斥模式的图标选择卡片：分组可通过 labelIcon 提供装饰图标，标题与 hint 先于选项；容器空间充足时 icon 在上、label 在下，三列等宽；窄容器回退单列“图标＋标题”，避免英文大字号逐字竖排。长文字允许合理换行。保留 RadioGroup/Radio.Content 的原生单选、整卡点击、方向键、焦点与禁用语义，不使用 Tabs 内容切换替代表单值选择。内层图标透明且 aria-hidden，选中表面由外层卡片承担，沿用语义 brand Token。cards/rows 默认视觉与行为不变。权威示例为 /ui-elements/forms 的 RadioGroupField，真实消费者为 /settings 的主题模式。
- RadioGroupField 的 inline 用于短选项：自然宽度、可换行，不压缩实际热区；可带装饰 icon，例如受控预设色样，此时选中表面与文字承担状态表达，不重复显示圆点。previews 为少量需要比较的选项提供预览卡：以Field自身容器宽度判断，空间充足时三列纵向卡片，窄容器使用单列“预览＋标题”的横向行，避免嵌套面板中逐字竖排。preview 是 aria-hidden 的非交互内容（不得嵌套按钮、链接、输入或 tabIndex），名称仍由 label 提供。卡片布局可省略圆点视觉，不能省略 HeroUI 原生 input、选择、键盘和焦点机制。真实比较图案由 Feature composition 提供，不将颜色/密度业务语义硬编码到公共单选组件。设置的颜色、密度、字号和宽度使用同源能力；UI Elements/forms提供两种呈现、真实装饰预览、长标签与禁用示例。
- 单选 ToggleGroup 保持连续组并在内部横滚；多选保持独立项并换行。TabsView 选择、尺寸和文本变化时只调整自身列表，不持续抢回用户手动滚动；vertical 在 md 以下同时回退布局、ARIA 和键盘方向。溢出提示来自实际滚动范围。
- DrawerSurface 的 placement 为 left/right，缺省 right；navigation composition 用于共享导航内容，缺省 standard。可选 footer 位于正文滚动区之外，提交按钮通过 Action 的 form 关联正文表单；busy 禁用关闭按钮、Escape和背景关闭，业务同步禁用表单与提交。窄屏长标题最多显示两行，无障碍名称保留全文，业务在正文提供完整标识。权威示例为 `/ui-elements/overlays` 的 Drawer 表单，真实消费者为文件属性。Overlay 的焦点、Escape、背景锁定和焦点返回均由 HeroUI 管理。
- 标准 Dialog 采用正文滚动；短高度允许整个对话框滚动，操作必须可达。workspace 保持视口内的内容与工具分区，标题栏关闭入口不随正文滚动。异步确认阻止重复提交和提前关闭；重试先清除旧错误。
- DataTable 通过 columnWidths 与 onColumnWidthsChange 表达稳定 column id 的数值宽度，Adapter 组合官方 ResizableContainer/ColumnResizer 管理指针和键盘交互；不向消费者暴露 vendor Map、slot 或 props。未保存宽度使用官方自动布局。宽度、显隐、列序和排序独立合并，记忆开关只控制恢复和持久化。
- 默认单行控件使用 min-h-control 并响应 density；small/embedded 的用途尺寸允许受控例外，不把普通控件的旧固定高度当作默认。外观 profile 的 fontScale/density/contentWidth/contrast 数值由 design-system schema 的 appearanceProfiles 及生成绑定管理，不手改生成区域。

当前行为证据见 [前端架构](frontend-foundation.md)；人工视觉和真实设备限制单独保留。

## 选择控件的可点击边界

HeroUI 3.2.4 的 Switch / Radio / Checkbox 根为 Field，`Content` 为带隐藏 input 的可点击标签。
Control、Indicator、文字及可选择表面的留白必须位于同一个 Content 内。Field 根不重复绑定点击，
普通展示 Panel、配置来源摘要及外围分组容器不扩大为可点击区域。说明与名称分离，Adapter 在
Field 层提供 accessible name 与 description，避免嵌套原生 label；禁用、键盘、焦点与选择继续由
HeroUI 管理。现行官网示意与已安装版本不一致时，以安装包类型、实现及实际 DOM 一同核验。

短设置项采用 row，标题/说明左侧、开关右侧；空说明不保留占位。解释型选项可以保留 cards，
row 的悬停/聚焦表面必须包含左右内容留白（复用现有 px-3 与 py-2），文字及开关不得贴边；
留白属于原生 Content 点击热区，不加事件处理器，也不以负边距扩大到宿主容器之外。
可选择卡片的完整表面归 Content；卡片内不嵌入第二个独立操作。密度改变使用既有 min-h-control，
不得以缩小指示器替代触控热区。回归须真实点击指示器、文字、留白，并验证 Space / 方向键及 Disabled。

本次证据：[共享控件与设置任务回归](../apps/web/e2e/settings-ux-review.spec.ts)。

## Icon Navigation Overlay 组合

NavigationHint（现役 navigation-flyout 子路径）为已有 anchor/Host router link 添加
右侧 HeroUI Tooltip：完整 accessible name、单一焦点目标、Hover 延迟 300ms、Focus/
Escape，子元素必须转发标准 anchor props/ref，提示加载不得替换已聚焦的链接。
NavigationFlyout 的统一 Icon Trigger 使用 control-lg 与 icon-lg，Hover/Open/Active/
Focus/Disabled 共享语义 Token；Mouse Hover 与 Press 固定分离，Touch 使用 Tap。
Flyout 有标题和完整子树，键盘内部焦点不会因指针离开关闭。data-navigation-control
声明可直接交互的导航控制边界，公开 outside-interaction 过滤避免吞掉第一次点击。
普通外部关闭、Escape、Portal/Collision 与焦点返回仍由 HeroUI 负责。
同源组合在 /ui-elements/overlays 的 Tooltip 预览与 App Shell 验证。

## 受控日期值

`DatePickerField` 的可选 `value` 使用 ISO Gregorian 日期字符串 `YYYY-MM-DD`，`null` 清空，省略保留原有非受控用法；`onValueChange` 返回同样语义字符串或 null。公开契约不暴露 HeroUI DateValue，Adapter 通过官方 `@internationalized/date` 解析并映射 HeroUI 的受控值，Selection、Keyboard、Focus 和 Popup 保持 vendor 管理。样式及未传 value 的消费者不改变。真实消费者为 UI Elements Forms 和审计日期筛选；URL 恢复与清空的证据见 [前端架构](frontend-foundation.md)。

## 容器编排 Browser Adapter

`@clouddrive/ui-adapter/container-layout` 的 `useContainerBreakpoint` 只在内容需要改变编排时提供容器阈值与 ref（4xl/7xl，读取 Design System 保留的 Tailwind 原有命名尺度）。ResizeObserver、所属文档字号换算与卸载清理留在 Browser Adapter；普通视觉响应式继续使用 Tailwind 容器 utility。它不提供第二套路由、浮层、选择或 Motion 状态机，也不更改已有 Element 默认值。当前消费为 API Workbench 单套编辑器的窄屏/主从编排，证据见 [容器测试](../apps/web/src/test/container-layout.test.tsx) 和 [113 多端验收](../surfaces/src/api-workbench/README.md)。

## 图表 Charts（116）

`packages/ui-adapter/src/charts` 是产品级图表 primitive 的唯一实现，Analytics 与未来业务图表
必须复用它，不得在页面自绘 SVG 或引入第二套图表依赖。

- 组件：`AreaChart`（多序列 + 轴刻度 + 数据点）、`DonutChart`（段 + 图例/占比）、
  `BarChart`（横向条形）、`Sparkline`（KPI 迷你趋势）。
- 纯几何：`charts/scale.ts`（`scaleLinear`、`createTicks`、`normalizeDomain`、
  `buildAreaChartGeometry` / `buildDonutGeometry` / `buildBarGeometry` / `buildSparklineGeometry`），
  与 DOM 无关，可单测。
- Token：颜色只能用语义 `--color-chart-1..5`（light/dark 均由 Design System schema 生成），
  禁止 hex 或图表自带色板。
- 可访问性：SVG `role="img"` + `aria-label`；每个图表附带视觉隐藏的数据表（caption = 标题）；
  Area/Donut/Bar 的数据点使用 **roving tabindex**（每图一个 Tab 停靠点，←/→ 移动并读出数值），
  Sparkline 不逐点聚焦（避免每卡几十个 Tab 停靠）。
- 响应式：`viewBox` + `preserveAspectRatio` + `w-full`，无固定像素宽度；不使用动画，
  因此天然满足 reduced motion。
- Showcase/业务同源：Analytics 页面与 `/ui-elements/data#charts` 消费同一组件；Showcase
  逐图展示 Theme / Responsive / Keyboard / Accessible summary 四个状态，并由
  `data-display.spec.ts` 断言 `role="img"`、`aria-label`、方向键数据点移动与 Axe AA。

## 表格生产力组合 Collection Tools（116）

`packages/surface-foundation/src/collection-tools.tsx` 是"列设置 / 密度 / 导出 / 工具栏"的共享组合，
业务页与 Showcase 必须使用同一实现（此前仅存在于 page-archetypes 的私有实现已收敛）。

- `ColumnSettingsDialog`：可见性 + 顺序（↑/↓，非拖拽）+ 强制列 + 重置；受控 `isOpen`。
- `DensityToggle`：三档（compact/standard/comfortable）映射 DataTable 的 `density`。
- `ExportMenu`：导出动作菜单（CSV/JSON 由业务提供数据；菜单只管选择与可访问触发）。
- `CollectionToolbar`：把上述能力组合为 Toolbar；文案全部由宿主传入（无内置中文）。
- 纯函数在 `@clouddrive/core`：`normalizeColumnLayout`（去重/丢弃退役列/强制列前置）
  与 `toCsv`（RFC 4180 引号/换行转义、确定列顺序）。
- DataTable 扩展（不接管请求/搜索/分页/导出）：`density` 三档、`pinnedColumnIds`（sticky 首列，
  偏移来自显式宽度或测量）、`tree`（`childrenOf`/`expandedIds`/`onExpandedChange`/`depthOf`，
  `aria-expanded` + `aria-level` + 缩进）。
- 持久化仍属业务：users/audit 各自持有列布局 store（按用户或页面），Showcase 仅本地状态。
