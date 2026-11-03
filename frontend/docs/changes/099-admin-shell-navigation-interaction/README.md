# 099 Admin Shell Navigation Interaction

## 范围与状态

本变更修复 Admin Shell 展开侧栏的父级菜单语义、视觉和展开状态，并消除 Compact Sidebar Hover Flyout 的重复开关。

研究门禁：`R099-001` 已通过。
计划状态：已确认并完成；实施基线为 `484dfe009a8527f49a0564f9bec5b1151c46592d`，相关文件未命中刷新触发器。

完成证据：父级菜单、Compact Flyout、Axe 与视觉场景均已纳入 Playwright；完整 `pnpm check` 通过 41 个浏览器测试，未调整视觉阈值或性能预算。

## 阅读顺序

1. [当前交互根因研究](research/R099-001-shell-navigation-interaction/report.md)
2. [需求](requirements/shell-sidebar-interaction.md)
3. [设计](design/shell-navigation-fix.md)
4. [任务与证据](tasks.md)

## 边界

- 只修改 Admin Shell Navigation 与其直接依赖的 Universal Flyout Contract。
- 不改变路由树、业务页面、后端能力、全局 Token 或公共 Button 默认行为。
- 图 1～2 是当前缺陷证据，图 3～4 是父级菜单视觉目标，图 5 是 Compact Hover 缺陷证据。
