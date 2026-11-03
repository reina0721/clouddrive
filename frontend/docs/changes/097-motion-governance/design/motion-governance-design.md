# Motion Governance 与 AsyncRegion 设计（motion-governance-design）

## 1. 目标与边界

- 治理体系：把动效决策收敛为 **Policy → Recipe → Semantic Component** 三层；权威文档（docs/motion-foundation.md）升级为完整 Governance 规范。
- 能力落地：`AsyncRegion` 语义组件（Async Content Transition 层），解决"数据 Ready 但内容突然出现"。
- 观感收尝试与回退：页面转场轻量化（1rem）试点后因本地环境溢出用例时序问题回退，保持 3.75rem（回退证据见 tasks 附注）；轻转场作为 FUTURE 评估项保留。
- 边界：不实现 ViewportReveal/InView、Motion Inspector、ContentSwap、Presence（登记触发条件）；不改 Overlay 动效；不进 `/ui-elements` 39 计数。

## 2. 权威文档升级内容（docs/motion-foundation.md 新增/修订章节）

1. **三层 Motion 模型**：Screen Transition（Navigation continuity，轻强度）/ Viewport Reveal（Spatial discovery，once）/ Async Content Transition（Data readiness continuity）；生命周期来源与职责表格；可作用于同一 Section 但必须是不同组件；视觉层级示例（Navigation → 轻 Screen Transition → Page Shell 立即稳定 → Above-fold 立即呈现 → Below-fold 首次进入 Reveal-once → 区域内 AsyncContent）。
2. **Motion Region**：只有视觉完整性区块参与页面级 Reveal；禁止逐 Element/逐行；stagger 仅限 3–6 个同类卡片且克制。
3. **Motion Recipe 层**：Token（原料）→ Recipe（语义行为，motion.css 配方块标注 `recipe:` 命名，如 screen.enter/screen.exit/content.enter）→ Semantic Component（内部绑定固定 recipe）；Feature 不选择 Recipe。
4. **Motion Policy 两层模型**：User Environment Policy（prefers-reduced-motion 分级策略，单一实现）+ Developer Override（Motion Inspector 规格：Mode System/Full/Reduced/Off、分项开关 Screen/Reveal/Async/Overlay、Slow Motion 1×/2×/4×；注入点 AppShell/MotionPolicy context；不进业务 props；生产默认 system）；Inspector 实现登记触发条件（≥2 个 Motion 类别共存时）。
5. **Motion 决策树**：新增动效先回答"变化来自什么生命周期"（Route→ScreenTransition / Async state→AsyncRegion / First viewport→ViewportReveal(FUTURE) / Mount→Presence(FUTURE) / Disclosure→Disclosure(FUTURE,HeroUI) / Overlay→Adapter 内部 / Feedback→Feedback 组件 / Interaction→组件自身），再实现。
6. **Async Content 规范**：initial/refresh/blocking/background 四语义（refresh 保留内容+Pending 指示，禁止整块消失换 Skeleton）；"是否可见"与"数据是否 Ready"独立；大资源（图片）独立 Ready 生命周期（reserved layout/placeholder/decode/crossfade），容器不承担资源 loading。
7. **克制清单（Anti-patterns）**：列表/表格逐行弹入、视口 presence 重播、每个 UI Element 套动画、Wait-all→Reveal-all、Overlay 外再套动画容器。
8. **本章节对应的当前实现引用**：三层模型中 Screen 层=PageTransition（现役）、Async 层=AsyncRegion（本变更落地）、Viewport 层=登记。

## 3. design-system

- `tokens.css`：`--motion-distance-page` 保持 3.75rem（轻转场 1rem 尝试回退，见 tasks 附注）；新增 `--motion-distance-reveal: 0.5rem`（content.enter 消费方）。
- `motion.css`：新增 **content.enter 配方**（`recipe: content.enter`）：

