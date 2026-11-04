# 配置说明

本文是应用配置来源、生成方式、环境变量覆盖和配置节 ownership 的当前权威说明。本地首次启动见 [本地启动指南](../getting-started/local-development.md)。

## 配置来源

默认配置文件是仓库根目录的 `config.yaml`。应用按声明顺序合并配置来源：

```text
FileSource -> EnvSource
```

因此环境变量覆盖文件。环境变量使用 `APP_` 前缀，嵌套字段用双下划线分隔，例如：

```powershell
$env:APP_DATABASE__DSN = '.data/app.db'
$env:APP_LOGGER__LEVEL = 'debug'
$env:APP_HTTP__ADDR = '127.0.0.1:8081'
$env:APP_IAM__LOCAL__SETUPTOKEN = '<从密钥管理系统注入>'
$env:APP_SCHEDULER__ENABLED = 'true'
$env:APP_MESSAGING__PROVIDERS__PRIMARY__RABBITMQ__URI = 'amqps://<user>:<password>@broker.example:5671/'
```

配置解析是 strict 的：未知配置节、未知字段、重复逻辑路径、大小写别名和错误类型都会在创建资源或绑定 listener 前失败。

## 生成配置与示例文件

首次本地开发推荐使用：

```powershell
go run ./cmd/app config init
```

该命令聚合所有配置 owner 的默认值，并用同一套 binder 与 validator 做回环校验。默认目标已存在时会拒绝覆盖。

需要生成到其他路径：

```powershell
go run ./cmd/app config init --output .data/generated-config.yaml
```

`config.example.yaml` 是带注释的字段参考，不是第二套启动权威。可以手工复制它，但复制后仍要执行 `db migrate up` 再启动 Service。

## 配置节 ownership

| 配置节 | Owner | 主要用途 |
| --- | --- | --- |
| `logger` | Kernel Logger App | 进程日志级别、编码、输出路径 |
| `database` | Kernel Database App | 数据库 driver、DSN、连接池和 ping timeout |
| `migration` | Migration 模块 | one-shot migration 锁等待和操作期限 |
| `cache` | Kernel Cache App | 缓存 backend 与 Redis 参数 |
| `i18n` | Kernel I18n App | 默认语言、消息文件（统一维护于 `./locales`）和缺失翻译策略 |
| `storage` | Kernel Storage App | 本地、S3、MinIO 对象存储配置 |
| `execution` | Kernel Execution App | 单进程幂等、同步记录与完整重试预算的命名策略 |
| `scheduler` | Application Schedule Component | cron/fixedDelay、全局并发、关闭预算、执行权租约与任务级运维覆盖 |
| `messaging` | Application Messaging Component | 命名 Provider、逻辑 Route、confirm/handoff/恢复与 RabbitMQ topology 要求 |
| `todo` | Todo 模块 | Todo 业务约束 |
| `auth` | Auth 模块 | development-anonymous 或 JWT 鉴权配置 |
| `iam` | IAM 模块 | 本地 setup、登录锁定、Session timeout 安全预算、密码策略（`local.passwordPolicy`：`minLength`/`maxLength` 默认 15/128、`requireComplexity` 默认 false、`historySize`/`maxPasswordAge` 默认关闭）、会话上限（`local.maxSessionsPerAccount` 默认 0=不限，超限主动剔最旧）与 API 令牌（`local.apiTokenMaxPerAccount` 默认 5、`local.apiTokenDefaultTTL` 默认永不过期） |
| `http` | Kernel HTTP composition | 业务 HTTP listener 与请求治理 |
| `management` | Ops 模块 | management listener、readiness、metrics access |
| `observability` | Kernel Observability composition | service name、tracing exporter 与采样参数 |
| `alerting` | Kernel Alerting App（`application.alerting`） | 安全告警 webhook 通道（默认关闭；webhookUrl/signingKey 属配置秘密） |

Bootstrap CLI、migration one-shot、Todo CLI 和长期 Service 都必须识别同一套官方应用配置节。某个运行模式可以只创建自己需要的资源，但不能把其他官方配置节当作未知字段拒绝。

## WebUI 托管


- 同源请求不依赖 `http.cors.allowedOrigins`；Session Cookie 带 `Secure` 属性，纯 HTTP 仅限 loopback，生产部署需 TLS 终结。启动与切换步骤见 [WebUI 本地启动指南](../getting-started/webui.md)。

## HTTP 入口保护

