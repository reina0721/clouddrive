# 066 设计方案：账号与权限体系闭环缺口补齐

## 1. 背景与目标形态

当前「账号—角色—权限键 Core RBAC」闭环已完整（058/054），组织目录、菜单策略为相邻能力（055/056），064 已补齐审计与会话集中管理。本批补齐四类缺口：账号/角色生命周期（改、归档）、WebUI 管理页按钮级权限接入、列表/冲突交互闭环，全部落在 IAM/Organization/Navigation 模块与既有 WebUI 机制边界内，不触碰 Casbin model、不新增权限键、不引入数据权限/role_menu/动态菜单。

## 2. 方案对比

| 方案 | 做法 | 结论 |
| --- | --- | --- |
| A（采纳） | IAM 加「账号资料更新 + 账号归档 + 角色资料更新 + 角色归档」四个用例（复用乐观锁/安全变更/审计路径）；WebUI 管理页按钮接 `ActionPermissions`/`ActionTrigger`；列表过滤分页 + 409 差异确认 UI；Organization 分配页补乐观锁 | 缺口真实、owner 清晰、在既有模块边界与机制内即可闭环 |
| B（不采纳） | 一次引入数据权限（部门数据范围）+ 按钮独立权限键 + role_menu | 055/064 明确为重大边界突破/产品决策项，耦合面大、超出本批可验证范围 |
| C（不采纳） | 账号/角色物理删除 + 回收 | 有 FK/审计/历史引用，破坏审计连续性与可追溯性，与项目「归档即终态」语义冲突 |

## 3. 数据流与实现位置

### 3.1 账号资料更新（REQ-066-001）

```
IAM Service 新增 UpdateAccountInfo(ctx, accountID, expectedVersion, displayName)
  -> WithinTx: 校验账号存在/版本一致 -> model.NormalizeName
  -> repo.UpdateAccount(AccountChanges{DisplayName, UpdatedAt})   // repo.AccountChanges 扩展 DisplayName 字段
  -> bumpAndRevoke（SecurityRevision+1 + 撤销该账号全部 Session，与既有安全变更一致）
  -> auditOperation("iam.accounts.update", ...)
HTTP：PATCH /api/v1/iam/accounts/{id}  body {expectedAccountVersion, displayName}
权限：iam:account:write（复用，不新增键）
```

- `repo.AccountChanges` 需新增 `DisplayName *string` 分支（unit.go:18-25、62-80）；`UpdateAccount` 已有版本化更新骨架，扩展一个字段即可。
- WebUI：AccountsPage 增加「编辑显示名」表单（复用乐观锁 expectedAccountVersion）。

### 3.2 账号归档（REQ-066-002）

决策 D1：**独立 `archived` 列**（推荐）vs 扩展现有 `status` 枚举（'archived'）。推荐独立列，理由：与 `iam_roles`（archived 已有）、organization 部门/岗位的 archived 语义一致；`status` 保留「active/disabled」有限枚举（CHECK 约束），归档是帐号生命周期终态、非可逆状态，不宜与禁用同列。

- 模型：`model.Account` 增 `Archived bool`（model.go:39-47）；`NewAccount` 初值 false；新增 `Assignable()` 语义已存在（model.go:134），归档后 Assignable=false。
- 表结构：三驱动各新增 `000003_alter_iam_accounts_add_archived.up/down.sql`：`ALTER TABLE iam_accounts ADD COLUMN archived INTEGER NOT NULL DEFAULT 0`（sqlite 无需 default 约束注意点：sqlite ADD COLUMN 带 NOT NULL 需提供 DEFAULT，满足）。
- 用例 `ArchiveAccount(ctx, accountID)`：事务内校验——owner 不变量（若该账号持 owner 且 activeOwnerCount<=1 拒绝，复用以 activeOwnerCount 逻辑）；归档置位 + `bumpAndRevoke`（撤销全部 Session、SecurityRevision+1）；`RequireAssignableAccount`（composition/organization.go → iam/facets.go Accounts facet）在归档后自然拒绝组织分配（该实现读 account.Status，需同时检查 Archived）。
- 登录：`Login` 与 `Resolve` 已有 `account.Status != active → ErrAccountDisabled` 判断（service.go:305-308,486），需补充 `account.Archived → 同语义拦截`。
- HTTP：`POST /api/v1/iam/accounts/{id}/archive`，权限 `iam:account:write`。
- WebUI：AccountsPage 增加「归档」按钮（禁用于 owner 最后账号时由服务端 409 语义兜底）。

