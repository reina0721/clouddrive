# clouddrive

基于 community-go 后端和 console-web 前端整合的文件与管理工作区。当前提供私有文件目录、目录/剪贴板上传、复制/编辑/ZIP、搜索分类、回收恢复、媒体画廊和分享链接协作，同时保留账户、权限、组织、导航、字典、通知、待办、运行状态和 API 工作台。文件入口为 `/home`，管理入口为 `/workspace`。

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

文件区新增后台解压任务页。无密码 ZIP/7Z 支持排队、进度、结果和取消待处理任务。有密码的 7Z 继续在当前页面解压。详见[144变更](docs/changes/144-background-archive-tasks/README.md)。

文件和目录菜单以及多选工具栏支持后台创建 ZIP。指定文件名和保存目录后，可在任务页定位或下载结果。详见[145变更](docs/changes/145-background-zip-creation/README.md)。

后台任务页汇总本人 ZIP 创建、解压、HTTP 和 BitTorrent 下载，支持类型、状态及名称筛选。下载卡片可跳到对应详情。详见[146变更](docs/changes/146-unified-background-tasks/README.md)。

本人视频预览支持同目录 VTT、SRT、ASS 外挂字幕。播放器自动选择同名字幕，也可手动切换或关闭。详见[147变更](docs/changes/147-external-video-subtitles/README.md)。

回收站支持永久删除本人文件和目录，可单选、多选或一键清空本人回收站。确认前展示实际范围和可释放的账户配额。详见[148变更](docs/changes/148-trash-permanent-removal/README.md)。

在回收站可设置本人保留天数。默认手动清理；启用后，今后移入的项目会显示到期时间，服务后台按该时间清理。详见[149变更](docs/changes/149-trash-retention/README.md)。

文件菜单和多选工具栏可获取直链，同一文件复用已有地址。“我的分享”提供直链管理和撤销。详见[150变更](docs/changes/150-file-direct-links/README.md)。

管理面板提供只读文件清单，持有独立权限的用户可跨账号过滤、排序和查阅文件详情。详见[151变更](docs/changes/151-admin-file-inventory/README.md)。

管理面板的“文件 Blob”可查阅已引用的主存储对象、当前和历史引用、关联文件及对象存在状态。详见[152变更](docs/changes/152-admin-blob-catalog/README.md)。

文件 Blob 的“待回收”页显示失去引用的已登记对象。独立授权的管理员可在保护期后清理；自动回收可由运维开启。详见[153变更](docs/changes/153-blob-reclamation/README.md)。

管理区的“文件系统”页显示部署值、已保存值与当前生效值，可调整文本、批量、版本和回收参数。保存后通过服务重启统一应用。详见[154变更](docs/changes/154-filesystem-settings/README.md)。

“文件系统”的“自定义属性”页可管理全局属性定义。文件所有者可在属性侧栏选择定义并填写对应类型的值。详见[155变更](docs/changes/155-property-definitions/README.md)。

管理区的“分享管理”页可按分享者、源文件和状态查看链接与活动。获准的管理者可单独或批量撤销链接，源文件仍由原所有者管理。详见[156变更](docs/changes/156-admin-share-management/README.md)。

管理区的“后台任务管理”页提供跨账号归档和下载查询。获准的管理者可以预览并清理终态任务，保留已发布文件。详见[157变更](docs/changes/157-admin-background-tasks/README.md)。

当前会话密码解锁已补齐，输错可重试、共享账号失败预算，详见[142变更](docs/changes/142-session-password-unlock/README.md)。本批20项使用行为不增加20个独立功能计数；客户端遮挡仍不是服务端授权边界。

WebDAV持久独占写锁已接入真实协议、所有文件保存及上传最终发布；连接页可查看和按版本解除占用，详见[141变更](docs/changes/141-webdav-write-locks/README.md)。本批20项按使用行为验收，不等同Office服务或系统驱动全量兼容。

账号版本保留设置已接入真实文本、上传及WebDAV覆盖，详见[140变更](docs/changes/140-history-preferences/README.md)。数量上限仅在后续成功覆盖时处理旧关联，服务端预算继续有效；本批仍按20项使用行为验收，验证状态以任务清单为准。

文件时间现统一消费区域偏好，分享自定义到期时间支持明确时区与夏令时校验，详见[139变更](docs/changes/139-file-time-zones/README.md)。本批仍按20项使用行为验收，不虚增独立功能计数；可配置版本保留由140补齐，边界见文件管理手册。

新增真实私有目录树、逐层分页、路径跟随、设备开关和键盘导航；桌面与移动导航共用缓存及上传运行域，详见[138变更](docs/changes/138-directory-tree/README.md)。本批20项为使用行为验收，功能累计仍按原300项口径，不等同于Cloudreve全量对齐。

文件偏好新增按账号的服务器同步、各目录视图记忆、全局默认与重置，以及文件夹单击操作；实现与验证见[137变更](docs/changes/137-file-preferences/README.md)。本批20项使用行为包含既有能力的保存语义改进，不据此增加20项独立功能计数。

当前处于本地整合阶段，没有对外发布兼容承诺；仅导入源码快照，不导入源数据库或凭据。本地数据库与文件必须保留，不能因项目尚未发布而重置。文件专项已验收十五批共 300 项能力；第十五批新增分享受众与子项继承权限。第十四批新增真实PDF阅读、分页缩放旋转、文字选择查找、缩略图与大纲、内部导航、加密密码重试、临时文字/高亮/手绘标注与含标注副本导出；第十三批新增本人ZIP/7Z浏览、目录导航、搜索排序、文本与图像预览、成员与所选打包下载、目标选择、三种冲突策略、原子解压、7Z密码及结果回执；第十二批统一六页文件工作区，提供全局创建、目标选择、搜索、存储配额、上传队列与账户工具；第十一批新增分享权限、链接设置、访客文字与媒体预览、真实上传、目录整理及逐项批量协作；第十批新增HTTP/HTTPS离线下载、真实进度、暂停续传、任务恢复、目标修正与批量控制；第九批新增私有版本历史、上传新版本、旧版预览/下载/恢复/另存/清理和并排比较；前八批包含紧凑导航、目录路径操作、选择反选、跨目录剪切/复制/粘贴、私有标签、自定义属性、Emoji/目录颜色、原子批量整理、属性筛选、高级搜索、分页视图、列偏好、范围选择、文件、只读分享、持久续传、WebDAV 连接、分享快捷方式与侧栏固定，提供 `/home/shared`、`/home/transfers` 和 `/home/connections`。另完成[136视觉收口](docs/changes/136-file-workspace-density/README.md)的20项布局与交互修正；功能数量仍为300项。分享受众验收见[135变更](docs/changes/135-share-audience/README.md)，第十四批见[134变更](docs/changes/134-pdf-reader/README.md)，第十三批见[133变更](docs/changes/133-archive-browser/README.md)，第十二批见[131变更](docs/changes/131-file-workspace/README.md)，其剩余4组截图检查已由[132视觉收口](docs/changes/132-visual-regression-closeout/README.md)定向验证通过，不表示全站423例已重新运行。[143变更](docs/changes/143-bittorrent-downloads/README.md)接入受信aria2节点的BT v1磁力与种子、多文件选择、恢复和真实转存；无共享挂载的远程下载代理、脱离链接的账号挂载共享和 Office 仍未实现；文件页已接入当前会话密码解锁，仍只是当前标签页的客户端遮挡，详见142变更；其他差距后续按批次补齐。
