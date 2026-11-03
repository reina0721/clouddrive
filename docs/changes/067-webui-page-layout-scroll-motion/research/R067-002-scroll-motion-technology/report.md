# R067-002 滚动与动效能力的技术选型与承载边界

## 研究问题

为 WebUI 实现一组滚动/动效体验能力与派生配置设置，确定技术选型与承载边界：

1. 阻尼平滑滚动：Lenis 是否值得引入？在何处封装？
2. 弹入响应：采用动画库还是平台自研？与 059「不引入动画库」边界如何共存？
3. 磁吸吸附、显式滚动场景劫持、边缘阻尼、页面滚动条稳定插槽各自的实现载体；
4. 派生配置设置如何落到既有 ThemePreferences/ThemeDrawer，并与 reduced-motion 统一降级。

## 方法与范围

- 外部证据：Lenis 官方文档/仓库快照（2026-08-25）、npm registry 版本（`pnpm view lenis version` → 1.3.26）、替代方案维护状态；
- 内部证据：既有 `motion.ts`/`theme.ts`/`styles.css` token 与 reduced-motion 决策、宿主 `.page-viewport` 滚动容器结构、平台样式 authority 与 lint 约束；
- 判定标准对齐 `docs/architecture/technology-selection.md` 决策原则（功能覆盖、维护活跃度、许可证、安全、生产采用、API 稳定性、生态、扩展、替换成本）与 3.2「成熟技术优先 + 边界封装」。

## 候选对比：阻尼平滑滚动

### Lenis（推荐引入）

- 功能覆盖：smoothWheel 平滑滚轮、`wrapper`/`content`（元素滚动容器，匹配本项目工作区滚动模型）、`syncTouch: false` 保留触控原生惯性、`classes` 状态类、`duration`/`easing`（阻尼档位派生）、`stop/start/destroy`、`reducedMotion` 内建、`scrollTo`、`anchors`。
- 维护/采用：darkroom.engineering 持续维护；当前 Smooth Scroll 事实标准之一，生产采用面广；npm 1.3.x 稳定；MIT。
- 边界封装：按 3.2 原则在 `webui/src/scroll/smooth-scroll.ts` 建立项目自有窄契约 `SmoothScrollController`（构造注入 Lenis 工厂 → 可测试；对外只暴露 mount/settings/destroy/scrollTo），不把 Lenis 类型泄漏到模块。

### 替代方案（不引入）

- `smooth-scrollbar`：维护放缓、API 较旧、样式侵入更强。
- `locomotive-scroll`：维护放缓、捆绑偏重、与现代 React 集成成本高。
- 自研 rAF 平滑滚动：可行但重复造轮子；Lenis 已覆盖轮子且被 3.2 判定为成熟方案，自研需举证候选不适用——证据不足。

### 与 reduced-motion 共存

`data-motion=reduce` 或用户关闭「阻尼平滑滚动」时，控制器销毁 Lenis、回退原生滚动（不静默降级到另一套实现之外——降级就是浏览器原生滚动，语义明确、可观测）。

## 候选对比：弹入响应

- 引入动画库（framer-motion/motion）被 059 明确否定（「不引入 Tailwind/动画库」，平台自研原语 + APG 对齐为单轨）；本变更不推翻该决策。
- 方案：平台自研 `Reveal`/`RevealList`（`webui/src/motion/`）：IntersectionObserver 触发视口可见性 → CSS transition 弹入；节奏（calm/balanced/playful）映射 `--reveal-*` token（duration/ease/offset）；列表 stagger 由 index 派生 delay。reduced-motion 或关闭时直接渲染可见态（无过渡）。
- 该方案与 059「以平台 token + 自研原语为准」完全一致，且可单测（无 IO 时回退可见、delay/rhythm 纯函数）。

## 其余能力载体

- **页面滚动条稳定插槽**：CSS `scrollbar-gutter: stable`（现代浏览器支持，Windows 经典滚动条下预留下插槽、不挤压布局；overlay 滚动条由浏览器忽略 gutter）——平台 `styles.css` 能力，默认开启，`overlay` 档切换 `scrollbar-gutter: auto`。
- **磁吸吸附**：CSS `scroll-snap-type/scroll-snap-align` 驱动声明 `data-snap-x` 的横向滚动区（如页签轨、表格包装），平台提供开关类应用。
- **显式滚动场景劫持**：平台小工具 `ScrollHijack`（`data-scroll-hijack="x"`）：元素内滚轮 deltaY → scrollLeft，preventDefault，不干扰 Lenis；用于表格横向溢出场景。
- **边缘阻尼/橡皮筋**：纯函数 `computeEdgeBand(deltaY, scrollTop, maxScroll)`（单测守护）→ 边界命中时对 `.page-flow` 施加受瞬态 transform（CSS 变量 `--edge-band-offset`）+ 强调 easing 回弹 + 边缘辉光；`overscroll-behavior: contain` 兜底。

## 派生配置设置（承载）

- 扩展 `ThemePreferences` 增加 `experience` 组：`smoothScroll`、`damping`（subtle/standard/relaxed）、`edgeDamping`、`magneticSnap`、`scrollHijack`、`reveal`、`revealRhythm`（calm/balanced/playful）、`scrollbar`（stable/overlay）；默认按需求：`stable` 插槽、平滑滚动开、standard 阻尼、边缘阻尼开、reveal 开、balanced 节奏。
- `applyTheme` 把 experience 项落到 `<html data-experience-*>`，样式与运行时统一消费；旧 localStorage 主题经 `readTheme` 迁移补默认值；ThemeDrawer 新增「体验」面板。
- reduced-motion：`data-motion=reduce` 时 CSS 动画近零 + 运行时销毁 Lenis/停用橡皮筋与劫持、Reveal 立即可见——与 059 决策一致。

## 事实与推断的区分

**事实**：Lenis 1.3.26 在 registry 可解析；宿主滚动容器是 `.page-viewport`（overflow:auto）；既有 theme 有 reduceMotion 与 `data-motion` 降级；lint/文档要求模块只依赖 `@webui/sdk/*`；059 否定动画库。

**推断**：以 `wrapper=.page-viewport` + `content=.page-flow` 挂 Lenis 可行（沿 Lenis 文档的 element wrapper 用法）；rubber band 用瞬态 transform 不会与 Lenis 滚动冲突（只发生在边界且 Lenis 在边界不增长 scroll 值）；`scrollbar-gutter` 满足「稳定插槽、预留右侧、避免 Windows 实体滚动条挤压布局」的需求语义。

## 适用与不适用场景

- 适用：全部业务页面（app layout）与 blank layout 的平滑滚动；平台级派生配置；表格横向劫持；页签轨磁吸。
- 不适用：把 Lenis 或 Reveal 暴露给模块直接使用（模块只消费 `@webui/sdk/ui` 的平台组件与自身能力）；组件级逐帧动画（进一步扩库）。

## 局限与剩余未知

- 未做原型性能测量；Lenis 对滚动容器采用 element wrapper 的边界行为在真机浏览器验证阶段复核。
- `scrollbar-gutter` 兼容性以现代 Chromium/WebKit/Firefox 为主，旧浏览器无 gutter 回归到无预留（不破坏布局，仅回到现状）。

## 对本任务的影响

- 新增依赖 `lenis`（package.json），并在 `docs/architecture/technology-selection.md` 记录引入结论；
- 平台新增 `webui/src/scroll/*` 运行时与 `webui/src/motion/*` 弹入原语；样式 authority 扩展 token 与分区；
- ThemePreferences/ThemeDrawer/登录/双语言 locale 同步扩展；E2E 增加体验规格与截图证据。