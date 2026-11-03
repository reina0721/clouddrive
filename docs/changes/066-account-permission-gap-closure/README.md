# 066 账号与权限体系闭环缺口补齐

## 状态

**已确认，实施完成**（2026-08-25 用户确认决策 1–5 推荐项；RES/PLAN/ACC/ROLE/WEB/TEST/DOC/VER 全部完成，证据见 [tasks.md](tasks.md)）。

## 结果

在既有闭合体系上补齐首批缺口，未修改 Casbin Core RBAC/授权 authority、未新增权限键、未引入数据权限/role_menu/动态菜单：

1. **账号生命周期（IAM）**：账号资料更新（`PATCH /api/v1/iam/accounts/{id}`，`iam:account:write`，改名 bump SecurityRevision + 撤销 Session）与账号归档（`POST …/accounts/{id}/archive`，独立 `archived` 列 migration 000003，归档不可登录/不可分配、owner 最后账号保护、不做物理删除/恢复）。
2. **角色生命周期（IAM）**：角色资料更新（`PATCH /api/v1/iam/roles/{id}`，名称/描述，不触发授权 revision/不撤销 Session；owner 角色不可修改）与角色归档（`POST …/roles/{id}/archive`，走 `authorizeMutation` 完整授权发布链路，归档移出可分配与授权规则、受影响持有者 Session 撤销、owner 角色 `ErrImmutableOwner`）。
3. **WebUI 按钮级权限接入**：IAM/Organization/Navigation 管理页写操作按钮全部接入既有 `ActionTrigger`/`actionPermissions` 机制（Binding 声明 ActionPermissions、Manifest 投影、按钮按 access 显隐禁用），不新增权限键、宿主零改动。
4. **列表/冲突交互闭环**：账号/角色列表支持关键字过滤 + 分页；账号角色/角色权限 409 冲突展示 added/removed 差异并重新加载最新版本（不再静默丢弃未保存选择）；Organization 分配引入 `expectedVersion` 乐观锁（`organization_account_departments.version` migration 000002）与 409 处理。
5. **配套**：contract-gen/composition/迁移目录同步；Go 测试（改名/归档/登录与分配拦截/Session 撤销/owner 不变量/授权失效与候选发布/分配版本冲突）与 WebUI 测试（Vitest 82、i18n/module/architecture lint、typecheck、generate:check、build、Playwright）全绿。

## 明确不做（与计划一致）

- 不实施组织数据权限、角色-菜单绑定、动态菜单、按钮独立权限键、MFA、外部身份/多租户/ABAC（均为候选方向或产品决策项，仅记录）。
- 不改变 Casbin Core RBAC 模型与授权 authority；组织关系不进授权决策。
- 不做账号/角色物理删除与恢复（归档即终态；恢复另行设计）。

## 阅读顺序

1. [研究档案](research/README.md)：R066-001
2. [需求](requirements.md)：REQ-066-001..008
3. [设计](design.md)：方案对比、数据流、失败语义、已确认决策 1–5
4. [任务清单](tasks.md)：任务状态与验证矩阵