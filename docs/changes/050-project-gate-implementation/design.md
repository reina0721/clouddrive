# 设计

## 动态模块发现

新增 `webui/scripts/module-roots.mjs`，以仓库根为输入扫描 `internal/module` 的直接子目录，选择存在的 `binding/webui/web` 目录，按模块 ID 稳定排序并返回绝对路径。`lint-modules.mjs`、`lint-i18n-contract.mjs` 和 `lint-architecture.mjs` 只依赖该结果，不再维护模块 ID 白名单。没有 WebUI 模块时，扫描脚本仍应成功并输出既有通过信息。

平台宿主代码继续由 `lint-architecture.mjs` 单独检查；动态发现只负责扩大业务模块扫描范围，不改变既有禁止平台选择器和跨边界导入的规则。

## WebUI 静态质量链

`Verify-WebUI.ps1` 与 `verify-webui.sh` 在仓库根执行以下固定链：

1. `go run ./cmd/app webui generate --check`
2. `pnpm install --frozen-lockfile`（工作目录 `webui`）
3. `pnpm lint`
4. `pnpm lint:modules`
5. `pnpm typecheck`
6. `pnpm test`
7. `pnpm build`

脚本不启动 Go 服务；Playwright `e2e` 仍需独立后端和运行环境，不属于该门禁。

## CI 与发布

quality workflow 增加 Windows/Linux WebUI job，分别调用 PowerShell/bash 脚本；release job 在 Go release gate 前调用 Linux WebUI 脚本。Node 使用 `24.11.1`，pnpm 使用 `10.22.0`，并通过 `packageManager` 和 frozen lockfile 固定依赖解析。

## 许可证元数据

Dockerfile OCI label 使用 SPDX 识别值 `Apache-2.0`，与仓库根 `LICENSE`、`NOTICE` 和 README 的声明一致。

## 失败语义

脚本启用严格错误传播；生成检查、安装、lint、类型检查、测试或构建失败均阻止后续步骤和 job 成功。动态目录读取失败也直接失败，不静默回退到旧固定列表。
