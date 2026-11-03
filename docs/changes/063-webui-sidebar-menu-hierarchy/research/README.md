# 063 研究档案：侧边栏菜单层级分类

## 研究范围

本变更回答：当前各业务模块（Ops、IAM、Organization、Navigation）在 WebUI 契约中如何声明侧边栏菜单，现有 Manifest 与宿主如何投影/渲染；在当前「不修改 webui 代码」约束下，如何把现有平铺菜单整理为「菜单层级分类」，以及实现需要的最小改动面。范围只覆盖 WebUI 菜单声明、契约校验、Manifest 投影与 mock/生成产物一致性，不研究新增页面、路由、权限模型、运行时插件或独立菜单服务。

## 检索方式

- 按 `docs/changes/README.md` 确认下一个变更序号为 `063`；无现存 063 目录。
- 检索既有研究元数据：`docs/changes/**/research/**/metadata.yaml`。命中并复核：`056/R001`（静态菜单与运行期策略边界，active）、`059/R003`（模块、SDK 与 WebUI Host 可插拔边界，active）、`062/R062-001`（骨架与导航注入面现状与差距，active）、`053/R003`（组织与菜单管理边界，superseded by 053/R005）。上述记录均未覆盖「当前业务模块侧边栏菜单的层级分类方案」这一特定目标，作为本研究的上下文与复用基础；`053/R003` 已由 `053/R005` 取代，仅引用其 supersede 关系，不以其中结论作为当前判定。
- 代码证据：`internal/webui/contract.go`（Binding/Navigation/Manifest 契约与校验）、`internal/webui/contract_test.go`、`internal/composition/{webui_registry.go,navigation.go,webui_http.go}`、`internal/module/{iam,organization,navigation,ops}/binding/webui/binding.go`、`internal/module/navigation/binding/webui/web/mock.ts`、`webui/src/{generated/webui-registry.ts,components/AppShell.tsx,components/shell/SidebarMenu.tsx,menu.test.ts,e2e/webui*.spec.ts}`、`.scaffold/layout.json`，快照 commit `e059a1638ab88b2ee0664931d7272b5c4ed11e76`（2026-08-24 验证）。

## 记录索引

| ID | 标题 | 状态 |
| --- | --- | --- |
| [R063-001](R063-001-sidebar-menu-hierarchy/report.md) | 侧边栏菜单层级分类的契约现状与可行路径（含 2026-08-24 复核） | active |