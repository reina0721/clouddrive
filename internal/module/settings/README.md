# Settings 模块

Settings 是 WebUI-only 模块：承载「设置中心」的 8 分区页面（Profile/Account/Security/Appearance/Notifications/Language/About/Acknowledgement）与 `settings.center` 两级菜单。

- 无后端 Service/Repo/Migration；Profile/Account/Security 页面复用 IAM 既有 HTTP 能力（跨模块调用先例见 Organization 调 IAM accounts），Appearance/Notifications/Language 为前端偏好（localStorage/i18n）；Security 页含密码更改、MFA/TOTP 绑定与 API 令牌管理区块（078，mutation 携带 Session CSRF）。
- 菜单「双向归属」（070/073/074）：`settings.center` 分组与全局「设置」两级菜单，契约由 `internal/webui` 的跨 owner `Navigation.ParentID`/`HostNavigation` 与 `Route.GroupLayoutID` 支撑；`iam.security` 等页面经归属共享设置布局。
- 接入步骤遵循模块 WebUI 四步（Binding/locale/mock/CSS + 生成链）；详情见 [WebUI 开发指南](../../../docs/development/webui.md) 与 [设置中心联动](../../../docs/development/webui.md)。