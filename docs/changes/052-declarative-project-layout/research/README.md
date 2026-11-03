# 052 研究索引

本目录回答两个问题：当前 WebUI/业务模块 WebUI 的路径如何被多处消费；全仓还有哪些值应进入明确配置或集中声明，而不是继续散落写死。

## 既有研究复用

- 复用 `048/R001` 与 `048/R003` 对 module-owned WebUI、`SourcePath` 构建边界和 owner 校验的结论，并在当前 `HEAD 9368cef` 重新核对实际实现。
- 复用 `032/R001` 对“应用层默认值与路径必须由应用 owner 声明”的原则；不回退到让应用隐式消费 `pkg/*.DefaultConfig()`。
- 复用 `050/R001` 对动态发现模块与跨平台 WebUI 门禁的当前事实，并重新检查它新增的 `module-roots.mjs`。

## 记录

- [R001 WebUI 与生成路径耦合审计](R001-webui-project-layout-coupling/report.md)
- [R002 全仓可配置化候选审计](R002-configurable-hardcode-audit/report.md)

两份研究都基于当前仓库静态事实，没有运行服务、迁移数据库或写入外部系统。
