# R001 当前文档体系全量审计

## 研究问题

1. 根入口是否能带领新使用者完成当前项目的真实启动和首次使用？
2. 当前实现中的业务模块、通用能力、前端、配置与交付链是否都有可达的现行文档？
3. 当前主题文档是否与历史任务证据分离，是否存在重复、过期或身份语境冲突？
4. 新技术、业务模块或功能落地后，项目是否有可执行机制要求同步更新对应文档？

## 范围与方法

研究以 Commit `613bccf` 为快照，从根 README 进入，交叉核对目录、源码入口、CLI help、配置节、模块注册、WebUI 脚本、CI、release、Docker 与 Git 事实。文档声明只作为待验证主张，不能替代实现证据。

按用户决定，`old-backend/` 完全排除：不统计其内部文件，不检查链接，不判断内容新旧，不提出内部整理任务。当前 authority 也不得指向该目录。

## 已验证事实

### 1. 根入口没有覆盖完整成功路径

根 README 的“五分钟本地启动”只包含配置初始化、数据库迁移和 Go 服务启动。当前 `docs/getting-started/webui.md` 已记录另一个终端中的 pnpm 安装、生成检查与 Vite 启动，但根入口没有给出完整全栈路径，也没有说明首次 Setup、登录、Todo/API 或管理诊断如何验收。

因此用户举出的 WebUI 只是一个可复现证据，实际缺口是“入口只说明进程如何启动，没有说明当前产品如何被使用和验证”。

### 2. 当前文档数量不等于体系完整

排除 `old-backend/` 后，仓库仍有 433 个受版本管理的 Markdown 文件，其中 360 个在 `docs/changes/`，17 个在 `docs/research/`；当前主题文档、局部 README 与入口文档只占较小部分。大量历史证据会制造“文档很多”的表象，却不能替代当前使用说明。

从根 README 构建当前 authority 可达图，并排除 `docs/changes/`、`docs/research/`、`frontend/` 和 Agent 专用文件后，得到 37 个可达文档与 17 个不可达局部 README。不可达项包括 migration 模块、messaging Kernel App，以及 cache、clock、codec、concurrency、fault、health、i18n、idgen、observability、resilience、secrets、storage、supervisor、testkit、validation 等能力说明。

### 3. 模块与前端局部说明不完整

- `internal/module/auth/` 没有 README；`internal/module/README.md` 也没有把 Auth 与 Migration 作为可点击的模块入口完整列出。
- `webui/` 没有 README，开发者只能从根文档猜测局部脚本、生成边界与模块宿主关系。
- `pkg/README.md` 虽列出能力，但多数名称不是指向局部 README 的链接；多数局部 README 也没有回链当前项目 authority。
- `api/README.md` 主要说明生成与绑定，没有覆盖当前 API 的首次调用和验收路径。

### 4. 当前主题文档混入任务历史语境

当前使用和开发文档仍出现 `042`、`043`、`032`、`035`、`036`、`NEXT-002` 等任务编号或阶段性叙述。`docs/README.md` 还把 040 任务记录作为当前文档体系的深层入口。

这些信息属于历史证据，不应成为理解当前行为的前置条件。当前 authority 应直接陈述有效规则；决策原因进入 ADR，实施证据进入 change/research。

### 5. 运维与能力覆盖存在结构性空白

现有运维入口覆盖构建容器、迁移、发布、复制、安全、定时任务和消息，但没有统一说明 WebUI 的生产交付状态、Cache/Redis、Storage/S3、Observability/OTLP/metrics 与 Execution 等能力的启用条件、资源所有权、诊断入口和外部验证边界。

当前 Dockerfile 与 release 配置没有打包或托管 `webui/dist`。所以只能确认 WebUI 本地 Vite 开发和静态质量链已经存在，不能宣称生产静态资源交付已经完成。

### 6. `frontend/` 与当前根工程没有形成可验证闭环

`frontend/` 是受版本管理的 Nuxt/Vue 子项目，但其 README 指向已经不存在的 `backend/internal/modules/community`，并引用三个仓库中不存在的检查脚本。当前根 CI、release、Docker 与质量脚本也没有包含该子项目。

因此可验证结论是：它存在，但未与当前根 Go 工程形成受当前构建和交付链验证的集成。文档必须明确这一状态，不能继续以集成完成的语气呈现。

### 7. 仓库身份与导入历史缺少可信说明

Git remote 指向 `rin721/community-go`，而根 README、`go.mod`、Dockerfile、配置、workflow 与 `.scaffold/identity.yaml` 仍以 `clouddrive` 为当前产物身份。release workflow 还限制只在 `rin721/clouddrive` 仓库执行。

`.scaffold/identity.yaml` 要求存在 `docs/scaffold-baseline.md`，但该文件缺失。当前 change 001–041 是随基线一次导入的历史档案，而不是本仓库内逐项产生的原生提交；现有 `docs/changes/README.md` 没有区分这两类来源。

本研究不能擅自决定最终产品身份，但文档必须如实呈现“远端仓库身份”和“当前构建产物身份”的差异，并恢复可验证的基线来源说明。

### 8. 没有文档同步的可执行门禁

当前代码、脚本和 workflow 中没有 docs verifier、authority/reachability 检查、模块 README 完整性检查，也没有按变更路径要求提交“已更新文档”或“复核后无需更新及原因”的文档影响记录。

`application-module-development.md` 中的“同步当前文档”只是自然语言要求，无法阻止新技术、新模块、新配置、新启动方式或新交付路径在实现后漏更文档。

## 推断与设计影响

以下是基于事实的设计判断，不是当前已实现能力：

1. 只补若干缺页无法防止下一次遗漏，必须同时修复当前内容和建立持续门禁。
2. 文档应按“入口与边界 -> 启动与使用 -> 架构与能力 -> 开发 -> 运维 -> 历史证据”分层，每个主题只有一个当前 authority。
3. 代码路径到文档主题的映射应机器可读；每次非文档变更必须显式声明文档影响，`reviewed-no-change` 也必须给出具体理由。
4. 静态检查应覆盖链接、可达性、模块/能力索引和影响记录；它不能替代对文档语义正确性的人工审阅。
5. `frontend/` 的集成或退役、仓库身份迁移、WebUI 生产托管属于独立产品/实现决策，本变更只能把当前状态写清并留出后续入口。

## 局限与刷新条件

- 本研究没有启动服务、浏览器、外部数据库、Redis、对象存储或消息系统；运行时产品验收不是本次研究目标。
- 未审计 `old-backend/` 内部，且后续文档门禁必须继续排除它。
- 若当前产品身份、`frontend/` 去留、WebUI 生产交付方式或根构建边界改变，本研究结论需要刷新。

## 研究门禁结论

关键缺口已有代码、配置、文档和 Git 证据，事实与推断已分离；剩余产品决策不妨碍形成“先如实标记、后单独决策”的计划。研究门禁通过，可以进入计划阶段。
