# 077 研究档案：用户与权限体系企业级能力差距评估

## 研究范围

本档案回答：当前「用户与权限体系」（IAM 身份/凭据/会话/RBAC + Auth 授权/审计 + Organization 组织目录 + Permission Catalog + WebUI）相对「企业级通用能力」在**完整性、通用性、闭环、成熟度**四个维度的现状与差距；以及哪些差距属于「边界内可直接补」，哪些属于「需边界突破/重新研究/产品决策」。

评估基准：企业级通用身份与访问管理（IAM）常见能力面——认证因素、账户生命周期、口令策略、会话治理、授权模型、数据权限、审计、外部身份/多租户、规模化一致性、运营工具。

## 检索方式

- 按 `docs/changes/README.md` 确认下一个变更序号为 `077`；工作树 clean（commit `9462bfa`）。
- 复用既有研究：`058`（Casbin Core RBAC 边界与触发条件）、`064`（MFA/TOTP、组织数据权限、外部身份/多租户/ABAC 列为候选）、`066`（数据权限、角色-菜单绑定、按钮独立权限键候选）、`076`（认证断点、反向查询、分页过滤、密码策略配置）、`R076-001`；`docs/operations/security.md`、`runtime-capabilities.md`、`technology-selection.md` 的已声明边界与候选清单为判定依据。
- 代码证据：`internal/module/iam/**`、`internal/module/auth/**`、`internal/module/organization/**`、`internal/permission/`、`internal/transport/http/`、`webui/src/**`、`api/openapi.yaml`，快照 commit `9462bfa`（076 完成，2026-09 验证）。

## 记录索引

| ID | 标题 | 状态 |
| --- | --- | --- |
| [R077-001](R077-001-enterprise-iam-gap-audit/report.md) | 用户与权限体系企业级能力差距评估：完整/通用/闭环/成熟度四维核实与下一批完善边界 | active |
| [R077-002](R077-002-enterprise-capabilities-feasibility/report.md) | 企业级能力可行性分析：MFA / API-Token / 动态风险控制 / 操作留痕 / 授权留痕 / 异常告警 | active |