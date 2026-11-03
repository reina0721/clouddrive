# UI/UX 优化与跨电脑任务收尾

本变更承接 [108 审查](../108-ui-ux-audit/README.md)、响应式与手机专项及
[107 设置中心](../107-settings-center/README.md)，保留现有视觉与分层。

## 依据与边界

基线 da0a0a5；迁移后的 tracked 文本 diff 为空，生成物 freshness 通过。
Node 24.11.1 / pnpm 10.22.0。既有 lint 101 errors / 13 warnings、文档断链。
原始审查截图不覆盖，视觉基线不自动批准，不提高 diff 阈值。

当前架构以 [文档入口](../../README.md)、[UI authority](../../ui-element-system.md)、
[视觉校准](../../ui-visual-calibration.md)、[Motion](../../motion-foundation.md) 为准。
研究、要求、设计与执行分别见 research/、requirements/、design/、[任务账本](tasks.md)。

## 已纠正的历史结论

HeroUI 3.2.4 的 `@heroui/react/table` 实际导出 `Table.ResizableContainer` 与
`Table.ColumnResizer`；已查类型与运行时。缺少独立 resizable 子路径不构成阻塞。

## 第一轮执行状态（历史记录）

七批代码已实施，逐项根因、消费者、验证与剩余项见 [实施账本](tasks.md)。
当前代码已通过静态治理、lint、类型、369 项单元测试、生产构建及原产物预算。
最终浏览器回归 219 项：205 通过、14 项视觉比较失败，没有其它行为断言失败；
`pnpm check` 因视觉失败 exit 1，不能声明全绿。
完整结果与独立补跑格式/文档检查见 [验证记录](evidence/verification.md)。
截图和人工/设备边界见 [视觉复核](evidence/visual-review.md)，视觉快照尚未更新。

## 2026-10-08 第二轮执行状态

