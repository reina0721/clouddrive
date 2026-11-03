# 066 任务清单：账号与权限体系闭环缺口补齐

## 状态

研究门禁已通过（R066-001）；用户已确认决策 1–5 推荐项；**实施完成**。以下为任务执行证据。

## 任务

| ID | 工作量 | 依赖 | 内容 | 完成条件 | 状态 |
| --- | --- | --- | --- | --- | --- |
| `RES-066-001` | M | — | 研究档案（四要素缺口、边界、按批路径） | metadata/report/README 齐全 | 完成 |
| `PLAN-066-001` | M | RES | 需求/设计/任务/影响计划并确认 | 文档齐全；用户确认决策 1–5 | 完成 |
| `ACC-066-001` | M | 确认 | IAM 账号资料更新（repo.AccountChanges.DisplayName + UpdateAccountInfo + PATCH + SecurityRevision/Session 撤销 + 审计） | 改名生效；Session 撤销；409 语义不变 | 完成 |
| `ACC-066-002` | M | ACC-001 | IAM 账号归档（模型/迁移 archived 列 + ArchiveAccount + login/resolve/分配拦截 + owner 不变量） | 归档不可登录/不可分配；owner 保护；migration 000003 三驱动 up/down | 完成 |
| `ROLE-066-001` | S | 确认 | IAM 角色资料更新（UpdateRoleInfo + PATCH；不触发授权 revision） | 改名生效；版本乐观并发；owner 拒绝 | 完成 |
| `ROLE-066-002` | M | ROLE-001 | IAM 角色归档（ArchiveRole 走 authorizeMutation + 快照过滤 + owner 拒绝 + HTTP） | 归档移出可分配与授权；受影响 Session 撤销；候选发布 | 完成 |
| `WEB-066-001` | M | ACC/ROLE | 管理页按钮级权限接入（Binding ActionPermissions + 页面换 ActionTrigger + 生成链） | Manifest.actionPermissions 正确；按钮按 access 显隐；宿主零改动 | 完成 |
| `WEB-066-002` | M | WEB-001 | 列表过滤/分页 + 409 差异确认 UI + 分配页乐观锁（含 org 000002 迁移） | 过滤分页可用；冲突展示 added/removed diff 并重加载；双语 | 完成 |
| `TEST-066-001` | M | 上述 | Go/WebUI 测试（归档/改名/按钮显隐/409/过滤/迁移） | `go test ./...`、WebUI lint/typecheck/test/E2E、generate:check 全绿 | 完成 |
| `DOC-066-001` | M | 上述 | 更新 webui.md/security.md/runtime-capabilities.md/模块 README/变更记录 | Docs 校验通过；authority 一致 | 完成 |
| `VER-066-001` | M | 全部 | 全量验证与提交 | 无失败；受限项如实标注 | 完成 |

## 验证矩阵（实测结果）

| 门禁 | 命令/入口 | 结果 |
| --- | --- | --- |
| Go 单元/集成 | `go test ./...` | 全绿（含新账号/角色生命周期、组织分配版本断言） |
| Go 静态 | `go vet ./...` | 通过 |
| 契约生成 | `go generate ./...` + contract-gen golden | 通过；`api/openapi.yaml`/operation inventory 重新生成（新增 4 operation） |
| WebUI 生成 | `corepack pnpm generate:check` | 通过（webui-registry 重新生成） |
| WebUI 静态 | eslint / lint-modules / lint-architecture / lint-i18n / tsc | 通过（ESLint 仅 1 个既有无关 warning） |
| WebUI 测试 | Vitest（含 layout test） | 82 用例通过 |
| E2E | Playwright（dev + mock） | 通过 |
| 文档 | docs-guard | 通过 |

## 未执行/受限项

- 组织数据权限、角色-菜单绑定、动态菜单、按钮独立权限键、MFA、外部身份/多租户/ABAC：列为候选方向，未实施、未获授权。
- 账号/角色归档恢复流程与物理删除：本批不做（归档即终态，恢复另行立项）。
- 容器 runtime / 远端 CI 浏览器验收：保持既有独立验证边界。