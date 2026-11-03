# 064 设计方案：账号与权限体系进阶

## 1. 背景与目标形态

当前体系已闭环：IAM 有状态 Session + Core RBAC（Casbin evaluator + authorization revision + 乐观并发关系替换）、Auth 双来源 Principal + DecisionPoint + 低敏审计日志、Organization 组织目录（不进授权）、Navigation 菜单策略、Catalog 精确键、WebUI 仅呈现控制。进阶设计按“真实缺口 + 单一 owner + 可验证闭环”分批，首批 = **可查询低敏审计（Auth）** + **账号会话集中管理（IAM）**，其余候选（MFA、数据权限、外部身份、多租户）只记录方向、不实施。

## 2. 方案对比

| 方案 | 做法 | 结论 |
| --- | --- | --- |
| A（采纳） | Auth 新增持久化审计 Sink + 只读查询；IAM 新增会话列表/批量吊销能力；配套 PermissionKey、WebUI、测试、文档 | 缺口真实、owner 清晰、可在既有边界内闭环 |
| B（不采纳） | 一次性引入 MFA/TOTP + 密码策略 + 数据权限 | 外部证据未核验（当前 web 检索受限）、耦合面大、突破 055 边界，超出单批可验证范围 |
| C（不采纳） | 接入外部审计系统/OIDC/多租户 | 057/053 判定非目标，无真实用例时属无收益扩界 |

## 3. 数据流与实现位置

### 3.1 可查询低敏审计（Auth）

```
Auth EnforceOperation/EnforceAction --AuditEvent--> service.AuditSink
   └-- 持久化 Sink（新，pkg/database 租约）--> auth_audit_events（migration set 归 Auth）
查询：Auth 只读接口 --filters/offset/limit--> 低敏事件视图
权限：新 Key auth:audit:read（Auth binding/permission）--> Catalog + ReconcileOwnerCatalog
```

- 事件语义沿用 `model.AuditEvent`（Operation/Action/Principal/Resource/Decision/Outcome），Sink 继续只写脱敏字段（subject_hash/resource_hash 等）。
- 查询返回同 Sink 脱敏后的视图；分页 + 可选过滤（时间窗/operation/outcome/actor_kind）；排序稳定（时间倒序 + 稳定 tie-breaker）；不提供删除/篡改接口。
- logger Sink 与持久化 Sink 取舍：设计决策 1 推荐「持久化 Sink 为主、logger 降为 debug 级补充或退役其一」，提交后单轨清理。

### 3.2 账号会话集中管理（IAM）

```
IAM Service --ListSessions/RevokeSessions--> repo（既有 Session/安全修订路径）
HTTP：GET /api/v1/iam/sessions（按账号过滤或自助）、POST /api/v1/iam/sessions/{id}/revoke
权限：iam:session:read / iam:session:revoke（管理员）；自助视图用 iam:account:self:* 语义
```

- 列表返回会话元数据（创建/空闲/绝对过期、已吊销标记、账号摘要），**不返回 SessionID 明文**（仅摘要在审计/日志使用）。
- 批量吊销沿用 `RevokeAccountSessions`/`RevokeSession` 与 `bumpAndRevoke` 语义；只能撤销非当前或按账号的全量（owner 不变量：不可把自己锁死——需确认是否允许撤销自身全部受信会话）。
- 会话表已有 `iam_sessions`（IDHash/CSRFHash/SecurityRevision/expires），可扩展查询索引/过滤字段需迁移评估（新增 migration set 版本或复用现有表只读）。

### 3.3 WebUI

- Auth owner 审计页：列表/过滤/分页，zone/action 权限经既有 Manifest 呈现；双语 locale；模块自有 mock。
- IAM owner 会话页：当前账号会话列表 + 批量撤销（动作级权限钩子 `ActionPermission`）；自持页面与 mock。
- 不修改宿主源码；遵循 WebUI 接入四步与生成链。

## 4. 文件影响（估算）

| 文件 | 动作 |
| --- | --- |
| `internal/module/auth/{model,service,adapter/audit}` | 扩展：持久化 Sink、查询接口、事件视图 |
| `internal/module/auth/binding/permission/definitions.go` | 新增 `auth:audit:read` |
| `internal/module/auth/binding/http`（如新增） | 审计查询 operation/handler |
| `internal/module/auth/binding/migration`（新 set 或扩展） | audit 表 |
| `internal/module/iam/{service,repo,binding/http}` | 会话列表/批量吊销 |
| `internal/module/iam/binding/permission/definitions.go` | 新增 `iam:session:*` |
| `internal/module/{auth,iam}/binding/webui/**` | 审计页/会话页及 locale/mock |
| `internal/permission/catalog_test`、composition 测试 | 权限键/引用/owner 覆盖断言 |
| `docs/development/webui.md`、`docs/operations/{security.md,runtime-capabilities.md}`、变更记录 | 同步 |

## 5. 失败语义与边界

- 审计写入失败：不得阻断业务 mutation；按“记录审计失败”的低敏错误返回（不吞错、不外泄事件内容）。
- 会话查询/吊销：未认证/缺权限 fail closed；吊销当前会话外的会话不破坏自身登录；owner 不变量不得被批量吊销破坏。
- 权限键缺失、引用越界、webui locale 缺失由既有门禁拒绝。
- 本地数据库：`iam_sessions`/`auth_audit_events` 相关迁移只增不改；`navigation_menu_policies` 不受影响。

## 6. 验证方案

1. Go：auth/iam 服务、repository（含迁移）、HTTP contract、permission catalog 引用与 owner 覆盖测试；`go test ./...`、`go vet ./...`。
2. WebUI：生成链（registry/mock 同步）、lint、typecheck、Vitest；Playwright 本机可运行时执行既有用例。
3. 文档：`scripts/Verify-Docs.ps1`、`documentation-impact.yaml`。
4. 人工复核：审计事件内容低敏、会话响应无明文 ID、mock 与真实语义一致。

## 7. 待确认决策

- 决策 1（推荐）：审计持久化 Sink 为主，logger Sink 降为 debug 级补充或退役其一（单轨，不留双 authority）。
- 决策 2（推荐）：首批只做「可查询审计 + 会话集中管理」两个闭环；MFA/数据权限/外部身份列入下一批方向记录，不实施。
- 决策 3（推荐）：会话撤销允许按账号批量撤销受信 Session，但当前登录会话可由自助页面选择保留；owner 不变量继续由既有逻辑守护。
- 决策 4（推荐）：审计表保留策略首版为“受控上限 + 显式配置”，不做自动归档删档。
- 决策 5（推荐）：查询权限键进入既有 Catalog 与 owner 自动覆盖机制，不新建第二套授权。