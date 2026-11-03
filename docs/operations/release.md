# 发布

## 本地 release candidate

先安装固定版本工具，再构建本地候选：

```powershell
./scripts/Install-Tools.ps1
./scripts/Release-Local.ps1
```

Linux 使用 `scripts/install-tools.sh` 与 `scripts/release-local.sh`。工具目录和 release 输出目录由 `.scaffold/layout.json` 提供（当前输出位于忽略的 `dist/`），包括 Windows/Linux amd64 archive、`checksums.txt`、每个 archive 的 SPDX JSON SBOM，以及本轮临时密钥生成并立即验证的 checksum signature/bundle。临时私钥在脚本结束前删除；`local-rc.pub` 只证明该本地 artifact set 在本轮后未变化，不证明公开发布者身份。


本地候选不创建 tag、不 push、不创建 GitHub Release、不上传 image 或 attestation。

## 正式发布

正式流程只接受受保护的 `v*` tag，并进入 GitHub `release` environment 审批。workflow 使用固定工具版本，先运行 `scripts/verify-docs.sh` 的文档静态门禁，再运行 `scripts/verify-webui.sh` 的 WebUI 静态门禁，最后运行 `scripts/verify-quality.sh` 定义的 Go/生成物/仓库产物门禁，以 GoReleaser 创建 draft release，再使用 GitHub OIDC keyless identity 签名并验证 checksum bundle。Docs gate 检查当前 authority、链接、模块/能力索引和变更影响记录；它不启动 Go 服务或 Playwright。不得把 release job 描述成已经完成 E2E、视觉或外部协议验收。

审批者必须按同一 tag/source commit 核对独立 workflow 与任务证据，而不是只看 release job 自身：

- tag、source commit、`/build` 返回值和 archive build info 一致；
- Windows/Linux Go quality、SQLite/PostgreSQL/MySQL 和 container jobs 全部通过，并确认这些独立 workflow 对应同一 commit；
- 如果该 commit 影响 WebUI，按 [WebUI 开发指南](../development/webui.md) 保存 lint、module/i18n/architecture 覆盖、typecheck、unit、build 和 registry 证据；quality/release workflow 会执行对应静态链，但 E2E 与视觉证据仍需单独保存；
- checksum、SPDX SBOM 和 Sigstore bundle 都随 draft 提供；
- OpenAPI breaking 结论、migration/rollback 说明和已知限制已审阅；
- 项目源码和 Dockerfile 的 OCI `org.opencontainers.image.licenses` 均声明 `Apache-2.0`，与根 `LICENSE`、`NOTICE` 和 README 对齐；仍应在发布验收中确认最终镜像携带该 label。

workflow 只生成 draft，不替审批者发布。发布或撤销 release、tag、registry image 仍是外部副作用，必须另有明确授权。


clouddrive 发布包含 Go 与独立 Next 服务。Go archive 不内置前端，构建、同源代理及迁移按 [部署说明](clouddrive-deployment.md) 执行。
