# 073 全局菜单两级化 + 分组布局 — 任务清单

> 依赖：研究门禁通过（R073-001）；计划按 design.md 执行；用户已给出明确指令（两级菜单 + 固定页内导航）。

## 任务

| ID | 任务 | 完成条件 |
| --- | --- | --- |
| NAV-073-A | 契约：`Route.GroupLayoutID` + validate + manifest/registry 生成 | 模块布局分组可用 |
| NAV-073-B | 宿主 App 分组布局渲染（ModuleGroupLayout + Outlet 注入 children） | /settings/* 共享布局 |
| NAV-073-C | settings：SettingsLayout（固定 SectionNav）+ 8 路由 GroupLayoutID + 页面去包裹（SettingsNavLayout 退役） | 页内导航单实例固定 |
| NAV-073-D | 菜单两级化：settings.center 顶级、composition 移除 host.center、locale 键清理 | 全局两级（设置→五子项） |
| NAV-073-E | Go/WebUI 测试与 e2e（顶级 Settings、固定导航 dataset 标记断言、截图）+ 文档 + 提交 | 门禁全绿后提交 |

## 状态记录

- 2026-08-26：研究门禁通过（R073-001）；用户确认全量实施（两级菜单 + 分组布局固定导航）。
- NAV-073-A（完成）：契约 `Binding.Route.GroupLayoutID`（validate 校验本模块 entry + projectImplementedRoutes 批次保留 + manifest/registry 生成带出）。
- NAV-073-B（完成）：宿主 `renderAppRoutes` 按 groupLayoutId 分组，`ModuleGroupLayout`（懒加载布局 + `<Outlet/>` 注入 children，无 router 依赖）；前端 `ManifestRoute.groupLayoutId` 类型。
- NAV-073-C（完成）：settings `SettingsLayout`（固定 SectionNav 8 分区 + 内容区）+ 8 路由 GroupLayoutID；八页去自身导航包裹；`SettingsNavLayout.tsx` 退役删除。
- NAV-073-D（完成）：`settings.center` 顶级（Order 20，ParentID 移除）；composition 删除 host.center 装配；locale 键 `webui.host.navigation.center.title` 清理。
- NAV-073-E：Go/WebUI 门禁与 e2e（顶级 Settings、无 Management center、固定导航 dataset 标记断言）——已绿；文档与提交收尾中。