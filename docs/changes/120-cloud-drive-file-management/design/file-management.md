# 文件管理详细设计

## 模块和接口

新增 internal/module/files，按现有纵向模块约定拥有 model、service、repo、handler、binding/http、binding/config、migration 和 permission。composition 显式装配，禁止运行时扫描。Service 只接收文件仓储、内容存储、Clock、IDGenerator 与窄日志/授权契约；ORM 仅在 repo，Huma 仅在 binding/http，Storage 租约 adapter 在 composition 接线，Service 不导入 Kernel。

已注册受保护 `/api/v1/files` 命名空间：GET 列表/查询（同时返回空间及传输预算）、POST `/folders` 创建文件夹、POST `/upload` 上传、GET `/{id}` 属性、GET `/{id}/content` 下载或文本内容、PATCH `/{id}` 重命名或移动、POST `/{id}/trash`、POST `/{id}/restore`。回收站通过 `trash=true` 查询，不为同一列表建立第二个端点。保留 code-first 注册和契约生成，静态路径不得被 id 路由吞掉。上传为二进制 body，名称和目标目录使用经 schema 校验的请求元数据；不用 Base64 JSON。调用方必须提供明确动作类型，不用含糊布尔值切换状态。

身份来自 IAM Session，所有操作在 Service 约束 owner；对象授权不得只靠 UI 或列表过滤。`files:read` / `files:write` 权限进入既有 catalog，不建立公共匿名入口。下载须走鉴权端点，不暴露 storage public URL。不存在和非本人对象对外统一不可访问。

前端新增 frontend/surfaces/plugins/files，路由 `/home` 与目录/query 状态由 Next Host 管理；Host 注入同源文件 port，插件不创建第二个认证客户端。生成路由依照现有 codegen。文件主页采用参考站的信息布局；保留品牌归属，不复制 Cloudreve logo。管理页保持可到达。网格/列表、排序偏好复用偏好持久化，错误/加载/空态复用基础组件，不改变全局组件默认风格。

## 数据与状态

files_entries 保存 id、owner_id、parent_id、kind、name、normalized_name、object_key、size_bytes、media_type、created_at、updated_at、trashed_at、upload_key 和 content_sha；目录无 object_key 和内容大小。名称禁止分隔符、控制字符、`.`、`..`、空名，统一大小写冲突策略为 Unicode 归一化后的不区分大小写。元数据路径不成为磁盘路径。

目录树和配额变更先锁定 files_storage 位置行，再使用每 owner 的数据库事务串行协调行；不依赖进程内锁，避免并发创建/移动冲突破坏树。唯一名称检查与写入在同一 owner 锁事务内；锁具体 SQL 由现有数据库驱动适配，不引入通用仓储 DSL。移动时检查目标为本人有效目录、非自身后代。回收站根标记与祖先可见性共同决定子项是否可见，不能仅过滤叶节点 trashed_at。

回收站不改变 parent_id，保留原位置与删除时间；恢复时原父目录无效或重名，返回冲突要求调用方选择本人有效目标；不静默改名/覆盖。空间统计包含有效和回收站文件。空集合返回空列表；无配额与无限配额不能混为 0，首批只接受正数配额。

## 上传、失败和一致性

HTTP 在读取 body 前获得并发名额，超限返回受控错误，不建无限等待队列。校验声明大小，实际读取使用 limit+1 检测超额；单文件最大字节数和并发限制限制内存预算，不声称流式存储。模块配置默认 32 MiB/2 并发/1 GiB 配额，严格正数及乘积预算校验。请求总 body 限制、Next 代理限制必须与二进制上限一致，不能放宽其他路由到无界。

每次上传创建不可猜 object key，先预检查并写入独立对象，再在最终数据库事务内复核配额、名称、目标和幂等键，提交可见元数据后才返回成功。不需要持久化预留或超时回收状态：竞争失败者补偿删除其独立候选对象，最终事务保证已提交使用量不突破配额。请求超时、取消、写入或提交失败触发有界补偿；主要错误、删除错误与补偿记录错误以 errors.Join 保留。无法补偿时尝试记录 files_pending_cleanup；进程强制退出可能遗留未引用内容，本批不承诺后台垃圾回收，不自动删除用户已有对象。

