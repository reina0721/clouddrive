# 058 Casbin RBAC 注入与授权边界重构

状态：研究门禁已通过，计划已确认，实施完成。用户已确认实施 `058` 方案；任务 `RBAC-058-001..010` 全部完成并通过本地门禁，提交 `4dcf9d9`。当前行为以根 README、技术选型、IAM/Auth README 与安全文档为准。

## 目标

在保留当前 Permission Catalog、IAM 账号/角色管理、Session 安全不变量和显式 composition root 的前提下，引入成熟的 Apache Casbin Go 库接管 Core RBAC policy evaluation，并通过项目自有窄契约把授权能力注入 Auth/HTTP 架构。

本计划把用户所说的 A/B/中间人明确为：

- A：Auth、operation gate 与业务 action authorization 组成的授权消费架构；
- B：IAM 内的 RBAC 权限配置业务能力，以及隐藏在 IAM Adapter 内的 Casbin evaluator；
- 中间人：Auth 使用方定义的 `DecisionPoint` port，由 composition adapter 把 IAM RBAC evaluator 适配并注入 Auth；
- request context：只携带经过认证的 `Principal` 与授权快照 revision，不携带 Service、Enforcer 或容器。

## 核心结论

- 采用 Apache Casbin `github.com/casbin/casbin/v3` 的当前稳定版 `v3.10.0`，不采用 snapshot 版本。
- Casbin 只拥有内存 policy evaluation；IAM 现有 Account、Role、AccountRole、RolePermission、Session 与 Permission Catalog 继续是唯一业务和存储 authority。
- 动态权限分配采用 Catalog 驱动的集合替换：运行时可以创建业务角色、给账号分配角色、给角色分配已注册 PermissionKey；不能运行时创建没有代码消费方的 PermissionKey、matcher 或 URL policy。
- 动态分配 API 必须携带 expected version，事务内计算 diff、维护 owner、撤销受影响 Session、bump authorization revision，并在 commit 后原子发布完整 evaluator；不直接调用 Casbin Management API 改写内存状态。
- 装配采用三级显式 composition：根 Generation 只编排资源、模块切片和生命周期；identity-access 子装配连接 IAM/Auth；IAM `module.go` 自己构造 Repository、Casbin Adapter、revision Runtime 与 Handler。根层不接收 Casbin Factory、PolicySource 或内部 refresher。
- 不引入 `gorm-adapter` 或通用 `casbin_rule` 表，不允许 IAM CRUD 与 Casbin Management API 双写。
- 不把 RBAC 拆成与 IAM 平级的独立顶层模块。角色/权限 mutation、owner 不变量、账号 `SecurityRevision` 与 Session 撤销需要同一事务；机械拆分会制造跨模块事务或最终一致性漏洞。
- 不把 `internal/kernel/app.Binding` 当作请求上下文或 Service Locator。它只适合构建期 typed 依赖声明；业务模块继续由 composition 显式构造。
- 为跨 Generation 与并发 mutation 增加数据库 authorization revision。Evaluator 只发布完整、已校验的不可变 policy snapshot；revision 不匹配时同步刷新，刷新失败即拒绝。

## 阅读顺序

1. [研究索引](research/README.md)
2. [需求规格](requirements.md)
3. [设计方案](design.md)
4. [实施任务与确认状态](tasks.md)

## 实施门禁

本计划包含源码、依赖、migration、测试和当前 authority 文档修改，属于非纯文档实施。只有用户在本计划报告之后的后续消息中明确确认 `RBAC-058-001..010`，才能进入实施。
