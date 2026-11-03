# 058 实施任务与确认状态

## 当前状态

- 研究：已完成，R001/R002 active，研究门禁通过。
- 计划：已完成，用户已在计划报告后的后续消息中明确确认实施 `058` 方案（确认消息：`确认实施 058 方案`），本任务进入实施阶段。
- 非文档实施：已确认、实施中。
- Git：确认后与实现、测试和 authority 同一任务提交。

## 任务清单

| ID | 类型 | 内容 | 依赖 | 状态 | 完成条件 |
| --- | --- | --- | --- | --- | --- |
| `RBAC-058-001` | A/PoC | 固定 Casbin v3.10.0，建立 module-owned exact Core RBAC evaluator fixture | 用户确认 | 完成 | model、前缀、allow/deny、重复/非法 rule、并发 Enforce 与错误语义通过；第三方类型零泄漏 |
| `RBAC-058-002` | B/Data | 增加 IAM authorization revision 与三 dialect 前滚 migration、Repository snapshot | 001 | 完成 | 既有数据不删除；stable snapshot、active 过滤、catalog 校验、并发 revision transaction 测试通过 |
| `RBAC-058-003` | B/Runtime | 实现 candidate-before-commit、atomic publish、revision refresh 与 fail-closed lifecycle | 001,002 | 完成 | refresh 无后台 goroutine；错误/取消保留；旧 snapshot 不在 mismatch/error 时放行 |
| `RBAC-058-004` | C/Contract | 为 Auth 增加 consumer-owned DecisionPoint 与 Principal authorization source | 001 | 完成 | token-scopes/iam-rbac 构造互斥；未知来源拒绝；Auth/IAM/Casbin package graph 合规 |
| `RBAC-058-005` | C/Composition | 建立 identity-access 子装配、IAM 窄输出 facet并瘦身根 Generation | 003,004 | 完成 | IAM/Auth 无互 import；根层无 Casbin import/Service 穿透；listener 前 Ready；HTTP/Huma 不接触 Casbin；Generation overlap 测试通过 |
| `RBAC-058-006` | D/Dynamic | 升级动态账号角色/角色权限分配 contract、事务与 WebUI | 002,003,005 | 完成 | expected version、409、no-op、Catalog matrix、Role checklist、diff/result、Session revoke 与 evaluator publish 通过 |
| `RBAC-058-007` | D/Migration | 单轨迁移 IAM Session/permission projection 与 Auth decision，删除手写旧路径 | 003,005,006 | 完成 | `permissionsFor`、IAM-to-Scope RBAC转换、IAM HasScope fallback 和旧测试/文档无残留 |
| `RBAC-058-008` | E/Security | 补齐 mutation/session/revision/audit/低敏错误安全测试 | 006,007 | 完成 | revoke、并发 409、no-op、inactive role、owner、unknown key、cancel、refresh failure、401/403/500 映射均有负向证据 |
| `RBAC-058-009` | F/Docs | 更新技术选型、Auth/IAM authority、动态分配、模块开发与安全说明 | 007 | 完成 | 当前文档只描述单轨实现，明确静态定义/动态关系、Casbin/IAM/DecisionPoint owner 与多实例未验证边界 |
| `RBAC-058-010` | G/Verify | 运行完整质量、安全、生成、残留与 runtime 门禁并提交 | 001..009 | 完成 | 全部约定门禁通过；只提交任务文件；记录 commit、未验证外部 DSN 和剩余风险 |

## 实施顺序与停止点

```text
001 Casbin isolated PoC
  -> 002 revision/snapshot
  -> 003 evaluator lifecycle
  -> 004 Auth port/source
  -> 005 composition injection
  -> 006 dynamic assignment contract/UI
  -> 007 single-track cutover
  -> 008 security negatives
  -> 009 authority docs
  -> 010 full verification/commit
```

- `RBAC-058-001` 失败：撤回依赖与 PoC 文件，回到研究，不继续做兼容 Wrapper。
- 三 dialect revision transaction 无法给出可靠语义：停止在 002，重新研究存储协议。
- 实施中若出现角色继承、domain、deny、ABAC/ReBAC、外部 PDP、数据删除或产品 API 材料性变化：更新研究/计划并重新确认。

## 验证计划

### 定向

```powershell
go test ./internal/module/iam/adapter/casbin/...
go test ./internal/module/iam/... ./internal/module/auth/... ./internal/composition/...
go test -race ./internal/module/iam/... ./internal/module/auth/... ./internal/composition/...
```

