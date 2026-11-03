# 058 Casbin RBAC 注入需求

## 1. 产品目标

用成熟的 Apache Casbin evaluator 单轨替换当前 IAM 权限展开与 Auth 本地 RBAC集合判断，同时保持现有账号/角色/权限管理体验、精确 PermissionKey、owner、Session 安全和默认拒绝行为。

## 2. 功能要求

### 2.1 authority 与第三方边界

| ID | 要求 |
| --- | --- |
| `RBAC-REQ-001` | IAM Account、Role、AccountRole、RolePermission、Session 与 Permission Catalog 必须继续是唯一业务和持久化 authority；不得增加 `casbin_rule`、第二套角色表或双写。 |
| `RBAC-REQ-002` | 必须采用稳定 `github.com/casbin/casbin/v3 v3.10.0`；Casbin 类型只能出现在 IAM module-owned Adapter 内。 |
| `RBAC-REQ-003` | Casbin 只执行固定 Core RBAC exact-key evaluation；禁止 hierarchy、domain、deny、wildcard、ABAC、ReBAC、superuser 与任意 matcher 配置。 |
| `RBAC-REQ-004` | 不使用 Casbin GORM Adapter、AutoSave、AutoLoad、Watcher、Dispatcher、CachedEnforcer 或 Explain/AI API。 |

### 2.2 中介与注入

| ID | 要求 |
| --- | --- |
| `RBAC-REQ-005` | Auth 必须定义消费方拥有的窄 `DecisionPoint` port，输入输出只含项目 Principal/Subject、PermissionKey、revision、Decision 与可识别错误。 |
| `RBAC-REQ-006` | composition 必须是 IAM RBAC evaluator 与 Auth port 的唯一连接点；IAM 不 import Auth，Auth 不 import IAM，HTTP/Huma 不 import Casbin。 |
| `RBAC-REQ-007` | request context 只携带已验证 Principal 与 authorization revision；禁止注入 Enforcer、Service、Repository、Container 或任意 resolver。 |
| `RBAC-REQ-008` | `internal/kernel/app.Binding` 不扩展为业务模块注册或运行时解析；IAM/Auth 继续显式构造。 |

### 2.3 Principal 与 decision

| ID | 要求 |
| --- | --- |
| `RBAC-REQ-009` | Principal 必须区分 `token-scopes` 与 `iam-rbac` 授权来源；未知或冲突来源构造失败。 |
| `RBAC-REQ-010` | Bearer/CLI/development 的精确 Scope 语义保持不变；IAM Session 不再通过填充 `Principal.Scopes` 冒充 token scope。 |
| `RBAC-REQ-011` | IAM RBAC operation/action 必须经 DecisionPoint 调用 Casbin；缺失 policy、未知 permission、无角色、inactive/archived role、错误或取消都 fail closed。 |
| `RBAC-REQ-012` | 资源 owner 约束继续由 Auth action policy 在 RBAC allow 后执行；Casbin 不接管业务 ResourceFacts。 |

### 2.4 policy snapshot 与一致性

| ID | 要求 |
| --- | --- |
| `RBAC-REQ-013` | IAM Repository 必须按稳定顺序产生只含 active AccountRole 与 active/non-archived RolePermission 的项目 `PolicySnapshot`，并校验所有 PermissionKey 属于 Catalog。 |
| `RBAC-REQ-014` | schema 必须提供 authorization revision；所有影响授权结果的 mutation 在同一事务中更新关系、账号安全状态/Session、revision 与 candidate snapshot。 |
| `RBAC-REQ-015` | candidate Casbin evaluator 必须在 transaction commit 前完整构造；commit 后只做不会失败的原子发布。 |
| `RBAC-REQ-016` | Principal revision 与 evaluator revision 不一致时必须在 caller context 下同步、合并刷新；刷新失败、取消或刷新后仍不一致不得使用旧 evaluator 放行。 |
| `RBAC-REQ-017` | Application Generation Prepare 必须在 listener 前加载并验证当前 evaluator；旧、新 Generation 并存时通过共享数据库 revision 检测 stale snapshot。 |

### 2.5 单轨替换与诊断

| ID | 要求 |
| --- | --- |
| `RBAC-REQ-018` | 完成后删除 IAM `permissionsFor`、IAM Session 到 Scope 的本地 RBAC转换和 Auth 对 IAM Principal 的 `HasScope` 旧路径，不保留 flag/fallback/alias。 |
| `RBAC-REQ-019` | authorization 日志/审计只记录受控 operation、结果、reason、revision 类别和关联 ID；不得记录完整 policy、角色集合、Permission 集合、token、Cookie、账号原始输入或 Casbin matcher 细节。 |
| `RBAC-REQ-020` | Casbin error、数据库 refresh error、ctx cancellation/deadline 和业务 deny 必须可区分并保留错误链；只有 Auth decision 边界记录一次。 |

### 2.6 动态权限分配

