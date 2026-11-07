# clouddrive 项目范围

当前构建范围是根目录 Go 后端与 frontend/ 内完整 console-web 工作区。后端来自 community-go main，前端来自 dsh/117-page-transitions；完整提交号见 SOURCES.json。

源码快照导入保留当前 Git 仓库和 origin，不引入源仓库历史或嵌套 Git。community-go 的 frontend、webui、old-frontend、old-backend 未导入。后端纯 Go 菜单、模块及权限元数据保留；不再加载旧浏览器源码或构建旧 SPA。

Next.js 4173 与 Go 8080/9090 分进程运行；默认 Cookie 会话及真实接口模式。原生 /api/v1 保留，/api/console/v1 投影复用 IAM、组织、导航、Todo、执行和调度能力，不建立第二套认证授权。

当前范围为私有文件管理以及身份、权限、组织、导航、字典、通知、工作台、分析、运维和 API 工作台。文件专项已验收十五批共300项，包含分享受众与子项继承权限。已验收范围包含真实PDF阅读、分页缩放旋转、文字选择查找、缩略图与大纲、内部导航、加密密码重试、临时文字/高亮/手绘标注与含标注副本导出，以及本人ZIP/7Z结构浏览、目录与路径导航、搜索排序、选择、安全文本与图像预览、成员与所选ZIP下载、目标选择、包裹目录、拒绝/跳过/改名的原子解压、加密7Z密码和结果回执，以及统一六页工作区、全局创建与目标选择、搜索、配额、上传队列与账户工具，以及分享链接权限与访客协作、HTTP/HTTPS离线任务、暂停续传与批量清理、私有版本历史、覆盖保留、上传新版本、历史恢复与清理、并排比较、响应式文件导航、路径与选择操作、同账号剪切/复制/粘贴、私有标签、自定义属性、图标与目录颜色、批量整理、高级条件检索、普通分页视图、列偏好、范围选择、分享快捷方式、侧栏固定、目录、分块续传、持久传输中心、WebDAV 连接与挂载管理、复制、文本编辑、媒体、搜索视图与回收恢复能力，采用现有 IAM、数据库和 Storage；[文件管理运行说明](operations/file-management.md)是其限制与使用方式的 authority。131通用 UI 检查留下的4组截图差异已由[132视觉收口](changes/132-visual-regression-closeout/verification.md)修复并通过相关41例，未重跑完整423例，不宣称全量质量命令通过。[143变更](changes/143-bittorrent-downloads/README.md)实现受信节点的BT v1磁力、种子和多文件转存；无共享挂载的远程代理、脱离分享链接的账号挂载共享及 Office 在线协作仍未实现；文件页支持当前会话密码解锁，仍为当前标签页的客户端遮蔽，详见[142变更](changes/142-session-password-unlock/README.md)。纯 UI 展示与参考页面保留演示用途。

[当前开发入口](getting-started/local-development.md) 与 [部署说明](operations/clouddrive-deployment.md) 优先于源项目历史变更记录。docs/changes 和 frontend/docs/changes 中的旧记录用于追溯，不作为当前启动命令。

第十三批的[133验收](changes/133-archive-browser/verification.md)覆盖受限Windows解析、31个不同的相关浏览器场景、Go全量和前端检查。Linux仅交叉构建。当前后台解压由[144变更](changes/144-background-archive-tasks/README.md)提供，格式和任务范围以文件管理运行说明为准。

第十四批的[134验收](changes/134-pdf-reader/verification.md)覆盖私有当前及历史PDF；源字节、页数、画布、图像和工作时限受控。超过单张图像像素预算时PDF.js省略该图像，界面明确提示并可下载原件，不承诺全保真。临时标注只导出副本，不回写原文件；不包含Office、ePub、OCR或公开分享PDF阅读。

第十五批[135验收](changes/135-share-audience/verification.md)覆盖精确账号及角色受众、子项继承、当前身份与下载票据绑定；71项基础浏览器场景及最终5项定向复验通过，含320px英文深色长主体名称的局部溢出与无障碍检查。两库已追加迁移至v13并校验原数据保留。

[136视觉收口](changes/136-file-workspace-density/verification.md)另修正20项文件工作区布局与交互：独立滚动、紧凑导航与六列网格、窄屏路径、空态居中和固定项区域。功能累计仍为300项；78项不同文件流程的组合证据与已知QA并行登录风险见验收记录，不扩大为全站一致或并发验收。

[137目录偏好](changes/137-file-preferences/README.md)实现服务器同步、各目录覆盖、全局默认与重置、文件夹点击行为及冲突恢复；本批20项为使用行为验收，不作为20项独立新增功能计数。原两库已追加迁移至v14并核对所有既有files表数据保留，验收状态以任务清单为准。

[138私有目录树](changes/138-directory-tree/README.md)补齐真实目录分页、自动跟随、按设备的开关和键盘/移动导航；不新增Go接口或数据迁移。缓存和自动展开有明确预算，20项仍按使用行为验收，不改变累计300项口径；范围和限制以文件管理手册为准。

[139文件时间与时区](changes/139-file-time-zones/README.md)统一时间显示与现有区域偏好，补齐自定义分享到期时间的明确时区和夏令时校验。无Go接口或数据库迁移；20项为使用行为，服务端到期上限和原数据均保留。版本保留设置由140补齐；该批不包含BT与Office。


[140账号版本保留](changes/140-history-preferences/README.md)新增服务器策略、扩展名筛选及最近数量限制，内容覆盖事务读取同一账号规则并核算逻辑空间；v15仅新增独立策略表，不改写原文件或视图偏好。当前验证与交付状态见任务清单，不扩大为无界历史或物理垃圾回收。

[141持久写锁](changes/141-webdav-write-locks/README.md)补齐WebDAV独占锁、条件写入、跨入口事务保护和本人占用管理；20项仍按使用行为验收，不支持共享锁或Office服务。v16追加锁表和传输条件列，原数据保留；完整验证与部署状态以任务清单为准。

[144后台解压](changes/144-background-archive-tasks/README.md)覆盖本人无密码 ZIP/7Z 的持久任务、结果及排队取消，迁移 v18 增加一张任务表。[145后台创建 ZIP](changes/145-background-zip-creation/README.md)在原表增加类型和结果信息，覆盖文件及目录压缩、下载和结果定位。[146任务汇总](changes/146-unified-background-tasks/README.md)将归档和两类离线下载汇总到同一列表，支持筛选、分页和精确下载详情入口。
