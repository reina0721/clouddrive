# R129-001 持久离线下载研究

## 问题与证据方法

以305667e干净工作区、根README/范围、实际generation组装、Scheduler Hub、Transfer事务、tusd暂存和标准HTTP为基线。复用037:R003的调度准入结论、057:R007的one-shot出站边界、R123-001的原子流式发布与R123-003安全工具链、R128-001配额/历史规则。上述记录的Snapshot与不适用范围已检查；本任务触发新的源与后台生命周期复核，没有把旧框架声明当作业务已实现。

参考站只读打开/downloads及“新建离线下载任务”，观察进行中/已完成、自动刷新、逐行链接及保存目录。账号无任务，没有向参考站创建下载、上传或改变配置。真实运行卡片的细节无法从空状态证实；本地将以可验收行为验证，不声称逐像素复刻。

## 现有事实

- 当前文件模块没有服务端下载任务或出站文件读取。已有Transfer是真实上传/发布聚合，拥有owner/全局容量预留、暂存位置绑定、摘要、发布与清理债。
- tusd Store已拥有UUID路径和OS锁。直接给另一个下载器暴露其内部路径会穿透边界；新增追加能力应留在同一Adapter，不创建第二份下载临时目录。
- pkg/httpx.Client读完整响应到受限内存，不适合512MiB流；基础Client不得恢复隐式通用重试。
- Scheduler已有gocron v2.22.0、generation准入、取消和有界排空；Execution是memory治理，不是业务持久任务库。控制台自己的TaskRecord也只表达API集合调度，不能作为files万能任务表。
- files.New仍只返回Handler，未贡献Scheduler/Participant。其构造纯内存，预准入I/O另有ValidateStorage/PrepareTransfers。participant在Prepare启动，不能在其Start里提前下载；应交由Commit之后开放的ScheduleBinding派发。
- Scheduler原始默认配置enabled=true，但完整config.example显式false；独立文件预览未覆盖Scheduler，因此当前预览已启用调度。其他生产模块未声明业务Schedule，console.workbench.dispatch另有绑定。新功能不能暗中开启原来禁用的普通环境；需要读取global及task override的实际准入状态。
- DB使用GORM Silent；业务日志可继续只输出稳定任务ID、phase与错误码，不记录源URL、query、原始参数、subject或错误文本。

## 分类与成熟候选

本任务的HTTP/TLS/DNS/流复制属于标准能力；任务与文件归属、配额、幂等发布、暂停及记录清理属于项目业务规则。没有自建通用下载框架或通用工作流的理由。

| 候选 | 覆盖和维护/兼容证据 | 许可证、采用与替换成本 | 本任务适配结论 |
| --- | --- | --- | --- |
| net/http + 既有tusd/GORM/Scheduler | Go1.26.10已有工具链；标准Transport/取消/TLS/重定向；tusd2.10.1和gocron2.22.0保留 | Go标准许可证；现有生产路径已经采用tusd/Scheduler；窄源契约可独立测试，不将Client/Response传入业务 | **采用标准库、保留既有成熟组件**。补充项目特有的出站规则、强验证器续传和持久任务，不复制协议解析器 |
| grab/v3 | 进度、context取消、续传、名称推断；主分支2026-08-21仍维护，展示的稳定文档v3.0.1较早；当前client源码没有ETag/If-Range处理 | BSD-3-Clause；pkg文档列出下游导入者，但不把其数量当作本项目生产证明；支持自有HTTPClient，主要输出为本地Filename，NoStore使用内存 | **不直接采用**。为共享tusd临时预算和锁，需要重复完整文件或暴露内部路径；强验证器与围栏仍需额外规则。若未来独立下载缓存能提供可验证收益再评估，并非以改动最少拒绝 |
| aria2 RPC / qBittorrent | Cloudreve官方采用；aria2最新公开release1.37.0（2023-11-15），官方多协议/续传/多文件/RPC；有Windows包 | aria2 GPL-2.0，外部进程有独立发行/共享目录和RPC凭据边界；qBittorrent适合BT，不承担HTTP | **完整离线目标的重要后续候选**。当前无安装或受控下载节点；HTTP出站DNS钉住规则不能直接约束外部进程。引入时要同时设计进程/节点、网络与多文件选择，不把HTTP Adapter硬改成RPC万能Wrapper |
| 另建goroutine池、通用durable队列或使用memory Execution当任务主存储 | 现有Scheduler/DB已覆盖执行时机和owner事务；memory记录不具备恢复保证 | 会增加第二套治理、连接或不必要的Redis/Postgres前置 | **不采用**；合理自研仅限files特有持久任务状态及业务围栏 |

