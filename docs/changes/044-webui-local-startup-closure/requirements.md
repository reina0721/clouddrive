# 044 WebUI 本地启动闭环修复需求

## 要求

| ID | 要求 |
| --- | --- |
| REQ-001 | `/api/v1/admin/manifest` 必须到达 manifest Handler，不再由嵌套 ServeMux 返回 404。 |
| REQ-002 | `/api/v1/admin/auth/*` 必须以相对路径到达 Auth Handler；普通 API 行为不变。 |
| REQ-003 | Vite 本地开发必须提供可完成 TLS 握手的自签名证书，并继续使用 HTTPS。 |
| REQ-004 | 不允许用 HTTP、移除 Cookie `Secure` 或扩大 Session 使用范围作为降级。 |
| REQ-005 | 保留用户希望“页面可打开”的修改意图，但用正式 TLS 修复替代 `https: false`。 |
| REQ-006 | 补充后端路由回归测试、前端静态门禁和真实 TLS 启动探测。 |
| REQ-007 | 启动文档说明首次证书警告、后端重启和成功探测方式。 |

## 非目标

- 不实施 043 `admin -> webui` 命名迁移。
- 不增加生产 TLS、反向代理或证书签发系统。
- 不改变 Auth、Session、CSRF、Cookie 属性、数据库 schema 或 migration 版本。

## 验收

- Go 定向测试通过并覆盖 manifest/Auth prefix stripping；全量测试若受用户现有监听进程影响，必须记录冲突端口且不得擅自停止该进程。
- `pnpm lint/typecheck/build/generate:check` 通过。
- 独立端口启动 Vite 后，忽略本地信任校验的 HTTPS 探测返回 200，不出现 TLS handshake failure。
- 文档链接与 `git diff --check` 通过，用户已有修改不被无关覆盖。
