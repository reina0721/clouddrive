# clouddrive API 契约

- openapi.yaml：原生 /api/v1 的 Huma code-first 契约；go generate ./internal/transport/http/api 生成，并由 Go golden 测试验证。
- console-openapi.json：/api/console/v1 投影与原生转发接口的 OpenAPI 3.0 文档；从 console-web 的响应/输入校验器和原生 Huma JSON 快照生成。
- internal/transport/http/api/operation_inventory.gen.go：原生 operation 清单，继续参与服务端 operation 授权。

~~~powershell
go generate ./internal/transport/http/api
# 在 frontend 内执行
npx --yes pnpm@10.22.0 codegen:contracts
npx --yes pnpm@10.22.0 codegen:contracts:check
~~~

身份使用 HttpOnly Cookie。所有控制台写请求必须携带受信任 Origin、控制台 CSRF Cookie 和 X-CSRF-Token；GET /api/console/v1/auth/csrf 返回双提交令牌。原生转发还会执行原生权限和 CSRF 检查。

锁屏本人密码复核使用 `POST /api/console/v1/auth/password/verify`；原生为 `POST /api/v1/iam/self/password/verify`（`iam:account:self:read`、WebUI Cookie和CSRF）。只接受`password`，成功返回`{verified:true}`且不写会话Cookie；不是登录或高风险操作授权票据。错误尝试共享登录的持久预算，语义见[文件管理手册](../docs/operations/file-management.md)。

私有文件接口位于 `/api/v1/files`，WebUI 通过 `/api/console/v1/native/files` 访问同一实现，使用 IAM Cookie 会话。`POST /transfers` 用稳定 key、目标、长度与完整 SHA-256 建立会话，`HEAD/PATCH /transfers/{id}/data` 使用 tus 核心协议接续，PATCH 为 `application/offset+octet-stream`；暂停、继续、取消、摘要校验、修正目标与提交发布分别有明确控制端点。旧 `/files/upload` 已移除，文本创建使用 `POST /files/text`。列表响应同时提供空间统计和传输预算，回收站用 `trash=true` 查询。详见[文件管理](../docs/operations/file-management.md)。

文件复制为 `POST /api/v1/files/{id}/copy`；文本替换为 `PUT /{id}/text`，必须带 `expectedRevision`；ZIP 为 `POST /api/v1/files/archive`。分享管理使用 `/api/v1/files/shares` 的创建/检索、`/{shareId}` 的读取/CAS设置、`/{shareId}/state` 的CAS暂停/恢复和 `/{shareId}/revoke`，仍要求 IAM 会话、文件权限和写请求 CSRF。

访客入口 `/api/v1/file-shares/{token}` 的 metadata、entries、unlock、content、text、folders、entries/change、entries/batch、archive及transfers（create/read/data/commit/cancel）operation 显式声明 public，不放宽任何私有 files operation。所有公开写入需要可信Origin，文件操作额外检查当前分享能力、策略版本和范围。解锁POST需要可信Origin，票据通过 `X-Share-Grant` header 传递，不能用 IAM 会话代替。原生浏览器下载经 `POST /file-shares/{token}/content/{id}/download` 授权，随后以短期限定文件句柄访问 `GET/HEAD /file-downloads/{ticket}`。私有和公开下载提供 Range/条件请求，每次检查撤销、到期和范围。

文件权限维护新增 `GET/PUT /api/v1/files/{id}/access`（PUT携带独立revision，policy为null明确恢复继承）、`POST /api/v1/files/audience/lookup`（精确账号/角色查找）及 `POST /api/v1/files/{id}/access/effective`（实际分享及匿名/账号的已保存权限）。均使用原IAM、文件scope与写请求CSRF边界。分享管理投影增加audience，公开metadata增加denied/signInRequired，目录和条目返回实际permissions。公开路由保留public profile，同时可选解析同源Session获取受众事实；存在但无效的会话不会静默降级匿名。详见[文件管理](../docs/operations/file-management.md)。

原生 OpenAPI 与 operation inventory 通过 `internal/composition/httpcatalog` 的同一清单生成，当前共 224 个操作。生成器不再单独选择模块，也不导入带资源的应用组合根。

管理端 `GET /api/v1/files/admin-tasks` 及 `GET /api/v1/files/admin-tasks/{kind}/{id}` 要求 `files:task-admin:read`。`GET /admin-tasks/cleanup-preview` 与 `POST /admin-tasks/cleanup` 另需 `files:task-admin:cleanup`，变更需要 CSRF。清理接受最多 20 个任务快照，返回逐项状态。过期或已变化的选择以详情及结果为准。

列表和清理预览支持 `origin=all|user|system`，默认 `all`。系统类型为 `trash-expiry` 和 `blob-reclaim`。系统记录的 `createdAt` 和 `updatedAt` 分别表示开始和结束，`durationMs` 为毫秒数，用户任务的 `durationMs` 为 `null`。

