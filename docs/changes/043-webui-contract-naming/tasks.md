# 043 任务清单

## 1. 当前状态

- 研究门禁：已通过（`R001`）。
- 计划状态：已确认。
- 确认证据：用户在 044 修复后明确指出已要求 `admin -> webui`，并补充范围包括文件夹和路由命名。
- Git 基线：`HEAD c08f12d`，研究开始时工作树干净，`main` 比 `origin/main` 领先一个未推送提交。

## 2. 任务

| ID | 依赖 | 任务 | 完成条件 | 状态 |
| --- | --- | --- | --- | --- |
| RES-001 | 无 | 复核 042 的旧名定义、调用方、wire、存储与文档 | R001 事实/推断/风险完整，研究门禁通过 | 已完成 |
| PLAN-001 | RES-001 | 形成单轨命名迁移需求、设计与任务 | 043 文档齐全并提交计划报告 | 已完成 |
| NAM-001 | 用户确认 | 重命名 WebUI Contract、Binding 与测试 | `internal/webui`、`binding/webui` 成为唯一契约路径 | 已完成 |
| NAM-002 | NAM-001 | 重命名 Auth WebUI Session 实现与数据库 migration | `webuiauth`、`webui_*` schema 和新 checksum 单轨通过 | 已完成 |
| NAM-003 | NAM-001,NAM-002 | 重命名 Composition、HTTP、CLI 与 codegen | 新 wire/命令/registry 唯一，旧入口不存在 | 已完成 |
| NAM-004 | NAM-003 | 重命名前端类型、消息、样式、brand、storage key 与 Cookie | 浏览器项目自有技术标识统一为 `webui` | 已完成 |
| GOV-001 | NAM-001..004 | 更新当前 authority，并将 042 标为历史命名 | 当前文档无双轨规范 | 已完成 |
| VER-001 | 全部 | 执行 Go/Node/生成/migration/旧名审计 | 验收命令通过，失败和白名单有证据 | 已完成 |

## 3. 验证证据

| 检查 | 结果 |
| --- | --- |
| `go test ./...` | 通过 |
| `pnpm lint`、`pnpm typecheck`、`pnpm build`、`pnpm generate:check` | 通过 |
| `go run ./cmd/app webui generate --check` | 通过 |
| `go run ./cmd/app admin generate` | 旧命令被拒绝 |
| 独立 SQLite migration | version 4、compatible=true，新 checksum manifest 通过 |
| 独立端口 HTTP | `/api/v1/webui/manifest`=200、未登录 session=401、旧 `/api/v1/admin/manifest`=404、readyz=200 |
| 现行旧名审计 | 项目自有现行代码、文件夹、路由、CLI、Cookie、表、生成物和 authority 文档无 `admin/Admin` 残留 |

旧名白名单只包括 042/044 等历史变更证据、`old-backend/` 独立历史参考，以及 `mysqladmin`、RabbitMQ 测试管理连接等第三方或非 WebUI 语义。旧版 000004 已在本地开发数据库执行时需要由使用者选择备份后重建或制定一次性数据重命名；本任务未自动修改用户数据。

## 4. 重新确认触发器

- 042 已推送、发布或被外部消费者引用；
- 000004 已在外部数据库执行；
- 需要保留旧路由、CLI、Cookie、表或 Go alias；
- 命名迁移需要改变认证、授权、页面功能、部署或数据库版本策略。

出现任一条件即返回研究阶段，不自行增加兼容层。
