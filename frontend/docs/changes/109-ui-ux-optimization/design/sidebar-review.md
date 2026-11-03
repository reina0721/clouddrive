# App Shell Sidebar 专项审查

2026-10-11。续接 [108 UI/UX 审查](../../108-ui-ux-audit/README.md)。当前契约见
[Surface Foundation](../../../surface-foundation.md) 与 [UI Element System](../../../ui-element-system.md)。

## 实际体验和根因

先通过浏览器登录本地演示账户，体验展开/收缩、键盘打开 UI Elements Flyout，再
核对源码和消费者。展开宽 264px、图标 16px；收缩宽 88px，叶子热区约 72×44px，
图标仍为 16px（占高度约 36%）。分组标题消失后只剩 28px 空白；叶子只有原生 title。
父级已有 HeroUI 非模态 Flyout、跨层关闭缓冲和 Escape，适合继续复用。

设置与 Icon 大全共用 settings 图标，Motion 未声明图标而 fallback 到 Circle。
展开父级的 bg-transparent 与品牌背景冲突，缺显式 Focus Ring；链接缺 aria-current。
专项还复现 remember 被主题/语言投影重算复位、刷新不恢复，以及打开 Flyout 时
Vendor outside-interaction 消费 Trigger/侧栏切换按钮的首次点击。

## 外部参考和取舍

实际浏览 [TailAdmin Tooltips](https://react-demo.tailadmin.com/tooltips) 的展开/纯图标
Sidebar 与 Tooltip 打开态，并复核 [Popovers](https://react-demo.tailadmin.com/popovers)。
学习图标独立视觉权重、紧凑热区、分组节奏和浮层说明。未复制 DOM/CSS/图片/具体尺寸；
其纯图标按钮 AX 缺失名称的现象不作为项目规范。
[Atlassian Navigation Layout](https://atlassian.design/components/navigation-system/layout)
说明 Header/可滚动 Body/Footer 分工和响应式 Flyout；项目保留稳定品牌区与滚动导航区。
依据 [HeroUI Tooltip](https://heroui.com/en/docs/react/components/tooltip) 与
[Popover](https://heroui.com/en/docs/react/components/popover) 的公开 anatomy，焦点、键盘、
Portal 和碰撞交 Vendor。数值来自现役 Design Token 与当前导航数量。

## 模式规格

| 属性   | 展开               | 收缩                                     | 所有权                   |
| ------ | ------------------ | ---------------------------------------- | ------------------------ |
| 栏宽   | 16.5rem（264px）   | 5rem（80px）                             | Surface Shell Token      |
| 图标   | icon-sm：1rem      | icon-lg：1.5rem                          | 已有 Design System Token |
| 热区   | 保留图文行高与内距 | control-lg：3×3rem 方形                  | Adapter                  |
| 比例   | 图标辅助文字       | 24/48=50%，内部四边 12px，栏边 16px      | 模式 Composition         |
| 项间距 | space-y-1          | space-y-1                                | 已有 spacing             |
| 分组   | 标题与段间距       | 分隔线、上下各 spacing×3、双语 list 名称 | Surface Foundation       |
| 激活   | brand-soft/brand   | 同品牌背景、父级反映当前祖先             | Route 推导               |
| 提示   | 文本标签           | 叶子 Tooltip；父级 chevron/Flyout 标题   | Adapter                  |

共享色彩、圆角、线宽、Focus Ring、图标来源；分别定义栏宽、图标大小、热区几何和
分组呈现。展开顶层行内距由 control-lg/icon-sm 推导，标准密度为 px-5；图标中心与
收缩模式同为栏内 x=40px，避免水平跳动；
嵌套层及 Flyout 保留 px-3。
收缩组固定为 w-control-lg，避免按钮在栏宽动画中按旧宽度居中后再移动。
栏宽由 control-lg 加两侧 spacing×4 推导：标准 80px、紧凑 72px、舒适/增强点击区
88px，图标轴线随同一 Token 联动；不裁切用户偏好放大的热区。
Hover/Open 为 surface-muted，Press 为 surface-inset，Selected 保持品牌。
两种模式的 Focus 统一消费 focus-ring-width/offset/color，默认轮廓 2px、增强焦点
4px，跟随对比度与无障碍偏好，不用组件固定环宽覆盖全局策略。
Icon Trigger 统一支持 Disabled 外观；当前导航模型无禁用节点，不伪造权限/加载状态。

叶子提示右侧优先、首次 Hover 延迟 300ms、键盘 Focus 即时、Escape 关闭。公开
render 将 ARIA/ref/事件附着于原链接，无第二个 Tab 停靠点；子元素须转发标准 anchor
props/ref。提示与链接保持同一焦点目标，不在聚焦时异步替换链接。Host 将整棵
NavigationTree 按需加载，初始 fallback 保留分组与条目骨架，避免增加首屏包负担。
父级用带标题的 Flyout 承担说明及子菜单，不叠加 Tooltip。完整递归树不丢功能。

Mouse Hover 不抢焦点，Trigger/Content 保留现役 140ms 关闭缓冲；点击固定、第二次
点击关闭；触摸 Tap/键盘 Press 正式打开，内部键盘焦点与固定状态防止鼠标误关。
触摸用户也可用 Header 展开按钮恢复全部标签；叶子保持真实链接，父级 Tap 提供图文
子菜单，不将 Hover 设为唯一导航入口。
Trigger 和侧栏切换控制通过 data-navigation-control 标记正式交互边界，Popover 的
公开 shouldCloseOnInteractOutside 排除这些控制，避免 first-click 被关闭机制吞掉；
其余外部关闭与 Escape 仍由 Vendor 处理。旧 sibling 回调只能关闭自身。

模式切换不重挂 ShellNavigation、不改 exploration root，保留当前路由与探索状态。
继续遵守 menuMemory 跨路由策略；不持久化 Flyout/pin/loading。remember 在原 v1
key 白名单内追加 optional rememberedSidebarCollapsed，旧 v1 缺字段默认展开、v0
migration 保持；显式 expanded/collapsed 优先。主题/语言/无关偏好不复位侧栏。

Shell Grid 继续用 standard/product Motion Token 联动 Header/内容列，无 transform
补偿或新 page-enter。品牌区高度不变；收缩隐藏的底部是技术说明，没有被隐藏的操作。
min-h-0 保证导航独立滚动，不挤压品牌/底部；Reduced Motion 由现役项目 Policy 统一处理。

## 修改范围和消费者

Surface Foundation 的 ShellNavigation/样式拥有布局与分组；UI Adapter 的
NavigationFlyout/NavigationHint/统一 Trigger 样式拥有交互及浮层。唯一 Host 经
NavigationTree 消费；递归深层 fixture 继续验证相同实现。新增提示/Flyout 同源组合
放在 `/ui-elements/overlays` 的 Tooltip 预览。
Web Host AppShell/NavigationTree/Shell Store 负责 viewport、原生链接和偏好；
Next/Storage 不进入 Foundation。Surface vocabulary 和两个 Plugin 导航声明新增
icons/motion 并重新生成 Catalog；其它图标消费者和普通业务尺寸不变。

验证、截图及剩余项见 [专项验证记录](../evidence/sidebar-verification.md)。
