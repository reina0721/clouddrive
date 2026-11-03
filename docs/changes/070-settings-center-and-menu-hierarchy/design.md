# 070 设置中心与菜单层级「双向归属」架构升级 — 设计方案

> 支撑研究：[R070-001](research/R070-001-current-contract-and-reference/report.md)、[R070-002](research/R070-002-menu-hierarchy-architecture/report.md)；需求：[requirements.md](requirements.md)

## 1. 目标

实现 shadcn-admin 式设置中心（Profile/Account/Appearance/Notifications），并把 WebUI 菜单层级升级为「分组/页面 owner 与引用关系解耦」的双向归属；`settings.center` 作为第一实例验证并形成规范。

## 2. 契约升级（internal/webui/contract.go + composition）

### 2.1 放开 Navigation.ParentID 跨 owner

- 改 `validateBindings`：`item.ParentID != ""` 时仅要求 `navigation[item.ParentID]` 存在（存在 owner 集合），不再要求 owner==本模块；无环校验由既有 `parents` 遍历承担。
- RouteID 门禁保持（落地页必须本人 route）。
- 生成 manifest.Menu 时保留 ModuleID 字段（前端不依赖 owner，仅递归 parentId；无需改动）。

### 2.2 宿主导航声明 HostNavigation

- `internal/webui` 新增 `HostNavigation` 声明类型（ID/RouteID/TitleMessageID/IconID/Order/ParentID）；route 引用限定宿主可用的平台页面。
- composition `webui_registry.go`：把 HostNavigation 并入 validate 与 manifest.Menu 生成（owner=host 桶），复用同一无环/Retain/Icon 门禁。
- AppShell/SidebarMenu 无需改（递归按 parentId）。

## 3. settings 模块（internal/module/settings）

```
binding/webui/binding.go：
  Routes:
    settings.profile    /settings/profile      （app）
    settings.account    /settings/account
    settings.appearance /settings/appearance
    settings.notifications /settings/notifications
  Navigation:
    settings.center（组，落地页 settings.profile，Icon: settings）
    settings.profile / account / appearance / notifications（ParentID: settings.center，Order 稳定）
  （双向实例依确认：iam.security 挂到 settings.center 下或 settings.profile 挂到 iam.access 下，取一例）
web/ProfilePage.tsx（IAM session/principal 摘要只读 + 可跳转安全页）
web/AccountPage.tsx（改密表单复用 iam.changePassword、安全状态、会话摘要链接）
web/AppearancePage.tsx（复用 theme.ts：mode/preset/density/reduceMotion/experience 表单，代替抽屉的主配置入口）
web/NotificationsPage.tsx（通知偏好 localStorage：邮件/站内/工作台摘要等开关 + 无后端说明）
web/mock.ts、locale/en-US.json、zh-CN.json（强制 i18n）
```

- 跨模块数据：settings 经自身 api.ts 调用 IAM 既有 HTTP（同 org 调 iam 先例）；Appearance/Notifications 纯前端（theme.ts 与 localStorage）。
- 图标：`settings`、`user`、`shield`、`palette`、`bell` 加入受控图标目录（internal/webui/icons.go + webui/src/icon-catalog.ts，两侧测试守护）。

## 4. 双向实例与派生规范（REQ-070-C）

- 实例（依确认）：settings.center 下同时收纳 settings 四子页，并把 `iam.security`（账号安全）挂为 settings.center 子项（业务模块页 → 设置组下级）；再验证反向（可选择将 settings.profile 挂到 iam.access 下或保持）——文档记录所选方向与约束。
- 派生：`docs/development/webui.md` 新增「菜单层级双向归属」规范：分组/页面 owner 与引用解耦；父级引用任意 navigation id；无环/顺序/图标/落地页门禁复用；Retain（父不可见则子树隐藏）语义对跨 owner 同样生效；用例建议（系统分组收纳 ops、账号分组收纳 iam/设置等）。

## 5. 文件影响

| 区域 | 文件 |
| --- | --- |
| 契约 | internal/webui/contract.go、contract_test.go、icons.go、icons_test.go |
| 装配/生成 | internal/composition（HostNavigation 并入）、internal/composition/webui_registry.go |
| 新模块 | internal/module/settings/**（binding/webui/web/* + mock/locale/css；handler/服务不新增后端） |
| 图标 | internal/webui/icons.go、webui/src/icon-catalog.ts |
| 前端 | webui/e2e/webui.spec.ts（设置中心 + 双向菜单断言/截图）、webui/src/icon-catalog.ts |
| 文档 | docs/development/webui.md、docs/development/application-module-development.md（如需）、webui/README.md、docs/changes/README.md、070 变更文档 |

## 6. 验证

- Go：`go test ./internal/webui/... ./internal/composition/...`（新增跨 owner 父引用正/反向、无环回归）；`go build ./...`。
- WebUI：`pnpm generate:check/typecheck/lint（i18n+architecture）/lint:modules/vitest/build`；Playwright 新增设置页与双向菜单断言及截图。
- `pnpm e2e -- --workers=1` 全绿后提交。

## 7. 待确认决策

1. 设置中心归属 = 新业务模块 settings（推荐）；
2. 契约升级 = 放开跨 owner ParentID + 新增 HostNavigation（推荐；HostNavigation 首版仅提供「宿主导航分组/平台页」最小集）；
3. Notifications = 前端 localStorage 偏好 + 无后端说明（推荐）；
4. 双向实例 = settings.center 收纳 iam.security（业务页 → 设置组下级；反向引用选一并在文档标注）（推荐）；
5. 图标新增 settings/palette/bell 等入受控目录（推荐）。