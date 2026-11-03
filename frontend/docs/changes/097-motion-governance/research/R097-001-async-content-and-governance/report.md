# R097-001 三层 Motion 模型与异步内容切换（AsyncRegion）契约参数

## 1. 研究问题与版本边界

研究问题：现有 frontend 架构应如何把动效治理升级为 **Policy + Recipe + Semantic Component** 三层，并落地 Async Content Transition（Loading→Skeleton→crossfade→Ready）解决"数据 Ready 但内容突然出现"；AsyncRegion 的消费方、契约参数与验证要求是什么？

边界：commit `86697e24`（096 落地后）；HeroUI 3.2.4、Tailwind 4.3.3、Next 16.3.3。

## 2. 已核实事实

### 2.1 消费方：reference 页面 sceneMode 状态机

- `apps/web/src/app/reference/page.tsx` 已实现 `SceneMode = ready | loading | empty | partial-error | offline | permission`，当前为整块条件渲染（loading→8×Skeleton；empty→StateSurface；offline/permission→StateSurface+恢复动作；partial-error→顶部告警+表格共存；ready→SplitView/表格），**状态切换无过渡动画**。
- e2e 断言（`reference.spec.ts`）：`'部分指标不可用'`、`'离线快照可用'`、grid 可见、恢复正常场景按钮；这些断言在迁移后必须保持。
- 096 FUTURE-096-003 登记触发条件：reference `sceneMode` 迁移 → **本轮即为该触发条件的执行**。

### 2.2 现成原语（ui-adapter）

- `Skeleton`（animate-pulse、aria-hidden）。
- `StateSurface`（ProductState 全状态：loading/empty/error/success/warning/disabled/pending/offline/permission-denied；icon/title/description/compact/announcement/可选恢复动作）。
- 子路径导出机制（`./skeleton`、`./state-surface` 等）——新组件 `./async-region` 同机制。

### 2.3 治理现状（096 落地）

- tokens.css：用途语义 Token（control/feedback/page）+ `--motion-distance-page: 3.75rem` + Tailwind 默认时长归 control。
- motion.css：页面转场配方（screen.enter/screen.exit 的实质）+ 配方登记表 + reduced-motion 块。
- docs/motion-foundation.md：两层模型、容器目录、Policy、Layout Contract。
- AGENTS.md §4.2：5 条底线（Token 单源、分层职责、禁万能容器、语义优先、reduced-motion 统一）。

### 2.4 关键语义事实

- "数据是否 Ready"与"是否进入视口"是两个独立维度：IntersectionObserver 只回答 visible，不回答 ready；**解决"网络慢时内容突然出现"的组件是 Async Content Transition，不是 ViewportReveal**。
- 后台场景的 ViewportReveal 应为 reveal-once（进入过视口后保持正常，不随离开/重进重播）——当前无 below-fold 长内容消费方，不实现。
- 页面转场只负责 Screen→Screen 的 continuity，不承载数据加载语义（当前 PageTransition 无 DOM、无数据感知，符合）。
- 轻转场定位：用户指导建议页面转场为 opacity + 极小位移；实施中把 `--motion-distance-page` 从 3.75rem（60px）调整为 1rem（16px）试点，后因本机 `visual.spec` 移动端溢出用例与运行时序耦合（probe 证实变量实时切换不影响布局；HEAD 与回退 3.75rem 均稳定通过）回退为 3.75rem，轻转场登记 FUTURE-097-007。

## 3. 推断（契约参数）

- 【推断】AsyncRegion 契约：`state: 'loading'|'error'|'empty'|'ready'` + `label`（aria-label）+ `children`（ready 内容，始终渲染、非 ready 时 hidden）+ `loading/error/empty` 层（调用方组合 Skeleton/StateSurface）。不暴露 duration/easing；只做 enter 主持；`aria-busy` 由容器在 loading 态施加（与 states 页模式一致）。
- 【推断】enter 主持实现：纯 CSS（data-state 容器 + content.enter 配方，keyframes fade + 0.5rem rise），display 恢复重触发动画；旧层 exit 主持（双渲染/计时）属于未来 Presence primitive 职责，登记不实现。
- 【推断】partial-error 是"内容存在 + 顶部告警"语义，归 AsyncRegion 之外（state=ready + alert 共存），不强行并入 error 态。
- 【推断】AsyncRegion 归属 ui-adapter 且为组合型 Pattern（组合 StateSurface/Skeleton），不进 `/ui-elements` 39 个 Element 计数；其权威载体 = reference（Pattern Reference）+ states（状态体系）。
- 【推断】Recipe 层：Token（原料）→ Recipe（语义行为，motion.css 配方块标注 recipe 名）→ Semantic Component（绑定固定 recipe）；Feature 不选择 recipe，防止 `<Card motion="screen">` 式混乱。

## 4. 对本变更（097）的强制影响

1. docs/motion-foundation.md 升级：三层 Motion 模型、Motion Region、Recipe 概念、两层 Policy（用户环境 + Developer Override/Inspector 规格）、Motion 决策树、Async Content 规范（四语义 + 资源独立 Ready）、克制清单（Anti-patterns）、视觉层级示例。
2. AGENTS.md §4.2 增补"新增动效先走 Motion 决策树"条目。
3. tokens.css：`--motion-distance-page` 保持 3.75rem（轻转场 1rem 尝试回退，见 tasks 附注）；新增 `--motion-distance-reveal: 0.5rem`（content.enter 消费）。
4. motion.css：content.enter 配方（普通元素进场）+ recipe 命名标注 + reduced-motion 覆盖。
5. ui-adapter：`async-region.tsx` + `./async-region` 导出。
6. reference 页面 sceneMode 分支迁移到 AsyncRegion（保持 e2e 断言）。
7. 新增 async-region e2e（loading→ready 动画名断言、reduced-motion、中断、aria）。
8. 不实现：ViewportReveal/InView、Motion Inspector、ContentSwap、Presence、图片 ImageReady（登记触发条件）。

## 5. 局限与刷新

- AsyncRegion 当前消费方是确定性场景数据；真实网络数据接入后的中断/错误语义需按研究门禁重验（metadata refresh_triggers）。
- content.enter 配方与 recipe 命名规范为项目自建语义，未来若引入动画库（Framer/Motion One）需按 AGENTS 4.1 在 ui-adapter 边界内复核。
- 轻转场（1rem）试点已回退为 3.75rem，回退原因与本机溢出用例时序证据见 tasks 附注与上文 §2；重新评估列入 FUTURE-097-007。
- 依赖升级、新消费方页出现、第二 Host 出现时刷新本档案。
