# 分享与内容操作详细设计

## 业务归属与接线

files 继续拥有 Entry、树、配额和 Share，model/service 不导入 IAM、GORM 或浏览器。repo 承担事务与持久化，HTTP binding 拥有 code-first operation，composition 注入 passcode hasher、clock、ID、logger 和既有资源；不创建第二套数据库/Storage/认证客户端。Hasher 由 files 消费方声明 Hash/Verify 窄接口，composition 适配现有 IAM Argon2id 实现，返回 bool 而非 IAM 内部类型。

技术结论：保留现有设施、升级 files 自有批量业务契约、合理自研 Share/树操作、使用 Go ZIP 与浏览器原生媒体；不升级依赖、不引入传输框架、不重构 Kernel、不保留第二套文件实现。

## 树、复制与内容替换

Repository 在既有 storage→owner 锁顺序下增加 ChangeMany，回调返回同 owner 的新增/更新 Entry 集合，整体事务提交；单项 Change 复用同一内部实现。校验 ID 不重复、OwnerID 一致；所有新 ID 使用 CREATE，已存在 ID 必须在当前 owner snapshot 内更新。

复制在当前快照中确定有效子树、检查目标不在自身/后代、条目上限、名称与配额，再生成新 ID 和映射父项；不可变 ObjectKey 可复用，UploadKey 清空，副本内容替换时另写对象，逻辑配额按每个当前 Entry 计。单次树复制默认最多 500 条，总逻辑字节由账号配额、最大条目数与单文件上限共同约束，不读取整树内容。不得循环单项事务造成部分树。

Entry 增加 ContentRevision，增量 migration 将已有行设为 1，新建也为 1。文本替换限制 1 MiB、有效 UTF-8 和文本类型，输入 expectedRevision；新随机对象写入成功后，在同一事务内核对 revision/有效祖先/配额差值并替换 key/hash/size/type，revision+1。冲突补偿只删除本请求候选；旧对象不删除，避免副本引用失效。当前无物理 GC，旧内容保留不等于已提供历史版本 UI，磁盘占用可能大于逻辑配额，运行说明必须明确。

创建文本/Markdown 使用既有上传写入能力及幂等键，不另造存储协议。目录选择由 Host 验证相对路径分段，拒绝空段、点段、绝对路径和反斜线穿越；按前缀创建目录并串行复用创建结果，文件仍进入统一有界队列。重试保留候选幂等键，目录冲突只在可验证为本人同级目录时复用；失败逐项呈现，已成功目录/文件不回滚。粘贴只处理 clipboardData.files，不使用后台剪贴板读取权限。

## 分享状态、数据与授权

新增 files_shares：ID、OwnerID、RootID、Token（高熵随机 secret，仅本人管理输出）、PasswordHash（永不输出）、ExpiresAt、RevokedAt、CreatedAt；解锁票据表存票据摘要、ShareID、过期时间。迁移只增加表/列，不改写已应用 migration。Share ID 由既有 ID 生成器提供，token/ticket 用 crypto/rand 生成至少 256 bit，token 和 ticket 不记录日志。

分享状态以服务端 clock 计算 active/expired/revoked/target-unavailable。每次公共 metadata/list/content/unlock 均检查分享、有效期、撤销和根/请求项祖先；目录范围采用 ParentID 链逐层校验，不依赖用户提交 owner/path。根进入回收站后不能读取；恢复后仍须满足分享自身状态。匿名 metadata 在受密码保护且未解锁时只返回 locked 标记，不泄漏文件名或子树。

访问码用现有 Argon2id；IAM 通过公开 CredentialDigests facet 收窄内部 adapter，composition 注入 files 使用方契约，不直接导入模块 adapter。校验取得有界 KDF 名额，不排无限队列。计数和窗口由 DB 记录，默认每分享每分钟最多 10 次解锁尝试（含成功），超额 429；事务先占一次尝试再执行 KDF，窗口到期自然重置，取消不伪报成功。窗口配置最短 1 分钟，避免缩小窗口绕过 CPU 预算。票据 15 分钟且不晚于 Share.ExpiresAt，存 SHA256 摘要；访客只通过 X-Share-Grant header 提交，不把密码/票据放 query。撤销会在每次请求检查，已发票据也失效。无密码分享不需要票据。同分享签发新票据时清理其过期票据，不删除文件/审计记录，不启动后台清理。

