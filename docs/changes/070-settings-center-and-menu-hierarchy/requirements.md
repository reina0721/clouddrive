# 070 设置中心与菜单层级「双向归属」架构升级 — 需求规格

> 支撑研究：[R070-001](research/R070-001-current-contract-and-reference/report.md)（现状契约与参考差距）、[R070-002](research/R070-002-menu-hierarchy-architecture/report.md)（归属与架构升级候选）

## 1. 目标与范围

用户参考 shadcn-admin settings 实现设置中心（Profile/Account/Appearance/Notifications 四分区），并升级 WebUI 菜单层级使「WebUI 自带或业务模块可双向选择到自己的下级或上级」，派生更多设计思路并规范化。

范围：新增业务模块 `settings`（四子页 + 两级菜单）；升级 `internal/webui` 的 Navigation 契约（放开跨 owner ParentID 引用）并新增宿主导航声明（HostNavigation：宿主分组/平台页可被业务模块引用为父级）；以 `settings.center` 为「双向归属」第一实例；生成链/Go 测试/WebUI/e2e/文档同步。不改已有模块的 Binding 行为（契约向后兼容：同模块引用仍然合法）。

## 2. 需求项

### REQ-070-A 设置中心模块（shadcn-admin settings 形态）

- A1：新模块 `settings`（internal/module/settings）持有四个 app-layout 页面：Profile（个人资料摘要，复用 IAM 会话/资料数据只读展示）、Account（账号与安全：改密/会话/安全状态，复用 iam 能力）、Appearance（主题模式/preset/密度/reduceMotion，复用 theme.ts 与 experience 配置）、Notifications（通知偏好，前端 localStorage 持久化 + 无后端通知说明）。
- A2：页面用 SDK 控件与卡片模板（PageHeader + PageSection/FormCard），遵循强制 i18n（en/zh）、mock 源与 Binding 生成链。
- A3：菜单两级：组 `settings.center`（落地页 = 第一个子页 route）+ 四个子项（Profile/Account/Appearance/Notifications），图标受控目录，Order 稳定排序。

### REQ-070-B 菜单层级契约升级（双向归属）

- B1：`Navigation.ParentID` 允许引用任意已声明 navigation id（跨 owner）；无环/顺序/图标/落地页可加载门禁沿用；同模块引用仍合法（向后兼容）。
- B2：新增宿主导航声明 `HostNavigation`（composition 装配），owner=host：宿主分组/平台页（如设置中心分组）可作为业务模块页面的父级，业务模块页面亦可挂到宿主分组下（双向）。
- B3：manifest.Menu/生成器、前端递归渲染（SidebarMenu 已按 parentId 递归）零改动或最小适配；mock manifest 与 Navigation 菜单管理页同步。

### REQ-070-C 双向实例与派生规范

- C1：以 `settings.center` 验证双向：settings 子页作为模块页面；`iam.security`（账号安全）等业务页面可挂到 settings 分组下（或 settings 子页挂到 iam/ops 分组——按确认决定取一例并记录）。
- C2：把「分组 owner 与页面 owner 解耦」的双向归属规范与派生设计思路写入 `docs/development/webui.md` 与 070 文档。

### REQ-070-D 验证与交付

- D1：Go：契约放开后新增跨 owner 父引用正/反向用例、无环/Retain 回归；`pnpm generate:check` 一致。
- D2：WebUI：typecheck/lint/lint:i18n/lint:modules/vitest/build 全绿；e2e 新增设置中心页面、菜单层级（双向实例）断言与截图。
- D3：文档：`docs/development/webui.md`、`docs/development/application-module-development.md`（如需）、`webui/README.md`、`docs/changes/README.md`、070 变更文档；提交。

## 3. 非目标

- 不为 Notifications 引入后端存储或消息系统（当前无真实通知用例；前端偏好 + 说明）。
- 不把设置逻辑落入宿主 SDK（保持「业务页面由模块持有」边界）。
- 不改已有模块 Binding 语义（仅放宽「引用他人 navigation 为父级」的约束）。

## 4. 风险

- 契约放开需保证无环/Retain/落地页门禁不回归（有既有 Go 测试与新增用例守护）。
- 设置页复用 iam 能力需注意跨模块 HTTP 调用边界（先例：org 调 iam accounts）。
- Appearance 页与 ThemeDrawer 功能重叠：以页面为主、抽屉保持（不删 059 决策）。