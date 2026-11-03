# 动效系统设计（motion-system）

## 1. 目标与边界

实现路由级页面转场与动效分层，凭动效语言区分 Shell / 页面 / 层内状态 / 浮层四级层级，明确方向语义与语义色彩边界，并保证弱动效豁免与预算不回归。

本设计只负责 L1 路由转场与 L0 锚定；L2 层内状态、L3 浮层保持既有契约（HeroUI / ui-element-system §10），不做组件级 Opacity 动画。

## 2. 四级层级模型

| 层级        | 内容                              | 动效行为                                                                                       | 归属                                        |
| ----------- | --------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------- |
| L0 Shell    | Header、桌面侧栏（app-shell.tsx） | 导航转场中绝对静止（空间参照）；自身状态变化沿用现有 transition-colors/transform               | `viewTransitionName` 锚定 + motion.css 抑制 |
| L1 路由页面 | 15 个 page.tsx 内容               | `nav-forward` 方向滑动；无类型淡入淡出；旧退场 120ms、新进入 180ms（延迟至退场后）、滑动 240ms | PageTransition 包裹 + motion.css            |
| L2 层内状态 | Tabs、选中、Loading↔内容          | 现状不动（HeroUI/§10）                                                                         | —                                           |
| L3 浮层     | Dialog/Drawer/Popover/Command     | 现状不动（HeroUI Overlay 契约、z-index-overlay）                                               | —                                           |

## 3. 方向语义与视觉直觉

- `nav-forward`：进入更深信息层级（侧栏叶子、分支默认链接、命令菜单选中、账户菜单、页内 CTA）。旧内容左移 60px 退出，新内容自右 60px 进入；位移 ≤60px、总时长 ~360ms，离开快进入缓（旧内容不争夺注意力，新内容可从容落位）。
- 无类型导航（浏览器后退/前进 popstate、hydration/Suspense reveal、`router.replace` 重定向）：不应用任何转场样式、瞬时切换，不伪造方向。实测 popstate 后退不启动 View Transition（官方行为）；reveal 拆帧时新内容瞬时呈现。
- 转场期间 `::view-transition { pointer-events: none }`，快照层不吞点击；锚定元素（header/sidebar）的组在快照树内置于上层，保证滑动内容从下方经过。
- 当前不存在“返回上一级”入口，不实现 nav-back；未来引入真实返回入口时按研究档案 refresh trigger 补齐（同一套 motion.css 扩展，不在本次范围）。

## 4. 语义色彩与时长映射（Token 单源）

- 动画仅含 transform/opacity，无中间色、无新色板；色彩语义（brand 激活态、success/warning/danger/info 状态色、surface/scrim 层级色）继续由 `tokens.css` 单源。
- 时长全部引用 `--motion-duration-fast/standard/slow`（120/180/240ms），缓动引用 `--ease-product`；不新增时长 Token（240ms 内完成滑动在工具台密度下足够可感知）。

## 5. 样式结构（packages/design-system/src/motion.css）

`motion.css` 随 design-system 导出（package.json exports 增加 `./motion.css`），apps/web 在 tokens.css 之后导入。内容：

```css
/* keyframes：page-fade-in/out（opacity-only）与 page-slide-in/out（translateX(±60px)）共用 */
::view-transition-old(.nav-forward) {
  /* exit 120ms 左移快速退场 */
}
::view-transition-new(.nav-forward) {
  /* enter 180ms 淡入 + 240ms 右入滑动 */
}
::view-transition-group(app-header),
::view-transition-group(app-sidebar) {
  animation: none; /* 快照树内 z 序 */
}
::view-transition-old(app-header),
::view-transition-old(app-sidebar) {
  display: none;
}
::view-transition-new(app-header),
::view-transition-new(app-sidebar) {
  animation: none;
}
::view-transition {
  pointer-events: none;
}
@media (prefers-reduced-motion: reduce) {
  /* 与主规则同特异性的后置选择器，把 ::view-transition-old/new/group(.nav-forward) 时长压到 0.01ms；不使用 important 声明 */
}
```

要点：

