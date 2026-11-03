# R001 WebUI 本地启动失败根因

## 1. 运行事实

- Go Service 的 `8080`、management 的 `9090` 和 Vite 的 `5173` 均处于监听状态。
- `/readyz` 返回 200，migration current/target 均为 4 且 compatible=true。
- `/api/v1/admin/manifest` 与 `/api/v1/admin/auth/session` 均由 Go Service 返回 404。
- Vite 配置为 `https: true` 时 TLS 握手失败；用户改为 `https: false` 后页面可加载，但这不能承载 `Secure` Session Cookie。

## 2. 后端根因

`applicationRouter` 把 `adminHandler` 挂载到 `/api/v1/admin`，内部 `http.ServeMux` 只注册 `/manifest` 与 `/auth/`。Chi `Mount` 通过自己的 `RoutePath` 继续路由，但调用普通 `http.Handler` 时保留原始 `request.URL.Path`。因此标准库 ServeMux 实际看到 `/api/v1/admin/manifest`，与 `/manifest` 不匹配并返回 404。

修复应在 Composition 挂载边界显式使用 `http.StripPrefix`，让通用 Handler 收到其声明的相对路径；不能让 Auth/manifest Handler 同时猜测两种路径。

## 3. 前端根因

Vite 官方说明 `server.https` 需要有效证书；`https: true` 不是证书来源。官方 `@vitejs/plugin-basic-ssl` 可为基础本地开发生成和缓存自签名证书。当前 package 未安装该插件，因此 5173 虽监听但 TLS 握手失败。

把 HTTPS 改成 HTTP 会使浏览器拒绝保存 `Secure` Cookie，不是有效降级。应安装官方插件、保持 HTTPS，并在文档中说明首次访问需要接受本地自签名证书警告。

## 4. 边界与结论

本轮不改变 043 目标命名，不引入生产证书治理，也不保留 HTTP Session 模式。关键根因已有运行态、源码、依赖源码和官方文档证据；研究门禁通过。用户已在诊断报告后的后续消息明确要求“修复”，计划确认成立。
