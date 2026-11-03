# 053 Admin 多业务模块基础平台研究索引

本目录保留原账号权限方案研究，并记录其如何收敛为 053 平台基础、054 IAM、055 Organization、056 Navigation。研究结论足以形成计划，但不表示源码、配置、迁移或运行操作已获授权。

检索先覆盖 `docs/**/research/**/metadata.yaml` 中的 Auth、WebUI、Account、RBAC、Session、permission 和 module 记录，再从当前代码追踪实际 composition、Auth、HTTP contract、migration、Database Repository 与 WebUI Binding。外部研究使用 NIST、OWASP、Apache Casbin 以及 Gin-Vue-Admin、RuoYi-Vue-Plus、go-admin 官方文档或官方仓库。

## 记录

- [R001 当前账号、Auth 与装配边界](R001-current-account-auth-boundary/report.md)：确认现有能力、缺口、迁移 owner、HTTP 单模块限制和可复用基础；其中“完整 Account 单模块”目标已由 R005 取代。
- [R002 Core RBAC、安全语义与策略引擎选择](R002-core-rbac-security-selection/report.md)：确定首版 RBAC 子集、默认拒绝、Session 失效语义，并评估 Casbin 是否适配。
- [R003 组织目录与菜单管理边界](R003-organization-menu-boundary/report.md)：确认当前静态 WebUI Catalog 约束；其中 Account 统一拥有组织与菜单策略的结论已由 R005 取代。
- [R004 首发前 schema baseline 与 Todo 保留决策](R004-pre-release-baseline/report.md)：确认没有正式 release、区分本地数据与兼容承诺，保留 Todo 示例但取消 Todo4 自动升级链。
- [R005 主流 Admin 产物与三模块边界](R005-mainstream-admin-module-boundary/report.md)：对照主流 Admin 产品产物和真实代码归属，取代 Account 巨型模块，并把总体目标拆成 053 平台基础、054 IAM、055 Organization、056 Navigation。

## 门禁结论

关键事实已有当前代码、测试、现行 authority、既有研究和主流 Admin 官方主源支持；事实、推断、目标设计和非目标已经分离，剩余未知不妨碍形成 053–056 计划，研究门禁通过。目标、模块边界和交付批次已实质变化，旧版实施确认失效；四项非文档实施必须分别等待确认。
