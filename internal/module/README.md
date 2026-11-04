# 应用模块

浏览器统一使用 frontend/ 的 console-web 插件体系；Go binding/webui 仅保留后端所需的模块、菜单、权限元数据。

[Files](files/README.md) 拥有私有文件目录、传输、回收状态、配额、幂等、内容编辑及只读分享授权；复用现有 IAM 与 Kernel Storage，不引入第二套认证或存储客户端。分享密码通过 composition 注入 IAM 根公开的无状态凭据摘要能力，Files 不导入 IAM 私有 Adapter，也不复用浏览器 Session 作为访客票据。

Files 的持久传输生命周期与配额由 service 拥有，tusd 与 OS 锁留在窄 Adapter 中；候选准入绑定内容和暂存位置，流式读写保持在 Kernel 租约内。浏览器传输中心属于 files 子路由，不复用演示后台任务。

`internal/module` 保存由应用组合根显式选择的纵向模块。这里的 Module 是进程内业务单元，不是 Go module、Kernel Component 或动态插件。每个模块按业务名称收口 Model、Service、Repository、协议 Adapter、binding 与 contribution；底层资源仍由 Kernel 统一创建，模块对象不进入 Kernel Plan。

新增模块必须先按 [应用模块开发指南](../../docs/development/application-module-development.md) 完成真实用例、现有能力、新 Capability、资源 owner、生命周期和当前契约适配性评估，再进入目录与接口设计。

当前已有 [IAM](iam/README.md)、[Organization](organization/README.md)、[Navigation](navigation/README.md)、[Auth](auth/README.md)、[Ops](ops/README.md)、[Migration](migration/README.md)、[Settings](settings/README.md)、[OpenAPI](openapi/README.md) 与 [Todo](todo/README.md) 模块。IAM 拥有本地身份、凭据、Session、Core RBAC、口令/会话治理（077）、机器访问令牌（078/080：权限知情创建 + 状态机 + IAM 独立管理页）与 MFA/TOTP（078）及安全告警事件接驳（079），Organization 拥有部门、岗位与账号组织关系，Navigation 拥有已注册菜单的运行策略，Auth 拥有通用认证/授权/审计执行，Ops 拥有 management、探针和诊断用例，Migration 编排显式多 set status/up，Settings 与 OpenAPI 仅保留旧模块元数据（OpenAPI 为「API 文档 + 在线调试」的工作台式模块：单路由 /openapi，左资源树 + 顶部多标签 + 请求/响应上下分割，对齐 Apifox 核心骨架、系统组件呈现，075/009；访问门槛绑定 iam.session.read），Todo 拥有业务实体、对象授权 port 与 SQL migration set；composition 只连接完成品：

```text
model <- service <- repo/binding <- module.go <- internal/composition
                    middleware ───────────────┘
```

- `model` 只表达业务状态与不变量。
- `service` 定义用例以及调用方拥有的窄 port。
- `adapter` 只封装该业务模块专属的第三方实现，并实现模块调用方定义的窄 port；第三方类型、错误、配置对象、Client 和关闭权不得越过 Adapter package，composition 不得穿透模块根导入私有 Adapter。
- `repo`、operation Handler 和各 binding 负责业务拥有的技术/协议转换；模块顶层 `handler` 包可以承载 HTTP 应用适配与 DTO 映射，但模块不创建 Router、不绑定整份应用路由，也不满足完整应用 server interface。
- `middleware` 只实现所属模块拥有的 HTTP 横切策略；不能放入其他模块的业务不变量、Service、Repository 或事务。
- `module.go` 只做纯内存局部装配。
- 模块需要定时任务时只在 `module.go` 构造项目自有 `schedule.Binding` 并通过 `Contribution.Schedules` 输出；统一调度层负责触发和运行治理，详见[定时调度能力](../../docs/development/scheduled-task-capability.md)。
- 模块需要消息生产或消费时只声明项目自有 Contract/Binding，并通过 `Contribution.Messages` 输出；payload 转换与业务 Handler 留在模块，Provider Client、ack/retry/DLX 和 Consumer lifecycle 由统一能力治理，详见[消息系统适配能力](../../docs/development/messaging-capability.md)。
- `internal/composition` 是唯一可以同时知道 Kernel Capability 与应用模块的位置。

