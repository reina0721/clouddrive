# R001：项目规范与可执行门禁审计

## 1. 研究问题

项目主题文档中声明的模块边界、配置 ownership、日志、WebUI、质量与发布规范，是否被当前代码、测试、扫描器和 workflow 真正命中？如果证据覆盖不足，项目规范应该怎样修正适用语境与结果表述？

本研究不审计 `AGENTS.md` 协作规则。

## 2. 方法与范围

以 2026-08-21 的 `HEAD 3d0d537` 为快照：

1. 从 `docs/README.md` 进入 architecture、development、configuration 和 operations 主题 authority，提取“必须、不得、禁止、只能、门禁”等强制语句。
2. 对照 Go architecture/config/logging/WebUI contract tests、Node lint scripts、quality/release scripts 与 GitHub workflow。
3. 运行当前无副作用检查：`go test ./... -count=1`、`pnpm lint`、`pnpm lint:modules`、`pnpm typecheck`、`pnpm test`、`pnpm generate:check`。
4. 区分规范声明、门禁发现范围、命令结果、未执行验收和外部证据。

本轮没有执行 `pnpm build`、Playwright E2E/视觉检查、`go test -race`、Docker、PostgreSQL/MySQL、RabbitMQ 或远端 workflow。它们不能被本地静态与单元测试结果替代。

## 3. 核验矩阵

| 项目规范 | 实际门禁 | 本轮结果 | 结论 |
| --- | --- | --- | --- |
| `pkg` 不反向依赖 `internal`，模块不跨 owner，第三方只在 Adapter，Handler 不穿透 transport/binding | `pkg/boundary_test.go`、`internal/kernel/composition/architecture_test.go` 动态读取 package graph 和源码 | `go test ./...` 通过 | 当前生产 Go 包命中；新增 Go 包也会被 graph walk 发现 |
| 官方配置节集中、顺序稳定、未知字段 strict fail | `applicationOwnedConfigurationBindings()`、configuration/config/cmd tests | `go test ./...` 通过 | 当前清单命中；新增 section 必须同步唯一 composition 清单和 expected test |
| production 不使用 `logger.Noop`、zap/标准全局 logger 旁路或原始 `err.Error()` 字段 | architecture logging source scan + logging tests | `go test ./...` 通过 | 当前 `cmd/internal/pkg` production Go 源码命中 |
| WebUI Binding、Activation、Delivery、SourcePath、locale coverage、access/availability fail closed | Go Catalog/registry contract tests和独立 fixture | `go test ./...`、`pnpm generate:check` 通过 | composition 已选模块和通用生成器命中 |
| 所有 WebUI 模块只能用 SDK、模块样式/i18n 不穿透 | 三个 Node lint scripts | Auth/Ops 当前检查通过 | 部分命中；脚本硬编码 Auth/Ops，第三个模块不会自动进入扫描 |
| 统一 quality/release 重新跑全部项目门禁 | `Verify-Quality`、quality/release workflow | 源码检查确认仅 Go/生成物/产物；没有 Node/pnpm | 未命中；现有成功不能证明 WebUI quality |
| 正式发布 license metadata 已闭环 | `LICENSE`、`NOTICE`、README、Dockerfile label | 源码为 Apache-2.0，OCI label 为 `NOASSERTION` | 未命中；容器正式发布应保持阻塞声明 |
| E2E、视觉、跨平台、外部数据库/消息协议 | Playwright、Docker/DB/RabbitMQ/远端 workflow | 本轮未执行 | 未验证，不能由单元测试推断 |

## 4. 已命中的项目规范

### 4.1 Go 架构与模块边界

`TestProductionPackageGraphRespectsCompositionBoundaries` 通过 `go list -json ./...` 动态读取当前包图，并继续扫描 HTTP source ownership、模块导出、Kernel App 配置 ownership、composition ownership 和日志 source ownership。fixture 同时证明合法路径可通过、跨模块 import、composition 旁路、第三方越界、Handler 反向依赖和日志旁路会失败。

这类门禁不是只匹配 Todo/Auth/Ops 名称；`applicationModuleOwner` 按 `internal/module/<owner>` 解析，因此新增 Go 模块包会进入扫描。本轮 `go test ./... -count=1` 全部通过，可以确认当前 Go 生产图命中这些结构规范。

### 4.2 配置与日志

