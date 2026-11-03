# R094-002 当前新前端 UI 体系、依赖与页面缺口审计

## 1. 研究范围与方法

从当前项目 `README.md`、当前 Git 状态、`packages/*`、`apps/*`、路由、测试、构建脚本、最近 frontend 提交和已安装依赖出发，追踪实际导入和调用；文档声明只作为需要由代码验证的候选事实。

## 2. 当前已实现事实

### 2.1 架构与依赖

- `apps/web` 是 React 19/Vite Web Host，`apps/desktop` 只保存 Desktop Runtime 契约；公共包不依赖 Host。
- `packages/ui-adapter` 是唯一直接导入 `@heroui/*` 的位置；`tooling/check-boundaries.mjs` 会拒绝其它 Workspace 的 HeroUI import、原生表单控件、Adapter 内部 `ui-*` 样式泄漏、硬编码颜色和跨 Workspace 相对导入。
- `packages/design-system/src/tokens.css` 是 Light/Dark 颜色、Surface、Border、Radius、Control Height、Shadow 与 Motion Ease 的当前 authority；组件外未发现硬编码 hex/rgb。
- 已安装 `@heroui/react` 与 `@heroui/styles` 均为 3.2.4。包清单已经导出本计划需要的 Avatar、Breadcrumbs、ButtonGroup、Link、Pagination、ProgressBar、Spinner、Toast、Alert Dialog、Toggle Group 等成熟底层，无需新增 UI Library。

### 2.2 当前 UI Contract

已导出的 Element/Primitive 包括：Action、IconAction、Text/TextArea/Select/Combo/Date/Switch/Checkbox Field、DataTable、TabsView、Badge、AlertBanner、NotificationCard、StatusPill、StateSurface、ProgressMeter、Skeleton、Panel、SearchBox、MenuButton、PopoverCard、TooltipAction、DialogSurface、DrawerSurface 与 CommandMenu。

当前真实证据包括：

- `/showcase` 展示 Action、Feedback、Status、DataTable、Card-like Panel、Form Control、Overlay 和 Composition；关键 Overlay 有 query 参数直接打开态。
- `/reference` 使用 48 条确定性记录验证筛选、DataTable、Master-Detail、Tabs、Drawer、Dialog 和异常状态。
- `/reference/form` 使用 React Hook Form + Zod 验证复杂表单、Pending、错误和成功。
- `/states` 覆盖 Loading、Empty、Error、Success、Warning、Disabled、Pending、Offline、Permission Denied。
- Playwright 已覆盖 Action Pending/Disabled、DataTable 单选/键盘/空集合、Select/Combo 滚动、Overlay Focus/Escape/Axe 和多视口视觉基线。

### 2.3 当前质量基线

`pnpm check` 在 2026-08-30 的结果：

- architecture、dependency、lint、typecheck、unit、build、performance 全部通过；构建 4214 modules，性能预算通过。
- Playwright 18 项中 17 项通过。
- 唯一失败是 `reference-desktop` 全页截图连续捕获时页面高度在 900 与 5104 之间交替，超出 5 秒稳定等待；没有证据表明是产品 DOM/布局断言失败，但当前视觉门禁并不可靠，必须在实施中修复并重新证明。
- 随后用单 worker 定向复跑同一用例，1/1 通过（10.5 秒）；因此当前证据指向并发全量运行下的捕获稳定性，而不是可稳定复现的页面差异。完整门禁仍未通过，不能据此关闭问题。

## 3. 真实缺口与污染点

### 3.1 公共契约缺口

