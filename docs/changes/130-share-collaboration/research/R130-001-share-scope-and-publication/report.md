# 分享范围、用例复用与发布研究

## 方法与事实

根README/scope、主题入口、Git、已有metadata及实际代码证据已读取。bb1820b干净且与origin/main同步；保留现有用户数据。参考站只读观察“与我共享”及“我的分享”：前者明确说明保存分享快捷方式，后者为空且有刷新/排序，没有在参考服务创建文件或分享，也未看到实际编辑面板。不能凭这个入口名称推导存在直接IAM账号共享。

官方Cloudreve V4公告明确有分享协作及权限，普通编辑冲突检测与Office锁分离；概念文档另定义共享根和子项权限。事实不等于当前项目已具备。本地Share只有只读凭据/过期/撤销；PublicFilesPort仅四类只读操作，不能编辑设置或写入文件。

Repository.changeMany持有storage/owner事务并调用saveEntryChanges。Service已有目录、复制、文字CAS、回收、版本保留、配额与ZIP；直接以owner调用但只在事务外检查分享会产生撤销/移动逃逸窗口。现有Transfer唯一拥有预算、持久暂存、摘要与发布；SourceOffline已有最终事务围栏。Next同源rewrite保留32MiB预算，整文件POST不是512MiB文件能力的合适承载。

## 分类、候选与架构判断

权限预设、分享策略版本、目标根与访客写入是项目特有业务。保留IAM当前账号授权、GORM/迁移、tusd2.10.1、标准库crypto/HTTP/ZIP、已有Host增量hashFile、UIAdapter及Page Pattern；沿用129当日工具链和安全基线，无新依赖。Casbin官方当前支持多种授权模型、策略持久化和管理，但不能消除事务时序、capability票据和文件祖先校验；为本批有限链接能力再引一套enforcer/策略表/同步机制收益不足。IAM继续使用其原授权机制，files不导入其内部包；未来每人/用户组ACL或继承是真实新模型触发器，不能堆无类型规则。

继续事务外适配旧Service不合适。重构承载：建立显式请求范围仓储，使用窄SharedFileRepository契约把最新Share/Grant/Entries与变更回调放在同owner事务；请求范围Service复用同一内容、配额、名称、Clock、IDs与I/O准入，不创建第二客户端。所有读目标与写结果都约束在分享根内，禁止移动/回收根本身，文件根仅允许内容CAS编辑。全owner快照只用于配额/历史等内部决策，协议只投影分享范围DTO。

上传增加SourceShare，复用tus的有界分块、完整SHA、预留和原发布，分享ID/策略revision/解锁grant摘要绑定到Transfer。现有downloadPublication提升为真正两种来源消费的窄发布许可，最终事务同时读取对应分享/票据，拒绝过期、撤销、暂停、权限降低、版本变化或移出范围。原生Tus管理不接受访客SourceShare，取消清理不发布内容。无需修改DAV同步Ingest或复制它，32MiB代理预算不放大。

## owner、生命周期与失败

files拥有链接策略、权限、迁移和范围仓储；IAM公开facet确认分享owner仍有效且具备对应files权限。Kernel继续拥有DB/Storage，Composition显式装配；没有新常驻goroutine、queue或Kernel capability。Host拥有File、分块/散列、取消、预览Blob URL和可见性，不将浏览器对象或token持久化到Surface或localStorage。版本策略变更使旧解锁/下载/上传许可失效，失效后的候选只能清理或到期回收，不能继续发布。

只读默认迁移成明确只读权限，不把历史链接变成可写。v12添加策略revision/标题/启用/权限、Grant版本、Transfer分享绑定；保留v1–v11原SQL与所有文件。无依赖升级、数据重置、远程节点或外部写入。错误链、I/O关闭、候选补偿和清理债沿用既有机制；协议边界只记录稳定操作与错误码，不打印token、grant、密码、完整URL或文件名。

## 范围、验证与结论

本批20项为权限化链接管理及链接内真实文件协作，不冒充直接账号ACL/子项继承/Office/锁。源接线全部完成后才集中测试；重点证明真实二访客协作、只读/仅上传隔离、CAS、修改策略中断上传、移动/复制/ZIP范围约束、根保护、旧链接迁移、原200项回归和桌面/390px/深色英文/Axe。未知的外部数据库、S3及真实操作系统驱动不宣称验收。

研究门禁通过：关键边界已有源码与主源证据，剩余未知不妨碍此计划。后续仅增量基线检查，命中记录的触发器才定向复核。
