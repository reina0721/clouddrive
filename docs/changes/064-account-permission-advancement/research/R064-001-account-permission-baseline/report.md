# R064-001 账号与权限体系当前能力边界、已知缺口与进阶候选方向

## 1. 研究问题

用户要求“对当前账号与权限体系进阶设计”。回答（a）当前体系真实能力边界；（b）既有研究与代码已标记的缺口/未来项；（c）进阶候选方向各自的适用性、耦合面与验证路径，为形成 064 计划提供事实基础。

## 2. 方法与范围

- 只读检查 `internal/module/iam/**`、`internal/module/auth/**`、`internal/permission/catalog.go`、`internal/module/organization/**`、Navigation 菜单策略、WebUI 权限呈现（062/063 已确认），快照 commit `e059a1638ab88b2ee0664931d7272b5c4ed11e76`。
- 检索并复核 `053/R001-R005`、`054/R001`、`055/R001`、`056/R001`、`057/R002`、`058/R001-R003` 与 `022/R006` 的适用/不适用判定与刷新触发器。
- 不修改实现；不启动服务；不执行浏览器验收。

## 3. 证据：当前能力边界（有代码证据）

### 3.1 IAM：身份、凭据、会话与 Core RBAC（054/058 已闭环）

- 账号：`Account{ID,Username,DisplayName,Status,MustChangePassword,SecurityRevision,FailedAttempts,LockedUntil,Version,...}`；状态仅 active/disabled；用户名/名称/密码长度（15–128 runes）校验。
- 凭据：单密码 Argon2id（`adapter/password`），`Hash/Verify` + `NeedsRehash`；无第二因子、无找回渠道、无凭据历史。
- 会话：有状态 Session（服务端持有），Cookie + CSRF，`IdleTimeout/AbsoluteTimeout`，`MaxFailedAttempts/LockDuration`（config `iam.local`）；安全变更（密码/角色/权限/状态）通过 `bumpAndRevoke` 撤销受影响账号全部 Session；`SecurityRevision` 绑定 Session。
- 授权：Core RBAC 经 Casbin evaluator（058）——固定 model（`r=sub,obj`、`g` 分组、`p` 精确权限），Snapshot→Evaluator 原子发布，`authorization revision` 驱动；`AuthorizationPublisher` 把 mutation 事务、commit、publish 串行化；`ProjectPermissions` 只用于 Session/WebUI 投影，服务端逐 operation `Decide`。
- 关系维护：`ReplaceAccountRoles` / `ReplaceRolePermissions` 使用 expected version + 全量集合替换 + diff 计数 + 事务内 revision bump；owner 角色不可编辑、owner 不变量（至少一个 active owner）。
- HTTP：setup/login/session/logout/self-password/accounts CRUD+status+reset/roles CRUD/account-roles replace/role-permissions replace/permissions list；`webuiSession`/`bearerAuth`/`none` profile。
- 审计：Auth 层 `AuditSink` 目前只有 `adapter/audit/logger`（低敏结构化日志，无查询/读取 API、无保留策略）。

### 3.2 Auth：Principal、operation policy、DecisionPoint

- `Principal` 双来源：`token-scopes`（Bearer/JWT、CLI、development）与 `iam-rbac`（注入 DecisionPoint，revision 非零）。
- `Policy{Operation,Mode,Scope,Action}`：public/protected；`EnforceOperation`（operation 级）+ `EnforceAction`（action 级 + `ResourceFacts`，仅支持 owner 匹配，无对象级数据范围语义）。
- 审计事件只含低基数分类（decision/outcome/reason + subject_hash/resource_hash），Sink 负责脱敏；无审计查询入口。

### 3.3 Organization：组织目录（055）

- 部门（无环树、深度上限 8）、岗位（扁平）、账号组织分配（一个主部门 + 多岗位）；**组织关系不进入授权决策**（055 明确边界）。
- `RequireAssignableAccount` 只做账号可分配校验；无“部门数据范围”概念。

### 3.4 Navigation：菜单策略（056）

- 只管理已注册 NavigationID 的 enabled/parent/order；不建第二套授权。064 不改变该边界。

### 3.5 Permission Catalog 与 WebUI 权限呈现

- Catalog：精确 Key（无通配符）、owner 模块、description message ID；`ValidateReferences` 校验 operation/route/zone 引用。
- WebUI：route 级 `ViewOperationID`（access 投影）+ zone 级 `OperationID`（actionPermissions，062）+ 菜单层级分类（063）均只做呈现控制，不构成授权。

## 4. 已标记缺口 / 未来项（既有研究判定）

| 方向 | 既有判定来源 | 状态 |
| --- | --- | --- |
| 部门数据权限（组织范围进入授权） | 053/R005 refresh、055/R001 non-applicable | 明确“不自动获得数据范围”，需新需求授权 |
| 角色层级/继承/deny/ABAC | 053/R002 refresh、057/R002 | “当前精确 operation 权限不引入”，有真实需求再评估 |
| 可查询审计（存储+查询 API+保留） | 022/R006 语境 | 当前只有日志 sink，无查询闭环 |
| MFA/TOTP、凭据历史、找回 | 054/R001 未覆盖 | 缺口（安全预算只含密码/锁定/过期） |
| 对象级/资源级数据授权（ResourceFacts 扩展） | Auth model 仅 owner 匹配 | 缺口 |
| 外部身份（OIDC/SSO/服务账号 API Key） | 057/R002 候选清单 | “按真实需求选择”，首发非目标 |
| 多租户 | 053/057 | 明确非目标 |

## 5. 事实与推断的区分

**事实**：上述能力边界与缺口都有代码/研究档案证据；审计无查询 API；组织关系不进授权；Casbin 固定 Core RBAC；Session 撤销与 revision 机制已闭环。

**推断（需计划确认）**：
- “账号与权限体系进阶”的合理范围应优先落在「真实缺口 + 模块边界内可验证」的项目上：密码/会话安全策略增强（MFA/TOTP、凭据策略）、可查询审计、数据权限或资源级授权是用户价值最高的三个候选簇；外部身份/多租户/ABAC 属更大平台演化，不应在首发前无授权扩界。
- MFA 会触碰凭据模型与 Session 校验链（登录、CSRF、撤销、CLI/development profile），耦合面大，需要独立设计与高覆盖测试。
- 可查询审计需要新的存储模型与读取权限键，不能只用日志。
- 数据权限会让 Organization 关系首次进入授权决策，属于 055 边界突破，必须单独确认范围。

## 6. 适用与不适用场景

- 适用：MFA/TOTP 与凭据策略增强；会话集中管理（列表/批量吊销）；可查询低敏审计；明确限定的数据权限/资源级授权；配套 WebUI 呈现与权限投影。
- 不适用：多租户、SSO/OIDC 首发、微服务拆分、运行时动态权限模型、把前端权限冒充授权、无收益扩界。

## 7. 局限与剩余未知

- 未执行浏览器验收与真实负载；MFA 的 UX（绑定/恢复码/降级）与恢复流程需要在计划中定义。
- 审计查询的保留策略、容量与脱敏边界需设计确认；Casbin 行为扩展（若有）须重新研究。
- 既有 `navigation_menu_policies` 与本地数据库当前为空（062 后确认），064 数据迁移影响需按采用的方案单独评估。

## 8. 对本任务的影响

- 结论：当前体系闭合度高；进阶应像 053-058 一样按“真实缺口 + 单一 owner + 可验证闭环”分批推进，不一次性引入外部身份/多租户/ABAC。
- 研究门禁：事实与候选方向证据充分，足以形成计划；最终范围由用户在计划阶段决策。