# Organization 模块

Organization 拥有部门、岗位与账号组织关系。它只维护组织目录，不授予权限，也不参与 Auth decision。

## 边界

- `model/` 与 `service/` 维护部门无环树、岗位平面目录、引用保护和账号分配规则；账号-部门/岗位分配使用 `expectedVersion` 乐观并发（`organization_account_departments.version`，冲突返回稳定 409）。
- `repo/` 与 `binding/migration/` 独占 `organization_*` 表及 `organization_schema_migrations`。
- `handler/` 与 `binding/http/` 提供 typed operation 和代码优先契约。全部 operation 使用 `webuiSession` 认证 profile；mutation（部门/岗位/分配创建、更新、替换）经模块自有窄 `MutationGuard` 校验 Origin/Session/CSRF（composition 注入 IAM 守卫，与 Navigation 一致），前端 mutation 请求必须携带 `Origin` + `X-CSRF-Token`。
- `binding/webui/` 提供部门、岗位和账号组织分配页面。
- `binding/permission/` 贡献 `organization:department:*` 与 `organization:position:*`。

账号是否存在且可分配由本模块定义的 `AccountDirectory` 窄端口回答，composition 适配 IAM；Organization 不导入 IAM、Auth 或 Navigation。账号创建与组织分配是两个独立用例，不承诺跨模块事务。

首版明确不包含部门数据权限、多租户、汇报线、岗位层级或 HR 流程。
