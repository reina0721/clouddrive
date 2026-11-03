# 054 IAM 身份与访问管理任务

## 确认状态

研究已按 053 完成提交刷新，053 已完成，用户已明确确认 `IAM-054-001..009`。

| ID | 工作量 | 依赖 | 任务 | 完成条件 | 状态 |
| --- | --- | --- | --- | --- | --- |
| `IAM-054-001` | XL | 053、用户确认 | 冻结 IAM model、permission 和事务不变量 | model/package tests 覆盖 identity/RBAC/owner/revision；无 Organization/Navigation/Auth import | 完成 |
| `IAM-054-002` | XXL | 001 | 建立 IAM 三驱动 schema 与 Repository | fresh/repeat、unique/FK/replace/rollback/optimistic/checksum 通过 | 完成 |
| `IAM-054-003` | XXL | 002 | 实现 Account/Credential/Session Service | setup/login/lockout/must-change/change/reset/disable/revision 测试通过 | 完成 |
| `IAM-054-004` | XL | 002,003 | 实现 Role/Permission/owner Service | Catalog compatibility、role/permission replace、last owner 并发测试通过 | 完成 |
| `IAM-054-005` | XL | 003,004 | 实现 typed HTTP 与稳定错误 | 全部 IAM operation、security、Origin/CSRF、分页和 401/403/409 通过 | 完成 |
| `IAM-054-006` | XL | 003..005 | 单轨迁移 Auth、配置、CLI 与 composition | IAM resolver 接管；旧 webuiauth/auth.local/password/WebUI/CLI 无残留；JWT/Todo/management 回归 | 完成 |
| `IAM-054-007` | XXL | 005,006 | 实现 IAM WebUI | Setup/Login/Security/Accounts/Roles/Permissions 生成、测试与视觉验收通过 | 完成 |
| `IAM-054-008` | M | 002..007 | 同步 authority 与反向门禁 | IAM/Auth/security/config/API/module/first-use 文档一致，跨边界和旧符号门禁通过 | 完成 |
| `IAM-054-009` | XL | 002..008 | 全量验证并提交 | Go/WebUI/E2E/视觉/三驱动证据完整，只提交 054 范围 | 完成 |

## 重新确认触发器

- 053 未按当前契约完成；
- 加入外部 IAM、MFA、多租户、角色继承、deny、账号直授权或数据范围；
- IAM 开始拥有 Department/Position/MenuPolicy；
- 需要保留 Auth local 双轨或自动迁移退休本地账号；
- 默认 `.data/app.db` 需要任何写入或破坏性操作。

## 完成证据

- IAM：setup、固定成本登录、lockout、首次改密、Session/CSRF、SecurityRevision、角色权限替换、Catalog 扩展对账和最后 owner 并发保护均有 Go 测试。
- HTTP：typed security、Origin/CSRF、401/403/409、账号与角色 offset/limit 分页、关系读取/替换进入 OpenAPI 与 operation inventory。
- Migration：SQLite fresh 与 repeat up 通过；PostgreSQL/MySQL 嵌入 SQL 和 SHA-256 静态校验通过。未配置真实 PostgreSQL/MySQL DSN，因此未声称真实 server migration。
- 工程门禁：`go test ./...`、`go test -race -p 1 ./... -count=1`、`go vet ./...`、CGO-free `go build ./...`、`go mod tidy -diff`、`gofmt -l`、project-layout identity、确定性 `go generate` 和 `git diff --check` 通过。
- WebUI：`scripts/Verify-WebUI.ps1` 通过 registry、frozen install、lint、module lint、typecheck、13 个测试文件/38 个测试和 production build；Playwright 7 个场景通过。账号、角色、权限页面截图经人工检查，未见截断、溢出或缺失翻译。
- 文档：`scripts/Verify-Docs.ps1` 通过，`documentation-impact.yaml` 覆盖本次命中的 authority。
- 单轨迁移：Auth 仅保留通用 Principal、Bearer/JWT 与授权决策；旧 local password、webuiauth、WebUI、CLI 和 `auth.local` 当前引用已删除。
- 数据安全：所有数据库测试均使用 `t.TempDir()`；默认 `.data/app.db` 未写入、移动、覆盖或删除。
- 既有阻塞：`scripts/Verify-Artifacts.ps1` 仍只命中排除范围 `old-backend/` 中两个历史已跟踪 `app.db`；054 未新增或修改受禁 artifact，不越界清理历史目录。
- Commit：本次 054 Conventional Commit，具体 hash 以 Git history 和交付报告为准。
