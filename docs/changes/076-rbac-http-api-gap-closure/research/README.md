# 076 研究档案：RBAC / HTTP API 未闭环缺口修复

## 研究范围

本档案回答：当前 IAM RBAC 管理与 HTTP API 相对「可运营闭环」的五个未闭环/缺口（审计结论来自本任务立项对话）：

- **Gap1** Organization 模块全部 HTTP operation 使用 `bearerAuth` security profile，而默认托管模式（模式 B，IAM WebUI Session）下浏览器只携带 Session Cookie，operation gate 对 `bearerAuth` 只映射 Bearer 来源，org 页面在真实模式下无法经会话闭环到达；
- **Gap2** 角色/权限缺少反向查询（role→accounts、permission→roles），归档/退役前无法做影响分析；
- **Gap3** 会话列表接口无分页、无状态过滤，一次性返回账号全部会话；
- **Gap4** 账号列表过滤维度单一（仅关键字），无 status/archived/role 过滤与排序；
- **Gap5** 密码策略（最小/最大长度）硬编码在 `internal/module/iam/model/model.go`，不可配置。

只涉及上述五项的现状核实、消费方与改动面；不涉及多实例一致性、MFA、外部身份、数据权限、角色继承/deny/SoD 等候选方向（延续 058/064/066 边界）。

## 检索方式

- 按 `docs/changes/README.md` 确认下一个变更序号为 `076`；无现存 076 目录；工作树 clean（`git status --short` 为空，commit `3505352` 起本地领先 origin/main 8 个提交，均与本任务无关）。
- 检索既有研究元数据：命中 `053/R002,R005`、`054/R001`、`055/R001`、`056/R001`、`058/R001-R003`、`064/R064-001`、`066/R066-001`、`075/R075-008`；相关既有判定：Organization「不自动获得数据范围」、Casbin 固定 exact Core RBAC、多实例未作为已承诺分布式保证（`docs/operations/security.md:31`）、064/066 已把「按钮独立权限键、自助找回、IP 限流、MFA、外部身份/多租户/ABAC」列为候选或非目标。
- 代码证据：`internal/module/organization/binding/http/huma.go`、`internal/module/iam/binding/http/{contract.go,huma.go}`、`internal/module/iam/{model,service,repo,binding/config}`、`internal/composition/{identity_access.go,http_api.go,iam.go,generation.go}`、`internal/transport/{http/huma.go,http/humabinding/binding.go}`、`internal/module/{organization,navigation,iam}/binding/webui/**`、`webui/src/contracts/index.tsx`、`api/openapi.yaml`，快照 commit `3505352`（2026-09 验证）。

## 记录索引

| ID | 标题 | 状态 |
| --- | --- | --- |
| [R076-001](R076-001-rbac-http-api-gap-audit/report.md) | RBAC/HTTP API 未闭环缺口核实：org security 断点、反向查询、分页、过滤与密码策略配置 | active |