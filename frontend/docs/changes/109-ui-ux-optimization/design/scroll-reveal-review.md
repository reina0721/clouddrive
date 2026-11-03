# 语义内容项 Scroll Reveal 专项

2026-10-09。本轮接续108审查及109优化；本轮要求明确取代上轮“相关 Card 整体
Section、设置字段不逐项进入”的设计取舍。历史报告保留当时证据；当前规范同步至
`docs/motion-foundation.md`、根和 Surface AGENTS。

## 实测缺口

改动前实际滚动 `/settings`：themeMode/accent/density/fontScale/contentWidth 五个字段
均无 data-reveal，animation=none；仅末尾含动效与对比度的整个 Section 处于 pending。
父级路由 region 动画会在导航时一次播放，后续阅读项到达视口时已没有呈现节奏。
源码确认同类问题见总览两个大 Reveal、Foundations 的整组双 Panel、Section 内容
包多个字段、UI Family 多个 ComponentPreview、资源工作台指标网格及时间线。

已复核 TailAdmin `/cards` 的完整 Card 类型页面（图文、横向、链接、Icon），以独立
可阅读 Card 校准粒度；保持既有项目 Token/布局和 HeroUI 交互，不复制外部实现。
正文实际使用文档滚动，Settings nav/Sidebar 是独立滚动区；它们不能作为正文 root。

## 架构与复用

1. 页面切换：沿用 Host RouteTransition 的方向语义；仅非持久 PageHeader 轻量
   过渡，取消 Page 子区段 nth-child 错峰。Settings Shell 不吃分类转场。
2. 内容进入：沿用 ViewportRevealProvider 的单例 IntersectionObserver，扩展现役
   ViewportReveal 的 `items` 模式。Page 自动使用原有 stack 节点作为 scope；scope
   不动画。独立语义项声明 `data-reveal-item`，直属子项集合声明 `data-reveal-items`。
   注册最小语义项，带子项的祖先不注册，防止父子一起出现。没有扫描 HeroUI slot。
3. 交互：HeroUI/Adapter 继续负责 Focus/Selection/Overlay/Disabled 等。Reveal 不做
   Selection，不拆选项、图标和文本，focusin 立即让所属项稳定。
4. 状态：Disclosure、AsyncRegion、StateRegion、ContentSwapTransition 保留自己的
   生命周期；动态新节点由 scope 的 childList MutationObserver 登记，不以每次偏好
   更新、输入或 Tab 状态变化重播已存在的内容项。

Host 新增 ScrollRevealRuntime，单点 passive scroll 采样正文 scrollY；速度超过
2px/ms 后160ms内视为快速滚动（这是运行时检测参数，不是视觉时间 Token）。
共享 Provider 只消费 fast/restored 判断，不读取 window/history/storage。无额外
逐项 scroll listener、无每帧同步 DOM 测量、无 scroll 时 React 更新。

同批 IO 快照按 top、left 排序；只首次进入，离开立即 unobserve。首屏短错峰，
同批超过四项时压缩步进，每项仍有独立延迟，最后一项不超过120ms。
后续真正进入才播放；快速越过/快滚、首次恢复到中部、hash 定位、焦点进入、
Reduced/off、观察器缺失/失败均直接稳定。等待状态默认可见，不依赖 Observer
回调来开放内容或交互。没有串行 timer 队列。

视觉语义源仍是 Design System Schema：180ms duration-feedback、0.5rem reveal
位移、既有 ease-product，新增 reveal step/max 为40/120ms，透明度起点0.96。
高对比度起点为1。标题转场仅位移；渐入不从完全透明开始，保留阅读和操作的即时性。
后者避免默认可见内容因异步观察反馈突然变为完全透明。Surface recipe 只动画
transform/opacity，fill=backwards，结束不保留 transform 或额外动画实例。

## 消费者与修改范围

| 消费范围              | 独立触发单元                                          | 保留边界                                          |
| --------------------- | ----------------------------------------------------- | ------------------------------------------------- |
| 总览                  | 每张指标/能力 Card、质量规则、活动、最近/收藏项       | 标题/动作作为一个可识别单元                       |
| 八类设置              | 每个分组标题、每项设置、关联反馈模块                  | Radio 选项/帮助文本随所属字段；无新状态或持久 key |
| Foundations           | 架构 Card、Panel 内容、规则/工作台 List Item          | 保留实际网格与宽度                                |
| UI Elements 九 Family | Section/Preview 标题、独立示例、Card 网格             | 同一控件状态对照为一个示例，不拆每个按钮          |
| Page Patterns         | 标题、Toolbar/步骤/表单信息、Timeline Item            | readiness、Bulk/Feedback 保留原契约               |
| Page Archetypes       | 公共 Page/Section、工作台指标、详情与活动、表单字段组 | 表格仍是可操作集合，不拆 Cell/Row 状态            |
| 参考资源              | 公共标题/Section、创建/编辑独立字段                   | 搜索/选择/保存/恢复保持原 Port                    |
| States/Icons          | 独立状态 Panel、语义图标词条                          | 状态切换与可访问声明仍归状态组件                  |
| Motion                | 真实 items scope 的六个独立示例                       | 与业务同源，支持 Inspector/Reduced                |

没有新增 UI Library、公共 Barrel、Plugin Contract 动画属性或第二套 Motion System。
既有 `/viewport-reveal`、`/layout` 契约延续；登记补充本轮测试证据。

全量检查发现入场期间的真实对比度缺口：标题面包屑、信息 Badge、主操作以及蓝色
Dialog 操作。修复不延长 Axe 等待、不改阈值：Route 标题不做透明度过渡；Reveal 起点
由0.72收敛为0.96；高对比度起点为1，并取消 Dialog/Confirm/Command/Drawer 的浮层
淡入淡出。后者通过 Adapter 自有 class 绑定 HeroUI 公开 Backdrop/Container/Content，
不访问内部 DOM；正常模式保留原 Overlay 交互和动效。Breadcrumb 的公开主题变量
在 Adapter 映射到已有 ink-muted/ink，补齐原 Item 内部 Link 未消费语义颜色的缺口。
消费者包括 PageHeader、Navigation Family、四种 Overlay 和它们的真实业务入口；
未新增颜色 Token 或业务页覆盖。复核 TailAdmin Cards、Modals 打开态和 Links 页面，
HeroUI Modal 官方公开 anatomy/className/data-entering/exiting 文档也已复核：
[官方 Modal](https://heroui.com/en/docs/react/components/modal)。

## 验证与已修复问题

源码验证包括父子互斥、排序/上限、动态节点、快滚、单次/focus、SSR默认可见、
观察器缺失/构造/observe失败。浏览器专项覆盖1440/390独立字段、首屏错峰，
320/2048深色英文大字、Axe、缺失/静默观察器、Reduced、反向/快速滚动、hash
刷新/返回、局部详情切换和38个主要入口的高度/溢出/嵌套动画检查（含真实详情与编辑）。

初轮28/31通过：设置壳误命中标题 route recipe已收窄；旧区段断言已迁移到独立项；
路由审计误写 `/icons` 已改为真实 `/system-tools/icons`。没有放宽Axe、视觉差异、
定位等待或资源预算。跨38路由审计使用独立120秒任务预算，各route普通断言超时不变。

最终结果由 [验证记录](../evidence/scroll-items-verification.md) 汇总；原截图基线
和历史证据不覆盖、不自动批准。当前截图保存在本轮 `evidence/scroll-items/`。
