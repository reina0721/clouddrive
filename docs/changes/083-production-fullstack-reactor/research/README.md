# 083 研究档案：Production-grade 全栈产品重构（WebUI 产品化二期）

## 研究范围

回答三项问题：① 新方案（temp-new-changes.md，Production-grade 全栈产品重构 + 11b 样式权威 + 11c 布局骨架 + 11d 设计基线）与 082 已实施现状的逐节差异与裁决；② 样式权威与布局骨架的事实基线（精确统计与修复路径）；③ 082 各页面相对 admin-design-baseline.md 的达标/重做判定。研究以真实代码、生成物与已提交文档为证据。

## 检索方式

- 变更序号 `083`；研究快照 commit `5a3def3`（方案与基线）；实测 HEAD `5a3def3`。
- 代码证据：`webui/src/**`（宿主/SDK/ui/组件/styles.css）、`internal/module/*/binding/webui/web/*`（页面与 `.module.css` 的 `:global` 统计）、`webui/scripts/lint-*.mjs`（样式权威检查现状）、`internal/composition`（catalog/registry）。

## 现状盘点（R001/002 实测）

- 082 已实施平台底座与全部主页面迁移（HeroUI 单轨、静态插拔、保留 WorkspaceTabs、Backend Freeze），Vitest 192 / mock E2E 3 全绿。
- 样式污染（R083-002 实测）：**7 模块 CSS 共 137 处 `:global(`**（auth 9/iam 25/navigation 15/openapi 0/ops 75/organization 5/settings 8）；其中 21 处死代码、1 处真全局泄漏（ops `header-zone-action`）、`.toolbar` 被 iam/organization 在 720px 断点私有覆盖、camelCase 命名分裂（`pageMeta/formHint/shellSearchTrigger` 等）；`lint-architecture/lint-modules/eslint` **均不检查** `:global` 泄漏/平台类重复/私有覆盖。
- 布局骨架（R083-002 实测）：`.app-workspace` 生效 `height:100vh; overflow:hidden`；`.page-viewport` `overflow:auto` + `max-width:1600px` 居中限宽；全仓 **零 `dvh`**、styles.css 共 11 处 `100vh`；滚动发生在 `.page-viewport` 元素级；Tab Bar（WorkspaceTabs）与 Footer 仍装配（showTabs/showFooter）。

## 设计方向（与 R083-001 三档落地一致）

- 档 1：样式权威重建——lint 规则扩展（检查 `:global` 泄漏/平台类重复/私有覆盖）+ 137 处 `:global` 清理（21 处死代码直接删，其余收敛到平台或模块局部类）。
- 档 2：布局骨架重写——`100dvh` 视口、独立 Main Workspace 滚动、按场景宽度档（`--content-max-*` 已有 4 个零消费 token 接线）、移除 Footer 与 WorkspaceTabs。
- 档 3：产品化 Feature 与后端补足——sorting 必补（前端 URL sort 契约已建待消费）、feature 拆解（EntityHeader/MetricCard/ActivityTimeline/CommandPalette 等补缺）、页面模板/状态全集、Settings 宽度与层级、视觉校准、三层 QA。
- 裁决：A 推倒 App Shell 分治（结构保留、样式骨架重写）；B 移除 Tab Bar（变更 DEC-082-001）；C Backend 兼容+需时补足（sorting 必补）；D 组件栈无冲突（HeroUI/RAC/Tailwind 单轨，RHF+zod 启用待迁移、TanStack Table 条件候选）。

## 记录索引

| ID | 标题 | 状态 |
| --- | --- | --- |
| [R083-001](R083-001-proposal-vs-082/report.md) | 新方案 vs 082 已实施现状差异分析（四裁决点/三档落地） | active |
| [R083-002](R083-002-style-layout-baseline/report.md) | 样式权威与布局骨架事实基线（137 处 :global / 100vh / 滚动模型） | active |
| [R083-003](R083-003-baseline-page-audit/report.md) | 设计基线逐页对照审计（082 页面达标/重做判定） | active |