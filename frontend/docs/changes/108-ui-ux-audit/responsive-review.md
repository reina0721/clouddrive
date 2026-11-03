# 响应式布局与组件适配专项复核

本报告补充 2026 年 10 月 7 日的 [UI UX 审查](README.md)。复核从设置搜索框异常扩展到全部 38 个已知页面，检查 Shell、公共控件、页面组合和浮层在不同有效视口中的表现。重点是找出可复用的原因与优化策略。本轮交付更新后的分析与规范建议，未将推荐方案标记为已经实现。

后续 [移动端设置与切换控件专项审查](mobile-review.md) 补充320/390/430px全路由复核、设置八分类与搜索定位、全部内容Tabs/ToggleGroup及PageTabs实际交互，并提出分场景的统一响应式策略。

## 1 结论与新增优先级

**当前问题不是全站缺少响应式，而是公共布局边界没有完全闭合。** 大部分页面能够折行，大屏内容有统一最大宽度，表格横滚与 Drawer 内滚动也已经存在。应保留这些能力，优先修复以下两个新增 P0：

1. **1024px 边界时 Shell 单列与桌面侧栏同时出现**，把主内容推到整屏导航下方。
2. **320×256 的短有效视口中 Dialog Footer 被裁切**，键盘可聚焦到用户看不见的取消/确认按钮。

新增 P1 是公共字段在并排布局中被拉伸，以及 Compound Content 继承的横向排版与项目标题/说明层级不一致。首轮发现的设置搜索、移动顶栏、设置密度、数据主从布局问题，本轮已进一步定位原因和影响范围。密度策略与测试矩阵还需补充 P2 层面的规范。

## 2 检查方法与覆盖范围

### 基础矩阵

全部 38 个路由分别检查 **320、768、1024、1440、2560px** 宽度，基础高度为 900px，共 **190 个结构测量组合**。每次确认真实页面标题已加载；两次加载中间状态已重新测量替换。数据保存在 [基础矩阵](evidence/responsive/matrix.json)。这不是 190 张人工确认的视觉基线：全量采用 DOM 位置/宽度筛查，典型异常再通过截图、实际按键和源码验证。

附加检查：

- 设置页断点：639/640、767/768、1023/1024/1025、1279/1280/1281，共 10 个边界样本。
- 设置宽度：1280、1440、1600、1728、1920、2560，检查主区、二级导航和搜索内区。
- 英文、大字号 18px、宽松密度：设置、UI Forms、资源工作台、Reference 创建、Forms Pattern 五页，各检查 320/390/640/1025/1280/1440，共 30 个组合。
- 短窗口浮层：320×256、320×568、720×450、1440×400；实际打开 Dialog、Dropdown、Command、Drawer，并验证短视口内 Tab 的焦点位置。
- 缩放后的布局空间：以 1280×1024 为参照，模拟 100%、125%、150%、200%、400% 的有效 CSS 视口。

### 缩放模拟边界

当前浏览器控制接口支持视口覆盖，尝试缩放快捷键后 `innerWidth`、DPR 和 visual viewport scale 未改变。因此本轮**不是浏览器原生 zoom 实测**，使用有效布局视口模拟：

| 等效比例 | CSS 视口  | 观察                                         |
| -------- | --------- | -------------------------------------------- |
| 100%     | 1280×1024 | Shell 双列，设置搜索越出侧栏                 |
| 125%     | 1024×819  | 正好命中 Shell 边界缺陷，主内容起点为 y=899  |
| 150%     | 853×683   | Shell 切为手机导航，设置仍是完整分类列表在前 |
| 200%     | 640×512   | 页面可折行，但设置路径偏长                   |
| 400%     | 320×256   | 顶栏整页横溢出；Dialog Footer 裁切           |

