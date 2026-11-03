# clouddrive UI UX 审查报告

本报告记录 2026 年 10 月 7 日对 `http://127.0.0.1:4173` 的实际浏览、交互与源码核对结果。当前项目是一套后台产品前端基座与 Reference/Showcase，而不是已经接入真实业务数据的完整管理系统。评价因此同时关注组件规范、示例可信度，以及这些能力是否能支撑真实业务页面。审查保留现有设计语言，不建议整体推翻重做。

## 1 当前项目整体评价

**设计语言已经形成，交互完成度与移动端体验尚未达到同等成熟度。** 浅灰画布、白色内容面、紫色强调色、清晰的标题层级及统一控件，建立了专业后台的基本观感。Universal、Surface、Host 的分层也比常见的页面堆叠项目更完整。

主要短板集中在三个方面：移动端导航缺失完整浮层语义；部分示例看起来可以操作却没有相应结果；信息架构仍以开发术语为主，首页和局部文案未与当前实现同步。用户容易把“展示一种能力”理解成“这个流程已经可用”。这些问题会削弱产品可信度，优先级高于新增视觉装饰。

首轮确认 1 项 P0、10 项 P1 和 3 项 P2。后续响应式专项新增的发现与原因见第10节及补充报告，不将同一公共问题在多个页面重复计数。P0 指阻断一类用户的核心操作，不表示整个网站不可运行。P1 影响完成任务、理解结果或交付质量；P2 用于进一步收敛品质。

## 2 审查范围与证据边界

### 页面覆盖

共访问 38 个路由，检查首屏、内容区及长页面下方区域：

| 分组                    | 已访问路由                                                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 首页与基础能力          | `/`、`/foundations`、`/motion`、`/states`、`/system-tools/icons`                                                                        |
| Reference               | `/reference-resources` 及其 `/create`、`/detail`、`/edit`                                                                               |
| UI Elements 九个 Family | `/ui-elements/actions-selection`、`feedback`、`status-async`、`identity-display`、`navigation`、`data`、`surfaces`、`forms`、`overlays` |
| Page Archetypes 七类    | `/page-archetypes/overview`、`resource-list`、`detail`、`create-edit`、`settings`、`master-detail`、`operation`                         |
| Page Patterns 五组      | `/page-patterns/layout-navigation`、`collections-data`、`forms-actions`、`states-feedback`、`detail-settings`                           |
| Settings 八分类         | `/settings`、`navigation`、`data-display`、`actions`、`locale`、`notifications`、`accessibility`、`shortcuts`                           |

表中未写完整前缀的项目均接在所属分组前缀后，例如 `/settings/navigation`。

### 实际操作

- 打开与关闭桌面/移动导航、展开导航分组、切换页面、使用命令搜索和设置搜索。
- 切换浅色/深色和中英文，检查英文长文本与窄屏组合。
- 打开 Dropdown、Popover、Dialog、Drawer、DatePicker；检查 Dialog 的 Tab、Escape 和关闭后的焦点恢复；选择日期后确认输入结果。
- 切换 Radio、Tabs、列表状态过滤；48 条示例数据过滤至 16 条，再通过搜索进入空结果。
- 选择移动端工作台条目，观察详情位置与结果反馈。
- 新建与编辑 Reference 资源、空值提交、草稿保存、Pending/Success 通知；检查示例主从页面的点击结果。
- 检查异步 Loading、Refreshing、Empty、Error 和恢复入口；观察页面切换与内容替换。

视口为 390×844、1280×900、1440×1000、1920×1080。结论中的坐标取自浏览器 DOM 测量，截图用于辅助复核。截图缩放/捕获产生的模糊不视为网站缺陷。

未执行全部状态组合的自动化 Axe 扫描，也未重跑完整 Playwright/视觉回归。Hover 的评价以组件状态实现和界面检查为辅，本轮不宣称完成逐控件指针悬停矩阵。没有用开发服务器测量生产环境 LCP、INP、CLS 或帧率，故不输出伪精确的性能评分。没有研究后端接口，也没有修改产品实现或视觉基线。

## 3 视觉设计分析

### 风格与首屏

整体属于克制、柔和的现代后台风格。侧栏、顶栏和内容区边界稳定，紫色用于选中与主要操作，状态色与品牌色基本分离。图标与圆角语言一致，品牌目前更偏“前端基座”而非特定业务产品；这与当前建设阶段相符。

首屏有明确的标题、介绍和统计卡，容易判断这是控制台。但 Runtime Hosts 等指标、成熟度百分比和 Sprint 文案更像运行看板，缺少口径与数据来源。初次访问者能识别后台外形，却仍需要探索才能知道应先看组件、模式还是完整流程。

### 字体与信息层级

桌面实测首页标题约 36px/40px、800 字重，正文约 16px/28px，常规标签约 14px/20px，辅助文字约 12px/16px。标题、数值和正文的级差清楚，正文行高舒适。大标题的高字重已有辨识度，无需通过增加字号建立“高级感”。

问题主要来自文字内容而非字体：部分中文页面夹杂完整英文叙述、路由名直接充当标题，重复的“用于验证正常内容节奏”不能帮助理解区块。密集页面中过小、较弱的辅助文字也值得结合大字号/高对比度偏好复核；本轮没有据此断言 WCAG 对比度不合格。

### 布局与留白

桌面主要内容最大宽度与侧栏比例总体合理，1920 宽屏仍保持阅读边界，没有把所有内容无限拉宽。Section 与 Panel 的内边距、段间距、按钮高度有统一语义来源，这是重要优点。

局部空间使用不够有效：首页最近访问内容增长后，半宽长列表形成右侧空白并推迟后续信息；设置页将短选项也做成大卡片，出现较多用于容器而非内容的留白。工作台主从两栏在中等桌面宽度下使表格列较拥挤，长区域文本与状态多次换行。优化应区分“概览卡”“选项卡”“密集数据行”，不宜全局缩小间距。

### 组件与比例

按钮、输入框、标签、通知和浮层总体共享同一语言。主要操作可辨认，Dialog/Drawer 内的操作区域清楚，日期选择能返回正确结果。头像和图片示例具备预留空间及回退状态；当前主要是组件示例，缺少真实内容图片样本，不能据此评价业务图片裁切策略。

普通页面容器普遍同时使用背景、边框、圆角和阴影，导致每个区块都带有较强边界。柔和视觉值得保留，但层级可以更多由间距、底色与标题表达，把阴影优先留给真正浮起的元素。

### 响应式

窄屏并非完全失效：多数网格会折行，表单与弹层能够显示。但关键问题仍明显：英文顶栏横向溢出；设置分类占据首屏；表格虽可横滚，选中记录后的详情仍留在长页面下方；移动导航没有完整焦点管理。当前更接近“能够缩到手机上”，尚未形成完整的手机任务流程。

## 4 UX 与动效分析

### 用户路径

桌面导航分组、明确的页面标题和全局搜索有利于重复访问。Reference 的列表—详情—编辑路径也提供了可理解的业务骨架。设置项即时预览、草稿 Pending 状态和成功通知，是值得继续使用的反馈方式。

但路径中存在几种认知断点：不同列表行进入同一个固定详情；可以点击的示例操作没有效果；搜索需按 Enter 才生效但提示不明显；空结果提示清除筛选却没有直接清除全部入口。面包屑的上级项表现为路径，却没有导航行为。

移动端还存在任务断点：导航打开后 Tab 可进入被遮挡页面，Escape 无法关闭；设置编辑内容被完整分类列表推到屏幕下方；工作台点选行后，没有把用户带到详情或展示明显就地反馈。

### 动效与状态反馈

当前动效体系的方向正确：路由进入、内容替换、Disclosure、Overlay 与异步状态各有职责；Refreshing 保留原内容，避免把每次更新都变成整页 Loading。Duration/Easing 等来自 Token，页面不需要各自发明动画。抽查 Dialog 的关闭、焦点恢复和日期输入结果正常。

没有观察到必须删除的长时间阻塞动画。需要进一步校准的是快速连续导航时顶部进度条与区段进入动效的叠加，以及密集操作下反复进入的视觉噪声。移动导航缺失焦点/关闭反馈和静态示例按钮缺失结果，比“增加更多动画”更紧急。

本次不凭静态截图判断动画流畅度。后续应在真实设备、减少动效、高对比度及快速连续操作下验证，保持当前语义动效分层。

## 5 前端架构与工程分析

### 值得保留的结构

- Design System 的语义 Token 和 UI Adapter 的 Vendor 边界，为视觉一致性提供了真实约束。
- Page、PageHeader、Section、Toolbar、State/AsyncRegion 等形成统一页面与状态组合。
- Plugin ownership 与 Web Host 分离，Next 路由装配没有扩散为第二套路由运行时。
- state-foundation 将持久化、Namespace、hydration 等机制集中；业务拥有自己的 Store，而非全局万能注册表。
- i18n、Contract Registry、codegen、边界检查、单元测试和浏览器测试设施已经建立。

