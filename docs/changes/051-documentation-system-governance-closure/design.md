# 设计

## 1. 文档 authority 分层

当前文档采用以下单向导航，不让历史任务成为使用前置：

```text
README.md
  -> docs/README.md
      -> repository scope / getting-started
      -> architecture / capability catalog
      -> development
      -> operations
      -> configuration / API
      -> changes / research / ADR（历史与证据）
```

- 根 README：项目定位、范围、最短成功路径和角色入口。
- `docs/repository-scope.md`：目录状态、构建/交付边界、已实现与未实现边界、身份冲突。
- `docs/getting-started/`：安装、启动、首次使用和可观察验收。
- `docs/architecture/`：当前结构与能力目录，不记录任务实施过程。
- `docs/development/`：如何新增或修改实现，以及必须命中的规范。
- `docs/operations/`：配置、资源、运行、诊断、迁移、发布与外部验证。
- 局部 README：解释本目录职责、入口、契约、验证命令，并回链项目 authority。
- `docs/changes/`、`docs/research/`：历史实施与快照证据，不作为当前行为的唯一说明。

## 2. 当前文档修复

### 2.1 入口与首次使用

根 README 将提供两条清晰路径：

1. 后端最小启动：配置初始化、迁移、Go 服务。
2. 当前 Admin WebUI 全栈启动：后端 Setup Token/允许 Origin、Go 服务、另一个终端的 pnpm 安装与 Vite 启动、访问地址和首次 Setup/登录。

详细参数仍由 `docs/getting-started/local-development.md`、`webui.md` 与新增 `first-use.md` 承担，根 README 不复制全部正文。

`first-use.md` 只使用当前可验证入口，覆盖：

- WebUI Setup 与登录；
- Todo CLI 的 create/get/list/complete；
- 当前 API/管理探针的最小调用与预期结果；
- 哪些步骤需要后端、凭据或外部依赖。

### 2.2 项目范围与未决状态

新增 `docs/repository-scope.md`，用状态矩阵说明：

- 根 Go 工程：当前 root build/CI authority；
- `webui/`：当前集成的 Admin WebUI，本地开发与静态质量已验证；生产静态资源托管未实现；
- `frontend/`：受版本管理但未接入当前 root build/CI/release，现阶段不得宣称已集成；
- `old-backend/`：排除目录，不属于当前 authority 或文档门禁；不链接其内部文件；
- Git remote 与当前构建产物身份不同，最终身份迁移另立任务。

### 2.3 模块、能力与运维

- `internal/module/README.md` 必须链接所有当前模块；新增 `auth/README.md`。
- `pkg/README.md` 必须链接所有直接 capability 目录；各局部 README 至少回链 capability 索引或对应开发/运维 authority。
- `webui/README.md` 说明局部开发命令、生成边界、模块资源位置、质量入口和当前生产交付限制。
- `docs/operations/runtime-capabilities.md` 以矩阵描述 Cache、Storage、Observability、Execution、Schedule、Messaging、WebUI 等能力的配置入口、资源所有者、生命周期、诊断与验证状态；已有专篇只链接，不复制。
- `api/README.md` 增加首次使用入口，生成与维护规则继续保留。

### 2.4 当前事实与历史分离

主题文档中的任务编号和阶段叙述改写为直接的当前规则。需要解释长期决策时链接 ADR；只用于证明实施过程的材料留在 change/research。

`docs/scaffold-baseline.md` 只记录当前仓库可验证的导入来源、导入点、产物身份与刷新条件，不虚构本地不存在的源提交历史。`docs/changes/README.md` 将 001–041 标为导入基线档案，042 起标为本仓库原生变更记录。

## 3. 文档治理契约

### 3.1 人工 authority

新增 `docs/development/documentation-governance.md`，至少定义以下触发矩阵：

| 实现变化 | 必须评估的当前文档 |
|---|---|
| 新技术/第三方依赖/Adapter | architecture、capability、development、配置与运维 |
| 新业务模块或 binding | module index、局部 README、开发指南、API/CLI/WebUI 与配置 |
| 新功能或用户路径 | 根入口、getting-started、first-use、API/WebUI |
| 新 CLI/启动方式 | README、getting-started、运维 |
| 新配置键/默认值 | configuration、示例配置、相关运行文档 |
| API/协议变化 | 代码契约、生成物、api README、调用示例 |
| 生命周期/外部资源 | architecture、operations、诊断与失败语义 |
| 构建/CI/release/container | 开发验证、build/container、release |

