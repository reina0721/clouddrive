# clouddrive 项目范围

当前构建范围是根目录 Go 后端与 frontend/ 内完整 console-web 工作区。后端来自 community-go main，前端来自 dsh/117-page-transitions；完整提交号见 SOURCES.json。

源码快照导入保留当前 Git 仓库和 origin，不引入源仓库历史或嵌套 Git。community-go 的 frontend、webui、old-frontend、old-backend 未导入。后端纯 Go 菜单、模块及权限元数据保留；不再加载旧浏览器源码或构建旧 SPA。

Next.js 4173 与 Go 8080/9090 分进程运行；默认 Cookie 会话及真实接口模式。原生 /api/v1 保留，/api/console/v1 投影复用 IAM、组织、导航、Todo、执行和调度能力，不建立第二套认证授权。

当前范围为私有文件管理以及身份、权限、组织、导航、字典、通知、工作台、分析、运维和 API 工作台。文件管理包含七批 140 项私有标签、自定义属性、图标与目录颜色、批量整理、高级条件检索、普通分页视图、列偏好、范围选择、分享快捷方式、侧栏固定、目录、分块续传、持久传输中心、WebDAV 连接与挂载管理、复制、文本编辑、媒体、只读分享、搜索视图与回收恢复能力，采用现有 IAM、数据库和 Storage；[文件管理运行说明](operations/file-management.md)是其限制与使用方式的 authority。账号共享协作、WebDAV 锁、离线下载、版本历史及 Office 在线协作仍未实现。纯 UI 展示与参考页面保留演示用途。

[当前开发入口](getting-started/local-development.md) 与 [部署说明](operations/clouddrive-deployment.md) 优先于源项目历史变更记录。docs/changes 和 frontend/docs/changes 中的旧记录用于追溯，不作为当前启动命令。
