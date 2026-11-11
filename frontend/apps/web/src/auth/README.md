# Web Host 认证与账户边界

当前 CloudDrive 使用 Go IAM 的真实 Cookie 会话，Web Host 通过 `createBackendAuthService` 访问同源 `/api/console/v1`。身份、权限、注册策略和会话撤销由服务端决定；本目录拥有浏览器传输与应用生命周期，不实现另一套生产身份库。部署和 Cookie/Origin 边界见[部署说明](../../../../../docs/operations/clouddrive-deployment.md)。

## 入口与配置

`NEXT_PUBLIC_AUTH_MODE=backend` 选择当前真实适配器，`NEXT_PUBLIC_AUTH_API_BASE_URL=/api/console/v1` 使用 Next 同源代理。显式 `mock` 模式只用于确定性前端参考与测试，其本地账号和权限不能证明真实后端可用；Backend 失败不会回退模拟身份。完整契约见[API 说明](../../../../../api/README.md)。

| 入口                  | 职责                                               |
| --------------------- | -------------------------------------------------- |
| `backend-adapter.ts`  | 会话恢复、登录、注册、MFA challenge 与退出。       |
| `contract.ts`         | Host 认证类型、响应校验与安全返回地址。            |
| `account-boundary.ts` | 进入新账号的受保护树前，清理旧账号的本地业务状态。 |
| `unlock.ts`           | 当前会话密码复核，不创建新登录会话。               |
| `mock-adapter.ts`     | 显式 mock 模式下的本地演示实现。                   |

## 请求与会话

`GET /auth/csrf` 提供写请求所需令牌；登录与注册使用各自 POST 入口，随后重新读取 `GET /auth/session` 确认当前会话。响应经 `readSession` 校验，`expiresAt` 为 Unix 毫秒。MFA challenge 只在当前适配器内存中保留，不把它写入 URL 或本地持久存储。

JSON 客户端统一处理 `credentials:include`、`cache:no-store`、CSRF、取消、超时与协议错误。恢复时的 401 表示无有效会话；登录凭据错误、限流、403、账号冲突及服务失败保留各自语义。不得把错误转换为模拟用户或认证成功。

会话资料只在内存持有，JWT、会话凭据和密码不保存到 LocalStorage。Cookie 的有效性与当前服务端权限仍会在实际请求中判断；前端隐藏按钮和页面守卫不能替代服务端授权。注册页仅提交注册输入，角色与权限来自服务器策略。

## 页面和资源生命周期

首次会话恢复完成前，受保护子树保持隐藏。到期与可见性恢复触发复核；退出先隐藏受保护内容，再等待服务器结果。退出失败保留错误与重试入口，不继续展示旧账号内容。

账号变化时，`applyAccountBoundary` 先清理旧账号的草稿、工作区记录、收藏、通知和页签，仅保留明确属于设备的偏好。持久化清理失败必须阻止进入新账号内容；FilesRuntime 等账号所属资源同时由应用组合边界取消并释放。

安全 `returnTo` 只接受允许的站内路径，拒绝外站及循环认证跳转。分享凭据片段与返回路径分开保留，登录后由浏览器重组；不把公开凭据放入 query 或传给私有文件 Port。

锁屏是当前浏览器的界面遮挡。密码复核调用既有会话入口，不是新的登录，也不是可重复使用的高风险操作授权票据。账户密码、会话管理及服务端限制以真实 API 和[文件工作区说明](../../../../../docs/operations/file-management.md)为准。

## 验证

Host 单元测试验证适配器错误与生命周期，确定性浏览器验证表单、返回地址和界面；真实登录、权限、会话与文件操作需使用独立后端验收。按[统一验证策略](../../../../../docs/development/validation.md)分别记录范围，不沿用旧“尚未提供正式 API”的集成假设，也不以 mock 结果宣称服务端验证通过。