| ID | 要求 |
| --- | --- |
| `RBAC-REQ-021` | 运行时必须支持创建自定义 Role、替换 AccountRole 集合和替换 RolePermission 集合；PermissionKey 定义仍由业务模块代码注册。 |
| `RBAC-REQ-022` | 禁止运行时创建任意 PermissionKey、修改 Casbin model/matcher、按 URL/Menu/Button 生成后端 policy，或通过账号直授权建立第二条来源。 |
| `RBAC-REQ-023` | 角色权限读取必须返回 role version、authorization revision 与当前 PermissionKey 集合；账号角色读取返回等价 account version/revision/RoleID 集合。 |
| `RBAC-REQ-024` | 关系 mutation 必须提交完整期望集合和 expected entity version；版本冲突返回稳定 409，不静默覆盖或自动 merge。 |
| `RBAC-REQ-025` | Service 必须在写入前完成去重、Catalog/Role 状态校验，并在 transaction 内计算 added/removed/unchanged diff；no-op 不 bump revision、不撤销 Session。 |
| `RBAC-REQ-026` | 有效 mutation 必须原子更新关系、target version、受影响账号 SecurityRevision/Session、authorization revision 与 candidate evaluator；不得逐项调用 Casbin Management API。 |
| `RBAC-REQ-027` | 角色权限 WebUI 必须由 Permission Catalog 生成按 owner module 分组的选择矩阵，删除自由文本 PermissionKey 写入；system owner 只读。 |
| `RBAC-REQ-028` | 账号角色 WebUI 必须使用 active/non-archived Role checklist；不提供账号直授权、条件授权、生效时间或审批流。 |
| `RBAC-REQ-029` | 动态分配审计只记录 actor、target 摘要、version、added/removed count、result 与 revision，不记录完整关系集合或请求 body。 |

### 2.7 分级装配与 composition 瘦身

| ID | 要求 |
| --- | --- |
| `RBAC-REQ-030` | 根 Generation composition 只编排平台资源、模块切片、完成品聚合与生命周期；不得 import Casbin Adapter 或逐项注入 PolicySource、EvaluatorFactory、revision store/refresher。 |
| `RBAC-REQ-031` | IAM `module.go` 必须作为 module-local composition root，内部构造 Repository、Password/Casbin Adapter、PolicySnapshot、AuthorizationRuntime、Service 与 Handler。 |
| `RBAC-REQ-032` | 必须建立有边界的 identity-access 子装配，只连接 IAM Session/Authorization facet、Auth SessionSource/DecisionPoint、OperationGate 与 MutationGuard；不得扩展成全应用 Builder/Context。 |
| `RBAC-REQ-033` | IAM Module 不再向根 composition 暴露完整 `*service.Service`；必须按真实消费者输出 SessionResolver、Authorization、AccountDirectory、MutationGuard 等项目自有窄 facet。 |
| `RBAC-REQ-034` | 禁止以万能依赖对象、自动扫描、`init` Registry、反射 Resolve、`map[string]any` 或通用 Contribution 替代显式分级装配。 |

## 3. 验收标准

1. owner、普通角色、多角色合并、无角色、inactive/archived role、未知 PermissionKey 的 allow/deny 与当前业务语义一致。
2. 角色权限或账号角色变更后，旧 Session 失效；任何 stale evaluator 在 revision 不一致时不会放行。
3. IAM Session 的 protected operation 实际调用 Casbin evaluator；测试能证明绕过 DecisionPoint 会失败，不能只检查最终 200/403。
4. Bearer/JWT、CLI/development Scope 路径保持精确授权，不读取 IAM 数据。
5. Auth、HTTP、业务 Handler 和 WebUI 的 package graph 中不存在 Casbin import；IAM 与 Auth 仍无直接互相 import。
6. SQLite runtime 验证 setup -> role -> account -> login -> allow -> revoke -> deny；Postgres/MySQL migration/repository contract 通过。
7. Generation reload 与并发 role mutation 测试证明旧、新 Generation 可以检测 revision 漂移并 fail closed。
8. `go test ./...`、`go test -race ./...`、`go vet ./...`、build、generate、docs、`govulncheck ./...` 与旧符号/第二套存储残留搜索通过。
9. 两个管理员并发编辑同一角色或账号关系时，一个成功、一个稳定 409；no-op 不改变 revision，Catalog 外 key 在任何写入前失败。
10. WebUI 只能从 Catalog 选择 PermissionKey；角色权限增删和账号角色增删在重新认证后即时反映到服务端 operation allow/deny。
11. 根 composition 无 Casbin import、无 IAM Service 穿透；identity-access 与 IAM module-local composition 的依赖方向由 architecture test 固定。

## 4. 非目标

- 不拆分新的顶层 `internal/module/rbac`；IAM 内部可以按职责增加 authorization/adapter 子边界。
- 不增加角色继承、显式 deny、权限通配、多租户 domain、数据范围、ABAC 或 ReBAC。
- 不引入 OpenFGA、OPA、外部 authorization service、消息 watcher 或分布式 policy control plane。
- 不改变 Organization 关系或 Navigation menu policy；前端菜单仍不是服务端授权 authority。
- 不删除、覆盖或重建用户本地数据库；migration 必须可前滚并保留现有数据。
- 不支持运行时 Permission Definition、Casbin model 编辑器、任意 URL policy、账号直授权或权限生效时间/审批流。