在[108原报告第12节](../108-ui-ux-audit/README.md#12-2026-10-08-二次审查设置任务选择热区与页面标签)
补充9项确认问题及移动设置方案比较，已实施默认可选固定标签、低权重关闭与标签管理、
公共选择控件点击边界、紧凑设置行、持续分类入口、配置摘要来源链接和路由绘制溢出修正。
Checkbox选中颜色在Adapter局部映射到项目语义Token。

最终完整检查：370项单元测试通过；浏览器233项中219通过、14项截图比较失败，
27个失败断言均为截图，没有其它行为断言失败。治理、lint、类型、构建与原产物预算通过。
`pnpm check` exit 1，视觉基线没有更新；仍需人工确认[27组视觉对照](evidence/review-2026-10-08/visual-differences/index.html)。
本次中断恢复确认完整命令已结束，无测试进程需要重启，没有重复执行已完成的全量检查。
最终记录见[本轮验证](evidence/review-verification.md)，实现与证据见[任务账本](tasks.md)。

## 设置容器与动态布局续审

原108报告第13节补充R13-01/02/03：修复派生sticky变量的计算作用域，复用outlined Section
与contentInset，并让低高度桌面窗口的分类导航按实际剩余高度滚动；共享详情侧栏同步修复。
最终代码完整检查为370项单元通过，236项浏览器222通过/14视觉失败，27个失败断言均为截图。
治理、类型、lint、构建与原预算通过；完整命令exit 1，未更新视觉基线或阈值。
见[最终日志](evidence/layout-check-final.txt)、[最终27组对照](evidence/review-2026-10-08/layout-visual-differences/index.html)
和[原报告](../108-ui-ux-audit/README.md)。人工视觉确认仍是剩余验收项。

## 验收反馈：开关行留白

修复row模式左右padding为0的问题，复用px-3/py-2；默认Card不变，新增UI Elements同源示例。
原108第14节记录根因与范围。最终检查370单元通过，237浏览器223通过/14视觉失败，27个错误
均为截图；18项设置专项通过，包含三宽度×三密度hover与留白点击。源码治理、类型、lint、
构建和原预算通过。完整命令仍exit 1，原基线未更新。
见[本次最终日志](evidence/hover-spacing-check.txt)与[本次视觉对照](evidence/review-2026-10-08/hover-visual-differences/index.html)。

## 2026-10-09 设置语义任务续审

承接已提交的主题卡片、inline/previews与设置预览。完整审查67字段，按任务重组长分类，
补齐39个搜索入口，并修复紧凑侧栏手机双列与深色Dialog固定白字两项公共问题。
复用现有Page、Section、Radio、Select、Switch、Motion与Feedback，不新增公共组件或
独立样式体系。具体方案见[设计审查](design/settings-semantic-review.md)和108报告§19；
最终完整检查、专项及视觉复核见[验证记录](evidence/semantic-final-verification.md)。
320英文大字号人工复核进一步修复主题卡逐字换行和分类入口截断；tiles容器响应式
同时用于设置与UI Elements。当前八分类见[实际画面](evidence/semantic-final/index.html)。

完整产品检查374单元及生产构建/原预算通过；272浏览器254通过/18失败，其中14项为27个
截图差异，四项旧测试问题修复后整个设置UX套件34项通过。新增产品审查25项和语义七项
在完整运行中通过。实际状态、复测与[视觉对照](evidence/semantic-final/visual-differences/index.html)
独立记录；未修改原基线或阈值，人工视觉确认仍是剩余验收项。

最终测试源码的完整回归已完成：374 单元、生产构建与原预算通过；285 浏览器中
271 通过、14 视觉失败，四项旧测试问题均在完整运行中通过，日志为
evidence/semantic-final-check-current.txt。此结果是以下 Motion 专项实施前的基线状态。

## 2026-10-09 Motion 与信息呈现专项

基于现役 Motion System 实测全项目主要页面，补齐默认可见 Reveal、首屏/恢复/快滚
降级、焦点中断与单次滚动呈现；修复设置内层 Page 的 region 命中，并复用既有组件为
总览后续阅读组和主从详情补充连续性。表格、表单、短操作页面保持直接可用。
设计清单、边界及取舍见[Motion 审查](design/motion-review.md)和108报告§20。

完整检查382单元、构建和原预算通过；297浏览器282通过/15失败，其中14项是
27个旧视觉差异，另一项旧整页动画测试已按区段契约修正并独立复测。
详见[最终验证](evidence/motion-final-verification.md)与
[本次视觉对照](evidence/motion-final/visual-differences/index.html)。原基线未更新，
完整检查尚未全绿；人工视觉确认是剩余验收项。

## 2026-10-09 语义内容项 Scroll Reveal 续轮

依据新要求将上轮区段级呈现扩为独立语义项：Page统一scope，设置行、Card、标题、
阅读列表项独立触发；路由仅保留标题轻过渡。源码/浏览器问题与实施范围见
[专项审查](design/scroll-reveal-review.md)，执行结果见[验证记录](evidence/scroll-items-verification.md)。
历史审查与证据保留，当前规范已同步Motion authority；本轮不自动更新视觉基线。

本轮最终383单元、构建、原性能预算通过；301浏览器287通过、14视觉比较失败，
共28个截图差异。38个真实入口审计及快滚/恢复/Reduced专项通过，入场期间的四类
对比度失败已修复并复验。功能/Axe与视觉基线分别验收，完整检查尚未全绿。
当前[视觉对照](evidence/scroll-items/visual-differences/index.html)已归档，随后获人工确认。

用户随后明确确认这28项，已限定范围更新对应golden并保存前后hash。
人工确认后的完整 `pnpm check` exit 0：383单元、301浏览器、生产构建、原预算与全部
门禁通过，含38个真实入口及已批准基线复验。最终成绩见上述验证记录；旧对照与失败证据保留。

## UserIdentity 账户菜单专项（2026-10-09）

见[设计审查](design/account-menu-review.md)与[验证记录](evidence/account-menu-verification.md)。
身份摘要、偏好分组、当前值及语言/主题二级单选复用现役MenuButton/HeroUI；沿用Shell
Store、设置入口与导航确认，新增同源UI Overlay展示。用户确认本轮4项视觉差异后限定更新，
383单元、310浏览器全部通过；完整命令末尾对照HTML格式问题修复后，格式/文档门禁复验
通过。原对照、失败过程及前后hash保留，成绩与命令退出码详见验证记录。

## Authentication专项

布局隔离、统一会话/模式/服务、页面设计与完整验收方案见
[认证审查](design/authentication-review.md)。Public/Auth/App 路由布局、登录/注册表单、
统一模式/会话、账户身份与退出已接入。用户确认本轮7项视觉后限定更新，完整
`pnpm check` exit 0：403单元、329浏览器、生产构建、原预算及全部门禁通过。
最终成绩见[认证验证](evidence/authentication-verification.md)，完整目标映射见
[认证验收](evidence/authentication-acceptance.md)，配置及 API
契约见[Web Authentication](../../../apps/web/src/auth/README.md)。真实 Backend 待联调，
受控契约浏览器验证不等于真实认证已接通。

## Sidebar 展开与纯图标专项（2026-10-11）

已完成实际体验、模式比例与 Tooltip/Flyout、导航分组和偏好恢复调整；方案见
[侧栏审查](design/sidebar-review.md)，过程与验收见
[侧栏验证](evidence/sidebar-verification.md)。当前全量结果与视觉基线确认以验证记录为准。