管理 API 走既有 console native 与 files:read/write，会话+CSRF仍有效。公开 API 明确 SecurityNone/PolicyPublic，不修改任何私有路由认证。路径目标：`/api/v1/file-shares/{token}` metadata，`/unlock` POST，`/entries` GET，`/content/{id}` GET；管理 `/api/v1/files/shares` GET/POST、`/{shareId}/revoke` POST。固定管理路径优先于 `{id}`，由 route/catalog 验证不冲突。公开解锁不修改 IAM，要求同源 Origin；浏览器 header 凭据不作为跨站 form 可用的 query 参数。

## 预览、ZIP 与交互

Host 通过已鉴权内容 API 取得 Blob，按受控媒体白名单创建 ObjectURL；拒绝 SVG/HTML inline。Surface 不访问 File/Blob/DOM；通过文件预览语义组件和 Host 注入的渲染/资源 Port 展示图片、音频、视频。关闭、切换、卸载或账号切换均 abort 请求并 revoke URL，音视频停止播放；画廊只加载可见有界批次，不一次加载整库。无法解码明确显示失败及下载入口。

ZIP 只处理当前 owner 有效条目，去重祖先选中项，保留相对层级并拒绝不安全路径；默认最多 500 条、总原始字节 64 MiB。先检查元数据预算，读取逐项响应取消并核对哈希/大小，archive/zip Writer 的 Write/Close 全部保留错误；失败不输出成功 archive。复用传输名额，限制同时打包数和内存上界。

文件卡片改为简洁图标/名称/复选框/更多菜单，选择文字保留可访问名称但不重复占据整行；使用现有 MenuButton/Dialog/Action，不手写 popup 焦点系统。右键若现有 primitive 不支持，采用正常更多菜单并通过显式 ContextMenu Adapter 扩展，而非复制无可访问性菜单。Host 将快捷键转换为语义订阅事件，编辑字段中不触发全选/重命名/删除，不跨页面残留监听。

公开页固定 `/share`，token 使用 fragment，Host 解析后注入独立 PublicFilesPort。file-shares 插件拥有访客页面；Host generator 仅针对该路径选择独立 `(file-shares)` 部署组（现有 `(public)` 含 AuthFrame，不适用于访客文件页），使其位于 ProtectedGate 之外，不增加第二套 Plugin 路由或认证声明。私有路由仍在 `(app)`，不借用需要 IAM 主体的私有 FilesRuntime。我的分享位于 files 插件 `/home/shares`，复用同一私有 FilesRuntime，不给匿名页面注入私有 Session。路由变更按 generated chain 生成；不手改生成物。

## 配置、错误、日志和文件影响

所有预算集中在 files policy/config，严格校验并沿用 RestartRequired；新增文本、ZIP、复制条数、KDF并发、失败窗口/次数和票据寿命默认值，不能散落页面。增加 migration v3（必要时后续递增），预览前备份现有 SQLite，仅 additive 迁移。无新后台 goroutine、周期删除或独立 listener；共享资源仍由 Kernel 关闭。

service 完整保留底层错误，HTTP 呈现稳定 missing/conflict/invalid/quota/large/busy/locked 错误。不可访问 token/根/子项统一无内容响应，防止枚举；密码缺失/错误用受控 locked，失效票据不复用 IAM 状态。只在协议结果边界记录操作/结果码/关联 ID，不记录 token、密码、文件名、原始 URL/body。既有模板化 route 日志必须纳入负向验证。

影响 internal/module/files 全链与 additive migrations、composition hasher、httpcatalog生成物、Surface files 契约/插件/翻译、Host files/public route与媒体实现、UI Adapter必要菜单扩展、对应架构登记、config.example、API 和唯一当前运行 authority。保留当前有效功能，替换旧卡片操作布局后删除旧重复按钮路径。

## 集中验证与刷新条件

F21–F40 全部实现后集中测试：复制原子性/循环/配额/冲突，文本CAS/UTF8/取消/补偿，目录穿越与部分失败，真实图片/音视频格式，ZIP解包逐项字节比对，分享密码/到期/撤销/外目录ID/回收祖先/两个owner/匿名隔离/并发解锁/重启持久化，route日志不含secret。桌面与窄屏截图对照参考站，键盘操作和资源释放检查。运行相关 Go/前端单元/真实HTTP/浏览器/生成物/文档门禁及构建，失败按影响定向复测。完成后重启专用预览，刷新忽略文件内凭据，按提交skill审阅精确diff提交并尝试推送。

基线 `998f63c`；实施前只比较新增变更路径与 R121-001 refresh_triggers。新事实推翻目标、public契约或资源/依赖选择时更新本设计并记录，不重复全仓研究。
