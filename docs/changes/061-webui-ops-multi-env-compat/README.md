# 061 WebUI 多环境数据源兼容（含全 WebUI mock）

## 状态

**已确认，实施完成**（用户已确认计划并采纳决策 1–5 推荐项；全部任务已完成并提交，证据见 [tasks.md](tasks.md)）。验证摘要：Go `go test ./...`、`go vet ./...` 通过；WebUI `typecheck`/`eslint`/`lint:modules`/`lint:i18n`/`lint:architecture`/`generate:check`/`test`（65 Vitest）/`build` 通过；Playwright mock project（零后端整 WebUI）与 dev project（10 用例）本机通过；模式 B 冒烟：`/` SPA 200、`/management/build` 200、`/management/readyz` 200 JSON、`/management/nope` 404 JSON Problem。托管模式完整浏览器会话验收记录为 CI/后续项。

## 范围

- **修复默认启动 4xx**：模式 B（`server-hosted`，默认声明）业务 listener 挂载受保护 management facade（复用同一 handler 与鉴别/授权/预算语义），未知子路径保持 JSON 404、不回退 SPA；模式 A（`separated`）Vite 去前缀代理 9090，现状不回归。
- **整个 WebUI mock**：显式声明 `mock` 时，宿主 SDK 传输层切换本地 mock router——宿主骨架（manifest/session/logout）与全部模块数据（IAM/Organization/Navigation/Ops）均为本地 mock，零后端可完整运行，全局“模拟环境 / Mock environment”徽标（i18n 双语）随时标识；mock manifest 由 Go catalog 投影生成保证 revision 一致；模块 mock 数据模块自有（`binding/webui/web/mock.ts` + 生成 `webuiMockRegistry`）。
- **显式环境声明**：`VITE_WEBUI_DATA_SOURCE`（`server-hosted` 默认 / `separated` / `mock`）经 typed 解析器校验，非法值 tooling 启动前失败、客户端回退默认；mock 只在显式声明时启用。

## 阅读顺序

1. [研究档案](research/README.md)：R061-001（真实通路 4xx 根因）、R061-002（全 WebUI mock 设计与归属）。
2. [需求](requirements.md)：目标、REQ-061-001..012、验收标准与边界。
3. [设计](design.md)：服务端 facade、环境声明、host mock 传输层、模块 mock 注册表与生成、全局标识、Ops 分级、待确认决策。
4. [任务清单](tasks.md)：任务 ID、依赖、验证矩阵与触发器。

## 待确认决策

- 决策 1（必要）：接受模式 B 业务 listener 暴露受保护 management facade（改动 024 `OPS-REQ-001` 适用范围，模式 A 保持不暴露）。
- 决策 2：模块自有 mock 源 + 生成 registry + 新增 SDK 能力 `mock`（推荐，符合模块所有权；备选宿主集中不推荐）。
- 决策 3：mock manifest 由 Go catalog 投影生成（推荐，revision 一致；备选手写 fixtuire 会漂移）。
- 决策 4：未知 `/management/*` 保持 JSON Problem 404（推荐）。
- 决策 5：托管构建脚本 `webui build` 拒绝 `mock` 声明（推荐，普通 `pnpm build` 供 mock 演示）。