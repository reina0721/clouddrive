# 058 Casbin RBAC 注入设计

## 1. 设计定位

目标不是把 Casbin 暴露成新的平台 API，而是让它成为 IAM RBAC 配置能力背后的 evaluator，并通过消费方 port 注入现有 Auth decision 链。

```text
       static application Blueprint
 Permission Catalog + operation policies
                    |
                    v
HTTP -> Auth Service -> Auth-owned DecisionPoint port
          |                    |
          |                    v
          |          composition adapter (中间人)
          |                    |
          |                    v
          |            IAM Authorization API
          |                    |
          |                    v
          |        IAM adapter/casbin Evaluator
          |                    |
          +-> audit      Casbin SyncedEnforcer

IAM Role/Assignment HTTP -> IAM Service -> IAM transaction -> typed IAM tables
                                             |
                                             +-> revision + PolicySnapshot
```

## 2. 模块职责

### 2.1 Auth（消费架构 A）

Auth 拥有：

- protected/public operation policy；
- `DecisionPoint` consumer port；
- Principal 授权来源分型；
- operation/action 编排、ResourceFacts owner 检查；
- deny/error reason 与低敏审计。

Auth 不知道 Role、AccountRole、Casbin model、policy storage 或 reload 实现。

### 2.2 IAM RBAC（业务能力 B）

IAM 继续拥有：

- Account、Role、AccountRole、RolePermission 与 owner；
- Permission Catalog reconciliation；
- Session、SecurityRevision 与 mutation transaction；
- `PolicySnapshot`、authorization revision 与 evaluator lifecycle；
- IAM 页面/API 的角色权限配置。

Casbin 只在 `internal/module/iam/adapter/casbin` 中把 snapshot 编译为 decision graph。

### 2.3 composition（中间人）

装配分成三级：根 Generation 只编排资源、模块切片和生命周期；`identity_access.go` 只连接 IAM/Auth 跨模块 port；IAM/Auth `module.go` 各自构造内部 Repository、第三方 Adapter、Runtime、Service 与 Handler。根层不 import Casbin，也不逐项注入 Factory、PolicySource 或 refresher。

identity-access 子装配增加窄 adapter，把 IAM `Authorization` facet 适配为 Auth `DecisionPoint`：

```go
type iamRBACDecisionAdapter struct {
	decision iamAuthorizationDecision
}
```

它只转换 Subject、PermissionKey、revision、Decision reason 与错误，不读取数据库、不缓存、不审计。IAM Module 向根层暴露 SessionResolver、Authorization、AccountDirectory、MutationGuard 等窄 facet，不再暴露完整 Service。完整瘦身边界见 [R004](research/R004-hierarchical-composition-slimming/report.md)。

## 3. Principal 与上下文

目标 Principal 显式区分授权来源：

```go
type AuthorizationSource string

const (
	AuthorizationTokenScopes AuthorizationSource = "token-scopes"
	AuthorizationIAMRBAC     AuthorizationSource = "iam-rbac"
)

type Principal struct {
	Subject               string
	Kind                  ActorKind
	AuthorizationSource   AuthorizationSource
	Scopes                []Scope
	AuthorizationRevision uint64
	AuthenticatedAt       time.Time
	IssuedAt              time.Time
}
```

构造不变量：

- `token-scopes` 可以有 Scopes，revision 必须为零；
- `iam-rbac` 必须有非零 revision，Scopes 必须为空；
- 两者都满足或都不满足时构造失败；
- context 只保存该值对象，不保存 DecisionPoint。

WebUI Session 需要向前端返回 effective permission keys 时，由 IAM evaluator 的项目查询方法在同 revision 下导出；前端结果只用于体验，服务端仍逐 operation decision。

## 4. Auth DecisionPoint 契约

拟在 Auth service 层定义：

```go
type DecisionPoint interface {
	Decide(context.Context, AuthorizationRequest) (AuthorizationDecision, error)
}

type AuthorizationRequest struct {
	Subject    string
	Permission Scope
	Revision   uint64
}
```

Auth `decide` 流程：

