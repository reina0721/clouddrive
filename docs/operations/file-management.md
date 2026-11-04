# 私有文件管理

浏览器默认进入 `/home`，管理工作区位于 `/workspace`。文件属于当前 IAM 账号；管理员账号也只能通过文件 API 操作自己的内容，不能凭其他账号文件 ID 越权读取。普通账号需要被分配 `files:read` / `files:write` 权限。公开注册沿用已有注册策略，不自动扩大默认角色权限。

## 当前能力

当前提供目录和面包屑、创建目录、文件/目录上传队列、拖拽/剪贴板文件、取消和重试、下载/ZIP 打包、重命名/移动/文件与目录复制、多选、回收恢复、名称搜索/类型分类/排序、网格/列表/画廊、属性/逻辑占用、文本/Markdown 创建、带版本冲突保护的文本编辑、栅格图片及浏览器原生音视频预览，以及文件/目录的只读分享。新增大文件分块续传、暂停/继续、刷新重选源文件、跨应用路由传输和 `/home/transfers` 持久传输中心。HTML 和脚本按文字展示，不执行。

文件内容与元数据持久化；刷新、重新登录或正常服务重启后仍可访问。目录进入回收站后，子项不能通过搜索、文件 ID 或下载链接绕过祖先状态。回收站继续占空间；本批没有永久删除或自动清空。

持久的“与我共享”账号协作、连接挂载、离线下载、通用后台任务中心、版本历史界面、Office 协作、字幕和媒体转码尚未接入，不能将上传传输中心称为这些能力，也不能称为 Cloudreve 全量兼容。

## 配置和传输限制

模块配置 `files.maxFileBytes` 默认 512 MiB、`files.quotaBytes` 默认每账号 1 GiB、`files.concurrentUploads` 默认 2。可配置为更小的正数预算；文件上限不能超过 512 MiB，并发不能超过 2，配额不能小于单文件上限。修改 files 配置需要重启。并发名额属于当前 Application Generation；切换其他配置排空旧代期间可能同时存在两代有界请求。

Storage 通过租约内的可寻址流读写内容，local/S3-compatible 都有真实实现；原有 bytes 方法继续服务小内容消费者。上传使用 tus 核心 HEAD/PATCH，创建和控制会话使用项目 JSON API；不声明支持 tus Creation、拼接或 IETF 草案。每块默认 4 MiB，Next 同源代理仍限制单请求 32 MiB，不需要把代理预算放大到整个文件。原始分块在认证和准入后限制字节数；普通 JSON 请求仍保留原上限和默认 10 秒超时。精确传输路由使用 `http.transferTimeout`，默认 5 分钟、最高 15 分钟。空文件允许上传。

上传前增量计算完整 SHA-256，校验进度与已接收进度分开显示。断线按 0/1/3 秒有界重试，HEAD 核对服务端偏移；认证失败和到期不会无限重试。暂停保留暂存，刷新或重新登录后需要重新选择同内容文件，名称相同不足以证明内容一致。应用内切换页面不销毁活动队列；退出登录停止本地读取和请求。浏览器关闭后不会自动读取本地文件。

`files.transfers` 的 `stagingPath` 默认 `.data/file-transfers`，`chunkBytes` 默认 4 MiB，`stagingBytes` 默认 2 GiB，`ownerCount` 默认 20，`globalCount` 默认 100，`lifetime` 默认 24h，`lockTimeout` 默认 5s，`lockRetryInterval` 默认 100ms，`networkTimeout` 默认 30s，`completionTimeout` 默认 5s。容量和期限有严格上界，具体可用键见 `config.example.yaml`。暂存为单机持久目录，不能把无共享暂存的多主机部署视为已支持。过期和清理待办由请求驱动，每次最多处理两项，不启动无限扫描或后台清理线程。

会话创建在事务中预留容量；取消或过期释放预留，清理失败保留待办且导出错误。复制和小文本仍可使用逻辑配额，最终发布重新核验实际占用。发布时名称冲突、目标失效或配额不足保留完整暂存，可在传输中心修正目标再完成；取消不会删除已发布文件。

`files.maxTextBytes` 默认 1 MiB、`maxArchiveBytes` 默认 64 MiB、`maxBatchEntries` 默认 500、`maxThumbnailBytes` 默认 2 MiB、`maxGalleryEntries` 默认每屏 12、`maxMediaBytes` 默认 32 MiB。各值必须为正且不得超过默认上界；均经列表响应提供给 Host，不在读取失败时退回隐藏预算。目录上传最多选择 500 个文件与非空目录的合计条目，不创建空目录；已建立会话的文件可刷新重选续传。画廊按屏加载，超过缩略图或媒体预算显示下载提示；栅格图像核验签名，SVG/HTML 不作为媒体执行。音视频的解码能力取决于浏览器，没有生成字幕或服务器转码。

上传、文本替换、ZIP 和原始内容响应共用传输准入名额；Host 媒体请求按序读取，避免一屏图片同时占满内存。关闭、切换和卸载会取消请求、停止播放器并释放 Blob URL。快捷键包含 `/` 搜索、F5 刷新、F2 重命名、Ctrl/⌘+A 全选、Escape 清除选择、Delete 移入回收站、Ctrl/⌘+Shift+N 新建目录及 Enter 打开单选项；输入框和浮层内不会触发文件操作。

复制在单次数据库事务内保存整个有效子树，逻辑配额按副本目录项重复计费；不可变对象可由多个副本引用。文本替换使用 `contentRevision` 比较并交换，冲突保留当前编辑而不覆盖已提交内容；旧对象不自动删除，因此当前逻辑占用不等于物理磁盘占用，也不代表已经提供历史版本管理。

