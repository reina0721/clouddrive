# R066-001 账号与权限体系闭环缺口核实：账号/角色生命周期、按钮级显隐、列表体验与数据权限边界

## 1. 研究问题

用户要求验证当前系统「账号与权限体系」相关模块及 WebUI 交互设计是否构成（或更完善地构成）四要素闭环——用户管理、角色管理、菜单与权限管理、部门与岗位管理——并在未实现时给出补齐方案。本档案回答：(a) 逐项缺口的事实与证据；(b) 各缺口的模块归属与实现边界（IAM/Organization 边界内可直接补齐 vs 需边界突破/独立确认）；(c) 补齐候选路径，为 066 计划提供事实基础。

## 2. 方法与范围

- 只读检查 `internal/module/iam/**`、`internal/module/auth/**`、`internal/module/organization/**`、`internal/module/navigation/**`、`internal/permission/catalog.go`、`internal/webui/contract.go`、`internal/composition/webui_http.go`、各模块 `binding/webui/web/*.tsx`、`api/openapi.yaml`；三份并行子代理核实后端 IAM、Organization/Navigation、WebUI 交互，结论与本档案证据交叉一致。
- 快照 commit `a5f02db`（2026-08-25 验证）；工作树无未提交修改。
- 不修改实现；不启动服务；不执行浏览器验收；不创建变更目录（本任务只读验证阶段 → 066 由用户明确要求后建立）。

## 3. 证据：四要素逐项核实

### 3.1 用户管理 —— ≈85% 闭合

| 要素 | 状态 | 证据 |
| --- | --- | --- |
| 增 | ✅ | `iam/service/service.go:610-636` `CreateAccount`；HTTP `POST /api/v1/iam/accounts`（`binding/http/huma.go:251-260`） |
| 查 | ✅ | `ListAccounts`（service.go:637-658）分页 |
| 改（仅状态） | ✅/❌ | `SetAccountStatus`（service.go:678-714）可启停；**无改名/资料更新**（DisplayName 仅创建时写入，model.go:96-113） |
| 删 | ❌ | 全仓无 DeleteAccount；无软删/归档；无 deleted_at 列（migration mysql 000001 up.sql） |
| 启用/禁用 | ✅ | 同上；owner 最后账号不可禁用（service.go:694-706） |
| 重置密码 | ✅ | HTTP + CLI 双入口（service.go:586-608；binding/cli/commands.go:25-43）；置首次改密 + 撤销 Session |
| 分配角色 | ✅ | `ReplaceAccountRoles` 全量替换 + expectedVersion 乐观锁（service.go:815-907），409 冲突（contract.go:182-183） |
| 分配部门/岗位 | ✅ | Organization `replaceAssignment`（独立模块） |

**缺口 A**：账号「改」（改名/资料）与「删」（无任何删除/归档入口）。

### 3.2 角色管理 —— ≈60% 闭合

| 要素 | 状态 | 证据 |
| --- | --- | --- |
| 角色创建/列表 | ✅ | `CreateRole`/`ListRoles`（service.go:716-752） |
| 角色绑定权限键 | ✅ | 按模块分组 checkbox 矩阵（RolesPage.tsx:11-19,75）；Catalog 校验（service.go:914-918） |
| 用户分配角色 | ✅ | `ReplaceAccountRoles`（service.go:815-907） |
| owner 系统角色 | ✅ | 不可编辑（service.go:925-927）；`ReconcileOwnerCatalog` 自动补键（409-466） |
| 角色改/删/归档 | ❌ | 模型有 Active/Archived/System（model.go:49-54）但无任何 service 方法改写 archived；无 UpdateRole/ArchiveRole |
| 角色绑定菜单 | ❌ | 无 role_menu；菜单可见性 = 全局导航策略 × 当前主体 operation access（contract.go:406-434），非角色维度 |
| 角色绑定数据权限 | ❌ | 全仓无 data scope/row-level/tenant 概念 |

**缺口 B**：角色「改/删/归档」缺失（字段已备，缺 service+HTTP+UI）。

### 3.3 菜单与权限管理 —— 机制具备，粒度未细分

