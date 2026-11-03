# 需求

## 目标

建立一个以当前实现为事实来源、可从根入口完整导航、能随技术和业务变化持续演进的项目文档体系，并通过可执行门禁阻止“功能已经实现但相应文档没有评估或更新”。

## 范围

### 当前内容收口

- 重构根 README 的项目定位、范围说明、后端最小启动、全栈 WebUI 启动和首次使用入口。
- 建立仓库范围/当前状态文档，如实区分根 Go 工程、`webui/` 与 `frontend/`。
- 新增首次使用指南，覆盖 WebUI Setup/登录、Todo CLI/API 和 management 基础验收。
- 补齐 `webui/README.md`、`internal/module/auth/README.md`，修复模块和 `pkg` capability 索引及回链。
- 补齐当前运行能力矩阵，覆盖配置、生命周期、外部依赖、诊断与验证边界。
- 清理当前主题文档中的任务编号、历史阶段叙述和已失效语境；历史证据保留在 change/research。
- 修正 `frontend/README.md` 中不可验证的集成声明和不存在的脚本引用。
- 补充脚手架基线来源说明，并在 change 导航中区分导入基线与本仓库原生任务。

### 持续治理

- 定义项目文档 authority、所有权、变更触发器、同步责任和完成标准。
- 提供机器可读的文档结构与“代码路径 -> 文档主题”映射。
- 从 051 开始，每项包含非文档实现的 change 必须提供结构化 `documentation-impact.yaml`：每个命中主题只能标记 `updated` 或 `reviewed-no-change`，后者必须说明具体理由。
- 实现跨平台文档门禁，检查真实相对链接、当前 authority 可达性、模块/能力局部 README 与索引、禁止当前 authority 指向排除目录，以及 diff 与文档影响记录的一致性。
- 将门禁接入 Windows/Linux quality workflow，并在 release 执行静态文档检查。

## 明确排除

- `old-backend/` 的全部内容、链接和文档质量；门禁不得遍历该目录。
- 删除、迁移、重命名或整理 `old-backend/`。
- 决定或实施 `frontend/` 集成、迁移或删除。
- 决定或实施仓库/Go module/产物身份迁移。
- 实现 WebUI 生产静态资源托管。
- 新增业务功能、外部服务接入或数据迁移。
- 为 001–050 的历史任务批量回填 `documentation-impact.yaml`。

## 验收标准

1. 新使用者从根 README 不经过历史任务文档即可找到项目边界、后端启动、WebUI 启动和首次使用验收。
2. 当前业务模块与 `pkg` capability 都有局部 README，并从当前 authority 可达；局部文档能回到对应 authority。
3. 当前主题文档不再依赖任务编号解释现行行为，不把未实现能力写成已完成。
4. `frontend/`、WebUI 生产交付和仓库身份冲突都有明确、可验证的当前状态及后续决策边界。
5. 文档治理规范明确新技术、依赖、模块、功能、CLI、配置、API、生命周期、外部资源、构建和发布各自必须评估的文档主题。
6. 新模块或 capability 缺 README/索引、当前文档不可达、真实相对链接断裂、当前 authority 链入 `old-backend/` 时，文档门禁失败。
7. 命中受治理代码路径但没有 impact 记录、`updated` 没有实际修改允许的 authority，或 `reviewed-no-change` 没有理由时，diff 门禁失败。
8. PowerShell 与 shell 入口使用同一核心检查语义；quality 的 Windows/Linux job 与 release 静态检查均调用对应入口。
9. `old-backend/` 内的任何既有问题不会影响门禁结果，051 也不修改其文件。
10. Go 测试、文档门禁、既有 WebUI 静态门禁、YAML 解析和 `git diff --check` 通过；未执行的运行时/外部验收如实记录。