```css
@keyframes content-fade-in {
  from {
    opacity: 0;
  }
}
@keyframes content-rise-in {
  from {
    transform: translateY(var(--motion-distance-reveal));
  }
}
/* 应用：.ui-async-region[data-state='ready'] 下的内容层播放 */
```

时长引用 `--motion-duration-standard`、缓动 `--ease-product`；reduced-motion 块新增 content 规则（0.01ms）；配方登记表新增行。既有页面转场配方块标注 `recipe: screen.enter/screen.exit`。

## 4. AsyncRegion（packages/ui-adapter/src/async-region.tsx）

```tsx
type AsyncRegionState = 'loading' | 'error' | 'empty' | 'ready';

type AsyncRegionProps = Readonly<{
  state: AsyncRegionState;
  label: string; // 容器 aria-label（辅助技术可见）
  children: ReactNode; // ready 内容：始终渲染；非 ready 时 hidden（保留 DOM 结构）
  loading: ReactNode; // loading 层（调用方组合 Skeleton）
  error?: ReactNode; // error 层（StateSurface 组合）
  empty?: ReactNode; // empty 层
}>;
```

行为：

- 容器 `data-state={state}` + `role="region"` + `aria-label={label}`；loading 态 `aria-busy="true"`。
- loading/error/empty 层条件渲染（仅对应 state 渲染）；children 层 `state==='ready'` 时显示并触发 content.enter 动画（每次非 ready→ready 重放）。
- 不暴露 duration/easing/动画名；不做旧层 exit 主持（Presence 未来职责，登记）。
- 无 HeroUI 依赖（纯组合），与 Skeleton/StateSurface 同级。

## 5. reference 页面迁移（apps/web/src/app/reference/page.tsx）

- loading → `state="loading"` + loading 层（现有 8×Skeleton）。
- empty → `state="empty"` + StateSurface empty（保留清空筛选动作）。
- offline/permission → `state="error"` + StateSurface offline/permission-denied（保留恢复动作）。
- partial-error → `state="ready"` + 现有顶部告警保持（alert 与数据共存）。
- ready → children（SplitView/表格等现有内容）。
- e2e 既有断言不变（'部分指标不可用'/'离线快照可用'/grid 可见/恢复正常场景）。

## 6. 验证方案

- 新增 `apps/web/e2e/async-region.spec.ts`：
  1. loading→ready 播放 content.enter 动画（复用转场 watcher 手法，断言 `content-fade-in`/`content-rise-in` 之一出现）；
  2. reduced-motion（emulateMedia）下无位移动画（时长 <50ms 或无动画）；
  3. 快速 state 切换（ready→loading→ready）后无动画残留、`data-state` 正确、无临时样式残留；
  4. aria：loading 态 `aria-busy` 与 region 语义。
- reference.spec 既有断言保持通过。
- `pnpm check` 全量（format:check 两个既有基线例外记录在案）；CI=1 全新 server。
- `--motion-distance-page` 变更：e2e 只断言动画名与时长（不断言位移），转场快照不在视觉基线 → 基线零变化预期。

## 7. 文件影响清单

新增：`packages/ui-adapter/src/async-region.tsx`、`apps/web/e2e/async-region.spec.ts`、`docs/changes/097-motion-governance/**`。
修改：`docs/motion-foundation.md`、`frontend/AGENTS.md` §4.2、`packages/design-system/src/tokens.css`、`packages/design-system/src/motion.css`、`packages/ui-adapter/package.json`（`./async-region`）、`apps/web/src/app/reference/page.tsx`、`frontend/README.md`、`docs/ui-element-system.md`、`docs/changes/README.md`。
不触碰：ui-adapter 既有组件、HeroUI、states 页面行为、webui、用户未提交改动。

## 8. 非目标

不实现 ViewportReveal、InView、Motion Inspector、ContentSwap、Presence、图片 ImageReady；不改 Overlay 动效；不做 Wait-all→Reveal-all 式整页加载动画。
