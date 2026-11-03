# 066 需求规格：账号与权限体系闭环缺口补齐

引用研究：[R066-001](research/R066-001-account-permission-gaps/report.md)。

## 1. 目标

在已闭合的「账号—角色—权限键 Core RBAC + WebUI 权限呈现」体系上，按「真实缺口 + 单一 owner + 可验证闭环」原则补齐首批缺口：**账号/角色生命周期（改、归档）**、**WebUI 管理页按钮级权限显隐接入**、**列表/冲突交互闭环**。数据权限、角色-菜单绑定、动态菜单属重大边界突破或产品决策，只记录方向、不实施且不获得授权。

## 2. 首批功能要求（推荐范围，待用户确认）

| ID | 要求 |
| --- | --- |
| `REQ-066-001` | **账号资料更新**：IAM 新增账号改名/资料更新（DisplayName）用例，沿用现有乐观锁（version）语义，更新须刷新 `SecurityRevision` 并撤销该账号 Session（与既有安全变更一致）。新增 HTTP operation（如 `PATCH /api/v1/iam/accounts/{id}`），权限沿用 `iam:account:write`，不新增权限键。 |
| `REQ-066-002` | **账号归档（软删）**：新增账号归档用例——归档账号不可登录、不可被组织分配、不再出现在可分配清单；owner 不变量（最后一个 active owner 不可归档）沿用；归档须撤销该账号全部 Session 并 bump SecurityRevision。推荐独立 `archived` 语义（与 Role/Department/Position 一致），连接引用保护由 Organization 侧分配校验覆盖（归档后 `RequireAssignableAccount` 拒绝）。新增 HTTP operation（如 `POST …/accounts/{id}/archive`），权限沿用 `iam:account:write`。不做物理删除、不提供恢复（如需恢复归入恢复流程另行设计）。 |
| `REQ-066-003` | **角色资料更新**：新增角色改名/描述更新用例，沿用乐观锁；HTTP 权限沿用 `iam:role:write`，不新增权限键。 |
| `REQ-066-004` | **角色归档**：新增角色归档用例——归档角色移出可分配（`checklistCandidates` 已过滤 archived）、不再产生授权规则；已分配该角色的账号保留历史记录但不获得该角色权限；owner 角色不可归档。归档前校验引用策略见设计。HTTP 权限沿用 `iam:role:write`。不做物理删除、不提供恢复。 |
| `REQ-066-005` | **WebUI 管理页按钮级权限接入**：IAM 账号/角色页、Organization 部门/岗位/分配页、Navigation 菜单页将写操作按钮接入既有 `ActionTrigger`/`useActionAccess` 机制（Binding 声明 `ActionPermissions` → Manifest 投影 → 按钮按 access 显隐/禁用），不新增权限键、不改变授权语义。 |
| `REQ-066-006` | **列表/冲突交互闭环**：账号、角色、部门、岗位列表支持按关键字过滤与分页（沿用现有 offset/limit 契约，扩展可选 filter 参数）；`ReplaceAccountRoles`/`ReplaceRolePermissions` 的 409 版本冲突在 WebUI 呈现差异确认 UI（展示 added/removed 差异并让用户重新确认），不再静默丢弃未保存选择；Organization 分配页补乐观锁与 409 处理。 |
| `REQ-066-007` | 保持既有边界：Casbin Core RBAC 模型固定；不新增权限键种类（仅复用既有 read/write 键）；不上移权限模型；不改 Session/Cookie/CSRF/Origin 语义；不引入 `role_menu` 或动态菜单；组织关系不进入授权决策；不引入外部身份/多租户/ABAC。 |
| `REQ-066-008` | 数据库迁移单轨：账号归档若需新列，按 IAM 既有 migration set 递增版本新增，不得改写既有 000001/000002（迁移文件重写属于首发前 baseline 收敛，需另行确认，不在本批）。 |

## 3. 候选方向（仅记录，不实施）

- **组织数据权限（部门/岗位数据范围进入授权决策）**：055/R005、064 明确「不自动获得数据范围」，属重大边界突破，须单独确认范围与决策模型；最小闭环建议「本人 / 本部门 / 本部门及子部门 / 全部」四级 scope，Casbin 两字段求值保持不动、scope 在业务侧二次判定。
- **按钮级独立权限键（新增/导出/删除）**：当前写操作聚合为粗粒度 write 键；若产品需要「导出」等独立授权，须新增 Catalog 键（每次发版扩展，`ReconcileOwnerCatalog` 自动覆盖 owner），待真实用例再立项。
- **角色-菜单显式绑定（`role_menu`）/ 动态菜单/按钮/路由**：与 056/058 边界冲突（不存任意 Route/component/role_menu；不开 domain），须产品决策后单独研究。

## 4. 非功能要求

- 新增/修改 HTTP operation、权限引用、迁移与 WebUI 页面必须按模块开发指南与 051 文档治理执行；不新增第三方依赖。
- 归档/资料更新不得泄露敏感信息；日志沿用低敏规范。
- 并发与事务：资料更新/归档沿用「事务内安全变更 + Session 撤销 + 审计」既有路径；`expectedVersion` 乐观并发语义不变。
- 账号归档与组织分配是两个独立用例，不承诺跨模块事务（沿用 055 边界）。

## 5. 验收标准

1. 账号改名/归档、角色改名/归档的 HTTP operation 存在且权限正确（`iam:account:write`/`iam:role:write`）；归档后账号不可登录/不可分配；owner 不变量保持。
2. 归档账号/角色从 `ListAccounts`/`ListRoles` 可区分（返回 archived 标记，WebUI 呈现），不影响既有 active 过滤语义。
3. 管理页写操作按钮按当前主体 access 显隐/禁用（WebUI 测试断言），且 Manifest.actionPermissions 正确投影。
4. 列表过滤/分页、409 差异确认 UI（账号/角色页）、分配页乐观锁均可用；双语 locale 完整。
5. 三驱动 migration `up`/`down` 通过；`go test ./...`、WebUI lint/typecheck/Vitest/Playwright、`pnpm generate:check`、docs-guard 全绿。
6. `api/openapi.yaml` 与 operation inventory 随 contract-gen 更新且 diff 稳定；Go 测试覆盖新 operation 语义。

## 6. 非目标

- 不实施数据权限、角色-菜单绑定、动态菜单、MFA、外部身份/多租户/ABAC（均为候选方向或产品决策项）。
- 不新增权限键（复用既有 read/write；如需独立按钮键另行立项）。
- 不改变 Casbin evaluator 模型、Session/CSRF/Cookie 语义、授权 authority（RolePermission 仍唯一）。
- 不做物理删除/恢复流程（归档即终态；恢复另行设计）。