续传先持久化会话并锁定其暂存，完整校验后写入按会话 ID 固定的不可变对象，最后在数据库事务中复核配额、名称和目标，成功提交才可见。发布中断后重试复用该会话与候选对象；清理暂存失败保留已完成事实和清理待办。小文本创建/替换仍有独立的补偿错误记录 `files_pending_cleanup`；不存在全对象垃圾回收或历史版本清理承诺。

`files_storage` 持久化内容位置摘要；存在文件、活动传输或待清理记录时，禁止无迁移更换 Storage root/driver/bucket。`files_transfer_staging` 同样绑定暂存位置，活动或待清理会话存在时不能换根。提交元数据时再次核验位置，避免旧代继续写入已改变的位置。更换凭据不改变内容位置摘要。迁移内容到新位置需要单独设计和验证。

## 只读分享

文件菜单可创建分享，`/home/shares` 管理本人分享并撤销。分享可设置有效期及可选访问密码，默认由服务端策略决定，最长 30 天；共享目录包含当前及未来的有效子树，根目录进入回收站后不能访问，恢复后仍需满足未撤销、未到期条件。分享不是 IAM 身份，访客不能上传、编辑或删除，也不能通过其他文件 ID 越出共享根。访客刷新遇到失效分享时清空旧目录内容，不将缓存条目继续呈现为可访问内容。

访客页位于 `/share#token=...`，token 为 256 bit 随机 capability，放在 fragment，页面与响应使用 no-referrer/no-store。Host 独立请求公开原生 API，不携带 IAM Cookie。服务在每次请求及内容读取后重新检查状态与范围；密码保护的未解锁响应不暴露目标名称。密码使用 IAM 公开窄 facet 复用既有 Argon2id，不另造算法。

`files.sharing.maxAge` 默认 720h、`grantTTL` 默认 15m、`attemptWindow` 默认 1m、`attemptLimit` 默认 10、`kdfConcurrency` 默认 2。票据不晚于分享到期，数据库只存票据摘要，客户端只在内存保存票据并以 `X-Share-Grant` 提交；撤销后已有票据同样失效。所有 KDF 尝试（包括成功）占用持久化窗口，超额或准入繁忙返回 429；窗口允许 1m–1h，次数和并发不得超过默认值。密码为 8–128 字节，错误响应不返回密码或摘要。同分享签发新票据时清理过期票据，不启动后台垃圾回收。

私有下载采用同源原生链接，公开下载先 POST 授权，再签发限定单文件及内容版本的短期句柄，由浏览器原生保存；页面不先缓存完整大文件。私有和公开 GET/HEAD 均支持 Range、If-Range、ETag、Last-Modified。每次请求复核归属、祖先或分享授权，不提供永久对象 URL。`files.sharing.downloadTTL` 默认 1m、`downloadLimit` 默认每分享 100 个有效句柄；到期不晚于分享和原解锁票据，撤销立即阻断已有句柄。数据库只保存摘要，不记录原始凭据到日志。

files 迁移当前为 v6：v5 增加持久传输与暂存位置绑定，v6 为已有票据表增加单文件/内容版本约束。v1–v4 保持原样；不重置既有账号、文件或数据库。MySQL/PostgreSQL 脚本已提供，实际升级验收限于 SQLite。

## 本地预览

执行 `./scripts/Start-FilePreview.ps1` 会构建最新后端、只迁移专用预览数据库、重启本脚本记录且启动时间吻合的进程，并验证独立预览账号。默认 WebUI `http://127.0.0.1:4180/home`、API 8120、management 9120。独立数据位于 `.data/file-preview/`，不会重置原有 `.data/app.db`。

地址、用户名、密码、设置令牌及有有效期的 Cookie/CSRF 调试资料保存在 `.data/preview-access.json`；参考站资料由本次操作保存在 `.data/reference-access.json`。二者均应保持 Git 忽略，不能复制到源码或提交说明。预览进程在验收后持续运行，开发下一批时重新构建并重启，以预览最新实现。

现有 console 转发层在登录时保存 HttpOnly/Secure/SameSite 的 IAM CSRF 会话 Cookie，并沿用原有 Origin 与双提交 CSRF 校验。转发不再逐请求轮换原生 CSRF，以免并发写入互相失效。升级前已存在的旧会话可能需要重新登录。

## 验证入口

先实现一批 20 项，再集中验收；失败后只对修复影响范围复测。

```powershell
# 受影响业务与真实 HTTP/数据库/重启验证
go test ./internal/module/files/... ./internal/composition ./pkg/storage/...
# 启动或重启持久预览后，在 frontend 目录执行
npx --yes pnpm@10.22.0 exec playwright test --config playwright.files.config.ts
```

浏览器验收读取忽略目录里的预览资料，不将凭据写进测试源码；可用 `CLOUDDRIVE_FILE_TEST_ACCESS` 指定隔离账号资料的绝对路径。8 项真实流程覆盖原文件闭环、双窗口冲突、媒体解码、目录/剪贴板、ZIP、匿名分享与撤销，以及 33 MiB 上传、中断恢复、临时 503 重试、跨路由、错误源拒绝和原生下载校验。Go HTTP/SQLite 检查覆盖两个 IAM owner、配额预留、实际进程重启、目标冲突修正及 206/416/条件下载。截图与 trace 位于 Git 忽略的 `frontend/test-results/`，trace 可能包含会话信息，不应提交或公开分享。外部 MySQL/PostgreSQL/S3/MinIO 实例与生产部署没有验收。
