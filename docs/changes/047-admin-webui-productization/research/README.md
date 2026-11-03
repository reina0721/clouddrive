# 047 研究档案

本目录记录 Admin WebUI 产品化与模块化装配闭环的当前代码事实、参考站点观察和技术选择依据。

## 检索与复用

研究前已检索 `docs/**/research/**/metadata.yaml`，并复核 042–046：

- 042 提供最初 WebUI Contract、Auth/Ops 接入与安全设计，但视觉/E2E 验收未完成；
- 043 已把项目自有技术命名单轨统一为 `webui`；
- 044–046 已修复本地 HTTPS、路由前缀、Origin 和 Setup 输入错误，不需要在本任务重复建设。

## 记录

- [R001 当前 WebUI 产品化与参考样本差距](R001-current-webui-product-gap/report.md)：追踪 Contract、Composition、生成 registry、宿主、模块页面、i18n、能力状态、SoybeanAdmin 高保真参考事实与“宿主本体先行、Demo 后置”边界。
- [R002 i18n 强制契约缺口复核](R002-i18n-contract-gap/report.md)：复核当前工作树中的模块 locale 声明、宿主单实例边界、用户可见硬编码文案和 error code 映射，支撑本轮计划调整。
- [R003 Auth Session 访问边界与导航装配](R003-auth-session-access/report.md)：确认已有 Session wire 可复用，并以模块 operation、Composition policy 和 manifest access 补齐受保护页面的可发现性与 fail-closed 边界。
- [R004 Ops Dashboard 概览层与 Soybean 工作台对照](R004-ops-dashboard-overview/report.md)：记录当前 `/home` DOM 顺序，并把参考站“先总览、后详情”映射到真实 build/diagnostics 字段。
- [R005 Ops Metrics 快照与参考指标卡对照](R005-ops-metrics-snapshot/report.md)：复核参考站指标卡与当前 Prometheus 文本输出，确定只呈现真实快照、不生成历史趋势。
