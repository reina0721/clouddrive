# 需求

## 目标

让项目规范中声明的 WebUI 模块边界、静态质量门禁和许可证元数据在实际可执行入口中命中，而不是依赖固定模块名、仅运行 Go 检查或保留占位许可证值。

## 范围

- 为 WebUI 三类架构/i18n/模块 lint 共享动态模块根目录发现逻辑。
- 保持现有平台样式选择器、跨模块导入、旧别名和第三方客户端直连等检查语义。
- 提供 Windows PowerShell 与 Linux shell 的 WebUI 静态门禁脚本。
- 将 WebUI 静态门禁接入 CI quality 的 Windows/Linux job 与 release job。
- 固定 pnpm 版本，保证跨环境安装使用 lockfile。
- 将 Docker OCI license label 与 `LICENSE`/`NOTICE`/README 声明的 `Apache-2.0` 对齐。

## 非目标

- 不实现新的 WebUI 页面、业务能力或模块契约。
- 不把 Playwright E2E、视觉验收、Go 服务启动、外部数据库/消息协议或 Docker runtime 纳入静态脚本。
- 不改变 Go Catalog、WebUI registry 或运行时路由语义。

## 验收标准

- 新增或删除 `internal/module/<id>/binding/webui/web` 后，三类 WebUI lint 自动覆盖实际目录，不需修改脚本中的模块 ID。
- Windows/Linux 脚本按“生成检查、冻结安装、lint、模块 lint、typecheck、test、build”顺序执行，并在任一步失败时退出。
- quality workflow 两个平台和 release workflow 均调用对应 WebUI 静态门禁。
- `webui/package.json` 声明 `pnpm@10.22.0`，CI 使用 Node `24.11.1` 与该 pnpm 版本。
- Dockerfile 的 `org.opencontainers.image.licenses` 为 `Apache-2.0`。
- 相关 Go、WebUI、脚本静态检查和文档链接验证通过；未执行的外部验收如实保留。
