# 技术选型与架构复核

本页说明当前实现为何采用这些边界，以及什么新证据会促使我们调整。它不是旧迁移任务的待办清单，也不宣称当前依赖是外部世界的最新版本。精确版本以 [go.mod](../../go.mod)、[前端包清单](../../frontend/apps/web/package.json)与 [pnpm 锁文件](../../frontend/pnpm-lock.yaml)为准；依赖升级时另外核对官方维护、安全与兼容信息。

## 判断顺序

1. 从真实使用链路出发，定位调用方、状态、资源所有者、错误与权限边界。
2. 区分通用机制与项目语义：优先让成熟实现承担协议、解析、密码学和存储机制，项目拥有业务规则与生命周期。
3. 同时审查具体实现和承载架构。一个适配器若只能靠复制状态或永久兼容层接入，应重新审视边界。
4. 比较收益、迁移与退出成本，建立能推翻判断的验证。安全修复及时交付，框架替换需要具体收益。

现有代码没有保留特权；新技术也不因更新而自动适用。第三方类型穿越业务或稳定公共边界、共享资源需要统一关闭、或错误和安全语义需要收口时，采用窄契约。单个 Adapter 内的局部依赖无需机械再包一层。

## 当前选择与职责

### HTTP 与 API

Go 使用 `net/http`、chi 和 Huma。Huma 承担 typed 输入输出、校验与 OpenAPI 生成；项目保留操作身份、Problem Details、授权与服务生命周期。运行与生成共用 [httpcatalog](../../internal/composition/httpcatalog/catalog.go) 的模块清单，操作数量和具体路径只在[生成契约](../../api/README.md)维护。

`pkg/httpx` 的普通 Client 只执行一次请求。重试、熔断和恢复必须由具体下游决定幂等性、失败分类与预算；Execution 的业务 attempt 不等同于所有 HTTP 请求。CORS 协议处理复用 rs/cors 与标准库，Cookie、Origin、CSRF 和 IAM 的业务检查仍由各自 owner 执行。详见 [HTTP 能力](../../pkg/httpx/README.md)。

### 数据、配置与共享资源

数据库使用 GORM 资源与模块具体仓储，迁移使用 golang-migrate 和模块自有 SQL。files 已有 JOIN、CTE 和跨表查询，不能继续以“没有复杂查询”证明选型合理；查询实现应逐项接受正确性、事务和三方言验证。未来考虑生成查询或更换 ORM 时，必须用实际查询证明收益，保留业务 Port 和迁移边界，避免全库双轨。详见 [Database](../../pkg/database/README.md)。

Storage 统一提供本地及 S3 兼容内容访问，模块不自行建立第二套内容客户端。文件元数据提交、不可变对象写入和失败补偿不能假装成一个跨数据库与对象存储的原子事务。存储身份变化也不等于数据已迁移，部署须遵守[文件管理限制](../operations/file-management.md)。

配置保留 strict source merge、来源追踪、稳定读取与候选校验；YAML、mapstructure 和 fsnotify 各承担窄机制。新增远程来源或重载需求时，先证明当前规则与共享资源如何保留，再比较配置框架。Redis 保持缓存数据与 tag 的 authority，错误不伪装为 miss；没有真实命中率、容量与陈旧预算前，不重新引入本地 L1 或通用缓存加载状态机。详见[配置](../configuration/README.md)与[缓存](../../pkg/cache/README.md)。

### 身份与文件授权

JWT/JWK 使用 jwx，密码使用官方 Argon2id，IAM Adapter 内以固定 Casbin Core RBAC 求值；项目拥有 claim、PHC 资源上限、身份修订与失败处理。通用算法留给成熟实现，账号、会话、权限目录和持久事实留在 IAM。版本号不代替安全结论。