应用级配置集合由 `applicationOwnedConfigurationBindings()` 统一输出，测试冻结当前 auth/migration/todo/management/observability 顺序；Kernel 组件配置和 strict merge/unknown key 另有测试。该证据证明当前清单，不自动发现一个未加入 composition 的新 section，因此新增配置 owner 时仍必须更新集合和反向失败测试。

日志 architecture scan 动态遍历 `cmd/internal/pkg` 的 production Go 文件，拒绝 `logger.Noop()`、非实现边界 zap、cmd/internal 标准全局 logger 和 `logger.String("error", err.Error())`。当前测试通过，规范与门禁一致。

### 4.3 WebUI Go 契约与当前内置模块

Go WebUI Catalog 校验 Activation/Delivery、SDK requirement、operation、SourcePath owner、locale coverage 和 manifest 投影；独立 fixture 使用 `fixture` 模块证明生成器不依赖 Auth/Ops 固定集合。当前 Auth/Ops registry clean check、Node lint、typecheck 和 42 个 Vitest 用例通过。

这些结果能证明当前内置模块与通用 Go 生成契约，不能扩大成所有未来模块的前端源码扫描保证。

## 5. 未完整命中的项目规范

### 5.1 WebUI Node 扫描器只覆盖 Auth/Ops

- `lint-architecture.mjs` 的模块循环固定为 `auth`、`ops`，业务 selector 也是手工字符串列表；
- `lint-modules.mjs` 直接把 Auth/Ops 两个目录传给 ESLint；
- `lint-i18n-contract.mjs` 的 `moduleRoots` 只包含 Auth/Ops。

因此未来新增 `internal/module/catalog/binding/webui/web` 时，即使命令全部返回 0，也可能完全没有扫描该目录。原文“所有接入模块必须遵守”和“命令通过”之间缺少“扫描器实际发现本次模块”的先决条件。

项目规范需要明确：新增模块必须先扩展或通用化发现范围，并用故意违规 fixture 证明门禁会失败；在该证据之前不能宣布门禁通过。本任务只修复该语境，不修改 Node 脚本。

### 5.2 Go quality/release 不是全项目质量入口

PowerShell/Bash `Verify-Quality` 执行 gofmt、go mod tidy diff、Go generate clean、test、race、vet、CGO-free build 和 artifact 检查。quality/release workflow 只安装 Go 与 Go 工具并调用该脚本，没有 Node setup、pnpm 或 WebUI step。

因此运维文档的“全部质量门禁”超出实现。应改成 Go/生成物/仓库产物门禁，并明确 WebUI 变更另跑开发指南中的矩阵；未执行 build/E2E/视觉时标为未验证。

### 5.3 许可证发布语义已漂移

根 `LICENSE`、`NOTICE` 和 README 已明确 Apache License 2.0，但 Dockerfile 仍声明 `org.opencontainers.image.licenses="NOASSERTION"`。发布文档原称“尚未声明源码许可证”，已与仓库事实冲突。

当前文档应如实写成“源码许可证已声明，但 OCI label 未对齐，容器正式发布门禁未通过”。修改 Dockerfile 属于独立非文档变更，本任务不提前实施。

## 6. 语境修复原则

1. 以变更语义触发规范，不依赖用户是否说出“模块”“WebUI”或“发布门禁”等精确词。
2. 每个“通过”结论同时说明发现范围；命令退出 0 但未发现目标对象，不算命中。
3. 区分可执行结构门禁、运行/协议验收、人工视觉证据和外部 workflow，不跨层推断。
4. 文档以当前实现为准；目标中的通用扫描、统一质量入口和 license 对齐不能写成已完成。

## 7. 对 049 的影响

- 应用模块指南增加适用语境和证据边界。
- WebUI 指南公开 Go 通用门禁与 Node Auth/Ops 硬编码覆盖，并要求新增模块先证明被发现。
- 构建文档明确 `Verify-Quality` 的 Go 范围及 WebUI 补充门禁。
- 发布文档取消“全部质量门禁”误述，增加同 commit 独立 workflow/WebUI 证据要求，并修正 license 当前事实。

## 8. 局限与刷新条件

- 本轮未修改或验证未来通用 Node module discovery；它仍是实施缺口。
- 未执行 build、E2E、视觉、race、Docker、外部数据库、RabbitMQ 或远端 workflow。
- 没有逐条审计所有 capability 运行语义；审计聚焦跨任务最容易被错误宣称“已通过”的项目规范。
- 新增模块、改变扫描器/CI/release 或对齐 Dockerfile license 后必须刷新。

关键事实和失败边界足以形成纯文档修复，研究门禁通过。
