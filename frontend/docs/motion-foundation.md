# Motion Foundation 与语义动效分层

本文件是 `/frontend` Motion 主题的唯一当前权威。历史变更记录只保存当时证据，不构成现行规范。

## 1. 治理模型

```text
Motion Policy      用户环境 + development override，决定是否允许某类动效
Motion Recipe      Design Token 之上的语义行为，决定如何呈现连续性
Semantic Component 绑定真实生命周期，决定为什么动、何时动
```

页面只声明业务状态，不填写 duration、easing、keyframes 或浏览器观察器。动画层不得改变高度、滚动容器、定位上下文或 Layout Contract。Overlay Enter/Exit 继续完全由 HeroUI 与 UI Adapter 主持。

## 2. 生命周期与所有权

| 生命周期          | 当前组件               | 所有权              | 规则                                                                                                                                                                                              |
| ----------------- | ---------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Router / Suspense | Host `RouteTransition` | `apps/web/src/host` | `nav-forward` 使用 Surface screen recipe；无导航类型使用克制的 `content.enter`；hydration 不重复播放页面滑动；`appearance.pageTransition` 选择 `surface-screen-*` 整页 recipe（默认保留方向进入） |

### 2.1 页面切换动画偏好（117）

`appearance.pageTransition` 是 Surface Screen Recipe 的选择器，默认 `default`：

| 值           | Recipe                      | 行为                                                                           |
| ------------ | --------------------------- | ------------------------------------------------------------------------------ |
| `default`    | 无新增（沿用标题方向进入）  | 非持久 PageHeader 的 `content-rise-in` / `surface-enter-forward`，项目现行体验 |
| `fade`       | `surface-screen-fade`       | 整页淡入，无位移                                                               |
| `fade-slide` | `surface-screen-fade-slide` | 自右轻移入 + 淡入（`--motion-distance-enter`）                                 |
| `fade-up`    | `surface-screen-fade-up`    | 自下轻移入 + 淡入                                                              |
| `fade-down`  | `surface-screen-fade-down`  | 自上轻移入 + 淡入                                                              |
| `none`       | 无                          | 仅停用页面切换动画，不关闭其它动效                                             |

- 非默认值下标题动画让位（`animation: none`），避免与整页 recipe 叠加；
- 动画只作用于 `.surface-route-content > .surface-page-stack`，纯 opacity/transform；
- 含嵌套 Route 的持久面板（`:has([data-route-content])`）不重放整页动画；
- `motion=reduced`、系统 reduced-motion 与 `data-motion-screen='off'` 统一降级；
- 只实现 enter（React commit 替换子树），Vben 的 leave 过渡不适用；`fade-scale` 不在 Vben 可选集合，未提供。
  | 数据 readiness | `AsyncRegion`、`StateRegion` | Universal / Product Surface | initial 才替换 Skeleton；refresh 保留旧内容；background 静默 |
  | 首次进入视口 | `ViewportReveal` | 已登记浏览器适配 + Host 装配 + Surface recipe | Page 语义项 scope，单例 Observer，默认可见，首次进入一次 |
  | 同路由内容切换 | `ContentSwapTransition` | UI Adapter | 使用稳定 `contentKey`；`TabsView` 默认接入；筛选刷新不使用它 |
  | Inline Feedback Presence | `FeedbackPresence` | UI Adapter | exit 期间立即退出辅助技术与交互树；支持快速反转；Toast 不接入 |
  | 非 Avatar 图片 readiness | `ReadyImage` | UI Adapter | width/height 预留空间，load + decode 后 crossfade，error 保持尺寸 |
  | Overlay | HeroUI compound lifecycle | UI Adapter | 禁止再套 Presence 或页面动画容器 |

冷启动与路由挂起统一使用 `PageLoadingSurface`。根 `loading.tsx` 与各路由 Suspense 都必须提供 `page/catalog/collection/form` 结构化 Skeleton；禁止 `fallback={null}` 和居中卡片整屏替换 Shell。

## 3. Design Token 与 Recipe Registry

基础参数的单一权威是 `packages/design-system/src/tokens.css`（其受控区段由
`packages/design-system/design-system.schema.json` 生成，见下）：

- `--motion-duration-fast/standard/slow`：基础档位，并受 development 慢速倍率控制。
- `--motion-duration-control/feedback/page`：用途语义。
- `--ease-product`、`--motion-distance-page`、`--motion-distance-reveal`：缓动与位移语义。

Universal recipe 的单一登记文件是 `packages/design-system/src/motion.css`：

| Recipe              | 消费方                               | Reduced / Off                            |
| ------------------- | ------------------------------------ | ---------------------------------------- |
| `content.enter`     | Route fallback、Async 无内容→有内容  | 全局 Policy 缩短并取消非必要位移         |
| `content.swap`      | `ContentSwapTransition` / `TabsView` | `swap` 分类关闭时禁用                    |
| `viewport.reveal`   | `ViewportReveal`                     | reduced、off、不支持 Observer 时直接显示 |
| `feedback.presence` | `FeedbackPresence`                   | `feedback` 分类关闭时禁用                |
| `media.ready`       | `ReadyImage`                         | `media` 分类关闭时直接显示               |

