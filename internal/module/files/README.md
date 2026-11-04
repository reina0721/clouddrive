# files 模块

本模块拥有私有文件的目录、名称、归属、回收状态、配额、上传幂等、内容版本、复制/ZIP 与只读分享用例。用户能力、预算、预览和维护限制以[文件管理](../../../docs/operations/file-management.md)为唯一当前使用说明。

- model 只维护实体和不变量；GORM record、表名、锁与持久化位于 repo。
- service 依赖仓储、内容存储、名称规范化、Clock 和 IDGenerator 窄契约。
- adapter/unicodename 隔离已安装的 Go 官方 x/text NFC 实现，不让第三方类型进入 model/service。
- adapter/tus 隔离 tusd 核心 HEAD/PATCH 与本机持久暂存；service 持有同步 OS 锁回调，覆盖协议、暂停和发布的同一临界区，没有第二套身份、配额或存储客户端。
- handler 读取已认证主体并决定可公开的错误及低敏日志；binding/http 承担 Huma schema 与 mutation guard。
- module.go 的 New 只做纯内存装配；ValidateStorage 与 PrepareTransfers 是单独命名的候选准入 I/O。composition 注入 Kernel 资源租约，不创建第二个客户端。
- binding/migration 独占 files schema；当前 v7 增加独立连接和上传源/覆盖版本字段，沿用持久传输、暂存位置绑定和单文件下载凭据约束，已应用 SQL 不改写。

元数据提交先锁定存储位置，再锁 owner，随后判断目录环、名称冲突、祖先可见性与配额；锁与取消由数据库租约管理。读取后复核位置摘要，以免从另一个存储位置读取同名对象。回收不会删除内容，目录的 parent_id 同时保留恢复前的位置，不另存冗余原位置字段。

- adapter/webdav 隔离成熟XML/协议实现；binding/webdav 在共同HTTP中间件内显式分派扩展方法，不修改全局方法表。
- service.Connections 拥有独立凭据策略和目录范围，通过 composition 注入的 IAM AccountAuthorizer 复核当前身份/权限；不穿透IAM私有包。
- 同步WebDAV PUT与浏览器tus共享持久暂存和配额；服务端摘要源不能从浏览器续传接口误用，覆盖使用条目内容版本CAS。