### 当前维护风险

架构门禁通过不代表所有运行时行为正确。移动导航在 Host 内自行实现遮罩和 aside，绕过现有浮层的焦点能力；这属于实现选择与产品规则不一致，而不是需要重建 Framework。

部分 Plugin route 内直接处理 `document`、可见性或浏览器生命周期，需按 Host/明确 Browser Adapter 所有权复核。Settings 中的 `as never` 更新方式降低了字段与值的类型关联保障。资源工作台路由承担了较多筛选、列偏好、导出、状态与编排逻辑，长期扩展时应拆成 Plugin 私有逻辑与视图，不能直接复制为每个业务列表模板。

[移动导航实现](../../../apps/web/src/shell/app-shell.tsx)、[PageHeader 面包屑契约](../../../packages/surface-foundation/src/layout.tsx)、[Settings 组合](../../../surfaces/plugins/settings/src/settings-layout-shell.tsx)、[Settings 字段更新](../../../surfaces/plugins/settings/src/category-sections.tsx)、[Reference 创建页](../../../surfaces/plugins/reference-resources/routes/create/page.tsx)、[工作台路由](../../../surfaces/plugins/page-archetypes/routes/resource-list/page.tsx) 是建议优先复核的入口。

### 本次工程验证

| 检查                                                                         | 本次结果                                                                         |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `pnpm check`                                                                 | 失败，停在 lint：114 个问题，其中 101 errors、13 warnings                        |
| Foundation、Tailwind source、Architecture、Dependency、Plugin/Design codegen | 在上述检查链中通过                                                               |
| 独立 `pnpm typecheck`                                                        | 通过                                                                             |
| 独立 `pnpm test`                                                             | 通过，59 个测试文件、367 项测试                                                  |
| 独立 `pnpm docs:check`                                                       | 失败：现有 `docs/README.md` 指向 `../../docs/repository-scope.md` 的链接无法解析 |
| Build、产物预算、完整 Playwright、全库格式检查                               | 检查链未执行到；本轮未独立重跑，不作通过声明                                     |

日志：[完整检查](evidence/pnpm-check.log)、[类型检查](evidence/typecheck.log)、[单元测试](evidence/unit-tests.log)。lint 问题包含 Hook 生命周期、类型断言和模块导出等现有实现问题，不能通过降低规则消除。类型与单元测试通过仍未覆盖本文记录的真实导航、布局和示例语义问题。

当前是 dev 运行环境。生产包大小、首屏资源和交互性能需在修复质量门禁后用独立生产构建测量；本报告不把开发环境体验归因于生产性能缺陷。

## 6 当前优点

1. **统一的视觉语言**：配色、控件尺寸、圆角和状态色具有连续性，浅深色主题没有明显脱节。
2. **组件组合基础扎实**：正式 Page/Section/Panel 和状态组件有真实消费者，不只是抽象接口。
3. **部分复杂交互已经有效**：Dialog 的键盘关闭和焦点恢复、DatePicker 的结果回填、Radio/Tab 切换、过滤和 Pending 反馈均实际可用。
4. **设计覆盖面较完整**：九个 UI Family、五类 Pattern、七类 Archetype 和八类设置，适合继续收敛为可用的后台产品基础。
5. **动效职责清晰**：路由、同页替换、浮层、异步状态已有各自入口，应继续沿用。
6. **治理有执行基础**：依赖与架构门禁、测试、codegen 都已经运行。后续需让质量证据与页面“完成度”表述一致。

## 7 问题清单与具体方案

### P0 01 移动导航没有完整浮层交互语义

**当前问题**：390px 下打开导航，焦点仍在触发按钮；连续 Tab 可进入背景的语言、主题、通知、账号和页面表单。导航仍打开时 Escape 无法关闭。DOM 中 aside 没有 modal 语义，背景没有被隔离，body 未锁定滚动。

**影响**：键盘和辅助技术用户会操作看不见的内容，难以明确退出主导航。触屏用户也可能同时滚动背景与导航。

**优化建议**：移动导航应作为正式 Navigation Drawer，以统一的 Overlay 能力处理进入、关闭和焦点返回。

