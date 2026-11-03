# 045 任务清单

## 状态

- 研究门禁：已通过（`R001`）。
- 计划状态：已确认。
- 确认证据：用户在 045 计划报告后的后续消息明确回复“确认修复”。
- Git 基线：计划提交 `5369d37`，实施前工作树干净。

## 任务

| ID | 依赖 | 任务 | 完成条件 | 状态 |
| --- | --- | --- | --- | --- |
| RES-001 | 无 | 复核 CORS、Auth Origin、Vite 和运行配置 | R001 门禁通过 | 已完成 |
| PLAN-001 | RES-001 | 形成安全单轨修复计划 | 需求、设计、任务可确认 | 已完成 |
| HTTP-001 | 用户确认 | 修正 CORS 同源识别并补测试 | 同源通过、跨域默认拒绝 | 已完成 |
| AUTH-001 | HTTP-001 | 把 HTTP allowlist 注入 WebUI Auth | 两层使用同一候选配置 | 已完成 |
| DEV-001 | AUTH-001 | 固定 Vite 端口并更新样例、指南、本地配置 | 两个本地 HTTPS Origin 精确允许 | 已完成 |
| UI-001 | 用户确认 | 遮罩 Setup Token 输入 | 页面不再明文显示 Token | 已完成 |
| VER-001 | 全部 | 执行 Go/Node/代理运行态/低敏审计 | 所有验收通过且无凭据进入 Git | 已完成 |
| GIT-001 | VER-001 | 精确审查并提交 | 仅 045 实现进入 Conventional Commit | 已完成 |

## 验证证据

| 检查 | 结果 |
| --- | --- |
| `go test ./...` | 通过 |
| `pnpm lint`、`pnpm typecheck`、`pnpm build`、`pnpm generate:check` | 通过 |
| 经 `https://localhost:5173` 代理执行首次 setup | 返回 `201` 并设置 WebUI Session Cookie |
| 使用未配置的跨域 Origin 请求 Auth | 返回 `403 cors_origin_denied` |
| 临时后端 `/readyz` | 返回 `200` |
| 临时凭据与数据库 | 验证后已删除，未进入 Git |

GIT-001 由本次实现提交完成；提交只包含本任务跟踪文件，本地忽略的 `config.yaml` 不进入版本库。

## 重新确认触发器

- 需要支持任意 Vite 端口、通配 Origin 或生产域名；
- 需要信任 `Forwarded`/`X-Forwarded-*` 或设计生产反向代理；
- 需要修改 Cookie、CSRF Token 或 Session 语义；
- 需要自动修改数据库或保留截图中已经泄露的 Token。
