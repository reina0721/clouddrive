# 044 任务清单

## 状态

- 研究门禁：已通过（`R001`）。
- 计划状态：已确认。
- 确认证据：用户在完整根因与修复范围报告后的后续消息明确要求“修复”。
- 初始 Git：`HEAD c7ef219`；用户修改 `webui/vite.config.ts` 为 `https: false`，其“让页面可打开”的意图纳入本修复。

## 任务

| ID | 任务 | 完成条件 | 状态 |
| --- | --- | --- | --- |
| RES-001 | 运行态、Chi 与 Vite 根因研究 | R001 门禁通过 | 已完成 |
| PLAN-001 | 需求、设计与任务确认 | 用户确认修复范围 | 已完成 |
| FIX-001 | 修复 HTTP mount prefix | manifest/Auth 完整路径到达内部相对 Handler | 已完成 |
| FIX-002 | 接入 Vite 本地 TLS 证书 | HTTPS 握手与页面请求成功 | 已完成 |
| TEST-001 | 增加路由测试并执行 Go/Node/TLS 门禁 | 全部适用检查通过 | 已完成 |
| DOC-001 | 更新本地启动排障说明 | 文档与真实行为一致 | 已完成 |
| GIT-001 | 审查并提交 | 仅 044 文件进入 Conventional Commit | 已完成 |

## 验证证据

| 检查 | 结果 |
| --- | --- |
| `go test ./internal/composition -run TestApplicationRouterStripsAdminPrefixForStandardHandlers -count=1` | 通过 |
| `go test ./internal/composition ./internal/kernel/composition` | 通过 |
| `pnpm lint`、`pnpm typecheck`、`pnpm build`、`pnpm generate:check` | 通过 |
| 独立端口 `https://127.0.0.1:5174/` | TLS 握手成功，返回 200 |
| 独立端口后端 `8081`/management `9091` | manifest 返回 200，未登录 session 返回 401，readyz 返回 200 |
| `go test ./...` | 除 `cmd/app` 外其余包通过；两个进程级用例因用户现有后端占用固定端口 `9090` 失败，未停止该用户进程 |