规范同时说明 `updated` 与 `reviewed-no-change` 的证据要求，以及纯文档、历史档案和排除目录的处理方式。

### 3.2 机器可读清单

新增 `docs/documentation.yaml`，集中声明：

- 根入口和当前 authority roots；
- 历史 roots 与排除 roots（包含 `old-backend/**`）；
- 必须存在局部 README 且被索引的目录集合；
- 源码/配置/交付路径到文档主题的映射；
- 每个主题允许更新的 authority 文档路径；
- 少量明确的导航例外。

配置只表达项目事实和约束，不把 Markdown 正文复制进 YAML。

### 3.3 变更影响记录

从 051 开始，包含非文档实现的变更目录新增 `documentation-impact.yaml`。建议结构：

```yaml
schema_version: 1
change: 051-documentation-system-governance-closure
areas:
  - id: webui
    decision: updated
    documents:
      - docs/getting-started/webui.md
    reason: 启动和质量入口发生变化
  - id: api
    decision: reviewed-no-change
    reason: 本次没有改变 API 契约、路由或调用方式
```

`updated` 必须列出文档，且该文档必须属于该主题允许的 authority 并真实出现在 diff 中。`reviewed-no-change` 必须有非空且具体的理由。历史任务不回填。

## 4. 可执行门禁

### 4.1 核心实现

新增 `internal/tools/docs-guard` Go 工具，以相同语义服务 Windows、Linux 和 CI。核心检查包括：

1. 解析 Markdown 链接，忽略 fenced code 与 inline code，验证真实本地相对目标和锚点。
2. 从根 README 建立当前 authority 图，检查要求可达的文档。
3. 验证每个 `internal/module/<id>` 和 `pkg/<id>` 都有 README，并由各自索引链接。
4. 禁止当前 authority 链接到 `old-backend/` 内部；遍历和 diff 计算都排除该目录。
5. 校验 `docs/documentation.yaml` 与 `documentation-impact.yaml` schema。
6. 根据 Git diff 和路径映射计算命中主题，核对 impact decision 与实际 authority 修改。
7. 检查新增当前文档是否可达；历史档案不进入当前可达图。

工具提供纯树检查与 diff 检查。CI 显式传入 base ref；本地脚本在存在工作区修改时同时检查已暂存、未暂存和未跟踪文件，在干净工作区只运行静态树检查。

### 4.2 跨平台入口与 CI

- `scripts/Verify-Docs.ps1`
- `scripts/verify-docs.sh`

两个脚本只负责环境和参数处理，调用同一 Go 工具，避免规则分叉。

`.github/workflows/quality.yml` 增加 Windows/Linux docs job；PR/push 提供可靠 base ref 执行 diff 门禁。`.github/workflows/release.yml` 至少执行当前树静态门禁，防止发布带有失效文档结构。

Go、WebUI、Docs 是三个独立静态质量入口；E2E、视觉、外部协议和真实容器运行继续作为相应主题的独立验收，不被 Docs 门禁冒充。

## 5. 测试与失败语义

`docs-guard` 使用临时 fixture 仓库或纯文件图单元测试覆盖：

- 断链和无效锚点失败；代码块/行内代码中的伪链接不误报；
- 新文档不可达失败；
- 新 module/pkg 缺 README 或索引失败；
- `old-backend/` 内问题不参与检查，但当前 authority 链入该目录失败；
- 命中路径缺 impact、`updated` 未修改 authority、`reviewed-no-change` 无理由均失败；
- 合法的多主题变更通过。

所有失败输出必须指出规则 ID、命中路径、缺失文档或无效 decision，并以非零码退出，不静默降级。

## 6. 实施边界与回退条件

- 051 只按已确认任务修复文档体系并实现门禁，不改变业务行为。
- 若实施中发现必须决定 `frontend/` 去留、仓库身份、公共 API、依赖选择或 WebUI 生产托管方式，立即回到研究/计划，不在本任务中代替用户决定。
- `old-backend/` 始终排除；任何需要进入或修改该目录的发现都属于新任务。
