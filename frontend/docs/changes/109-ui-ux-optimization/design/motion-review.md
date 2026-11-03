# Motion 与信息呈现专项审查

本轮接续设置语义优化；审查日期 2026-10-09。当前规范仍由
`docs/motion-foundation.md` 管理。本文件保存研究、决策与实施证据，不另建 authority。

## 实际体验与源码交叉检查

浏览器在独立 IAB 标签体验，保留用户已打开的视觉差异审阅页。默认视口
1280 × 720，真实 DOM 高度与区段结构如下；此表记录改造前状态。

| 页面                                                        |              文档高度 px | 结论与策略                                                                           |
| ----------------------------------------------------------- | -----------------------: | ------------------------------------------------------------------------------------ |
| 总览                                                        |                     1509 | 指标及工作入口立即显示；进度已有 Reveal，后续质量/活动分组应沿用同一语义             |
| 参考资源                                                    |                      782 | 集合与筛选直接显示，不增加行级入场                                                   |
| Archetypes overview/detail/master-detail/settings/operation |      720/720/720/734/806 | 简短操作结构保留；主从详情替换可复用 Content Swap                                    |
| Archetypes resource-list/create-edit                        |                2245/1106 | 表格滚动与表单输入效率优先，保留直接显示和局部反馈                                   |
| Patterns layout/collections/forms/detail/states             |      720/720/720/720/788 | 不强加滚动呈现；Bulk、State、Form、Disclosure 保留现役实现                           |
| UI actions/feedback/status/identity                         |      1319/1652/1912/1586 | 功能状态比较保留同屏，不为每个测试控件添加动画                                       |
| UI navigation/data/surfaces/forms/overlays                  | 3204/1304/1863/2977/1625 | navigation 的内容 Section 高 2446；目录锚点与可操作示例优先直接可用                  |
| states/foundations/icons                                    |            1038/1256/720 | foundations 已有 below-fold Reveal；states readiness 与 icons 词汇列表不添加滚动等待 |
| 设置 appearance/navigation/data/actions                     |      1997/1530/1546/2179 | 分组明确，但嵌套 Page 被父选择器整体动画；修复命中粒度                               |
| 设置 locale/notifications/accessibility/shortcuts           |        1366/1055/918/758 | 保留分类壳；短分类不额外拆动画，长分类只按语义分组                                   |

实际 `/motion` 向下滚动后，Reveal 从 pending 变为 revealed，opacity 从 0
变为 1。源码确认 Provider 使用单例 Observer，结束后 unobserve；CSS pending
则在观察器反馈前隐藏内容。设置分类导航实测：嵌套 `.surface-page-stack` 的
animation 是 `content-fade-in, surface-enter-forward`，内部三个 Section 均为
`none`。因此不是缺少 Motion System，而是现有组合与可见性契约存在缺口。

主内容使用文档原生滚动；main 与 route-content 的 overflow-y 均为 visible。
Sidebar 与 Settings navigation 是独立滚动区；不能把它们用作正文 Reveal root。
sticky chrome 与设置分类导航影响顶部视野，但渐进入场从底部边界触发，不等待
整块越过 sticky 区域。浏览器滚动恢复继续归 Host/Next，不创建第二套 history。

## 问题与优先级

| 编号   | 级别 | 问题                                                       | 设计决策                                                           |
| ------ | ---- | ---------------------------------------------------------- | ------------------------------------------------------------------ |
| M20-01 | P1   | pending 隐藏内容；无 JS/观察器异常时可能长期不可见         | 内容默认可见，观察器只增强呈现，不控制可用性                       |
| M20-02 | P2   | 负底部 margin 缩小触发视野；15% 面积阈值对阅读进入没有必要 | 以边界交集触发，不按区域面积等待，无串行队列；验证高区块及快速越过 |
| M20-03 | P2   | settings route-content 新增 Page 后丢失 region 粒度        | 命中 Page 的直接内容单元，保留持久壳静止，不重复动画               |
| M20-04 | P2   | 总览后续语义分组仅在路由时播放，滚动到达时已结束           | 显式使用同源 ViewportReveal；不逐 Card/按钮拆分                    |
| M20-05 | P2   | 首屏、刷新/恢复到中部与真正滚动进入混为一谈                | 首次已在视口的区域直接稳定；仅从外部进入的区域播放一次             |
| M20-06 | P2   | Motion authority 中仍有 stable React ViewTransition 旧叙述 | 对齐真实 CSS route/content-swap 实现与现有浏览器适配边界           |

M20-07（P1）：冷启动/刷新书签 hash 时，目标 DOM 在偏好 hydration 后出现，初始定位
遗漏。Host RuntimeProviders 在 Shell/Workspace ready 后复用 focusRouteAnchor，仅处理
初始 hash；损坏编码安全返回。无 hash、后退与后续导航保留既有滚动策略。

## 分层方案与复用边界

