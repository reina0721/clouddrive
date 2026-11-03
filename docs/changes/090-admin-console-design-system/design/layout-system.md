# Layout System

## 1. 布局不变量

- 视口只存在一个全局滚动责任：Shell 固定于视口，主内容容器滚动；工作台内部滚动必须显式声明。
- 所有普通页面只允许一个 H1 和一个 primary action 区。
- 导航不重复表达同一层级；WorkspaceRail 仅承载真实可切换上下文。
- 页面不能直接写全局宽度、gutter、Header/Sidebar 偏移或安全区。

## 2. Shell 几何

| 区域 | 桌面目标 | 收起/移动目标 | 说明 |
| --- | ---: | ---: | --- |
| PrimarySidebar | 240px | 64px / overlay | 1280px 时占 18.75%，比当前 264px 更克制 |
| GlobalHeader | 56px | 56px | 保持位置、搜索与账户入口，不堆叠所有偏好工具 |
| WorkspaceRail | 36px | 按模式折叠 | 只有多上下文或可恢复工作区时出现 |
| Content max | 1440px | 100% | 普通列表；工作台可用 fluid |
| 页面 gutter | 32px | 24px / 16px | 大桌面 / 笔记本平板 / 手机 |

断点以内容是否仍可完成任务为准，而不是只追随设备名：

- `compact`：小于 768px，侧栏 overlay，Header 工具折叠，表格进入记录优先模式；
- `medium`：768—1199px，侧栏可保持 collapsed，局部导航可变为 Select/Drawer；
- `wide`：1200px 及以上，展示完整侧栏和并排内容；
- 复杂 workbench 还需基于容器宽度判断面板折叠，避免嵌套布局依赖视口猜测。

## 3. Shell 区域

### PrimarySidebar

- 顶部：产品身份和收起控制。
- 中部：按业务域分组的导航；组标题不作为普通页面链接。若必须进入模块首页，使用独立叶节点。
- 每次只有一个 active leaf；父组只显示展开或祖先提示，不使用与叶节点相同的高亮。
- 底部：环境/版本简要状态、帮助和账户入口之一；不展示长 revision 字符串。

### GlobalHeader

左侧依次是侧栏控制和当前位置；右侧按优先级为：全局搜索/命令、环境或服务健康、通知、账户。语言、主题、密度和配色进入账户偏好面板。手机只保留导航、短标题、通知/账户合并入口。

### WorkspaceRail

- 多文档/多上下文工具才显示：例如未来多个 OpenAPI 文档或可恢复工作会话。
- 只有一个固定 OpenAPI 工作台时隐藏。
- 关闭、重排、恢复等行为必须与工作区策略一致，不作为普通站点页签滥用。

## 4. PageFrame 变体

| 变体 | 最大宽度 | 典型页面 | 结构 |
| --- | ---: | --- | --- |
| `list` | 1440px | 账户、角色、审计 | PageHeader → optional Summary → ResourceIndex |
| `detail` | 1200px | 账户/角色详情 | EntityHeader → tabs → sections/aside |
| `form` | 760px | 创建/复杂编辑 | FormHeader → FormSections → StickyActionBar |
| `settings` | 1040px | 个人/系统设置 | compact SectionNav → SettingSections |
| `dashboard` | 1440px | 运维概览 | Attention → KPI/trends → activity |
| `workbench` | fluid | OpenAPI | 内部 panel layout，自主管理面板滚动 |

`PageFrame` 负责最大宽度、gutter、纵向 rhythm、页面 loading/error boundary 和 scroll restoration。业务页不得在其外再包一层同类 Container。

## 5. 页面纵向节奏

- PageHeader 与内容：24px；大屏可为 32px。
- 同一功能块内部：12/16px。
- 主要 Section 之间：24/32px。
- 主标题下只保留必要说明或状态；不再默认渲染 eyebrow/kicker。
- 无边界的 Section 通过标题、间距和 divider 组织；Card 仅用于独立状态、可操作单元或需要视觉边界的密集内容。

## 6. 局部导航

设置与复杂详情的局部导航不得固定消耗 200px 以上宽度：

- wide：160—184px 紧凑 sticky nav；
- medium：顶部 segmented/select；
- compact：当前章节按钮打开 Drawer。

局部导航只表达页面内章节，不复制全局路由树。

## 7. 响应式工作台

OpenAPI 桌面使用可调整的资源栏 + 主编辑/响应区域；为每个面板定义最小宽度和 overflow 所有者。medium 下资源栏可 overlay；compact 下使用“资源 / 请求 / 响应”三段式导航，每次只显示一个主面板。长 JSON、path、schema 进入自身滚动/换行策略，绝不扩大页面布局宽度。
