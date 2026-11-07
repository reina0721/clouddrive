# R151-001 管理端文件清单

Cloudreve 4.19.1 的文件页包含 ID、文件名、大小、占用空间、所有者和创建时间。过滤面板展示所有者 ID、文件名、存储策略、存在分享链接、存在中转直链和上传中。参考实例无文件，未变更账号或内容。截图保存在 `.data/151-reference-admin-files.jpg` 与 `.data/151-reference-admin-file-filters.jpg`。[官方前端响应类型](https://github.com/cloudreve/frontend/blob/master/src/api/dashboard.ts)

当前项目用 `files_entries` 保存已发布文件和历史关联，分享、直链和未发布传输分别有独立表。既有目录查询按本人读取，`files:read` 不应获得跨账号能力。现有项目拥有单一运行态存储绑定和可独立注册的 IAM 权限目录，Go 标准 JSON 和现有数据库 lease/GORM 足以实现窄投影，未找到需引入依赖的能力缺口。

推断：文件清单应独立授权并只读。历史关联可计算逻辑占用，物理大小和对象引用数尚无权威目录，不从路径或原文件名推断。待发布传输不作为已发布文件混入清单，存储策略切换和导入需要单独设计。
