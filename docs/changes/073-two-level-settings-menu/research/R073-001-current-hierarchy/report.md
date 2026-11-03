# R073-001 全局菜单两级化：顶级「设置」，移除管理中心宿主分组层

## 研究问题

把「管理中心 → 设置 → 五子项」（三级）改为「设置 → 五子项」（两级）；顶级命名「设置」。

## 证据

- composition：`applicationWebUIHostNavigation()` 装配 `host.center`（Management center，落地 settings.profile）。
- settings binding：`settings.center` 的 `ParentID: "host.center"`，下设五子项（profile/account/security/appearance/notifications）。
- 宿主 locale：`webui.host.navigation.center.title`（en/zh）供 host.center 菜单标题。
- 测试：`webui_registry_test.go` 断言 `host.center`（顶级）→ `settings.center` 边与顺序；e2e070 断言侧栏「Management center」「Settings」「Account security」；059 用 `Expand submenu` 的 `.first()`（当前侧栏组：ops.dashboard + host.center→settings.center 两个可展开组）。

## 事实与推断

**事实**：三级链全部可定位；`settings.center` 的标题键 `webui.settings.center.title` 已为「设置/Settings」，落地页为 settings.profile；页内 SectionNav 8 分区不受全局菜单层级影响。

**推断**：两级化最小改动 = ① settings.center 去掉 ParentID（顶级）；② composition 不再装配 host.center（HostNavigation 契约能力保留在 internal/webui 供未来宿主分组使用，避免无引用死代码）；③ 删除 host.center locale 键（单轨清理）；④ 更新 registry 测试（settings.center 顶级 + 顺序断言）与 e2e（侧栏顶级「Settings」，断言不再出现「Management center」；059 first() 保持，因侧栏仍有两组：ops.dashboard 与 settings.center）。

## 对本任务的影响

073 计划：contract 层零改动（HostNavigation 能力保留）；composition 移除装配；settings binding ParentID 移除 + order 调整；locale 清理；测试/e2e 断言更新；门禁与截图；提交。