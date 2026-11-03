# 055 Organization 组织目录需求

## 1. 产品目标

建立独立组织目录，使 owner 能维护部门树、岗位目录和账号组织关系，同时避免组织结构暗中成为授权规则。

## 2. 范围

| ID | 要求 |
| --- | --- |
| `ORG-REQ-001` | Organization 拥有 Department、Position、AccountDepartment、AccountPosition；IAM Account 不保存 Department/Position 字段。 |
| `ORG-REQ-002` | Department 有稳定 ID、唯一 code、name、可空 ParentID、active/archived、乐观版本和时间戳；拒绝自父级、环和超过命名最大深度。 |
| `ORG-REQ-003` | 有 active child 或 active Account assignment 的 Department 不得归档；移动和状态变更必须事务一致。 |
| `ORG-REQ-004` | Position 有稳定 ID、唯一 code、name、active/archived、乐观版本和时间戳；首版是全局平面目录。 |
| `ORG-REQ-005` | 有 active Account assignment 的 Position 不得归档。 |
| `ORG-REQ-006` | 一个 Account 可有一个可空主 Department 和多个 Position；Organization 只保存稳定 AccountID，通过调用方 AccountDirectory port 验证可分配账号。 |
| `ORG-REQ-007` | 创建账号属于 IAM，组织分配属于 Organization；不提供需要跨模块事务的“创建账号并分配组织”Service。 |
| `ORG-REQ-008` | 模块贡献 `organization:department:read/write`、`organization:position:read/write` 四个精确 permission key。 |
| `ORG-REQ-009` | 提供 departments、positions、account organization assignments typed HTTP API，以及 Departments、Positions 和账号组织分配 WebUI。 |
| `ORG-REQ-010` | Department/Position 列表使用受控 filter、稳定排序、分页/树查询和命名最大 page size。 |
| `ORG-REQ-011` | `organization_schema_migrations` 从三驱动 000001 创建本模块 schema，不创建 IAM/Navigation 表。 |
| `ORG-REQ-012` | 组织变化不授予/撤销 RolePermission、不更新 IAM SecurityRevision，也不向 Auth 输出 department facts。 |

## 3. 验收

1. 创建、移动部门时拒绝环、自父级和超深树。
2. 被子部门或账号引用的部门、被账号引用的岗位不能归档。
3. AccountDirectory 拒绝不存在/不可分配账号，Organization 事务不留下部分 assignment。
4. 部门和岗位权限由服务端精确拒绝/允许，WebUI 菜单不可替代 403。
5. Organization 不 import IAM，实现和数据库都不存在 RolePermission/data scope。

## 4. 非目标

- 不实现本人/本部门/部门及下级/自定义部门等数据范围。
- 不实现组织多租户、汇报线、岗位层级、兼职有效期、人员档案或 HR 工作流。
- 不创建第二套 User/Person 身份表，不复制 IAM Account 状态。
- 不通过事件或补偿伪装跨模块原子账号创建。