```text
public policy -> allow
protected + missing principal -> unauthenticated
token-scopes -> exact HasScope
iam-rbac -> DecisionPoint.Decide
RBAC deny -> missing_scope/rbac_denied
RBAC allow + owner mismatch -> owner_mismatch
RBAC allow + owner ok -> allowed
unknown source/error -> fail closed
```

`Scope` 可在实施中单轨收敛为项目 PermissionKey alias/typed conversion，但不得让 Auth import IAM 或让第三方 string 穿透。若该类型调整实质改变公开契约，必须回到待确认。

## 5. 动态权限分配

```text
代码/Blueprint：定义哪些 PermissionKey 存在、由哪个 operation/action 消费
IAM 数据库：动态定义 Role、AccountRole、RolePermission
Casbin：执行 IAM 数据库当前 revision 对应的只读 policy snapshot
```

自定义角色就是动态权限包。任意创建新 PermissionKey 没有服务端消费点，不能成为“可配置”；如果未来需要租户自定义资源权限，应重新研究 domain RBAC/ABAC/ReBAC。

关系读取返回 entity version、authorization revision 和当前完整集合；写入提交 expected version + desired set。账号角色与角色权限使用各自 typed command，响应返回新 entity/revision 与 added/removed count。Handler 不计算 diff；Service 负责规范化、Catalog/Role 校验和稳定 409 映射。

```text
Auth operation permission
  -> IAM Service validates expected version + desired set
  -> database transaction
       validate owner/role/catalog + calculate diff
       no-op -> return unchanged result
       persist desired set + bump entity version
       bump affected account security revisions + revoke sessions
       bump revision + build complete candidate evaluator
  -> commit
  -> atomic publish candidate
```

不暴露逐项 add/remove 写入口，也不调用 Casbin Management API 增量改内存。完整 candidate 构造使数据库 rollback、Casbin policy 与并发请求只有一个发布点。

- 角色权限从自由文本改为 Permission Catalog checkbox matrix，按 `OwnerModuleID` 分组并显示本地化 description；
- system owner 矩阵只读，权限由 Catalog reconcile；
- 账号角色使用 active/non-archived Role checklist；
- UI 保存完整集合并携带 expected version；409 保留用户选择并要求重新加载，不自动覆盖；
- 保存前展示 added/removed count，Menu visibility 不反向创建权限。

完整 API、事务、生效、并发与审计语义见 [R003](research/R003-dynamic-assignment-contract/report.md)。

## 6. PolicySnapshot 与 Casbin Adapter

### 6.1 项目 snapshot

```go
type PolicySnapshot struct {
	Revision        uint64
	AccountRoles    []AccountRoleRule
	RolePermissions []RolePermissionRule
}
```

Repository 输出前完成：稳定排序、去重、active 过滤、role 状态过滤、Permission Catalog 校验和 ID 前缀编码。禁止把 GORM model 或 `[][]string` 直接交给 Service。

### 6.2 Casbin evaluator

`internal/module/iam/adapter/casbin` 负责：

1. 从常量 model text 构造 model；
2. 创建 `casbin.SyncedEnforcer`；
3. 关闭 AutoSave/日志/外部 AI 能力；
4. 将 snapshot 转成 `g` 与 `p` policy；
5. 构建 role links 并验证所有规则；
6. 暴露项目自有 `Decide` 与 `PermissionsForSubject`；
7. 发布后不再调用 Casbin mutation API。

model text 是 module-owned 固定实现资产，不进入用户配置；修改 model 等同于权限语义变更，必须通过新研究/计划。

## 7. Revision、事务与刷新

### 7.1 schema

增加 IAM-owned authorization state 表，至少包含 singleton ID、non-zero revision 与更新时间。通过新的前滚 migration 覆盖既有本地库，不修改或删除用户数据；是否最终在首发前 squash baseline 需要另有数据检查与明确授权，不属于 058 自动动作。

### 7.2 启动

Generation Prepare 顺序调整为：

```text
construct IAM repositories/service
  -> migration compatibility
  -> reconcile owner catalog
  -> read revision + PolicySnapshot
  -> build candidate evaluator
  -> IAM compatible check
  -> inject DecisionPoint into Auth
  -> build operation gate/routes
  -> listener commit
```