`GET /api/v1/files/worker-nodes` 与 `GET /api/v1/files/worker-nodes/{id}/check` 要求 `files:node:read`。前者返回本代主机职责与节点摘要，后者返回一次实际 aria2 通信检查与全局统计。管理任务列表和清理预览支持可选的精确 `nodeId`。

`GET /api/v1/files/storage-policy` 和 `GET /api/v1/files/storage-policy/usage` 需要 `files:storage-policy:read`。`PUT /api/v1/files/storage-policy` 需要 `files:storage-policy:write` 和 CSRF，使用当前 `revision` 替换两个可选限额，缺失值继承部署。保存后重启服务生效。用量读取只返回汇总值。

`/api/v1/files/storage-policy/name-rules` 复用存储策略读写权限。规则保存使用独立的 `revision`，服务重启后生效。拥有写权限的管理者可通过 `POST /name-rules/check` 试测提交的规则，返回 `allowed`、`extension` 或 `pattern`。实际写入被拒绝时使用 `files_filename_restricted`。

`/api/v1/files/icon-rules` 提供管理视图及带独立 `revision` 的整组保存。启用 `inherit` 时读取内置规则，空自定义列表关闭扩展名覆盖。`/api/v1/files/icon-rules/active` 仅向有文件读取权限的用户返回活动规则。

`/api/v1/files/applications` 提供带独立 `revision` 的内置应用管理和整组保存。`apps` 可以省略采用内置可用性的条目，`defaults` 是完整的扩展名默认列表。`/api/v1/files/applications/active` 仅提供已授权文件工作区的有效策略，不返回管理权限或修订。

`apps[].extensions` 可省略以继承，也可传空数组以清除该应用的扩展名关联。活动项的 `extensions` 为有效列表，`customExtensions` 表示显式覆盖。管理视图的 `builtInItems` 提供恢复时使用的内置列表。

`apps[].newFiles` 可省略以继承与当前关联匹配的内置新建映射，也可对支持创建的应用传空数组以隐藏新建项。显式映射最多 8 项，`extension` 必须是该应用已关联且唯一的扩展名，`label` 去除首尾空白后为 1 到 48 个 Unicode 字符，且不能包含控制字符。活动项返回 `canCreate`、有效 `newFiles` 和显式覆盖标记 `customNewFiles`。继承项的空 `label` 由界面按语言提供默认名称。

`webApps` 最多 8 项，省略时保留已配置的网页应用，空列表明确移除全部。活动策略通过 `webItems` 返回候选信息，应用 URL 模板仅由管理视图或成功的启动授权返回。默认应用支持 `web-` 加 32 位小写十六进制的 ID。

`POST /api/v1/files/{id}/web-preview` 要求 `files:read` 和 CSRF，提交应用 ID、已展示的来源和当前内容修订。匿名 `GET/HEAD /api/v1/file-web-previews/{token}` 接受短期单文件授权，支持 Range 和条件请求。已确认来源可发起浏览器跨域读取，响应禁止缓存，当前代重启后原凭据失效。

`POST /api/v1/files/applications/wopi-discovery` 要求 `files:settings:write` 和 CSRF，返回可保存到 `webApps` 的 WOPI 查看动作和可用的编辑动作。启动接口返回 `wopi.actionUrl` 和毫秒过期时间。协议客户端使用 `GET /wopi/files/{id}` 和 `GET /wopi/files/{id}/contents`，以专用短期 `access_token` 读取当前版本。回调由 WOPI 客户端直连，不经控制台原生投影。

当发现结果提供编辑动作且管理员设置 `wopi.editEnabled` 时，启动请求的 `mode: "edit"` 需要文件所有者同时拥有 `files:write`。编辑票据支持 `POST /wopi/files/{id}` 的 LOCK、GET_LOCK、REFRESH_LOCK、UNLOCK 和携带 `X-WOPI-OldLock` 的换锁。持锁客户端通过 `POST /wopi/files/{id}/contents` 发送 `X-WOPI-Override: PUT`、锁标识和最多 8 MiB 的二进制内容。成功返回 `X-WOPI-ItemVersion`，锁冲突返回 409 和当前锁头。

管理端使用 `GET /api/v1/files/admin-shares` 和 `GET /api/v1/files/admin-shares/{id}` 查询分享，要求 `files:share-admin:read`。`POST /api/v1/files/admin-shares/revoke` 要求 `files:share-admin:revoke` 及 CSRF，接受最多 20 个 ID 与修订号。任一目标版本冲突时返回 409，整批保持原状。响应不含分享或访问凭据。

全局属性定义使用 `GET/PUT /api/v1/files/property-definitions`，分别要求 `files:settings:read` 和 `files:settings:write`。PUT 要求会话及 CSRF，提交完整清单和修订号，修订冲突返回 409。文件所有者的属性详情返回可用定义，定义变更立即用于后续文件属性写入。详见[文件管理](../docs/operations/file-management.md)。

