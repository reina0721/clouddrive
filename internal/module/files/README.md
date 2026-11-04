# files 模块

本模块拥有私有文件的目录、名称、归属、回收状态、配额、上传幂等、内容版本、复制/ZIP 与只读分享用例。用户能力、预算、预览和维护限制以[文件管理](../../../docs/operations/file-management.md)为唯一当前使用说明。

- model 只维护实体和不变量；GORM record、表名、锁与持久化位于 repo。
- service 依赖仓储、内容存储、名称规范化、Clock 和 IDGenerator 窄契约。
- adapter/unicodename 隔离已安装的 Go 官方 x/text NFC 实现，不让第三方类型进入 model/service。
- adapter/tus 隔离 tusd 核心 HEAD/PATCH 与本机持久暂存；service 持有同步 OS 锁回调，覆盖协议、暂停和发布的同一临界区，没有第二套身份、配额或存储客户端。
- handler 读取已认证主体并决定可公开的错误及低敏日志；binding/http 承担 Huma schema 与 mutation guard。
- service.Downloads拥有私有HTTP任务状态与发布围栏，Transfer继续唯一拥有候选、配额和内容发布；adapter/httpdownload封装标准net/http的受控流、DNS/IP与续传语义。module.New返回Handler与Contribution，由现有Scheduler运行任务、Participant管理源客户端生命周期，不建立第二个worker框架。
- module.go 的 New 只做纯内存装配；ValidateStorage 与 PrepareTransfers 是单独命名的候选准入 I/O。composition 注入 Kernel 资源租约，不创建第二个客户端。
- binding/migration 独占 files schema；当前 v12 保留分享协作字段，v11 增加离线任务与子传输关联，v8 分享引用、v9 私有注解、v10 历史快照以及此前连接/上传字段保持不变，沿用持久传输、暂存位置绑定和单文件下载凭据约束，已应用 SQL 不改写。

元数据提交先锁定存储位置，再锁 owner，随后判断目录环、名称冲突、祖先可见性与配额；锁与取消由数据库租约管理。读取后复核位置摘要，以免从另一个存储位置读取同名对象。回收不会删除内容，目录的 parent_id 同时保留恢复前的位置，不另存冗余原位置字段。

- adapter/webdav 隔离成熟XML/协议实现；binding/webdav 在共同HTTP中间件内显式分派扩展方法，不修改全局方法表。
- service.Connections 拥有独立凭据策略和目录范围，通过 composition 注入的 IAM AccountAuthorizer 复核当前身份/权限；不穿透IAM私有包。
- 同步WebDAV PUT与浏览器tus共享持久暂存和配额；服务端摘要源不能从浏览器续传接口误用，覆盖使用条目内容版本CAS。

service.Navigation 拥有分享引用和固定集合，使用消费方定义的 NavigationRepository / ShortcutTargets 窄契约。repo.Navigation 在同一 storage/owner 事务内执行集合 CAS 与已回收引用移除，删除对应固定项时原子推进集合版本；不创建内容对象、客户端、goroutine 或第二套授权。ShareToken 不参与 JSON 输出。预算与使用方式只在文件管理 authority 维护。

- service.Archives拥有本人包内浏览和原子提取；adapter/archiveprocess隔离标准ZIP、sevenzip及受限进程协议。公开NewArchiveProcessor/RunArchiveWorker为composition提供装配与私有入口，不暴露第三方/Adapter类型；父请求唯一拥有子进程和句柄。