Go1.26.10与现有依赖安全基线复用R123-003，新增可达出站符号在20项齐备后的集中govulncheck中复核；不因“使用标准库”宣称无漏洞。未引入Grab或外部下载器，不虚构其安全扫描通过。

## 承载架构与决定

保留Transfer作为文件候选/预留/发布，新增独立DownloadTask聚合，关联Transfer.downloadID。下载任务不同于一个文件传输：完整Cloudreve还需要种子/磁力、多文件和节点。因此不把源URL、控制意图和租约堆进单文件Transfer。当前HTTP任务实际关联一个子传输，关联结构允许后续任务有多个文件，但不增加未实现的Driver分支或假文件清单。

files.New迁为Module{Handler, Contribution}，以既有module.Contribution输出源Transport生命周期Participant和下载ScheduleBinding。composition集中收集贡献并在启动participant前统一校验，沿原Scheduler Prepare/Commit/Retire，不另建worker框架。Participant.Start只开放源Client资源，无外部下载；实际任务只有已提交Scheduler能触发。源Client Stop关闭闲置连接，任务context和心跳均有停止与等待出口。

Task通过GORM owner事务领取持久租约；候选Transfer沿既有暂存与发布。最终发布事务读取任务意图和租约token/期限，拒绝旧worker。文件发布与任务最终确认构成明确可重放的两步：若进程在文件发布后、任务确认前退出，下一worker从已完成Transfer对账，不再下载或创建第二文件。新增SourceOffline不进入浏览器tus控制接口和原传输列表，配额统计仍共用同一预留表。

## 适用、限制与退出条件

本批HTTP/HTTPS单文件源，无任意Header/Cookie、用户密码、file/ftp/magnet协议或脚本执行。服务端出站默认仅公网、每跳重新校验并连接已验证IP；Proxy环境变量不参与，签名query不输出到摘要/日志/Referer。内网是管理员显式CIDR额外许可；回环仅在隔离QA配置用于真实下载源，用户预览默认不放开内网。

本批不是完整离线目标完成声明。磁力、种子、多文件选择、远程下载节点仍需后续批次；届时用此Task聚合和关联Transfer落实具体成熟下载器，重新打开研究门禁。没有共享暂存的多实例、自动覆盖同名文件和无限重试不在本批实现。内存只保存取消句柄，不保存唯一任务状态。暂停/失败保留有界临时文件，取消/删除完成清理后才释放预留；删除任务不删除已发布文件。

## 门禁与刷新

关键事实、候选与承载路径足以形成计划，研究门禁通过。基线305667e；实施入口只检查相关漂移、备份和冻结128预览。若多协议/多文件成为本批要求，Source/Transfer/任务事务语义、Scheduler准入、存储租约或网络政策改变，则回到本研究定向刷新。Go构建、功能测试与扫描统一等待F181–F200全部接线标记后进行。

## 实施入口定向复核

基线305667e未漂移，仅本任务文档新增；两份一致性备份与128生产前端冻结完成。复核tusd2.10.1 filestore.WriteChunk源码220–235行：copy失败分支会忽略file.Close的第二错误。服务端追加在同一tus Adapter中使用标准io.Copy并显式join关闭/取消错误，metadata、路径和OS锁仍由同一Adapter与tusd管理；原WriteStream复用此追加实现，避免保留两套服务端流写。原生tus协议内的上游清理语义不因此被宣称全部修复。HTTP body空闲检测按单次Read拥有并等待标准Timer回调，只取消本请求，保留成熟Transport的HTTP/2复用支持。
