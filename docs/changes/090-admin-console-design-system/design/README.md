# 后台控制台详细设计

## 设计摘要

方案采用“基础原语 → 语义 Token → 后台模式组件 → 页面族”的四层结构。Shell 统一空间、滚动和导航；页面只提供业务内容与策略。前端技术单轨收敛至 HeroUI v3/React Aria，不把第三方 API 再复制成万能 SDK。

## 关键决策

1. 保留 React 19、Vite 7、Tailwind CSS 4、TanStack Query、RHF/Zod。
2. 移除 HeroUI v2 Theme/Toast，统一 HeroUI v3；表格增强是否引入独立库由真实能力验证决定。
3. 使用 240px/64px 侧栏、56px Header 和按条件出现的 36px WorkspaceRail，取代当前叠层骨架。
4. 页面采用 `PageFrame` 变体，不允许业务页自行决定全局 gutter、最大宽度和滚动容器。
5. Card 不再是默认 Section；列表、详情、设置、表单、批量操作和 Dashboard 各有语义模式。
6. 颜色以中性表面和一个品牌强调色为主，语义色只表达状态。
7. 后端补强按 P0/P1/P2 演进，未实现的详情和统计不得由前端假拼装。

## 文档导航

- [布局系统](layout-system.md)
- [Design Token 系统](design-token-system.md)
- [组件与交互模式](component-and-pattern-system.md)
- [基础组件规格](foundation-component-specifications.md)
- [数据可视化、搜索与动作系统](visualization-command-and-action-system.md)
- [信息架构与页面蓝图](information-architecture-and-page-blueprints.md)
- [后端契约演进](backend-contract-evolution.md)
- [迁移与验证](migration-and-validation.md)
- [目标覆盖矩阵](objective-coverage-matrix.md)

## 研究依据

本设计由 R090-001、R090-002、R090-003、R090-004 支撑；其中尺寸是项目目标规格，不是从参考图逐值复制。