local adapter 在受限随机 key 下使用临时文件、分块检查取消、关闭并 rename 后才发布；操作失败清理临时文件并保留清理错误。Get 分块检查取消且在 files 层先验证元数据大小；本批只借用 Kernel Client，不另建 storage manager。标准库文件句柄由创建它的 adapter 关闭，共享 Kernel 资源不得由 files 关闭。存储根目录不接受用户输入；本批不允许已有文件时切换 storage root/driver，配置变更需受控拒绝或重启迁移流程，不能自动静默失联。

上传队列由前端页面拥有，按服务器限制发送；取消用 AbortController，卸载取消未完成项；服务成功后重新获取列表/usage。取消发生在响应丢失后可能已提交，重试必须使用每项稳定幂等键识别原结果，不能重复占配额。幂等记录由 files repo 事务保存，作用域为 owner+key，重复请求参数不一致返回冲突。

多选移动和回收站操作逐项返回结果；单项事务不伪装跨项全原子。下载以 metadata 与 object 内容一致为前提，缺失内容是服务错误而非空文件；Content-Disposition 使用标准编码，文本预览以 text/plain/nosniff 输出，页面不使用 HTML 注入。

错误类型至少区分无权/不存在、名称冲突、目录环、超额、上传太大、并发繁忙、取消、超时及依赖故障。console 转发使用登录时保存的 IAM CSRF token，禁止逐请求轮换导致并发互相失效。只在决定协议结果的边界记录，采用稳定操作/错误码与关联 ID，按真实结果区分 Info/Warn/Error；不记录文件名、路径、内容或凭据。storage 不逐层重复记录同一错误。

## 配置、生命周期与迁移

files 配置由模块 binding 统一默认/严格解码，首批标为 RestartRequired；复用 Kernel Database、Storage 和现有 HTTP 生命周期，不拥有新后台进程。storage 基础配置变更影响文件可达性，需要在 composition 的候选准入中阻止有文件时的无迁移切换。

新增 files migration set，不删除或重建任何原有表。实施时先只读确认本地迁移状态、数据库备份可用性与既有内容；若需要破坏性操作则返回确认。验收使用独立目录、临时数据库与测试账号，不使用参考站数据。本地运行迁移仅加新表，不以首发前为由重置 .data。

## 文件影响与技术选择

- 新增 files 模块、对应集成/单元测试与 Surface files 插件。
- 修改 internal/composition 中 generation、HTTP/permission/migration catalog、config 装配及 Storage 候选变更准入；维护相应硬编码架构门禁清单。
- 修改 pkg/storage/local/client.go 及对应取消/原子写入测试，不改变公开 Client 契约。
- 修改前端 Host 文件 port、同源代理、默认路由、导航与 i18n；由 codegen 更新生成路由；增加浏览器验收。
- 修改 config.example.yaml、API 生成产物、根 README、repository-scope、模块/运行说明，使已实现范围与真实状态一致。

无资源 HTTP 清单位于 internal/composition/httpcatalog，运行时 Blueprint 与契约生成器共用；该目录只能导入模块 HTTP 声明与 humabinding，不允许 Kernel/Service/配置。生成器不再导入应用组合根或独立维护模块列表。Unicode NFC 通过 files/adapter/unicodename 复用已安装的 Go 官方 x/text v0.40.0。保留现有标准库/第三方封装，没有依赖升级或新库引入；业务状态属于合理自研，流式/分片协议延后选型。此处没有引入新的 Kernel 组件或重构整个装配架构。

## 集中验证与提交

20 项实现后集中验证：文件字节一致性、重启持久化、不同用户隔离、并发同名/配额竞争、目录环、祖先回收、恢复冲突、上传大小与代理限制、取消/超时、对象写入/数据库提交/补偿失败、幂等重试及部分批量失败。执行受影响 Go 包、前端类型/架构检查和 files 浏览器用例；重新生成 API 与路由后检查 freshness。仅相关失败触发复测，不逐项重复全量回归。

视觉在相同桌面及窄屏尺寸检查导航、工具栏、空态、列表/网格、上传进度、错误和对话框；不通过放宽既有截图阈值掩盖问题。首批测试通过后审阅完整 diff、检查低敏、按明确文件列表提交并推送 origin。

Git 基线：研究时 main 尚无提交；实施期间已有源码作为 557757f6f7009eeed7950d79ced3f9d9be49b5da（init）成为现有基线。此后只审阅和提交本批 diff，不重新暂存整仓源码；用户已明确取消中途审批。预览凭据、数据库、日志、截图和 trace 均排除。