- 伪元素组的 `z-index` 只存在于 `::view-transition` 快照树的堆叠上下文（浏览器 API 内部），不是页面堆叠上下文，不冲击 `--z-index-*` 语义；注释说明。
- 锚定元素的 `viewTransitionName` 由 React 侧以 inline style 设置（与官方配方一致）。
- reduced-motion 块靠“同特异性 + 源顺序靠后”生效，与 tokens.css 既有 `0.01ms` 手法一致，遵守禁止 `!important` 的红线。

## 6. React 结构（apps/web）

### 6.1 类型补齐

`apps/web/src/types/react-view-transition.d.ts` 一行：

```ts
import type {} from 'react/canary';
```

激活 `@types/react` canary 的 `ViewTransition` 模块增强；`verbatimModuleSyntax` 下 type-only import 不产生运行时代码。Next 的 `Link.transitionTypes` 与 `router.push` options 类型已内置，无需补齐。

### 6.2 常量与页面包裹组件

类名/类型常量独立于组件文件（`apps/web/src/host/page-transition-constants.ts`），避免破坏 Fast Refresh 的组件文件导出约束：

```ts
export const pageTransitionTypes = { forward: 'nav-forward' } as const;
export const forwardTransitionClasses = {
  default: 'none',
  'nav-forward': pageTransitionTypes.forward,
} as const;
```

`apps/web/src/host/page-transition.tsx`（'use client'，只导出组件）：

```tsx
export function PageTransition({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <ViewTransition default="none" enter={forwardTransitionClasses} exit={forwardTransitionClasses}>
      {children}
    </ViewTransition>
  );
}
```

      exit={forwardTransitionClasses}
    >
      {children}
    </ViewTransition>

);
}

