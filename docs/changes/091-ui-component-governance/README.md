# 091 统一组件来源与基础交互组件治理

## 变更范围

把 Web UI 从"同一项目内多套组件来源（成熟库 / 自研 / 原生 HTML 并存）"收敛为单一
组件来源层级：

```
HeroUI v3 / React Aria（成熟 Primitive）
  └─ webui/src/ui（项目统一 UI 层，薄封装）
       └─ 业务复合组件
            └─ 具体 Page
```

核心问题（R091-001 定位）：列表页筛选下拉是浏览器原生 `<select>`、每页条数/语言切换
是原生 select、API Token scope 是原生 checkbox、行菜单/列菜单/危险确认/工作区菜单是
自研 popover/dialog——这些与项目已有的 HeroUI Select/Check/Modal/DropdownMenu 并存，
导致"每个区域各做各的"的观感。

## 当前状态

- 研究门禁：**已通过**（R091-001 组件来源审计、R091-002 TailAdmin 设计规律）。
- 计划状态：**已确认**（用户确认 091 计划，开始实施）。

## 阅读顺序

1. [研究索引](research/R091-001-component-source-audit/report.md)、
   [TailAdmin 设计研究](research/R091-002-tailadmin-design-study/report.md)
2. [需求摘要](requirements/README.md) → [详细需求](requirements/ui-component-governance.md)
3. [设计摘要](design/README.md) → [详细设计](design/component-source-unification.md)
4. [任务清单](tasks.md)
