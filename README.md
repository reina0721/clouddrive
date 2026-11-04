# clouddrive

基于 community-go 后端和 console-web 前端整合的文件与管理工作区。当前提供私有文件目录、目录/剪贴板上传、复制/编辑/ZIP、搜索分类、回收恢复、媒体画廊和只读分享，同时保留账户、权限、组织、导航、字典、通知、待办、运行状态和 API 工作台。文件入口为 `/home`，管理入口为 `/workspace`。

Go 服务位于根目录，完整 Next.js/pnpm 工作区位于 frontend/。浏览器默认访问 http://127.0.0.1:4173，通过同源代理访问 Go API（8080）及受保护的 management 接口（9090）。Go 不再构建或托管旧前端。

## 本地启动

需要 Go 1.26.10、Node >=22.18、pnpm 10.22.0。脚本通过 npx 调用指定 pnpm，不修改全局版本。Go 可使用已安装版本或通过 -GoExecutable 指定独立工具路径。

```powershell
./scripts/Start-Dev.ps1
# 首次打开 http://127.0.0.1:4173/setup
# 设置令牌：.data/dev-setup-token；也可预先提供 APP_IAM__LOCAL__SETUPTOKEN
./scripts/Stop-Dev.ps1
```

脚本复制 config.example.yaml 为本地 config.yaml，迁移 SQLite 数据库，再启动两个进程。日志和进程记录保存在 .data/，不会提交数据库、令牌或凭据。默认使用真实后端；接口失败会显示错误，不回退模拟数据。

## 构建与验证

文件管理的独立预览使用 `./scripts/Start-FilePreview.ps1`：默认网页端口 4180、API 8120、management 9120。脚本保留原有开发数据库，使用 `.data/file-preview/`，每次重启后验证登录；预览地址、独立账号、密码与设置令牌保存在被 Git 忽略的 `.data/preview-access.json`。完整行为、限制与集中验收见[文件管理](docs/operations/file-management.md)。

```powershell
./scripts/Build.ps1
# 生产前端启动：在 frontend 下执行
npx --yes pnpm@10.22.0 --filter @clouddrive/web exec next start --hostname 127.0.0.1 --port 4173
# 返回项目根目录，启动后端前先执行迁移
./dist/clouddrive.exe db migrate up
./dist/clouddrive.exe
```

Go 检查入口：scripts/Verify-Quality.ps1；前端检查入口：scripts/Verify-WebUI.ps1。全新数据库的真实浏览器验收：scripts/Test-Integration.ps1。该验收使用独立目录和 8088/9098/4185 端口。

- [本地开发](docs/getting-started/local-development.md)
- [文档总入口](docs/README.md)
- [部署与安全配置](docs/operations/clouddrive-deployment.md)
- [接口说明](api/README.md)
- [来源与完整提交号](SOURCES.json)
- [实施状态与验证记录](docs/changes/118-clouddrive-integration/tasks.md)
- [前端架构与工作区命令](frontend/README.md)

源仓库以源码快照导入，未合并提交历史，保留当前仓库 origin。原许可证、版权及来源记录保留；各组件适用其原许可证。

## 当前项目目标语境

当前处于本地整合阶段，没有对外发布兼容承诺；仅导入源码快照，不导入源数据库或凭据。本地数据库与文件必须保留，不能因项目尚未发布而重置。现已验收七批共 140 项能力，第七批新增私有标签、自定义属性、Emoji/目录颜色、原子批量整理和属性筛选；前六批包含高级搜索、分页视图、列偏好、范围选择、文件、只读分享、持久续传、WebDAV 连接、分享快捷方式与侧栏固定，提供 `/home/shared`、`/home/transfers` 和 `/home/connections`。本批验收状态见[变更记录](docs/changes/126-file-annotations/README.md)。WebDAV 锁、离线下载、账号共享协作、版本历史和 Office 仍未实现，后续按批次补齐。
