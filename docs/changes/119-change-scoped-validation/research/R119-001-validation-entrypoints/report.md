# R119-001 日常验证入口与重复门禁

## 问题、范围与方法

研究日常测试为何反复全量执行、原生工具是否足够、如何不遗漏调用方、无提交历史如何处理。已从根 README、范围文档、文档总入口进入，读取实际脚本、工作流、前端工作区配置、AGENTS、提交 skill 及文档治理配置；未运行全量测试、生成或安装命令。

研究前检索了 docs 下 metadata.yaml。R088-001 的 active 记录及完整报告描述重复研究与增量漂移规则，可复用其流程边界；它不证明当前测试选择器存在。118 的研究是整合证据，其 verified 状态不是当前研究规范的 active 枚举，且不覆盖增量验证。本任务另建当前证据，不修改历史记录。

## 已核验事实

- scripts/Verify-Quality.ps1 与 verify-quality.sh 无范围参数；普通和 race 测试均执行 ./... -count=1，另有 tidy、生成、vet、无 CGO 构建。Go 官方说明 -count=1 禁用测试结果缓存。
- scripts/Verify-WebUI.ps1 与 verify-webui.sh 每次执行安装准备，再执行 pnpm check；frontend/package.json 中 check 串联治理、lint、类型、测试、构建、性能、浏览器、格式与文档检查。
- frontend/AGENTS.md §10 明文要求每次交付前执行 pnpm check；根 AGENTS 与本地提交 skill 已允许按影响范围验证，无需把提交 skill 改为另一个重复规范。
- Quality workflow 在 push 和 pull_request 上启动 Windows/Linux Go、前端、文档及安全任务；Database workflow 同样每次触发真实数据库契约。release.yml 在 v* 标签上明确调用完整脚本，必须保留。
- pnpm-workspace.yaml 覆盖 apps/*、packages/*、surfaces。pnpm 10 的 ...包名 选择器原生覆盖指定包及全部反向依赖，不需要自建前端依赖图。
- Go 的 list 可提供包目录、Imports、TestImports 与 XTestImports；测试选择必须包含测试导入关系，不能只按源文件目录筛选。
- 当前 main 尚无 Commit；git status 显示整个源码快照未跟踪。只读取 git diff 会漏掉整个导入。研究时 Node 为 v24.19.0；Go 不在 PATH，但启动脚本已规定的 LOCALAPPDATA/clouddrive-tools/go/bin/go.exe 存在且实测为 go1.26.6 windows/amd64。
- 文档治理要求非文档变更同步 documentation-impact.yaml；构建/CI 对应 delivery，frontend 变化对应 webui/frontend authority。

## 技术比较与结论（推断及目标设计）

| 候选 | 结论 | 理由与边界 |
| --- | --- | --- |
| 现有完整 Go/pnpm 检查 | 保留 | 保持发布与显式完整回归覆盖，不作为每次局部更新的默认入口 |
| Go 原生缓存、list/test/vet | 保留并组合 | 跟随既有 Go 工具链；无需第三方授权、依赖或运行时 Adapter |
| pnpm 10 filter 与现有检查脚本 | 保留并组合 | 官方提供反向依赖选择；沿用已固定版本与工作区声明 |
| Node 标准库编排 | 合理自研的项目专有策略 | 只负责 Git 路径分类、调用原生工具、错误/耗时报告；不实现编译缓存、前端图引擎或测试框架 |
| Nx/Turborepo 等任务平台 | 本次不引入 | 当前缺口是默认入口与流程规则；引入平台仍需处理本仓库的 Go、生成契约和规则映射，无已证明收益足以承担迁移成本 |

新增内容属于仓库开发工具，不是应用通用能力或业务模块；无 composition/Kernel/Host 接入、资源租约、Reload、数据库或业务公共 API 变化。现有 scripts 目录、Node/Go/pnpm 足够承载，不需要架构重构。工具由调用进程拥有子进程，失败立即向上导出；不引入依赖、常驻进程或第二套配置系统。维护责任由 scripts 验证入口承担；若目录映射或图选择失去可靠性，明确扩大检查，不能静默判为零项；未来确需任务平台时以同一验收集替换薄编排。

GitHub 官方说明顶层 paths 跳过工作流可能使 required checks 保持 Pending。采用始终触发工作流、内部任务按分类运行并保留结果汇总；不修改远端分支保护。

## 局限与研究门禁

尚无分步耗时基线，不声称提速百分比；外部真实服务状态不能由 Go 测试缓存证明。前端 surfaces 为一个工作区，首版会覆盖整个 surfaces 及调用方，不承诺逐页面精准选择。删除包、配置、生成链及无法归属路径需显式扩大。浏览器用例语义无法从静态依赖图可靠推导，依计划选择用例或执行完整浏览器门禁。

研究门禁通过：根因、工具能力、接入位置、未知影响处理与确认边界已有可复核证据；性能收益和执行正确性留给实施验证，不能提前写作已完成。
