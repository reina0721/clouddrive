# 042 研究索引

## 研究范围

本研究回答以下问题：

- 当前应用模块、Binding、Composition 与 HTTP Contract 的真实扩展路径是什么；
- Admin 页面如何由业务模块按需拥有，而不建立第二套模块系统；
- Auth、权限、i18n、Ops management 与 Application Generation 能否支撑 Admin WebUI；
- 服务端 Session、首次管理员设置和浏览器 Cookie 认证缺少哪些能力；
- React、Vite、HeroUI、Tailwind CSS 与安全基线是否存在可复核的官方依据；
- 哪些结论是当前事实，哪些只是已确认但尚未实施的目标设计。

## 检索与复用

已按 [研究档案与报告](../../../research/README.md) 检索现有 `metadata.yaml`，重点复核 030、031、032、033、034 与 041 的当前主题文档和代码结果。历史任务只作为定位线索，本轮事实以当前工作树中的源码、配置、测试和权威主题文档为准。

## 记录

- [R001 Admin WebUI 基础与模块接入研究](R001-admin-webui-foundation/report.md)：当前模块扩展链、认证缺口、Ops 数据源、前端选型、安全依据和计划影响。

## 门禁结论

关键架构、认证、安全、技术栈和范围问题已有可复核证据；事实、用户决策与目标设计已经分离，剩余未知不妨碍形成实施计划。研究门禁通过。

该结论不解除当前 Git 阻塞：前置迁移尚未提交，非文档实施必须等待干净基线。
