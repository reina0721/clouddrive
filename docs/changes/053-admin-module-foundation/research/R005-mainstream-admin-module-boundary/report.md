# R005 主流 Admin 产物与三模块边界

## 1. 研究问题

053 旧方案把账号、凭据、Session、角色、权限、部门、岗位和菜单策略全部交给 `account`。用户进一步指出，账号权限体系应产出多个业务模块，并要求核对当前设计是否符合主流 Admin。

本研究分别回答两个问题：

1. 用户最终看到的页面、API、schema 和管理流程是否覆盖主流 Admin 核心产物；
2. 这些产物在当前仓库中应形成几个顶层应用模块，不能用页面菜单数量替代业务不变量分析。

## 2. 方法与范围

- 外部样本只使用 Gin-Vue-Admin 官方文档/源码、RuoYi-Vue-Plus 官方源码和 go-admin 官方源码。
- 内部证据重新核对模块完成品、composition、Auth 本地 Session、HTTP Contract、WebUI Catalog、Migration 和 Database transaction 契约。
- 比较只覆盖账号权限与组织管理 V1，不把完整企业级 Admin 的全部功能默认塞入 053。
- 外部项目的目录只证明其自身组织方式；目标边界仍必须服从当前项目的显式 composition、模块 owner、静态 WebUI Catalog 和事务约束。

## 3. 主流 Admin 产品产物

| 能力产物 | 旧 053 | 主流样本 | 判断 |
| --- | --- | --- | --- |
| 用户管理 | 有 | 标配 | 一致 |
| 角色管理 | 有 | 标配 | 一致 |
| Role-Permission | 有 | 标配 | 一致 |
| 菜单管理 | 已注册菜单策略 | 标配 | 能力基本一致，模型不同 |
| 部门管理 | 有 | 标配 | 一致 |
| 岗位管理 | 有 | 常见标配 | 一致 |
| 登录/改密/reset | 有 | 标配 | 一致 |
| 禁用与 Session 失效 | 有 | 标配或增强 | 合理 |
| 按钮/API 权限 | operation permission | 通常区分菜单/按钮/API | 能力一致，存储模型不同 |
| 部门数据范围 | 明确不实现 | 成熟 Admin 常见 | V1 缺口，后续增强 |
| 登录/操作日志 | 只有低敏事件 | 成熟 Admin 常见页面 | 后续独立模块 |
| 字典/参数 | 没有 | 很多 Admin 标配 | 后续独立模块 |
| 多租户 | 不实现 | 部分项目支持 | 当前不加入 |

Gin-Vue-Admin 使用用户/用户组到角色、权限和资源的 RBAC，并将用户、菜单、角色、部门、岗位等组织在 `system` API/Service 范围；新版本还提供组织维度的数据权限。RuoYi-Vue-Plus 使用 `ruoyi-system`，内部再按 controller/domain/mapper/service 分层。go-admin 使用 `app/admin`，内部再按 APIs/Models/Router/Service 分层。

事实结论：主流 Admin 会共同产出用户、角色、权限、菜单、部门和岗位，但没有证据支持“每个管理页面必须成为一个顶层应用模块”。

## 4. 当前项目事实

- 当前 `internal/module/<name>` 是有 owner 的应用垂直切片，`module.go` 只做局部装配，composition 是唯一跨模块连接点。
- `module.Contribution` 已聚合 Participants、Schedules、Messages；HTTP 和 WebUI 由 composition 显式登记。当前模式可以增加多个模块，不需要自动发现或 DI 容器。
- WebUI Route、Entry、Navigation 和源码在构建期 Catalog 中校验，runtime manifest 只做 access/availability 投影；数据库 component path 不符合当前加载模型。
- Auth 当前同时拥有通用认证授权与本地 WebUI 用户/Session，后者是 IAM 业务所有权缺口。
- Database 已提供 `WithinTx` 和不暴露第三方 session 的 Tx token；单模块内部可以保持业务原子性。
- Migration 当前需要从单 set 使用方式演进为显式多 set Catalog，但不需要修改 Kernel 资源生命周期。

## 5. 边界方案比较

### 5.1 单一 Account 模块

优点是首个 owner、角色和 Session 容易同事务处理；缺点是 Account 同时拥有组织、导航、全部 WebUI 和全部 schema，权限键被迫使用错误的 `account:*` 前缀，后续日志、数据范围和配置容易继续堆入。该方案已经表现出多个 XL/XXL 任务和模糊 owner，不再采用。

### 5.2 Account、Authorization、Organization、Navigation 四模块

命名更清晰，但 Account/Authorization 边界切穿以下不变量：

