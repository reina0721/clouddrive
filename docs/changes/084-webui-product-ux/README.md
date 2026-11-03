# 084 WebUI 产品化重构：逐页推翻低质量布局（第三期）

## 状态

**已达成验收（2026-09-01 全 24 路由严格可用性终审）**。以用户长期重构目标（admin-design-baseline.md + 逐页产品化目标）为唯一输入，基于全路由 mock 截图 + codex 多模态视觉审计 + 代码级审查逐轮重构：

- 全部 P0 结构性缺陷清零；严格可用性终审 24/24 页面**无真实 P0/P1 交互缺陷**（含控件边界、操作 affordance、状态反馈、信息层级、筛选/表格/批量等复杂能力）。
- 功能闭环补全（可推导范围内）：会话按账号过滤、账号批量启停/批量归档（含后端契约 + 逐条错误码）、账号按角色筛选、审计筛选并入列表卡等。
- 平台复用：`.field-grid`/`.split-workspace`/`.row-actions`/`form-panel-bounded`/`FilterBar(trailingFields)`/`DataTable(rowMenuHeader)`/`BulkActionBar(extraActions)` 等原语，跨模块一致性由 lint + 文档守护。
- 残余项仅为视觉密度/留白的主观评审意见与移动视口真机验证（受限环境），已逐轮记录于 tasks.md，不构成客观验收缺口。

## 范围（本变更）

- 依据 [R084-001 视觉与代码审计](research/R084-001-product-ux-audit/report.md) 的 P0/P1 结论，逐页推翻低质量布局与组件组织，禁止仅调色/圆角/padding。
- 覆盖页面：Organization 三页、Navigation Menus、OpenAPI、IAM（Accounts/Roles/Sessions/ApiTokens/Permissions/Security/Login/Setup）、Settings（Appearance/Language/Notifications/Security/About/Acknowledgement/Security）、Ops Dashboard/Capabilities、Auth Audit。

## 阅读顺序

1. [需求](requirements.md)（范围、验收）
2. [设计](design.md)（每页新 IA/交互/组件、文件影响）
3. [任务清单](tasks.md)（任务 ID、完成条件、逐轮证据）
4. [研究档案](research/R084-001-product-ux-audit/report.md)（事实与证据）