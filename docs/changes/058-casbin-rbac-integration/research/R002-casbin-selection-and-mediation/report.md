# R002 Casbin 选型、policy persistence 与中介注入设计

## 1. 真实用例与选择标准

本任务的真实用例不是动态 URL matcher、资源关系或多租户，而是：

- Account 可有多个 Role；
- Role 可有多个代码注册的精确 PermissionKey；
- protected operation/action 需要一个精确 PermissionKey；
- 角色和权限 mutation 后立即 fail closed；
- IAM 继续管理账号、角色元数据、owner 与 Session；
- Auth、HTTP 和业务模块不依赖第三方类型。

选择标准因此是：Core RBAC 覆盖、Go 稳定版本、维护与许可证、线程安全、可测试性、第三方隔离、与现有 transaction/Generation 的一致性，以及是否能形成净删除而不是增加第二轨。

## 2. 候选比较

| 候选 | 官方能力与定位 | 当前适配性 | 结论 |
| --- | --- | --- | --- |
| Apache Casbin v3 core | 嵌入式 Go authorization library；支持自定义 PERM model、RBAC role mapping 与 `Enforce` | 正好替换手写角色展开和 decision；可隐藏在 IAM Adapter | 采用 |
| Casbin GORM Adapter / `casbin_rule` | 用通用六列 policy 表持久化 Casbin policy，支持 autosave/transactional adapter | 会与 IAM Role/AccountRole/RolePermission、owner 与 Session transaction 形成第二套 authority | 拒绝 |
| OpenFGA | 以 relationship tuple 与 object/relation model 提供 ReBAC/FGA，通常作为独立 Store/API | 当前没有资源关系、跨服务或集中 PDP；引入额外服务、store 与迁移无收益 | 拒绝当前采用 |
| OPA Go SDK | 嵌入或远程执行 Rego/通用 policy，可表达复杂属性规则 | 当前只是精确 Core RBAC；Rego bundle/config/plugin 生命周期与弱类型输入远超需求 | 拒绝当前采用 |

这不是“Casbin 功能最多所以采用”。采用理由是它能在不改变业务实体 owner 的前提下，准确替换当前两个手写通用机制，并保留未来重新研究 domain/ABAC 的退出空间。

## 3. 版本、维护、许可证与工具链

截至 2026-08-22：

- 官方稳定 release 为 `v3.10.0`，发布于 2026-01-26；后续 `v3.11.0-snapshot.*` 是 snapshot，不作为生产默认依赖；
- 官方安装路径为 `github.com/casbin/casbin/v3`；
- `v3.10.0` module 声明 Go 1.13，低于项目 Go 1.26.6，不构成最低版本冲突；
- 许可证为 Apache-2.0，与当前仓库许可证兼容；
- core 依赖规模小，主要为 `doublestar/v4`、`casbin/govaluate` 与 `google/uuid`；项目已经直接使用 `google/uuid`。

实施时仍必须在实际加入依赖后运行 `govulncheck ./...`、`go mod tidy` diff 审查、完整 Go 门禁与许可证/NOTICE 检查。本研究没有把“搜索不到 advisory”写成无漏洞保证。

## 4. Casbin 使用边界

### 4.1 固定 Core RBAC model

目标 model 只表达账号、角色和精确权限，不开放 hierarchy、domain、deny、ABAC、resource pattern 或 superuser：

```ini
[request_definition]
r = sub, obj

[policy_definition]
p = sub, obj

[role_definition]
g = _, _

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = g(r.sub, p.sub) && r.obj == p.obj
```

映射规则：

```text
g, account:<AccountID>, role:<RoleID>
p, role:<RoleID>, permission:<PermissionKey>
request = account:<AccountID>, permission:<PermissionKey>
```

使用前缀避免账号与角色 ID 命名空间碰撞。Role hierarchy 不从 Casbin Management API 开放；项目 snapshot builder 只可能生成 account -> role 的 `g`。

### 4.2 第三方类型隔离

`casbin.Enforcer`、`model.Model` 与任何 policy slice 只能出现在 `internal/module/iam/adapter/casbin`。对外暴露项目自有接口，例如：

```go
type DecisionPoint interface {
	Decide(context.Context, Request) (Decision, error)
}
```

Auth 的 Request/Decision、PermissionKey、Principal、revision 与错误类型都由项目拥有；HTTP、Handler、WebUI、IAM Service public contract 不接触 Casbin 类型。

### 4.3 不使用 Casbin persistence 写路径

Casbin 官方 Adapter 负责 `LoadPolicy`/`SavePolicy`/autosave；官方文档也明确 Casbin 不管理用户或角色实体。当前 IAM 已有更强的 typed schema 和 transaction 不变量，因此计划采用“项目 snapshot -> Casbin evaluator”的 Adapter，而不是 Casbin `persist.Adapter`：

