# 064 任务清单：账号与权限体系进阶

## 状态

研究门禁已通过（R064-001）；用户已确认决策 1–5 推荐项；**实施完成**。以下为任务执行证据。

## 任务

| ID | 工作量 | 依赖 | 内容 | 完成条件 | 状态 |
| --- | --- | --- | --- | --- | --- |
| `RES-064-001` | M | — | 研究档案（能力边界、缺口、候选方向） | metadata/report/README 齐全 | 完成 |
| `PLAN-064-001` | M | RES | 需求/设计/任务/影响计划并确认 | 文档齐全；用户确认决策 1–5 | 完成 |
| `AUD-064-001` | M | 确认 | Auth 持久化审计 Sink（`auth_schema_migrations`/`auth_audit_events` + 写入 + 脱敏视图 + 保留上限） | 写入不阻业务；低敏；logger 降级补充 | 完成 |
| `AUD-064-002` | M | AUD-001 | 审计只读查询（分页 + 过滤 + 稳定排序）`auth.audit.list` | 返回低敏视图；无删除/篡改入口 | 完成 |
| `AUD-064-003` | S | AUD-002 | `auth:audit:read` 进入 Catalog + HTTP operation + owner 覆盖 | Catalog/引用/owner 覆盖完整 | 完成 |
| `SESS-064-001` | M | 确认 | IAM 会话列表（`iam.sessions.list`，摘要视图不泄露明文） | 元数据视图；权限 fail closed | 完成 |
| `SESS-064-002` | M | SESS-001 | 批量/单会话吊销（`iam.sessions.revoke`，安全修订 + owner 不变量） | 当前会话可由调用方决策保留 | 完成 |
| `SESS-064-003` | S | SESS-002 | `iam:session:read/revoke` 进入 Catalog + HTTP operation + owner 覆盖 | Catalog/引用/owner 覆盖完整 | 完成 |
| `WEB-064-001` | M | AUD/SESS | 审计页（Auth）+ 会话管理页（IAM）：Binding/locale/mock/CSS + Vitest | 生成链与门禁通过；双语；宿主零改动 | 完成 |
| `TEST-064-001` | M | AUD/SESS | Go/WebUI 测试（含迁移/权限/低敏/保留上限/会话断言） | `go test ./...`、WebUI lint/typecheck/test 全绿 | 完成 |
| `DOC-064-001` | M | 上述 | 更新 webui.md、security.md、runtime-capabilities.md、application-module-development.md、变更记录 | Docs 校验通过；authority 一致 | 完成 |
| `VER-064-001` | M | 全部 | 全量验证与提交 | 无失败；受限项如实标注 | 完成 |

## 验证矩阵（实测结果）

| 门禁 | 命令/入口 | 结果 |
| --- | --- | --- |
| Go 单元/集成 | `go test ./...` | 全绿（含新 storage sink/会话/composition 断言） |
| Go 静态 | `go vet ./...` | 通过 |
| WebUI 生成 | `corepack pnpm generate:check` | 通过（registry 重新生成） |
| WebUI 静态 | eslint / lint-modules / lint-architecture / lint-i18n / tsc | 通过（ESLint 仅 1 个既有无关 warning） |
| WebUI 测试 | Vitest（含 layout test） | 82 用例通过 |
| E2E | Playwright（dev + mock） | 11 用例通过 |
| 文档 | `docs-guard` | 通过 |

## 未执行/受限项

- MFA/TOTP、组织数据权限、外部身份/多租户/ABAC：列为下一批候选，未实施、未获授权。
- 自动归档/导出与异地审计聚合：首版未覆盖（保留上限 + 显式配置）。
- 容器 runtime / 远端 CI 浏览器验收：保持既有独立验证边界。