# 052 项目布局与可配置值集中声明

状态：已确认并实施，代码、脚本、生成物和当前 authority 已同步；验证完成并准备提交。

## 目标

把当前散落在 Go、Node、TypeScript、PowerShell、Bash、CI 与发布配置中的仓库布局路径收束为可校验的单一声明，首先闭合：

- 根 `webui/`、`internal/module/<module-id>/binding/webui/web` 与生成 registry 的路径关系；
- WebUI 开发服务地址、API/management proxy target；
- OpenAPI、operation inventory、工具目录与 release 目录等构建/交付路径；
- 应用默认配置文件路径在入口与 `config init` 之间的重复声明。

方案明确区分：

1. 构建期项目布局，进入 `.scaffold/layout.json`；
2. 部署/运行值，继续进入 typed application Config 或受控开发环境变量；
3. 协议 ID、API route、模块 ID、测试 fixture 和局部算法常量，不机械配置化。

## 当前结论

- 当前 WebUI 目录约定在 Go owner 校验、registry 生成、Node module discovery、TS/Vitest include、Vite、package scripts 和跨平台质量脚本中重复写死。
- registry import 使用固定 `../../../`，`cmd/app` 通过探测当前目录是否存在 `webui` 来切换输出路径；两者都会在目录移动或从不同 cwd 执行时漂移。
- WebUI 的 `5173`、后端 API `8080`、management `9090` 同时出现在 Vite、Playwright、后端配置和文档中，但前端工具链没有自己的受控开发配置入口。
- API 生成物、`.tools/bin`、`dist` 和 `config.yaml` 也存在跨 owner 重复；其中部分消费者无法动态读取共享清单，必须用一致性门禁而不是保留无校验副本。
- 安全策略、Kernel health/JWKS transport 调优、产品身份与独立 `frontend/` 也有可配置化候选，但改变它们会扩大运行语义或既有任务边界，本计划只记录后续研究触发器。

## 阅读顺序

1. [研究索引](research/README.md)
2. [需求规格](requirements.md)
3. [整体设计](design.md)
4. [实施任务与确认边界](tasks.md)

## 实施门禁

用户已明确确认 `LAYOUT-052-001..010`，本轮实施严格限定在任务清单范围内；若新证据要求改变公共配置边界或运行语义，应退回研究与计划阶段。
