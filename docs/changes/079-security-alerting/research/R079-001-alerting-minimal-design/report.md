# R079-001 研究报告：安全告警最小版设计

## 1. 研究问题

在既有低敏审计与业务边界上，安全告警最小版如何落地：事件源与规则集、通知窄 port 与 provider、配置与失败语义、归属层。

## 2. 事实（commit `6ae9e12`）

- **审计已有**：Auth 认证/授权审计（`RecordAuthenticationFailure`、决策审计）与 IAM 业务写操作审计（`auditOperation`：账号/角色/API 令牌生命周期与关系替换，`service.go:217` 一带）。
- **事件边界明确**：账号锁定（Login attempts>=Max 置 lock，`service.go:383`）、MFA 失败（`VerifyMFAChallenge` 目前无审计记录，需补）、登录限流（`http.rateLimit.routes`，middleware 层 429）、敏感写操作（archive/roles.replace/permissions.replace/api-token 等，均有 `auditOperation`）。
- **无通知能力**：仓库无 webhook/notifier/alert 实现（R077-002 已核查）。
- **无设备/IP 环境**：会话/Session 不存来源 IP；审计低敏字段不含 IP（异地登录告警需先补 IP/设备采集 → 属 R079-002 风险控制范畴）。

## 3. 设计（推荐最小版）

### 3.1 归属与契约

- 新增 `pkg/alerting`（project 自有普通库）：`Event`（低敏字段：type/severity/summary/resource 摘要/occurred_at）、`Notifier`（`Notify(ctx, Event) error`）、`WebhookNotifier`（标准库 http.Client，POST JSON，可选 HMAC-SHA256 签名头；超时/重试 1 次/失败低敏日志，**不阻断业务**）。
- 归属理由：跨业务复用（Auth/IAM 安全事件）、无资源生命周期（无连接池/goroutine/队列——同步发送 + 短超时）、标准库可实现 → 按「只跨业务复用的普通库评估留在 pkg」先例，不进 kernel/app（避免无收益的重型组件化）。

### 3.2 事件源与规则集（首版保守，全部默认关闭）

| 事件 | 触发点 | 载荷（低敏） |
| --- | --- | --- |
| `account_locked` | IAM Login 达 MaxFailedAttempts 置锁 | account 摘要(subject_hash) |
| `mfa_failed` | VerifyMFAChallenge 失败（补审计后）连续 >=N 次 | account 摘要 |
| `auth_failed` | Auth 认证连续失败（`RecordAuthenticationFailure` 计数窗口） | subject 摘要 |
| `privilege_changed` | 角色权限替换/账号角色替换/归档/API 令牌创建轮换吊销 | resource 类型与 ID 摘要 |

- 规则阈值与开关：配置 `iam.local.alerting.enabled` 与 `auth.alerting`（或单点 `alerting` 配置节，composition 持有）——设计决策 D1。
- 敏感行为枚举：由各汇报方（IAM/Auth service）在业务边界按真实语义调用 `alerting.Notifier`（不实现通用规则引擎，避免"规则与业务语义分离"的过度设计）。

### 3.3 接驳方式

```
auth.service / iam.service 注入窄 port：
  type SecurityReporter interface { Report(context.Context, alerting.Event) error }
composition 装配 WebhookNotifier（config: url/signingKey/timeout/enabled + 频率合并窗口）
IAM/Auth 在锁定/MFA失败/敏感写操作边界调用（失败仅低敏日志，不影响业务结果）
```

### 3.4 安全与失败语义

- Event 不携带 token/密码/IP 全文/URL query；subject/resource 用既有摘要语义。
- webhook URL 与 signingKey 属配置秘密：不落日志、错误详情、审计；`gitleaks` 不匹配示例值（文档用占位符）。
- Notify 失败：低敏日志 + 不阻断业务（与 065 审计写失败语义一致）。

## 4. 适用 / 不适用

- 适用：单实例自托管的安全运营基线告警（Webhook 到企业 IM/监控系统）；与 078 MFA、077 限流事件联动。
- 不适用：异地/新设备告警（需 IP/设备采集，R079-002）；多通道/告警升级/抑制编排（后续可扩展规则，不在首版）；作为审计系统的替代（两者并存，告警是消费方）。

## 5. 对本任务的影响

079 推荐实施：`pkg/alerting`（webhook notifier）+ IAM（锁定/MFA 失败/敏感写操作）与 Auth（连续认证失败）事件接驳 + 配置 + 测试（含失败降级语义）；默认关闭、存量行为不变；文档同步。工作量 M。