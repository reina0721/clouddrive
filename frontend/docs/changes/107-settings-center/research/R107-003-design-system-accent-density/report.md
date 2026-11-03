# R107-003 Design System 主题扩展与视觉校准基线

## 研究问题

外观/可访问性分类的展示偏好要真实生效：

- 主题模式：跟随系统 / 浅色 / 深色（跟随系统需要 matchMedia('(prefers-color-scheme: dark)')）；
- 四套强调色：紫 / 蓝 / 绿 / 橙（受控预设，不向普通用户暴露 HEX/CSS Token）；
- 三档密度、字号（small/standard/large）、内容宽度（自适应/标准/宽屏）；
- 动效偏好（跟随系统/标准/减少动效）与高对比度（跟随系统/标准/高对比度）。

需要回答：这些在现有 design-system（`design-system.schema.json` 唯一事实源 →
`packages/schemas/runtime` `createSchemaRuntime` → 生成 `tokens.css` 受控区段 + `motion.css`
整文件；`pnpm codegen:design` / `:check`）里如何表达、语义映射落点在哪、TailAdmin 复核
范围与触发器是什么。**设置运行时不使用 packages/schemas API**，但 Design System 开发期
沿用现有 schema→codegen 生成流程（目标已确认）。

## 现状事实

- `tokens.css`：`@theme { --color-brand: var(--ds-brand); … }` 语义映射层 → `:root`（light）
  与 `[data-theme='dark']` 定义 `--ds-*`；只有 1 套 brand 紫（light `--ds-brand:#5d49d6`、
  soft `#eeebff`、strong `#4e3bc3`、on-brand `#ffffff`、focus-ring 同紫；dark 对应亮紫
  `#9b8cff`）。另有 success/warning/danger/info 四语义色（soft/on-*）。
- `motion.css` 与 `:root` motion 属性：`--motion-duration-{fast,standard,slow,control,feedback,
page,progress,progress-cycle}`、`--motion-distance-{reveal,enter}`、`--motion-debug-scale`
  （dev Motion Inspector 倍率）；`data-motion-mode={full|reduced|off}` 与
  `@media (prefers-reduced-motion: reduce)` 全量降级（tokens.css 158-176）。
- 主题链路：Host `providers.tsx` 写 `html.dataset.theme = theme`（'light'|'dark'）；
  `motion-policy.tsx` 管理 `data-motion-mode`/category/scale（dev sessionStorage
  'clouddrive.motion-inspector'，production 强制 system）。
- **缺失**：无 `prefers-color-scheme` 跟随（'system' 档）；无强调色变体（-brand 系列唯一）；
  无 density 全局缩放、字号缩放（fontScale）、内容宽度 token、对比度 token；
  `--spacing-control/control-sm/control-lg` 与 `--radius-control` 存在但无 density 维度。
- 预设数值只由 Design System 管理；业务页禁 arbitrary design value（architecture gate）。

## 语义映射方案（推断/设计输入，非已实现）

- **主题**：偏好 `system|light|dark`；Host 用 `matchMedia('(prefers-color-scheme: dark)')`
  订阅解析成 `light|dark` 写 `data-theme`（与 motion-policy 的 matchMedia 订阅同模式）。
- **强调色**：四套受控预设 = `purple|blue|green|orange`，每套含 `--ds-brand/strong/soft/
on-brand/focus-ring` 的 light/dark 值；以**数据属性切换**（如 `html[data-accent='blue']`）
  覆盖 `:root`/`[data-theme]` 下的 brand 组，或用受控 CSS 变量（schema 区段内声明，不向
  业务泄漏）。预设色值在 SET-002 从现有 32 位受控色板选配并记录来源（紫 = 现 --ds-brand；
  蓝 ≈ 现 info 蓝的独立受控值；绿/橙从受控色板新增；需过 TailAdmin/对比度复核）。
- **对比度**：`standard|high`（跟随系统 = standard + prefers-contrast 可留扩展）；high 用
  受控 `--ds-*` 覆写（提高 ink/border 对比），不碰品牌色。
