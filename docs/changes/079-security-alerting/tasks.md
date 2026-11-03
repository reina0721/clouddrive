# 079 任务清单：安全告警最小版（+ 风险控制设计归档）

## 状态

研究门禁已通过（[R079-001](research/R079-001-alerting-minimal-design/report.md)、[R079-002](research/R079-002-risk-control-design/report.md)）；计划已确认（用户确认：实施告警最小版；承载方式 kernel/app 组件）；**实施完成并验证**（2026-09）。

## 任务

| ID | 工作量 | 依赖 | 内容 | 完成条件 | 状态 |
| --- | --- | --- | --- | --- | --- |
| `RES-079-001` | M | — | 告警最小版设计 | metadata/report 齐全；门禁通过 | 完成 |
| `RES-079-002` | M | — | 动态风险控制设计研究（归档） | metadata/report 齐全 | 完成 |
| `PLAN-079-001` | M | RES | 计划并提交确认 | 文档齐全；用户确认范围与承载方式 | 完成 |
| `ALERT-079-001` | M | 确认 | `pkg/alerting`（Event/Notifier/WebhookNotifier + 签名/超时/重试/校验 + 测试） | 标准库实现；失败降级；低敏载荷 | 完成 |
| `ALERT-079-002` | M | ALERT-001 | `application.alerting` kernel 组件（配置/Definition/异步队列 worker/生命周期/装配 + config init/example） | Plan/Lease 样板对齐；关闭时零行为；close 排空 | 完成 |
| `ALERT-079-003` | M | ALERT-002 | IAM 接驳（锁定/MFA 失败计数与审计补漏/敏感写操作 → reporter） | 触发正确；enabled=false 零调用 | 完成 |
| `ALERT-079-004` | M | ALERT-002 | Auth 接驳（连续认证失败窗口 → reporter） | 阈值可配；载荷低敏 | 完成 |
| `TEST-079-001` | M | 上述 | Go 测试（notifier 发送/签名/重试/合并/非法配置；触发点；低敏与架构边界） | `go test ./...` 全绿（含 `pkg/alerting`、kernel/app、service 触发） | 完成 |
| `DOC-079-001` | M | 上述 | 更新 security/runtime-capabilities/配置说明/模块 README/变更记录 | docs-guard 通过 | 完成 |
| `VER-079-001` | M | 全部 | 全量验证与提交 | 无失败；受限项如实标注 | 完成 |

## 验证矩阵（实测结果）

| 门禁 | 命令/入口 | 结果 |
| --- | --- | --- |
| Go 单元/集成 | `go test ./...` | 全绿（pkg/alerting 4 组 + service 触发 3 组 + kernel 组件接入） |
| Go 静态 | `go vet ./...` | 通过 |
| 架构边界 | `internal/kernel/composition` architecture gate（日志低敏） | 通过 |
| 配置模板 | `config init` 临时输出 | 生成 `alerting` 节（含 application.alerting section） |
| 文档 | docs-guard | 通过 |

## 未执行/受限项

- 动态风险控制：设计归档（R079-002），实施（IP/设备采集、干跑规则、地理数据源）独立立项。
- 告警增强（多通道/升级/抑制/规则引擎配置化）：后续扩展项。
- 多实例下失败计数为进程内窗口（不跨副本合并），文档注明。