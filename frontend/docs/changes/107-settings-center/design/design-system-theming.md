# Design System 主题语义扩展

## 1. 目标与边界

外观/可访问性偏好要真实生效：主题（system/light/dark）、四套强调色、密度、字号、内容
宽度、动效偏好、对比度。预设数值只由 Design System 管理；业务页不硬编码；不向普通用户
暴露 HEX/CSS Token。设计依据 [R107-003](../research/R107-003-design-system-accent-density/report.md)。

## 2. 表达载体与生成

- 唯一事实源 `packages/design-system/design-system.schema.json`；改受控区段 →
  `pnpm codegen:design` 生成 `tokens.css` 受控区段与 `motion.css`；`codegen:design:check`
  纳入门禁。**设置运行时不使用 packages/schemas API**（只影响运行时设置代码，不影响
  Design System 开发期生成流程——目标已确认）。
- 语义 Token 由 `@theme` 映射为 Tailwind utility（--color-brand 等），业务消费语义 class；
  新增维度以**数据属性 + 受控 CSS 变量覆盖**表达，不改 @theme 基座形状时尽量少动既有
  utility 名（避免破坏现有消费者）。

## 3. 主题模式（system/light/dark）

- 偏好值 `system|light|dark`；Host 解析：system → `matchMedia('(prefers-color-scheme: dark)')`
  订阅（与 motion-policy 同模式 useSyncExternalStore）→ resolved light|dark → 写
  `html.dataset.theme`（现有链路 providers.tsx 已写 dataset.theme；扩展为订阅系统变化）。
- 初始 SSR 无 window：先按 light 渲染，hydration 后按 resolved 值设置（避免闪变用
  dataset.hydrated 门控已有机制）；系统强制颜色模式（如系统高对比）保留浏览器控制权。

## 4. 强调色（四套受控预设）

- 预设 `purple|blue|green|orange`；每套含 light/dark 的
  `--ds-brand/--ds-brand-strong/--ds-brand-soft/--ds-on-brand/--ds-focus-ring` 组
  （brand 语义）。purple = 现 --ds-brand 值（迁移不变）；blue/green/orange 色值在 SET-002
  从现有受控 32 位色板选配，记录来源与对比度验证（WCAG AA on-brand/文字）。
- 切换机制（推荐）：root 数据属性 `html[data-accent='blue']` 等在 `tokens.css` 受控区段
  覆盖 `:root`/`[data-theme]` 的 `--ds-*` brand 组；或用受控 CSS 变量组 + 属性选择器，
  二选一在设计定稿时锁定（不两套并存）。Host 写 dataset.accent；业务零改动（消费
  --color-brand 语义 class 自动跟随）。
- 不向用户暴露 HEX/CSS Token：设置 UI 只显示色名 + 色块预览。

## 5. 密度 / 字号 / 内容宽度 / 对比度

- 密度 `compact|standard|comfortable`（与 DataTable 现有 comfortable|compact 两档对齐：
  三档映射需在 /ui-elements/data 复核后定档名与既有消费者（page-archetypes/resource-list）
  的兼容映射，避免公共契约漂移）。载体：`html[data-density='…']` 覆盖受控变量
  （--spacing-control-sm/control/control-lg、--radius-control 可选），消费
  size-* 语义 class 的组件自动跟随；或 surface 层 spacing token 覆盖。
- 字号 `small|standard|large`：`html[data-font-scale='…']` 驱动根字号/受控 --font-scale
  乘数（不影响 rem 语义化布局；超宽屏与长文本验收）。**大文字优先于紧凑密度**（产品规则：
  两者同开时字号覆盖密度相关压缩，设计定稿明确优先实现）。
- 内容宽度 `auto|standard|wide`：Host 主内容容器 max-width 策略（main 容器/Page 内容域），
  Host 布局层表达，不散落 token。
- 对比度 `standard|high`（跟随系统 = standard；prefers-contrast 订阅可留扩展）：high 用
  受控 --ds-* 覆写（ink/border/focus 对比提升，不影响品牌色系）；增强焦点轮廓（可访问性
  分类）共享同一 contrast/high 与 focus-ring 表达。

## 6. 动效偏好与 Motion Inspector 优先级

- 偏好 `system|standard|reduced`；映射现有 `data-motion-mode`（MotionPolicyProvider 已管
  full/reduced/off + system 解析 + 分类 on/off）。reduced = data-motion-mode='reduced'
  （tokens.css 已全量降级）。
- **Motion Inspector 的开发配置不得覆盖用户更强的减少动效要求**：用户偏好 reduced 时，
  inspector（dev sessionStorage 'clouddrive.motion-inspector'）不得把 mode 升回 full；
  MotionPolicyProvider 优先级 = 用户设置 > inspector；production 强制 system。
- 动效偏好设置入口在"外观"与"可访问性"共享同一存储字段（同一偏好两处入口）。

## 7. 展示策略下发（不扩散 import）

- 展示策略（resolvedTheme/accent/density/fontScale/contentWidth/contrast/motion/locale/
  weekStart）集中为 Host 侧 context（AppearanceContext，或并入现有 MotionPolicyContext
  演进）；Host 单点写 documentElement data-* 与 CSS 变量；Universal/Surface Foundation 组件
  经 props/context 消费当前值（如 DataTable density 可读 context 默认再被页面覆盖），
  **不 import settings 插件、不读 Host Store**。

## 8. Showcase 与 authority 同步

- `/ui-elements`（data/forms/surfaces）、`/page-patterns`、`/page-archetypes` 中与外观/
  数据展示相关的展示须能演示新语义（密度/强调色/对比度至少一处真实组合），Showcase 与
  业务同源（同一套实现）；design-system authority（schema 区段 + tokens.css）与
  foundation-contracts（design-system 证据/authorityRoutes）同步更新。
- 视觉基线（PNG）在人工审阅后更新；不提高阈值掩盖回归。

## 9. 验证方案

- codegen:design:check freshness；tokens.css 区段比对。
- 浏览器/视觉：Light/Dark × 4 强调色 × 对比度（standard/high）矩阵快照、density/字号三档、
  大字号×紧凑密度优先、Reduced Motion（用户 reduced 不被 inspector 覆盖）、超宽屏/窄屏。
- Axe：对比度（high 达标）、焦点轮廓增强。
