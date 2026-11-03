# 048 业务模块自有 WebUI 与通用 SDK 重构

状态：研究门禁已通过，用户已于 2026-08-21 确认实施；048 已完成实现、全量验证和单轨提交。

## 目标

建立通用的业务模块 WebUI 装配体系。账号与权限、日志与审计、系统配置、运维工具以及未来模块都在自己的 `internal/module/<module-id>` 中完整持有后端业务与 WebUI 页面；根 `webui/` 只拥有宿主、构建支持、通用 SDK contract 和 SDK adapter，不接管任何业务页面。

普通新模块接入只需要：

1. 在自己的模块目录实现 Model、Service、Handler、HTTP API 与 WebUI Binding；
2. 在自己的 `binding/webui/web` 中实现页面、API client、locale、局部样式和测试；
3. 在 `internal/composition` 的唯一 WebUI module 汇总点增加一项；
4. 只通过 `@webui/sdk/*` 使用宿主能力。

普通接入不得修改 Router、Shell、全局 CSS、SDK adapter、生成器或其他业务模块。只有新模块提出了真实的新宿主能力或新技术集成，并且现有 SDK 无法表达时，才允许先建立项目自有 SDK interface，再由 `webui` 平台实现 adapter；这是一项独立的平台能力变更，不是业务页面的顺手修改。

## 核心决策

- 业务模块继续持有 WebUI 源码，不迁移到 `webui/src/module`。
- `internal/webui.Binding`、`applicationWebUICatalog()` 和构建期 registry 路线可以保留并通用化；`SourcePath` 只允许作为构建期元数据，禁止进入浏览器 manifest。
- `webui/` 分成 public SDK 与 private platform。业务模块只能导入 public SDK，不能导入 Router、Shell、Store、i18n singleton 或平台内部对象。
- 业务页面、查询、表格列、表单、locale、错误码映射和 CSS Modules 全部由模块持有。
- 宿主只根据通用 Binding/manifest 装配路由、导航、权限、locale 和 lazy entry；不得出现 `auth`、`ops`、`audit`、`systemsettings` 等模块名分支。
- 应用必须在 composition 显式选择并启用模块；未选择或 `disabled` 模块、`not-implemented` route 不进入 runtime manifest、Entry registry、locale registry 或导航。
- 宿主必须在业务 Entry、locale 和 query 加载前依次检查 access 与 availability；未知状态 fail closed，单模块错误不得拖垮 Shell 或其他模块。
- `degraded` 只有模块明确声明支持且列出仍可用 capability 时才能加载页面，否则按 `unavailable` 处理。
- 模块专属新技术默认由模块内部 Adapter 封装；只有跨模块复用或必须接入宿主生命周期/全局交互的技术才升级为 SDK capability。
- 不采用目录扫描、`init` 注册、Service Locator、Module Federation 或运行时远程模块。
- 047 未完成路线继续冻结；已提交代码是当前实现事实，048 获确认后按单轨计划收口。

## 阅读顺序

1. [研究索引](research/README.md)
2. [需求规格](requirements.md)
3. [整体设计](design.md)
4. [实施任务与确认边界](tasks.md)

## 当前与目标的区别

| 维度 | 当前实现 | 048 修订目标 |
| --- | --- | --- |
| 页面 owner | Auth/Ops 模块目录 | 继续由每个业务模块完整持有 |
| 宿主公开面 | `@webui/contracts`、`@webui/ui`，仍泄漏 Auth Session | 分层 `@webui/sdk/*`，只暴露通用 contract |
| 样式 | Auth/Ops 业务 selector 由模块 CSS Modules 持有 | 模块 CSS Modules；全局 CSS 只含 platform/token/reset |
| 新模块 | 可能要求宿主增加组件、样式和分支 | 只增模块文件与 composition entry |
| 新能力 | 容易随业务页面直接修改核心 | 先判定 module-local 或 host-level；host-level 单独增加 SDK interface + adapter |
| SourcePath | 构建期生成 lazy import，runtime manifest 不含路径 | 保留为受控构建元数据，并增加通用校验 |
| 启用与交付 | composition 显式选择并生成 implemented 投影 | 显式 `enabled/disabled`；未启用和未交付内容不进入可加载投影 |
| locale 与故障 | host locale 先启动，route boundary 按当前 route 加载 namespace | host locale 先启动；只加载 eligible namespace，模块失败隔离 |

## 实施门禁

本轮已按确认范围实施 SDK 分层、HostRuntime 收敛、Binding/生成门禁、可用性与资源加载隔离，并完成 fixture、CSS Modules、E2E/视觉验收、文档同步和旧耦合残留审查。逐项证据见 `tasks.md`。
