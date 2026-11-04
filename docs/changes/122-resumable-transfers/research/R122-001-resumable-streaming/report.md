# 续传与流式承载研究

## 方法与事实边界

2026-11-03 在干净 revision c9071553b23f4e2e18d376245a3c42ee1d8e432d 检索研究 metadata。R120-001 的 bytes 结论在首批有效，R121-001 也将大文件列为刷新触发器；本研究扩展适用边界，不改写两份历史证据。上一轮完成94文件功能提交和交付记录，属于实质进展；GitHub 403 不妨碍继续开发，不把整个 goal 标为阻塞或完成。

参考站会话仍有效。只读观察 /tasks：侧栏选中后台任务、自动刷新开关、空态“没有记录”；/connect：WebDAV账号表与iOS/Windows客户端标签，创建窗口有备注、相对根、只读、阻止点文件与反向代理，取消窗口未保存。浅灰画布、蓝色窄侧栏、独立白色内容区仍与本地管理框架不同。参考根目录为空，未上传大文件，不把续传行为写成参考实例实测；续传是完整网盘目标中当前明确缺口。

## 已定位的代码事实

- files/service.Content 仅 Put/Get bytes；Upload、Download 与 Host content() 均会整体缓冲。maxFileBytes 被限定32MiB，FilesPage队列随路由组件卸载，Source File保存在Host临时Map，没有持久传输记录。
- pkg/storage/stream.go 虽有 StreamingClient/Fallback，production无消费者；fallback仍io.ReadAll，并非有界流。Kernel storage.Client和borrowedClient只暴露bytes；租约退出取消，不能直接返回仍依赖租约的reader。
- local.Client使用候选文件+rename和contextReader，适合扩展真实流式写入；S3-compatible使用已声明AWS SDK v2 PutObject/GetObject，但Get仍ReadAll且Close错误没有合并。二者资源由Kernel创建，不能旁路新建客户端。
- composition/files.go是实际内容Adapter，generation.go显式构造files；module.go约束纯内存装配，ValidateStorage是命名的候选I/O入口。已有storage identity可拒绝有内容时更换位置，但尚未检查新增暂存目录。
- HTTP Huma registration/gate是唯一operation源；problemAdapter缓冲普通输出，现有原始内容通过UnwrapHTTP使用ResponseWriter。console forwardNative已流式透传body并克隆上下文，但HEAD虽免console CSRF，files guard仍把非GET全部当mutation，需同步safe-method语义。
- applicationRouter先装全局RequestTimeout（默认10秒）与BodyLimit（32MiB），socket read/write默认15/30秒。仅在业务handler里延长context无法突破父deadline，必须显式改变HTTP承载。Next rewrite单请求上限32MiB；分块不要求放大整文件代理上限。

定位：internal/module/files/{service,repo,binding/http}，internal/composition/{files,generation,service}.go，internal/module/console/binding/http/http.go，internal/transport/http/{routes,huma}.go，internal/kernel/app/storage/storage.go，pkg/storage/{client/client,local/client,s3compat/client,stream}.go，frontend/apps/web/src/files/{backend,runtime}.tsx?，frontend/surfaces/plugins/files/src/files-page.tsx，frontend/apps/web/next.config.ts。以上为已读源码路径，后缀按实际文件。

## 成熟候选与架构结论