- 页面切换：Host RouteTransition，保留方向语义与现有有限错峰；search/hash 不重播。
- 首屏：Page 的直接语义 region，持久 Shell 不动；不等待滚动观察器。
- 长页面：显式 below-fold 的阅读分组复用 ViewportReveal。已经在视口、跳转恢复、
  快速越过、减少动效、Observer 不可用时直接显示。每个分组最多一次，不累加延迟。
- 表格、表单、设置字段与目录操作示例：信息直接可用，禁止逐行/逐控件动画。
- 组件微反馈：保留 HeroUI Press/Focus/Overlay 与 Adapter 状态，不重复 React 选择状态。
- 内容替换：TabsView 已接入 ContentSwapTransition；主从详情可用同一稳定 contentKey。
- 数据 readiness：AsyncRegion/StateRegion 继续拥有 initial、refresh、background 语义。

不新建万能 Motion Wrapper，不引入 Motion Library，不新增全局 Token，不修改已有
duration/easing/distance。ViewportReveal 是现役、明确允许浏览器生命周期的适配位置
（`tooling/boundary-policy.mjs` 有显式登记）；本轮完善其中安全性，不向 Plugin 扩散
Observer。Surface CSS 仅消费项目 Token；动画不改变 layout、尺寸或滚动所有者。

Observer 的异步交集与 threshold 语义已定向核对
[MDN Intersection Observer](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)。
注册/回调只处理已观察 region，不增加 scroll listener 或每帧 DOM 测量。

比例阈值不等于代码明确要求 15% 才显示：现有回调只检查 isIntersecting。不能据此
宣称所有高区块必然失败。确认的缺陷是 pending CSS 隐藏与负 margin 延后可视边界；
threshold 简化属于统一触发策略的设计决策。

## 验证状态

实施范围：Surface 现役 ViewportReveal 与 route recipe、总览后续质量/活动阅读组、
设置 appearance/navigation/data/actions 的后续五个分组、主从详情 Content Swap。
Page/Section、偏好数据、选择逻辑、持久 key、表格/表单、Overlay 与 Motion Token 不变。
没有新增公共导出；原 Contract 登记增加 `/motion` 和对应验证证据。

浏览器重验 `/motion`：pending 时 opacity=1、transform=none；滚动进入后
`data-reveal-entry=true`、animation=content-rise-in、opacity 仍为1。设置内层 Page
的 animation=none，直接分组播放 forward recipe，Reveal 分组不叠加路由动画。

专项 `motion-targeted-final.txt`：16 项通过，包括现役 Inspector、Reveal、ReadyImage、
方向转场及新增滚动/焦点/恢复/缺失观察器/Reduced/局部详情切换。扩展矩阵第一轮
`motion-expanded.txt`：11 项通过，唯一失败来自新增的整应用无 JavaScript 假设。
源码确认 RuntimeProviders 先等待 Shell/Workspace hydration，SSR 是既有 Loading
Surface；这不是 Reveal 隐藏，也不能宣称整应用支持无 JS 操作。该超出范围假设已
移除，改为 Reveal 自身服务端输出测试，并保留浏览器“观察器不回调/缺失但 JS 正常”
的实际可用性验证。没有放宽等待时间、Axe、尺寸、快照或资源预算。

首次单例计数测试失败是 Strict Mode 顺序清理/重建所致，改为检查同时存活峰值=1；
单元仍验证注册、unobserve、disconnect。初次类型检查发现测试继承方法缺 override，
已补齐。失败与修复分别保留日志，最终全量检查见 `evidence/motion-check-final.txt`。

实际画面保存在 `evidence/motion-final/`：1440/390/320 中文及320/2048深色英文大字号。
滚动截图中的 sticky chrome 对应捕获时的位置，不用静态画面证明动画时间线。浏览器
模拟不替代真实低端手机、软键盘或屏幕阅读器。性能证据检查单例、无额外滚动高度、
无横向溢出、transform-only、无逐帧测量以及原产物预算，不声称获得真实设备帧率。

完整 `pnpm check` 已结束：382单元、生产构建与原预算通过；297浏览器282通过、
15失败。14项对应27个旧视觉差异，另一个旧 SET-012 检查整容器动画，与本轮
region 契约冲突；已修正为直接语义区段进入、内层 Page 不动画、Shell 静止的断言。
完整日志与测试修正后的独立回归分别保留，不将专项成绩称为全量通过。
视觉基线保持人工审阅门禁。

补强后的证据：motion-unit-final.txt 10 项通过（含正确 Provider 下的服务端输出）；
motion-with-anchors.txt 18 项通过，motion-types-final.txt 全部 workspace 类型通过；
motion-anchor-final.txt 正确书签定位/焦点/刷新/返回及损坏编码两项通过。浏览器实际
刷新后目标 top=482、scrollY=1459、焦点位于目标 Switch，region opacity=1、entry=false。
初次无 Provider 的服务端测试失败与类型修复尝试分别保留在 motion-check-unit-attempt.txt
与 motion-check-type-attempt.txt，不用修复后专项成绩覆盖失败记录。
