# 091 设计

## 设计摘要

本任务把 Web UI 的基础交互组件来源收敛为单一层级：

```
HeroUI v3 / React Aria（成熟 Primitive）
  └─ webui/src/ui（项目统一 UI 层，薄封装）
       └─ 业务复合组件
            └─ 具体 Page
```

关键决策：
1. 以 HeroUI v3 / React Aria 为唯一成熟组件来源，不引入第二套视觉库。
2. FilterBar 的 select/input 分支从原生 HTML 改为统一控件（本次重构核心）。
3. 自研通用组件（DataTableRowMenu、data-table-columns、DangerZone confirm、
   WorkspaceTabs context-menu、ThemeDrawer tabs）替换为成熟方案。
4. 业务复合组件（PermissionMatrix、StatusBadge 语义封装、RuntimeHealthPanel 等）保留。
5. 不复制 TailAdmin 视觉，只迁移"统一组件来源 + 克制表面层级 + 一致控件度量"原则。

## 阅读导航

- [统一组件来源与基础交互组件治理](component-source-unification.md)：详细设计
  （组件来源层级、统一控件契约、逐个替换方案、文件影响、验证方案、风险）。
- 支撑研究：R091-001（组件来源审计与原生控件排查）、R091-002（TailAdmin 设计规律）。