### 3.3 角色资料更新（REQ-066-003）

```
UpdateRoleInfo(ctx, roleID, expectedVersion, name, description)
  -> TouchRole 已有；扩展为更新 name/description（新 repo 方法 UpdateRoleInfo 或扩展 Unit）
  -> 不 bump 授权 revision（名称是展示字段，不影响授权规则；版本 bump 保持乐观并发）
HTTP：PATCH /api/v1/iam/roles/{id}  权限 iam:role:write
WebUI：RolesPage 增加「编辑角色名/描述」表单
```

注意：角色名称/描述变更**不**改变授权关系，因此不触发授权 revision/不撤销 Session（与 `ReplaceRolePermissions` 区分）；但需 touch role 版本号以维持乐观并发。

### 3.4 角色归档（REQ-066-004）

```
ArchiveRole(ctx, roleID)
  -> owner 角色拒绝（ErrImmutableOwner）
  -> 事务内置 archived=true + bumpAndRevoke 所有已分配账号的 Session/SecurityRevision
     （因为授权关系将从 evaluator 消失，等同授权变更，必须走 authorizeMutation 协议）
  -> 构造候选 evaluator（archived 角色及其 RolePermission 被快照过滤：repo/snapshot_build.go:40,52 已有
     `r.archived = false` 过滤）-> commit 后原子发布
HTTP：POST /api/v1/iam/roles/{id}/archive  权限 iam:role:write
```

- `ArchiveRole` 必须走 `authorizeMutation`（service.go:1016-1047），因为归档移出授权规则 = 授权变更；revision bump、受影响账号 Session 撤销、候选发布全链路复用。
- 归档角色已分配账号（AccountRole active）保留记录但不产生权限（快照过滤已保证）；`ReplaceAccountRoles` 对 archived 角色已在校验中拒绝分配（service.go:844-846）。
- WebUI：RolesPage 增加「归档」按钮（system 角色只读已有）；归档角色在列表中以 archived 标记呈现（Role 类型已有 archived 字段，api.ts:6）。

### 3.5 WebUI 按钮级权限接入（REQ-066-005）

复用 062 已验证机制（ops 已示范），不新增权限键：

- Binding 声明：`internal/module/{iam,organization,navigation}/binding/webui/binding.go` 增加 `ActionPermissions`——映射页面写操作按钮到既有 OperationID（如 `iam.accounts.create`、`iam.accounts.status`、`iam.roles.create`、`iam.roles.permissions.replace`、`organization.departments.create`、`navigation.menus.update` 等）。
- Manifest：`contract.go:451-457` 已把 ActionPermissions 投影为 `manifest.actionPermissions`（从严 access，denied > authentication-required > allowed）；无需宿主改动。
- 页面：AccountsPage/RolesPage/DepartmentsPage/PositionsPage/AssignmentsPage/MenusPage 的写操作按钮从普通 `Button` 换 `ActionTrigger` 并传 `operationId`（`webui/src/ui/index.tsx:208-241`），denied 默认隐藏、可配置禁用；未声明/未投影的 operation 前端不做呈现限制（服务端授权继续 fail closed）——语义不变。
- 已接入的 zone（Ops）不动；`webui-registry.ts` 随 generate 更新。

### 3.6 列表/冲突交互闭环（REQ-066-006）

- **过滤/分页**：`ListAccounts`/`ListRoles` 增可选 `query` 过滤参数（沿用 normalizePage、offset/limit 契约；扩展 repo 层 WHERE 关键字匹配）；HTTP pageInput 增 query；WebUI 列表上方加关键字输入框 + 页码。Organization 部门/岗位列表同法扩展（departments list/positions list）。
- **409 差异确认 UI**：`ReplaceAccountRoles`/`ReplaceRolePermissions` 失败为 409 时（api.ts:26,30 已带 expectedVersion），WebUI 不再「静默 reload 丢弃选择」：改为读取最新 `accountRolesView/rolePermissionsView`，与用户未保存的选项计算 added/removed diff（RolesPage 已有 `diffKeys` 纯函数可复用），弹确认框「服务端已变更：+N −M，是否覆盖」，用户确认后用新版本号重提交。
- **Organization 分配页乐观锁**：`assignments.get`（api.ts:18）返回增加 `version`；`replaceAssignment`（api.ts:19）PUT body 加 `expectedVersion`；服务端 `ReplaceAssignment` 增版本校验（service.go:334-387，冲突→稳定 409）；WebUI 冲突时重新拉取展示。
- 双语 locale：为新增按钮/确认框/过滤字段补齐 en-US/zh-CN。

