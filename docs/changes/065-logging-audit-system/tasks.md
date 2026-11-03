# 065 任务清单：日志与审计体系进阶（业务操作审计）

## 状态

研究门禁已通过（R065-001）；用户已确认决策 1–5 推荐项；**实施完成**。以下为任务执行证据。

## 任务

| ID | 工作量 | 依赖 | 内容 | 完成条件 | 状态 |
| --- | --- | --- | --- | --- | --- |
| `RES-065-001` | M | — | 研究档案（日志/审计现状、缺口、候选方向） | metadata/report/README 齐全 | 完成 |
| `PLAN-065-001` | M | RES | 需求/设计/任务/影响计划并确认 | 文档齐全；用户确认决策 1–5 | 完成 |
| `AUDW-065-001` | M | 确认 | Auth `OperationAuditWriter` port + `RecordOperation`（低敏字段域） | 复用 AuditSink；subject/resource 哈希；无内容泄漏 | 完成 |
| `AUDW-065-002` | S | AUDW-001 | `auth.audit.list` 支持 action/resourceType 过滤 | 过滤稳定；既有查询不回归 | 完成 |
| `IAM-065-001` | M | AUDW-001 | IAM 写操作接入（6 个方法） | 低敏事件；成功/失败语义正确 | 完成 |
| `ORG-065-001` | M | AUDW-001 | Organization 写操作接入（部门/岗位/分配） | 同上 | 完成 |
| `NAV-065-001` | S | AUDW-001 | Navigation 写操作接入（菜单策略更新） | 同上 | 完成 |
| `WIRE-065-001` | M | 上述 | composition 把 Auth writer 适配为各模块 port 并注入 | 模块不 import Auth 实现 | 完成 |
| `WEB-065-001` | M | AUDW-002 | 审计页筛选（action/resourceType/outcome/actorKind） | 双语、低敏、生成链通过 | 完成 |
| `TEST-065-001` | M | 上述 | Go/WebUI 测试（auth storage record/filter、IAM/ORG/NAV fake-writer、低敏、不阻断） | `go test ./...`、WebUI 门禁全绿 | 完成 |
| `DOC-065-001` | M | 上述 | logging.md 新增操作审计节；security/runtime-capabilities/webui/module 指南同步；变更记录 | docs-guard 通过；authority 一致 | 完成 |
| `VER-065-001` | M | 全部 | 全量验证与提交 | 无失败；受限项如实标注 | 完成 |

## 验证矩阵（实测结果）

| 门禁 | 命令/入口 | 结果 |
| --- | --- | --- |
| Go 单元/集成 | `go test ./...` | 全绿（含新增 writer/接入/过滤测试） |
| Go 静态 | `go vet ./...` | 通过 |
| WebUI 生成 | `corepack pnpm generate:check` | 通过 |
| WebUI 静态 | lint-modules / lint-architecture / lint-i18n / tsc / eslint | 通过（eslint 仅 1 个既有无关 warning） |
| WebUI 测试 | Vitest（含 layout） | 82 用例通过 |
| E2E | Playwright（dev + mock） | 11 用例通过 |
| 文档 | docs-guard | 通过 |

## 未执行/受限项

- 日志查询 API / 日志数据库 / 外部日志平台：保持 041/028 非目标。
- 对象级 before/after 差异视图、MFA/数据权限/外部身份：后续候选方向（仅记录）。
- 容器 runtime / 远端 CI 浏览器验收：保持既有独立验证边界。