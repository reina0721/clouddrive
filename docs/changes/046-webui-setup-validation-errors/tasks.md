# 046 任务清单

## 状态

- 研究门禁：已通过（`R001`）。
- 计划状态：已确认。
- 确认证据：用户在 046 计划报告后的后续消息明确回复“确认执行046”。
- Git 基线：`HEAD 2064f42`；实施前受跟踪工作树干净，本地 `config.yaml` 被忽略。

## 任务

| ID | 依赖 | 任务 | 完成条件 | 状态 |
| --- | --- | --- | --- | --- |
| RES-001 | 无 | 复核运行日志、SQLite schema、Service 和 HTTP 错误路径 | R001 门禁通过 | 已完成 |
| PLAN-001 | RES-001 | 形成窄错误契约与 UI 提示计划 | 需求、设计、任务可确认 | 已完成 |
| ERR-001 | 用户确认 | 建立用户名/密码 typed validation errors | 规则不变且可由 `errors.Is` 识别 | 已完成 |
| HTTP-001 | ERR-001 | 映射稳定 400 code 并补负向测试 | 输入错误不再成为 500，未知错误仍为 500 | 已完成 |
| UI-001 | HTTP-001 | 增加约束说明、表单属性和中文错误提示 | 用户提交前可见规则，失败信息可操作 | 已完成 |
| DOC-001 | UI-001 | 更新 WebUI 排障说明与任务证据 | 当前使用文档与实现一致 | 已完成 |
| VER-001 | 全部 | 执行 Go/Node/运行态/低敏审计 | 全部验收通过且无凭据进入 Git | 已完成 |
| GIT-001 | VER-001 | 精确审查并提交 | 仅 046 实现进入 Conventional Commit | 已完成 |

## 验证证据

| 检查 | 结果 |
| --- | --- |
| `go test ./...` | 通过 |
| `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm generate:check` | 通过；前端错误翻译 2 个测试通过 |
| 短密码经真实 HTTP setup | 返回 `400 password_length_invalid` |
| 合法输入经真实 HTTP setup | 返回 `201`，用户名与 WebUI Session Cookie 正确 |
| 未配置的跨域 Origin | 返回 `403 cors_origin_denied` |
| 隔离 management `/readyz` | 返回 `200` |
| 临时凭据与数据库 | 验证后已删除，未进入 Git |

GIT-001 由本次实现提交完成；提交只包含本任务文件，不包含本地 `config.yaml`、数据库或凭据。

## 已知观察

外层 HTTP access log 对 Handler 直接写出的 400/401 仍记录通用 `internal_server_error` 字段，浏览器收到的 HTTP status/code 正确。该问题是既有的全局日志归类缺口，不改变 046 的响应契约，后续应在独立任务中统一修复 Router/Handler 的响应诊断。

## 重新确认触发器

- 修改密码长度、哈希、Setup Token、Session、Cookie 或登录防枚举语义；
- 修改全局 HTTP problem 格式或其他模块错误契约；
- 需要数据库迁移、数据删除或外部系统写入；
- 需要返回字段级详细数据而不只是稳定 code。
