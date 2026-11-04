# 统一上传和原子覆盖

## 共用已有生命周期

不创建第二套无配额的PUT临时文件。现有Transfers扩展Source（tus/webdav）、SizeKnown、QuotaReservedBytes、ExpectedEntryID/ExpectedContentRevision、ConnectionID/ConnectionRevision。现有记录迁移为tus、已知size且QuotaReservedBytes=SizeBytes；原生创建仍必须完整SHA和size。公开summary增加源类型/大小是否已知，UI不对外部WebDAV任务显示“重选本地文件”或假续传按钮。

WebDAV流式写先在同一storage/owner事务内解析父目录、检查条件和原目标，预留暂存峰值与账号增量容量。已知Content-Length按真实大小预留；未知长度按min(单文件上限、可用账号空间加原目标大小)预留上限，流式读取超过立即失败。QuotaReservedBytes计算替换增量max(0,new-old)，global暂存仍计完整上传峰值，不能通过覆盖绕过磁盘预算。

Staging增加受控服务端流写/声明长度能力，仍由现有tus filestore持久文件和gofrs锁拥有。服务端摘要源最初没有SHA，不能从原生HEAD/PATCH/重选端点继续。其元数据允许deferred size；在同一锁内限制字节、增量SHA-256、校验声明长度和取消，再用成熟filestore DeclareLength封口；只有封口成功且实际SHA/大小持久化，才能进入共用Commit。所有文件Close保留错误；不使用goroutine/Pipe让资源逃出同步回调。

## 发布和CAS

已有Commit继续校验暂存和流写不可变对象。新增覆盖模式仅来自内部同步PUT，保存ExpectedEntryID及版本；最终同owner事务要求目标仍为同一可见条目、相同内容版本和相同目的位置，复核连接revision、根范围和配额，更新条目的不可变对象键/大小/MIME/SHA并递增contentRevision。不覆盖其他条目，不修改未满足If-Match/If-None-Match的内容。旧对象继续遵循当前“不自动物理删除”的维护边界，不能借本批伪造已实现版本历史。

没有目标时复用新建发布；已存在目录拒绝文件覆盖。上传期间目标被移动/改名、回收、改写或连接被停用时，发布失败，原内容保持。连接当前权限和IAM账号权限在开始及发布前复核；数据库失败与资源清理失败并存时errors.Join保留两者。

## 失败和可见性

WebDAV客户端请求结束就是其源所有者结束，不把外部socket当作网页File。失败/取消在有界清理上下文取消该内部会话，释放预留和暂存；清理失败保留持久待办供原请求驱动维护。提交已完成而清理失败时保留完成事实，不删除文件；客户端重试由协议条件与原目标版本判断，不静默丢弃错误。

原生传输中心仍可看到真实外部任务来源和状态，但不暴露密码/源路径；暂停/重选仅适用于tus源，取消明确受同一锁约束。原生第三批20项不变，集中回归必须证明没有源类型串用、预算重复计费或旧完成文件被取消删除。

## 文件影响

files model/service/repo/Staging adapter/HTTP config及v7三方言SQL；composition显式注入权限和协议；IAM只新增真实消费者驱动的AccountAuthorizer；前端Transfers schema和Host动作按Source收敛。已有v1–v6 migration和运行数据不改写。实施前保存两套SQLite一致性备份，并记录源revision/Git状态；确认研究基线未漂移后直接执行，不再次全量追踪旧调用链。
