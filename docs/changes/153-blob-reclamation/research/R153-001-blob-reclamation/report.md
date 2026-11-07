# R153-001 Blob 回收边界

Cloudreve 4.19.1 管理面板的文件系统参数包含文件 Blob 回收间隔。参考站 Blob 清单为空，批量回收及强制删除能力以官方说明为证。本任务没有在参考站改变设置或删除数据。官方概念页说明副本共享不可变 Blob，无引用对象由任务队列最终清理。[概念文档](https://github.com/cloudreve/docs/blob/v4/en/usage/concept.md#file-blob) [V4 调度](https://github.com/cloudreve/cloudreve/discussions/2522)

`6c12471` 的 `repo/repository.go` 和 `repo/transfers.go` 保存当前及历史引用，`repo/trash_purge.go` 是手动与到期移除的共同入口。`repo/shares.go` 的存储身份行锁串行化写入。普通复制和版本复制在锁内重新读取来源，旧引用消失后不能从过期快照建立新引用。存储适配器提供幂等删除，项目已有调度绑定。旧补偿表的记录语义为失败的发布补偿，与经确认失去引用的对象不同。

存储全盘枚举没有可靠区分旧数据、未发布传输及外部文件的证据。按事务移除的已发布引用登记候选，复用 SQL 引用投影、现有存储适配器和调度能力。无需新依赖或新队列框架。现有全局锁可保证最终引用判断和单个有超时的删除一致。单次数据库锁内 I/O 会短暂阻塞文件写入，因此避免持锁处理整批。