- Account 状态与 owner role 共同决定最后 active owner；
- 账号角色、角色权限改变需要使对应 Session 失效；
- 首次 setup 同时创建账号、凭据、system role、权限和 Session。

为此引入跨模块事务协调器、补偿或复制状态，对当前单进程、共享数据库、Core RBAC V1 得不偿失。

### 5.3 IAM、Organization、Navigation 三模块与分批交付

- IAM 共同拥有本地身份和访问管理，使最后 owner、RBAC 与 Session 保持单事务边界；
- Organization 只保存账号稳定 ID，通过调用方定义的 AccountDirectory port 验证 IAM 主体；
- Navigation 只保存已注册菜单策略，通过 composition 接收静态 Catalog 投影；
- 现有 Auth 保持通用 Principal、Bearer/JWT 和最终 decision，不变成第二套 IAM。

该模块方案既避免 Account 巨型模块，也避免为页面数量进行过度拆分。交付上不能继续塞入一个巨型 053：先由 053 补齐 Permission、Migration、Auth security source 与 NavigationPolicy 等平台契约，再由 054、055、056 分别实施 IAM、Organization、Navigation。四项变更分别确认，避免一边实现业务一边反复改底座。

## 6. 与主流实现有意不同的地方

不少传统 Admin 同时保存 role-menu、API policy 或数据库 component path。当前项目不照搬：

- RolePermission 是唯一授权存储，菜单/view/action 只是同一 Permission Catalog 的展示投影；
- Route、Entry、component 和 ViewOperationID 继续由代码注册；
- MenuPolicy 只允许已注册 NavigationID 的 enabled、parent、order；
- 服务端 operation gate 是最终授权 authority，菜单隐藏不构成安全控制；
- Core RBAC 只有精确 key，不因主流样本使用 Casbin 就引入额外 policy storage、matcher 和缓存同步链。

这是根据当前静态 WebUI 和精确 operation policy 做出的适配，不是产品能力缺失。

## 7. 必要架构影响

053 只实施以下定向平台升级：

1. 各模块贡献 Permission Definition，composition 构建不可变 Permission Catalog；
2. Migration 应用层聚合 Todo、IAM、Organization、Navigation 四个 set；
3. HTTP Contract/Dispatcher 正式支持多业务模块和 `webuiSession` security；
4. WebUI Manifest 接受通用 NavigationPolicy snapshot，并区分 Catalog Revision 与 NavigationRevision；
5. 为 Auth 本地用户、密码和 Session 在 054 单轨迁入 IAM 准备可替换认证来源契约；
6. 冻结 Organization/Navigation 未来通过调用方窄 port 和 composition Adapter 引用 IAM/WebUI 投影的规则。

不需要重构 Kernel、引入 DI/插件扫描、通用跨模块事务、事件总线或第三方策略引擎。

## 8. 适用边界、局限与剩余未知

本结论适用于当前单进程模块化单体、共享数据库、静态 WebUI Catalog 和 Core RBAC V1。它不回答微服务拆分、外部 IAM、多租户、部门数据范围或复杂策略引擎问题。

主流样本版本会继续演进，但其“核心产物集中在 system/admin 领域并内部拆分”的事实只用于反证页面级过度拆分；当前项目不依赖这些项目的具体 API 或数据库兼容性。

剩余实现未知包括三驱动 row-lock/conditional mutation 的最窄契约，以及页面是否暴露新的通用 SDK 缺口。它们已经进入任务重新确认触发器，不妨碍形成当前计划。

## 9. 对 053 的影响

- R001/R003 中“完整 Account 统一拥有组织和菜单策略”的目标结论被本研究取代；其当前代码事实和静态菜单安全约束仍作为证据继承。
- R002 的 Core RBAC、安全语义和不引入 Casbin结论继续有效。
- R004 的首发前干净 baseline、Todo 保留和本地数据库保护结论继续有效；migration set owner 从 Todo/Account 更新为 Todo/IAM/Organization/Navigation。
- 053 改为 `FOUNDATION-053-*`，只建设通用平台契约；054、055、056 分别拥有 IAM、Organization、Navigation 的 schema、HTTP、WebUI 和 permission namespace。
- 旧版 `ACCOUNT-053-*` 实施确认失效，053–056 必须分别重新待确认；已暂停草稿不能作为任何新方案的完成证据。

## 10. 研究门禁

主流产品产物、当前仓库能力、三种边界方案、事务不变量、必要架构影响和非目标已有可复核证据。事实、比较推断、用户选择和目标设计已经分离，足以形成新计划；研究门禁通过，不构成非文档实施授权。
