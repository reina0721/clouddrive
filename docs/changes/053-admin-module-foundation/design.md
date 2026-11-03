# 053 Admin 多业务模块基础平台设计

## 1. 设计定位

```text
module-owned completed artifacts
  HTTP Contract -----------+
  WebUI Registration ------+--> explicit application composition --> validated immutable catalogs
  Permission Definition ---+
  Migration Set -----------+
```

053 增加的是分类型聚合和校验，不是运行时模块框架。`internal/module/<name>`、局部 `module.go` 与 composition root 的既有关系保持不变；Kernel 不认识 Permission、HTTP Module、WebUI Registration 或 Migration Set。

## 2. 完成品聚合

现有 `module.Contribution` 继续只承载具有共同运行语义的 Participant、Schedule 和 Message。新增聚合采用各领域已有或新增的窄 Catalog Builder：

```text
permission.BuildCatalog(definitions...)
httpcontract.BuildCatalog(modules...)
webui.BuildApplicationCatalog(registrations...)
migration.BuildCatalog(sets...)
```

composition 保留显式模块清单。Builder 统一完成复制冻结、稳定排序、owner/ID 唯一和引用校验；不保存全局 Registry，也不执行 I/O。

## 3. Permission Catalog

```text
PermissionDefinition
  Key                  exact stable string
  OwnerModuleID
  DescriptionMessageID

PermissionCatalog
  Definitions          immutable stable order
  Lookup(key)
  ValidateReferences(...)
```

Permission Catalog 是应用声明，不是 RBAC 存储或授权引擎。053 从当前真实 operation policy 提取 Todo/Auth 已存在的精确 scopes，证明 operation 与 WebUI route 引用可校验；不得预先声明 `iam:*`、`organization:*`、`navigation:*` 占位 key。

054–056 分别加入自己拥有的 definition。IAM 负责把 Catalog 与 RolePermission/owner 对齐，Auth 仍负责 operation decision。

## 4. Migration Catalog

保留 `pkg/database/migrate` 单 Set Runner，`internal/module/migration` 增加应用级 Catalog：

```text
MigrationCatalog
  ordered SetRegistration { ModuleID, Set }
  legacy baseline detector
  aggregate status/up/completion
```

Catalog 校验 set ID、version table 和 source owner 唯一，按 ModuleID 稳定排序。Runner 生命周期仍在执行边界创建和关闭；失败使用 `errors.Join` 或项目等价语义保留主错误与 cleanup error。

053 当前只有 Todo 生产 set，但使用多个独立 fixture set 验证聚合；054–056 分别贡献 IAM、Organization、Navigation set。Todo 在 053 收敛到 `todo_schema_migrations` 干净 baseline，使旧 `schema_migrations/webui_*` 检测和新 owner 路径一次建立。

## 5. HTTP Security 与 Auth 来源

目标请求链：

```text
contract route binding
  -> schema validation
  -> OperationGate.Authenticate(request, operation security)
  -> Principal request context
  -> Auth AuthorizeOperation
  -> module handler
```

`none`、`bearer`、`webuiSession` 是 typed security profile。认证来源由 composition 显式装配：Bearer 继续连接现有 Auth verifier，WebUI Session 在 053 连接当前 Auth WebUI resolver，在 054 被 IAM resolver 单轨替换。

053 只迁移请求契约和 resolver 接入，不为旧 Auth 本地账号新建 production migration set。Todo 旧 baseline 中的 `webui_*` 表已经退休，因此 fresh database 的 Setup/Login 持久化不作为 053 验收；054 必须由 IAM schema 和 service 单轨接管，不能恢复 Todo-owned 账号表。

这不是双轨兼容：同一 profile 同一时刻只有一个 owner，054 必须删除旧 Auth 本地账号实现。Transport 不读取 URL 前缀、Cookie 名或具体模块类型。

Dispatcher 接收多个 contract Module 和 handler map，校验每个 operation 恰有一个 handler，未知或重复项在 listener 前失败。

## 6. WebUI NavigationPolicy

```text
static Catalog
  + NavigationPolicySnapshot
  + access lookup
  + availability lookup
  = Manifest
```

通用 policy value 只含 NavigationID、Enabled、ParentOverride、OrderOverride。Builder 校验 policy 引用、父子无环和 order，再生成 Manifest。

- `CatalogRevision`：静态 Binding/Registry 内容摘要；
- `NavigationRevision`：有效 policy snapshot 内容摘要。

053 的默认 provider 从静态 Catalog 确定性生成等价 policy，不是 Noop 或假数据；056 将其替换为 Navigation Service snapshot。ManifestRoute 始终保留，菜单隐藏不参与 API 授权。

## 7. 文件影响

- 新增项目自有 Permission Catalog 契约及 tests；
- 泛化 `internal/composition/http_contracts.go`、dispatcher 和 operation gate；
- 扩展 `internal/webui/contract.go` 的 NavigationPolicy/双 revision；
- 扩展 `internal/module/migration` 与 composition migration catalog；
- Todo migration 单轨收敛为独立首发 baseline；
- 更新 Auth/HTTP/WebUI/Migration/module development 当前文档与生成门禁。

不新增 `internal/module/iam`、`organization`、`navigation` 实现目录；这些分别属于 054–056。

## 8. 验证

| 层级 | 门禁 |
| --- | --- |
| Permission | stable order、duplicate/empty/wildcard、operation/WebUI unknown reference、immutable copy |
| Migration | multi-set fixtures、stable order、version table conflict、status/up/completion、cleanup error、legacy preflight |
| HTTP/Auth | multi-module dispatcher、none/bearer/webuiSession、Principal context、unknown/duplicate handler、现有行为回归 |
| WebUI | default policy 等价、unknown/cycle/order、Catalog/Navigation revision 分离、access/availability 叠加 |
| Architecture | 无扫描/全局 Registry/Kernel 依赖；无 IAM/Organization/Navigation 占位业务实现 |
| Project | Go test/race/vet/build、WebUI lint/typecheck/test/build、生成 clean、docs guard、diff check |

Postgres/MySQL、Playwright、Docker 或远端 CI 未执行时必须明确保留为未验证。