| 要素 | 状态 | 证据 |
| --- | --- | --- |
| 已注册菜单启停/父级/排序 | ✅ | `navigation/service/service.go:110-172`；MenusPage |
| 按主体权限过滤侧边栏 | ✅ | manifest 投影 route access 由 `EnforceOperation` 判定（webui_http.go:25-43）→ 菜单仅 access allowed 时投影（contract.go:406-434）→ 前端 `access==="allowed"` 过滤（AppShell.tsx:45-47） |
| 页面按钮权限显隐机制 | ✅ 存在 | `ActionTrigger`/`useActionAccess`（webui/src/ui/index.tsx:208-241、sdk/zone/index.tsx:43-50）；Manifest actionPermissions（contract.go:451-457） |
| 该机制在管理页接入 | ❌ | 仅 ops 模块 3 处（HeaderAction/CapabilitiesPage/FooterStatus）；iam/org/navigation 页面按钮均为无 operationId 的普通 Button |
| 按钮级独立权限键 | ❌ | 无「新增/导出/删除」独立键；写操作聚合为粗粒度写键（`iam:account:write` 覆盖 create/status/reset/roles/revoke） |
| 动态创建菜单/按钮/路由 | ❌ | 数据库不存 route/component/role_menu；只能管理代码已注册菜单（056 非目标） |

**缺口 C**：按钮级显隐机制未在权限管理页接入；无「导出」等独立键（如需）。

### 3.4 部门与岗位管理 —— 目录完整，数据权限 0%

| 要素 | 状态 | 证据 |
| --- | --- | --- |
| 部门树 | ✅ | parent_id 无环树、深度 8 上限（model.go:30-36,13-16；service.go:389-416）；tree API + WebUI 递归展平 |
| 岗位平面目录 | ✅ | create/list/update+归档（括号级） |
| 用户-部门/岗位关联 | ✅ | 单部门+多岗位（AssignmentsPage/api.ts:19） |
| 数据权限（部门数据范围） | ❌ 完全缺失 | `AuthorizationRequest` 仅 Subject/Permission/Revision/Restricted（authorization/runtime.go:38-48）；全仓无 DataScope |

**缺口 D**：数据权限（部门/岗位数据范围）——最大缺口，但 055/064 明确「不自动获得数据范围、属重大边界突破，须单独确认」。

## 4. 事实与推断

**事实（有代码/研究证据）**：核心 Core RBAC 闭环完整（Catalog 19 键 → 角色 → 账号 → Casbin 两字段求值 → revision 失效 → Session 撤销 → WebUI access 投影），文档声称与代码逐条一致；账号/角色删除与改名、按钮级细分、数据权限、菜单-角色绑定均未实现，且多为有文档支撑的边界。

**推断（需计划确认）**：
- 账号「改/删归档」、角色「改/删归档」属于 IAM 模块边界内的自然延伸，不触碰授权模型与 Casbin 边界，周期短、可独立验证，应为 066 首批。
- WebUI 按钮级显隐可用既有 `ActionPermissions`/`ActionTrigger` 机制补齐（ops 已示范），无需新增权限键、不改变授权语义，属 IAM/Organization/Navigation 页面 owner 工作。
- 列表查询/过滤/分页、409 差异确认 UI、分配页乐观锁、部门树控件为体验缺口，独立于授权语义。
- 数据权限是 055/064 明确登记的下一批重大候选，必须单独研究范围与决策模型（最小闭环建议：本人/本部门/本部门及子部门/全部，四级 scope；Casbin 两字段保持不动，scope 在业务侧二次判定）；066 不实施。
- 角色-菜单显式绑定、动态菜单/按钮/路由与 056/058 边界冲突，需产品决策，066 不实施。

## 5. 适用与不适用场景

- 适用：账号/角色生命周期补齐（改/归档）；WebUI 按钮级权限接入与列表体验；409/乐观锁 UI 闭环；明确限定的数据权限立项（独立任务）。
- 不适用：多租户、OIDC/SSO、ABAC/ReBAC、role_menu 表、运行时动态权限键、把前端呈现冒充服务端授权、无收益扩界。

## 6. 局限与剩余未知

- 未执行浏览器验收；账号归档的语义细节（登录拦截、组织分配引用、会话撤销、owner 不变量扩展）需设计确认。
- 角色归档后既有 AccountRole 记录与审计历史的呈现需设计确认（推荐保留记录、从 evaluator 可见性移除）。
- iam_accounts 是否新增 archived 列（三驱动迁移）vs 复用 status 枚举扩展，二者取舍需设计确认（推荐独立 archived 列，与 Role/Department/Position 语义一致）。

## 7. 对本任务的影响

- 结论：066 首批 = 缺口 A/B（IAM 生命周期）+ 缺口 C 的按钮级机制接入 + 列表/冲突体验；缺口 D 与菜单-角色绑定列入候选方向（仅记录，不实施）。
- 研究门禁：事实与候选路径证据充分，足以形成计划；最终范围与决策由用户在计划阶段确认。