**推荐实现**：Host 保留打开状态和导航生命周期，组合 UI Adapter 的 DrawerSurface；若现有契约缺左侧位置，先检查全部消费者，再增加稳定语义 Variant。使用 HeroUI 已有焦点、Escape、滚动锁定能力，不手写第二套 focus trap。依据：[HeroUI Drawer](https://heroui.com/en/docs/react/components/drawer)、[WAI Dialog Modal Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)。

**验收**：打开后焦点进入导航，Tab/Shift+Tab 不逃到背景，Escape 与遮罩关闭有效，关闭后回到触发器，背景不能滚动。证据：[移动导航截图](evidence/navigation-mobile-open.jpg)。

### P1 01 英文移动顶栏溢出且全局搜索入口消失

**当前问题**：390px 英文界面实测 document 可视宽 375px、内容宽约 387px，账号按钮右边界约 387px。完整姓名/职责与多个图标竞争空间。CommandMenu 所在区域在 `md` 以下隐藏，没有触屏可见的全局搜索触发器。

**影响**：页面出现横向滚动，顶栏边缘被裁切；移动用户更难找到深层页面。

**优化建议**：建立移动顶栏的优先级：菜单、搜索、必要通知、精简账号。语言/主题可进入已有账号菜单或次级操作区。

**推荐实现**：在 Host 做响应式 composition；账号使用可访问名称明确的头像按钮，保留同一 CommandMenu 的紧凑触发器。不要缩小所有控件或裁切页面隐藏问题。

**验收**：320/360/390px、中英文、长姓名下无整页横向滚动；搜索可由触屏和键盘进入。证据：[英文移动截图](evidence/forms-mobile-en-long.jpg)。

### P1 02 Settings 的导航和选项空间失衡

**当前问题**：手机上完整八分类导航占据首屏，实际外观选项要继续滚动才出现；页面约 3666px 高。短 Radio 也采用较高卡片，布尔设置常占用大块空间。桌面设置搜索框超出自身侧栏边界，1280px 下输入框右界约 531px、侧栏右界约 520px。

**影响**：用户在“进入设置”后先浏览导航而非完成设置；大量滚动增加比较与回访成本。搜索与内容区边界显得不稳定。

**优化建议**：手机将分类压缩为当前分类加切换入口；短枚举和开关使用紧凑行，有解释价值的选择才用卡片。

**推荐实现**：先调整 Settings Plugin composition，复用 SelectField/Disclosure/Drawer 等正式能力；不要全局降低 Radio 卡片默认高度。搜索尺寸问题检查 SearchBox compound group 的 intrinsic sizing 与收缩约束，在正确所有者修复，并验证其他消费者；禁止用 overflow-hidden 掩盖。

**验收**：手机首屏出现当前分类的可编辑项；桌面搜索不越出侧栏；长文本、字号偏好和暗色仍可用。证据：[手机设置](evidence/settings-mobile.jpg)。

### P1 03 工作台移动主从任务没有闭合

**当前问题**：手机表格内容宽约 797px、可见宽约 333px，依赖内横滚。点选 Partner onboarding 后，详情标题更新，但详情仍在长页面下方，实测其文档位置约 2219px，未自动呈现。

**影响**：用户不易判断点选是否成功，需要寻找详情，表格阅读与查看记录之间缺少自然连接。

**优化建议**：桌面保留主从布局；手机选择记录后进入正式详情 Drawer 或独立详情路由。优先显示主标识与状态，次要列进入详情。

**推荐实现**：在工作台 Plugin 使用同一 selected record 状态组合现有 Detail Pattern 与 DrawerSurface；保留正式导航/返回能力，不建立新的 Router。

**验收**：点击后立即看到所选记录详情，关闭/返回恢复列表位置与选中项；横滚保留时明确提示。证据：[手机工作台](evidence/workspace-mobile.jpg)。

### P1 04 部分 Archetype 与 Pattern 的可操作外观没有结果

**当前问题**：主从示例点击 Release readiness 后详情仍是 Policy review。Detail 的 Edit、Settings 的 Save changes、Operation 的 Cancel 等存在 `onPress={() => undefined}`；Settings 显示未保存却没有实际可修改内容。部分 Pattern 仅展示筛选/排序槽位文字。

**影响**：用户无法区分可复用完整流程与静态布局样本；开发者可能把缺失逻辑的示例当成真实 Pattern 复制。

**优化建议**：明确展示成熟度和演示范围，优先补齐关键状态闭环。

**推荐实现**：使用 Plugin 私有的确定性本地状态，完成选中、dirty/saved、执行/取消等可验证行为。暂不支持的能力改成明确说明的静态示意，不继续显示可点击但无效果的控件，不为演示造假 API。

**验收**：每个启用操作产生可解释结果；完整 Archetype 与局部展示的文案一致。源码：[Archetype Showcase](../../../surfaces/plugins/page-archetypes/src/page-archetype-showcase.tsx)、[Pattern Catalog](../../../surfaces/plugins/page-patterns/src/page-pattern-catalog.tsx)。

### P1 05 Reference 的实体与提交结果不一致

**当前问题**：列表不同记录共用固定 detail/edit 路由；点击 Beta 查看仍得到 Alpha，详情和编辑均读取首条 fixture。新建空名称可直接提交回列表，没有新增记录；编辑空值可发布成功通知。编辑默认留在本页，但通知描述“已返回详情页”。

**影响**：用户对自己正在操作的记录和操作是否成功失去信心，示例也无法证明实体流程正确。

**优化建议**：保持 Reference 的确定性演示定位，同时保证实体身份、必要校验与结果描述准确。

**推荐实现**：使用 Next 支持的 searchParams 或符合 Host 部署模式的枚举路径传递 fixture identity；不另建路由运行时。通过现有 Schema/Form Foundation 校验字段。若未提供真实新增/保存，应明确说明演示结果；通知根据 stay/list/detail 实际分支生成。

**验收**：Beta 详情/编辑保持 Beta；空值有就地可恢复错误；保存描述、当前页面与数据变化一致。源码：[详情](../../../surfaces/plugins/reference-resources/routes/detail/page.tsx)、[编辑](../../../surfaces/plugins/reference-resources/routes/edit/page.tsx)、[通知文案](../../../surfaces/plugins/reference-resources/i18n.ts)。

### P1 06 搜索与空结果的恢复路径不够直接

**当前问题**：工作台输入无匹配关键词时，要按 Enter 才更新；默认行为没有足够就近提示。空结果建议清除筛选，但需要逐个撤销，缺少一键恢复入口。

**影响**：容易误判搜索未响应；筛选多时恢复成本高。

**优化建议**：尊重已有搜索偏好，但把触发方式说明清楚，空结果提供直接恢复。

**推荐实现**：使用 SearchBox 现有语义提供提交按钮/提示；Clear all 清除当前查询与筛选，不重置用户列偏好。计数和空结果使用同一派生数据源。

**验收**：输入、提交、清除的结果可预测，空结果一键恢复；实时模式和 Enter 模式均明确。

### P1 07 本地化与信息标题尚未收敛

**当前问题**：中文页面中 Page Patterns 的完整正文、部分 Archetype 操作仍为硬编码英文；表单控件导航与 Fields/Pickers 标题不一致。许多区块使用相同泛化说明，不能描述真实用途。

**影响**：增加理解负担，削弱统一产品感，也使英文扩张验证不完整。

**优化建议**：以用户任务命名页面与区块，技术名称作为次级标识；翻译覆盖说明、按钮、空状态及可访问名称。

**推荐实现**：文本进入所属 Plugin i18n namespace；复用项目格式化能力。保留 API 标识作为代码文字，但不以代码标识替代用户标题。

**验收**：中英文均没有未解释的整段混用；导航、标题、搜索项使用一致词汇；窄屏和长文本无裁切。

### P1 08 首页与 Foundations 内容没有准确表达当前产品

**当前问题**：首页 Runtime Hosts 为 2，而项目当前只有 Web Host；成熟度百分比没有可解释口径。Foundations 的分层叙述未充分对应当前 Surface×Runtime 架构。最近访问列表变长后产生不平衡留白，基础入口被推迟。

**影响**：初次访问者得到错误规模认知，也难以判断页面数据是否真实。

**优化建议**：首页明确这是统一前端基座，提供“组件规范—页面模式—完整参考流程”的三条入口。指标来自实际目录/清单，或明确标为示例数据。

**推荐实现**：复用现有 Registry/正式清单生成事实项；把最近访问放入较紧凑的辅助区域。文档与页面按当前 authority 更新，不新建额外事实配置源。

**验收**：Host 数量和架构图与 authority 一致；新用户能快速找到一个可完成的参考流程。证据：[宽屏首页](evidence/overview-wide.jpg)。

### P1 09 面包屑的路径表达没有返回能力

**当前问题**：PageHeader 将非 current 项标为 disabled，上级路径不能点击。实际返回依赖另外寻找导航或返回按钮。

**影响**：路径看起来像导航，却仅提供位置说明，增加重复寻找入口的成本。

**优化建议**：对真实上级位置提供导航，对纯文字层级明确使用静态语义。

**推荐实现**：在正式 PageHeader/Breadcrumb Contract 中提供受控链接/RouteTarget composition，按 Surface/Host 边界装配，不让 Foundation 直接 import Next。先核对全部消费者，不批量给没有目标的节点造链接。

**验收**：Reference 等流程中的真实上级可通过键盘返回；当前项不误导为链接；焦点与长路径折行正常。

### P1 10 交付门禁尚未全部通过

**当前问题**：`pnpm check` 因 101 errors 和 13 warnings 停止，后续构建、性能预算、浏览器回归等未执行；独立文档检查也发现现有 authority 入口的断链。

**影响**：无法用当前检查链证明可交付；UI Showcase 的成熟度表述与证据存在差距。

**优化建议**：先修复已有静态检查根因，再完成剩余验证；把实际点击发现加入有价值的行为回归。

**推荐实现**：优先处理 Hook 生命周期和不安全类型关联，依 Owner 拆分职责；为移动导航焦点、实体选择、移动详情和真实保存结果添加行为断言。不要提高视觉 diff 阈值、降低 lint 或无条件排除文件。

**验收**：完整 `pnpm check` 通过；相关键盘/焦点、Axe、窄屏、Dark、英文扩张与 Floating Layer 打开态证据齐全。公共能力修改需按现有 Foundation 扩展门禁执行。

### P2 01 收敛普通内容面的层级表达

**当前问题**：普通容器常同时使用多种边界提示，首页多个区块都有阴影。

**影响**：页面视觉权重接近，重点与辅助信息不容易拉开。

**优化建议**：保留柔和产品语言，减少普通分组的重复 elevation，优先用背景、间距、边框和标题。

**推荐实现**：先调整局部 outlined/embedded composition；只有确认是公共问题才评估共享 Variant，不全局删除 shadow Token。Overlay 继续保留真实浮层层级。

**验收**：同类内容面一致，主要操作与浮层更清楚，嵌套不出现 Card 套 Card 的厚重效果。

### P2 02 校准连续操作下的动效节奏

**当前问题**：顶栏进度与区段进入在连续导航中可能重复出现，本轮没有帧率或真实设备证据证明其过度。

**影响**：潜在增加视觉噪声，需验证后决定调整。

**优化建议**：把注意力放在反馈出现的条件与频率，而非新增动画类型。

**推荐实现**：继续通过 Host 生命周期和 Motion Recipe/Token 调整；在快速完成、连续点击、同路由替换、减少动效下检查，不在 Page 局部写 duration/keyframes。

**验收**：短操作不过度闪烁，Pending/Loading 可区分，减少动效保留必要状态反馈。

### P2 03 将长 Showcase 变成更容易查阅的规范

**当前问题**：Family 页面内容丰富，但长页需要较多滚动，示例解释有时泛化；比较状态需要记忆前文。

**影响**：作为工作规范查阅时效率低于覆盖面本身应有的价值。

**优化建议**：提供本页目录、状态对比、适用/禁用场景与明确的组合示例。

**推荐实现**：使用正式 Toolbar/Section/Navigation Pattern；目录进入已存在的页面区域，不发明第二套导航。补充真正 below-fold 的内容组织，保持 Showcase 与业务同源。

**验收**：能够快速找到 Normal/Disabled/Pending/Error/长文本/嵌套等例子，示例说明解释真实差异。

## 8 优化顺序与实施边界

| 顺序                   | 工作包             | 涉及问题         | 完成标准                                           |
| ---------------------- | ------------------ | ---------------- | -------------------------------------------------- |
| 1                      | 核心访问与基础尺寸 | P0 01、P1 01～03 | 键盘导航闭合，手机顶栏无溢出，设置与详情可直接操作 |
| 2                      | 操作结果可信度     | P1 04～06、09    | 启用按钮有效，实体正确，错误可恢复，返回路径明确   |
| 3                      | 产品语言与首页     | P1 07～08        | 标题、翻译、指标与 authority 一致                  |
| 持续并作为交付前置条件 | 工程验证           | P1 10            | lint 根因修复，完整检查链与行为证据完成            |
| 4                      | 视觉与查阅效率     | P2 01～03        | 层级更清楚，动效克制，规范更容易查阅               |

开始实施前应区分公共问题与局部 composition：手机 Settings 布局和 Reference 流程首先由 Plugin 修正；移动导航由 Host 装配正式 Overlay；SearchBox、Breadcrumb、Drawer 若需改契约，先审查全部真实消费者并完成 Contract/Showcase/可访问性验证。新增或修改公共基础组件前，进入 TailAdmin 对应 UI Elements 具体页校准，遵循 HeroUI 官方 anatomy 和项目 Token，不复制外部实现。

本轮仅新增审查记录与截图/日志。没有修改产品组件、运行时逻辑或用户原有锁文件变更。主题与语言已恢复至审查前的系统主题/中文；浏览操作产生的最近访问与演示通知可能仍保留。

## 9 证据索引

- [桌面 Dialog](evidence/dialog-desktop.jpg)：内容、按钮与浮层层级。
- [深色 Dialog](evidence/dialog-dark.jpg)：深色状态样本，可能包含打开动画中间帧，不作为稳定视觉基线。
- [手机 Settings](evidence/settings-mobile.jpg)：分类与实际设置的空间关系。
- [手机工作台](evidence/workspace-mobile.jpg)：表格宽度与移动主从布局。
- [英文手机表单](evidence/forms-mobile-en-long.jpg)：顶栏与长文本组合。
- [手机导航打开态](evidence/navigation-mobile-open.jpg)：导航遮罩与背景；焦点问题来自实际按键验证，单张截图不能证明焦点行为。
- [宽屏首页](evidence/overview-wide.jpg)：布局比例、最近访问与信息层级。

本报告是任务级审查证据，不替代当前架构、设计系统或 UI authority。

## 10 响应式布局专项更新

已从设置搜索框扩展检查全部38个路由的190个基础视口组合，并补充断点边界、英文大字号、宽松密度、短窗口浮层和缩放等效布局空间。完整原因、影响范围、P0/P1/P2排序、优化方案与统一响应式规范见 [响应式布局与组件适配专项复核](responsive-review.md)。

新增核心发现：

- **P0**：1024px时桌面侧栏与单列Shell同时生效，主内容落到整屏导航下方；原因是`lg`与包含等号的`max-width`断点冲突。
- **P0**：320×256有效视口下，Dialog的Footer被裁切，Tab可进入不可见的取消/确认按钮。
- **P1**：并排Field的auto grid rows分配额外高度，使正常/错误/禁用单行输入分别约44/51/68px；Compound Content默认横向排版使英文说明挤压。
- **既有P1原因补充**：SearchBox在Grid内的min-content轨道突破设置侧栏；320中文顶栏问题影响全38页；Settings在平板/窄桌面仍先展示完整分类；表格和Toolbar需要明确的窄空间任务策略。

大屏最大宽度、语义Token、多数页面折行、表格局部横滚与Drawer内部滚动值得保留。优化顺序调整为：核心访问与断点/浮层高度 → 公共尺寸Contract → 设置/顶栏/数据任务组合 → 密度与响应式回归规范。本轮更新报告及证据，没有将建议误标为已修复。

## 11 移动端设置与切换控件专项更新

进一步检查38个路由在320/390/430px下的114个组合、八个设置分类、10个内容Tabs、七个ToggleGroup和可选PageTabs。完整设置模式比较、A/B/C/D策略、统一适配契约与合并优先级见 [移动端设置、Tabs与导航切换体验审查](mobile-review.md)。

普通横向Tabs已有实际滚动能力；本轮新增问题是ToggleGroup裁切且不能横滚、缩窄后当前Tab不可见、vertical手机回退与说明不符，以及PageTabs访问前移后的选中项裁切。设置搜索已有字段索引，但结果只到分类，尚未定位字段。推荐保留设置路由，手机采用当前分类入口加正式Drawer，并完善字段目标与焦点定位。

## 12 2026-10-08 二次审查：设置任务、选择热区与页面标签

本节在同一报告内更新当前证据，不另建重复审查报告。第1～11节保留历史基线，109 已实现的
修正不再次计为新缺陷。此次实际进入设置八分类、共享表单 authority、首页与 Reference 路径，
结合 UI 点击、滚动、键盘、视口变化、DOM 结构与源码核验；自动化扩展覆盖由项目完整回归提供。
浏览器移动模拟不能证明真实设备单手舒适度、软键盘、安全区、原生缩放或屏幕阅读器朗读。

### 12.1 确认的问题、原因与优先级

| ID     | 级别 | 实际问题及根因                                                                                                                                         | 影响范围                                                            | 优化与状态                                                                                                    |
| ------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| R12-01 | P1   | 页面标签在 Header 外为 static；移动长页滚动后顶部只剩 Header，页面切换入口消失                                                                         | 全部启用标签的路由                                                  | 默认固定、可关闭固定；Header/Tabs 同一 sticky owner。代码完成，专项回归通过                                   |
| R12-02 | P1   | Switch.Field 根为纵向 flex，Content 才是隐藏 input 的标签；Control 错放为 Content 的兄弟。导航设置行实测高约96px，点击可视开关不改变值、点击文字会改变 | settings、UI Elements、Overlay、Archetype 等全部 SwitchField 消费者 | Control/文字合入同一 Content；空说明不占位，row 标题左/开关右；真实点击和 Space 通过                          |
| R12-03 | P1   | Radio/Checkbox 同样误把 Control 放在 Field 与 Content 之间；外层卡片有 selected 表面但大部分不是标签热区                                               | 共享表单、列设置、Pattern/Archetype、设置选项                       | 用 Content 承担可选择表面，指示器/文字/留白同一边界；不把普通展示容器变成按钮；鼠标、键盘与禁用回归通过       |
| R12-04 | P1   | 已有 mobile Drawer 能正确开关，但其唯一入口是随页面滚动的普通 Action；长分类底部要回顶部才能发起其他任务                                               | 小于1280px的设置页，操作偏好尤其明显                                | SettingsLayout opt-in 持续分类导航；不增加内层正文滚动。650/1600/3000px位置及连续分类切换通过                 |
| R12-05 | P1   | 可访问性中的“引用外观设置”是有价值的同源配置摘要；其 TextLink 指向不存在的 #appearance，既不定位也不进入设置来源                                       | 可访问性分类                                                        | 保留标题、来源说明和三个实时值，改为正式 RouteLink 到 /settings；真实往返通过                                 |
| R12-06 | P2   | 所有短单选值默认使用解释型高卡片，手机一组选项占用明显大于内容需要的空间                                                                               | 八个设置分类                                                        | 设置 composition 选择已有 rows；共享 cards 默认保留。区段改用正式 Section，统一标题层级和紧凑组间距           |
| R12-07 | P2   | 每个标签的 X 使用有背景/边框的独立 IconAction，与名称/当前状态争夺注意力；更多页面只在手机显示                                                         | Shell PageTabs                                                      | quiet 操作保留语义控制热区，未激活减弱、hover/focus加强；全尺寸提供管理菜单，关闭其他标签、关闭后焦点恢复通过 |
| R12-08 | P1   | forward 路由 choreography 的正向位移会短暂增大文档宽度；430px连续任务实测 scrollWidth=438px                                                            | 路由内容层，非单一设置页                                            | Surface route 绘制范围用 overflow-x:clip，保留同一文档滚动和 sticky；连续导航窄屏宽度回归通过                 |

本次未确认新的 P0。R12-02 的指示器失效属于实现错误；R12-04 是“功能可用但任务效率低”的
交互架构缺口；R12-06/07 是信息与操作权重问题。跨分类摘要不是第二套设置，不应仅因视觉不同
而删除；数字跟随地区等只读约束也保留为说明，不渲染假开关。

补充 R12-09（P2）：表单 authority 视觉复核确认 Checkbox 的选中填充仍使用 vendor 蓝色，
与 Radio 和项目当前紫色强调色不同；原因是 vendor 的 control 伪元素消费自己的 accent。
在 Checkbox Adapter 根局部映射公开主题变量到项目 brand / brand-strong / on-brand，
不修改全局 vendor 主题；共享消费者一并修正，浏览器比较两类选中填充证明语义一致。

### 12.2 移动设置方案比较与决策

| 设计思路                           | 优点                                                                         | 限制 / 合适场景                                                                   | 当前结论                             |
| ---------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------ |
| 分类索引 → 独立详情页              | 首次信息架构容易理解，大量多级设置扩展自然                                   | 高频跨分类至少多一次返回，重做现有路由壳；适合低频深层设置                        | 保留为未来多级信息架构候选           |
| 八分类横向 Tabs                    | 邻近分类一触切换                                                             | 窄屏/英文隐藏大部分分类，分类组织与搜索需另占空间；横滚与长页纵滚竞争             | 当前八分类不采用                     |
| 底部类别栏 / 全部类别 Bottom Sheet | 拇指接近，任意滚动位置可访问                                                 | 八项不能全放，增加底部占用，与恢复默认/系统安全区协调成本高；缺少对应正式导航模式 | 不为本轮新增公共 Bottom Sheet        |
| 持续当前分类栏 + 正式 Drawer/搜索  | 顶部当前上下文明确，长页任意位置两次操作直达；复用既有分组、搜索、焦点和路由 | 顶部单手触达仍弱于底部；启用页签时三层导航占用较多，极短视口需继续复核            | 采用；减少滚回成本且不引入第二套导航 |

桌面 xl 起继续同时展示分类侧栏与正文；手机/平板只展示当前分类入口，抽屉保留三组八分类。
首入能从入口文字理解“当前分类 + 切换/搜索”；反复任务不再因页面位置增加回顶成本。
搜索词属于原有 settings layout 的瞬态状态，跨分类保留；偏好仍经 PreferencesPort 即时生效和
持久化。当前分类选择只关闭抽屉而不重置位置；浏览器返回恢复原分类和位置；新分类遵从既有
导航滚动偏好，字段搜索单独用 fragment 定位。没有持久化 scrollY 或新增跨Plugin私有Store。

Header/Tabs 高度由 Host 测量；分类导航只消费空间变量。固定标签关掉后 Header 继续固定、标签
随文档滚动，分类栏自动改到 Header 下。选项布局通过 rows/row composition 优化，密度继续
消费已有控制高度；解释复杂且有独立选择意义的卡片保留 cards，不全局修改组件默认值。

### 12.3 标签行为与反馈决策

页面标签是访问过的路由入口而不是内容 Tabs；不缓存页面树，不复制 History。保留稳定访问顺序，
激活只更新最近使用时间，不把标签移到最前。Desktop 横滚列表与固定管理入口分离，当前项在
导航和视口变化时自动进入可见范围；手机显示当前标签并通过管理入口选择其它页面。
未激活关闭按钮保持低权重可发现，不以 hover 作为唯一入口；当前/键盘 focus/hover加强辨识。
关闭辅助操作取消独立凸起边框，控制尺寸继续使用标准语义高度。

右邻/左邻优先在边界回退另一邻居，只有无邻居才回首页；最近使用保持原策略。关闭当前标签
后焦点回到新当前标签，关闭其它标签不改变路由；批量关闭其它页经现有菜单完成。
切换/关闭用当前状态、菜单收敛和焦点提供即时反馈，不新增每次操作的 Toast 或动画。
拖拽重排不是已存在能力，本轮未增加：若后续有真实任务价值，应同时定义键盘重排、触摸与
持久化顺序，再使用正式 Collection 交互，而不是只加 pointer drag。

### 12.4 工程与外部校准证据

修正前检查全部 SwitchField/RadioGroupField/CheckboxField 和 SettingsLayout 消费者；前者的
交互根因是公共问题，后者新增 opt-in，未改变其默认消费。Pattern/Archetype 展示同一
persistentNavigation；公共exports未增加，证据登记补入 foundation-contracts。
没有改默认主题/色彩Token、复制legacy或TailAdmin源码、研究后端接口或创建万能Wrapper。

实际进入 [TailAdmin Form Elements](https://react-demo.tailadmin.com/form-elements) 的 Checkbox/
Radio/Toggle 状态区，检查 normal/selected/disabled，真实点击 Radio 指示器观察互斥选中。
其短选项使用轻量行、控制与文字共轴的规律用于校准。官方
[Switch](https://heroui.com/en/docs/react/components/switch)、
[RadioGroup](https://heroui.com/en/docs/react/components/radio-group)、
[Checkbox](https://heroui.com/en/docs/react/components/checkbox) 公开示意存在版本差异；本项目安装
HeroUI 3.2.4 的实现明确说明 Content 是可点击的 SwitchButton/RadioButton/CheckboxButton，
结合实际 DOM 确定结构，未照搬官网不同版本的示例。

当前长期规则补入 [UI Element System](../../ui-element-system.md) 与
[Surface Foundation](../../surface-foundation.md)，任务执行与截图保存在
[109](../109-ui-ux-optimization/README.md)。

### 12.5 回归状态

新增 [14项专项回归](../../../apps/web/e2e/settings-ux-review.spec.ts) 已全部通过（37.8s）：
真实Control/文字/留白点击、Space/方向键/禁用、320×568与390/430/768/1024/1279×844连续任务、
固定/非固定持久化、八分类桌面连续切换、标签管理/焦点、深色英文WCAG AA、触摸模拟、同分类
位置、Back恢复、搜索词与字段定位。过程中发现并修正 label 嵌套与ARIA名称/说明混合，
不把最初测试失败藏起来；早期日志在109 evidence保留。

最终完整 `pnpm check` 已执行，详见 [本轮完整日志](../109-ui-ux-optimization/evidence/review-check-final.txt)：
治理、依赖、生成物 freshness、lint、类型、370项单元测试、生产构建与原产物预算通过。
浏览器233项中219通过、14失败；27个失败断言全部是 `toHaveScreenshot`，没有其它行为失败。
Radio/Checkbox的旧外层排列断言已调整为真实 Content 内的排列与选中语义色，完整回归通过。
此前14项设置专项与该公共控件检查共15项独立补跑也通过。

剩余视觉差异包含109前轮尚未批准的版式变化，以及本轮设置密度、选择热区与Checkbox语义色
变化；[27组原尺寸对照](../109-ui-ux-optimization/evidence/review-2026-10-08/visual-differences/index.html)
保存现有基线、最终实际画面和diff。代码/行为修正完成，整体视觉验收仍待人工确认。
完整命令因此exit 1；不自动更新快照、不提高diff阈值、不把历史219项结果当作本轮证据。
格式与文档门独立补跑，最终结果在109本轮收尾记录登记。

## 13. 设置容器与动态 Sticky 偏移复核

本节续接第12节已实现代码，未重做前轮审查。恢复时开发服务仍监听4173，原检查已经结束，
无悬挂的 Playwright/Vitest 命令；所有未提交修改与历史证据保留。

| 编号   | 优先级 | 确认问题与根因                                                                                                                     | 范围与决策                                                                                                               | 状态                 |
| ------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| R13-01 | P1     | Header+固定Tabs实际139px，桌面分类导航仍为96px。派生CSS变量在:root计算时使用5rem fallback，继承后不会用后代的Host高度重新计算      | 在sticky消费者上计算派生变量，继续复用Host现有ResizeObserver；同时修复SplitView详情侧栏，不增加测量器或硬编码分支        | 代码与专项验证完成   |
| R13-02 | P2     | 分类导航是outlined Panel，而独立正文使用embedded Section，移除了应有的容器边界与圆角；embedded用于已有外壳中的内容，此处没有父外壳 | 正文采用已有outlined Section与contentInset，删除手写内容padding；导航保留紧凑搜索/分类布局，正文保留标题/分隔/设置行层级 | 代码与浏览器复核完成 |

### 13.1 容器方案与主次关系

复核Panel的appearance/tone、Section标题与SectionBody，以及SettingsLayout、SplitView的全部
真实调用方。Card承担内容卡片语义，Panel承担空间外壳，Section提供带标题的区段；本场景
不需要新增Card、公共Variant或Token。独立导航和配置区采用现有无阴影容器语言，避免给
页面平面上的区块新增浮层阴影。导航用较紧凑的搜索、分类标题和选中链接；正文用Section
标题、分隔与统一内容inset，视觉语言一致但信息组织不相同。

比较过单一大Panel包住导航和正文：可以提供统一边界，但会造成移动sticky入口与内容
共享受限的外壳、增加嵌套和响应式分隔职责；也比较过全部embedded平面分组，其代价是
长设置区段失去清晰边界。选择已有outlined Section的正确composition，保持两列独立的
导航/内容角色，不改变Panel/Section全局默认。移动Drawer内部仍使用embedded导航，因为
Drawer已经拥有外壳；页面正文保持独立Section。不是给两块区域手写同一套装饰。

### 13.2 动态空间关系与扩展范围

Header与固定Tabs继续共同占据一个sticky chrome；非固定Tabs位于其外并随文档滚动。
原生sticky无法跨兄弟自动引用实际高度，所以保留Host已有的单一ResizeObserver；本轮
修复的是CSS变量作用域，不新增监听或JS定位。消费者根据继承的实际高度计算top，desktop
加现有spacing间距，mobile分类入口贴合chrome。调整Tabs显示/固定偏好或resize后自然
更新。正文与手机分类入口继续共享文档滚动，没有第二个Router或滚动状态Store。

额外确认R13-03（P1）：1440×500窗口中导航内容高482px，fixed chrome下剩余空间不足，
长页中段的末尾分类不可见。桌面SettingsLayout导航以动态viewport减实际top和既有spacing
作为max-height，只有内容超出时内部滚动；浏览器原生滚动条保留，键盘聚焦可自动显露末项。
这是分类区域有明确边界的滚动职责，不向主内容或手机入口增加滚动容器，也未改变SplitView
正文阅读方式。修复后导航可用高329px，实际滚动显露全部分类；新增键盘到末项并Enter切换
专项通过。此项随SettingsLayout共享消费者生效，默认高度充足时不产生额外滚动。

受影响共享消费者为SettingsLayout和SplitView；包含设置业务、Pattern/Archetype示例、
创建编辑和资源详情组合。底部StickyActions按底边定位，不消费顶部变量，无需修改。
源码修改集中在surface-foundation样式、settings Section composition与现有专项回归；
没有修改公共组件默认、设计Token或已有快照。

另外定向进入TailAdmin的[Cards页面](https://react-demo.tailadmin.com/cards)，实际查看图片、
横向内容、链接与Icon卡片，以及分组标题和分隔边界。其内容Card与章节外壳分工用于校准
层次；没有复制源码、DOM、CSS、资产或尺寸，也不把外部示例的Card嵌套照搬到设置页面。

### 13.3 实际验证与边界

修复前浏览器1440宽读取chrome=139px、top=96px；修复后top=155px，操作偏好长页滚动
1489px时导航实际y=155px。实际点击跨分类、手机390宽长页底部打开分类Drawer均完成。
新增自动化覆盖1440/2560/390/768/1280宽，在同一页面依次开启固定、非固定、关闭Tabs，
检查实时偏移、顶部/中段/底部滚动与横向溢出，保存15张实际画面；SplitView独立专项验证
同一动态契约。两项新增专项通过，前轮14项功能专项也完成本轮补跑。

第一次新增测试定位到了两个header，随后隐藏input自动点击被遮挡；测试改为明确banner
与实际label点击后通过，保留早期失败日志。浏览器原生zoom、真实设备与读屏仍无实际
证据，不以viewport或触摸模拟冒充。完整检查结果登记在109本轮账本；旧视觉基线继续保留，
不通过提高阈值或自动更新截图隐藏差异。

最终代码完整 `pnpm check` 已执行：370项单元测试、治理、依赖、生成物、lint、类型、
生产构建与原产物预算全部通过；浏览器236项中222通过、14项视觉比较失败，27个失败
断言全部为截图，没有其它功能断言失败。maxRoute gzip为432922B（原上限440320B）。
完整命令因视觉比较exit 1，不能宣称全绿。见[最终日志](../109-ui-ux-optimization/evidence/layout-check-final.txt)
与[最终27组视觉对照](../109-ui-ux-optimization/evidence/review-2026-10-08/layout-visual-differences/index.html)。
原AGENTS第10节要求人工确认合理后才能更新视觉基线，本轮保持该门禁与待确认状态。

## 14. 验收反馈：开关行悬停背景的内容留白

用户截图指出开关行hover背景与文字/控件两侧齐平。实际测量row的padding-left/right均为0，
右侧control距Content边缘为0；不是Section外壳留白不足，而是公共SwitchField的row模式
仅设置py-2，hover surface与内容缺乏内部空间。此项记为R14-01（P2）。

SwitchField的row复用现有px-3/py-2，与Radio rows现有的内容留白规则一致；保留min-h-control
随密度调整的行高、同一原生Content点击边界及现有hover/focus状态。没有增加外层容器、
负边距、页面覆盖样式、新Token或事件处理器。默认card的p-4不变。真实row消费者为设置
插件的各分类开关；其他Card消费者不随变。UI Elements表单权威补充同源row带说明示例。

修改前定向进入TailAdmin Form Elements，实际查看Checkbox/Radio/Toggle的正常、选中、
禁用与分组内容区域，并点击Radio确认状态；只校准控件与外壳留白关系，未复制外部实现。
新增回归以真实hover测量左右内容边距，并点击新增左侧留白、以Space恢复选择；覆盖桌面
与手机、三种密度，截图保存在109现有evidence。完整最终检查结果继续登记在109账本，
旧视觉基线和人工确认要求保留，不把本次缺陷反馈视为对全部历史视觉变化的批准。

最终完整检查见[hover-spacing-check.txt](../109-ui-ux-optimization/evidence/hover-spacing-check.txt)：
370项单元测试、治理、lint、类型、构建与原预算通过；237项浏览器223通过、14视觉失败，
27个错误均为截图比较。包含新增hover专项在内的18项设置回归全部通过，新增专项覆盖
1440/390/320宽×三密度（15.4s）。实际页面左右padding与control距背景右边缘均为12px。
原基线未更新，最终[27组对照](../109-ui-ux-optimization/evidence/review-2026-10-08/hover-visual-differences/index.html)
与九张hover画面单独保存。R14-01的代码与行为修复完成，整体视觉验收仍待确认。

## 15. 验收反馈：Switch 轨道与圆点端点不对称

R15-01（P2）为公共组件的几何实现缺陷，非设置行 UX 问题。实际浏览器测量轨道44×24、
圆点20×20、轨道padding为2px，但关闭端点左侧4px、开启端点右侧6px，上下均2px。
根因是Adapter修改了vendor轨道/圆点尺寸并添加padding，却保留HeroUI原来的margin定位：
未选中ms-0.5、选中calc(100% - 1.5rem)，不再适合项目的圆形圆点尺寸。

修复在公开Switch.Thumb className收口：ms-0，selected时ms-5。由现有spacing尺度表达
20px行程，使两种状态靠近轨道端点时都与上下留白相等（实测2px）。采用逻辑margin，
保留HeroUI的选择、键盘、焦点、禁用与margin过渡机制；没有页面CSS、内部DOM穿透或
自研选择状态。所有SwitchField消费者（设置、UI Elements、Page Archetypes）统一随变，
row/card的外壳与交互边界不变。修改前再次进入TailAdmin Form Elements查看开关完整状态。

新增几何回归验证圆点为圆、活动端点与上下间距相等，覆盖1440/390/320宽、系统明暗模式、
card/row/禁用及Space切换；原三密度hover专项加入开启/关闭几何断言。原视觉基线继续保留。
本轮检查记录见109 evidence/switch-geometry-browser.txt及switch-geometry-check.txt。

最终完整检查已结束：238项浏览器测试224通过、14项视觉比较失败；19项设置专项全部通过。
治理、类型、lint、370项单元测试、构建、原产物预算通过；独立format:check与docs:check通过。
失败断言仍为截图比较，未更新基线。R15-01内部几何修复及行为验证完成，整体视觉验收仍待确认。

## 16. 验收反馈：总览内容区块不应呈现悬浮阴影

R16-01（P2）：用户指出最近访问与基础能力区块下方出现灰色阴影带。来源是总览的Section
未显式指定appearance，默认elevated传给Panel，继承shadow-panel。属于页面composition
选择不当，而非滚动层遮罩；普通内容不需要脱离页面平面的层级。

总览的收藏、最近访问、基础能力、质量门禁、最近建设轨迹五个Section明确采用现有
appearance="outlined"，保留语义边框、背景、圆角、间距与交互。原本outlined指标卡及flat
能力卡不变；不修改公共Section/Panel默认行为或全局阴影Token，避免影响其它真实消费者。

实际浏览器滚动到基础能力核对，区块的box-shadow全部为透明零偏移，边框仍1px。
1440与390视口截图及无横向溢出验证见109 evidence/overview-shadow-browser.txt，
截图overview-outlined-1440.png与overview-outlined-390.png。完整检查记录在
109 evidence/overview-shadow-check.txt，视觉基线不自动更新。

最终完整pnpm check已结束：治理、lint、类型、370项单元测试、生产构建及原产物预算通过；
238项浏览器测试224通过、14项视觉比较失败，27个失败断言均为toHaveScreenshot，无其它
功能断言失败。19项设置专项全部通过。独立format:check和docs:check通过。R16-01修复与
桌面/移动检查完成；整体视觉基线仍未更新，完整命令因此exit 1。

## 17. 主题模式的图标选择卡片与信息层次

用户参考图要求主题分组使用装饰图标＋标题＋说明，选项以图标在上、标题在下的横排卡片
表达浅色、深色、跟随系统。现有主题模式是RadioGroupField rows，已有完整即时更新与
持久化契约；缺口在内容表达和布局，而非导航状态。

| 方案                  | 适用性与决策                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------ |
| TabsView              | 适合不同内容面板切换；主题是同一个偏好值，不能引入tab/tabpanel语义。                                         |
| ToggleGroup           | 已有图标＋文字的连体分段模式，适合紧凑工具栏；没有参考图要求的分组层次与独立选项卡片，不为此修改其默认几何。 |
| RadioGroupField tiles | 推荐并落实：保留互斥单选状态、整卡点击和键盘机制，扩展现有呈现能力，不另造主题组件。                         |

RadioGroupField新增tiles呈现，以及受控labelIcon和option.icon内容。分组标题与hint先于
选项，三个卡片等宽，选中表面/边框/文字继承现有brand语义Token，避免硬编码参考图的
橙色。主题选项按浅色、深色、跟随系统排列；中文/英文文案明确Light/Dark theme。
不新增外壳、全局Token、页面CSS或自研选择状态；既有cards/rows保持默认视觉与交互。
图标为装饰并aria-hidden，选项真实label内仍包含HeroUI生成的原生input，整个卡片都可操作。

公共能力复用路径：已有Element → 新呈现Variant → 设置Feature composition；没有新增
公共export或平行基础组件。Header的图标/标题/说明属于该Field组合，当前不需要另封装
万能IconHeading。UI Elements/forms的RadioGroupField补充同源tiles示例与禁用项。
所有RadioGroupField真实消费者已检索；只在主题设置与权威示例显式启用tiles，其余维持
现有模式。现有form-field导出、owner与authority登记保留，增加单元证据。

修改前定向查看TailAdmin Form Elements单选的普通、选中与禁用状态并实际切换；未复制
外部实现。[HeroUI官方RadioGroup anatomy](https://heroui.com/en/docs/react/components/radio-group)
及已安装3.2.4源码确认Radio.Content拥有原生RadioButton/input，图标卡片可保留单选语义。

新增DOM测试验证分组名称、说明、图标点击与禁用状态；浏览器专项覆盖1440/390/320、
中英、深色与系统浅色、图标/边缘点击、ArrowRight、刷新持久化、卡片焦点和Axe WCAG AA。
两个新专项通过（24.1s）；初次失败源于测试filter的has使用了带祖先group作用域的locator，
修正为相对label可匹配的radio定位后通过，初次日志保留。默认30s超时不改。
12张主题实际画面保存在109 evidence/review-2026-10-08/theme-tiles-*.png；320英文卡片
宽度不小于44px，文字自然换行，无横向溢出。完整检查记录theme-tiles-check-final.txt。

首次全量检查在新增测试的类型检查处停止：选项名称用普通数组导致索引可为undefined，
DOM测试误用了Playwright的exact参数。已改为固定三项tuple与DOM name正则，保留
初次theme-tiles-check.txt；后续完整检查使用theme-tiles-check-final.txt。没有放宽类型规则。

完整theme-tiles-check-final.txt已结束：治理、lint、类型、371项单元测试、构建及原预算通过；
240项浏览器225通过、15失败。其中14项为原视觉基线比较，另1项是旧Radio几何测试把
新增tiles示例也视为带dot的选项。已将原dot断言明确限定到既有反馈密度group（仍验证3项），
并新增tiles的列方向、图标在标题上方、20px透明图标、无圆点控件等断言；补跑该专项通过，
没有删除旧断言、提高视觉阈值或更新基线。证据theme-tiles-anatomy.txt。
21项设置专项全部通过，新主题矩阵19.7s，手机用hasTouch与tap验证图标操作；最终测试文件
另行类型检查通过。首轮全量结果不能宣称全绿，剩余14项视觉比较仍待人工验收。
新增choice-tiles-focus-disabled.png实际图确认整卡焦点与禁用表现。R17-01（P2，信息层次
优化）的实施及专项验证完成；无真实设备或读屏新增证据。

## 18. 设置内容语义与比较预览（实施中）

已通过桌面1440与手机390实际切换八个分类，并在手机长内容底部发起分类切换。
证据保存在109的settings-semantic-inventory.txt及semantic-before-*截图。外观页约2280px，
强调色四行约320px，其余三选项约252px；文字标签无法直观表达颜色、密度、字号与宽度。
这是选择内容与呈现能力的缺口，不能用统一横排或统一卡片解决。

| 分类/内容     | 决策                                                    | 优先级/状态 |
| ------------- | ------------------------------------------------------- | ----------- |
| 外观主题      | 保留图标卡片与即时生效                                  | 已完成§17   |
| 强调色        | 真实预设色样＋文字；颜色数值继续由Design System唯一管理 | P1，已实施  |
| 界面/表格密度 | 使用同源比较示意，说明示意与真实即时生效的边界          | P1，已实施  |
| 字号/内容宽度 | 字样大小与容器比例示意，维持原偏好值                    | P1，已实施  |
| 动效/对比度   | 简短选择＋手动效果/聚焦预览；不绕过Motion Policy        | P1，已实施  |
| 导航          | 开关与关闭策略下拉保留；短选项紧凑组织，保留禁用原因    | P2，已实施  |
| 数据展示      | 页数下拉/布尔开关保留；密度比较与截断换行示例           | P2，已实施  |
| 操作偏好      | 快速二选紧凑；带说明/不可用原因的目的地选项保留行       | P2，已实施  |
| 语言与地区    | 多时区/日期格式下拉保留；语言/小时制/周起点短选择       | P2，已实施  |
| 通知          | 开关保留；时长选择紧凑，依真实值提供反馈                | P2，已实施  |
| 可访问性      | 保留共享外观摘要、来源与跳转；增强项保留Switch          | 保留        |
| 快捷键        | 两个布尔开关语义合理，短页不制造占位预览                | 保留        |

组件路径：复用RadioGroupField的Selection/Keyboard/Disabled；扩展可换行inline和
decorative preview内容，显式选择呈现，不修改既有cards/rows默认。不新增Tabs导航、
万能设置渲染器或一次性基础组件。ToggleGroup适合短模式工具栏，复杂Field的说明和
比较内容继续由RadioGroupField管理。静态图案归Feature composition，无独立状态库。
外部TailAdmin Form Elements的普通/选中/禁用单选已重新实测，未复制源码或尺寸。

通知与可访问性全页截图出现固定Header和焦点跳转链接，需重新实时验证以区分截图捕获
与实际布局缺陷，不能据此直接声明运行时遮挡。已有视觉基线与失败记录继续保留。
环境现已恢复：命令/项目读取/临时文件写读删除成功，浏览器连接正常。本节代码已实施，
验证状态分开记录：不能把实施完成等同于完整验收通过。

### 新确认的实现问题

R18-01（P1，已修复、390实际交互通过）：从外观长页底部打开分类抽屉并进入通知页，
开启滚顶偏好仍停在scrollY=93，h1 top=31、固定Header bottom=80，标题确实被遮挡。
Next的默认滚动启发式与持久化layout、Overlay退出/恢复焦点时序不能保证明确的滚顶偏好。
Host复用现有目的地协调：确认目标pathname/search已提交且模态浮层退出后，在下一帧
执行显式滚顶；锚点仍居中定位、关闭滚顶仍保留滚动，不在Feature访问浏览器或加CSS补丁。
相同场景修复后scrollY=0、h1 top=124，分类入口焦点保持。新增浏览器回归待环境恢复执行。

R18-02（P1，已修复、浅/深色实际切换通过）：原高对比度只增强焦点环；跟随系统对比度
受另一个辅助设置开关限制，系统边界增强还自引用--color-border-strong造成变量循环。
显式high/系统more共享增强焦点、辅助文字与边界，标准模式不变；系统对比度查询在
appearance.contrast=system或followSystemAssistive开启时生效。边界混色引用底层ds值，
消除自引用。该语义偏好影响全产品消费方，属于已有全局偏好能力修复；没有改变标准默认。
系统more自动化、所有共享控件高对比度矩阵与Axe尚待执行，不能宣称整体WCAG认证。

### 实施与真实使用证据

RadioGroupField新增inline/previews；颜色只显示色样、文字与选中表面，不重复加单选圆点。
非图标inline保留圆点，cards/rows/tiles默认不变；所有模式仍由HeroUI生成input和选择状态。
UI Elements同源示例和DOM测试同步更新。Density/Font/Width示意归Settings Feature，
真实即时生效仍经原PreferencesPort。手动动效预览复用ContentSwapTransition，无自动播放。
数据长文本示例使用真实truncate/wrap，实测46px单行与66px换行；地区示例调用现有
formatDateOnly/formatTimeOfDay，12小时+秒切换为08:08:42 AM；通知示例使用真实
FeedbackController及Host的3/5/8秒映射，不另建timer。可访问性配置摘要保留来源/跳转。

1440/390英文外观无横向溢出；320大字号下无横向溢出，比较卡片宽度大于44px。
颜色蓝色选择与刷新保存、密度方向键、减少动效时手动预览时长1e-05s已实测，测试偏好已
恢复原值。实际截图semantic-appearance-en-*、semantic-high-contrast-dark-390、
semantic-category-scroll-fixed-390、semantic-locale-en-390、semantic-notification-preview-390
保存在109 evidence/review-2026-10-08。截图不是自动视觉基线，原失败记录保持。

当前治理、架构、相关类型/lint、生成物freshness通过；专项DOM测试7项通过。
完整pnpm check在包管理器用户目录锁访问处失败，直接Playwright在worker fork处spawn EPERM，
均未进入断言。完整构建/产物预算、浏览器/Axe矩阵与历史视觉复核尚未完成；日志见109
evidence/semantic-check-attempt.txt与semantic-browser-attempt.txt。本轮不能声明全绿或目标完成。

## 19. 2026-10-09 设置信息架构与语义续审

承接§18和已提交的b058b66，不重复创建选择器。实际体验八分类，核对67个可编辑字段与
固定/引用说明，六个较长分类按用户任务组合正式Section，短分类保留简洁结构。标题补充
即时生效与当前浏览器保存说明；字段值、偏好key与分类路由保持既有契约。

新增确认R19-01任务分组不足（P2）、R19-02搜索漏39字段（P1）、R19-03紧凑侧栏状态
覆盖手机单列规则导致main只有88px（P1）、R19-04深色Dialog确认白字对比度2.76:1
（P1）。已修复在对应Owner；具体字段清单、七项外观方案、组件决策、跨项目范围与证据
见[设置语义设计](../109-ui-ux-optimization/design/settings-semantic-review.md)。

R19-05（P2）：人工查看320英文大字号截图进一步确认主题三列逐字换行、分类操作截断。
已用容器响应式tiles与去重操作文案修复，加入文本行数与入口可见回归；无溢出和Axe通过
不代表视觉可读性已经合格。

本轮增加完整八分类的桌面/320深色英文大字号Axe与字段定位覆盖、共享控件高对比度、
四强调色明暗Dialog打开态、紧凑侧栏连续resize，以及新增字段搜索路径。旧测试关闭辅助
开关就清除系统对比度的假设已按独立外观system契约修正，保留两入口均关闭后清除的断言。
预览测试使用公开键盘路径并等待hydration，不提高超时或视觉差异阈值。

最终状态见[本轮验证](../109-ui-ux-optimization/evidence/semantic-final-verification.md)。历史
成绩不替代本轮结果，原视觉基线不自动批准；构建、预算、行为、Axe与视觉验收分别记录。

## 20. 2026-10-09 Motion 与渐进信息呈现专项

最终完整检查382单元/生产构建/原预算通过；297浏览器282通过、15失败。
14项对应27个旧视觉差异，SET-012旧整页动画断言按语义区段修正后，完整设置路由与
新增动效24项独立复测全部通过。原基线未更新，完整命令仍exit 1，详见
[最终验证](../109-ui-ux-optimization/evidence/motion-final-verification.md)。

实际浏览全部八设置分类、九 UI Family、五 Pattern、七 Archetype，以及总览、参考资源、
状态、基座、图标与 Motion 页面。当前已存在 Route region、Viewport Reveal、Content
Swap、Disclosure、Feedback、Async readiness 与系统策略，不能简单判定为整页动画系统。

新增 M20-01 pending 隐藏的可用性风险、M20-02 长区域比例阈值与快滚等待、M20-03
设置嵌套 Page 导致 region 合并、M20-04 总览后续阅读分组缺滚动节奏、M20-05 首屏与
滚动恢复重播、M20-06 authority 与稳定 React/浏览器边界实现叙述不一致。详情切换实测
也缺少局部连续性提示，优先复用现役 ContentSwapTransition。

完整页面清单、实测高度、取舍、组件复用和待验矩阵见
[Motion 专项设计](../109-ui-ux-optimization/design/motion-review.md)。表格行、表单字段、
短 Pattern 和操作示例保持直接可用；不以全局动画覆盖率作为验收指标。实施与验证结果
由该记录后续补齐，审查结论本身不代表代码已经通过。

补充 M20-07（P1）：浏览器实际刷新书签字段链接停在页面顶部，偏好 hydration 后未
执行初始定位。Host 已复用站内搜索同源的 focusRouteAnchor，ready 后定位/聚焦初始
hash；无 hash 与后续导航保持原策略，损坏编码不阻断 hydration。Reveal 焦点进入即
取消位移；18 项专项及10项安全性单元通过，最终全量结果仍独立记录。

## 21. 语义内容项滚动渐进呈现（2026-10-09）

本轮用户要求取代§20中“字段/相关Card整组、不逐项”的取舍。实测设置五个独立
字段没有自己的触发节点，末尾多个设置共用一个Reveal；总览、Foundation与UI
Family也存在父区段带动多项内容同时出现的缺口。

已扩展现役ViewportReveal items模式并由Page装配：Section标题、设置行、Card、
阅读List Item分别触发；最小语义项与其祖先互斥，首屏按实际阅读位置短错峰，
后续随滚动首次播放。错峰40ms、上限120ms；快滚、焦点、恢复和Reduced直接稳定。
Host独占速度/恢复判断，交互与状态继续使用既有HeroUI/Adapter组件。

修改清单、消费者、设计决策见[逐项专项](../109-ui-ux-optimization/design/scroll-reveal-review.md)，
实际成绩见[本轮验证](../109-ui-ux-optimization/evidence/scroll-items-verification.md)。
新增效果没有改变旧视觉基线的人工确认要求。

人工确认前复验383单元、38真实入口审计及功能/Axe流程通过；301浏览器287通过、14项
截图比较失败，共28个差异。动效期间的对比度、标题透明度与Breadcrumb颜色边界问题
已修复。用户随后明确确认28项，限定范围更新基线；完整 `pnpm check` exit 0，
383单元、301浏览器、生产构建、原性能预算及全部门禁通过。原审查对照与失败日志保留。

## 22. UserIdentity 账户菜单专项（2026-10-09）

实测发现顶栏账户菜单仅平铺切换语言/主题与带长说明的设置入口，无身份摘要、分组与
当前选择。基于真实能力扩展MenuButton分组与单选子菜单，身份信息集中到Header，
语言/主题显式选择并沿用现役偏好存储、系统解析与路由确认。无邮箱/资料/帮助/认证会话
能力，不新增虚假入口。参考TailAdmin的组织规律并保持项目Token/Overlay语言。
设计、复用与实际成绩见[账户专项](../109-ui-ux-optimization/design/account-menu-review.md)
及[验证记录](../109-ui-ux-optimization/evidence/account-menu-verification.md)。

本轮4项新视觉差异获独立人工确认后限定更新。383单元、310浏览器全部通过，
完整命令末尾对照HTML格式问题修复后，格式/文档门禁复验通过；过程与退出码保留。

## 23. Authentication设计缺口与续轮

根布局将所有页面包入后台Shell，无会话与认证接口，固定Rin身份不能承载完整认证。
续轮拆分Public/Auth/App真实路由布局，配置Mock/Backend统一服务，复用现役Form/
State/Token，接入登录/注册/退出/恢复与身份。方案与待联调边界见
[认证审查](../109-ui-ux-optimization/design/authentication-review.md)，前端实施与验收完成。

已落地真实三类布局、统一 Mock/Backend 服务、登录/注册/会话过期界面和身份菜单退出。
品牌区与表单复用现役 Token、Page/Form/Alert；密码输入统一收口 Adapter，并在 UI
Elements 同源展示。320px 确认密码后缀导致输入框溢出的问题已修复；注册成功、深链
返回、刷新恢复、跨标签页退出及私有记录清理已有浏览器证据。Backend 受控契约测试
已通过，真实 API 仍未提供，不把本次验证作为服务器安全认证证据。用户确认本轮7项视觉后
限定更新，完整 `pnpm check` exit 0：403单元、329浏览器、生产构建、原预算与全部门禁
通过。失败过程和原对照保留，最终范围见
[认证验收](../109-ui-ux-optimization/evidence/authentication-acceptance.md)。

## 24. Sidebar 纯图标模式专项（2026-10-11）

补充实测：88px 收缩栏仍沿用16px图标，叶子热区横向偏宽；分组只留空白、叶子
依赖原生title，设置/Icon大全重复图标、Motion fallback。续轮统一80px/48px/24px
比例和分组分隔，复用HeroUI Tooltip/Flyout，补当前页/焦点、触摸与偏好恢复。
补充原生Chromium页面Zoom 125%/200%，分别验证纯图标Flyout与移动Drawer；
8张视觉基线经两次明确人工确认并限定更新，最终完整门禁成绩见验证记录。
详见[专项审查](../109-ui-ux-optimization/design/sidebar-review.md)与
[验证记录](../109-ui-ux-optimization/evidence/sidebar-verification.md)，不以旧报告成绩替代现役结果。

## 25. clouddrive 产品补齐 M0（2026-10-12）

承接现有 UI/UX 与认证成果，完成源码盘点、授权演示站逐页浏览和关键任务实测。
现役认证、个人偏好、全局搜索、手机导航与 Reference 本地操作已有实际能力；主要缺口
转为用户/角色/权限、个人账户、完整通知、审计、系统配置及统一业务 Mock/REST 契约。
不再沿用早期“无认证/手机导航未实现”的历史结论。

完整路由分类、组件复用判断、优先级、信息架构兼容建议与 M1–M7 计划见
[M0 产品审计](product-readiness-m0.md)，本轮检查状态见
[验证记录](evidence/product-m0/verification.md)。本阶段只更新报告与证据，没有修改
产品代码或视觉基线；后续实施等待 M0 结果确认。

## 26. clouddrive M1（2026-10-12）

用户明确要求继续 M1。工作台与个人偏好入口已产品化，开发示例和工具归开发中心，保留原 URL 与工作记忆。工作台消费现役身份、草稿、收藏、最近访问和真实前端事件；用户/角色等后续业务摘要不预填假数据。实施、验证、视觉确认与后续依赖持续见 [产品实施账本](product-implementation.md)。

M1 已完成人工视觉确认与门禁收口：完整 `pnpm check` 退出 0，403 项单元测试、344 项浏览器测试通过。真实后端仍待联调；M2–M7 尚未开始。
