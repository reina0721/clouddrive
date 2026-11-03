# 研究报告

## 研究问题

验证 049 报告列出的三个非文档缺口是否有明确的现有接入点，且实施不会扩大到业务功能、运行时后端或外部协议验收。

## 事实

- 三个 WebUI lint 脚本均直接写入 `auth`/`ops` 目录；仓库的 Go Catalog 和 WebUI registry 已按模块目录动态生成，因此共享目录发现不会改变运行时契约。
- `webui/package.json` 已有 lint、typecheck、test、build 和 `generate:check` 入口；`pnpm-lock.yaml` 为 lockfile v9，本地 pnpm 为 10.22.0，适合使用 frozen install。
- Playwright 配置会启动 Vite 并把 API 代理到 8080/9090，静态脚本不具备完整后端运行前提，因此 E2E 应继续独立。
- quality workflow 当前只有 Go 质量 job；release workflow 当前只执行 Go 质量脚本。
- Dockerfile 的 license label 为 `NOASSERTION`，而仓库许可声明为 Apache-2.0。

## 推断

- 可以通过一个只读目录发现模块根的共享脚本消除三份固定白名单；保持稳定排序可使错误输出和 CI 结果可复现。
- 可以复用现有 package scripts 建立不启动后端的跨平台静态门禁，并将其作为 quality/release 的独立步骤。
- 许可证标签只需元数据修复，不需要改变镜像构建或发布流程。

## 适用范围与局限

结论适用于当前仓库目录布局、Node `24.11.1`、pnpm `10.22.0` 和现有 GitHub Actions。真实外部服务、Playwright 浏览器/视觉证据、Docker runtime、RabbitMQ/Redis/远端 release 仍需各自环境验证，本研究不把它们写成已通过。

## 对本任务的影响

研究门禁通过；可以在 050 中实施动态扫描、静态门禁接入和 license label 修复。若新增 WebUI 模块目录结构或需要把 E2E 纳入 CI，应另建研究和计划。
