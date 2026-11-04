# 持久化、事务和占用

Entry增加私有History []VersionSnapshot及HistoryRevision，json隐藏；快照持有旧ContentRevision、原名、ObjectKey、SizeBytes、MediaType、ContentSHA、UpdatedAt。所有历史字段有语义名，快照值不可变；复制slice不共享。当前版本以Entry现值临时投影，不伪造升级前的内容，历史revision唯一、正值且小于当前版本，两个CAS计数限制JS安全整数。具体record增加history_json及history_revision，严格JSON array/EOF/未知字段/UTF8/64KiB验证，损坏不能默认空。

v10为三方言新增列，默认[]/0，v1–v9不改；存在非空历史或使用过的HistoryRevision时down拒绝。本任务不对用户库执行down。配置files.history.enabled=true、perFile=20、perOwner=1000，经严格binding且RestartRequired；后两项只能调小为正数。降低预算不会删除已有历史，只阻止继续增加；保留关闭不删除已有记录。所有读取与新用例用SearchTreeEntries有界快照；owner累计历史硬上限避免API生成无界行内数据，超过边界要重新设计独立表/索引。

内容替换统一使用Service保留助手：正常编辑按配置捕获旧版本，恢复始终捕获当前；达到单文件/owner/编码预算拒绝，不自动删旧。覆盖事务必须同时保存历史和新当前，失败回滚全部。ReplaceText、Transfers.commit和DAV COPY覆盖全部迁移；副本clone历史并保留内容版本编号，重置副本私有历史CAS起点，后续独立。改名/移动/回收保持历史。每处copyTree引用计费当前+继承历史，owner历史计数同一锁内核验。

Model.Used包含当前+历史所有逻辑引用；相同不可变对象多份关联仍按各关联计费。开启保留时覆盖增长新文件完整大小，关闭保留才按新减旧；传输预留和发布使用一致规则。恢复将选定历史关联提升为新当前状态，恢复前当前退入历史；逻辑关联数和总占用不增长，满容量也可恢复。选定旧版本号从历史列表移出，内容通过新当前状态访问；已与当前同一对象可无变化成功。历史删除只移除指定引用，当前永不删除，更新HistoryRevision但不改当前内容时间；不执行对象删除或偷偷增加GC。现有Storage位置绑定因Entry仍在而保持有效。

版本列表给出currentRevision/historyRevision、分页项、总数、保留策略、文本/媒体预算、当前/历史/owner占用；旧版元数据不暴露ObjectKey或SHA。GET /files/{id}/versions，GET/HEAD /files/{id}/versions/{revision}/content；POST restore、POST copy、DELETE history共6个新operation，仍使用files:read/write和CSRF。恢复/清理携带当前内容与历史CAS。历史内容读取在原slot与Storage租约内，流开始前复核owner、祖先和指定版本仍在，复用contentResponse/ServeContent的Range、ETag、取消与清理；公开分享与DAV不暴露历史。

另存为以所选旧内容创建新ID/当前revision1，继承当前私有整理信息，历史为空，原文件不变。恢复保持当前文件名/位置/标签，切换内容并递增revision，所选内容通过新的当前版本访问。批量删除先验证所有目标非当前、存在、CAS和预算后一次ChangeManyBounded保存，任一失败无部分删除。错误保留链，HTTP唯一边界记录失败；恢复/另存/清理完成只记录低敏稳定事件，不记名称、ObjectKey、原错误文本或参数。

## 集中验证触发的恢复边界刷新

上限为1时，如果恢复既保留所选旧关联又新增恢复前当前关联，会无法执行任何恢复；还会重复增长逻辑占用。按官方不可变内容关联语义修正为“提升所选关联、当前退入历史”，仍递增内容CAS和历史CAS，空间不变且保留恢复前内容。属于本批恢复语义完善，不增加新依赖/模块/副作用；UI与需求同步说明旧版本号提升后不再作为旧关联单列。日期是保存时记录的文件修改时间，不推测升级前缺失的内容原始时间。

降低新增保留数量后，恢复的关联数量不增长，因此使用同一硬边界快照构造而不套用新增配额；仍验证20/1000硬上限、JSON编码预算与CAS。新增覆盖继续受调低后的配置限制。WAV媒体边界统一audio/wave别名；替换上传优先字节识别，避免旧目标扩展名掩盖新内容类型。