`http.rateLimit.mode` 只接受 `local` 或 `disabled`。默认 `local` 使用当前 Application Generation 私有的进程级 token bucket，要求 `requestsPerSecond` 与 `burst` 都为正；reload 后新代从完整 burst 开始，旧代独立排空。`disabled` 只关闭速率门禁，`maxInFlight` 的非阻塞 503 过载门禁仍然生效。`http.rateLimit.routes` 是按路径前缀覆盖全局速率的可选规则（默认空=不启用）：命中路径使用独立 token bucket（如 `/api/v1/iam/login`、`/api/v1/iam/setup` 施加更严限流，与账号级锁定构成「IP+账号」双维度），未命中继续使用全局规则。`100/200/128` 是待按真实容量和 SLO 校准的脚手架起点，不代表跨副本、按主体或按路由的业务 quota；management listener 不经过该 application 入口策略。

## Tracing

`observability.tracing.enabled` 默认为 `false`。启用后必须提供合法 endpoint、采样和批处理参数。生产环境优先使用安全传输；HTTP endpoint 只适合明确受控的本地或测试环境，并需要显式配置 `insecure: true`。

## 定时调度

`scheduler.enabled` 默认为 `false`。业务模块通过 `module.Contribution.Schedules` 声明真实任务；配置只能按已声明 Task ID 覆盖启用状态与协调不可用策略，未知 Task ID 会让候选 Generation 在 Commit 前失败。

严格分布式任务需要 `cache.driver: redis`。Redis 暂时不可用时不会默认降级为本地执行，而是按任务声明进入 `skip`、`pause` 或 `fail`；best-effort 任务只有显式声明 `local` 才允许弱化。配置字段、声明示例和保证边界见 [定时调度能力](../development/scheduled-task-capability.md)。

## Execution

`execution.driver` 当前支持 `memory` 与 `disabled`。默认策略及 `policies.<name>` 使用 `retryMaxAttempts`、`retryInitialDelayMs`、`retryMaxDelayMs`、`retryJitterFactor`、`retryAttemptTimeoutMs` 和 `retryTotalTimeoutMs`。旧 wait/timeout、recovery 与 async 字段已经删除，strict binder 会拒绝它们；已有本地配置应根据 `config.example.yaml` 迁移，或在备份后重新运行 `config init` 生成。

memory backend 只在单进程内可见，记录同步写入，不提供外部持久化、恢复回放或分布式幂等保证。

## 密钥与环境差异

密码、Token、Access Key、完整生产 DSN 和私有证书不要写入配置文件或提交历史。使用环境变量注入敏感值，并让部署系统负责密钥来源。配置错误和日志也不得输出完整 DSN 或凭据。

## 消息系统

`messaging.enabled` 默认为 `false`。启用后，配置中的每个 Route 必须命中模块经
`module.Contribution.Messages` 声明的 Producer 或 Consumer；未知、未使用或策略冲突会让候选 Generation 在 Commit
前失败。当前生产 Provider 为 RabbitMQ，应用只验证 topology，不创建 exchange、queue 或 Policy。配置字段、Binding
示例、`delivery-limit` 换算和可靠性边界见[消息系统适配能力](../development/messaging-capability.md)。

## Reload 行为

长期 Service 监听配置文件变化，并把文件与进程启动时继承的环境变量重新合并成候选配置。被环境变量覆盖的字段即使文件发生变化，也不会改变最终有效值。scheduler、消息 Provider/Binding 与模块对象图随完整 Application Generation 重建；Prepare 不触发任务或消息消费，Commit 才切换准入。reload 的底层机制见 [Kernel 运行与配置](../../internal/kernel/README.md)。


## clouddrive 控制台

前端由 Next 独立启动，不读取 Go 静态托管配置。环境变量、同源代理与请求目标白名单见 [部署说明](../operations/clouddrive-deployment.md)。console 配置控制请求预算；数据库迁移显式执行。

files 模块拥有 `files` 的逻辑配额、文本/ZIP/条目/媒体预算，`transfers` 暂存/分块/容量/期限/锁预算、`connections` 独立连接/目录扫描/协议预算/实际公网 origin，及 `sharing` 有效期、单文件下载票据、尝试窗口和 KDF 准入，统一默认、严格校验及 RestartRequired 策略；默认值、传输约束和位置保护只在[文件管理](../operations/file-management.md)维护。精确传输路由使用 `http.transferTimeout`，核心 PATCH 在认证准入后使用分块 body 上限，WebDAV PUT 在独立凭据认证准入后使用文件流式上限；普通 HTTP 请求预算保持独立。
