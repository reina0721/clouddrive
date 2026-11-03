# 065 研究档案：日志与审计体系进阶

## 研究范围

本档案回答：当前「日志体系（`pkg/logger` + 运行事件）与『审计体系』（064 已落地的 Auth 授权决策审计）」的能力边界、真实缺口与候选进阶层级是什么；用户要求「深度研究，为项目新增方案：日志与审计体系等业务模块」时，哪些候选属于低收益扩界、哪些有真实收益且能按模块边界闭环；以及组织/导航/业务写操作是否具备可审计路径。范围只覆盖日志、审计与相关业务模块的能力层级，不研究外部日志平台选型、OTLP Logs、分布式 tracing 后端或第三方 SIEM。

## 检索方式

- 确认下一个变更序号为 `065`；无现存 065 目录。
- 检索既有研究元数据：命中并复核 `028/R001`（日志能力与启动可见性）、`041/R001`（日志覆盖与治理缺口，non-applicable 含「集中日志平台/OTLP Logs/日志轮转/审计日志持久化」）、`022/R006`（统一运行诊断）、`024/R002,R005`（audit 收口 Auth 的决策）、`057/R013`（HTTP observability）、`064/R064-001`（可查询低敏审计已实施，评审候选方向）。这些记录明确：日志体系已闭环、审计持久化已由 064 落地、业务操作审计/可查询日志仍属未覆盖缺口。
- 代码证据：`pkg/logger/*`、`internal/kernel/logging/*`、`internal/module/auth/{model,service,adapter/audit,repo,binding/http,binding/migration}`、`internal/module/{iam,organization,navigation}/service`、`docs/development/logging.md`、`docs/operations/security.md`、`docs/operations/runtime-capabilities.md`，快照 commit `753f2b7`（064 完成，2026-08-24 验证）。

## 记录索引

| ID | 标题 | 状态 |
| --- | --- | --- |
| [R065-001](R065-001-logging-audit-baseline/report.md) | 日志与审计体系当前能力、缺口与进阶候选方向 | active |