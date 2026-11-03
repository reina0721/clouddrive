# R076-001 研究报告：RBAC / HTTP API 未闭环缺口核实

## 1. 研究问题

当前 IAM RBAC 管理面与 HTTP API 相对「可运营闭环」存在五类缺口（本任务立项对话的审计结论）：

1. **Gap1** Organization 模块是否真的无法经默认托管模式（WebUI Session）到达——operation security profile 与运行期 gate 来源映射的一致性；
2. **Gap2** 角色/权限是否缺少反向查询（role→accounts、permission→roles）及底层查询现状；
3. **Gap3** 会话列表接口是否无分页/无条件过滤；
4. **Gap4** 账号列表过滤是否仅关键字；
5. **Gap5** 密码策略是否硬编码、配置化改动面。

回答方式：以代码证据核实事实，区分「可直接补齐」与「需边界突破/非目标」，给出每项推荐路径与不采纳项。

## 2. 事实（代码证据，快照 commit `3505352`）

### 2.1 Gap1：org 认证断点是真实运行断点

- **org 全部 operation 声明 `bearerAuth`**：`internal/module/organization/binding/http/huma.go:139-144` 的 `organizationOperation`/`organizationJSONOperation` 固定 `Security: humabinding.SecurityBearer, Policy: humabinding.PolicyProtected`，覆盖 departments/positions/assignments 全部读与写 operation。
- **gate 对 `bearerAuth` 只映射 Bearer 来源**：`internal/composition/http_api.go:24-29` 的 `newOperationGate` 把 `humabinding.SecurityBearer → bearerSource`、`humabinding.SecurityWebUISession → sessionSource`；`bearerSource`（`internal/module/auth/middleware/http.go:64-77`）只解析 `Authorization: Bearer` 头或 development principal，**不读 Session Cookie**。
- **默认托管模式（模式 B）只有 Session Cookie**：`internal/composition/iam.go:28-47` 的 `iamSessionAuthAdapter.AuthenticateRequest` 从 `__Host-community-go_iam_session` Cookie 解析会话并构造 `iam-rbac` Principal。README 默认 `webui.hosting.enabled: true`（060/061 引入的单进程托管模式）。
- **前端请求不带 Bearer**：org 页面 `internal/module/organization/binding/webui/web/api.ts` 全部经 `@webui/sdk/http` 的 `requestJSON` 调用 `/api/v1/organization/*`；`webui/src/contracts/index.tsx:105-125` 的 `requestJSON`/`requestText` 只 `credentials: "include"`（携带同源 Cookie），不注入 `Authorization` 头。
- **结论**：默认部署（IAM 本地 Session + 模式 B）下，org 页面真实 API 请求 → gate 选择 bearer 来源 → 无 Bearer 头 → `ErrUnauthenticated` → 401。**org 页面在真实模式下不可用（仅 mock/分离开发模式可演示）**，与 `docs/getting-started/webui.md:134` 宣称的 owner 可访问 `/admin/departments` 等页面冲突。Gap1 成立且优先级最高。
- **org mutation 无 CSRF/Origin 中间件**：`internal/module/organization/binding/http/huma.go` 无任何 `Middlewares`/`requireMutation`/`Origin`/`CSRF` 引用；对比 `internal/module/navigation/binding/http/huma.go:37` 的 mutation 经 composition 注入的 `mutationGuard`（`iamMutationGuardAdapter`，`internal/composition/iam.go:77-95`）做 Origin + CSRF 校验；IAM 自身 mutation 经 `requireMutation`（`internal/module/iam/binding/http/huma.go:449-457`）。**迁移 webuiSession 后 org mutation 必须同步接入 mutation 守卫**（bearer 场景 CSRF 无意义，session 场景必须）。
- **前端 mutation 头缺失**：`iam/binding/webui/web/api.ts:12-15` 演示了正确模式——`mutationHeaders()` = `Origin` + `X-CSRF-Token`（csrfToken 来自 session 响应）；org `api.ts` 的 create/update/replace 均未携带这些头，迁移时需对齐。
- 对照证据：IAM/Navigation/Auth/Todo 的 operation 均用 `webuiSession`（`api/openapi.yaml` 中仅 org 路径挂 `bearerAuth`）。

### 2.2 Gap2：反向查询

- **role→accounts 底层查询已存在**：`internal/module/iam/repo/unit.go:244` `ListAccountRolesByRole(ctx, id)` 已实现；但 service 无对应快照方法、HTTP 无端点（现有 `AccountRolesSnapshot` 只覆盖 account→roles，`service.go:1030-1054`）。
- **permission→roles 无现成方法**：`repo/unit.go:280` `ListActiveRolePermissions(ctx)` 返回全量 active 关系，可按 key 过滤；或新增 `ListRolePermissionsByKey(ctx, key, activeOnly)`。service/HTTP 均无该查询。
- **既有权限键可复用**：`iam:role:read`（角色读）、`iam:permission:read`（权限目录读）语义已覆盖「查看关系」；`docs/operations/security.md` 无反向查询边界；066 明确「不新增权限键」为本项目稳定边界，反向查询不应新增键。
- 结论：Gap2 成立，改动面为 repo（可选新增按 key 查询）+ service 快照 + 两个只读 GET 端点；不触碰授权 authority。

### 2.3 Gap3：会话列表分页

- `internal/module/iam/repo/unit.go:329-335` `ListSessionsByAccount` 无 offset/limit/count，按 `created_at DESC, id_hash ASC` 全量返回。
- `internal/module/iam/binding/http/huma.go:277-300` `GET /api/v1/iam/sessions` 直接返回全部、响应分页字段为伪值（`Offset: 0, Limit: len(items)`）。
- `normalizePage`（`service.go:1517`）与 `pageInput`（offset/limit/query，`huma.go:35-39`）已有可复用语义；accounts/roles 列表已是同样契约。
- 结论：Gap3 成立；改动面 repo 分页查询 + service 分页/状态过滤（active/revoked/all）+ HTTP 契约；保持低敏（IDHash）语义。

