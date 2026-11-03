# 076 任务清单：RBAC / HTTP API 未闭环缺口修复

## 状态

研究门禁已通过（[R076-001](research/R076-001-rbac-http-api-gap-audit/report.md)）；计划已确认（用户确认：全部 5 组缺口纳入本批；G5 采用 min/max + 可选复杂度开关默认关）；**实施完成并验证**（2026-09）。

## 任务

| ID | 工作量 | 依赖 | 内容 | 完成条件 | 状态 |
| --- | --- | --- | --- | --- | --- |
| `RES-076-001` | M | — | 研究档案（五类缺口事实、消费方、改动面、方案对比） | metadata/report/README 齐全；门禁通过 | 完成 |
| `PLAN-076-001` | M | RES | 需求/设计/任务/影响计划并提交确认 | 文档齐全；用户确认推荐范围 | 完成 |
| `GAP1-076-001` | M | 确认 | org operation 迁移 `webuiSession` + mutation 接 `iamMutationGuardAdapter`；org 前端 mutation 补 Origin/X-CSRF-Token | 模式 B 契约闭环（Go 断言 org operations 全 webuiSession）；403 csrf_invalid 语义与 navigation 一致 | 完成 |
| `GAP2-076-001` | M | 确认 | role→accounts 反向查询（repo Count/ListAccountsByRole + service ListAccountsForRole + GET /roles/{id}/accounts） | 分页正确；无权限 403；未知角色 404 | 完成 |
| `GAP2-076-002` | M | GAP2-001 | permission→roles 反向查询（repo List/CountRolePermissionsByKey + service ListRolesForPermission + GET /permissions/roles?key=…） | key 走 query；未知 key 404；分页正确 | 完成 |
| `GAP3-076-001` | M | 确认 | 会话列表分页与 status 过滤（repo 分页/active/revoked + service ListSessions(offset/limit/status) + HTTP） | 真实 total；active 排除过期/吊销；IDHash 摘要不变 | 完成 |
| `GAP4-076-001` | M | 确认 | 账号列表多维过滤（repo AccountFilter + service + HTTP status/archived/roleId） | Count/List 同 filter；无过滤时行为不变 | 完成 |
| `GAP5-076-001` | S | 确认 | 密码策略配置化（configbinding PasswordPolicy + Decode 校验 + model 参数化校验 + service 冻结 + 4 调用点迁移 + config init/示例） | 默认 15/128 不变；开关默认关；存量登录兼容 | 完成 |
| `TEST-076-001` | M | 上述 | Go 测试（反向查询/分页/过滤/密码策略/org security 断言）+ WebUI 测试（CSRF 头模式、页面回归） | `go test ./...` 84 包全绿；vitest 144、Playwright 22（dev 20 + mock 2）通过 | 完成 |
| `DOC-076-001` | M | 上述 | 更新 security.md/runtime-capabilities.md/配置说明/模块 README/webui README/变更记录 | docs-guard 通过 | 完成 |
| `VER-076-001` | M | 全部 | 全量验证与提交 | 无失败；受限项如实标注 | 完成 |

## 验证矩阵（实测结果）

| 门禁 | 命令/入口 | 结果 |
| --- | --- | --- |
| Go 单元/集成 | `go test ./...` | 全绿（84 包，含新增反向查询/分页过滤/密码策略/org security 断言测试） |
| Go 静态 | `go vet ./...` | 通过 |
| 契约生成 | `go generate ./...` + contract-gen golden | 通过；`api/openapi.yaml`/operation inventory 重新生成（org security 变更 + 2 新 operation + 过滤分页参数） |
| 配置模板 | `go run ./cmd/app config init`（临时输出） | 生成 `iam.local.passwordPolicy`（默认 15/128/false） |
| WebUI 生成 | `corepack pnpm -C webui generate:check` | 通过（openapi-spec.ts 重生成并一致） |
| WebUI 静态 | typecheck / lint:modules / lint:architecture | 通过（仅 settings AccountPage 既有 1 warning） |
| WebUI 测试 | Vitest | 144 用例通过 |
| E2E | Playwright（dev 20 + mock 2） | 通过（dev 项目含 org 管理页渲染与认证链路用例） |
| 文档 | docs-guard | 通过（含补齐 settings 根 README 既有缺口） |

## 未执行/受限项

- **模式 B 真实后端闭环 e2e**：既有 Playwright 框架只有 dev（Vite + 路由拦截仿真 API）与 mock（零后端）两个 project，无法驱动真实 Go 服务；org 页面真实模式闭环由 Go 侧验证覆盖——org operations 全 `webuiSession` 断言、mutation guard 语义（composition 既有集成测试）、前端 mutation 头模式与 dev 链路用例。真实托管模式人工验收列为后续独立验证。
- 登录 IP 级限流、自助找回密码、MFA、外部身份/多租户/ABAC、数据权限、角色继承/deny/SoD：候选方向，未授权、未实施。
- 会话管理页/账号页的过滤控件 UI 呈现未在本批落地（以 API 闭环为准，页面最小化）。