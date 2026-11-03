# R003 Auth Session WebUI 访问边界与导航装配

## 研究问题

已有 Auth Session 页面已经能够展示服务端签发的 `WebUISession`，但其 route 没有声明查看 operation，也没有进入 manifest menu。需要确认是否可以在不增加 Session wire、数据库 migration 或第二套权限体系的前提下补齐访问边界和可发现性。

## 当前事实

- `internal/module/auth/webuiauth/http.go` 已提供 `GET /api/v1/webui/auth/session`，返回现有 `WebUISession`；页面只读消费 `user`、scope 和生命周期字段。
- `internal/composition/webui_http.go` 已把 route 的 `ViewOperationID` 交给 Auth operation authorizer；未认证返回 `authentication-required`，授权失败返回 `denied`。
- Auth setup 创建的本地 WebUI 用户携带 `management:read`，Ops management 页面也使用这个 scope 保护诊断能力。
- `internal/webui.Binding` 允许模块同时声明 route、navigation、locale；宿主只消费生成后的 manifest，不直接导入 Auth 模块。
- 2026-08-21 对 [Soybean 用户中心](https://soybeanjs.cn/user-center) 的观察仍只有“敬请期待”，没有可复核的账号编辑或密码写操作。

## 结论

最小闭环是由 Auth module 在自身 Binding 中声明 `auth.webui.session` operation 和 `auth.session` navigation，Composition 把 operation 装配到现有 `management:read` protected policy，宿主根据 manifest access 统一处理登录跳转。该方案复用现有 operation gate、Binding、Composition、manifest 和 i18n，不新增 API、Session 字段、数据库表或全局状态。

## 实施影响

- Go：新增 Auth-owned operation identity、policy 装配和 Catalog operation inventory 校验；增加 route/menu 与 manifest 测试。
- WebUI：新增 `user` menu icon 映射和 manifest-driven navigation 渲染测试；生成 registry revision 随 Catalog 变化更新。
- 产品：登录后可以从宿主侧栏进入“当前会话”；未登录时该菜单不会进入可访问菜单，直达 route 由宿主跳转登录。
- 非目标：不实现用户中心、密码修改、权限编辑或新的认证后端接口。

## 验证

已执行 Auth/Composition 定向 Go 测试、`go test ./...`、`pnpm test`、`pnpm lint`（含 i18n contract scan）、`pnpm typecheck`、`pnpm build`、`pnpm generate:check`、`pnpm lint:modules` 与 `git diff --check`。

本地浏览器视觉截图仍受项目自签名 HTTPS 证书限制，不能将其描述为已通过本地视觉门禁。
