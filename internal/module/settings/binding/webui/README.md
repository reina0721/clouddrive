# Settings 设置中心模块

本模块承载 WebUI「设置中心」：个人资料（Profile）、账号与安全（Account）、外观与体验（Appearance）、通知偏好（Notifications）四个页面，以及 `settings.center` 两级菜单。

- 纯 WebUI 模块：无后端 service/repo/migration；Account/Profile 复用 IAM 既有 HTTP 能力（跨模块调用先例见 Organization 调 IAM accounts）；Appearance 与 Notifications 为前端偏好（localStorage）。
- 菜单「双向归属」（070）：`settings.center` 分组可收纳其他模块页面（如 IAM 账号安全页挂入设置组），契约由 `internal/webui` 的跨 owner `Navigation.ParentID` 支持。
- 接入步骤遵循模块 WebUI 四步（Binding/locale/mock/CSS + 生成链）；details 见 [WebUI 开发指南](../../../../../docs/development/webui.md)。