任何步骤失败都在 listener 前 abort，不提供 Noop evaluator。

### 7.3 mutation

所有授权 mutation 走统一 helper：

```text
authorization write lock
  -> database transaction
       mutate typed rows
       bump/revoke affected account sessions
       bump authorization revision
       read stable snapshot
       build candidate evaluator
  -> commit
  -> atomic publish candidate
  -> unlock
```

candidate 在 commit 前构造，避免“数据库已提交但 Enforcer 构造失败”。publish 只交换不可变指针，不返回错误。

### 7.4 stale 检测

`Resolve` 返回数据库当前 revision。DecisionPoint 比较 Principal revision 与 evaluator revision；不一致时调用 generation-local refresher。Refresher 使用 caller context 和 single-flight/互斥合并并发读取，不能启动后台 goroutine：

```text
revision match -> Enforce
revision mismatch -> refresh snapshot -> publish -> compare again -> Enforce
refresh error / mismatch remains -> deny with error
```

禁止 stale-while-error 放行。对新增权限，旧 snapshot 本来拒绝；对撤销权限，Session revision/撤销和 authorization revision 双重 fail closed。

## 8. 生命周期与 Reload

- Permission Catalog/model text：进程启动期 immutable Blueprint/代码资产；
- IAM repository、revision refresher、Casbin evaluator：Application Generation runtime object；
- 底层 Database：继续由现有 resource pool lease；
- evaluator 无 goroutine、无 Close；Generation retire 后随对象图回收；
- Generation 并存通过共享数据库 revision 检测，不建立全局可变 Enforcer；
- database config 指向不同数据库时，各 Generation 使用自己的 revision 与 evaluator，不跨资源共享。

## 9. 错误与日志

项目错误至少区分：

- unauthenticated Principal；
- business deny；
- stale revision；
- policy snapshot incompatible；
- evaluator unavailable/build failure；
- caller canceled/deadline；
- database refresh failure。

HTTP 仍映射 401/403/内部失败；Casbin 原始 matcher/policy 不写入响应。只有 Auth decision 边界记录一次低敏结果；IAM mutation 记录 owner、phase、revision 变化和稳定错误类，不记录完整 rule。

## 10. 文件影响

预计主要影响：

- `go.mod`、`go.sum`：加入 Casbin v3.10.0；
- `internal/module/iam/adapter/casbin/**`：第三方隔离 evaluator；
- `internal/module/iam/{model,service,repo}/**`：PolicySnapshot、revision、mutation publish；
- `internal/module/iam/binding/migration/{sqlite,postgres,mysql}/**`：前滚 revision schema；
- `internal/module/iam/binding/{http,webui}/**`：带 version/revision 的动态分配快照、Catalog 权限矩阵与 409 交互；
- `internal/module/auth/{model,service}/**`：Principal source 与 DecisionPoint；
- `internal/composition/{iam,generation,http_api}.go`：唯一中介与装配顺序；
- `internal/composition/identity_access.go`：IAM/Auth 有边界子装配与根 Generation 瘦身；
- 对应单元、transaction、HTTP、Generation、E2E 与架构边界测试；
- `docs/architecture/technology-selection.md`、Auth/IAM README、模块开发/安全文档和任务证据。

WebUI 页面与 IAM CRUD API 预计不改产品结构；若实现发现 DTO/API 必须材料性变化，先更新计划并重新确认。

## 11. 迁移与退出条件

- 先完成 Casbin Adapter PoC 和等价性测试，再迁移 production decision；PoC 不能形成永久平行实现。
- production 切换后同一任务删除手写 `permissionsFor`/IAM Scope 路径。
- 若 Casbin model 无法表达 exact Core RBAC、引入依赖出现未处置漏洞/许可证问题，或 revision 无法在三 dialect transaction 中可靠实现，则停止并回到研究阶段。
- 未来移除 Casbin 时，Auth 只依赖项目 DecisionPoint，替换范围局限在 IAM Adapter；业务表与 HTTP contract 不受第三方 API 锁定。