### 2.4 Gap4：账号列表过滤

- `internal/module/iam/repo/unit.go:74-85` 与 `CountAccountsMatching`（40-51）仅支持 `username/display_name LIKE`；HTTP `pageInput`（`huma.go:35-39`）无 status/archived/roleId 过滤参数。
- 对照：accounts 有 `Status`（active/disabled）与 `Archived` 列（066 迁移 000003）；角色过滤需 join `iam_account_roles`（active 关系）。
- 结论：Gap4 成立；改动面 repo Count/List 扩展过滤参数 + service 透传 + HTTP 契约。

### 2.5 Gap5：密码策略配置

- `internal/module/iam/model/model.go:17-18` 硬编码 `MinPasswordRunes = 15`、`MaxPasswordRunes = 128`；`ValidatePassword`（95-101）为包级函数，调用点 `service.go:225`（Setup）、`569`（ChangePassword）、`604`（ResetPassword）、`631`（CreateAccount）。
- `internal/module/iam/binding/config/config.go` 已有 `Local` 安全预算配置先例（IdleTimeout/AbsoluteTimeout/MaxFailedAttempts/LockDuration），`Decode` 有校验（37-39），`Default()` 提供默认值，defaults 输出进 config init 模板；`service.Config`（`service.go:207-218`）在构造时校验并存于 Service。
- 结论：Gap5 成立；改动面 configbinding.Local 增密码策略字段（min/max + 可选复杂度开关）+ `Decode` 校验 + `service.Config` 携带 + `model` 提供参数化校验（兼容既有 `ValidatePassword`）+ 4 处调用迁移 + config init/示例同步。**复杂度开关必须默认关闭**（存量账号密码按 15 位规则创建，默认开启复杂约束会立即中断存量登录/改密），且新策略只约束「创建/重置/修改密码」路径，不事后重验存量哈希。

## 3. 推断与方案对比

| 缺口 | 推荐（采纳） | 不采纳 |
| --- | --- | --- |
| G1 | **A：org operation 单轨迁移 `webuiSession`**，mutation 经 composition 注入的 `iamMutationGuardAdapter`（对齐 navigation 先例），org 前端 mutation 补 Origin + X-CSRF-Token；api/openapi.yaml 随 contract-gen 重生成；授权语义/权限键不变 | B：保留 bearerAuth 并扩展 gate 支持双 security profile——需扩展 humabinding 契约/gate/生成器/OpenAPI 多 security 语义，且当前无 Bearer 机器访问 org 的真实消费方，成本高、破坏「单个 security profile」契约简洁性 |
| G2 | **A：复用既有 repo 查询 + 新增只读 GET**：`GET /api/v1/iam/roles/{id}/accounts`（iam:role:read）、`GET /api/v1/iam/permissions/roles?key=…`（iam:permission:read，key 含冒号故用 query 参数）；分页复用契约 | B：新增独立权限键（如 `iam:role:members:read`）——无真实需求、违反「不新增权限键」稳定边界；C：全量返回不落地分页——数据量不可控 |
| G3 | **A：repo 分页 + service offset/limit/status 过滤**（active/revoked/all），复用 `normalizePage` + `pageInput`，响应真实 total | B：维持全量返回由前端过滤——会话数不可控、契约伪分页不可接受 |
| G4 | **A：repo 过滤参数扩展**（status/archived/roleId join active 关系）+ HTTP query 参数 + Count/List 同语义 | B：任意 SQL 过滤参数透传——不安全、破坏 typed 契约；C：仅前端过滤——数据量不可控 |
| G5 | **A：configbinding.Local 增密码策略**（minLength/maxLength 默认 15/128，复杂度开关默认 false）+ `Decode` 校验 + `service.Config` + model 参数化校验 + 4 调用点迁移 + config init 同步 | B：每次校验从配置/DB 读取——无必要开销且破坏 Service 构造即冻结语义；C：默认开启复杂度——破坏存量账号兼容 |

## 4. 适用 / 不适用场景

- 适用：当前单实例、本地账号、静态模块集合的 IAM RBAC 管理面；org/navigation/iam 同构的 WebUI Session 认证；需要角色/权限影响分析的运维场景。
- 不适用（保持候选/非目标，延续 058/064/066）：多实例一致性验证、MFA/外部身份（OIDC/SSO/LDAP）、数据权限（部门数据范围）、角色继承/deny/SoD/domain、自助找回密码、登录 IP 级限流、行为审计 diff（before/after 权限集合）、物理删除/恢复。

## 5. 局限

- Gap1 的「org 页面真实模式不可用」依据代码路径推演；未在本机以托管模式实际点击验证（本任务为只读研究，未启动服务）。建议实施阶段以模式 B 真实 e2e 验收闭合。
- 会话「active」过滤语义依赖 `revoked_at IS NULL` 且未过 idle/absolute 过期判断；「expired」类目建议并入 revoked 或明确标注为截止到查询时刻的定义。
- password 策略值域（复杂度开关的规则集）未在本次研究内细化，留待计划确认后按「最小可闭环」落地（先 min/max，复杂度开关是否保留需用户定夺）。

## 6. 对本任务的影响

研究门禁结论：五类缺口均为「既有模块边界内可直接补齐」，无边界突破项进入本批；Gap1 优先级最高且必须连带 mutation 守卫与前端 CSRF 头；G2-G4 为只读查询/分页/过滤扩展，不新增权限键、不触碰授权 authority；G5 需用户确认范围（是否含复杂度开关）。可进入计划阶段。