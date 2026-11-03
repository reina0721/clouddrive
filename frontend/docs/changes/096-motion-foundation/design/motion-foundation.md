# Motion Foundation 设计（motion-foundation）

## 1. 目标与边界

把"动效"从零散实现升级为两层治理模型，与现有分层架构完全兼容：

- **Motion Foundation（packages/design-system）管"怎么动"**：用途语义 Token（时长/位移）、配方单文件（motion.css）、Reduced Motion Policy、配方登记表。
- **Semantic Transition（Application/Layout 层）管"为什么动/何时动"**：语义容器目录（ScreenTransition 现役；AsyncContent/Disclosure/Feedback/ContentSwap 登记触发条件，用例先行）。

本设计只实现 Foundation 落地与合同条款；**不实例化任何新动画容器**（红线：不得为未来建无消费方抽象，尤其不得建万能动画容器）。

## 2. Motion Foundation（design-system）

### 2.1 用途语义 Token（tokens.css）

保持基础档位 `--motion-duration-fast/standard/slow` 与 `--ease-product` 不变，追加用途语义层（数值零变化）：

```css
:root {
  /* 用途语义：动效按交互用途引用，不按数值引用（权威：docs/motion-foundation.md） */
  --motion-duration-control: var(
    --motion-duration-fast
  ); /* 组件自身状态动效（hover/press/switch/chevron 等） */
  --motion-duration-feedback: var(
    --motion-duration-standard
  ); /* 反馈/异步状态动效（登记消费者=FUTURE FeedbackTransition） */
  --motion-duration-page: var(
    --motion-duration-slow
  ); /* 页面级转场（消费者：motion.css、未来页面容器） */
  --motion-distance-page: 3.75rem; /* 页面转场滑动位移语义 */
}
```

`@theme` 追加：

```css
--default-transition-duration: var(
  --motion-duration-control
); /* 全站未显式 duration 的 transition-* 纳入 control 语义（150ms→120ms） */
--transition-duration-page: var(
  --motion-duration-page
); /* 生成 duration-page utility 供未来页面容器 */
```

拒绝项（无消费方，不预建）：`--motion-duration-overlay`（HeroUI 内部动画不受项目 Token 控制，Overlay 属 Adapter/HeroUI 合同）、enter/exit 缓动（无第二曲线用例）。

### 2.2 配方治理（motion.css）

- 位移 `translateX(±3.75rem)` → `translateX(calc(var(--motion-distance-page) * -1))` / `translateX(var(--motion-distance-page))`；
- 时长引用：退出=fast、进入=standard、滑动=page（集中注释，不散落数值）；
- 文件分节：`/* 1. 页面转场配方 */`、`/* 2. 锚定 */`、`/* 3. Policy：reduced-motion */`、`/* 4. 配方登记表 */`；
- 配方登记表（未来任何新 keyframes/配方必须先登记）：名称 | 语义 | 消费方 | reduced-motion 覆盖。Add 新配方时同步更新本表。

### 2.3 退役 motion.ts

删除 `packages/design-system/src/motion.ts` 与 exports `"./motion"`（无调用方，违反无调用方接口红线）。未来出现 JS 动画需求时，在实现任务中从 tokens.css 语义 Token 导出 JS 常量（单一来源转换 + 单测），不得先建导出再等用例。

## 3. Semantic Transition 容器目录（登记，不实例化）

| 语义容器                              | 生命周期来源                                                 | 消费方/触发条件                                                              | 状态                                           |
| ------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------- | ---------------------------------------------- |
| `PageTransition`（≈ScreenTransition） | Next Link/useRouter `transitionTypes` + React ViewTransition | 16 个路由页面                                                                | 现役；归属调整为 `apps/web/src/layouts/`       |
| `AsyncContentTransition`              | 数据请求状态（initial/refresh/blocking/background）          | reference `sceneMode` 与未来真实数据页迁移                                   | FUTURE：用例出现时实现                         |
| `DisclosureTransition`                | 展开/折叠状态                                                | 折叠面板需求（复用 HeroUI `./disclosure`/`./accordion`，经 ui-adapter 包装） | FUTURE                                         |
| `FeedbackTransition`                  | Toast/Inline Alert 生命周期                                  | FeedbackProvider 强化需求                                                    | FUTURE                                         |
| `ContentSwapTransition`               | Tabs/筛选/同路由内容切换                                     | reference Tabs、筛选联动                                                     | FUTURE（与官方 same-route crossfade 模式对应） |

未来容器实现原则：① 先有真实交互用例与验收；② 不暴露 duration/easing prop（只暴露用途语义或速度档）；③ 动画层与空间层分离（见 §6）；④ 实现时同步进 `/ui-elements` 或文档权威 + 中断测试矩阵（见 §8）；⑤ 需要 JS 生命周期协调（mount/enter/stable/exit/unmount）时，才在同一任务中引入 ui-adapter 的 Presence/Transition 原语（数量 ≤2，只服务语义容器，不直接给业务页）。

## 4. Host 生命周期原则

