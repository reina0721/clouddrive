# 策略与事务范围

Share增加Title、State（active/paused）、Revision与具名SharePermissions（browse、preview、download、create、upload、modify、rename、move、copy、delete）。只读预设browse/preview/download，编辑预设全部，上传预设create/upload且不枚举目录。细分策略有明确依赖校验；不是任意map或脚本引擎，不覆盖IAM拥有者权限。根为文件时仅适用读取/修改内容，不能新建子项。PublicEntry加入contentRevision用于真实CAS，不暴露owner、objectKey、私有注解/历史或上级parentID。

Share策略写入携带Revision，在同owner事务更新明确列，不能覆盖并发密码尝试计数。修改标题、有效期、密码、权限或启用状态推进Revision；Grant绑定ShareRevision，旧解锁和下载票据失效。密码以显式keep/set/remove操作区分缺失、空值与删除，不返回hash。撤销不可恢复，暂停可恢复；expiry受既有maxAge约束。旧Share和Grant迁移revision=1及明确只读权限。

SharedFileRepository.ReadShare/ChangeSharedFiles消费方契约返回最新Share/Grant/有界owner Entries；实现复用现有Access、storage/owner锁与saveEntryChanges，最终回调在同事务内授权。请求范围仓储绑定ShareAccess（token/grant摘要、action、targets、destination），是每请求显式依赖，不能由调用方绕过创建另一套客户端。请求范围Service复用同一Content、Clock、IDs、NameNormalizer、Policy和I/O slots；仅repo替换为范围仓储，复用真实Folder/Copy/ReplaceText/Archive/Trash行为和配额/历史。

检查Share当前active、revision、grant期限与版本、操作权限、所有读/源目标当前可见并Within根、目标目录属于根。写回集合的旧项与新项都必须在根内；构造合并后的树检查移动结果。root禁止rename/move/trash，文件root允许仅内容替换。复制或批量对任一条分别完整校验；UI只清除成功项。内部完整owner树仅为配额/历史决策，返回访客时投影成有界public DTO。RecordCleanup可在授权失效后记录本次候选补偿，不由撤销阻断资源释放。

IAM经消费方ShareAccountAuthority显式注入；当前owner停用或失去files权限后拒绝相应读写，不把Share token当作IAM身份。读内容/归档跨I/O前后复核范围和同一内容版本，策略改变不得继续输出新授权内容。目录树超过配置的search.treeEntries明确拒绝，不返回截断树当成功；策略读取/停用/撤销不依赖完整目录仍可维护。

列表采用明确分页/排序/状态/检索；预算沿用文件树、单文本1MiB、媒体32MiB、归档64MiB，访客批量最多20项。错误保留Missing/Locked/Forbidden/Conflict/Large/Quota/Busy及取消/清理链，协议仅输出稳定错误码。

实施核验：Entry的UpdatedAt由业务Clock拥有，禁止ORM自动重写；分享写入回执在同一事务中读回持久表示，保持CAS时间与数据库实际精度一致，不截断时间掩盖冲突。范围和接口保持原计划，原有文件不因该映射修正而被改写。
