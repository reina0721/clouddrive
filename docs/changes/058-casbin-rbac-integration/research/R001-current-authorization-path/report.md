# R001 当前权限调用链、数据 authority 与注入边界

## 1. 研究范围与方法

本报告审计当前根 Go 工程，不读取或推断 `old-backend/`。研究从代码声明、应用启动、IAM 数据、Session 认证、Auth decision 和 HTTP operation gate 反向追踪真实调用方，并用定向测试验证当前快照可编译运行。

代码快照为 `f83a58534c949a636a3a1b10f31c047fdeacf4af`。验证命令：

```powershell
go test ./internal/module/auth/... ./internal/module/iam/... ./internal/composition/...
```

结果通过；该结果证明当前行为基线，不证明本报告中的目标设计已经实现。

## 2. 当前已实现事实

### 2.1 静态权限与 operation policy

`internal/permission.Catalog` 聚合各模块代码定义的精确 `PermissionKey`，拒绝空值、重复、通配符与未知引用。`applicationBlueprint` 在进程启动期冻结 Permission Catalog、Huma HTTP Definition、operation policy 与 WebUI Catalog；这些是代码声明，不随 Application Generation 重复构造。

Auth policy 把每个 protected operation 映射到一个精确 Scope 和 Action。缺失 policy、空 Scope 或未知 operation 都是拒绝，不存在默认放行。

### 2.2 IAM 是角色配置与安全事务 authority

IAM 当前拥有：

- Account、Credential、Session、Role；
- AccountRole 与 RolePermission；
- system owner 角色和完整 Permission Catalog 覆盖不变量；
- 账号禁用、密码变化、角色分配与角色权限变化；
- 受影响账号 `SecurityRevision` 更新与 Session 同事务撤销。

`ReplaceAccountRoles` 与 `ReplaceRolePermissions` 在 IAM transaction 内维护关系、owner 约束并调用 `bumpAndRevoke`。`Compatible`/`ReconcileOwnerCatalog` 在 listener 前拒绝未知 permission 或 owner 缺权，并把新增代码权限授予 owner。

这些不是通用 Enforcer 应接管的职责。它们是项目业务实体、数据完整性、账号风险状态与 Session 生命周期的 authority。

### 2.3 当前 RBAC 展开与判断是手写的

当前请求链为：

```text
code Permission Catalog
  -> IAM role_permissions/account_roles
  -> IAM Resolve() 每请求执行 permissionsFor()
  -> SessionIdentity.Permissions
  -> composition iamSessionAuthAdapter
  -> Auth Principal.Scopes
  -> Auth decide() / Principal.HasScope()
  -> operationGateAdapter
  -> module handler
```

`permissionsFor` 逐账号读取 active AccountRole、active/non-archived Role 与 active RolePermission，手工去重、排序并返回 PermissionKey。composition 再把这些 key 逐项转换为 Auth Scope；Auth 的 `decide` 最终做线性精确集合判断。

这套逻辑只实现当前 Core RBAC 子集，语义简单且现有测试通过；但“角色图构建、policy 展开、decision evaluation”属于成熟第三方库已经覆盖的通用机制。继续扩展角色层级、domain 或复杂 matcher 会把项目带向自研策略引擎。

### 2.4 Bearer Scope 与 IAM RBAC 被同一个字段混合

JWT/Bearer 的 scopes 是认证凭据携带的 claims；IAM Session 的 Permissions 是数据库角色关系计算结果。二者当前都被压成 `Principal.Scopes`，Auth 无法表达“这个主体应由 token scope 决策，还是由 IAM RBAC DecisionPoint 决策”。

引入 Casbin 后不能简单保留此混合：否则 Casbin 只会重复验证已经由 `permissionsFor` 算好的结果，没有接管任何真实通用机制。

### 2.5 三种 Binding 不能混用

仓库里至少有三种容易混淆的“binding”语义：

1. `internal/kernel/app.Binding[T]`：构建期 Plan 内的 typed 输出引用，只能声明前置组件依赖；Plan 构建完成后不支持运行时 Resolve。
2. `internal/module/*/binding/**`：HTTP、config、migration、permission、WebUI 等模块边界完成品目录，不是 DI 容器。
3. request `context.Context`：单次调用的取消、deadline 与已认证 Principal 载体。

因此，不能把 Casbin Enforcer 或 IAM Service 塞进 context，也不应为了 RBAC 把业务模块注册成 Kernel Capability。正确中介是构造期注入的窄 port；context 只传调用数据。

## 3. 当前承载架构的适配性

### 3.1 可保留的部分

- composition 已经是 Auth 与 IAM 的唯一连接点，并已有 `iamSessionAuthAdapter` 先例；
- Auth Service 已由消费方定义 `CredentialVerifier`、`AuditSink` 等窄 port；
- Permission Catalog 与 operation policy 已在静态 Blueprint 中冻结；
- IAM Service/Repository 随 Application Generation 构造，数据库 resource 由 Generation lease 管理；
- HTTP operation gate 只依赖 Auth authorizer，可保持 transport 与 Casbin 零耦合。

这说明无需引入 DI Container、事件总线、Service Locator 或反射注册。

### 3.2 必须补齐的部分

内存 Enforcer 会引入当前不存在的 policy snapshot。Application reload 时旧、新 Generation 会短暂并存；一个 Generation 内发生权限 mutation 后，另一个 Generation 的 snapshot 可能过期。仅在 mutation 后调用本地 `LoadPolicy` 不能覆盖以下情况：

- 新旧 Generation 重叠；
- 多进程实例；
- transaction commit 与 evaluator publish 之间的并发请求；
- evaluator refresh 失败后旧 policy 继续存在。

因此，目标设计必须有数据库 authorization revision，并把 revision 带入已认证 Principal。DecisionPoint 只允许 Principal revision 与当前 evaluator revision 一致；不一致时同步刷新，刷新失败或仍不一致即拒绝。

## 4. 分类结论

| 当前能力 | 分类 | 结论 |
| --- | --- | --- |
| Permission Catalog 与 operation policy | 项目特有声明/校验 | 保留 |
| Account/Role 实体、owner、Session、安全 revision | 项目业务规则 | 保留在 IAM |
| IAM relationship 持久化与 transaction | 项目业务存储 | 保留为唯一 authority |
| `permissionsFor` 角色展开 | 自研通用 RBAC 机制 | 由成熟 evaluator 单轨替换 |
| `Principal.HasScope` 用于 IAM Session | 自研通用 decision | 由注入 DecisionPoint 单轨替换 |
| Bearer/JWT 精确 scope | 凭据特有授权语义 | 保留，但与 IAM RBAC 明确分型 |
| composition adapter | 项目装配接缝 | 保留并扩展为中介 |
| Kernel App Binding | Kernel 构建期机制 | 不扩展到业务 RBAC |

## 5. 局限与任务影响

本报告没有安装或运行 Casbin，也没有修改 schema；第三方具体版本、model、线程安全与 persistence 选择见 R002。当前没有多租户、角色继承、deny、ABAC 或 ReBAC 需求，目标设计不得顺手开放这些能力。

当前代码证据足以支撑“保留 IAM 业务 authority、替换通用 evaluator、用 composition 中介注入 Auth”的计划。