### 全量

```powershell
go test ./...
go test -race ./...
go vet ./...
go build ./cmd/app
go run ./internal/tools/contract-gen
go run ./internal/tools/webui-gen
go run ./internal/tools/docs-guard
govulncheck ./...
git diff --check
```

同时运行项目现有 WebUI/generate/docs 门禁、SQLite runtime E2E、三 dialect migration contract、package import 边界、旧符号与 `casbin_rule`/gorm-adapter/AutoLoad/Watcher 残留搜索。实际命令以实施时当前脚本为准，不预先声称已执行。

## 本轮证据

| 日期 | 阶段 | 证据 |
| --- | --- | --- |
| 2026-08-22 | 研究 | 检索既有 metadata，053/R002 的 `Casbin becomes required` 刷新触发器命中 |
| 2026-08-22 | 当前代码 | 快照 `f83a58534c949a636a3a1b10f31c047fdeacf4af`；追踪 Permission Catalog -> IAM `permissionsFor` -> SessionIdentity -> Principal.Scopes -> Auth `HasScope` -> operation gate |
| 2026-08-22 | 当前验证 | `go test ./internal/module/auth/... ./internal/module/iam/... ./internal/composition/...` 通过 |
| 2026-08-22 | 外部研究 | 官方 Casbin v3.10.0 release/source/docs、OpenFGA 与 OPA 官方定位复核完成；选择 Casbin core，拒绝第二套 persistence |
| 2026-08-22 | 计划 | 研究/需求/设计/任务计划完成；未修改源码、依赖、migration、配置或进程 |
| 2026-08-22 | 动态分配调整 | 当前账号角色/角色权限 replacement API 与 WebUI 已复核；计划增加 expected version、409/no-op、Catalog matrix、transaction diff 与 evaluator 原子发布，任务扩展为 `RBAC-058-001..010`，仍待确认 |
| 2026-08-22 | composition 瘦身调整 | 当前根 Generation 直接知道 IAM/Auth Service 与多个 adapter；计划改为根 Generation、identity-access 子装配、module-local composition 三级结构，并用 IAM 窄 facet 删除 Service 穿透，任务 ID 不扩张，仍待确认 |
| 2026-08-22 | 确认 | 用户消息 `确认实施 058 方案` 确认当前计划，任务 `RBAC-058-001..010` 进入实施 |
| 2026-08-22 | 001 | 固定 `github.com/casbin/casbin/v3 v3.10.0`（go.mod 直接依赖 doublestar/govaluate 为 indirect）；`internal/module/iam/adapter/casbin` 提供常量 Core RBAC model、silent logger（关闭默认 stdout 事件日志）、`Evaluator.Decide/PermissionsForSubject/Revision` 与规范化校验；PoC fixture 覆盖 allow/deny 矩阵、前缀隔离、重复/非法规则拒绝、并发 Enforce（-race）、取消/deadline/nil/空输入错误语义；`govulncheck` 无漏洞 |
| 2026-08-22 | 002 | SQLite/Postgres/MySQL 三 dialect `000002_create_iam_authorization_state` 前滚 migration（单例 revision 行、checksum 清单、env 驱动三 dialect contract 测试）；`repo.AuthorizationSnapshot` 按 active/未归档角色过滤、稳定排序、去重、Catalog 校验（未知 key → ErrSnapshotIncompatible）；`UpdateAuthorizationRevision` 原子递增与并发 bump 测试；既有数据表保持不变 |
| 2026-08-22 | 003 | `internal/module/iam/authorization.Runtime`：Load、Decide、PermissionsForSubject、Mutate/BuildCandidate/PublishCandidate、syncEvaluator 单会话刷新；无后台 goroutine；刷新失败/取消/仍不一致 fail closed（ErrRevisionMismatch）；受限（首次登录）只放行自助权限；Service 统一 `authorizeMutation`（mutate 返回 no-op 信号），Setup/ReconcileOwnerCatalog/Replace* 全部 candidate-before-commit + commit 后原子发布；Session 携带 AuthorizationRevision |
| 2026-08-22 | 004 | Auth model 增加 `AuthorizationSource`（token-scopes/iam-rbac）、`AuthorizationRevision`、`Restricted` 与互斥构造；Auth service 增加消费方 `DecisionPoint` port，decide 按来源分轨（RBAC deny → ReasonRBACDenied）；未知来源/缺 port 构造失败；构造互斥与来源路由测试通过 |
| 2026-08-22 | 005 | `internal/composition/identity_access.go` 建立身份切片（IAM module-local → owner reconcile → evaluator Load → Compatible → SessionSource/DecisionPoint 适配 → Auth → OperationGate/MutationGuard）；IAM 输出 Sessions/Authorization/Accounts/Administration/Mutation 窄 facet，根 Generation 不再读取 Service；架构测试新增 Casbin 只允许在 `adapter/casbin` 的 package graph 规则；Generation reload 测试通过 |
| 2026-08-22 | 006 | 动态分配升级：`AccountRolesSnapshot/RolePermissionsSnapshot` 返回 entity version + authorization revision + 完整集合；`ReplaceAccountRoles/ReplaceRolePermissions` 提交 expected version + 期望集合，version 冲突稳定 409、no-op 不 bump/不撤销、diff 计数与新版本返回；HTTP 契约改为快照对象与 assignmentResponse；修复 mutationInput embedded path 绑定不可靠问题（status/password-reset 同模式扁平声明）；WebUI RolesPage 改 Catalog 权限矩阵（按 OwnerModuleID 分组）与 AccountsPage 角色 checklist；webui typecheck/test/eslint/i18n/lint-modules 全部通过 |
| 2026-08-22 | 007 | 单轨迁移完成：删除 `permissionsFor`/`firstLoginPermissions`/`allCatalogKeys`；Session 权限投影改由 runtime `ProjectPermissions`（同 revision + restricted 过滤）导出，Service port 增加 `ProjectPermissions`，runtime 投影方法改名对齐；Todo `validateActor` 移除 `len(Scopes)==0` 前置校验（iam-rbac Principal 不再伪造 scopes）；修复 `CreateRole/CreateAccount` 返回 Version=0 而 DB 为 1 的不一致；全仓库 grep 确认旧符号与 `casbin_rule`/gorm-adapter/AutoLoad/Watcher/AutoSave 无残留 |
| 2026-08-22 | 008 | 安全负向测试：并发同 expected version 编辑恰好一胜一 409；inactive/archived/未知角色分配拒绝；Catalog 外 key 写入前失败且版本不变；owner 权限不可编辑；取消从 mutation 与 login 保留；账号禁用后 Session 失效且不可重登；runtime 受限会话非自助权限改为业务 deny（403）而非 error（500）；operation gate 401/403/内部错误映射与 security scheme 路由测试；SQLite runtime E2E（setup→role→grant→account→assign→首次改密→login→allow→revoke→deny）全部通过 |
| 2026-08-22 | 009 | authority 更新：技术选型 Permission/AuthZ 行改为 Casbin 已采用并固定使用边界；IAM README（evaluator/revision/动态分配/窄 facet）、Auth README（AuthorizationSource/DecisionPoint）、模块开发权限接入说明、安全文档授权决策约束；`docs/changes/README.md` 058 行更新为已确认/实施中；创建 `documentation-impact.yaml` |
| 2026-08-22 | 010 | 门禁：`go test ./...`、`go test -race ./...`、`go vet ./...`、`go build ./cmd/app`、contract-gen、webui generate --check、docs-guard、`govulncheck`（0 已调用漏洞；x/image/x/crypto 各有 1 个 module 级未调用项为既有间接依赖）、`git diff --check`、残留搜索全部通过；Postgres/MySQL migration contract 为 env 驱动（本地无 DSN 自动跳过，CI database.yml 提供） |
| 2026-08-22 | 提交 | Commit `4dcf9d9 feat(iam): adopt casbin rbac evaluator behind decisionpoint port`；67 个任务文件（另保留其他任务的 `docs/changes/059-webui-shell-experience-upgrade/` 与 `webui/styles-debug-rules.txt` 未提交） |
| 2026-08-22 | 006 | 动态分配升级：`AccountRolesSnapshot/RolePermissionsSnapshot` 返回 entity version + authorization revision + 完整集合；`ReplaceAccountRoles/ReplaceRolePermissions` 提交 expected version + 期望集合，version 冲突稳定 409、no-op 不 bump/不撤销、diff 计数与新版本返回；HTTP 契约改为快照对象与 assignmentResponse；修复 mutationInput embedded path 绑定不可靠问题（status/password-reset 同模式扁平声明）；WebUI RolesPage 改 Catalog 权限矩阵（按 OwnerModuleID 分组）与 AccountsPage 角色 checklist；webui typecheck/test/eslint/i18n/lint-modules 全部通过 |
