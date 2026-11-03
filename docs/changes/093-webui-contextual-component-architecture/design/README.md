# 093 设计摘要

## 关键决策

1. 保留 HeroUI/RAC 行为单轨，视觉上下文化不等于恢复多套实现。
2. 引入 Primitive → Component → Context Adapter/Pattern → Business Composite → Page
   五层模型，并通过导入和测试门禁约束。
3. `className` 不再是公共组件改造内部 anatomy 的默认 API；场景差异使用有限判别联合、
   窄 Adapter 或明确 Pattern。
4. 每个视觉外壳只有一个 owner；列表、表单、设置和工作台分别定义组合契约。
5. Token 从单一 control/card 尺度扩展为 primitive、semantic、context、component-state，
   但不创建自由组合的主题 DSL。
6. 按模式垂直迁移并删除旧规则，不先全局换 CSS 再等待页面回归。

## 详细设计

- [组件分层与上下文系统](component-layer-and-context-system.md)
- [页面模式与视觉所有权](page-pattern-and-visual-ownership.md)
- [迁移与验证](migration-and-validation.md)

设计依据为 [R093-001](../research/R093-001-contextual-component-pollution-audit/report.md)。
