# 095 页面转场与动效分层（page-transitions-and-motion）

## 范围与状态

为 `/frontend` 统一前端基座补齐路由级页面转场与动效体系：深入导航的方向性滑动转场、Shell 空间锚定、reduced-motion 豁免与转场验证。动效只消费现有 Semantic Token（时长、缓动、色彩），不新增运行时依赖，不改 HeroUI 浮层契约；无类型提交（浏览器后退/前进、hydration/reveal）瞬时切换、不播放动画。

状态：**已完成**（研究门禁通过，计划经用户确认后实施并完成全部验证；转场观感的人工确认见 tasks.md 的 MANUAL-095-001）。

## 阅读顺序

1. [研究档案 R095-001](research/R095-001-view-transition-facts/report.md)：Next.js 16 / React ViewTransition 运行时、类型与项目约束的事实证据。
2. [需求](requirements/README.md)：客户可验收的转场能力、层级区分与豁免行为。
3. [设计](design/README.md)：四级动效模型、方向语义、CSS/TS 结构与验证方案。
4. [tasks.md](tasks.md)：唯一完成清单。

## 关键决策摘要

- 使用 React `<ViewTransition>` + 浏览器 View Transitions API（Next 16 内置 react 已导出，官方无配置模式），不引入动画库。
- `nav-forward` 类型 = 深入导航的方向滑动；无类型导航（浏览器后退/前进、hydration/reveal）瞬时切换，不伪造方向、不播放动画。
- Header 与侧栏通过 `viewTransitionName` 锚定，转场中保持静止。
- 动效零颜色开销：转场只含 transform/opacity 快照，色彩语义维持 Token 单源。
- reduced-motion 用与主规则同特异的后置规则压到 0.01ms，不使用 `!important`。
- 类型缺口通过一处 `import type {} from 'react/canary'` 激活 `ViewTransition` 声明，零运行时影响。

## 完成后的终态同步

- `frontend/README.md` 增加页面转场能力说明。
- `docs/ui-element-system.md` §10 增补页面级转场边界条款。
- 本文登记于 [docs/changes/README.md](../README.md)。