Surface `screen.enter/exit`、Shell 锚定、Route content、Viewport 与 State recipe 的具体绑定继续由 `packages/surface-foundation/src/styles.css` 持有。非上述权威文件禁止声明 `@keyframes`。

持久布局通过既有 `[data-route-content]` 标出可替换区域。外层壳和内层 Page
保持空间骨架，分类内容独立观察；route recipe 仅给非持久 PageHeader 轻量转场。
ViewportReveal 的内容项不参加 route 错峰，避免父子动画叠加。

### Schema-Controlled 生成（Design System 单一 Schema）

Design System Token 与 Motion Language facts 的唯一 Source 是
`packages/design-system/design-system.schema.json`（Schema-Controlled Authority
第一例，协议见 `docs/frontend-foundation.md` §Schema-Controlled Authority）：

- `tokens.css` 由内置 Generator `css-token-regions-v1` 生成**受控 marker 区段**
  （`@theme`、`:root` motion、light/dark `--ds-*`），marker 外的 selector、
  reduced-motion policy 与实现型 CSS 保持手写；`motion.css` 由
  `css-motion-language-v1` 从受控 Motion Language（opacity enter/exit、
  token-driven translate、progress width operation）**整文件**生成。两文件路径与
  export（`@clouddrive/design-system/tokens.css`、`/motion.css`）不变。
- 修改 Token/Motion 事实 = 编辑 Schema 的 `source`（唯一可配置值域），运行
  `pnpm codegen:design` 重新生成；`pnpm codegen:design:check` 与完整 `pnpm check`
  做 freshness（受控区段逐字节 / motion.css 整文件逐字节）。`pnpm dev` 启动
  Schema Watcher 自动重新生成并触发 CSS HMR。
- surface-specific keyframes、Host 生命周期绑定与 UI Adapter 使用方式**不进入**
  Design System Source（仍属 Surface Foundation / Host / Adapter 所有权）。

## 4. Readiness 单一语义

`AsyncRegionPhase` 固定为：

| Phase        | 内容                      | Pending              | `aria-busy` | 整块 content.enter       |
| ------------ | ------------------------- | -------------------- | ----------- | ------------------------ |
| `initial`    | 无可用数据，显示 Skeleton | 可访问 Loading label | 是          | 进入 ready 时播放        |
| `ready`      | 显示内容                  | 无                   | 否          | 仅从无内容阶段进入时播放 |
| `refreshing` | 保留旧内容                | 局部可见             | 是          | 否                       |
| `background` | 保留旧内容                | 默认静默             | 否          | 否                       |
| `empty`      | Empty recovery surface    | 无                   | 否          | 否                       |
| `error`      | Error recovery surface    | 无                   | 否          | 否                       |

`StateRegion` 复用同一 loading/refreshing/background readiness，并额外拥有 Surface 级 `partial/readonly/denied/pending`。业务不能建立第二套相反的 Loading 规则。关键提交确需阻断时由明确的 Operation/Overlay 契约负责，不归普通数据 refresh。

## 5. Host Motion Policy

`MotionPolicyProvider` 是 `matchMedia`、system preference、development override 与 DOM policy attribute 的唯一入口：

- production 的调试策略固定 `System`，不渲染 Inspector，不读取或写入调试偏好。
- development 提供 `System/Full/Reduced/Off`，`Screen/Async/Reveal/Swap/Feedback/Media` 分类开关，以及 `1×/2×/4×` 慢速。
- 调试状态只存 `sessionStorage`；Feature props、业务 Store 与持久配置不得感知它。
- Inspector 的 `Full` 只用于开发检查；正式外观偏好仍按既有 `system/standard/reduced`
  契约参与解析。`system` 跟随 OS，显式 `reduced` 不能被 Inspector 覆盖，显式
  `standard` 使用标准动效。页面不另建 matchMedia 判断。

页面和 Feature 禁止调用 `matchMedia`、创建 `IntersectionObserver`、写入 `data-motion-*` 或手工调用 `startViewTransition`。当前稳定 React 不使用实验性 `<ViewTransition>`；Host 路由与稳定 `contentKey` 分别绑定现役 CSS recipe。

`packages/surface-foundation/src/viewport-reveal.tsx` 是 boundary-policy 已明确登记的
浏览器适配位置，由 Web Host 装配 Provider。这不是允许其它 Surface/Feature 使用
Browser API 的一般豁免。新增平台生命周期仍优先在 Host 或明确 Adapter 承载。

## 6. 组合规则

- Screen Transition 只表达已经进入另一个 Screen，不等待全部数据后整页 reveal。
- Page 自动组合 `ViewportReveal items`，保持原空间骨架，scope 本身不动画。
  `data-reveal-item` 声明独立语义项，`data-reveal-items` 声明直属子项集合；
  含子项的父级不再注册。Section 标题与内容分开，设置字段、阅读 Card/List Item
  分别进入；图标、文字、选项、表格单元格不拆分。`data-reveal-skip` 排除持久导航。
