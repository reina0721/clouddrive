# R096-001 当前动效资产盘点与 Motion Foundation / Semantic Transition 分层映射

## 1. 研究问题与版本边界

研究问题：现有 frontend 架构（design-system → ui-adapter → Application/Feature → Host）应如何把"动效"正式化为两层模型（**Motion Foundation 管"怎么动"**、**Semantic Transition 管"为什么动/什么时候动"**），并落实治理红线：禁止万能动画容器、业务层不得填写动画参数、动画层与空间层分离、Reduced Motion 由底层统一处理。

边界：commit `3b401600`；HeroUI 3.2.4、Tailwind 4.3.3、Next 16.3.3；上一变更 095（页面转场）已落地，本档案在其之上盘点。

## 2. 已核实事实

### 2.1 现有动效资产归属（现状即事实）

| 资产                                                                       | 位置                     | 语义                             | 状态                                                             |
| -------------------------------------------------------------------------- | ------------------------ | -------------------------------- | ---------------------------------------------------------------- |
| `--motion-duration-fast/standard/slow`（120/180/240ms）与 `--ease-product` | design-system tokens.css | 时长/缓动基础档位                | 已有，被 `--transition-duration-*` 与 motion.css 引用            |
| `@theme --transition-duration-*` → `duration-*` utility                    | design-system tokens.css | Tailwind 时长 utility            | 已有（progress-meter 使用 `duration-standard`）                  |
| 全局 `prefers-reduced-motion` 块                                           | design-system tokens.css | 常规动画压到 0.01ms              | 已有；`::view-transition-*` 由 motion.css 专属块覆盖（095）      |
| `motion.css`（nav-forward、锚定、pointer-events、reduced-motion）          | design-system            | 页面转场配方                     | 已有；`translateX(±3.75rem)` 位移为裸值未 token 化               |
| `productMotion`（motion.ts）                                               | design-system            | JS 侧时长/缓动                   | **无任何消费方**（grep 仅定义处命中），exports `./motion` 应退役 |
| `PageTransition` + constants                                               | apps/web/src/host        | 页面级转场语义容器               | 有 16 个页面消费方；归属为"Layout 编排"却位于 Host 基础设施目录  |
| `AppLoadingSurface`                                                        | apps/web/src/host        | 整页加载面（Host 装配）          | 归属正确，保留                                                   |
| `Skeleton`/`BusyIndicator`/spin（`animate-pulse`/`animate-spin`）          | ui-adapter               | 局部异步 primitive               | 归属正确，保留；reduced-motion 已覆盖                            |
| Dialog/Drawer/Menu/Toast 进出场                                            | HeroUI（经 ui-adapter）  | Overlay 动效                     | HeroUI 合同内，禁止项目自研                                      |
| 未显式 duration 的 `transition-*`（hover 等）                              | 全站                     | 组件状态微动效                   | 吃 Tailwind 默认 150ms，未纳入 Token 治理                        |
| `states` 页面 + `reference` 页面 `sceneMode`                               | apps/web                 | Loading/Empty/Error 等产品状态机 | 已有状态语义（无动画切换），是未来 AsyncContent 的真实场景       |

### 2.2 关键外部事实

- HeroUI 3.2.4 `@heroui/react` exports 含 `./accordion`、`./disclosure`、`./disclosure-group`：折叠/展开容量可复用 HeroUI（React Aria Disclosure）经 ui-adapter 包装，**无需自研 Collapse primitive**。
- Tailwind v4 默认主题存在 `--default-transition-duration: 150ms`：可被项目 `@theme` 覆盖，是所有未显式时长 `transition-*` 的统一入口（"control" 用途语义的落地点）。

### 2.3 095 验证结论（沿用）

- React `<ViewTransition>` 不渲染 DOM 外壳（tag 30），对布局零影响：页面转场容器天然满足"动画层不控制空间"。
- 转场类名已语义化（`nav-forward`），时长/缓动只引用 Token。
- reduced-motion 手法：与主规则同特异性、源顺序靠后，不使用 important 声明。
- 验证必须以全新 dev server（CI=1）为准，复用旧 server 会吃到陈旧编译产物。

