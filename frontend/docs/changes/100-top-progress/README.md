# 100 · 应用级顶部进度条（Top Progress）

## 变更范围

在 `admin-web` Runtime Host 建立应用级顶部进度条单例能力：它只表达 Global Pending（当前即路由导航），
与 Page Transition（页面视觉连续性）、页面内 Async Loading（内容区自管）职责分离。

## 当前状态

- 研究门禁：已通过（R100-001）
- 计划：已确认
- 实施：已完成（含真实运行时可见性修复、最小可见周期重校准、"只前进不回缩"修复）
- 验证：已完成（单测 46 用例、e2e 8 用例全通过；全量 check 通过）

## 阅读顺序

1. `research/R100-001-top-progress/`：研究档案（Next 16 导航生命周期事实、现有实现、选型证据）
2. `requirements/`：面向使用的需求产物
3. `design/`：面向技术人员的详细设计
4. `tasks.md`：唯一完成清单

## 演进记录

### 第二轮：真实运行时可见性修复

原实现"代码与测试认为存在，但真实浏览器看不到"，根因有二：

1. **显示门限过保守**：原 `--motion-delay-progress-show` 为 100ms，真实导航 URL 提交约 85ms、
   内容挂载约 105ms——大多数普通导航在门限内完成，进度条完全不渲染。
2. **trickle 动画把 fill 移出视口**：原 `progress-slide` 用 33% 宽 fill 平移至视口外。

修复：门限降至 60ms；`progress-slide`（transform 平移）→ `progress-cycle`（width 延伸，视口内）。

### 第三轮：最小可见周期重校准

产品目标调整：快速导航也必须显示完整进度周期。移除显示门限（`visible` 字段与
`--motion-delay-progress-show`），`begin()` 立即渲染，归零无条件进入 completing，
保证每次导航都有 Enter → 推进 → 补满 → 淡出的完整视觉过程；真实 Navigation 完成后
页面立即渲染，进度条只继续完成自己的视觉动画，不阻塞任何交互。

### 第四轮："只前进不回缩"修复

用户反馈：进度条加载到一半又重新从零加载。根因：`progress-cycle` 关键帧为
`0% {width:0} → 65% {width:60%} → 100% {width:0}`——fill 延伸到 60% 后回缩到 0% 再循环。

修复：改为 `progress-grow`（`0% {width:0} → 100% {width:85%}`）**单次延伸后保持**
（`animation-fill-mode: forwards`，非循环），fill 绝不回缩或重新从零加载；慢速导航下
fill 停留在 85% 持续表达 Pending，完成时由 progress.complete 快速补满并淡出。

像素级验证（真实浏览器）：fill 宽度序列 `0→74→150→225→…→1224`（146 采样点）单调递增、
**回缩次数 = 0**；e2e 新增"只前进不回缩"单调性断言。

## 关键决策摘要

- 生命周期由 Host 包装导航入口（Link render / router.push / router.replace）统一提供，
  不依赖 `useLinkStatus`、不监听 pathname、不用固定 setTimeout 猜测完成。
- 完成信号来自 pathname 提交（RouteTransition），固定超时（15s）仅作异常兜底。
- Global Pending State 使用 Host 内 zustand 模块单例；业务通过稳定 Contract 接入。
- Top Progress 属 Host 层（`apps/admin-web/src/host/`），不进 Universal / UI Adapter / Admin Surface。
- 顶部进度条采用 CSS indeterminate 延伸动画（`progress-grow`）+ Semantic Token，
  关键帧登记于 Motion 权威文件；延伸时长由 `--motion-duration-progress-cycle` 统一管理。