| Family       | 已有                                             | 缺口                                                                                                                                  |
| ------------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Actions      | Action、IconAction                               | IconAction 缺 Disabled/Loading/Size/Danger；缺少有真实互斥语义的 Toggle Group；左右 Icon 不对称。                                     |
| Identity     | 无稳定身份 Element                               | Shell 账号入口和列表身份 Cell 各自拼装图标/文字；缺 Avatar、Presence 与 UserIdentity Pattern。                                        |
| Navigation   | TabsView、Web 私有 Breadcrumb                    | Breadcrumb 未进入 Adapter；真实集合缺 Pagination；命令式 Action 被用于 SPA 导航；Link 与 Host Router 边界未明确。                     |
| Feedback     | AlertBanner、NotificationCard                    | 缺全局临时 Toast 的项目自有 Provider/契约；Preferences 以 StatusPill 表示一次性保存结果。                                             |
| Surface/Data | Panel、DataTable                                 | Panel 同时被当 Section Surface 和 Card 使用；缺 Card Anatomy、Description List；DataTable 缺 Sort/多选支撑，分页 Pattern 尚不存在。   |
| Async        | Action Loading、Progress、Skeleton、StateSurface | 页面仍直接使用 `LoaderCircle`；缺可访问的非确定 Busy Indicator 与局部 Loading Pattern。                                               |
| Overlay      | Menu/Popover/Tooltip/Dialog/Drawer/Command       | `MenuButton.onAction`、`DialogSurface.onConfirm` 可选，Showcase 存在可见但无行为的动作；缺 Confirm/Destructive Confirm 稳定 Pattern。 |
| Form         | Text/Select/Combo/Date/Switch/Checkbox           | 缺 Radio Group 与互斥选择契约；SearchBox/Field/FilterBar 命名与职责需收口。                                                           |

### 3.2 现有页面问题

- Shell 仍有三个原生 `<button>`；通知 IconAction 没有 `onPress`，账号按钮也没有行为，违反“可见动作必须可执行”。
- Overview 用命令式 `navigate()` 包在 Action 中表达页面导航，Action/Link 语义混淆；Metric/Card 内容直接拼装 Panel。
- `PageBreadcrumbs` 是 Web Layout 私有实现；PageToolbar、FilterBar、FooterActions 自己拥有 surface token，但没有完整 Element/Pattern 对照测试。
- Reference Detail、Warning、Success 等局部结构仍重复拼装 rounded/border/background；部分应提升为 Description List、Alert 或 Card Composition。
- Error Boundary 和 Router Hydrate Fallback 仍直接拼装 Surface/Skeleton 视觉。

## 4. 技术与承载架构比较

### 4.1 保留

- 保留 React 19、HeroUI 3.2.4、Tailwind CSS 4、React Aria 底层、现有 Workspace 方向、UI Adapter、Semantic Token、Showcase/Reference 与当前测试栈。
- 保留 `Panel` 作为无业务语义的 Layout Surface，但不再让它冒充有 Header/Content/Footer Anatomy 的 Card。
- 保留 DataTable 只负责 Table Element；搜索、筛选、分页、批量动作继续由集合 Pattern 拥有。

### 4.2 扩展与重构

- 用已安装 HeroUI primitive 扩展 Avatar、Breadcrumbs、Pagination、Spinner/Progress、Toast、Radio/Toggle 和 Confirm 的项目窄契约。
- 自研范围只包含项目语义、Token Mapping、Anatomy、Pattern、Provider 边界和迁移，不重写 Overlay positioning、Focus、Keyboard 或 ARIA。
- 把无行为控件改为真实操作或删除；不允许用可选 callback 渲染空动作。

### 4.3 不引入与不公开

- 不新增 TailAdmin、另一套 UI Library、Storybook 或媒体运行时。
- Carousel、Image Grid、Ribbon、Video Player 当前没有真实跨 Feature 用例；以明确 Composition 规则结束，不建立万能 Wrapper。
- 不为每个页面增加 Variant；不公开 HeroUI placement、color、radius、slot 或 DOM props。

## 5. 研究门禁判定与任务影响

研究门禁通过。事实足以形成覆盖完整目标的线性计划：先补 Foundations 和契约，再完成 Pattern、全部现有页面迁移、Showcase、门禁和全量验证。现有 `AGENTS.md` 标题修改是用户既有改动，必须持续保护；当前项目之外的工作区内容不进入本任务。

实施入口如果 HEAD 后出现 `packages/ui-adapter`、`packages/design-system`、Page Layout、HeroUI 版本或产品范围相关变更，只定向刷新受影响结论；否则直接实施，不重复全量研究。
