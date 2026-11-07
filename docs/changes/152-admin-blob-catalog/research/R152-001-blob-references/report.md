# R152-001 文件 Blob

Cloudreve 的管理页按对象显示大小、存储策略、引用次数、创建时间及创建者，可按所有者、类型和存储策略筛选。参考实例没有对象记录，页面和筛选截图位于 `.data/152-reference-admin-blobs.jpg`、`.data/152-reference-admin-blob-filters.jpg`。[Cloudreve 响应结构](https://github.com/cloudreve/frontend/blob/master/src/api/dashboard.ts)

项目当前对象发布到主存储，受控路径以文件 UUID 标识。现用内容键及历史内容键分别保存于 files_entries 和 history_json；复制与恢复可以复用同一物理对象。存储 Exists 只确认存在性，不返回创建者或创建时间。回收保留关联，永久移除只清理目录数据。缺少真实物理创建信息，适用范围为已引用对象及最早关联文件创建时间。

SQLite、PostgreSQL 和 MySQL 的数据库原生表函数可用于展开历史。与独立同步索引相比，直接查询没有旧记录补写、并发发布双写和对象索引一致性成本；代价是全局统计需扫描相关引用，且只在管理请求内执行。保留独立权限、请求取消和有界输出。[SQLite](https://www.sqlite.org/json1.html) [PostgreSQL](https://www.postgresql.org/docs/current/functions-json.html) [MySQL](https://dev.mysql.com/doc/refman/8.0/en/json-table-functions.html)
