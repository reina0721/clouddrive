# 053 Admin 多业务模块基础平台

状态：已完成。原 `account` 单模块方案和“一个 053 同时实现三个业务模块”的方案均已失效；053 只定向补齐 IAM、Organization、Navigation 所需的通用聚合契约，未实施三个业务模块。

## 目标

在保留现有模块化垂直切片、显式 composition root、typed HTTP Contract、WebUI Catalog、Database transaction 和 Kernel 生命周期模型的前提下，补齐 Admin 多业务模块进入项目所必需的平台能力：

- 类型化 Permission Definition 与项目级 Permission Catalog；
- 确定性的多 Migration Set Catalog；
- 多 HTTP Module dispatcher 与 `none/bearer/webuiSession` security profile；
- Auth 可替换认证来源与请求级 Principal 注入契约；
- WebUI NavigationPolicy 投影，以及 Catalog/Navigation 双 revision；
- 模块 HTTP、WebUI、Permission、Migration 完成品的显式聚合和 owner 校验。

053 不创建 Account、Role、Department、Position 或 MenuPolicy 业务表和页面。后续按依赖顺序独立规划：

1. [054 IAM](../054-iam/README.md)
2. [055 Organization](../055-organization/README.md)
3. [056 Navigation](../056-navigation/README.md)

## 保留的架构

- `internal/module/<name>` 模块化垂直切片；
- composition 是唯一跨模块连接点；
- 模块之间不直接 import，由调用方窄 port 和 composition Adapter 连接；
- typed HTTP Contract、统一 operation gate 和静态 OpenAPI/operation inventory；
- WebUI Binding、Catalog、Manifest 和 generated registry；
- `Database.Client.WithinTx`；
- Kernel 配置代际、资源生命周期、重载和 Supervisor；
- Todo 独立、可删除的学习示例定位。

## 明确不做

- 不重构 Kernel、Database、HTTP 或 WebUI 整体架构；
- 不引入 Fx、Wire、通用 DI Container、Service Locator、`init` 注册或运行时模块扫描；
- 不引入微服务、事件总线、分布式事务或通用跨模块事务协调器；
- 不引入 Casbin、OpenFGA、OPA 或第二套 authorization service；
- 不建立万能 `module.Contribution`，各类完成品仍由 composition 显式、类型化聚合；
- 不提前实现 054–056 的业务模型、schema、API、页面或配置。

## 阅读顺序

1. [研究索引](research/README.md)
2. [需求规格](requirements.md)
3. [设计方案](design.md)
4. [实施任务与确认状态](tasks.md)

## 实施门禁

用户已在当前计划报告之后明确确认 053，现可实施 `FOUNDATION-053-001..009`。本次确认仅覆盖 053；053 完成不自动授权 054、055 或 056，每项后续变更仍必须分别在其计划报告后获得确认。