文件分享消费 IAM 的窄身份事实，在 files 内判断有界受众、分享根与最近祖先策略；公开分享与私有文件操作不能因共用数据而共用授权入口。WebDAV 的独立连接凭据也必须复核当前账号权限与范围。现有 Core RBAC 不能被文档扩大解释为通用 ABAC/ReBAC 系统。详见[身份模块](../../internal/module/iam/README.md)和[文件协作](../operations/file-management.md#分享链接权限与协作)。

### 文件协议、解析与任务

上传采用 tusd 核心协议及 tus-js-client，字节接续与 files 业务控制面分离；本机持久暂存与 OS 锁是当前部署约束。WebDAV 采用 emersion 的协议实现与 files 业务适配，写入、COPY/MOVE 和 URL 锁继续进入文件事务。选型原因及退出条件见[上传 ADR](adr/122-resumable-protocol.md)、[WebDAV ADR](adr/123-webdav-endpoint.md)和[事务写锁 ADR](adr/141-transactional-url-locks.md)。

ZIP 使用标准库，7Z 使用 sevenzip；不可信解析在受限同二进制子进程内进行。父请求或任务拥有取消、终止、Wait 和句柄清理，worker 不装配 Application。新增格式或库升级必须复核解析前分配、硬资源限制与取消能力，不能以软内存目标替代隔离。详见[压缩解析 ADR](adr/133-isolated-archive-parser.md)。

HTTP/BT 下载、后台压缩及清理由 files 的持久任务与现有调度边界承载，内容发布复用 Transfer；受信节点、外部来源和实际文件发布另做集成验收。现有 gocron、Execution、Redis lease 与 RabbitMQ Adapter 不构成通用耐久工作流，新增 broker 或任务框架需要具体任务和故障域。详见[定时任务](../operations/scheduled-tasks.md)、[消息系统](../operations/messaging.md)和[文件任务](../operations/file-management.md)。

### 浏览器与界面

保留 Next App Router、React、HeroUI 和 Tailwind。Next 是唯一 Router，Plugin Framework 只处理代码发现、生成装配和稳定引用；不增加第二个 history、Service Locator 或业务 BFF。公共 UI 经 Adapter 使用成熟交互基础，主题与状态遵循 Material Design 3；实际页面与内部示例共用实现。边界见[前端工程](../../frontend/README.md)。

PDF.js、媒体 SDK、Worker、frame 与临时 URL 归 Web Host；Surface 只表达文档及编辑意图。每次打开的阅读会话独立拥有资源，传输队列则按账号跨页面保持。PDF 使用本地固定资产和独立预算，不将解析器加入主应用初始负载；[PDF ADR](adr/134-local-pdf-components.md)保存选择理由，具体能力与限制只在[文件手册](../operations/file-management.md#本人-pdf-阅读与临时批注)维护。

生产交付采用可迁移的 Next standalone 和独立 Go 服务；构建产物不嵌入运行期后端地址。开发编排位于应用之外，持有进程树、就绪检查与失败清理。编译缓存、生成和资产准备属于工程工具，不能扩大为业务生命周期资源。详见[部署](../operations/clouddrive-deployment.md)与[本地运行](../getting-started/local-development.md)。

### 日志、观测与过载

zap、OpenTelemetry/otelhttp 与 Prometheus 分别承担日志和标准观测机制，项目保留稳定 operation 身份、低基数标签、资源租约与有界关闭。单进程速率门禁采用 `x/time/rate`，并发过载使用非阻塞准入；它们不等于主体配额或分布式限流。新增观测和网关策略要先定义成本、失败影响与 owner。详见[运行能力](../operations/runtime-capabilities.md)。

## 架构复核与交付

启动期 Blueprint 只拥有代码声明，运行期资源仍经 Application Generation 候选、提交、排空与关闭。不要为了扩大热重载范围而引入隐藏可变代理；也不要为了保留代际模型而让静态目录重复初始化。具体 owner 见[架构地图](README.md#状态与资源由谁拥有)。

重要替换应明确要解决的问题、当前使用方、成熟候选、资源与迁移边界、验证办法及退出条件。新的事实推翻旧判断时，以新的 ADR 解释取代关系，随后单轨迁移使用方并删除旧实现；普通功能不生成整套任务档案。

检查必须覆盖所做的判断：类型和单元测试不能证明真实浏览器、外部数据库、存储或协议客户端已经可用；本地部署成功也不能证明其它平台与多机模型。按[验证策略](../development/validation.md)报告实际环境、范围与缺口。历史研究和当时的版本结论留在 [ADR](adr/README.md)及 Git，不作为当前待办或安全证明。
