# 066 研究档案：账号与权限体系闭环缺口补齐

## 研究范围

本档案回答：当前「账号与权限体系」（IAM 身份凭据会话 + Auth 授权审计 + Organization 组织目录 + Navigation 菜单策略 + Permission Catalog + WebUI 权限呈现）相对四要素闭环（用户管理/角色管理/菜单与权限管理/部门与岗位管理）的逐项缺口、模块归属与补齐边界。只涉及上述体系，不涉及公开 HTTP 之外的协议、多租户或微服务拆分。

## 检索方式

- 按 `docs/changes/README.md` 确认下一个变更序号为 `066`；无现存 066 目录，工作树无未提交修改（快照 commit `a5f02db`）。
- 检索既有研究元数据：命中 `053/R002,R005`（账号/权限/组织边界）、`054/R001`（IAM 边界）、`055/R001`（Organization 边界，明确不含部门数据权限）、`056/R001`（菜单策略，不建第二套授权）、`058/R001-R003`（Casbin 核心 RBAC）、`064/R064-001`（064 首批后 MFA/数据权限/外部身份列为候选）。数据权限、角色-菜单绑定、动态菜单均已被既有判定标记为「未来项/需新需求再评估」或明确非目标，本次补齐必须对照这些判定，区分「边界内可补」与「需边界突破」。
- 代码证据：`internal/module/{iam,auth,organization,navigation}/**`、`internal/permission/catalog.go`、`internal/webui/contract.go`、`internal/composition/webui_http.go`、各模块 `binding/webui/web/*.tsx`、`api/openapi.yaml`，快照 commit `a5f02db`（2026-08-25 验证）；三份并行只读子代理核实结果与本档案交叉一致。

## 记录索引

| ID | 标题 | 状态 |
| --- | --- | --- |
| [R066-001](R066-001-account-permission-gaps/report.md) | 账号与权限体系闭环缺口核实：账号/角色生命周期、按钮级显隐、列表体验与数据权限边界 | active |