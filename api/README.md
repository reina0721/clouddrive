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

私有文件接口位于 `/api/v1/files`，WebUI 通过 `/api/console/v1/native/files` 访问同一实现，使用 IAM Cookie 会话。`POST /transfers` 用稳定 key、目标、长度与完整 SHA-256 建立会话，`HEAD/PATCH /transfers/{id}/data` 使用 tus 核心协议接续，PATCH 为 `application/offset+octet-stream`；暂停、继续、取消、摘要校验、修正目标与提交发布分别有明确控制端点。旧 `/files/upload` 已移除，文本创建使用 `POST /files/text`。列表响应同时提供空间统计和传输预算，回收站用 `trash=true` 查询。详见[文件管理](../docs/operations/file-management.md)。

文件复制为 `POST /api/v1/files/{id}/copy`；文本替换为 `PUT /{id}/text`，必须带 `expectedRevision`；ZIP 为 `POST /api/v1/files/archive`。分享管理使用 `/api/v1/files/shares` 的创建/检索、`/{shareId}` 的读取/CAS设置、`/{shareId}/state` 的CAS暂停/恢复和 `/{shareId}/revoke`，仍要求 IAM 会话、文件权限和写请求 CSRF。

访客入口 `/api/v1/file-shares/{token}` 的 metadata、entries、unlock、content、text、folders、entries/change、entries/batch、archive及transfers（create/read/data/commit/cancel）operation 显式声明 public，不放宽任何私有 files operation。所有公开写入需要可信Origin，文件操作额外检查当前分享能力、策略版本和范围。解锁POST需要可信Origin，票据通过 `X-Share-Grant` header 传递，不能用 IAM 会话代替。原生浏览器下载经 `POST /file-shares/{token}/content/{id}/download` 授权，随后以短期限定文件句柄访问 `GET/HEAD /file-downloads/{ticket}`。私有和公开下载提供 Range/条件请求，每次检查撤销、到期和范围；完整 code-first 结果为当前 160 个原生 operation。

文件权限维护新增 `GET/PUT /api/v1/files/{id}/access`（PUT携带独立revision，policy为null明确恢复继承）、`POST /api/v1/files/audience/lookup`（精确账号/角色查找）及 `POST /api/v1/files/{id}/access/effective`（实际分享及匿名/账号的已保存权限）。均使用原IAM、文件scope与写请求CSRF边界。分享管理投影增加audience，公开metadata增加denied/signInRequired，目录和条目返回实际permissions。公开路由保留public profile，同时可选解析同源Session获取受众事实；存在但无效的会话不会静默降级匿名。详见[文件管理](../docs/operations/file-management.md)。

原生 OpenAPI 与 operation inventory 通过 `internal/composition/httpcatalog` 的同一清单生成；生成器不再单独选择模块，也不导入带资源的应用组合根。

离线任务为 `/api/v1/files/downloads` 的列表/单项创建、`/batch-create`、`/{id}`、`/{id}/source`、`/{id}/{pause,resume,retry,restart,cancel,remove}`、`PUT /{id}/target`及`/batch-control`，共13个operation。控制使用任务revision CAS；owner取自当前会话，原始来源只由受保护的显式source读取返回并设置no-store，普通DTO不包含URI或租约。仅HTTP/HTTPS，预算与失败行为见文件管理说明。

控制台错误为 {error:{code,reason?}}；分页默认 page=1/pageSize=20，允许 10/20/50。身份与字典写入携带 version；工作区 PUT 使用 If-Match 和响应 ETag；定时任务携带 version，删除任务使用 version 查询参数。冲突返回 409，不自动覆盖服务器数据。

通知与 API 工作区、历史、任务按用户隔离。API 执行权限为 console:workbench:execute；任务写入还需要 console:workbench:write。目标地址、取消、超时和响应限制由服务端执行；不支持的指纹/代理功能返回明确失败。

WebDAV 管理使用 `/api/v1/files/connections`（列表/创建）和 `/{connectionId}`（读取/CAS修改）、`/state`、`/rotate`。一次性密码不进入列表。独立协议入口为 `/dav/{connectionId}/...`，支持 OPTIONS、PROPFIND、受保护属性的 PROPPATCH、GET/HEAD、PUT、MKCOL、COPY、MOVE 和 DELETE，使用独立 Basic 凭据及当前 IAM 权限。该协议不属于 OpenAPI 标准方法清单，不计入上述160个JSON/原生operation；LOCK/UNLOCK不可用。实际客户端地址由管理响应的 endpointOrigin/endpointPath 提供，限制见[文件管理](../docs/operations/file-management.md)。

`GET /api/v1/files` 在同一 operation 承载高级搜索：重复的 `keywords`、`extensions`、`kinds` 参数，`scope`、`match`、`caseSensitive`、字节/时间上下界、`foldersFirst`、`page` 和 `pageSize`。数组不按逗号拆分，字节零值区别于缺失；时间为包含起点、不含终点。返回 `total` 与生效分页及预算。未指定 `pageSize` 或显式 0 保留有界非分页读取，普通网页显式请求 50/100/200；范围、排序和日期语义见[文件管理](../docs/operations/file-management.md)。

分享引用管理为 `/api/v1/files/shortcuts`（GET 列表 / POST 保存）、`/{shortcutId}`（DELETE 已回收引用，body 带 revision）和 `/{shortcutId}/open`（受保护 GET 返回 303，Location 为 `/share#token=...`）。固定集合为 `/files/pins`（GET / POST）、`/{pinId}`（DELETE）与 `/order`（PUT 完整有序 ID 集合），所有写入携带集合 revision，冲突 409。快捷方式改名/移动复用条目 PATCH 并要求 expectedRevision。控制 JSON 限 4096 字节，当前 IAM / CSRF 与 owner 检查不变；响应 private/no-store、no-referrer。

本人压缩包使用 "POST /api/v1/files/{id}/archive/inspect"、"/member"、"/download"、"/extract"，均带源expectedRevision及可选密码（仅body）。前三项files:read，提取files:write，全部要求会话及CSRF；源/目标归属、预算和错误语义见[文件管理](../docs/operations/file-management.md#本人压缩包浏览与提取)。

本人PDF阅读复用当前私有内容operation；普通文件列表与版本页新增`pdfReader` typed预算投影，字节、像素和毫秒单位明确。未新增operation或迁移，PDF本身未新增operation，完整清单见上文。生成来源与使用限制见[文件管理](../docs/operations/file-management.md#本人-pdf-阅读与临时批注)。

本人文件偏好为 `GET/PUT /api/v1/files/preferences`，使用当前会话owner及files:read/write，PUT仍要求CSRF。整体typed文档携带revision CAS，目录覆盖最多200项，控制JSON限128KiB；未知字段或结构预算在代理/协议边界拒绝，业务非法值422、冲突409。没有公开分享偏好入口，不接受客户端owner。详见[文件管理](../docs/operations/file-management.md)。
