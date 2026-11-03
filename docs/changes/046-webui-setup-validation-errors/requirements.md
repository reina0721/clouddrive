# 046 WebUI Setup 输入校验错误需求

## 要求

| ID | 要求 |
| --- | --- |
| REQ-001 | Setup 用户名为空或超过当前上限时必须返回 400 和稳定输入错误码，不得返回 500。 |
| REQ-002 | Setup 密码少于 15 或超过 128 个 rune 时必须返回 400 和稳定输入错误码，不得返回 500。 |
| REQ-003 | 未知哈希、随机数、事务和存储错误必须继续返回低敏 `500 internal_server_error`。 |
| REQ-004 | Login 必须继续使用 `401 invalid_credentials`，不得泄露用户名存在性或密码规则。 |
| REQ-005 | Setup 页面必须在输入前展示 15 至 128 字符要求，并把稳定错误码转换为可操作的中文提示。 |
| REQ-006 | 后端是输入约束 authority；前端约束只用于即时反馈，不能替代服务端校验。 |
| REQ-007 | 增加 Service/HTTP 错误映射测试和前端 lint、typecheck、build 验证。 |

## 非目标

- 不改变现有用户名上限、密码长度、密码哈希或 Setup Token 语义。
- 不修改数据库、migration、Session、Cookie、CORS 或 CSRF Origin。
- 不把整个项目的 HTTP 错误响应迁移到新协议。
- 不在日志或响应中输出密码、Token、哈希、数据库错误原文或请求 Body。

## 验收

- 短密码和非法用户名经 HTTP setup 返回 400 稳定 code，页面显示中文提示。
- 合法输入仍进入既有 setup 流程；无效 Token 仍为 401，setup 已关闭仍为 409。
- 注入未知 Service 错误时仍返回 500，响应不含内部原因。
- Go 全量测试和 WebUI lint/typecheck/build/generate clean check通过。