离线任务为 `/api/v1/files/downloads` 的列表/单项创建、`/batch-create`、`/{id}`、`/{id}/source`、`/{id}/{pause,resume,retry,restart,cancel,remove}`、`PUT /{id}/target`及`/batch-control`，共13个operation。控制使用任务revision CAS；owner取自当前会话，原始来源只由受保护的显式source读取返回并设置no-store，普通DTO不包含URI或租约。仅HTTP/HTTPS，预算与失败行为见文件管理说明。

控制台错误为 {error:{code,reason?}}；分页默认 page=1/pageSize=20，允许 10/20/50。身份与字典写入携带 version；工作区 PUT 使用 If-Match 和响应 ETag；定时任务携带 version，删除任务使用 version 查询参数。冲突返回 409，不自动覆盖服务器数据。

通知与 API 工作区、历史、任务按用户隔离。API 执行权限为 console:workbench:execute；任务写入还需要 console:workbench:write。目标地址、取消、超时和响应限制由服务端执行；不支持的指纹/代理功能返回明确失败。

WebDAV 管理使用 `/api/v1/files/connections`（列表/创建）和 `/{connectionId}`（读取/CAS修改）、`/state`、`/rotate`。一次性密码不进入列表。独立协议入口为 `/dav/{connectionId}/...`，支持 OPTIONS、PROPFIND、受保护属性的 PROPPATCH、GET/HEAD、PUT、MKCOL、COPY、MOVE 和 DELETE，使用独立 Basic 凭据及当前 IAM 权限。该协议不属于 OpenAPI 标准方法清单，不计入原生操作清单；LOCK/UNLOCK不可用。实际客户端地址由管理响应的 endpointOrigin/endpointPath 提供，限制见[文件管理](../docs/operations/file-management.md)。

`GET /api/v1/files` 在同一 operation 承载高级搜索：重复的 `keywords`、`extensions`、`kinds` 参数，`scope`、`match`、`caseSensitive`、字节/时间上下界、`foldersFirst`、`page` 和 `pageSize`。数组不按逗号拆分，字节零值区别于缺失；时间为包含起点、不含终点。返回 `total` 与生效分页及预算。未指定 `pageSize` 或显式 0 保留有界非分页读取，普通网页显式请求 50/100/200；范围、排序和日期语义见[文件管理](../docs/operations/file-management.md)。

本人文件工作区请求可带 `pagination=auto` 或 `pagination=numbered`，两者均按活动设置收紧正数 `pageSize`。自动模式在搜索及筛选时使用游标，并在其他列表读取活动分页模式。结果有 `cursorPage` 时，可带其 `next` 或 `previous` 重发同一查询，省略页码或保留 `page=1`。不存在的方向不会返回游标。锚点失效或作用域变化返回 409，客户端可省略游标重新开始。省略 `pagination` 时沿用原契约。

分享引用管理为 `/api/v1/files/shortcuts`（GET 列表 / POST 保存）、`/{shortcutId}`（DELETE 已回收引用，body 带 revision）和 `/{shortcutId}/open`（受保护 GET 返回 303，Location 为 `/share#token=...`）。固定集合为 `/files/pins`（GET / POST）、`/{pinId}`（DELETE）与 `/order`（PUT 完整有序 ID 集合），所有写入携带集合 revision，冲突 409。快捷方式改名/移动复用条目 PATCH 并要求 expectedRevision。控制 JSON 限 4096 字节，当前 IAM / CSRF 与 owner 检查不变；响应 private/no-store、no-referrer。

本人压缩包使用 "POST /api/v1/files/{id}/archive/inspect"、"/member"、"/download"、"/extract"，均带源expectedRevision及可选密码（仅body）。前三项files:read，提取files:write，全部要求会话及CSRF；源/目标归属、预算和错误语义见[文件管理](../docs/operations/file-management.md#本人压缩包浏览与提取)。

本人PDF阅读复用当前私有内容operation；普通文件列表与版本页新增`pdfReader` typed预算投影，字节、像素和毫秒单位明确。未新增operation或迁移，PDF本身未新增operation，完整清单见上文。生成来源与使用限制见[文件管理](../docs/operations/file-management.md#本人-pdf-阅读与临时批注)。

本人文件偏好为 `GET/PUT /api/v1/files/preferences`，使用当前会话owner及files:read/write，PUT仍要求CSRF。整体typed文档携带revision CAS，目录覆盖最多200项，控制JSON限128KiB；未知字段或结构预算在代理/协议边界拒绝，业务非法值422、冲突409。没有公开分享偏好入口，不接受客户端owner。详见[文件管理](../docs/operations/file-management.md)。

账号版本保留规则为 `GET/PUT /api/v1/files/preferences/history`，独立revision CAS且服务器唯一保存；使用当前owner、files:read/write与CSRF，不接收owner参数。扩展名为规范小写集合，最多32项、每项32字节；maxVersions为0–20个旧版本，0不取消服务器硬预算。未知字段在OpenAPI边界拒绝，非法业务规则422、CAS冲突409。策略写入不扫描或清理文件，内容覆盖在同一owner事务读取规则并核算实际关联空间。
