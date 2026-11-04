# R133-001 压缩包研究

## 方法、事实与缺口

基线d23dc64，Git干净；从README、范围、文档入口、实际files Service/Repository/Content、HTTP与composition追踪。检索既有metadata后复用R128的不可变内容/配额、R129的业务运行单元与框架取舍、R131的私有工作区与Host边界。参考站首页及后台任务为空的只读观察沿用131/132，不向外部站上传测试文件；空界面不能证明其包内行为。Cloudreve官方当前file-apps文档明确ZIP与7Z结构预览、选择在线解压，含资源预览图；此证据与当前本地源码的缺口相符。

当前`Service.Archive`只创建有界ZIP并下载；没有包内目录/内容读取或解压。`Content.WithReader`只暴露io.ReadSeeker，`ReadSmall`已有64MiB等有界读取，Repository.ChangeManyBounded在同storage/owner事务中加载完整有界快照并保存变化集合。model.Parent/Visible/Available及Used已拥有归属、祖先、同名与历史空间语义。直接调用Folder/CreateText逐项解压会部分发布，不能代替原子批量事务。

cmd/app仅提交I/O给composition.Run；Run构造日志、Application与Blueprint，之后区分CLI/Service。没有可复用的OS任务资源隔离能力；pkg.Execution并非任意子进程执行器。文件Scheduler/离线Task不应被用作本次同步压缩包解析的万能任务表。已有官方x/sys v0.49.0和x/text v0.43.0可复用。

## 分类和候选比较

| 方案 | 覆盖、版本、维护及安全 | 边界、可测性、观测与替换 | 结论 |
| --- | --- | --- | --- |
| Go archive/zip | 当前Go1.26.10标准库；创建/读ZIP、CRC、Store/Deflate；历史GO-2022-0273与GO-2024-2888修复早于当前工具链；无7Z或加密ZIP | BSD许可，生产广泛；io.ReaderAt可纯内存测试，保留项目路径/预算校验，不能依赖可选GODEBUG路径策略 | 保留作ZIP实现，不自写压缩算法或ZIP格式解析 |
| bodgit/sevenzip v1.6.5 | 最新release查询2026-07-10，仓库push2026-10-28、未归档，BSD-3-Clause，go1.25兼容1.26；7Z含固实块和密码；Cloudreve当前go.mod直接使用1.6.0，mholt也使用，是实际采用证据 | 公开ReaderAt/File接口可测；所有第三方类型留Adapter。官方OSV对该版本查询无直接漏洞记录，不代表全依赖零风险；实施后全图复核 | 采用成熟v1.6.5，不修改全局解码器注册表 |
| mholt/archives v0.1.5 | 最新release2025-10-13，支持多格式；Cloudreve使用0.1.3；当前上游go.mod依赖sevenzip及多压缩库 | MIT，通用遍历方便，但仍使用相同7Z解码器；API尚0.x，本任务只需ZIP/7Z，增加RAR等依赖不能解决资源边界 | 不采用本批通用聚合；未来多格式真实需求再评估 |
| 外部7-Zip命令 | 成熟，但当前机器未发现7z/7zz；需要额外分发、路径/版本/许可证与输出协议治理 | stdout/member选择能实现；仍须进程内存/超时边界，额外可执行文件无本批收益 | 不作为默认；不下载未受控解压工具或运行shell命令 |
| 直接在HTTP进程解码 | sevenzip.NewReader可能解压编码header，LZMA2容量来自文件属性；公开API没有每实例字典/成员数量硬预算；ZIP也在返回前构建central集合 | 事后检查输出总量无法保护先发生的字典分配，修改全局注册器会引入共享状态 | 拒绝；重构承载位置到受限同二进制worker |

标准机制为os/exec、Windows Job Object、Linux RLIMIT_DATA与既有x/sys；项目特有逻辑为包成员选择、命名、owner配额与原子元数据发布。合理自研仅限窄worker协议和这部分业务编排，不实现通用进程池或压缩库。维护责任归files模块；当解析库提供可验证的每实例硬预算且取消机制足够，或进程成本超过收益时通过新ADR评估退役worker，不留永久双轨回退。

## 能力、架构与生命周期判断

新能力是files模块专属ArchiveProcessor Adapter，不提升pkg/Kernel。composition显式注入当前可执行文件和受控政策；同二进制内部worker分支仍从composition.Run进入，不装配Generation、数据库、监听或日志sink。主进程不解析不可信包；仅接收有界typed结果。Windows先附加Job再发送输入，Linux子进程先设限制再读取输入；失败不降级为无界进程。每调用创建一个进程，HTTP已有传输名额背压，无常驻池/后台worker；context结束杀死并Wait，释放句柄/管道。非Windows/Linux明确不支持，不假称跨平台运行已验证。

配置归files：沿用maxArchiveBytes、maxBatchEntries、maxTextBytes/ThumbnailBytes与Search.TreeEntries；新增archive.timeout与archive.workerMemoryBytes，集中默认、严格校验、RestartRequired。默认30秒、512MiB，允许收紧。无额外账号或网络；密码仅本次请求内存和stdin，不落库/日志/URL/命令行。没有新migration。

错误在IPC边界转换为项目稳定类别（invalid/unsupported/password/too_large），父进程保留退出/取消/超时原因链；不回显解析器文本或stderr。Handler是最终协议/错误日志owner。Adapter只记录受控phase/outcome/code，不记录源文件名、路径、密码、输入或输出正文；正常取消不记Error。stdout/stderr均有界，握手和清理错误保留。

## 发布和验证边界

只处理本人当前有效文件，expectedRevision与objectKey形成源围栏；目标只可本人普通目录。所有名称经NFC/大小写规范化，拒绝绝对路径、反斜线、..、控制符、符号链接/特殊文件、重复及文件/目录歧义；成员数含隐式目录，展开总量、单文件和输出再打包均有预算。解析只读内存，不把压缩路径当操作系统路径。

先构建完整计划、核对配额，再写不可变内容候选；最后单次owner事务重验源、目录、同名和配额后发布。失败不发布任何目录项，并在总清理期限内删除候选或记清理债。不是持久后台解压任务，不承诺浏览器关闭后继续；固实7Z读取可能重复解码前缀，超时明确失败，不无限重试。

20项全部接通后集中验证真实ZIP/7Z、错误密码、CRC、ZipSlip/链接、解压炸弹/worker内存和超时、源更新/目标变更/配额竞态、候选清理、冲突三种策略与UI字节闭环。Windows本机实测，Linux至少交叉构建；不能将交叉构建称为Linux运行验证。Go/契约生成/前端类型lint/产物性能和相关浏览器回归及原数据备份/重启都记录结果。

研究门禁通过：API、现有发布与隔离接入路径均有证据；新增worker是必要承载调整，见ADR。剩余解码器运行差异属于实施验证，不预先记为通过。完整Cloudreve仍有ACL、BT、多节点、Office、其他格式/公开分享/持久任务差异，本计划不删除这些目标。

实施复核补充：sevenzip v1.6.5的File.Open并不自行核对每个文件CRC，上游fixture测试显式核对；Adapter已增加逐文件CRC32，并用六个上游7Z夹具及错误密码验证。初次全量架构检查发现composition直接导入Adapter，按原有模块规则改由files公开工厂装配，未放宽架构门禁。IPC输入采用有界JSON元数据行加原始源字节，响应才进行base64编码，降低源副本内存成本。Windows真实资源限制/取消测试通过；Linux交叉构建通过，不推断运行态结果。
