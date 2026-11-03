# R003 动态账号角色与角色权限分配契约

## 1. 研究结论

“动态权限分配”应分成两个层次：

| 层次 | 是否支持 | authority |
| --- | --- | --- |
| 运行时创建/维护业务角色 | 支持 | IAM Role |
| 运行时给账号分配一个或多个角色 | 支持 | IAM AccountRole |
| 运行时给角色分配已注册 PermissionKey | 支持 | IAM RolePermission + Permission Catalog 校验 |
| 运行时创建任意 PermissionKey | 不支持 | 没有 operation/action 消费方，无法形成可验证授权语义 |
| 运行时修改 Casbin model/matcher | 不支持 | 等同公共授权语义和架构变更 |
| 直接按 URL、菜单或按钮生成后端权限 | 不支持 | HTTP route、Navigation 与 authorization authority 会混淆 |

用户真正需要的“权限可以动态配置”由前三项闭合；自定义角色就是管理员可维护的 permission bundle。PermissionKey 仍由业务模块代码注册，保证每一个可分配权限都有真实服务端消费点。

## 2. 当前已实现事实

当前系统已经有动态关系入口：

- `PUT /api/v1/iam/accounts/{id}/roles` 调用 `ReplaceAccountRoles`；
- `PUT /api/v1/iam/roles/{id}/permissions` 调用 `ReplaceRolePermissions`；
- `GET /api/v1/iam/permissions` 返回代码 Permission Catalog；
- WebUI 可以创建角色并提交角色 permission keys；
- Service 在角色/权限关系变化后更新受影响账号 `SecurityRevision` 并撤销 Session。

因此 058 不需要新增第二套 policy administration API。它需要修复三类缺口：

1. `RolesPage` 目前以自由文本输入 permission keys，容易提交拼写错误，也没有按 owner/module/业务分组的可发现矩阵；
2. 关系替换接口没有显式 expected version，两个管理员并发编辑时可能后写覆盖先写；
3. Casbin 接入后必须把数据库 transaction、authorization revision 与 evaluator publish 绑定为一条成功或失败协议，不能先改内存再写数据库。

## 3. 动态分配的推荐交互

### 3.1 读取编辑快照

角色权限读取不再只返回 `[]PermissionKey`，而是返回可编辑快照：

```json
{
  "roleId": "...",
  "roleVersion": 7,
  "authorizationRevision": 42,
  "permissionKeys": ["iam:account:read"]
}
```

账号角色读取采用等价结构，包含 `accountVersion`、revision 与 `roleIds`。WebUI 同时读取 Permission Catalog/Role list，用 Catalog 稳定 key 形成选择矩阵，不允许自由输入未知 key。

### 3.2 全量集合替换而不是逐项命令

写入采用“提交期望最终集合”：

```json
{
  "expectedRoleVersion": 7,
  "permissionKeys": [
    "iam:account:read",
    "organization:department:read"
  ]
}
```

Service 对输入排序、去重、校验 Catalog，然后在 transaction 内计算 `added/removed/unchanged`。全量替换的优点是：

- 一个业务动作只有一次权限与 owner 校验；
- 全部关系、revision 与 Session 撤销原子完成；
- retry 使用同一 expected version 可识别冲突；
- 不会出现前半批成功、后半批失败；
- UI 可以明确展示最终状态。

不新增 `POST add-permission`/`DELETE remove-permission` 作为第二条写入路径。Casbin `AddPolicy`/`RemovePolicy` 也不成为业务 API。

### 3.3 乐观并发

- expected version 不匹配返回稳定 `409 version_conflict`；
- 响应不静默重试或 merge，客户端重新读取最新快照后由用户确认；
- no-op replacement 不写关系、不 bump revision、不撤销 Session；
- 有效变化同时 bump target entity version 与 authorization revision；
- owner role 仍不可编辑，最后 active owner 保护仍在 transaction 内。

## 4. transaction 与 evaluator 发布

动态角色权限 mutation：

```text
authorize caller (iam:role:write)
  -> validate expected version and all PermissionKeys
  -> lock/serialize authorization mutation
  -> transaction
       read current role and assignment set
       reject system owner/inactive/archived target
       calculate added/removed diff
       persist desired RolePermission set
       bump role version
       bump affected Account.SecurityRevision
       revoke affected Sessions
       bump authorization revision
       read normalized PolicySnapshot
       build complete candidate evaluator
  -> commit
  -> atomic publish evaluator
  -> return new roleVersion + authorizationRevision
```

账号角色 mutation 同理，但必须额外检查最后 owner 和所有目标 Role 的 active/non-archived 状态。

Evaluator 始终全量重建并原子替换。管理员写入相对低频，完整 snapshot 能避免 Casbin 内存增量、数据库 rollback 和并发读之间的三方协调。未来只有在真实 profile 证明完整构建超出明确预算时，才重新研究 incremental publish；不能先引入复杂的 mutable policy 路径。

## 5. 生效语义

| 场景 | 结果 |
| --- | --- |
| 给角色新增权限 | transaction commit + evaluator publish 后，新请求可用；旧 evaluator 只会少授权，revision mismatch 时刷新 |
| 从角色移除权限 | 受影响 Session 同事务撤销；旧 Principal/revision 不能继续使用旧 evaluator |
| 给账号增加/移除角色 | 账号 Session 同事务撤销；重新登录后获得当前 revision |
| no-op 提交 | 不改变 entity/revision，不撤销 Session |
| candidate evaluator 构造失败 | transaction rollback，旧业务关系和 evaluator 均保持 |
| commit 后 publish 前并发请求 | authorization mutation lock/revision mismatch 保证拒绝或使用一致旧状态，不使用半成品 |
| 两个管理员并发编辑 | 一个成功，另一个因 expected version 返回 409 |

管理员修改自身权限时，当前 mutation 请求可以完成；其 Session 在事务内被撤销，下一请求重新认证并按新权限判断。

## 6. WebUI 设计

角色页面从自由文本改为 Catalog 驱动的权限矩阵：

- 按 `OwnerModuleID` 分组；
- 展示本地化 description，不把 PermissionKey 作为唯一可读文本；
- 支持组内全选/清空，但提交前仍发送精确 key 集合；
- system owner 只读并展示“随 Catalog 自动覆盖”；
- 保存前显示新增/移除数量；
- 409 时保留用户选择、提示数据已变化并要求重新加载，不自动覆盖他人修改；
- Navigation 菜单可见性只能作为权限结果投影，不能反向创建 RolePermission。

账号角色页面采用 Role checklist，并排除 inactive/archived role。首版不增加条件授权、生效时间、审批流、账号直授权或权限模板；这些都不是当前 Core RBAC 动态分配。

## 7. 审计与敏感边界

授权变更审计记录 actor、target type/ID 的受控摘要、expected/new version、added/removed count、result 与 authorization revision。日志不记录完整权限集合、角色成员列表、请求 body、Cookie 或 token。

审计失败语义沿用 Auth/IAM 当前 authority：决定是否提交的边界必须明确。实施设计不能出现“数据库已成功但审计返回失败导致客户端重试并误判”的隐式语义；具体 durable audit 若超出当前 logger sink 能力，应另立任务，不在 058 伪造事务审计。

## 8. 对 058 的影响

058 需要把动态分配从“已有 CRUD 恰好能工作”提升为显式产品契约：Catalog 是可分配项 authority，IAM relation 是业务存储 authority，Casbin 是只读 evaluator，revision 是跨请求/Generation 一致性协议，composition DecisionPoint 是消费中介。

该调整不授权动态 Permission Definition、Casbin model 编辑器或新的顶层 RBAC module。

