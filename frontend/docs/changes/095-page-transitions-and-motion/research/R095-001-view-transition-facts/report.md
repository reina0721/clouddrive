# R095-001 Next.js 16 / React ViewTransition 页面转场能力与项目约束

## 1. 研究问题与版本边界

研究问题：当前 frontend 基座（Next.js 16.3.3 + React 19.2.8 + Tailwind CSS 4 + HeroUI）应如何实现路由级页面转场与动效分层——运行时是否可用浏览器 View Transitions API、TypeScript 类型如何补齐、方案如何兼容项目 Semantic Token、样式红线与质量门禁？

本轮只读已安装包源码、官方文档与项目现状，不把网络上的第三方动画方案当作事实。版本边界：`next@16.3.3`、`react@19.2.8`、`@types/react@19.2.18`、Tailwind 4.3.3；基线 commit `6f08aa37`（frontend 工作区干净）。

## 2. 已核实的官方与源码事实

### 2.1 运行时：Next.js 16 内置 react 已导出 ViewTransition

- `frontend/apps/web/node_modules/next/package.json` 声明 `next@16.3.3`；`next/dist/compiled/react/package.json` 包名为 `react-builtin`（Next 自带的 canary 快照）。
- `next/dist/compiled/react/cjs/react.development.js` L878 与 `react.react-server.production.js` L306 均存在 `exports.ViewTransition = REACT_VIEW_TRANSITION_TYPE`；`react.react-server.development.js` L596 同样导出，说明 Server/Client 两侧运行时都有该组件。
- 顶层 `react@19.2.8` 包（`react/index.js`）未导出 ViewTransition；Next 构建会解析到其内置 react，因此应用代码 `import { ViewTransition } from 'react'` 在运行时可用。
- 官方文档 `next/dist/docs/01-app/02-guides/view-transitions.md`：App Router 使用 React canary 特性，View Transitions **无需配置**；不支持的浏览器（transition types 需 Chromium 125+/较新 Safari/Firefox）自动不播放动画，应用功能不受影响。

### 2.2 类型缺口与补齐方式

- `@types/react@19.2.18` 稳定版 `index.d.ts`（含 `ts5.0/index.d.ts`）不含 `ViewTransition`；仅 `canary.d.ts`/`experimental.d.ts` 提供（搜索 `ViewTransition` 命中即证）。
- `canary.d.ts` 头部文档给出三种激活方式；本项目 tsconfig 开了 `verbatimModuleSyntax`，普通 `import {} from 'react/canary'` 会保留为运行时副作用导入，必须使用 `import type {} from 'react/canary'`（type-only import 被编译器擦除，仍能激活 `declare module "."` 增强）。
- `@types/react/package.json` exports 已声明 `"./canary"` types → `canary.d.ts`，因此该引用在 Bundler moduleResolution 下可解析。
- Next 类型已支持转场类型：`next/dist/client/link.d.ts` L102 `transitionTypes?: string[]`；`app-router-context.shared-runtime.d.ts` L14 同样出现在路由 push 选项里。

### 2.3 React ViewTransition 的宿主语义（读 `react-dom-client.development.js`）

- ViewTransition 是特殊 fiber（tag 30），**不渲染额外 DOM 外壳**，对布局零影响；它把 `view-transition-name` 与 `view-transition-class` 作为 inline style 临时应用到子树内的每个宿主元素（`applyViewTransitionToHostInstancesRecursive`），名字带唯一递增后缀；转场后统一恢复（`restoreViewTransitionName`）。
- `getClassNameByType`：enter/exit/default 均接受字符串或按过渡类型分键的 map；命中类型取该类型 class，未命中取 `default`，`'none'` 表示不参与。
- `getViewTransitionClassName(defaultClass, eventClass)`：eventClass 命中时**只用 eventClass**（不叠加 default），类型缺失时取 per-type map 的 `default` 键；本项目最终采用 map default `'none'`（hydration/Suspense reveal、popstate 后退等无类型提交不应用任何转场样式），带 `nav-forward` 类型的导航走方向滑动。
- `name` 默认 `auto`：每个实例生成唯一自动名（`_<prefix>t_<id>_`），避免跨页面意外配对。
- 【实测补充】Chromium + `next dev` 下，浏览器后退（popstate）导航不启动 View Transition（e2e watcher 未观察到任何 `::view-transition-*` 动画，2026-09-12 验证）：与官方文档“浏览器后退不携带转场类型”的说明一致，页面为瞬时切换。
- 【实测补充】转场组件加入后，点击首屏之外的浮层触发器（`/ui-elements/forms` 的 DatePicker）偶发触发滚动定位竞态（弹层落点相差约 430px）；把触发器先滚动进入视口再点击可使锚定测量确定化（8/8 稳定，无包裹基线同为 8/8 稳定）。结论：转场组件改变提交时序后会提高视口外锚定交互的竞态概率，涉及该类交互的自动化测试应先把目标滚动就位。
- 官方四个模式（shared element morph / Suspense reveal / directional / same-route crossfade）中，本任务只采用 directional 最小组合；方向滑动配方（exit 快、enter 缓、`--slide-offset` ≤60px、header 锚定 `viewTransitionName` + 动画抑制、`::view-transition { pointer-events: none }`、reduced-motion 块）都以官方文档为据。

