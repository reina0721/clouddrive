# 范围选择、执行与 CI

## 入口与职责

新增 scripts/verify-changed.mjs，Node 标准库实现跨平台入口；PowerShell 与 Bash 使用同一实现，不复制范围判断。CLI 为 `node scripts/verify-changed.mjs [--base <ref>] [--dry-run] [--full] [--race] [--browser <spec>] [--prepare] [--go-executable <path>]`，另提供 CI 使用的 `--classify` JSON 分类输出。重复 --browser 可指定多份既有 spec，不自动更新快照；未知参数或无效 ref 失败退出。

现有 Verify-Quality/verify-quality、Verify-WebUI/verify-webui 保持完整验证语义；日常入口不调用它们，只有 --full 或明确风险升级时调用。GoExecutable 支持现有独立安装位置，并传入完整 Go 验证脚本；统一尊重明确参数，找不到工具报错。前端依赖/浏览器准备由 --prepare 显式开启，CI 先准备再验证；日常缺依赖时说明准备命令并失败，不静默安装。

--dry-run 输出计划且不执行生成、测试、安装、构建或写报告；必要 Git/list 读取允许。--classify 只做 Git 路径分类，不依赖 Go 或前端安装。默认执行结束在 .data/validation 写低敏 JSON 报告，记录 revision（可缺失）、路径摘要、命令参数、步骤结果与毫秒耗时；不保存环境快照、凭据或原始输出。此报告仅作证据，不自建测试结果缓存，也不凭同名路径复用旧成功。

## 变更集合与选择

- 默认比较 HEAD 与工作树，合并暂存、未暂存、未跟踪文件；--base 使用 ref 与 HEAD 的 merge-base 到当前工作树的完整差异。Git 使用 NUL 分隔，保留重命名两端及删除路径，支持中文、空格和特殊字符路径。子进程传参数数组，不拼接 shell 文本。
- 无 HEAD 或首次 push 无有效 before 时，明确报告无基线，扩大至完整范围；显式传入的错误 ref 则失败，不能吞成无改动。合法空集合输出无需验证及原因，不运行裸 go test 或无 filter 的 pnpm 命令。
- 普通 Markdown、文档目录及文档治理配置调用现有 docs guard；仅文字改动不执行业务验证。文档中生成输入、脚本或配置不能按扩展名绕过分类。
- Go 局部代码使用 `go list` 的 ImportPath、Dir、Imports、TestImports、XTestImports 构造包到调用方闭包；用官方 template 输出每包一行字段，避免复制 Go parser。选择改动所属包和全部反向依赖执行 gofmt 检查、go test（不带 -count=1）与 go vet；非 Go 资源归属最近的 Go 包目录。不认识的资源、删除包、构建标签/跨平台源变动扩大到完整后端验证。读取图失败保留错误并停止，不以空集合通过。
- --race 在选定后端范围执行 race。internal/kernel、internal/composition、internal/bootstrap、并发底层能力所在 pkg（execution、schedule、messaging、database）变更自动启用；其他并发业务更新由任务计划声明 --race。日常不因 --race 额外重复完整普通测试。
- 前端按 pnpm 工作区路径定位包，使用 `--filter ...<package>` 合并所属包与全部使用方；选择工作区必须非空。执行现有 foundation/architecture/dependency 及 codegen 的只读检查，改动文件的 lint/格式检查，选定工作区 typecheck/test；治理检查维持全局轻量扫描。surfaces 内的页面更新首版覆盖 surfaces 和其调用方，不自建页面依赖图。
- 前端 package/锁文件、全局构建与测试配置、tooling 变化扩大至完整前端验证。涉及共享 UI/Foundation/Token/Adapter，增加现有生产构建、性能及完整浏览器门禁以保留既有交互保障；普通页面变化需要浏览器证据时由 --browser 指定对应 spec。不自动降低视觉或可访问门槛。
- go.mod/go.sum、根构建/交付配置扩大相关栈；api、HTTP contract 生成器、Go HTTP binding、consolecatalog 或前端后端契约生成输入变更扩大至双端完整检查。无法证明归属的非文档路径以及验证编排自身变化扩大双端，输出升级原因。

