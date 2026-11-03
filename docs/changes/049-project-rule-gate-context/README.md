# 049 项目规范门禁语境核验

## 状态

- 任务性质：纯文档治理变更。
- 当前状态：已完成。
- 实施日期：2026-08-21。
- 范围：项目架构、模块开发、WebUI、质量与发布规范；不修改 `AGENTS.md`、源码、脚本、CI 或运行行为。
- 确认规则：最终交付物只有研究、项目规范与文档导航，按纯文档例外在研究和计划门禁通过后直接完成。

## 结论

当前项目规范部分真实命中：Go package/import、第三方类型隔离、配置 ownership、日志旁路、WebUI Catalog/生成与当前 Auth/Ops 前端检查均有可执行证据，本轮 `go test ./...`、WebUI lint/typecheck/unit 和 registry clean check 通过。

但不能据此宣称“全部规范已闭环”：三个 WebUI Node 扫描器只枚举 Auth/Ops；Go quality/release workflow 没有 WebUI job；源码已经是 Apache-2.0，而容器 license label 仍是 `NOASSERTION`。本任务修复项目主题文档的适用语境、证据范围和未通过门禁表述，不修改 Agent 协作规则，也不把尚未实施的脚本/CI/Dockerfile修复写成已完成。

## 阅读顺序

1. [研究档案](research/README.md)
2. [需求规格](requirements.md)
3. [设计说明](design.md)
4. [任务与验证](tasks.md)

## 修改位置

- [应用模块开发指南](../../development/application-module-development.md)：按业务与资源变化语义触发规范，先验证门禁是否真的发现新增对象。
- [WebUI 开发指南](../../development/webui.md)：公开当前 Go 通用门禁与 Auth/Ops 硬编码扫描的证据边界。
- [构建与容器](../../operations/build-and-container.md)：明确 `Verify-Quality` 是 Go/仓库产物门禁，不等于全项目质量门禁。
- [发布](../../operations/release.md)：明确 release job 不包含 WebUI，并如实记录 Apache 源码许可证与 OCI label 的未闭环状态。
