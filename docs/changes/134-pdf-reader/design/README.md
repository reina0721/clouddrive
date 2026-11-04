# 设计摘要

依据R134-001保留现有IAM/Storage/版本与renderer注入，新增pdfjs-dist6.4.299；不引入通用PDF框架、不自研格式解析，不新增服务进程、数据库迁移或原生operation。

- [Host与frame](host-and-frame.md)：SDK、命令、资源与界面。
- [内容与配置](content-and-policy.md)：有界流、CAS、配置、静态资产及验证。
- [ADR](adr-001-local-pdf-components.md)：组件方案和独立文件应用资产预算。

方案依据当前goal直接实施授权，不另行请求确认。实施只能覆盖I134/F261–F280及验证/交付任务；重大新事实按研究刷新规则处理。
