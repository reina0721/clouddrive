# clouddrive

基于 community-go 后端和 console-web 前端整合的文件与管理工作区。提供私有目录、上传续传、复制与编辑、ZIP/7Z、搜索、回收恢复、媒体阅读和分享协作，以及账户、权限、组织、导航、通知、待办与运维能力。文件入口 `/home`，管理入口 `/workspace`。

## 当前项目目标语境

当前处于本地整合阶段，没有对外发布兼容承诺。已导入源码快照，不导入上游数据库或凭据；本地数据库与文件必须保留，不因尚未发布而重置。当前范围与限制见[项目范围](docs/repository-scope.md)，具体使用方式以[文件管理](docs/operations/file-management.md)为准。

Go 服务位于根目录，Next.js/pnpm 工作区位于 frontend/。网页默认 http://127.0.0.1:4173，同源代理访问 Go API 8080 与 management 9090；Go 不构建或托管旧前端。

## 本地启动

需要 Go 1.26.10、Node >=22.18（验证工具采用 Node 24）、pnpm 10.22.0。完整前置与跨平台命令见[本地开发](docs/getting-started/local-development.md)。

```bash
node scripts/dev.mjs --prepare
# 首次访问 http://127.0.0.1:4173/setup；Ctrl+C 停止所拥有的服务
# 隔离真实预览：node scripts/dev.mjs --preview
```

统一入口使用 Node 24，按需生成本地配置、迁移数据库并验证前后端就绪；已有数据保留。日志在 `.data/dev/`，设置令牌在 `.data/dev/setup-token`。Windows 既有 `Start-Dev.ps1` / `Stop-Dev.ps1` 仍可使用。完整参数、预览账号与排障见[本地开发](docs/getting-started/local-development.md)。

界面统一采用 [Material Design 3](frontend/docs/ui-visual-calibration.md)，设计 Token 与交互组件由公共基础层管理。

## 开发与验证

普通任务按[Agent 日常流程](docs/development/agent-workflow.md)执行，不要求整套任务档案。日常检查先看影响范围：

```bash
node scripts/verify-changed.mjs --dry-run
node scripts/verify-changed.mjs
```

[验证策略](docs/development/validation.md)说明环境准备、缓存、定向浏览器与完整回归。完整后端入口为 `scripts/Verify-Quality.ps1` / `verify-quality.sh`；完整前端入口为 `scripts/Verify-WebUI.ps1` / `verify-webui.sh`，首次准备显式使用 `-Prepare` / `--prepare`。`scripts/Test-Integration.ps1` 使用独立数据库做真实浏览器验收。

独立文件预览使用 `scripts/Start-FilePreview.ps1`，默认 4180/8120/9120 端口，保留开发数据库并使用 `.data/file-preview/`；账号与预览资料仅保存于本地忽略目录。不要把共享用户数据当测试夹具。

## 文档与来源

- [文档入口](docs/README.md)、[前端工程](frontend/README.md)
- [部署与安全配置](docs/operations/clouddrive-deployment.md)、[API](api/README.md)
- [架构](docs/architecture/README.md)、[重要 ADR](docs/architecture/adr/README.md)
- [完整来源与提交号](SOURCES.json)、[来源记录](docs/provenance/README.md)

原许可证、版权及来源记录保留。历史变更通过 Git 查阅，工作树不保存按任务编号的变更档案。