|候选|覆盖、维护、安全和代价|决策|
|---|---|---|
|[tusd v2.10.1](https://github.com/tus/tusd/releases/tag/v2.10.1)|官方Go实现，MIT，Go1.25.14可由本项目1.26.6编译；含HTTP offset和锁语义，可嵌入，filestore持久化。官方安全页当前无公开公告，不等于无漏洞。官方示例采用filestore+filelocker；项目无需引入独立进程或云SDK后台。|采用handler/filestore/filelocker，隔离于files adapter；禁止默认logger/CORS/下载或实验草案。锁超时和中断收尾必须明确。|
|[tus-js-client v4.3.1](https://github.com/tus/tus-js-client/releases/tag/v4.3.1)|MIT，Node>=18兼容当前24；2025稳定tag，main仍演进5.0预发布，不能误选pre3。支持暂停、恢复和请求hook，官方文档提供Promise式onBeforeRequest注入CSRF。官方安全页无公开公告。|采用稳定4.3.1，仅Host依赖；自有Port屏蔽其类型和URL存储；不用默认全局fingerprint跨账号恢复。|
|[noble-hashes 2.4.0](https://github.com/paulmillr/noble-hashes/releases/tag/2.4.0)|MIT，Node>=20.19，增量SHA256、无运行依赖，2026仍维护；官方列出1.0.0的Cure53审计，不能称2.4.0全部已审计。官方安全页无公开公告。|采用Host局部sha2增量哈希；文件按块读取，不用SubtleCrypto整文件arrayBuffer；服务端用Go crypto/sha256复核。|
|AWS S3 multipart/直传|官方SDK已有成熟能力，但浏览器直传还要求独立凭据、CORS、multipart资源和完成治理；不能覆盖local。当前真实客户端可PutObject seekable文件流，512MiB低于单Put对象范围。|保留已有SDK，流式Put使用seekable暂存源并提供长度；不引入第二套S3存储或manager仅为本批512MiB。未来>5GiB另评multipart。|
|Uppy/外部tusd服务|Uppy可提供完整上传UI，但会引入第二套界面/状态装配；外部tusd需独立部署、认证转发和存储位置。|本批不采用；轻量客户端+现有UIAdapter更符合Surface/Host，保留未来替换Port能力。|
|扩大自研fallback/自写offset协议|当前机制无法表达断点和有界内存；HTTP offset、锁、取消已有成熟实现。|退役无消费者ReadAll fallback，不扩建；重构Storage租约和HTTP profile，项目只自研业务持久状态、配额和发布事务。|

主源：[tus协议](https://tus.io/protocols/resumable-upload)、[嵌入](https://tus.github.io/tusd/advanced-topics/usage-package/)、[锁](https://tus.github.io/tusd/advanced-topics/locks/)、[tusd config](https://github.com/tus/tusd/blob/v2.10.1/pkg/handler/config.go)、[filestore](https://github.com/tus/tusd/blob/v2.10.1/pkg/filestore/filestore.go)、[client API](https://github.com/tus/tus-js-client/blob/v4.3.1/docs/api.md)、[AWS流输入](https://docs.aws.amazon.com/sdk-for-go/v2/developer-guide/sdk-utilities-s3.html)。2026-11-03又以GitHub releases/latest只读API确认三个实际稳定tag，解决pkg.go.dev缓存的latest提示不一致。Go漏洞站查询未成功，不能声称已通过govulncheck；依赖引入后的可达漏洞检查属于集中验证。

## 收益、职责与未决项

设计收益是>32MiB文件可实际传输、内存不随文件线性增长、同一offset可在刷新/重启后继续、下载和媒体支持Range。必须重构承载，不再叠加第二条32MiB上传或静默fallback。Storage基础流式能力跨业务资源边界，由pkg/Kernel负责；业务暂存只服务files，不升级万能Capability，不跨共享Storage写本地路径。

暂存不是永久对象存储，所有会话有owner、长度、SHA256、到期与容量预算；完成和取消仅清理该会话拥有的暂存，不清空目录、不删除用户已有文件或历史migration。cleanup需可重试且留有记录。一次最终发布使用不可变object key、现有owner锁及事务，崩溃后通过持久状态和幂等key恢复。

运行范围为单服务同机持久磁盘，gofrs/flock协调进程和generation（实施期定向复核见下文）；不是无共享盘的多主机方案。无新常驻worker，恢复/完成/清理由显式请求驱动；浏览器关闭后没有权限自行重开本地文件，刷新后用户重新选择同内容文件并校验全量SHA256。后台任务中心只展示真实传输，不冒充离线任务队列。

研究门禁通过：现有接口缺口、成熟协议、持久化路径与授权/资源边界已定位，可形成设计。实际三方言、外部S3实例、性能与Windows锁恢复尚未验收；集中测试必须验证本地真实流程，未验证的外部部署不写成完成。依赖图MVS可能带来AWS间接升级，实施首次解析后定向审查；若新版本安全/Go不兼容或路径不能满足原子与取消，退回研究，不降级自写协议。

## 实施期定向复核：暂存锁

安装所选tag后读取实际源码，发现tusd/filelocker的Unlock只通知轮询goroutine退出，没有等待完成，且有意忽略.stop删除错误；项目无法在其公开API上验证等待退出。该事实命中资源所有权条件，先刷新本节与设计，再继续锁实现，未先实现自研锁。采用[官方gofrs/flock v0.13.1](https://github.com/gofrs/flock/releases/tag/v0.13.1)的OS文件锁：2026-11-03 releases/latest确认2026-08-27发布，BSD-3-Clause，有Windows独占文件锁源码和context轮询获取API，无后台owner goroutine；Close释放锁并关闭句柄，锁文件不删除以免不同inode并发。相对tusd/filelocker，代价是没有主动打断前一个请求的.stop协议，收益是无需后台轮询和清理协议，取消由当前请求拥有，竞争者有界等待即可。SDK/协议仍采用tusd，未改为自写offset。官方安全页当前无公开公告，不等于全量漏洞扫描通过。

实际MVS解析因tusd最低依赖将AWS SDK/S3/Smithy与x/crypto、x/net、x/text、grpc/protobuf推进到其要求版本，完整变更在go.mod/go.sum和忽略的.data/122-go-dependency.log；不尝试降到不满足上游要求的版本，后续集中校验这些真实依赖变动。

