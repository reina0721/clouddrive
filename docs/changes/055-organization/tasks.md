# 055 Organization 组织目录任务

## 确认状态

研究已按 054 完成提交刷新，用户已明确确认 `ORG-055-001..007`。

| ID | 工作量 | 依赖 | 任务 | 完成条件 | 状态 |
| --- | --- | --- | --- | --- | --- |
| `ORG-055-001` | XL | 053/054、用户确认 | 冻结组织 Model、permission 与 AccountDirectory | tree/position/assignment/package tests；无 IAM/Auth import 和 data scope | 完成 |
| `ORG-055-002` | XL | 001 | 建立三驱动 schema 与 Repository | fresh/repeat、unique/replace/rollback/optimistic/checksum 通过 | 完成 |
| `ORG-055-003` | XL | 002 | 实现 Department/Position/Assignment Service | 环/深度/移动/引用/primary/multi-position/分页测试通过 | 完成 |
| `ORG-055-004` | M | 003 | 实现 IAM AccountDirectory composition Adapter | 不返回 IAM DTO；不存在/不可分配/error chain 测试通过 | 完成 |
| `ORG-055-005` | XL | 003,004 | 实现 typed HTTP 与稳定错误 | departments/positions/assignments、permission、分页、401/403/409 通过 | 完成 |
| `ORG-055-006` | XL | 005 | 实现 Organization WebUI 与文档门禁 | Departments/Positions/assignment 生成、测试、视觉及 authority 文档通过 | 完成 |
| `ORG-055-007` | XL | 002..006 | 全量验证并提交 | Go/WebUI/E2E/视觉/三驱动证据完整，只提交 055 范围 | 完成 |

## 完成证据

- `go test ./... -count=1`、`go vet ./...`、CGO-free `go build -trimpath -buildvcs=false ./...` 通过。
- `go test -race -p 1 ./internal/module/organization/... ./internal/composition -count=1` 通过。
- SQLite fresh/repeat migration 与三驱动 SQL checksum 校验通过；所有数据库测试只使用 `t.TempDir()`。
- `Verify-WebUI.ps1` 通过（14 个测试文件、39 个测试及 production build）；Playwright 8 个场景通过，并人工检查部门、岗位、账号组织分配截图。
- `go generate ./...` 前后 OpenAPI 与 operation inventory SHA-256 不变；WebUI registry、project layout、`go mod tidy -diff`、`gofmt`、docs-guard 和 `git diff --check` 通过。
- 反向搜索确认 `internal/module/organization` 不导入 IAM、Auth 或 Navigation；组织关系未接入 RolePermission、`SecurityRevision` 或 Auth decision。

## 重新确认触发器

- 加入部门数据范围、多租户、汇报线、岗位层级或 HR 模型；
- 要求跨 IAM/Organization 原子创建或模块直接 import；
- 复制 Account、Role、Permission 或 Session 状态；
- 053/054 契约实质变化。