- 首屏按 IO 快照的 top/left 阅读顺序短错峰；后续项在真正进入视口时播放一次。
  Observer root 是正文实际使用的文档视口，零 margin/零比例阈值；Sidebar 不是正文 root。
  MutationObserver 只处理子树结构变化，登记新内容并释放移除节点；不监听属性反馈。
- Reveal 在 SSR、pending、Observer 失败或无回调时默认可见；动画从语义透明度 0.96
  开始，轻上移至稳定位置，避免观察反馈迟到时从完全可见突然归零。
  使用 `--motion-duration-feedback`、`--motion-distance-reveal`、`--motion-opacity-reveal-start`、
  `--motion-delay-reveal-step/max`；默认 180ms、0.5rem、40ms 步进、最多120ms，
  大批项目自动压缩步进，使每项仍有独立延迟且最后一项不超过120ms。
  无定时串行队列，animation fill=backwards，结束不保留 transform。
- Web Host `ScrollRevealRuntime` 单点采样正文 scrollY，向现役 Provider 提供 fast/restored
  判断；单个 passive listener，无每帧 DOM 测量、无滚动时 React 更新。快滚跳过后续项动画；
  已越过区域、首次恢复位置、hash、Reduced/off 和焦点进入直接稳定，反向浏览不重播。
- RouteTransition 仅给非持久 PageHeader 轻量方向/抬升，标题保持不透明，取消页面直接子区段的路由 stagger。
  设置持久 Shell 不动；内容项由视口生命周期拥有，避免父子叠加。原显式单 Region
  ViewportReveal 仍用于真正单一内容单元；禁止用于包含多个独立语义项的大容器。
- 高对比度（含系统 more）将 Reveal 透明度起点设为1；Adapter 的 Dialog、Confirm、Command、Drawer 打开/关闭不做透明度过渡，HeroUI 继续拥有焦点与生命周期。
- Async Region 各自 progressive ready；不得 Wait-all → Reveal-all。
- `refreshing → ready`、`background → ready` 保留同一内容实例，不重播整块进场。
- `TabsView` 的键盘、Selection 和 Focus 仍由 HeroUI 主持，Content Swap 只主持面板视觉切换。
- 初始内容不是内容替换，`ContentSwapTransition` 首次挂载默认稳定；仅 `contentKey`
  改变后播放替换。Tabs 的惰性 Panel 因选择变化挂载时，经 `initialChange` 传递该生命周期，
  首次选择不重复叠加淡入。
- 输入每次击键、筛选请求、表格行和 UI Element 不播放页面级动效。
- Avatar 继续使用 HeroUI Image/Fallback readiness，不嵌套 `ReadyImage`。

## 7. Reduced Motion 与中断安全

`tokens.css` 提供普通元素的全局 reduced/off policy，`surface-foundation/styles.css` 覆盖 View Transition 伪元素。新 recipe 必须同时具备分类关闭和 reduced/off 行为。

自动化必须覆盖：快速 Enter/Exit 反转、refresh 保留内容、background 静默、Observer 注册/注销与 reveal-once、图片 decode/error、键盘 Tabs、路由前进/后退、development policy 恢复、窄屏、Dark、Reduced Motion、Axe 和 Visual。

## 8. 架构门禁

`architecture:check` 拒绝：

- 路由或组件使用 `fallback={null}`。
- Motion 权威文件之外声明 `@keyframes`。
- TSX 硬编码 `duration-N` / `delay-N`。
- Host motion 边界之外使用 `IntersectionObserver` 或 `matchMedia`。
- Feature 写入 `data-motion-*`。

新增动效先识别生命周期并复用上表现役组件。没有现役语义时，先证明真实用例、所有权、中断语义和验证方式；不得以 fade、slide、scale 等实现名称扩展业务 Contract。

## 9. 选择决策树

1. 路由改变 → Host RouteTransition；不包整页 Reveal。
2. 数据首次就绪/刷新/后台更新 → AsyncRegion 或 StateRegion；刷新保留旧内容。
3. 语义内容项首次进入视口 → Page/ViewportReveal items；按内容粒度声明，快滚、恢复与焦点直接稳定。
4. 同一路由替换一个内容域 → ContentSwapTransition，稳定 contentKey；TabsView 已集成。
5. 展开折叠 → Disclosure；浮层 → Adapter/HeroUI Overlay，禁止第二层 Presence。
6. 流内反馈挂载/退出 → FeedbackPresence；Toast 仍由现有 FeedbackController 管理。
7. 控件 Hover/Press/Focus → 控件本身；不以路由或 Reveal 表达操作状态。

判定没有明确生命周期或可用性收益时直接显示，不新建动画抽象。已选用途只能消费
对应 Recipe 与 Motion Policy；页面不自行指定实现名称、时长或缓动。
