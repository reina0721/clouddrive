# 运行能力矩阵

本文集中说明当前运行能力的配置入口、资源所有权、生命周期和验证边界。它是状态索引，不复制各能力的完整设计；若状态改变，必须同步更新本文和对应主题文档。

| 能力 | 当前入口 | 资源/生命周期 owner | 当前验证 | 未覆盖边界 |
| --- | --- | --- | --- | --- |
| Config | `config init`、配置说明、环境变量 | Application 配置集合与 generation | Go 测试、启动和 reload 相关检查 | 外部部署平台注入策略 |
| Database/Migration | `db migrate status/up`、database/migration 文档 | 多 Set Migration Catalog、one-shot runner 与数据库组件 | IAM/Organization/Navigation/Todo SQLite baseline、Catalog/错误门禁；Postgres/MySQL SQL/checksum 静态校验 | 生产数据库协议需配置外部 DSN 独立验证 |
| Cache/Coordination | 配置中的 cache/Redis 节 | Kernel App 连接与 lease/close owner | 单元测试、模拟依赖 | 真实 Redis、多实例故障恢复 |
| Storage | storage 配置节、Storage Capability | Kernel App Manager 与对象存储资源 owner | Go 测试、契约边界 | 真实 S3 兼容服务和生产凭据 |
| 文件与只读分享 | `/home`、`/share`、`/api/v1/files`、`/api/v1/file-shares`；[运行说明](file-management.md) | files 模块拥有目录/配额/回收/分享状态；Kernel 拥有数据库和 Storage；浏览器队列由页面拥有 | 真实 SQLite、HTTP 并发/隔离/重启/分享到期、7 项浏览器用例含真实媒体、桌面与窄屏 | 外部 MySQL/PostgreSQL/S3、账号共享协作、挂载、离线下载、大文件续传及自动垃圾回收 |
| Observability | logger、diagnostics、metrics、OTLP 配置 | Kernel App observability 与注入 Logger | Go 测试、低敏日志检查 | 外部 collector/后端接收验证 |
| 运行状态与监控（055/081） | management `/management/{startupz,livez,readyz,build,diagnostics,metrics,metrics-summary}`；`/metrics`（含 prometheus Go/Process collector：`go_goroutines`、`process_resident_memory_bytes`、`process_start_time_seconds` 等）；`/metrics-summary` 为 090 typed 指标投影（key/value/unit/asOf，产品 UI 消费）；Ops WebUI Dashboard（含「监控」分区：进程/组件状态卡 + 滚动窗口时序报表图）与 Capabilities 页；自研 SVG 图表原语（`webui/src/ui` 的 Sparkline/LineChart） | Ops module（探针/诊断解释）+ composition（runtime 采样、supervisor/scheduler/messaging 状态聚合）；管理面鉴权随 AccessMode（disabled/public/protected） | Go 探针/诊断测试、metrics Gauge 断言、图表/vitest（窗口上限、差分速率、渲染）、Playwright dev/mock | OS 级（CPU/磁盘/网络）由宿主机 Prometheus node-exporter 补齐（文档指引）；多实例聚合、持久时序采样、Alertmanager 全链路（候选） |
| Execution | `pkg/execution` 与模块接入文档 | Application 命名 policy；memory Store 同步拥有幂等与记录 | attempts/budget/cancel/错误分类、HTTP one-shot、消息单次 attempt 的 Go/race 测试 | 外部持久化 backend、degraded write、breaker、多实例部署 |
| HTTP 入口保护 | `http.rateLimit`、`http.maxInFlight` | 每个 Application Generation 私有的 x/time/rate bucket 与 channel 过载门禁 | mode/输入/refill/并发、429/503、CORS preflight、generation 重建的 Go/race 测试 | Principal/IP/route quota、跨副本一致性、gateway 容量验证 |
| Schedule | 模块 Schedule Binding、scheduler 配置 | 统一 scheduler、Execution、coordination lease | Go 测试与本地静态检查 | 真实多实例 owner 交接 |
| Messaging | Message Contract/Binding、RabbitMQ 配置 | Provider Adapter、consumer generation 与 ack/retry | Go 测试与静态门禁 | RabbitMQ 真实协议需外部运行证据 |
| 可查询审计 | `auth:audit:read`、`/api/v1/auth/audit`、`internal/module/auth/{binding/migration,adapter/audit/storage,binding/http}` | Auth module：迁移集 `auth_schema_migrations` 与表 `auth_audit_events`；持久化 Sink 由模块内部装配，composition 只注入数据库租约 | Go 单元（写入/查询/脱敏/保留上限/动作与资源类型过滤）、migration SQLite 可重复、WebUI Vitest、e2e | 自动归档/导出语义、异地审计聚合、外部审计系统接入（首版不做） |
| 业务操作审计 | IAM/Organization/Navigation 写操作、`OperationAuditWriter` 窄 port（composition 适配 Auth）、`auth.audit.list` | 各业务模块 Service + Auth 审计面（065）；审计写与业务事务解耦 | Go 单元（fake writer 断言动作/资源/outcome、失败记录、不阻断主路径）、WebUI 审计页 | 对象级 before/after 差异视图、审计动作枚举审计（后续候选） |
| 会话集中管理 | `iam:session:read/revoke`、`/api/v1/iam/sessions`、`/api/v1/iam/sessions/revoke`、`internal/module/iam/{service,repo,binding/http}` | IAM module（复用 `iam_sessions` 表，无新 schema） | Go 单元（列表摘要/分页/status 过滤/批量吊销/owner 不变量）、WebUI Vitest、e2e | 会话级并发上限策略、设备指纹、按 IP/UA 过滤（未列入首版） |
| 影响分析（反向查询） | `iam:role:read`/`iam:permission:read`、`GET /api/v1/iam/roles/{id}/accounts`、`GET /api/v1/iam/permissions/roles?key=…`、`internal/module/iam/{service,repo,binding/http}` | IAM module：只读查询，复用既有关系表，不新增 schema/权限键 | Go 单元（分页 total/未知角色 404/未知权限键 404/owner 全权限命中） | 聚合影响报告视图（WebUI 呈现另行立项） |
| 账号列表过滤 | `iam:account:read`、`GET /api/v1/iam/accounts?status=&archived=&roleId=`、`internal/module/iam/{service,repo,binding/http}` | IAM module：typed `AccountFilter`，Count/List 同条件 | Go 单元（status/archived/roleId 与关键字/分页组合、total 一致） | 任意表达式过滤（不提供；typed 白名单） |
| 密码策略配置 | `iam.local.passwordPolicy`（minLength/maxLength/requireComplexity）、`internal/module/iam/{binding/config,model,service}` | IAM module：策略由配置注入并在 Service 构造时冻结；只约束新建密码路径 | Go 单元（min/max/复杂度生效、默认值兼容、非法策略拒载） | 密码轮换周期、历史校验、基于时间的过期策略（候选） |
| 口令治理（077） | `iam.local.passwordPolicy.historySize/maxPasswordAge`、`iam_password_history` 表与凭据 `password_changed_at` 列（migration 000005） | IAM module：历史哈希只存密文、按最近 N 条裁剪；过期复用受限改密语义 | Go 单元（复用拒绝/裁剪/过期受限/改密恢复/默认关闭兼容）、migration 三驱动 | 基于时间的历史窗口（当前为条数窗口）、口令策略灰度 |
| 会话治理（077） | `iam.local.maxSessionsPerAccount`、`internal/module/iam/{service,repo}` | IAM module：新登录达到上限时主动吊销最旧 active 会话，会话总数保持上限 | Go 单元（超限剔最旧/新会话永不被踢/默认不限）、审计事件断言 | 按设备/类型会话配额（需设备指纹）、踢最旧变体为产品决策 |
| 登录限流（077） | `http.rateLimit.routes`（按路径前缀规则）、`pkg/httpx.PathRateLimiter`、`internal/kernel/composition/http.go` | 进程级 token bucket（per-generation，全局+按路径独立 bucket）；`/api/v1/iam/login`、`/api/v1/iam/setup` 可配置更严限流 | Go 单元（路径独立 bucket、全局回退、无效规则拒载、config init 模板）、与账号锁定并存 | 分布式/按 IP 维度的跨副本限流（多实例一致性研究项） |
| 机器访问令牌（078/080） | `iam:api-token:read/write`、`/api/v1/iam/api-tokens*`（list（status 过滤）/create/update/disable/enable/rotate/revoke）、`iam_api_tokens` 表（migration 000006/000008）、Auth `ChainVerifier`（JWT→API-Token） | IAM：secret 只存 sha256、明文仅创建/轮换一次；**权限知情创建（scope ⊆ 创建者有效权限，越权 403）**；状态机 active/disabled/expired/revoked；上限（默认 5，未吊销计数）与默认 TTL 配置 | Go 单元（越权/生命周期/过滤/上限/TTL/轮换/吊销）、migration 三驱动、WebUI（IAM 独立页 `/admin/api-tokens` + settings 入口） | 资源级作用域、跨账号委派、配额/强制轮换（候选） |
| MFA/TOTP（078） | `iam.self.mfa{begin,status,confirm,disable}`、`iam.login.mfa-verify`、`iam_totp_secrets`/`iam_mfa_recovery_codes` 表与会话 `mfa_verified`（migration 000007）、`internal/module/iam/adapter/totp`（RFC 6238 自研） | IAM：绑定/确认/解绑与登录两步（一次性挑战、恢复码一次性）；只影响认证不改变授权权威 | TOTP 官方向量（RFC 6238 附录 B）、Go 单元（绑定/两步/挑战/恢复码/会话标记）、WebUI Vitest | 强制模式与首次绑定宽限策略（产品决策）、设备指纹联动（风险控制候选） |
| 安全告警（079） | `alerting` 配置节、`pkg/alerting`（Event/Notifier/WebhookNotifier）、`application.alerting` kernel 组件（异步队列/worker/签名/重试）、Auth/IAM 事件接驳 | 事件：账号锁定/连续认证失败/MFA 连续失败/敏感权限写操作；投递失败低敏记录不阻断业务 | Go 单元（notifier 发送/签名/重试/合并、触发点、enabled=false 零行为、低敏断言）、config init 模板 | 多通道/告警升级/抑制编排、规则引擎配置化（候选）；风险控制因子联动（R079-002） |
| 账号/角色生命周期 | `iam:account:write`/`iam:role:write`、`PATCH /api/v1/iam/accounts/{id}`（资料更新）、`POST …/accounts/{id}/archive`、`PATCH /api/v1/iam/roles/{id}`、`POST …/roles/{id}/archive`、`internal/module/iam/{model,service,repo,binding/http,binding/migration}` | IAM module：账号归档经 `archived` 列（migration 000003），角色沿用既有 archived 字段；归档即终态（不做物理删除/恢复） | Go 单元（改名/归档/登录与分配拦截/Session 撤销/owner 不变量/授权失效与候选发布）、migration SQLite 可重复、WebUI Vitest、e2e | 归档恢复流程、账号/角色物理删除（本批未做；恢复另行立项） |
| 组织分配乐观锁 | `organization:department:write`、`GET/PUT /api/v1/organization/accounts/{id}/assignment`（`expectedVersion`）、`internal/module/organization/{model,service,repo,binding/http,binding/migration}` | Organization module：`organization_account_departments.version`（migration 000002） | Go 单元（版本冲突/成功替换返回新版本）、migration SQLite 可重复、WebUI Vitest、e2e | 跨模块事务（账号创建与组织分配仍独立用例，055 边界） |

## 使用规则

- 配置、外部资源和后台 runner 都必须有明确 owner、取消/关闭和失败边界。
- “本地静态门禁通过”只证明代码、生成物或构建链对应的范围；不能推导出外部协议、生产部署或浏览器体验已经通过。
- 新增能力时，除修改实现和测试，还必须在[文档治理规范](../development/documentation-governance.md)中完成影响评估。


控制台为独立 Next 进程，Go 不托管页面。运行摘要由 `/api/console/v1/system/runtime` 和受保护的 management 转发呈现，见 [部署说明](clouddrive-deployment.md)。