- 现状已落地：Next（Host/Router）通过 `transitionTypes` 提供导航类型（生命周期信息），`PageTransition`（Layout 层）只消费并映射视觉语义；Host 不写 CSS 动画，Layout 层不依赖 Router 私有实现。
- 选择标准（文档记录）：只要 React `<ViewTransition>` 集成满足需求（无 DOM 污染、自动快照、reduced-motion 友好），不引入手工 `startViewTransition` 协调器；若未来需要共享元素 morph、导航 pending 全局指示等 React 集成未覆盖的能力，才评估"ScreenTransition 协调器 + Host 生命周期事件"形态，且必须先回到研究门禁。

## 5. Reduced Motion Policy（单一实现）

- 常规动画：tokens.css 全局 `@media (prefers-reduced-motion: reduce)` 块（0.01ms、iteration 1）。
- 转场伪元素：motion.css 专属块（同特异性后置，0.01ms）。
- Tailwind 变体：`motion-reduce:`（BusyIndicator/action 等已用）。
- 规则：Feature/Page 不得各自 `matchMedia` 判断；新配方必须进入 policy 覆盖范围才可合入（配方登记表强制项）。
- 策略分级（文档语义）：大位移 → 去掉；缩放 → 去掉/减弱；长时转场 → 缩短；必要状态反馈（loading/进度）→ 保留。

## 6. Layout Contract（动画层与空间层分离）

- 现役 `PageTransition` 无 DOM 外壳（React ViewTransition tag 30），不控制高度/滚动/定位，天然满足；条款固化。
- 未来自研动画容器必须显式分离：`ScreenViewport`（决定空间与滚动）→ `ScreenTransitionLayer`（只做生命周 期与视觉过渡）→ `Screen`（内容）；动画容器不得隐式成为 Layout Wrapper。
- 违反形态（禁止）：transition-container 设置了 position/height/overflow/transform 副作用影响 sticky/fixed/100%/虚拟滚动容器。

## 7. AGENTS.md §4.2 条款（落地文本）

```markdown
### 4.2 Motion 分层与治理

- Motion 属于 Design System 的语义基础能力。Duration、Easing、位移距离、Scale、Opacity 与 Reduced Motion Policy 由 `packages/design-system` 统一定义，页面和 Feature 不得硬编码动画时长、缓动曲线或关键帧参数；业务代码使用用途语义 Token（`--motion-duration-*`、`--motion-distance-*`、`duration-*` utility），不直接书写数值。
- 动效按职责分层：组件自身状态动效由对应 UI Element 管理；Overlay 的 Enter/Exit 生命周期由 `packages/ui-adapter` 与 HeroUI Overlay 能力统一管理，不得在 Modal/Drawer/Popover 外再套动画容器；页面导航动效由 Host 提供导航生命周期、Layout/Semantic Transition 容器消费；异步数据切换由 Loading/Empty/Error/Ready 等产品状态组件管理，不得做成加载动画容器。
- 禁止万能动画容器：不得建立同时承担 Layout、Loading、Presence、Navigation 与 Overlay 的动画 Wrapper；动画容器不得隐式改变页面高度、滚动容器、定位上下文或 Layout Contract（动画层与空间层分离）。
- 页面不得以 `fade`、`slide-left`、`scale-in` 等实现型动画作为长期业务 Contract，应优先使用 `screen`、`overlay`、`feedback`、`disclosure`、`content-swap` 等语义 Transition，由底层映射具体 Motion 实现。
- `prefers-reduced-motion` 必须由 Motion Foundation 统一处理；Feature 与 Page 不得各自实现 Reduced Motion 判断。
```

Motion 主题唯一权威：[docs/motion-foundation.md](../../motion-foundation.md)。

## 8. 验证矩阵（未来 /motion 参考页规格登记）

首个语义容器落地时建立 `/motion` 参考/验证页（不是动画展览馆），必测场景：

1. 快速连续切换、Enter 未完成再次 Exit、Exit 未完成重新 Enter（动画中断）。
2. 长内容/短内容/不同高度间的切换（Layout Contract 验证）。
3. 滚动页面、窄屏、Dark、Reduced Motion。
4. 键盘导航与 nested Overlay 组合。

## 9. 文件影响清单

新增：`docs/motion-foundation.md`、`docs/changes/096-motion-foundation/**`。
修改：`frontend/AGENTS.md`（§4.2）、`frontend/README.md`、`docs/ui-element-system.md` §12、`docs/changes/README.md`、`packages/design-system/src/tokens.css`、`packages/design-system/src/motion.css`、`packages/design-system/package.json`（移除 `./motion`）、16 个 page.tsx 与 3 个 shell/host 文件（import 路径）。
移动：`apps/web/src/host/page-transition.tsx`、`page-transition-constants.ts` → `apps/web/src/layouts/`。
删除：`packages/design-system/src/motion.ts`。
不触碰：ui-adapter、HeroUI、states/reference 行为、webui、用户未提交改动。

## 10. 验证方案

- `pnpm check` 全量（架构/依赖/lint/typecheck/unit/build/performance/browser）；format:check 的两个既有基线例外文件记录在案。
- 浏览器全量回归（transition/navigation/overlays/visual 等，CI=1 全新 server）：数值零变化 → 视觉基线预期零变化。
- 语义检查：业务代码无裸露时长/缓动/位移字面量（motion.css 与 tokens.css 之外的复核）。
- 一致性检查：容器目录与代码现状一致（无幻影）。

## 11. 非目标

不新建任何动画原语/容器实例化；不改 HeroUI 浮层动画；不做旧系统动效迁移；不为展示完整度建 /motion 占位页。