测量前回到文档顶部并记录 scrollY=0，避免把滚动位置误判为布局位移。[缩放等效证据](evidence/responsive/zoom-equivalent.json)。W3C 的 Reflow 说明也使用 1280 宽度在 400% 下等效 320 CSS 像素这一关系；该模拟可判断重排和有效空间问题，不能证明原生缩放的字体栅格化、DPR、浏览器菜单或设备键盘行为。[W3C Reflow](https://www.w3.org/WAI/WCAG21/Understanding/reflow)

本轮使用 Codex 内置浏览器，没有执行 Firefox/Safari 或物理设备矩阵。“不同分辨率”在本报告指不同 CSS 布局空间，不声称改变了显示器物理像素密度。隐藏的 React Aria 原生输入、合法的表格/Tab 内部横滚、入场动画中间坐标均不直接认定为缺陷。

## 3 分场景结果

| 场景              | 表现                                                                   | 评价                                         |
| ----------------- | ---------------------------------------------------------------------- | -------------------------------------------- |
| 1920～2560 超宽屏 | 默认主内容封顶约 1536px，居中留白；设置导航约 334px，搜索可放入        | 最大宽度策略值得保留；不需要无限铺满         |
| 1440 普通桌面     | Shell 正常双列；设置侧栏约 248px，搜索约 281px                         | 局部内区溢出，不能只检查 document 横滚       |
| 1280 普通桌面     | 设置二级导航224px，内部可用198px，搜索281px                            | 搜索跨过24px列间距并侵入主区                 |
| 1025 窄桌面       | Shell 左栏264px，主区约746px；多列字段仍按窗口断点启用                 | 工作区已经偏窄，组件却仍认为处于桌面多列模式 |
| 1024 边界         | 侧栏显示为整行、占一屏；main 起点为一屏高度加顶栏                      | 新增 P0，跨所有使用该 Shell 的页面           |
| 768 平板/窄窗     | 主侧栏隐藏；Settings 分类完整占据约482px高；部分数据需横滚             | 可以显示，但配置效率和数据任务路径未适配     |
| 390 手机          | 标准中文多数主体可重排；英文/放大/宽松组合顶栏更明显溢出               | 需给顶栏建立空间优先级，而非缩小所有控件     |
| 320 最小重排视口  | 38页标准中文均出现约53px整页横溢出，来源相同顶栏                       | 公共缺陷，不是38个页面各自的宽度问题         |
| 短有效高度        | Drawer 的关闭与 Body 内滚动仍存在；Dialog Footer 可离开可见区且被 clip | 浮层要同时考虑宽度和可用高度                 |

上表尺寸均是当前 Token、默认主题/密度、经典滚动条下的样本，不应复制成新的页面固定值。

### 组件比例与全局一致性

| 对象            | 复核结果                                                     | 判断                                                       |
| --------------- | ------------------------------------------------------------ | ---------------------------------------------------------- |
| 搜索框          | Grid中最小内容宽度可越界；非Grid的Command可缩至205px         | 修复收缩Contract，不能一律扩大容器                         |
| 单行输入/选择器 | 正常、错误、禁用被拉成不同高度；说明区行数改变控制行         | 修复内部排布，不压缩错误文本                               |
| 按钮            | 页面动作与Overlay Trigger有不同正式尺寸；宽松密度响应不一致  | 先明确size/density语义，不强行全部等高                     |
| 卡片/Panel      | 多数窄屏能够折行，Settings/Showcase局部留白偏多              | 保留视觉语言，调整内容组合和真实容器分列                   |
| Dialog          | 常规桌面可用，短有效高度确认按钮被裁切                       | 高度Contract与键盘可达性优先                               |
| Dropdown        | 320×568打开态可放入可视区域，Disabled/Danger仍可辨认         | 保留已有HeroUI碰撞与选择管理，补充长Item回归               |
| 标签/Badge      | 本轮典型状态标签能够折行；不能把内部Tab横滚误判为整页溢出    | 不增加页面专属字号或圆角                                   |
| Drawer          | 320×256关闭入口可见，Body拥有内部滚动                        | 复用该能力，不另建页面浮层                                 |
| 设置面板        | 二级导航宽度随着主区变化；手机/平板任务排序未变化            | 优化分类进入方式与定位                                     |
| 表格/数据       | 内部横滚已有；主从任务在窄空间缺少即时详情呈现               | 明确关键列和详情路径，保留二维表格例外                     |
| 页面宽度/间距   | Shell main共享最大宽度和padding，多数Page使用统一骨架        | 没有证据要求每页另造容器；滚动条造成约15px差异不算规范漂移 |
| 字体/图标       | 根字号能随偏好变化，PageHeader层级同源；窄列英文说明造成挤压 | 修复空间/文本流，不通过缩小字号掩盖                        |

固定尺寸本身不是缺陷。图标、控件命中区、表格必要列宽需要稳定尺度；问题在于最小尺度之和超过有效空间、没有可收缩父层，或只按窗口而非实际容器分列。现有rem与语义Token继续使用，padding/margin也优先沿用正式尺度。

## 4 原因与影响范围

### R01 P0 Shell 断点边界发生冲突

**实测问题**：1023px 下侧栏隐藏，main y=80；1024px 下侧栏显示，但 Shell 只有一列，main y=880（800px高视口）；1025px 下恢复两列，main x=264、y=80。

**原因**：Host 使用 `lg:flex`，含义是 `width >= 64rem`。Surface CSS 使用 `@media (max-width: 64rem)`，含义是 `width <= 64rem`，在等号处将 Shell 改成单列。二者在同一个边界同时生效。[Surface CSS](../../../packages/surface-foundation/src/styles.css)、[Host Shell](../../../apps/web/src/shell/app-shell.tsx)。Tailwind 官方的 `max-lg` 使用严格小于边界的范围，可避免重叠。[Tailwind Responsive Design](https://tailwindcss.com/docs/responsive-design)

**影响范围**：全部当前 Shell 页面，包括设置、UI Elements、Archetypes、Patterns、Reference；某些浏览器缩放比例也会恰好命中该宽度。

**优化方案**：以同一 breakpoint authority 表达互补区间，保证手机单列规则是严格小于 lg；Desktop visibility 与 Shell columns 在同一时刻切换。不在页面增加负 margin 或隐藏桌面侧栏补丁。

**验收**：1023/1024/1025、展开/收起侧栏、中英文/字号变更均无导航占满整行或内容落到下一屏。证据：[断点 JSON](evidence/responsive/breakpoints.json)、[1024px 截图](evidence/responsive/settings-1024.jpg)。

### R02 P0 短视口中 Dialog Footer 不可见

**实测问题**：320×256 下 Dialog 高约224px、top16px；取消/确认按钮在 y≈259px，超出视口且超出 Dialog 的 clip 区域。Tab 可聚焦按钮，但不会让按钮完整显示；仍可以按 Escape 关闭，这不等于确认任务可完成。

**原因**：Modal.Dialog 已有高度限制和 `overflow: clip`。Header 与 Footer 的内容和 padding 占据大部分高度，Body 即使有 `min-height:0` 与内部滚动，其 padding 仍占空间。Header/Body/Footer 的最小实际占用之和超过整个 Dialog，Footer 被推到外面。不能简单再给 Body 一个固定高度。[Overlay Adapter](../../../packages/ui-adapter/src/overlays.tsx)。

**影响范围**：已确认普通 DialogSurface；同文件中 Confirm/Destructive 结构相近，属于必须追加回归的消费者，不宣称已逐个重现。长标题、错误提示、移动软键盘会进一步减少可用空间，真实软键盘本轮未测试。

**优化方案**：保持 HeroUI 的 Modal anatomy 和焦点机制。优先保证完整 Dialog 有可达滚动策略；需要固定 Footer 时，对整个剩余高度进行分配，Header/Footer 不挤掉内容和按钮。当有效高度不足时，采用官方支持的整体滚动/placement 策略与正式响应式 inset，不把不可见按钮留在 Tab 顺序里。

**验收**：320×256、200%/400%等效视口、长标题、错误/Pending 下取消与确认可通过触屏和键盘看到并操作；焦点不进入裁切区域。证据：[短视口截图](evidence/responsive/dialog-320-256.jpg)、[Tab 焦点坐标](evidence/responsive/dialog-short-focus.json)、[浮层尺寸](evidence/responsive/overlays.json)。

### R03 P1 SearchBox 的最小内容宽度突破 Grid 边界

**实测问题**：1280px 设置页，二级导航224px，Panel 内区198px，SearchBox 根和 Group 却是281px；1440时内区约222px，搜索仍281px；1600时内区约259px，仍不足。1728以上才容纳搜索。部分内容虽没越过 document，仍跨越组件边界。

**原因**：SettingsSearch 外层为单列 `grid`，没有显式可收缩列；SearchBox 根是 `w-full`，但缺少与 Grid 最小内容尺寸相配合的收缩约束。默认 auto track 的 min-content 宽度可超过容器；只给 Input `min-w-0` 不会修复祖先的轨道。实测外层宽198px、其 grid track281px，输入本身已经 `flex:1 1 0%` 与 `min-width:0`。[SearchBox](../../../packages/ui-adapter/src/search-box.tsx)、[Settings composition](../../../surfaces/plugins/settings/src/settings-layout-shell.tsx)。

**影响范围**：八类设置页共享同一导航，均受影响。SearchBox 还被 Forms、Surfaces、资源工作台和 CommandMenu 使用，必须做消费者回归；不是所有消费者都已坏掉。实际 Command 的非 Grid 场景可收缩到205px，未出现同样281px根宽。

**优化方案**：在公共控件 Contract 中明确根/Group/输入的 shrink 行为，在 Grid composition 中使用可收缩 track；使用官方公开 className 收口。不要单独把设置侧栏扩大到281px，也不要加 overflow-hidden 裁掉搜索。

**验收**：正常、禁用、有值清除态、200px左右内区及长 placeholder 下都遵守父边界；Clear/Icon 不压扁，键盘焦点完整。证据：[设置宽度 JSON](evidence/responsive/settings-widths.json)、[1280px截图](evidence/responsive/settings-1280.jpg)。

### R04 P1 并排字段被拉伸为不同控制高度

**实测问题**：1025px 中文标准密度，同组正常/错误/禁用 TextField 的 Input 高度约44、51、68px；三者根高度均120px，内部 grid rows 却不同。英文大字号/宽松样本中，常规输入58.5px，禁用输入85.5px；Showcase 顶部 Select Trigger 可被拉到127px。

**原因**：外部 Grid 默认 stretch 让多个 Field 根同高；`.ui-field` 是 Grid，但没有收敛内容起始对齐，其 auto rows 分配多余高度。控件只有 min-height，Label/Hint/Error 行数不同，剩余空间被分配给输入行。[Field CSS](../../../packages/ui-adapter/src/styles.css)、[Fields Showcase](../../../surfaces/plugins/ui-elements/src/form-elements-page.tsx)。

**影响范围**：UI Forms 的并排样本和 Showcase Controls 已确认；所有 Grid 中使用 TextField/SelectField 等的消费者需回归。不能据此断言 TextArea 的多行高度也应统一。

**优化方案**：让字段内部内容从起始位置排布，单行 Control 的高度由同一 size/density Contract 决定；外部按需要对齐整组字段或输入基线。Error/Hint 增加字段总高，不应拉长 Input。多行、Date segment 和嵌入字段分别验证，不用全局固定 height 把不同语义一起锁死。

**验收**：同 size/density 的正常、错误、禁用单行控件高度一致；长 Hint/Error 增高说明区；三列比较无控制高度漂移。证据：[字段截图](evidence/responsive/form-controls-1025.jpg)、[英文大字号尺寸](evidence/responsive/english-large-comfortable.json)。

### R05 P1 组件内部排版没有完整收敛 Compound 默认行为

**实测问题**：1025px 英文大字号下，Showcase 两个 Switch 的标题与描述横向挤在同一行，文字被切成短词行，整个卡片约227px高；控制区留白被放大。

**原因**：项目把标题和描述分别写为 block span，但 Switch.Content 的计算样式仍为 flex row。block 子项不会让 flex 容器自动变成纵向流。再叠加以视口 `md` 为依据的三列，而实际内容区已被主侧栏扣减，组件获得的宽度远小于“桌面窗口”暗示的宽度。[Switch/Radio Adapter](../../../packages/ui-adapter/src/form-field.tsx)。Radio.Content 相似组合也需要复核，不能只换文字。

**影响范围**：九个 Family 复用的 Showcase Controls、带说明的 Settings Switch，以及相似 Radio composition。已确认 Switch 的计算样式；Radio 属于相同原因的后续验收对象。

**优化方案**：在 Adapter 的公开 Compound part 明确标题/描述的排版方向与 min-width；空间层用组件容器的可用宽度决定列数。使用容器查询或已有 auto-fit/minmax 组合，不机械把所有 md 页面设为三列。高密度设置优先紧凑行，描述性选择才用卡片。

**验收**：标题与描述层级清楚，300px以内容器也可阅读；加侧栏、嵌 Panel、字号变化时列数与实际空间匹配。证据：[窄桌面英文截图](evidence/responsive/forms-1025-en-large.jpg)。

### R06 P1 Settings 的结构只改变列数，没有改变任务优先级

**实测问题**：二级布局在1280px才变为两列；768/1025/1279下，完整分类导航在内容之前。在768下分类约482px高；加 PageHeader 后，首屏很难进入真正配置。

**原因**：`.surface-settings-layout` 在80rem以下退回单列，而 navigation 仍是完整 Panel。短 Radio 全部走 `min-h-20` 卡片，短项与有描述的选项缺少使用区分。布局能折行，却没有针对配置任务重新组织信息。

**影响范围**：设置八分类；Settings Archetype 中同类长导航组合也需参照。原报告 P1 02 的原因和范围在此补充。

**优化方案**：在手机/窄窗提供当前分类加切换入口，保留搜索；桌面双列由内容可用空间触发，侧栏有上限而不是无限占比。短枚举选择与布尔项优先用紧凑行 composition，保留原有有描述卡片场景，不改变全部 Radio 默认值。

**验收**：无需先滚过八分类即可编辑；搜索命中具体设置后能定位目标项，而不是仅返回整类顶部。当前搜索结果链接只含 category target，没有 field anchor，属于后续应补齐的定位行为。

实际复核在外观页搜索“动效”，点击“动效偏好”后URL仍为`/settings`、scrollY=0，目标RadioGroup位于y=1728，超出900px高视口；证明现有入口只定位分类，未定位具体项。

### R07 P1 顶栏缺少最小空间预算

**实测问题**：标准中文320宽时，38页都约53px整页溢出；英文18px/宽松密度320和390样本溢出分别约166和96px。账号姓名/职责完整显示、三个工具图标与菜单共同消耗空间。

**原因**：所有操作使用同一横排，账号不根据空间降级；密度/字号放大后每个项目都增大。主区的 `min-w-0` 不会修复 header 自身的最小内容宽度。搜索区域在 md以下直接隐藏，没有等价触屏入口。

**影响范围**：全站 Shell；原报告 P1 01 已由英文手机个例扩大为中文320和全站大字号风险。

**优化方案**：保留菜单、搜索、通知与头像等核心入口，次要主题/语言操作收进已有菜单；账号响应式显示头像并保留完整可访问名称。不能用整体 `overflow-x:hidden` 让账号或按钮被无声裁切。

**验收**：320有效宽度、中英文、大字号/宽松/紧凑均无整页横滚；每个保留操作仍有合理命中区。证据：[英文大字号手机设置](evidence/responsive/settings-390-en-large.jpg)。

### R08 P1 数据区和 Toolbar 需要明确窄空间策略

**实测问题**：资源表最小内容约797px；768px窗口可用表格宽度仍不足，需内部横滚。手机选择记录后详情在长页面下方。工作台搜索 wrapper 有 `min-w-64`，叠加搜索自身和多个操作，窄屏下增加折行与纵向占用。

**原因**：多列表格是一种合法二维内容，但页面没有充分表达滚动和窄窗任务替代路径。Toolbar 的最小项宽与容器宽没有统一约束；页面总宽正确不等于每个操作组都可用。

**影响范围**：资源工作台、DataTable 消费场景、组合 Toolbar；原报告 P1 03/06在此补充。

**优化方案**：桌面保留表格和主从布局；窄空间优先关键列并提供明确横滚提示，次要信息进入详情。选择后用同源 Detail Drawer/路由呈现，保留列表位置。Toolbar 主搜索可收缩，次要操作进入现有 Menu；不把所有表格机械改成 Card 列表。

**验收**：表格内部可横滚而 document 不横滚；Tab/触屏能到达列与操作，选中后明确看到详情；关键操作不因换行丢失。

### R09 P2 密度响应的语义不够明确

**实测问题**：同一宽松密度下 IconAction 52px、SearchBox Group44px、恢复操作 Trigger40px。后两者使用 `min-h-11`/`h-10`，前者消费可变 control Token。

**原因**：不同尺寸来源混用，部分组件响应 density，部分仅响应根字号。40/44/52本身不是错误，也不要求所有按钮同高；缺少明确的默认 size、compact/embedded exception 和 density消费说明才会导致误用。

**影响范围**：SearchBox、OverlayTrigger、Dialog Footer 与其他硬编码 spacing utility 的控件，应按语义类别复核。

**优化方案**：登记哪些尺寸随 density变化、哪些是正式小尺寸/嵌入变体。相同用途/size默认消费同一 Token；Overlay 的中性色、Hover/Pressed/Focus 已有统一实现，继续保留，不因尺寸统一改变交互语义。

**验收**：紧凑/标准/宽松改变可解释，同类同行组合比例一致，不牺牲焦点和可访问命中区。

### R10 P2 回归矩阵缺少边界与有效高度

**当前情况**：已有 Surface 测试覆盖1440、1920、768、390，导航也有短窗口样本；不是没有响应式测试。但常规分辨率无法证明1024等号边界正确，也不会自动发现320×256的 Footer裁切。[Surface 测试](../../../apps/web/e2e/surface-foundation.spec.ts)、[Playwright配置](../../../playwright.config.ts)。

**影响**：窗口尺寸看似覆盖很多，公共缺陷仍可落在采样之间。

**优化方案**：保留现有截图矩阵，增加少量高价值行为/几何断言：边界前/等号/后、最小有效高度、控件父边界、焦点元素可见区域。不要对每一像素都做快照，也不要只以 document.scrollWidth 判断局部正确。

**验收**：新增测试能够在当前缺陷上失败、修复后通过；合法二维表格/Tab横滚不被误报；不更新视觉基线掩盖问题。

## 5 建议建立的统一响应式规范

| 规范         | 建议内容                                                                                         | 所有者                              |
| ------------ | ------------------------------------------------------------------------------------------------ | ----------------------------------- |
| 断点区间     | 只用同一组正式 breakpoint；小于和大于等于形成互补区间；至少测 b−1/b/b+1                          | Design System映射与Surface/Host消费 |
| 页面空间     | main维持统一最大宽度/响应式padding；不要每页新建容器宽度；列表与阅读模式可有正式用途差异         | Host + Surface Page/Pattern         |
| 内部收缩     | Grid轨道允许minmax(0,1fr)，Flex/Grid关键子项可收缩；w-full不是完整Contract                       | Layout + UI Adapter                 |
| 分列决策     | Shell用viewport；嵌入字段/卡片/工具条用实际container可用宽度，优先已有auto-fit/container queries | Pattern/Plugin composition          |
| 字段高度     | 单行Control由size/density决定；Hint/Error增加说明区，不拉伸Input；多行另有语义                   | UI Adapter                          |
| Compound文字 | 标题、描述、图标的流向和收缩明确；不假设block子项会改变vendor flex方向                           | UI Adapter                          |
| 内容分工     | 短选项用紧凑配置行；有解释内容的选项用卡片；禁止全局把所有组件压小                               | Settings/Feature composition        |
| 顶栏预算     | 最小宽度下保留核心入口，次要操作有明确收纳处；放大字号仍可操作                                   | Host                                |
| 浮层尺寸     | 宽度受有效viewport约束；高度考虑Header/Body/Footer总占用和动态可用高度；所有焦点目标可见可达     | UI Adapter + HeroUI                 |
| 横滚         | 仅在明确二维内容或导航条内部出现；有可发现反馈；整页不因工具条/账号横滚                          | Data/Navigation Pattern             |
| 字号与密度   | 两者独立，明确尺寸Token消费；应用大字号不是原生浏览器zoom的替代证明                              | Design System/Host                  |
| 验证证据     | document边界、component边界、布局位置、操作可达四类断言；典型截图加行为证据                      | Tests/Gates                         |

建议验证矩阵：320、390、768、1023/1024/1025、1279/1280/1281、1440、1920/2560；短高度至少256/400，中文/英文、标准/大字号、标准/宽松、Light/Dark，以及浮层打开态。组合无需全部做全页快照，但核心Contract必须覆盖。

## 6 实施顺序和边界

1. **先解决核心可达性**：原报告移动导航焦点 + R01断点 + R02Dialog高度。优先修复公共原因，避免38个页面各自补丁。
2. **再解决公共尺寸Contract**：R03搜索收缩、R04字段内部排布、R05Compound文字。修改前检查全部消费者，在对应UI Family复核长文本、嵌套、Dark、键盘与焦点。
3. **优化任务组合**：R06设置分类/紧凑选项、R07顶栏预算、R08表格/详情路径。具体产品场景放在Owner composition，不把业务要求塞进Plugin Framework。
4. **收敛规范与证据**：R09密度语义、R10边界和短高度回归，修复原报告中阻断完整检查链的既有问题。

不推荐整体换皮、不新建万能响应式Wrapper、不为每个窗口宽度增加Token、不用全局overflow-hidden消除滚动条、不强制所有组件等高。公共Element若修改，需要先进入TailAdmin对应具体UI页面校准，采用HeroUI公开Compound接口，完成项目要求的Contract/Showcase/Accessibility/Responsive/Dark/Content与门禁验证。

## 7 证据与本轮验证状态

- [基础190组合](evidence/responsive/matrix.json)
- [10个断点样本](evidence/responsive/breakpoints.json)
- [设置六种宽度](evidence/responsive/settings-widths.json)
- [英文大字号宽松30组合](evidence/responsive/english-large-comfortable.json)
- [缩放等效视口](evidence/responsive/zoom-equivalent.json)
- [浮层尺寸](evidence/responsive/overlays.json)与[短视口键盘焦点](evidence/responsive/dialog-short-focus.json)
- [1024 Shell](evidence/responsive/settings-1024.jpg)、[设置搜索1280](evidence/responsive/settings-1280.jpg)、[2560设置布局](evidence/responsive/settings-2560.jpg)、[单行控件1025](evidence/responsive/form-controls-1025.jpg)、[大字号英文组合](evidence/responsive/forms-1025-en-large.jpg)、[手机设置放大](evidence/responsive/settings-390-en-large.jpg)、[短Dialog](evidence/responsive/dialog-320-256.jpg)、[Command窄屏](evidence/responsive/command-320.jpg)、[Drawer短屏](evidence/responsive/drawer-320-256.jpg)

结构数据用于定位并不能自动证明视觉/可访问性全部合格。首轮类型、367项单元测试、lint与文档失败结果仍见主报告。本轮再次执行`pnpm check`，Foundation/Architecture/Dependency/Codegen通过，仍在lint以101 errors、13 warnings中断，后续链路未执行；见[本轮日志](evidence/responsive/pnpm-check.log)。两个报告的格式检查通过，新增链接逐项检查存在。

本轮没有修改产品实现、视觉基线或用户原有锁文件。测试偏好已恢复为中文、标准字号、标准密度、系统主题，并清除临时搜索、恢复浏览器视口。原生浏览器zoom、软键盘、多引擎及真实设备属于仍需补充的实施验收环境，不在本轮宣称已测。
