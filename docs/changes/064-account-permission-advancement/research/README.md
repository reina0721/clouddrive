# 064 研究档案：账号与权限体系进阶

## 研究范围

本档案回答：当前「账号与权限体系」（IAM 身份凭据会话 + Auth 授权审计 + Organization 组织目录 + Navigation 菜单策略 + Permission Catalog + WebUI 权限呈现）的能力边界与已知缺口是什么；用户要求“对当前账号与权限体系进阶设计”后，候选进阶方向有哪些、每个方向的适用性、耦合面与验证路径如何。范围只覆盖上述体系，不涉及公开 HTTP 之外的协议、多租户或微服务拆分。

## 检索方式

- 按 `docs/changes/README.md` 确认下一个变更序号为 `064`；无现存 064 目录。
- 检索既有研究元数据：命中 `053/R001,R002,R003,R005`（账号/权限/组织/菜单边界）、`054/R001`（IAM 边界）、`055/R001`（Organization 边界）、`056/R001`（菜单策略）、`057/R002`（AuthN/AuthZ 候选）、`058/R001,R002,R003`（Casbin 接入与动态分配）、`022/R006`（审计/诊断）。这些记录明确把以下内容标记为「未来项/非目标/需新需求再评估」：部门数据权限、多租户、角色层级/deny/ABAC、OIDC/SSO、外部 IAM、可查询审计存储。本次进阶必须逐一对照这些既有判定，避免无收益扩界。
- 代码证据：`internal/module/{iam,auth,organization,navigation}/**`、`internal/permission/catalog.go`、`internal/composition/{iam.go,http_api.go}`、既有 WebUI 页面与 `docs/development/webui.md`，快照 commit `e059a1638ab88b2ee0664931d7272b5c4ed11e76`（含 063 菜单分类，2026-08-24 验证）。

## 记录索引

| ID | 标题 | 状态 |
| --- | --- | --- |
| [R064-001](R064-001-account-permission-baseline/report.md) | 账号与权限体系当前能力边界、已知缺口与进阶候选方向 | active |