# 注解与持久化

Model定义Annotations、Tag(name/color)、Property(key/value)、Emoji和FolderColor等有归属类型/常量；Entry持有注解值与独立revision，但JSON隐藏。8标签/8属性、名称32字符、属性键64字符、值256字符、Emoji16字符/64字节，UTF8有效且拒绝控制字符；属性值允许换行/制表，空值有效。名称/键NFC正规化后唯一，标签检索不区分大小写；系统命名空间不属于自由属性键。颜色仅六位RGB。每条注解序列化预算默认2048字节，受控配置可调小，错误不丢内容。

Repository改为具体entryRecord与双向转换，完整保留现有字段；持久JSON字符串及读写序列化留在repo边界，Model仅用标准JSON测量同口径预算，拒绝超长、未知/损坏数据，不回退为空。数据库v9增加annotation_json默认{}、annotation_revision默认0；旧v1–v8不变。三个方言单轨脚本及摘要；down guard保护已使用的注解，本任务不执行用户库回滚。无新数据库连接、表目录服务或生命周期。

新注解读取、统计和修改使用SearchTreeEntries有界快照。Repository的有界ChangeMany在同一现有storage/owner锁与WithinTx内LIMIT+1读取、验证和保存；旧普通用例保留已有明确入口，不引入运行时发现或万能查询器。Service负责可见性、归属、CAS和预算；ctx进入SQL及遍历。注解revision从0开始，达到JS安全整数上限拒绝推进，不能溢出；内容revision不因纯注解修改递增。

私有接口GET/PUT /files/{id}/annotations、GET /files/annotations/summaries及POST /files/annotations/tags-batch，共新增4个operation（总115）。摘要批量读取最多200个显式ID、active/trash可见性，借一次有界快照，不让画廊为12项分别扫描12次；trash仅允许本人显式回收项。详情读取返回当前Entry、祖先、注解/revision、预算与有效后代统计；完整位置最大4096编码字节，超限明确拒绝。更新替换整份有类型注解并携带expectedRevision。批量写入为显式targets(id/revision)及add/remove标签，最多100个不重复目标，修改前验证全部目标、版本及结果预算，整批回滚错误。返回最新文档，失败保留原错误链由HTTP边界统一呈现。

copyTree必须深拷贝注解slice并重置副本revision；原目录、副本、快捷方式副本不共享可变状态。普通改名/移动、回收/恢复、文本替换保存注解；传输完成覆盖重新构造Entry时显式保留，WebDAV复制/覆盖沿原同一边界。公开分享Entry及DAV不返回私有注解，不改变原授权或字节内容。取消、存储错误、版本冲突、越权与上限分别导出，日志沿operation已有低敏处理，不输出属性值。