```

行为（R095-001 §2.3）：带 `nav-forward` 类型的导航 ⇒ 元素 class 只为 `nav-forward` 并播放方向滑动；无类型提交（hydration/Suspense reveal、popstate 后退等）⇒ class 解析为 `none`，不应用任何转场样式、瞬时切换。组件不渲染 DOM，对布局零影响，可安全包在 server/client 页面根节点。

### 6.3 应用位置

- 包裹（16 处）：`app/page.tsx`、`foundations`、`preferences`、`reference`、`reference/form`、`states`、9 个 `ui-elements/*/page.tsx`（包住既有 `Suspense`）、`not-found.tsx`。
- 不包裹：`app/layout.tsx`（Layout 跨导航持久，enter/exit 不触发）、`app/ui-elements/page.tsx`（瞬时重定向页，避免加载面演出）。
- 类型标记 `transitionTypes={['nav-forward']}`：`shell/navigation-tree.tsx`（展开叶子 Link、分支默认链接、紧凑叶子 Link）、`shell/app-shell.tsx`（CommandMenu 与 MenuButton 的 `router.push(href, { transitionTypes: ['nav-forward'] })`）、`host/router-text-link.tsx`。
- 锚定：`shell/app-shell.tsx` header `viewTransitionName: 'app-header'`、桌面 `aside` `viewTransitionName: 'app-sidebar'`；移动端侧栏条件渲染不参与锚定。

## 7. 数据与控制流、资源与生命周期

- 控制流：Link/router 导航携带 `transitionTypes` → React Transition 启动 → 浏览器 `startViewTransition` → React 为参与子树设置临时 inline 样式 → 快照与动画 → 结束后 React `restoreViewTransitionName` 还原，无持久 DOM 污染。
- 资源所有权：无新资源、无新运行时依赖；样式由 design-system 包维护，Host 只导入。
- 失败语义：浏览器不支持 View Transitions/transition types 时自动降级为瞬时切换（功能不变）；转场中再次导航由浏览器中断旧转场并回退，React 保证样式还原；转场快照层 `pointer-events: none` 避免丢点击。
- 并发：转场与 `router.push/replace`、重定向、命令菜单打开态互不阻塞；动态效果设置变化（主题/密度/语言）不触发转场。实测（e2e，2026-09-12）：上一次转场动画结束前立刻发起下一次导航（如快速后退），浏览器/React 尚持有上一次导航的转场类型上下文，新导航会沿用 `nav-forward` 类表现为滑动收尾；转场完全结束后后退则按官方行为瞬时切换。该竞态窗口仅约 360ms，不改变功能与可访问性，不新增抑制逻辑。

## 8. 错误与可访问性

- 无 aria 变更：转场是浏览器快照层的视觉效果；焦点管理归 Next/HeroUI 既有契约。
- reduced-motion：全局压低所有转场动画时长为 0.01ms 且无位移；`motion-reduce` 已有组件（BusyIndicator 等）不动。

## 9. 验证方案

- 单元：不新增 vitest（路由页不在单测渲染范围；jsdom 无 View Transitions API，转场行为归 e2e）。
- e2e（`apps/web/e2e/transition.spec.ts`）：
  1. 前进滑动（无 Suspense 页面）：`goto '/'`，页内启动 rAF watcher（轮询 `document.getAnimations()`，`effect.pseudoElement` 含 `view-transition`，记录动画名与最大时长）→ 侧栏进入 `foundations` → 断言 `page-slide-in/out` 且最大时长 ≥200ms；
  2. Family 页导航：Suspense/useSearchParams 可能把导航拆成多次提交，方向滑动可能整体不播放（官方行为）；断言导航功能正确且观察到的动画时长 ≤500ms；
  3. reduced-motion：`emulateMedia({ reducedMotion: 'reduce' })` 同流程，断言最大时长 <50ms；
  4. 浏览器后退：返回后页面状态正确且绝无 `page-slide-*` 方向滑动（popstate 不携带类型，官方行为为瞬时切换）；后退前等待上一转场结束（快速连发时上下文未释放会沿用滑动类）；
  5. 收尾还原：转场后 `main` 及其子元素无残留 `style.viewTransitionName`。
- 回归：navigation/overlays/visual/data-display/preferences/states e2e 全绿；视觉基线预计不变（截图前均为全量加载），如有个别截图因动画快照残留变化，人工确认后按既有流程更新基线。实测发现并修复一处锚定竞态：转场组件改变提交时序后，点击首屏之外的 DatePicker 触发器（`/ui-elements/forms`）偶发触发滚动定位竞态（弹层落点相差约 430px）；`overlays.spec` 该用例改为先 `scrollIntoViewIfNeeded` 再点击，锚定测量确定化（对照实验 8/8 稳定，无包裹基线 8/8 稳定）。
- 门禁：`pnpm check` 全量；全新 `pnpm build` 后记录 CSS gzip 基线（预算 48 KiB，现引用 CSS 44,056 B gzip，增量约 1 KB）；Reference 大页面转场用 Chromium DevTools 核对无长任务（≤360ms 窗口内完成）。
- 人工核对：方向感、锚定、触发时机、Dark/light 一致性与观感强度，作为完成评审输入。

## 10. 文件影响清单

新增：`packages/design-system/src/motion.css`、`apps/web/src/types/react-view-transition.d.ts`、`apps/web/src/host/page-transition.tsx`、`apps/web/src/host/page-transition-constants.ts`、`apps/web/e2e/transition.spec.ts`、`docs/changes/095-page-transitions-and-motion/**`。

修改：

- `packages/design-system/package.json`（exports 增加 `./motion.css`）
- `apps/web/src/styles.css`（导入 motion.css）
- `apps/web/src/app/*/page.tsx` ×16（包裹 PageTransition，ui-elements 重定向页与 layout 除外）
- `apps/web/src/shell/navigation-tree.tsx`、`apps/web/src/shell/app-shell.tsx`、`apps/web/src/host/router-text-link.tsx`（类型标记与锚定）
- `apps/web/e2e/overlays.spec.ts`（DatePicker 用例点击前预滚动，消除锚定竞态）
- `frontend/README.md`、`docs/ui-element-system.md`、`docs/changes/README.md`（权威文档同步）

## 11. 非目标（明确不做）

不引入动画库/新依赖；不改 HeroUI 浮层动画与 z-index 契约；不做组件级文字透明度动画；不新增时长或颜色 Token；不引入 nav-back 方向语义（无真实返回入口）。
```
