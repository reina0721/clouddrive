# clouddrive API 契约

- openapi.yaml：原生 /api/v1 的 Huma code-first 契约；go generate ./internal/transport/http/api 生成，并由 Go golden 测试验证。
- console-openapi.json：/api/console/v1 投影与原生转发接口的 OpenAPI 3.0 文档；从 console-web 的响应/输入校验器和原生 Huma JSON 快照生成。
- internal/transport/http/api/operation_inventory.gen.go：原生 operation 清单，继续参与服务端 operation 授权。

~~~powershell
go generate ./internal/transport/http/api
# 在 frontend 内执行
npx --yes pnpm@10.22.0 codegen:contracts
npx --yes pnpm@10.22.0 codegen:contracts:check
~~~

身份使用 HttpOnly Cookie。所有控制台写请求必须携带受信任 Origin、控制台 CSRF Cookie 和 X-CSRF-Token；GET /api/console/v1/auth/csrf 返回双提交令牌。原生转发还会执行原生权限和 CSRF 检查。

控制台错误为 {error:{code,reason?}}；分页默认 page=1/pageSize=20，允许 10/20/50。身份与字典写入携带 version；工作区 PUT 使用 If-Match 和响应 ETag；定时任务携带 version，删除任务使用 version 查询参数。冲突返回 409，不自动覆盖服务器数据。

通知与 API 工作区、历史、任务按用户隔离。API 执行权限为 console:workbench:execute；任务写入还需要 console:workbench:write。目标地址、取消、超时和响应限制由服务端执行；不支持的指纹/代理功能返回明确失败。
