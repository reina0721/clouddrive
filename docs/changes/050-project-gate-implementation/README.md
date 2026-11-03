# 050 项目门禁缺口实施

## 状态

已确认并实施。

## 范围

本变更承接 049 的三个已确认非文档缺口：

1. WebUI 静态扫描不再只写死 `auth`/`ops`，改为从 `internal/module/*/binding/webui/web` 动态发现模块。
2. 增加跨平台 WebUI 静态质量脚本，并接入 Windows/Linux quality workflow 与 release workflow。
3. 将 Docker OCI license label 从 `NOASSERTION` 改为项目实际声明的 `Apache-2.0`。

Playwright E2E、视觉验收、外部数据库/消息协议和真实容器运行不纳入无后端静态门禁，继续按主题文档作为独立验收证据管理。

## 阅读顺序

1. [研究档案](research/README.md)
2. [需求](requirements.md)
3. [设计](design.md)
4. [任务与证据](tasks.md)
