# 079 设计方案：安全告警最小版

## 1. 背景与目标形态

079 在 077/078 完成的认证强度与 MFA/令牌体系上增加**安全运营告警**（Webhook 基线），并在研究层完成**动态风险控制**设计归档（不实施）。告警与审计并存：审计是记录，告警是消费方。

## 2. 方案对比

| 项 | 方案 | 结论 |
| --- | --- | --- |
| 归属 | A（不采纳）：`pkg/alerting` 普通库同步发送 | 用户确认采用 kernel/app 组件化承载（异步队列/生命周期治理收益明确：事件入队不阻塞业务、worker 重试与关闭治理） |
| 归属 | B（采纳）：`internal/kernel/app/alerting` 组件（Plan/typed Input/Lease/生命周期），装配走既有 kernel composition 链 | 与 observability/messaging 等组件同构；事件异步投递 + 有界队列 + 退出排空 |
| 错误语义 | A：入队失败低敏日志，不阻断业务/审计；worker 重试与丢弃边界由组件策略声明 | 与 065 审计写失败一致 |
| 规则 | A：业务边界按真实语义汇报（无通用规则引擎） | 避免「规则与业务语义分离」的过度设计；阈值走配置 |
| Provider | A：Webhook（标准库 HTTP + 可选 HMAC 签名），首期单 provider | 零外部依赖；channel 多样式后续扩展 |

## 3. 数据流与实现位置

### 3.1 pkg/alerting

```
pkg/alerting/alerting.go
  type Severity string ("info"|"warning"|"critical")
  type Event struct { Type, Severity, Summary string; OccurredAt time.Time; ResourceType, ResourceIDHash string }
  type Notifier interface { Notify(context.Context, Event) error }
  type WebhookConfig struct { URL, SigningKey string; Timeout, RetryDelay time.Duration; Retries int; MinInterval time.Duration }
  NewWebhookNotifier(config) (*WebhookNotifier, error)   // 校验 URL 可解析、MinInterval>=0
  Notify: 频率合并（MinInterval 内同 Type 丢弃，计数已发）-> POST JSON {type,severity,summary,occurredAt,resource…}
           X-Alert-Signature: hex(hmac-sha256(signingKey, body))（key 非空时）
           401/5xx/超时按 Retries 重试（间隔 RetryDelay）；全部失败返回 error（调用方低敏日志）
```

- 载荷不含敏感字段；`summary` 由调用方提供受控文案（模块 locale/常量，不用原始输入拼接）。

### 3.2 IAM 接驳（service）

```
Service 增加 reporter alerting.Notifier（WithAlertReporter 注入；nil=disabled）
  - reportAlert(ctx, type, severity, summary, resourceType, resourceID)：
      reporter 为 nil 或 config.alerting.enabled=false -> no-op
      失败 -> 低敏日志（type + error 类目）
触发点：
  - Login 置锁（outcome=ErrAccountLocked）-> "account_locked" (critical)
  - VerifyMFAChallenge 失败累计 >= threshold（配置，默认 3）-> "mfa_failed" (warning)
    （VerifyMFAChallenge 失败同时补低敏审计：operation "iam.login.mfa-verify" denied）
  - 敏感写操作成功边界：账号归档 / 账号角色替换 / 角色权限替换 / API 令牌创建/轮换/吊销
    -> "privilege_changed" (warning)；在 auditOperation 成功时附带汇报
```

- MFA 失败统计：进程内滑动计数（类 mfaChallenges 内存态；窗口 10 分钟，reporter 关闭时不计数）。

### 3.3 Auth 接驳（service）

```
Auth Service 增加 reporter；config 注入
  - RecordAuthenticationFailure：连续失败计数（进程内窗口，按 subject 摘要）>= threshold（默认 5）
    -> "auth_failed" (warning)，重置窗口
```

### 3.4 配置（composition）

```
alerting 配置节（composition 持有，capability ID "application.alerting" 或并入 auth？——选独立 application 节）：
  enabled bool          默认 false
  webhookUrl string     默认 ""
  signingKey string     默认 ""（空=不签名）
  timeout/time/retries/retryDelay/minInterval 默认 5s/1/1s/0
Decode 校验：enabled 时 webhookUrl 必填且 https/http；URL/Key 不进日志
kernel/defaults/config init 模板 + config.example.yaml 同步
composition 装配 WebhookNotifier（若 enabled）-> 注入 authModule 与 iamModule（WithAlertReporter）
```

## 4. 失败语义、并发与审计

- Notify 失败：低敏日志（type/error 类目），不阻断认证/写操作与审计。
- MFA/认证失败计数为进程内窗口（多实例计数不合并——文档注明；与限流同边界）。
- 告警本身不写审计事件（属于通知，日志记录）；审计字段域不变。
- 合并窗口防止风暴。

## 5. 已确认决策

（待用户确认后填写；当前为推荐项。）

## 6. 验证方案

1. `pkg/alerting`：httptest server 断言成功/重试/签名头/合并窗口/非法配置；低敏性（Event 字段白名单）。
2. service：锁定/MFA 失败/连续认证失败/敏感写操作触发（用 fake reporter 断言 type 与次数）；enabled=false 零调用。
3. 配置：config init 模板与 example 含 alerting 节；密钥/URL 不进入日志、错误详情与审计（断言）。
4. 全量：`go test ./...`、`go vet ./...`（无竞态新增安全事件路径）、docs-guard。