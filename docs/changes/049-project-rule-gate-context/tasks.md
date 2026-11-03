# 049 任务与验证

## 1. 门禁状态

- 任务标识：049 项目规范门禁语境核验。
- 任务类型：纯文档治理变更。
- 当前阶段：研究门禁、计划、纯文档实施和验证均已完成。
- 实施范围：只修改项目主题文档和 049 证据；不修改 `AGENTS.md`、源码、脚本、CI 或 Dockerfile。
- 纯文档例外：研究和计划通过后可直接完成并提交。

## 2. 任务清单

| ID | 任务 | 完成条件 | 状态 |
| --- | --- | --- | --- |
| RES-001 | 提取项目主题文档的强制规范 | 覆盖模块、配置、日志、WebUI、质量、发布和 license | 已完成 |
| RES-002 | 对照代码、测试、扫描器与 workflow | 区分已命中、部分命中、未命中、未验证 | 已完成 |
| PLAN-001 | 形成纯文档语境修复计划 | requirements/design 引用 R001，范围不进入实现 | 已完成 |
| DOC-001 | 修复模块与 WebUI 规范语境 | 触发条件、发现范围和验证边界明确 | 已完成 |
| DOC-002 | 修复构建、发布和 license 当前表述 | Go/WebUI 范围与 OCI blocker 如实记录 | 已完成 |
| VAL-001 | 验证结构、链接、Diff 与结论 | 所有文档检查通过 | 已完成 |
| GIT-001 | 只提交 049 纯文档范围 | Conventional Commit 完成且工作区干净 | 已完成（本提交） |

## 3. 本轮验证证据

| 命令/检查 | 结果 | 证明范围 |
| --- | --- | --- |
| `go test ./... -count=1` | 通过 | 当前 Go 单元、集成、package graph、配置、日志和 WebUI Go contract |
| `cd webui; pnpm lint` | 通过 | ESLint + 当前 Auth/Ops i18n/architecture 扫描 |
| `cd webui; pnpm lint:modules` | 通过 | 当前 Auth/Ops module roots |
| `cd webui; pnpm typecheck` | 通过 | 当前 TypeScript 图 |
| `cd webui; pnpm test` | 15 files / 42 tests 通过 | 当前前端单元与状态逻辑 |
| `cd webui; pnpm generate:check` | 通过，registry current | 当前 composition Catalog 与生成文件一致 |
| Node 脚本源码审计 | 三个扫描器只枚举 Auth/Ops | 未来第三个模块当前不会自动进入全部 Node 扫描 |
| quality/release workflow 审计 | 无 Node/pnpm/WebUI step | Go workflow 成功不能证明 WebUI quality |
| license 审计 | source Apache-2.0，OCI label `NOASSERTION` | 正式容器 license metadata 未闭环 |
| 049 结构与 metadata | 通过 | 固定任务文件和研究最小字段完整 |
| Markdown 相对链接 | 通过 | 11 个本任务涉及的 Markdown 文件链接目标存在 |
| `git diff --check` | 通过 | 文档 Diff 无空白错误或冲突标记 |

## 4. 未执行

- `pnpm build`、Playwright E2E 与截图人工复核；
- `go test -race`、`go vet`、CGO-free build；
- Docker/container smoke；
- PostgreSQL、MySQL、RabbitMQ 真实协议；
- 远端 GitHub Actions 和正式 release。

这些项目没有被描述为通过。

## 5. 后续非文档缺口

- 通用化 WebUI module lint/i18n/architecture discovery，并增加第三模块反向 fixture；
- 把 WebUI quality job 接入 CI/release 的同 commit 聚合门禁；
- 把 Dockerfile OCI license label 与 Apache-2.0 单轨对齐。

上述内容需要独立研究、计划和确认，049 不提前实施。