### 2.4 项目 Token 与规则约束

- `packages/design-system/src/tokens.css`：`--motion-duration-fast/standard/slow` = 120/180/240ms、`--ease-product` = cubic-bezier(0.2,0.8,0.2,1)、`--z-index-*` shell/sticky/overlay/toast；全局 `@media (prefers-reduced-motion: reduce)` 仅匹配 `*`/`*::before/*::after`，**不覆盖 `::view-transition-*` 伪元素**，需在转场样式中补专属规则。
- 前端 AGENTS.md：禁止 `!important`、arbitrary value、深层选择器、穿透 HeroUI DOM、页面硬编码颜色/时长；动效时长与缓动只能来自 design-system Token。
- `docs/ui-element-system.md` §10：承载文字的 Page/Surface 不参与整体 Opacity 动画，Opacity Motion 只用于 Scrim 等无文字装饰层——页面级转场由浏览器快照层承担（短促、旧内容先退场），不作为组件动画设计；本方案在设计中明确该边界。
- 页面与入口盘点：15 个路由页（总览/基座能力/偏好/Reference/Reference Form/状态体系 + 9 个 UI Elements Family，Family 页为 `Suspense(fallback=null)` 包 client 组件）；`/ui-elements` 是 `router.replace` 重定向页；`not-found.tsx` 存在。导航入口：`shell/navigation-tree.tsx`（next/link 三处）、`shell/app-shell.tsx`（CommandMenu/MenuButton 走 router.push）、`host/router-text-link.tsx`。
- 测试与预算：`e2e/visual.spec.ts` 全部先 `page.goto` 再截图（全量加载不触发客户端转场，基线不受影响）；`e2e/navigation.spec.ts` 有客户端导航但无截图；vitest 单测不渲染路由页。预算脚本 `tooling/check-performance-budget.mjs` 对 `dist/_next/static` 下全部 CSS gzip 求和（预算 48 KiB）；当前 build 引用 CSS 为 44,056 B gzip（dist 中另有一份未被引用的旧 CSS，需全新构建后取基线）。

## 3. 项目推断

- 【推断】转场实现应采用 React `<ViewTransition>` + 浏览器 API，而不是 framer-motion 等动画库：零新增依赖、符合性能预算、不触碰 HeroUI Overlay 契约，且官方明示 App Router 免配置。
- 【推断】方向语义应以“是否深入信息层级”划分：侧栏/命令菜单/页内 CTA 进入更深层级 → `nav-forward` 方向滑动；浏览器后退/前进与重定向无类型 → 仅淡入淡出（不伪造方向）。当前不存在“返回上一级”入口，**不预留 nav-back CSS/类型**（避免无调用方的死代码），未来出现真实返回入口时再按 R095 refresh trigger 补齐。
- 【推断】reduced-motion 可用“与主规则相同特异性的后置源顺序规则”把 `::view-transition-*` 时长压到 0.01ms，无需 `!important`，与 tokens.css 既有手法一致。
- 【推断】转场动画只含 transform/opacity，不产生任何中间色；色彩语义继续由 Token 单源，满足“动效区分层级、语义色彩”的要求。
- 【推断】类型缺口用一处 `import type {} from 'react/canary'` 解决，零运行时影响；`@types/react` 未来把 ViewTransition 升入稳定版后按 refresh trigger 移除。

## 4. 对 095 的强制影响

1. 转场样式必须落在 `packages/design-system`（`motion.css`，随 `tokens.css` 导出），页面不得硬编码时长/颜色；动效 Token 上层只引用 `--motion-duration-*` 与 `--ease-product`。
2. 页面级包裹组件收敛在 `apps/web/src/host/page-transition.tsx`（'use client'），15 个 page.tsx 只引用它；layout 不参与（Layout 跨导航持久，enter/exit 不触发）。
3. `nav-forward` 只标记真实“进入更深层级”的入口；未类型化导航走默认 fade。
4. Header/侧栏锚定（`viewTransitionName`）与动画抑制、`pointer-events`、reduced-motion 块按官方配方落入 motion.css。
5. 验证必须覆盖：转场真实播放（e2e 观测动画）、reduced-motion 下无位移、转场后 inline 样式还原、全量门禁与视觉基线复核、大页面（Reference）无卡顿人工核对。

## 5. 局限与刷新

- 源码阅读证明的是当前安装版本的行为，不替代浏览器实测；transition types 在旧浏览器不生效（优雅降级为瞬时切换）。
- jsdom 单测环境无 View Transitions API，转场行为只能由 Playwright e2e 验证。
- 【验证环境】Playwright 本地默认复用已有 dev server（`reuseExistingServer`），复用会吃到陈旧编译产物（旧 CSS/旧模块），导致转场断言误报（如残留已删除的 `page-fade` 动画名）。本任务所有验证结论以全新 server（`CI=1`）为准；后续转场相关调试若出现与代码不一致的观察，先确认 server 是否陈旧。
- 性能结论（快照分组数量对 Reference 大表格的影响）需在 Chromium DevTools 实测后才算成立。
- 依赖升级（Next/React/@types/react）、浏览器支持矩阵变化、项目出现返回入口或动效 Token 调整时，按 metadata 的 refresh_triggers 定向刷新本档案。
