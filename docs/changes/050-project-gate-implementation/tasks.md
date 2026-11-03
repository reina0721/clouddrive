# 任务

| ID | 任务 | 状态 | 完成条件与证据 |
|---|---|---|---|
| `WEBUI-050-001` | 建立共享动态模块根目录发现，并迁移三类 WebUI lint | 已完成 | `webui/scripts/module-roots.mjs`；三个 lint 脚本无模块 ID 白名单；WebUI lint 通过 |
| `WEBUI-050-002` | 增加 Windows/Linux WebUI 静态质量脚本并固定 Node/pnpm | 已完成 | `scripts/Verify-WebUI.ps1`、`scripts/verify-webui.sh`、`webui/package.json`；本地脚本链通过 |
| `WEBUI-050-003` | 接入 quality/release workflow | 已完成 | `.github/workflows/quality.yml` 与 `release.yml` 含 WebUI 静态 job/step |
| `WEBUI-050-004` | 对齐 Docker OCI license label | 已完成 | `Dockerfile` 使用 `Apache-2.0` |
| `WEBUI-050-005` | 更新当前主题文档与变更导航 | 已完成 | WebUI、构建容器、发布文档和本目录证据同步 |
| `WEBUI-050-006` | 完成范围内验证并记录未执行外部验收 | 已完成（Windows/Go） | `go test`、Windows WebUI 静态总入口、WebUI lint/typecheck/test/build、动态发现输出和 `git diff --check` 通过；本机无可用 `bash`，Linux shell 入口未执行；E2E/外部协议未执行 |