## 执行、资源与错误

范围计划先完整输出再依次执行；失败即退出非零并保留步骤名称、退出码与耗时。Node 调用者拥有子进程，取消信号转发并等待退出；不用 detached 常驻执行，不对同一失败无界重试。调用完整脚本前检查 shell 可用性。完整验证保留 -count=1，适用于外部状态与真实回归；只读路径不能执行 go generate。完整生成检查扩展到当前实际生成物（包括 frontend 的 native-openapi），不能依赖只读两个旧 API 文件的 git diff。

报告不自动跳过已成功步骤。Agent 在 tasks.md 记录已验证内容的指纹、命令和环境；后续只修改相关内容或出现覆盖缺口才重验。新建 docs/development/validation.md 为策略唯一 authority，AGENTS 只保留范围匹配、证据复用和完整回归触发规则并链接；frontend/AGENTS §10 将无条件 pnpm check 改为引用该策略。提交 skill 不再扩写，现有按范围验证已经适配。

## CI 与完整回归

Quality/Database workflow 保留始终可报告的 PR 检查，不使用顶层 paths 筛掉整个工作流。分类 job 用相同 --classify 输出控制后端、前端、文档、数据库、OpenAPI jobs；显式添加汇总 job，失败/取消不得伪装成功，合法无关跳过可以通过。保留现有 job ID，不改远端分支保护。

PR 使用基分支 merge-base、分支 push 使用 before；完整拉取基线。保留 push/PR 触发，按 workflow + PR号/分支配置 concurrency，只取消相同事件序列被取代的旧执行。后端与前端分别在两平台运行选中范围；数据库任务仅对后端、依赖、迁移/数据库和其 CI 配置变更执行，真实服务测试维持 -count=1。安全检查保留现有触发，不以路径筛选掩盖风险。

main push、v* 标签、手动 workflow_dispatch 及每日 06:00 UTC schedule 执行现有完整矩阵；release.yml 继续调用完整入口，不修改发布流程或实际发布。Windows/Linux 分别准备依赖及浏览器，仅在需要的工作执行。fuzz 归完整或 kernel/config 相关更新。CI 运行时间和汇总作为证据；不得在本地宣称远端 CI 已通过。

## 文件与文档影响

实施新增 verify-changed.mjs 与 scripts 下 Node 内置 test 场景；修改现有四个 Go/前端完整入口仅处理参数、工具路径及生成物检查，不保留废弃分支。修改 Quality/Database 两份 workflow。同步根/前端 AGENTS、根 README、frontend/README、docs/development/README、新验证 authority 及 docs/operations/build-and-container.md；任务 documentation-impact.yaml 覆盖 delivery、webui、frontend。业务源码、用户数据库与开发服务不在范围。

## 验证与退出条件

使用 Node 内置 test 和临时 Git fixture（实施阶段）验证：文档、Go 直接与测试反向依赖、前端反向依赖、暂存/未暂存/未跟踪、删除/重命名/中文空格、空集、无 HEAD、错误 base、读取图失败、子命令失败、dry-run 无写入及风险升级。fixture 测试验证选择和失败边界，不复刻测试框架。

Windows 执行 Node 场景与一个真实 Go 局部范围及前端工作区范围；验证普通页面计划不包含 build/完整浏览器，纯文档计划不含业务编译。Linux 通过 CI 运行相同编排与脚本，环境不可用时记为待验证。完整入口用计划与命令断言证明步骤仍在，必要时做一次完整回归，不以“提交前”重复运行。记录相同环境下日常入口首次/再次耗时及缓存命中，无已有耗时不能编造提速比例。

当前源码均未跟踪，实施时必须用证据文件哈希做增量漂移检查；不把整库初始导入混入本任务自动提交。若完成时仍无可分离基线，明确记录提交阻塞，保留工作区结果，不擅自提交整个源码快照。
