# 070 设置中心与菜单层级「双向归属」架构升级 — 任务清单

> 依赖：研究门禁通过（R070-001/R070-002）；计划按 design.md 第 7 节推荐项执行；非文档实施需用户对计划报告的独立确认。

## 任务总览

| ID | 任务 | 依赖 | 完成条件 |
| --- | --- | --- | --- |
| SET-070-A | Navigation 契约放开跨 owner ParentID + Go 用例 | 计划确认 | REQ-B1 |
| SET-070-B | HostNavigation 宿主导航声明与装配/生成 | A | REQ-B2、B3 |
| SET-070-C | settings 模块（四子页 + 菜单 + i18n/mock/图标/生成链） | A | REQ-A1..A3 |
| SET-070-D | 双向实例（settings.center 收纳 iam.security 等） | B、C | REQ-C1 |
| SET-070-E | 验证：Go/WebUI/e2e 断言与截图 | C、D | REQ-D1、D2 |
| SET-070-F | 派生规范与 authority 文档、提交 | E | REQ-C2、D3 |

## 状态记录

- 2026-08-26：研究门禁通过（R070-001 现状：契约强制同模块 ParentID/RouteID、宿主无入菜单页面；R070-002 推荐组合）；用户确认全量实施（决策 1–5）。
- SET-070-A（完成）：`internal/webui` 契约放开 Navigation.ParentID 跨 owner（两阶段校验避免声明顺序；环/顺序/图标/Retain 门禁保持）；新增 Go 正/反向用例；`BuildApplicationCatalog` 逐模块预检 `deferParentCheck`。
- SET-070-B（完成）：`HostNavigation` 声明（ID/RouteID/Title/Icon/Order/ParentID，owner=host）+ `BuildCatalogWithHosts` + manifest 投影与 `BuildNavigationPolicySnapshot` 并入；composition 装配主线用例 `host.center`（Management center，落地 settings.profile）。
- SET-070-C（完成）：新业务模块 `settings`（Profile/Account/Appearance/Notifications 四页 + `settings.center` 两级菜单 + i18n en/zh + mock + 受控图标 palette/bell/user/shield/settings + 生成链）；Appearance/Notifications 为前端偏好（localStorage），Account/Profile 复用 IAM 自能力。
- SET-070-D（完成）：双向第一实例——`settings.center`（挂 host.center 下）收纳本模块四页与 `iam.security`（业务页面进设置组下级）；host.center→settings.center→四页/iam.security 全链经 composition 测试与 e2e 断言。
- SET-070-E：Go 全量测试、`pnpm generate:check/typecheck/lint/vitest/build` 与 Playwright 18（新增 `070 settings center renders with bidirectional menu hierarchy` 与截图 070-settings-*.png）——全绿。
- 待收尾：SET-070-F authority 文档同步与提交。