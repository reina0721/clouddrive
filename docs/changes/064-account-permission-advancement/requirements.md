# 064 需求规格：账号与权限体系进阶

引用研究：[R064-001](research/R064-001-account-permission-baseline/report.md)。

## 1. 目标

在当前已闭合的账号与权限体系（IAM 身份凭据会话 + Auth 授权审计 + Organization 组织目录 + Permission Catalog + WebUI 权限呈现）之上，按「真实缺口 + 单一 owner + 可验证闭环」原则做**进阶设计并分批准实施**。首批聚焦当前体系内、模块边界内、可独立验证的进阶；涉及外部身份接入、多租户、ABAC/ReBAC、组织数据权限等更大平台演化只做方向记录，不在本批实施且不获得授权。

## 2. 首批功能要求（推荐范围，待用户确认）

| ID | 要求 |
| --- | --- |
| `REQ-064-001` | **可查询低敏审计**：在 Auth 模块新增审计存储与查询能力（当前只有 logger sink，无查询 API）。审计事件继续沿用低基数分类与脱敏语义（operation/action/actor_kind/subject_hash/resource_type/resource_hash/decision/outcome），不得引入原始 token、claims、DSN、完整 URL 或对象内容。 |
| `REQ-064-002` | 审计写入与查询统一走 Auth module 自有契约：新增持久化 Sink（或组合 Sink）实现 `service.AuditSink`；查询由只读接口返回低敏事件视图，分页 + 可选过滤（时间窗/operation/outcome/actor_kind/subject_hash），排序稳定。 |
| `REQ-064-003` | 审计查询权限化：新增精确 PermissionKey（如 `auth:audit:read`）进入 Permission Catalog，查询 operation 使用 protected profile + 该权限键；owner 不变量（owner 具备全部目录权限）经 `ReconcileOwnerCatalog` 自动覆盖。 |
| `REQ-064-004` | **账号会话集中管理**：IAM 提供按账号列出/批量吊销受信 Session 的只读与写能力（沿用既有 Session 撤销与安全修订语义），账号变更/吊销过程继续 fail closed，不得泄漏 SessionID 明文（仅摘要视图）。 |
| `REQ-064-005` | 会话管理权限化：新增精确 PermissionKey（如 `iam:session:read` / `iam:session:revoke`）进入 Catalog；owner 自动覆盖；自助视图只允许查看/吊销自己当前之外的会话（`iam:account:self:*` 语义）。 |
| `REQ-064-006` | WebUI 呈现：新增审计查询页（Auth owner）与账号会话管理页（IAM owner），遵循 WebUI 模块接入四步、强制 i18n、受控图标与 zone/action 权限契约；不修改宿主代码。 |
| `REQ-064-007` | 保持既有边界：不上移权限模型（Casbin Core RBAC 固定）、不把组织关系引入授权决策（055 边界）、不改 Session Cookie/CSRF/Origin 语义、不引入外部身份/多租户/ABAC。 |
| `REQ-064-008` | 演进单轨：若采用持久化审计 Sink，旧 logger Sink 的去留由设计决策确定（推荐 logger 保留为 debug 级补充或退役其一），提交后必须删除无调用方实现，不留双套 authority。 |

## 3. 下一批候选方向（仅记录，不实施）

- MFA/TOTP 与凭据策略（密码历史/过期/强度）进阶：外部库选型与 OWASP/NIST 基线需独立研究（当前 web 检索能力受限，外部证据未核验，不能在本批实施）。
- 组织数据权限（部门/岗位范围进入授权决策）：**055/R005 明确“不自动获得数据范围”**，属于重大边界突破，必须单独确认范围与决策模型。
- 外部身份（OIDC/SSO/服务账号 API Key）、多租户、ABAC/ReBAC、动态权限模型：按 053/057 判定保持非目标。

## 4. 非功能要求

- 新增/修改权限键、HTTP operation、路由与迁移必须按模块开发指南与 051 文档治理执行；不新增第三方依赖（除非设计确认有真实收益）。
- 审计存储关注保留边界与容量上限；不记录敏感内容；查询结果继续低敏。
- 并发与事务：审计写入不得阻塞业务 mutation 主路径；批量吊销沿用既有带版本/安全修订的撤销路径。

## 5. 验收标准

1. 审计事件写入持久化 Sink，查询 API 返回低敏分页结果且可过滤；日志 Sink 与持久化 Sink 的关系按决策 1 落地且无残留双套。
2. 会话列表/批量吊销 API 对 owner 与自助主体语义正确；SessionID 明文不进入响应或日志。
3. 新增权限键进入 Catalog 且 owner 被 `ReconcileOwnerCatalog` 自动覆盖；受保护 operation 缺权限 fail closed。
4. WebUI 审计页与会话管理页双语可用、zone/action 权限呈现正确；`generate:check`、lint、typecheck、Vitest 通过。
5. Go 测试（IAM/Auth/composition）与既有 e2e 不回归；文档 authority（webui.md/runtime-capabilities.md/security.md）与实现一致。

## 6. 非目标

- 不实施 MFA/外部身份/多租户/ABAC/数据权限（除非用户对下一批单独确认）。
- 不改变 Casbin evaluator 模型、Session/CSRF/Cookie 语义、授权 authority（RolePermission 仍唯一）。
- 不提供审计“删除/篡改”或证书类能力；不在宿主集中实现业务页面。