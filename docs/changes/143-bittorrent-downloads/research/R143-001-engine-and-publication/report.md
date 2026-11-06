# R143-001 引擎与发布边界研究

## 问题与方法

以b370d466干净工作区、根README和项目范围为基线，检索R129-001，定向读取实际files装配、DownloadTask、DownloadRepository、DownloadRunner、Transfer发布及HTTP出站策略。读取应用模块、技术选型和日志authority。外部证据只采用官方文档、发行API、安全公告及固定版本源码；搜索结果只作导航，不把第三方安全摘要当作修复结论。

本轮未新增依赖、迁移、实现、进程或外部下载任务，没有向参考站提交下载。下载器源码仅保存于忽略的.data供定向阅读，不作为产品依赖。一个下载文件失败时曾导致临时源副本不可信，已删除对应临时副本；下列结论均来自随后成功读取的明确路径，不使用那个副本。

## 参考视觉事实

2026-11-06实际打开Cloudreve离线下载，看到进行中、已完成、自动刷新和新建任务；新建弹窗为逐行下载链接及保存目录，没有在该空账号界面观察到运行中的BT文件卡片。截图为忽略的`.data/143-reference-download-form.png`。本次没有据空态推断所有运行细节。

[Cloudreve官方说明](https://docs.cloudreve.org/zh/usage/remote-download)确认HTTP、磁力、种子以及下载节点；下载器与负责转存的Cloudreve节点需要共享文件系统。该说明证明目标能力，不证明本项目已接入。

## 当前项目事实

- `model/download.go`只允许DownloadHTTP。
- `repo/downloads.go:downloadChildren`查询至多2条并要求恰好1个子传输，目的是拒绝损坏数据，并非已经支持多个文件。
- `service/downloads.go`的摘要、读取、列表将一个child映射为一个结果；`download_runner.go`领取、执行和收尾也检查该基数。
- `service/download_ports.go`的HTTPDownloadSource是顺序Body读取，不表达异步元数据、选中文件、随机块校验或远程引擎控制。不能把BT引擎塞进WithBody而隐藏生命周期。
- `repo/transfers.go`在owner事务内校验DownloadTask租约、意图及候选不可变身份。最终发布与恢复必须继续保留这些围栏；仅RPC下载完成不能等同于用户文件已发布。
- 现有暂存AppendStream支持顺序追加，不是BT随机块存储。直接暴露tusd内部路径会越过边界。
- 现有owner/global数量和字节预算按Transfer统计；多文件任务不能通过创建虚构零字节child占位，也不能绕过数量/字节预算。
- `httpdownload/client.go`执行实际IP校验和已验证IP连接，拒绝私网、metadata及转换地址等。外部下载器不会自动继承这一约束。
- 本机研究时可用空间约3GB，当前用户不是管理员，没有Docker命令；WSL命令存在，但尚未证明存在可运行发行版。不能把Docker、管理员防火墙配置或WSL运行当成已具备环境。

## 成熟候选比较

候选均不是项目已引入的依赖。标准库没有完整BitTorrent实现；自研BT、bencode、DHT、块校验或通用工作流不在候选范围。

| 候选 | 可复核证据与收益 | 接入约束与当前结论 |
| --- | --- | --- |
| aria2 1.37.0 | 官方API最新release仍为2023-11-15的1.37.0，主仓库2026-06仍有更新；GPL-2.0，跨平台RPC；Cloudreve官方直接采用 | 不能仅因release较早称其无人维护，也不能仅因官方采用而跳过当前安全和共享目录核实。外部进程的网络、磁力后继GID和重复任务隔离待验证；**条件候选** |
| qBittorrent 5.3.0 | 官方最新release为2026-10-20；Cloudreve官方采用，完整BT与WebUI接口 | 当前Windows无已配置实例；需证明后台生命周期、认证、同hash账号隔离和文件发布路径。不能拿软件发行版本代替完整API/进程验证；**条件候选** |
| Transmission 4.1.4 | 官方2026-10-24稳定版，有Windows x64 MSI约23.5MB；4.1起支持JSON-RPC 2.0与snake_case，MIT的hekmon/transmissionrpc v3.1.0为官方列举的Go客户端候选 | daemon的同hash重复行为、跨账号目录、会话ID重启边界及节点出站约束必须先解决。官方旧RPC已标为deprecated，不应默默把它作为新实现的永久路径；SDK是否完整支持新协议仍待核实。GPL外部进程与项目RPC边界必须分开；**优先继续验证的外部引擎候选，未确认采用** |
| anacrolix/torrent v1.61.0与当前master | MPL-2.0；官方README提供长期生产与多个下游采用证据；当前master需要Go1.25，理论上适配本项目1.26.10；可注入Dialer和Storage | 官方安全公告GHSA-2wrx-84qj-4pcg及GHSA-4mxg-hpvf-2386覆盖稳定v1.61.0，不能默认采用该稳定版。固定master源码7d22f0e已出现解码深度、infohash不匹配拒绝及Tracker响应上限修复，但不能推断全部安全问题消失。其`tracker/http/client.go`明确使用InsecureSkipVerify=true，未见可配置的安全TLS入口；不能为接入而静默接受。**稳定版拒绝；当前源码尚不符合默认接入条件** |
| cenkalti/rain v2.4.5 | MIT，官方2026-11-01稳定发行，Go1.26.0；官方README报告put.io生产采用，协议、磁力、DHT、文件持久化及资源预算完整；有Tracker/Webseed TLS校验开关，支持按自定义ID添加和StopAfterMetadata | Config的CustomStorage类型来自上游internal包，不能假定可在本项目实现；CustomLogHandler会修改上游共享全局handler，不能当成每Session独立日志注入。配置未见项目可注入的逐次出站Dial策略；按文件wanted选择也尚未证实。**有价值的条件候选，不因版本更新就直接采用** |

官方安全公告：[递归解码](https://github.com/anacrolix/torrent/security/advisories/GHSA-2wrx-84qj-4pcg)、[magnet元数据身份](https://github.com/anacrolix/torrent/security/advisories/GHSA-4mxg-hpvf-2386)。安全结论以官方公告和固定源码为证据，没有将搜索中的第三方漏洞描述直接认定为未修复事实。

## 能力、所有权及架构判断

| 维度 | 当前判断及未决点 |
| --- | --- |
| 用例与副作用 | 本人创建真实BT任务；产生tracker/peer网络I/O、暂存随机写和最终私有文件发布；必须区分引擎完成与转存完成 |
| 现有能力复用 | GORM/owner事务、Storage、IAM、调度Contribution、Transfer摘要与发布、写锁；不新建万能队列或memory任务主存储 |
| 新能力与归属 | BT引擎/下载节点为files专属Adapter及Service用例；尚无跨业务消费者，不应凭复杂度提升为Kernel通用Capability |
| 资源与运行 | 候选Client、连接、临时文件和可能的外部进程必须有所有者、取消、关闭与等待；不能在构造期开始下载 |
| 配置与Secret | 节点地址/根目录/凭据及预算必须受控、严格校验、默认值集中；不可进入浏览器、日志或tracked文件 |
| 出口契约 | 需表达元数据、稳定文件清单、选择、进度、暂停恢复、完成内容读取与清理；不复制整个第三方API |
| Reload | 引擎/根目录配置可能要求RestartRequired；代际并存、RPC在途操作和孤儿任务尚待确定，不能声明支持热切换 |
| 契约适配 | 当前HTTP单文件契约不足；必须先定义多文件聚合、预算与发布事务，不能增加隐藏nil child兼容分支 |
| 架构适配 | 当前files垂直模块、Scheduler及Storage仍适用；局部聚合调整有实际收益。不需要另建通用任务平台 |
| 失败与重试 | 需持久意图、租约围栏、元数据期限、节点中断、清理债及有界重试；完成后恢复不能重复创建用户文件 |
| 日志 | 按开发日志authority注入受控Logger，只记录节点/任务稳定ID、phase和分类；不记录magnet、tracker query、peer原文或RPC密钥 |
| 迁移 | 不能重置本地v16数据；具体追加schema尚未确认，不提前修改migration/checksum |
| 验证 | 20项接通后集中做受控本地seeder、真实元数据与字节、重启恢复、两账号同hash、失败与配额、原数据、浏览器和视觉验收 |

## 推断与下一步

外部下载器和嵌入式库各有真实收益，尚无可验证的完整默认接入路径；当前研究门禁不通过。下一步按顺序完成：

1. 验证Transmission新RPC、稳定身份、重复hash及共享根目录行为；不向参考站写入数据。
2. 比较外部节点受控网络边界与嵌入式候选可配置边界。若需局部fork，必须量化维护、许可证、升级、回退和退出条件，不能悄悄patch依赖缓存或建立隐藏overlay。
3. 确定多文件候选、预算及原子/逐项发布语义，证明与实际Transfer/写锁路径相容。
4. 再形成可执行计划及文件清单。用户已要求直接实施，本任务无需第二次审批；未决的是工程证据，不是用户授权。

局限：未执行下载器进程、真实BT交换、候选依赖构建、安全扫描或产品新增测试；没有据源码阅读宣称Windows/Linux运行通过。候选安全与版本易漂移，实施前必须按metadata触发器定向复核。