- **密度**：`compact|standard|comfortable`（产品语义三档，注意与 DataTable 既有
  comfortable|compact 两档对齐——列表偏好三档中"宽松"即现 comfortable？需在
  /ui-elements/data 复核后定档名映射，避免公共契约漂移）；以 root 数据属性
  `data-density` 驱动 spacing/control-height token 覆盖。
- **字号**：`small|standard|large`；以 `data-font-scale` 驱动 html `font-size` 或受控
  `--font-scale` 乘数（大文字优先于紧凑密度——产品规则）。
- **内容宽度**：`auto|standard|wide` 映射 main 容器 `max-w-*`（Host 布局层，非 token 硬编码）。
- **动效偏好**：`system|standard|reduced` 映射现有 `data-motion-mode`（system 已由
  MotionPolicy 处理；reduced = data-motion-mode='reduced'）；**Motion Inspector 的开发配置
  不得覆盖用户更强的减少动效要求**（用户选 reduced 时 inspector 不回升 full）。
- **日期/一周起始**：DatePicker 接界面语言与 week start：装配 RAC `I18nProvider`（locale 随
  界面语言；周起始经 Calendar `firstDayOfWeek` 显式传 'mon'|'sun'）；HeroUI v3.2.4 d.ts 已
  确认 `firstDayOfWeek` 存在；`@react-aria/i18n` 已装未用。
- **表格列宽/列顺序**：列宽复用 HeroUI `Table.ResizableContainer`/`Table.ColumnResizer`
  （v3.2.4 d.ts 命中）经 ui-adapter 封装语义 props；列顺序用可键盘操作的前移/后移按钮；
  列显隐/排序/筛选/分页记忆按页面/列 ID 管理覆盖值（design/list-form-adapters.md）。

## TailAdmin 复核范围与触发器（SET-002 硬门禁）

- 外部基准：https://react-demo.tailadmin.com/ 的 UI Elements 子页。本任务相关四组：
  **Basic Tables + Data Tables**（密度/分隔/表头/列组合）、**Tabs**（Tabs 视觉基线）、
  **Forms/Form Elements**（Radio/Select/Switch/Toggle/DatePicker）、**Notifications**
  （Toast/通知层级）——另按 ui-visual-calibration.md §3 矩阵逐页核对关闭/交互/打开态。
- 复核步骤固定（ui-visual-calibration.md §5）：关闭态 → Hover/Focus/Active/Selected →
  Disabled/Loading/Error → 打开态与 Escape/焦点返回 → Light/Dark → 中文/英文长文本 →
  窄屏/桌面/超宽屏。
- 触发器（改动公共 Button/Alert/Badge/Card/Dropdown/Modal/Form Control/Notification/Overlay、
  Token、新增/升级 HeroUI 等必须重开对应 TailAdmin 页复核）。
- **网络不可达（历史两次超时）是 blocker**：SET-002 不得在外部复核完成前标 [x]；先确认
  react-demo.tailadmin.com 可达性，不可达则记录 blocker 并暂停该任务（不降级为跳过）。

## 适用与不适用场景

- 适用：外观/可访问性 token 扩展、四强调色受控预设、密度/字号/内容宽度/对比度语义映射、
  DatePicker locale/weekStart、表格列能力、TailAdmin 复核门禁。
- 不适用：给普通用户暴露设计参数（HEX/CSS Token 编辑器/任意键位/圆角阴影间距设计器）；
  用业务页 CSS 硬编码替代 token 治理；降低视觉阈值掩盖回归。

## 局限与剩余未知

- 4 套强调色 light/dark 具体色值需人工选配 + 对比度验证（SET-002 产物）。
- 密度三档与 DataTable 现两档（comfortable|compact）的关系需在 /ui-elements/data 复核后定
  公共契约（避免改 DataTable 时破坏现有 page-archetypes/resource-list 消费者）。
- 对比度/大字号/增强点击区域的边界值（如 WCAG 对比率、hit target）在 design/design-system
  -theming.md 明确，不做超出产品底线的可关闭项。

## 对当前任务的影响

- design/design-system-theming.md 以本记录为输入；SET-002 完成 schema/受控区段扩展 +
  Showcase 同步 + 登记；codegen:design:check 纳入验证。
