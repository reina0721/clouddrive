# R003 组织目录与菜单管理边界

## 1. 新增研究问题

用户把 053 范围补充为用户管理、角色管理、菜单与权限管理、部门与岗位管理。该范围不能直接套用传统后台的“数据库 component path + role_menu 表”，因为当前仓库已实施模块自有页面、静态生成 registry 和服务端 operation authority。

本研究核验当前 `Binding.Navigation -> Catalog -> Manifest -> AppShell` 链路，并区分组织目录、导航配置和授权三种不同语义。

## 2. 当前菜单事实

- 每个业务模块在 `Binding` 中声明 Entry、Route、Navigation 和 Locale；`Navigation` 包含稳定 ID、ParentID、RouteID、TitleMessageID、IconID 和 Order。
- Catalog 构建期校验 Route/Entry/Navigation owner、父子引用、重复、路径和 SDK requirement，再计算 revision。
- registry 只从已启用且已实现模块生成静态 lazy import；runtime manifest 不含 SourcePath。
- manifest 按当前 Principal 的 view operation 和 availability 过滤菜单；无权或不可用 route 不进入可加载菜单。
- WebUI 宿主只消费 manifest，不按数据库字符串动态 import component。

因此，数据库若允许创建任意 route/component/path，会绕过 owner、生成、revision、locale 和静态质量门禁；即使插入成功也不存在可加载页面。这不是可接受的“菜单管理”。

## 3. 菜单管理的目标语义

053 把菜单分为两层：

| 层 | Authority | 可变内容 |
| --- | --- | --- |
| Menu Definition | 模块 `Binding.Navigation` + `Route` | ID、RouteID、Entry、path、TitleMessageID、IconID、ViewOperationID；构建期固定 |
| Menu Policy | Account 数据库 | 已注册 NavigationID 的 enabled、parent override、order override；运行期可管理 |

约束如下：

- Policy 只能引用当前 Catalog 已存在的 NavigationID/RouteID；未知、disabled module 或 not-implemented route 被拒绝。
- page 节点不能更换 RouteID、path、Entry、title、icon 或 view operation。
- parent override 只能指向当前 Catalog menu，必须无环；默认值来自 Binding。
- disabled menu 只影响导航，不撤销 permission，也不阻止已知 URL；服务端 operation gate 始终授权。
- Catalog revision 变化时，未知旧 policy 在 Generation 候选校验中 fail closed，并要求显式 migration/清理，不静默忽略。
- Manifest 的静态 `Revision` 继续只校验构建期 Catalog 与 generated registry；另设由有效 policy snapshot 计算的 `NavigationRevision`，避免运行期菜单变更被误判为前端生成物过期。

这提供真实的启停、层级和排序管理，同时保持静态页面与模块 owner。

## 4. 菜单与权限的关系

角色权限的存储 authority 仍是 `RolePermissionAssignment`，不增加第二张 `role_menu` 授权表。管理页面可把权限投影为树：

```text
Menu Definition
  -> Route.ViewOperationID
  -> Operation Policy.PermissionKey
  -> RolePermissionAssignment

non-page operation permissions
  -> grouped under owning module/action section
```

目录节点没有权限；它在至少一个可见子节点存在时显示。页面节点是否显示同时受 Menu Policy、route availability 和 Auth access 约束。按钮/接口权限不一定有菜单，仍必须出现在角色权限矩阵。

## 5. 用户、部门与岗位

首版组织模型收敛为：

- User/Account 是同一登录主体，增加 `DisplayName`；不创建无法独立使用的第二套人员表。
- Department 是有稳定 ID/code/name/status/version 的无环树；支持分页/树查询、创建、重命名、移动、禁用/归档约束。
- Position 是稳定 ID/code/name/status/version 的全局岗位目录。
- User 有一个可空主 Department，并通过 assignment 拥有多个 Position。
- Department 有 active child 或 active user 时不能归档；Position 仍有 active user assignment 时不能归档。
- 部门/岗位变化只改变组织目录和筛选，不自动改变角色、权限或 Session。

“部门数据范围”会要求业务资源携带 department facts、角色声明 scope 规则并扩展 Auth action decision，属于 ABAC 类增强。当前用户没有明确要求，首版不暗中加入；需要时单独研究和确认。

## 6. 能力与边界影响

- 不需要新 Kernel Capability；组织与菜单策略使用现有 Database、Transaction、WebUI Catalog 和 composition。
- Account 模块不能直接导入 `internal/webui` 业务实现；由 composition 把 Catalog 投影成 Account 定义的窄 `NavigationCatalog` 输入，并把持久化 policy 投影回通用 manifest policy。
- runtime manifest 增加 generic navigation policy provider 与独立 `NavigationRevision`，是现有 WebUI contract 的扩展；不得包含 Account DTO 或 ModuleID 特判，也不得改变静态 registry revision 的含义。
- 菜单 policy 是数据库运行数据，不依赖 config reload；Catalog/registry 仍构建期固定。

## 7. 非目标与刷新条件

首版不提供数据库创建页面、任意 component path、external URL、iframe、远程模块或 runtime install。也不提供组织多租户、部门数据权限、汇报线、岗位层级、兼职生效期或 HR 工作流。

若用户要求这些能力，或当前 WebUI Catalog 改为其他装配模型，必须刷新本研究。

## 8. 研究门禁

新增范围的当前事实、目标语义、权限边界、组织模型和非目标已可复核，足以修订 053 计划；研究门禁继续通过，不构成实施授权。
