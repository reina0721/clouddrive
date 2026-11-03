# 071 设置中心页内侧边栏形态（第二类菜单层级） — 任务清单

> 依赖：研究门禁通过（R071-001）；计划按 design.md 第 8 节推荐项执行；非文档实施需用户对计划报告的独立确认。

## 任务总览

| ID | 任务 | 依赖 | 完成条件 |
| --- | --- | --- | --- |
| NAV-071-A | SDK `SectionNav` 原语 + 平台样式 + 单测 | 计划确认 | REQ-A1..A3 |
| NAV-071-B | settings 共享布局与四页接入（页内导航） | A | REQ-B1..B3 |
| NAV-071-C | e2e 页内导航断言与 071 截图；文档（两类层级规范）与提交 | B | REQ-C1..C3 |

## 状态记录

- 2026-08-26：研究门禁通过（R071-001：070 仅全局菜单树、参考站展示页内侧边栏第二形态、平台缺 SectionNav 原语）；用户选择按推荐方案实施（custom 回复重申两形态需求）。
- NAV-071-A（完成）：SDK `SectionNav` 原语（navlist 语义、aria-current 高亮、键盘上下/Home/End、href/button 双渲染；无 onSelect 时 href 保留浏览器默认导航）+ 平台样式（`.section-nav*`，≤720px 横向折叠）+ ui.test 单测。
- NAV-071-B（完成）：settings 新增 `SettingsNavLayout`（SectionNav + 内容区，active 由路径推断）+ 四分区页面（Profile/Account/Appearance/Notifications）全部接入；`settings.module.css` 页内布局；无 lucide/react-router 依赖（模块边界内保持）。
- NAV-071-C：e2e `071 settings in-page section navigation…`（分区导航可见/aria-current 高亮/点击切换 URL/移动视口截图）——进行中；文档与提交待收尾。