# 079 安全告警最小版（+ 动态风险控制设计归档）

## 状态

**已确认，实施完成**（用户确认：实施告警最小版，承载方式 kernel/app 组件）。验证：`go test ./...` 全绿（pkg/alerting 发送/签名/重试 + service 触发三组 + 组件接入）、`go vet ./...`、架构边界门禁（低敏日志）、config init 模板生成 `alerting` 节、docs-guard 通过；受限项见 [tasks.md](tasks.md)。

## 目标

1. **安全告警最小版（实施完成）**：`pkg/alerting`（低敏 Event、WebhookNotifier：标准库、HMAC 签名、超时/重试）→ `application.alerting` kernel 组件（有界异步队列 + 单 worker、生命周期与排空治理）→ Auth/IAM 事件接驳（账号锁定、连续认证失败、MFA 连续失败、敏感权限写操作）+ 受控配置（`alerting` 节，默认关闭；URL/密钥不进日志）。
2. **动态风险控制（设计归档）**：R079-002 因子/数据源/风险档位/干跑路径记录为后续立项依据，本批不实施。

关键边界：不新增权限键、不改授权 authority/审计字段域；告警是审计的消费方而非替代；默认关闭保持存量行为。

## 阅读顺序

1. [研究档案](research/README.md)：R079-001（告警最小版）、R079-002（风险控制设计）
2. [需求](requirements.md)：REQ-079-001..007
3. [设计](design.md)：方案对比、数据流、待确认决策
4. [任务清单](tasks.md)：任务与验证矩阵（待确认/执行）