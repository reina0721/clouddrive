# 079 需求规格：安全告警最小版（+ 动态风险控制设计归档）

引用研究：[R079-001](research/R079-001-alerting-minimal-design/report.md)、[R079-002](research/R079-002-risk-control-design/report.md)。

## 1. 目标

在既有低敏审计与业务边界上实现**安全告警最小版**：`pkg/alerting`（Webhook 通知）+ IAM/Auth 事件接驳（账号锁定、MFA 连续失败、连续认证失败、敏感写操作）+ 配置与失败降级语义；**动态风险控制完成设计研究归档**（R079-002），不实施风险规则。

## 2. 功能要求（推荐范围，待用户确认）

| ID | 要求 |
| --- | --- |
| `REQ-079-001` | **pkg/alerting**：project 自有普通库——低敏 `Event`（type/severity/summary/resource 摘要/occurred_at，不含 token/密码/IP 全文/URL query）、`Notifier` 与 `WebhookNotifier`（标准库 http.Client、超时、1 次重试、可选 HMAC-SHA256 签名头、失败低敏日志不阻断业务）。归属 `pkg`（跨业务复用、无资源生命周期），不引入第三方。 |
| `REQ-079-002` | **IAM 事件接驳**：账号锁定（Login 置锁）、MFA 连续失败（VerifyMFAChallenge 失败计数，先补失败的低敏审计）、敏感写操作（账号归档、账号角色替换、角色权限替换、API 令牌创建/轮换/吊销）按真实语义调用 `alerting.Notifier`；通知失败不影响业务结果与审计。 |
| `REQ-079-003` | **Auth 事件接驳**：连续认证失败（认证审计边界）达到阈值时告警；载荷低敏（subject 摘要）。 |
| `REQ-079-004` | **配置**：`alerting` 配置节（`enabled` 默认 false、`webhookUrl`、`signingKey`、`timeout`、`retry`、`minInterval` 合并窗口）；URL 与密钥属配置秘密，不落日志/错误详情/审计；默认关闭完全保持存量行为。 |
| `REQ-079-005` | 保持既有边界：不新增权限键、不改授权 authority、不改审计字段域（Event 用既有摘要语义）；告警是审计的消费方而非替代。 |
| `REQ-079-006` | **动态风险控制归档**（R079-002）：因子（来源 IP、弱设备指纹、登录频率）、风险档位与动作（要求 MFA/拒绝/告警）、干跑→灰度路径、前置依赖（IP/环境采集与地理数据源决策）记录为后续立项依据，本批不实施。 |
| `REQ-079-007` | 契约与生成物单轨同步：`alerting` 配置节进 `config init` 模板与 `config.example.yaml`；文档（security.md/runtime-capabilities.md/配置说明）同步；`go test ./...`、`go vet ./...`、docs-guard 全绿。 |

## 3. 候选方向（仅记录，不实施）

- **动态风险控制**：R079-002 设计归档；实施需先补登录来源 IP/环境采集（涉及审计字段域决策）与 IP 地理数据源许可评估，再干跑→灰度，独立立项。
- **告警增强**：多通道（邮件/企业 IM）、告警升级/抑制编排、规则引擎配置化——后续扩展项。
- 既有候选（OIDC/SSO、数据权限、多租户、批量运营、MFA 强制模式等）：维持记录。

## 4. 非功能要求

- Event 低敏：不携带凭据、token、IP 全文、URL query、配置密钥；subject/resource 用既有摘要语义。
- 通知失败不阻断业务、不影响审计写；低敏日志记录 type 与错误类目。
- 默认关闭（enabled=false）时零行为变化。

## 5. 验收标准

1. `pkg/alerting`：WebhookNotifier 成功/超时/重试/签名头/低敏载荷测试通过；Notify 失败不 panic、低敏日志。
2. 触发点：账号锁定、MFA 连续失败、连续认证失败（阈值可配）、敏感写操作（归档/关系替换/API 令牌）发送 Event（enabled=true 时）；enabled=false 零行为。
3. 配置：`alerting` 节进 config init 模板与 example；签名密钥与 URL 不进入日志/审计/错误详情（测试断言）。
4. `go test ./...`、`go vet ./...`、docs-guard 全绿；影响文档同步。

## 6. 非目标

- 不实施动态风险规则（仅归档设计）；不新增权限键；不改授权 authority/审计字段域；不引入外部告警依赖。