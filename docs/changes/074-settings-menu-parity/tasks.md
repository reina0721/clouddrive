# 074 设置菜单一致性 — 任务清单

> 依赖：研究门禁通过（R074-001）；计划按 design.md 执行；用户直接指出不匹配问题。

## 任务

| ID | 任务 | 完成条件 |
| --- | --- | --- |
| PAR-074-A | settings 全局子项补全 8 分区（languages/info/star 图标 + Order） | 全局设置组 = 页内 8 项 |
| PAR-074-B | iam.security 移回 iam.access（撤跨模块挂入） | 全局不再出现页内没有的 Account security |
| PAR-074-C | composition 菜单测试与 e2e 断言更新 + 验证（Go/WebUI/Playwright） | 门禁全绿 + 截图 |
| PAR-074-D | 权威文档（双向归属实例更新、一致性规范）与提交 | 提交完成 |

## 状态记录

- 2026-08-26：研究门禁通过（R074-001：不匹配由 070/072 两决策叠加）；用户 custom 指示补充两条原则（页面职责边界：模块 UI 需求调他模块接口自实现页面；菜单通用本质：全局/页内菜单是通用能力非业务专用）——已并入设计并实施。
- PAR-074-A（完成）：settings 全局子项补全 8 分区（language/about/acknowledgement，languages/info/star，Order 31-33）。
- PAR-074-B（完成）：iam.security 移回 iam.access（页面职责归位；跨 owner 能力保留）。
- PAR-074-C：composition 测试/e2e 更新 + 门禁——进行中（Go/typecheck 已绿，WebUI 门禁与 Playwright 待确认）。
- PAR-074-D：权威文档（通用范式 + 职责边界）与提交——收尾中。