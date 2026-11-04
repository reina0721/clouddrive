# files 模块

本模块拥有私有文件的目录、名称、归属、回收状态、配额与上传幂等用例。用户能力、预算、预览和维护限制以[文件管理](../../../docs/operations/file-management.md)为唯一当前使用说明。

- model 只维护实体和不变量；GORM record、表名、锁与持久化位于 repo。
- service 依赖仓储、内容存储、名称规范化、Clock 和 IDGenerator 窄契约。
- adapter/unicodename 隔离已安装的 Go 官方 x/text NFC 实现，不让第三方类型进入 model/service。
- handler 读取已认证主体并决定可公开的错误及低敏日志；binding/http 承担 Huma schema 与 mutation guard。
- module.go 只做纯内存装配；ValidateStorage 是单独命名的候选准入 I/O。composition 注入 Kernel 资源租约，不创建第二个客户端。
- binding/migration 独占 files schema。第一版建立目录及 owner 协调行，第二版增加存储位置绑定和待清理记录；已应用 SQL 不改写。

元数据提交先锁定存储位置，再锁 owner，随后判断目录环、名称冲突、祖先可见性与配额；锁与取消由数据库租约管理。读取后复核位置摘要，以免从另一个存储位置读取同名对象。回收不会删除内容，目录的 parent_id 同时保留恢复前的位置，不另存冗余原位置字段。