HTTP 模块遵循固定的代码优先源头与分层：模块顶层 `handler/` 承载 HTTP 应用语义适配（`Operations`、DTO 与映射、错误呈现、`ActorAccess`），`binding/http` 拥有 Huma typed input/output 与无资源 registration；`internal/composition` 显式聚合 registration 与运行期依赖；`internal/transport/http` 统一安装 OpenAPI 校验、operation gate、项目 Problem 和 chi route。Huma 核心包仅允许进入 `binding/http`，Huma Router adapter 由 `internal/transport/http/humabinding` 隔离，`handler`、Service 与 Model 不感知框架。静态生成、policy、observability 与运行时路由消费同一 registration；新增模块不得复制 Router、route binding 或 method/path 表。

各模块契约形态：**Todo** 是完整垂直切片参考。**IAM** 贡献本地账号、Session、RBAC 的 HTTP/WebUI/CLI/config/migration/permission 完成品。**Organization** 贡献组织目录 HTTP/WebUI/migration/permission，并通过自有 `AccountDirectory` port 读取账号可分配事实。**Navigation** 贡献菜单策略 HTTP/WebUI/migration/permission，通过自有 Catalog port 读取代码静态定义，不拥有 Route 或授权关系。**Ops** 的 management HTTP 是独立 management 监听，不参与公开 contract-gen。**Auth** 只提供横切认证来源、授权和审计。**Migration** 聚合各模块显式贡献的 Set Catalog，本身不拥有业务 SQL。新增业务模块按 [应用模块开发指南](../../docs/development/application-module-development.md) 只创建真实需要的 binding。

应用级 Permission Catalog、HTTP Module、WebUI Registration 和 Migration Set 分别类型化聚合；禁止把它们塞入万能 `Contribution`。Permission Catalog 只声明稳定 Key/owner/message ID，不存角色关系、不执行授权；Migration Catalog 不提供跨 set 事务。所有清单仍由 composition 显式列出，禁止扫描、`init` 注册、Service Locator 或全局可变 Registry。

新增业务能力先把真实存在的 Model、Repository、Service、Handler、Adapter、binding、配置、migration/运行单元与 contribution 完整收口到 `internal/module/<name>`，不为对称制造空层。只服务该模块的第三方通常进入完整路径 `internal/module/<name>/adapter/<technology>` 并完全封装技术影子；数据库 ORM 是明确例外，只能由模块 `repo` 在项目租约 callback 内使用，不能传播到业务核心或公共契约。不存在无 owner 的全局 `internal/module/adapter`。

当前 Console、Todo、Navigation、IAM 与 Organization 的数据库 Adapter 均采用 concrete record + direct GORM；旧 generic Schema/Query/Repository 已删除，新模块不得重建第二套通用仓储 DSL。

只有能力评估同时证明资源跨业务复用且由进程统一选择，才进入完整 `pkg -> internal/kernel/app -> internal/kernel/composition` 链。只满足跨业务复用的普通库可以评估留在 `pkg`，但不自动获得 Kernel 组件；SDK、Client、cache、连接或 goroutine 本身都不是升级理由。

当前 Auth/JWT 遵循“模块内 Adapter、项目 port 输出”，JWK cache lifecycle、共享刷新、取消和超时都收口在 Auth Adapter；IAM 的 Argon2id Adapter 只依赖官方密码学实现并向 Service 返回项目自有 verification result，PHC 资源策略和事务内渐进重哈希不向其他模块扩散。Observability 因跨业务复用且由进程统一选择和治理，位于 `pkg/observability -> internal/kernel/app/observability -> internal/kernel/composition`。Ops 只消费项目契约，不拥有或导出 Prometheus/OTel 具体实现；运行状态见[运行能力矩阵](../../docs/operations/runtime-capabilities.md)。

禁止自动扫描、`init` 注册、Service Locator、全局可变 Registry，以及让 Handler 直接访问 Repository。


## Console

[console](console/README.md) 拥有通知、字典、API 工作台持久化与调度。跨 IAM、组织、导航和 Todo 的连接只在 composition 完成，复用原权限及服务。浏览器代码统一位于 frontend/，Go binding/webui 仅保留菜单、权限和模块元数据。
