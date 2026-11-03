# 080 任务清单：API-Token 多令牌管理与权限知情创建

## 状态

研究门禁已通过（[R080-001](research/R080-001-token-gap-and-inheritance/report.md)）；计划已确认（用户确认实施；并确认「复杂功能独立页面、安全页只作入口」设计原则）；**实施完成并验证**（2026-09）。

## 任务

| ID | 工作量 | 依赖 | 内容 | 完成条件 | 状态 |
| --- | --- | --- | --- | --- | --- |
| `RES-080-001` | M | — | 现状差距核实 + 权限知情/状态机/契约设计研究 | metadata/report 齐全；门禁通过 | 完成 |
| `PLAN-080-001` | M | RES | 需求/设计/任务/影响计划并提交确认 | 文档齐全；用户确认范围与设计原则 | 完成 |
| `TOKEN-080-001` | M | 确认 | 权限知情创建（ProjectPermissions 实时投影 + scopes ⊆ 创建者权限 + 受限拒绝 + 上限/TTL 配置 + 错误映射） | 越权 403/未知 404/受限 403/上限 409（测试验证） | 完成 |
| `TOKEN-080-002` | M | TOKEN-001 | 状态机（migration 000008 + 派生状态 + Resolve disabled/expired 401 + status 过滤） | 状态矩阵正确；Count/List 同条件 | 完成 |
| `TOKEN-080-003` | M | TOKEN-002 | HTTP 契约扩展（PATCH/disable/enable + status 参数 + contract-gen + 响应字段） | 3 新 operation；契约 golden（55 operations） | 完成 |
| `TOKEN-080-004` | S | TOKEN-003 | 审计/告警（update/disable/enable 走 auditOperation，敏感写集合扩展） | 事件落库无明文；privilege_changed 覆盖 | 完成 |
| `WEB-080-001` | M | TOKEN-003 | IAM 独立页 `/admin/api-tokens`（列表/status 过滤/创建向导权限勾选/明文一次/开关/轮换/吊销 + Binding/locale/mock，挂 iam.access） | Vitest/e2e；受限隐藏 | 完成 |
| `WEB-080-002` | S | WEB-080-001 | settings 安全页令牌区块降级为入口+摘要（跳转 /admin/api-tokens；MFA 保留） | 入口可跳转；摘要正确 | 完成 |
| `TEST-080-001` | M | 上述 | Go/WebUI 测试（越权/生命周期/过滤/上限/TTL/迁移/审计/向导/入口） | `go test ./...`、Vitest 144、Playwright 22 全绿 | 完成 |
| `DOC-080-001` | M | 上述 | 更新 security/runtime-capabilities/api/配置/模块 WebUI README/变更记录 | docs-guard 通过 | 完成 |
| `VER-080-001` | M | 全部 | 全量验证与提交 | 无失败；受限项如实标注 | 完成 |

## 验证矩阵（实测结果）

| 门禁 | 命令/入口 | 结果 |
| --- | --- | --- |
| Go 单元/集成 | `go test ./...` | 全绿（TestApiTokenScopeInheritance/LifecycleStates/ExpiryViaLaterClock/LimitAndDefaultTTL） |
| Go 静态 | `go vet ./...` | 通过 |
| 迁移 | migration 000008 三驱动 | 通过（ValidateSet + up/down） |
| 契约 | `go generate ./...` + golden | 通过（55 operations，+3 新 operation） |
| WebUI | typecheck/lint:modules/lint:i18n/lint:architecture/Vitest 144/Playwright 22 | 通过 |
| 文档 | docs-guard | 通过 |

## 未执行/受限项

- 资源级（zone/app）作用域、跨账号委派、使用配额/强制轮换：候选（R080 非目标）。
- 令牌到期自动回收/清理任务、历史 scope 集合 diff 审计：候选；「不自动收缩」治理语义已文档化。
- WebUI 明文弹窗基于既有 InlineAlert（未引入新弹窗依赖）。