1. IAM Repository 在 transaction snapshot 中稳定排序读取 active AccountRole 与 RolePermission；
2. IAM 先校验 Account/Role 状态、Permission Catalog、owner 和 revision；
3. module-owned Casbin Adapter 从项目 `PolicySnapshot` 构造新的完整 Enforcer；
4. 构造成功后只读发布，不调用 Casbin Add/Remove/Save Management API 修改业务状态。

这样 Casbin 是 evaluator，不是第二个数据库 owner。

### 4.4 并发与生命周期

官方 `SyncedEnforcer` 用 RWMutex 包装 `Enforce` 与 policy/model 操作，适合并发 HTTP 读取。目标实现仍把每个 evaluator 构造成不可变快照，不在发布后调用 mutation API；选择 `SyncedEnforcer` 是明确线程安全边界，不等于启用动态 policy 管理。

不使用官方 `StartAutoLoadPolicy`：`v3.10.0` 源码中的 ticker goroutine 会忽略 `LoadPolicy` 错误，与项目“错误完整向上导出”和 goroutine owner 规则冲突。也不启用 Watcher/Dispatcher；它们是额外包和分布式一致性机制，当前没有外部部署需求。

`v3.10.0` 新增的 `Explain`/AI API 不进入项目边界，不配置 endpoint/key，也不允许授权输入被发送到外部服务。

## 5. A/B 中间人设计

推荐的数据流为：

```text
HTTP/Huma OperationGate
  -> Auth.Service.EnforceOperation
     -> Auth-owned DecisionPoint port
        -> composition iamRBACDecisionAdapter
           -> IAM Authorization evaluator
              -> Casbin SyncedEnforcer
```

Auth 根据 Principal 的授权来源分轨：

- `token-scopes`：Bearer/CLI/development 继续使用凭据已验证的精确 Scope；
- `iam-rbac`：不再信任 `Principal.Scopes`，必须调用注入的 DecisionPoint；
- 未知来源、缺失 revision、DecisionPoint 未 Ready 或 evaluator 错误：拒绝并保留可分类错误。

composition adapter 负责项目类型映射和错误转换，不负责业务判断、policy 缓存或数据库访问。IAM 不 import Auth，Auth 不 import IAM；两者只在 composition root 连接。

## 6. Revision 与 fail-closed 一致性

### 6.1 为什么仅 `LoadPolicy` 不够

当前 Application Generation reload 会让旧、新 runtime module 短暂并存。权限 mutation 可能通过旧 Generation 提交，而新 Generation 已经加载旧 snapshot。单实例本地回调也无法更新另一个 Generation。

### 6.2 目标协议

IAM schema 增加单行 authorization state/revision。所有影响 AccountRole、RolePermission、Role active/archive、owner reconcile 的 mutation 在同一 transaction 中：

1. 修改业务关系；
2. 更新受影响账号 `SecurityRevision` 并撤销 Session；
3. bump authorization revision；
4. 读取并校验同 revision 的完整 `PolicySnapshot`；
5. 在 commit 前构造 candidate evaluator；
6. commit 成功后原子发布 candidate。

IAM `Resolve` 在同一数据库读取边界返回当前 authorization revision；composition 写入 `Principal.AuthorizationRevision`。DecisionPoint 执行时：

- Principal revision 与 evaluator revision 相同：执行 Casbin；
- 不同：以 caller context 同步 single-flight refresh；
- refresh 后仍不同、ctx 取消、数据库失败、snapshot 非法或 Casbin 返回错误：拒绝；
- 不保留“刷新失败继续使用旧 policy”的回退。

该 revision 同时覆盖 Generation 并存；未来若同一数据库运行多实例，也有检测基础，但多实例仍不是本计划已验证承诺。

## 7. 对当前代码的净变化

实施完成后应删除而非保留：

- IAM `permissionsFor` 手写角色权限展开；
- IAM Session -> `Principal.Scopes` 的本地 RBAC转换；
- Auth 对 IAM Principal 使用 `HasScope` 的路径；
- 任何为旧实现保留的 fallback、feature flag 或双写。

应保留：Permission Catalog、IAM typed 表和 CRUD、owner reconcile、Session security revision、Auth policy/audit、operation gate、Bearer scope 语义和 composition root。

## 8. 局限、停止条件与刷新触发器

- 当前没有对 Casbin 两字段 model 的仓库内 PoC；实施第一任务必须先以 fixture 验证 exact allow/deny、未知 key、并发与错误返回，失败则撤回依赖并回到研究，而不是叠加兼容层。
- 当前没有生产多实例或外部 DSN 证据；SQLite 是本地 runtime gate，Postgres/MySQL 至少验证 migration 与 repository contract。
- 若需求扩展到角色继承、domain、deny、ABAC/ReBAC 或外部集中 PDP，必须重新研究 model 和存储，不能只修改 `.conf` 偷渡公共语义。

研究门禁通过，足以形成采用 Casbin core、保留 IAM authority、composition 中介和 revision fail-closed 的实施计划。

