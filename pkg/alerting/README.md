# Alerting 包

安全告警事件的项目自有契约与 Webhook 实现（079）。`Event` 为低敏载荷（type/severity/summary/资源摘要，不含 token、密码、IP 全文、URL query 与配置密钥）；`WebhookNotifier` 使用标准库 HTTP 发送 JSON，支持可选 HMAC-SHA256 签名与超时/重试；发送失败向上返回错误，由调用方低敏记录，不阻断业务。

消费方经 `application.alerting` kernel 组件（`internal/kernel/app/alerting`）获得稳定 `Notifier` facade（有界异步队列 + 生命周期治理）；Auth/IAM 在账号锁定、连续认证失败、MFA 连续失败与敏感权限写操作边界汇报事件。详见 `docs/operations/runtime-capabilities.md` 与 `docs/operations/security.md`。