## 3. 推断（指导 → 本架构映射）

- 【推断】两层模型直接映射现有层：**Motion Foundation = design-system**（Token + 配方 + Policy），**Semantic Transition = Application/Layout 层语义容器**（PageTransition 现役；AsyncContent/Disclosure/Feedback/ContentSwap 登记触发条件），**ui-adapter** 只在"普适交互原语"出现真实用例时增加极小 Motion Primitive 层（Presence/Transition），且数量 ≤2；Overlay 类保持 HeroUI 合同。
- 【推断】用途语义 Token（control/feedback/page 等）应与基础档位并存：档位是数值层，用途层是语义层，页面声明用途不声明参数；无消费方的用途 Token 不适合预建（除非属于"默认值集中声明"且无副作用）。
- 【推断】业务层禁止填写 duration/缓动：现有容器已无 duration prop（PageTransition），未来容器同样只暴露语义层（速度档或用途），由底层映射实现。
- 【推断】"页面转场不控制页面高度"：除 ViewTransition 天然满足外，未来任何自研动画容器（如手工 `startViewTransition` 协调器）必须遵守动画层/空间层（ScreenViewport/ScreenTransitionLayer/Screen）分离，写入合同条款。
- 【推断】Loading 是产品状态问题：`AsyncContentTransition` 不应是"LoadingAnimationContainer"，而是状态边界（initial/refresh/blocking/background）+ 状态切换过渡的语义容器，消费方存在时才实现。
- 【推断】Reduced Motion 是架构能力：单一实现（tokens.css 全局块 + motion.css 转场块 + Tailwind `motion-reduce:` 变体），Feature/Page 不得各自 `matchMedia`。
- 【推断】Host 提供生命周期：Next 通过 `transitionTypes` 把导航类型交给 React ViewTransition，Host/Router 是生命周期信息源，Layout 层容器只消费；该模式已在 095 落地；若未来放弃 React 集成改手工 `startViewTransition`，才需要"协调器"形态，文档记录选择标准。

## 4. 对本变更（096）的强制影响

1. tokens.css 增加用途语义 Token（数值不变）、`--default-transition-duration` 指向 control 语义、`--motion-distance-page` 供 motion.css 引用；反馈/控制/页面语义与消费方需在文档登记表中注明，无消费方的不得预建（feedback 例外以"默认值集中声明"登记）。
2. motion.css 位移与时长统一引用语义 Token，分节 + 配方登记表；未来所有 CSS 动效配方单文件治理。
3. 退役 `motion.ts` 与 `./motion` 导出；未来 JS 动画时长在实现任务中从 tokens 语义导出并接线单测。
4. `PageTransition` 移入 `apps/web/src/layouts/`（Layout 编排归属），行为不变。
5. AGENTS.md 增加 §4.2 条款；`docs/motion-foundation.md` 成为 Motion 主题唯一权威（含容器目录与触发条件、Reduced Motion Policy、Layout Contract、验证矩阵）。
6. 不新增任何动画容器实例化；Presence/Transition/Disclosure/AsyncContent 全部登记触发条件，用例先行。
7. 验证以 CI=1 全新 server 为准；本变更数值不变，视觉/性能基线预期零变化。

## 5. 局限与刷新

- 本档案盘点的是 commit `3b401600` 的静态现状；运行时观感（150→120ms 默认过渡、disclosure 将来动画）需人工核验与浏览器实测。
- HeroUI disclosure/accordion 仅为"存在"事实，未实测其动画与可访问细节；落地任务需官方复核（按 AGENTS 4.1 基线）。
- Tailwind `--default-transition-duration` 覆盖为全局行为变更（150→120ms），影响面为全部未显式时长的过渡，属于可评审的产品化微调。
- 依赖升级、语义容器首个用例、第二个 Host 出现时按 metadata refresh_triggers 刷新。
