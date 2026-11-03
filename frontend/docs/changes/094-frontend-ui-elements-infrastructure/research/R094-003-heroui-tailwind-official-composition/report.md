# R094-003 HeroUI v3 与 Tailwind CSS v4 官方互补模型

## 1. 研究问题与版本边界

用户要求充分利用 HeroUI v3 与 Tailwind CSS v4 的官方互补关系，不能只按通用经验划分“行为”和“样式”。本轮只读取两方官方文档，并与当前安装清单交叉验证：项目锁定 `@heroui/react` / `@heroui/styles` 3.2.4、`tailwindcss` / `@tailwindcss/vite` 4.3.3。

## 2. 官方事实

### 2.1 HeroUI v3 已原生组合 Tailwind CSS v4 与 React Aria

- [HeroUI v3 Introduction](https://heroui.com/en/docs/react/getting-started) 明确把库描述为建立在 Tailwind CSS v4 与 React Aria Components 之上；React Aria 提供规模化 Accessibility 基础，包括 Focus、Keyboard 和 Screen Reader 支持。
- [HeroUI Styling](https://heroui.com/en/docs/react/getting-started/styling) 明确演示在 HeroUI 组件的 `className` 上直接使用 Tailwind utilities，并列出 documented data attributes、render props 和 responsive utilities；同页还把 `@heroui/styles` 的 `tv`、现有 component variants 与 compound slots 作为建立可复用定制组件的官方路线。
- [HeroUI Migration](https://heroui.com/en/docs/react/migration) 说明 v3 使用 React Aria Components 和 compound component 模式；collection item 的 `id`、`textValue` 分别参与选择/焦点/回调和辅助技术/type-ahead。项目 Adapter 不能用只考虑视觉的 wrapper 丢失这些语义。

### 2.2 Tailwind CSS v4 把 Design Token、utility 和条件变体连成一条链

- [Tailwind Theme Variables](https://tailwindcss.com/docs/theme) 说明 `@theme` 中的 CSS theme variable 会决定生成哪些 utility 与 variant；颜色、字体、spacing、radius、shadow、breakpoint、container、ease 和 animation 等都有明确 namespace。
- [Tailwind States and Variants](https://tailwindcss.com/docs/hover-focus-and-other-states) 说明 utility 可以由 pseudo state、ARIA/data attribute、responsive breakpoint、container query、Dark Mode、contrast 和 `prefers-reduced-motion` 等条件驱动。
- [Tailwind Compatibility](https://tailwindcss.com/docs/compatibility) 说明 v4 依赖现代浏览器能力并大量使用原生 CSS variable；这与项目集中 Semantic Token、Vite Host 和现代浏览器目标一致，但浏览器基线变化时必须刷新研究。

### 2.3 当前项目采用情况

- 当前 `packages/design-system/src/tokens.css` 已使用 `@theme`，`apps/web/src/styles.css` 已用 `@custom-variant` 建立显式主题切换，方向与官方 v4 模型一致。
- 当前 UI Adapter 已大量在 HeroUI compound parts 上使用 semantic Tailwind class 与 documented `data-*` state，但公开 Variant 主要由手写字符串映射和模板拼接实现；尚未使用已经安装的 `@heroui/styles` `tv` / component variants 来统一复杂 Variant 与 slot composition。

## 3. 项目推断

- 【推断】正确模型不是“HeroUI 提供默认样式，Tailwind 在外面覆盖”，而是“选择 HeroUI/React Aria 的正确 compound primitive，再用项目 `@theme` / CSS variable 和公开 Tailwind class 表达产品视觉”。
- 【推断】HeroUI 应拥有 selection、collection、overlay、focus、keyboard、pending/disabled 等交互与可访问状态；项目 Adapter 把这些能力收敛成业务稳定 props，并保留 `id`、`textValue`、accessible label 等必要信息。
- 【推断】Tailwind 应拥有 Semantic Token 到 utility/variant 的映射、响应式与 container layout、Light/Dark、density、reduced-motion 和公开 state attribute 的视觉表达；不创建平行 React 状态机。
- 【推断】允许在 HeroUI 的公开 `className`、compound part 和 documented data attribute 上使用 Tailwind；禁止深层 selector、依赖 vendor DOM 层级、透传全部 vendor slot/props 或用 `!important` 争夺样式所有权。
- 【推断】UI Adapter 是 HeroUI 直接依赖以及 Tailwind styling HeroUI compound parts 的唯一汇合边界；Tailwind CSS v4 本身可在整个 `/frontend` 使用。上层 Feature/Page 不直接知道 HeroUI，Feature、Page、Host 与公共包中的 Tailwind class 只能消费项目语义 token；组件差异优先落为项目 Variant、size、density、state、slot composition 或 context。
- 【推断】有多维 Variant 或 compound slots 的公共 Element 应在 UI Adapter 内复用 `@heroui/styles` 的 `tv` 与官方 component variant 基线，再映射为项目语义；局部单态样式仍可直接使用 semantic utility，不能机械地把每段 class 都改写成 `tv`。

## 4. 对 094 的强制影响

1. 每个新增或修改 Element 先记录采用的 HeroUI compound primitive、官方可访问语义、documented state/slot 与项目所需状态，再设计 Adapter props；禁止从视觉 markup 反推交互 API。
2. 每个公开视觉差异都映射到 `packages/design-system` 的 Semantic Token 或可复核的 Tailwind composition；多维 Variant/compound slots 复用 `@heroui/styles` `tv`，不散落 vendor 默认值和 arbitrary value。
3. Contract/DOM/Playwright/Axe/Visual 证据必须成对证明：HeroUI primitive 的交互与可访问行为没有被破坏，Tailwind 的主题、响应式、密度和视觉状态没有越界。
4. 发现 HeroUI 缺少真实能力时，先判断是否是 Pattern/Feature composition；只有官方 primitive 无法表达且项目确有稳定跨场景语义时才研究自研，不以 CSS hack 填补交互缺口。

## 5. 局限与刷新

官方文档描述库能力，不证明当前项目已经正确采用，也不替代实现后的 DOM、Keyboard、Axe 与视觉验证。本结论绑定当前 HeroUI 3.2.4、Tailwind CSS 4.3.3 和 2026-08-30 官方页面；依赖升级或官方架构变化时定向刷新。
