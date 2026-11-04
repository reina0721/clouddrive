# 视觉与存储边界研究

## 问题、方法与证据

2026-11-03 使用用户提供的参考站登录并只读检查主页、新建、视图与排序菜单；没有创建文件、改变参考站配置或删除数据。参考站根目录为空，不能据此声称已验证其文件操作或后台全部能力。参考站截图视口较窄，本地登录页为桌面宽度，不能做像素差值结论。

本地浏览器访问开发地址，观察到管理工作台登录页。未将参考站凭据用于本地登录。源码追踪包含 README、repository-scope、模块开发指南、技术选型 authority、Todo module.go、composition/blueprint.go、composition/generation.go、Storage Access/local adapter、Surface 路由目录及 workspace 页面。

外部主源：[Cloudreve 官方文档](https://docs.cloudreve.org/en/)确认产品是网盘，包含存储、上传、搜索等独立能力；[Go HTTP 标准库](https://pkg.go.dev/net/http#ServeContent)用于 HTTP 内容响应候选核验，不作为项目已实现下载的证据。

## 当前事实

- 参考站：浅灰画布、白色文件容器、蓝色主按钮与选中导航、左侧分类/回收站/分享等入口；上方新建、搜索、主题、设置，文件区工具栏有刷新、视图、排序。空状态提示拖拽文件。
- 新建菜单包含文件/目录上传、剪贴板、离线下载、创建目录、Markdown/文本及绘图文件。视图包含网格、列表、画廊、缩略图和分页大小；排序包含名称、大小、修改和上传时间双方向。
- 本地登录页为紫色双栏管理工作台，文案、品牌、布局与参考站不同。未登录本地管理后台，内部文件能力判断来自源码而非登录后的浏览器实测。
- README 和 repository-scope 明确不包含上传、网盘目录及分享；生成的 Surface catalog 没有 files 插件；internal/module 当前没有文件业务模块。
- pkg/storage 是通用设施，不拥有业务目录、用户授权和上传 API。Kernel Storage Client 只有整块 bytes 的 Put/Get、Delete、Exists，不能把 pkg/storage/stream.go 的 fallback 当成有界流式传输。
- local adapter 的 Put/Get 忽略 context 且直接使用 os.WriteFile/ReadFile；上传路径需补取消、写入原子性和大小/并发边界，不能仅在页面增加按钮。
- config.example.yaml 的公开 HTTP maxRequestBodyBytes 为 1048576；必须同步服务与代理限制，否则上传会被既有请求上限拒绝。
- .data 存在数据库、WAL 和存储目录；没有检查业务内容，不宣称本地数据库为空，也不允许重置它。
- Git main 尚无提交，status 显示已有源码均未跟踪。origin 已配置；ls-remote --heads 成功但未返回分支。没有执行暂存或远端写入。

## 基线快照

以下 SHA256 对应本轮实际读取文件。无 Commit 可作比较时，实施入口使用文件快照和状态增量；相关变动才定向复核。

| 文件 | SHA256 |
| --- | --- |
| README.md | DC9901CB2219E4BB6C1D7B519A339FB6C8360DF9F1A419903406C7D57BA94F20 |
| docs/repository-scope.md | 00B719AB13120D101130A43F2F5E99D03201049F18E7E94DA9E8F95FC65D1588 |
| internal/kernel/app/storage/storage.go | 2931E9BFCAFC511DDFF0083508AB20DE10721DD0FAB6AE86239D68DBCB96ED8A |
| pkg/storage/local/client.go | E74BBEB453B1C531C5B6FDD9E43168A16D7B577F5810F24628BE740AD6E0E745 |
| frontend/surfaces/generated/catalog/catalog.ts | 347A369C94DD129A7A036F01C6ED0D3D58B4C37FCF5004B6B9F4D9AFF252797F |

## 候选、归属与推断

| 能力 | 分类与结论 | 理由和边界 |
| --- | --- | --- |
| 认证、授权、数据库、日志 | 保留既有成熟封装 | IAM 是唯一身份 authority，复用主体与权限，不复制账号；GORM 只留模块 repo；日志注入 |
| 文件目录、归属、回收站 | 项目特有逻辑，合理自研 | 通用对象存储不表达这些业务不变量；新 files 模块负责，禁止堆入 console/common |
| 对象内容存储 | 保留现有 Storage Access，局部修复 local adapter | 首批有界文件可适配 bytes 契约；禁止声称支持任意大文件。限制取消与原子写入问题必须修复，无须再创建客户端 |
| 流式/分片上传 | 后续研究，不在本批新增协议 | 成熟 tus/S3 multipart 可作未来候选；本批无需引入 SDK 或自研续传状态机。大文件要求将触发重新研究 |
| UI、表单、路由 | 保留 Surface/Host 和 UI adapter | 新 files 插件消费现有基础组件；与直接重写前端相比，保留已有认证/可访问性/代理接入价值 |
| 下载与文本预览 | 标准 HTTP/浏览器能力 | 经过归属校验的内容端点，文本按纯文本渲染；不引入 Office/PDF/媒体解析通用框架 |
| Cloudreve 整体替换本服务 | 不采用 | 会改写 IAM、数据模型和运行装配，超出首批 20 项目标。参考其产品行为，不导入另一套服务源码 |

本批不新增第三方依赖，不升级 Go/Next/React，也不宣称对现有依赖做了全量安全审计。标准 HTTP 与现有项目库足以承担首批有界内容传输；新业务逻辑由 files 模块维护，若出现分片、外链或多存储路由需求则退出本批假设重新选型。

## 资源与承载评估

现有纵向模块与 composition 能承载文件业务；提出新增 files 模块供计划确认，不擅自更改既有层级。资源由 Kernel 创建，模块只收窄注入 Storage、Database、Clock、IDGenerator、Logger 和 ActorAccess。无新 listener、scheduler、后台 goroutine 或独立资源管理器。请求拥有取消与超时，前端队列由页面拥有并在卸载时取消。

文件内容与数据库无法跨资源原子事务，必须先写不可变随机 object key，再提交元数据；失败补偿删除，补偿错误与主错误并存，不能伪报成功。回收站只改数据库可见性，不删物理内容。本批没有永久删除或旧对象清理任务。Storage reload 仍由 Kernel 治理，本批把 files 配置变更定义为需重启，并限制文件存储位置在有数据时变更，不能让旧文件因切换根目录失联。

日志 owner 为决定请求结果的边界，记录受控操作、稳定错误类型、关联 ID；不记录文件名、内容、对象 key、完整 URL 或凭据。结构与行为分别由架构门禁及集成/失败用例验证。

## 门禁、局限与影响

门禁通过仅适用于需求中首批有限大小、私有文件闭环，足以形成计划；不表示已确认或实施。尚未验证上传、下载、文件对象授权、实际迁移或浏览器文件操作。没有参考站文件样本，不推测未观察到的菜单行为；首批移动、重命名等是产品需求设计，不标成参考站实测。

余下不阻碍计划的未知：本地账号由实施验收创建隔离测试账号；远端部署环境未提供，不包含部署；Git 首次提交缺少既有源码基线，实施前需明确建立完整来源基线的范围，不能只推一个无源码的功能提交。首批测试通过后才允许提交/推送；若无法安全分离已有源码，报告阻塞而不全量暂存。

## 实施期间定向复核

- Git 已出现 557757f6f7009eeed7950d79ced3f9d9be49b5da 初始源码基线；原未跟踪状态不再是提交障碍。本任务在其上保留精确 diff，未改动原有 IAM 账号或删除本地数据。
- 实际发现契约生成器原先复制模块选择清单。已将无资源声明归属 internal/composition/httpcatalog，运行时 Blueprint 和生成器共用，架构门禁同时禁止其导入 Kernel/Service，以及禁止生成器直接导入模块契约。该局部边界调整消除了八个新 operation 未进入生成物的漂移，不修改整体 Kernel 或 Generation 生命周期。
- 发现 console 原生转发每次 RotateCSRF 导致两个并发上传相互失效；沿用登录时已生成的 IAM CSRF token，保留 Cookie/Origin/双提交及原生校验，替换旧逐请求轮换入口。真实 HTTP 并发测试覆盖两次上传均成功及无 CSRF 写请求被拒绝。
- NFC 采用 go.mod 已声明的 Go 官方 golang.org/x/text v0.40.0，不升级依赖；纯字符串规范化无资源或错误生命周期，隐藏在 files/adapter/unicodename 的窄契约内，model/service 不导入第三方。Unicode 等价名称和大小写冲突已有用例。
- 配额在候选对象写入后的最终事务内判定；无需引入持久化预留和回收机制。事务失败补偿与崩溃遗留边界已同步设计及运行 authority。此决定保留全部业务验收，减少一套无必要的预留状态机。
- 首批真实 SQLite、HTTP 与浏览器用例已覆盖核心链路；MySQL/PostgreSQL 外部实例、公开分享、大文件续传不在当前证据内。原有本地管理员资料未验证成功，因此独立预览在 .data/file-preview 中创建专用账号，未重置原账号。