## 4. 文件影响（估算）

| 文件 | 动作 |
| --- | --- |
| `internal/module/iam/{model,service,repo}/**` | 扩展：Account.Archived/UpdateAccountInfo/ArchiveAccount/UpdateRoleInfo/ArchiveRole/AccountChanges.DisplayName/查询过滤 |
| `internal/module/iam/binding/http/{contract,huma}.go` | 新增 4 个 operation + pageInput query |
| `internal/module/iam/binding/migration/{mysql,postgres,sqlite}/000003_*` | 三驱动 archived 列迁移 + set.go 注册 |
| `internal/module/{iam,organization,navigation}/binding/webui/**` | ActionPermissions 声明 + 页面按钮/过滤/409 UI + locale |
| `internal/module/organization/{model,service,repo,binding/http}/**` | assignment version/乐观锁 + 列表过滤 |
| `internal/permission` 引用校验 | 若 ActionPermissions 引用的 OperationID 需 ValidateReferences 通过（已有机制） |
| `api/`、`internal/transport/http/api/operation_inventory.gen.go` | contract-gen 重新生成 |
| `docs/development/webui.md`、`docs/operations/{security.md,runtime-capabilities.md}`、变更记录 | 同步 |

## 5. 失败语义与边界

- 资料更新/归档：账号不存在→404；版本过期→409 且不静默覆盖（沿用 ErrVersionConflict）；owner 不变量（最后 owner 不可归档）→409/稳定业务错误。
- 归档账号登录/会话：Login/Resolve 对 Archived 与 Disabled 同语义 fail closed；既有 Session 在归档事务内全部撤销。
- 角色归档：owner→ErrImmutableOwner；归档经 authorizeMutation 协议：revision bump 失败或候选构造失败→事务回滚、不发布、不撤销 Session。
- 归档账号/角色的组织分配：`RequireAssignableAccount` 因 Archived 拒绝；已有分配记录保留（Organization 表 assigned 软记录，无跨模块事务承诺）。
- 权限键缺失、WebUI locale 缺失由既有门禁拒绝。

## 6. 验证方案

1. Go：IAM 资料更新/归档（login 拦截、会话撤销、owner 不变量、version 409）、角色归档（revision/候选发布/授权失效）、过滤分页、organization 分配 409 测试；`go test ./...`、`go vet ./...`。
2. WebUI：`pnpm generate:check`（registry/ActionPermissions 同步）、lint、typecheck、Vitest（按钮显隐断言、409 差异确认、过滤分页、双语）、Playwright dev+mock。
3. 三驱动 migration up/down 幂等测试；`api/openapi.yaml` diff 稳定。
4. 文档：docs-guard、documentation-impact.yaml、变更记录。
5. 人工复核：归档/禁用/删除三态在 UI 上可区分；无明文 SessionID 或敏感日志。

## 7. 待确认决策

- 决策 1（推荐）：账号归档用独立 `archived` 列（三驱动 000003 迁移），与角色/部门/岗位语义一致；不做物理删除/恢复。
- 决策 2（推荐）：角色名称/描述更新不触发授权 revision/不撤销 Session（授权关系未变），仅 touch 版本维持乐观并发；角色归档触发完整授权发布链路。
- 决策 3（推荐）：账号/角色归档为终态不提供恢复；恢复流程（如需）另行立项。
- 决策 4（推荐）：WebUI 按钮接入复用既有 `ActionPermissions`/`ActionTrigger`，不新增权限键、不改变授权语义；`export` 等独立按钮键若有真实用例另行立项。
- 决策 5（推荐）：列表过滤用可选 `query` 参数扩展既有分页契约；409 差异确认 UI 由页面 owner 实现（复用 diffKeys），宿主零改动。