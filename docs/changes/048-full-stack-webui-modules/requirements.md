# 048 业务模块自有 WebUI 与通用 SDK 需求

## 1. 产品目标

建立可持续扩展的后台业务模块体系。每个业务模块完整拥有自己的后端能力和 WebUI 页面，并通过稳定 SDK 使用宿主能力；新增普通业务模块不修改 `webui` 核心。

## 2. 术语

- **业务模块**：`internal/module/<id>` 下以稳定 `ModuleID` 标识的完整业务边界。
- **模块 WebUI**：业务模块 `binding/webui/web` 下的 page、API client、query、locale、component、局部 style 与 test。
- **WebUI SDK**：业务模块可以导入的项目自有稳定接口，路径为 `@webui/sdk/*`。
- **WebUI platform**：Router、Shell、i18n runtime、theme、global state 和 SDK adapter 的私有实现。
- **SDK capability**：一个具有稳定语义、版本、失败行为和 adapter 的宿主能力，不是运行时任意查询的 service。
- **module-local adapter**：只服务单一业务模块的新技术封装，留在该模块内部，不进入 WebUI core。

## 3. 所有权要求

| ID | 要求 |
| --- | --- |
| REQ-001 | 业务模块必须完整持有自己的 WebUI 源码；不得把账号、审计、配置、运维等页面迁入 `webui/src/pages` 或 `webui/src/module`。 |
| REQ-002 | 模块 WebUI 必须与所属模块的业务 Model/API/operation/error semantics 对齐，但页面只通过 HTTP/API client 调用后端，不直接访问 Go 对象或 Repository。 |
| REQ-003 | `webui/` 只拥有宿主、公共 SDK、SDK adapter、构建和验证，不拥有任何业务页面、业务 DTO、业务表格列、业务表单或业务 locale。 |
| REQ-004 | Auth/Ops/Audit/System 等模块专属样式必须由模块持有并使用 CSS Modules 或等价局部作用域；宿主全局 CSS 禁止业务 selector。 |
| REQ-005 | 模块 locale namespace、错误码到 message ID 映射、query key、页面状态和视觉测试全部归模块。 |

## 4. 普通模块接入要求

| ID | 要求 |
| --- | --- |
| REQ-006 | 普通新模块只允许修改自身 `internal/module/<id>`、必要 API authority，以及 `internal/composition` 的唯一 WebUI module 汇总点。 |
| REQ-007 | 普通新模块不得修改 `webui/src/platform/**`、Router、Shell、global CSS、SDK implementation、registry generator 或其他业务模块。 |
| REQ-008 | 模块通过项目自有 `webui.Binding` 声明 Entry、Route、Navigation、Locale 和需要的 SDK capability；声明必须不可变且在生成/启动副作用前校验。 |
| REQ-009 | `SourcePath` 只用于构建期定位模块自有 TS/TSX Entry 与 JSON Locale；必须位于声明模块的受控目录，禁止绝对路径、目录逃逸和 runtime manifest 暴露。模块 CSS 由 Entry 静态导入并保持局部作用域。 |
| REQ-010 | `internal/composition` 是唯一同时知道各模块 WebUI Binding 的位置；增加一项属于应用装配，不属于修改 WebUI core。 |
| REQ-011 | 禁止目录扫描、`import.meta.glob` 自动注册、`init` side effect、全局可变 registry、Service Locator 和运行时任意字符串 import。 |
| REQ-012 | 生成 registry 只把通过校验的模块 Entry/Locale 变成 lazy import；不得生成模块专属 Router 分支、CSS 或业务逻辑。 |

## 5. SDK 契约要求

| ID | 要求 |
| --- | --- |
| REQ-013 | 模块生产代码只能导入明确允许的 `@webui/sdk/*` public surface；禁止导入 platform 内部、宿主组件源码、i18n singleton、Router/Store 实例和第三方 UI 具体类型。 |
| REQ-014 | SDK 首批至少收敛 runtime/navigation、HTTP、i18n、query、UI primitives、feedback/overlay 和通用 identity/access view；每项接口必须定义取消、错误、资源和响应式语义。 |
| REQ-015 | SDK 不得暴露万能 Context、任意 `resolve(id)`、`map[string]any`、第三方 client 或跨模块可变状态。 |
| REQ-016 | SDK adapter 由 `webui` platform 持有，业务模块只依赖 interface/public hooks，不依赖 adapter 实现。 |
| REQ-017 | React/JSX 是已选定的 WebUI 基础运行技术；Router、i18n、query、UI library 和浏览器 I/O 等易变第三方能力必须通过项目 SDK 边界提供。 |
| REQ-018 | SDK capability 必须使用稳定语义和主版本；破坏性变化单轨迁移全部模块，不保留长期兼容别名。 |

## 6. 新能力或新技术升级规则

| ID | 要求 |
| --- | --- |
| REQ-019 | 新模块提出新需求时，必须先判断现有 SDK 是否已能表达，不得因页面实现习惯直接修改 core。 |
| REQ-020 | 只服务该模块、且不需要宿主生命周期/全局状态/跨模块复用的新技术，由模块内部 Adapter 封装；第三方类型不得越过模块边界。 |
| REQ-021 | 需要接入 Router、Shell、全局 overlay、统一凭据、全局任务、主题、可访问性或其他宿主机制的新能力，必须先建立项目自有 SDK interface。 |
| REQ-022 | 新 SDK capability 必须单独研究真实用例、现有能力缺口、技术选型、失败语义、资源 owner 和适配边界，并在计划中明确获得确认。 |
| REQ-023 | SDK adapter 必须通用且不知道请求它的业务模块；实现或测试中出现具体 ModuleID 分支即视为契约失败。 |
| REQ-024 | 新业务模块与新 SDK capability 可以属于同一总体目标，但必须分成“SDK contract/adapter”与“module adoption”两个任务；前者先通过 contract tests，后者才能消费。 |

## 7. 路由、权限和运行要求

| ID | 要求 |
| --- | --- |
| REQ-025 | runtime manifest 继续作为 route/menu/access view；只包含安全的 ID、path、title message ID、layout、delivery/access state，不包含 SourcePath 或 adapter 细节。 |
| REQ-026 | 服务端 operation gate 始终是最终授权 authority；前端 access 只用于菜单、守卫和状态呈现。 |
| REQ-027 | 宿主只理解通用 Principal、Access、Route、CapabilityState 和 HostRuntime；不得公开 WebUISession、角色 DTO、Ops diagnostics DTO 等业务类型。 |
| REQ-028 | 模块之间禁止源码 import；跨模块导航只使用稳定 RouteID，跨模块业务协作通过后端窄契约和 composition。 |
| REQ-029 | 模块页面必须支持 lazy load、取消、loading、empty、degraded、unavailable、denied 和 route failure，错误信息保持低敏。 |
| REQ-030 | Session、CSRF、Origin、CORS、Cookie 和 operation semantics 不因 SDK 重构而降低安全要求。 |

## 8. 启用、降级与加载门禁

| ID | 要求 |
| --- | --- |
| REQ-031 | 应用 composition 必须以显式注册表达 Selection 与 Activation。Activation 只允许 `enabled`、`disabled`；未指定、未知或非法值必须构建失败，不得根据源码目录、Binding 存在或配置缺失自动启用。 |
| REQ-032 | 未选择或 `disabled` 模块不得进入可部署 Catalog、Entry registry、locale registry、runtime manifest、Router 或 Navigation。Activation 改变静态 registry 时必须重新生成、构建和部署，不承诺运行时热启用。 |
| REQ-033 | `DeliveryState=not-implemented` 只表示非交付声明，不得声明 Entry、默认路由、匿名默认路由或菜单，不得进入 runtime manifest；生成器不得为未交付 route 生成可加载 Entry/Locale。 |
| REQ-034 | 服务端必须为已启用、已交付 route 提供通用 `AvailabilityState=available|degraded|unavailable`。缺失、超时、未知或非法状态按 `unavailable` fail closed，不得猜测为可用。 |
| REQ-035 | `degraded` 只有模块明确声明支持降级呈现并提供仍可用 capability/operation 集合时才允许挂载模块页面；否则归一为 `unavailable`。服务端 operation/resource gate 始终是最终 authority。 |
| REQ-036 | 宿主必须在业务资源加载前按 revision、access、availability 顺序执行 route guard。只有 `implemented + allowed + (available 或受支持的 degraded)` 才能触发 Entry、模块 locale 和页面 query。 |
| REQ-037 | WebUI 启动只加载宿主 locale；模块 namespace 必须基于已接受 manifest 和当前 eligible route 按需加载。单模块 locale/Entry/page 失败只能隔离对应 route/module，不能阻止 Shell、登录或其他模块启动。 |
| REQ-038 | access 收回、availability 变为 unavailable 或 manifest generation/revision 改变时，SDK 必须取消该 route 的在途请求并禁止新的自动 query；不得无限重试或静默回退旧实现。 |
| REQ-039 | 未选择、disabled、not-implemented 和 denied route 不出现在菜单，直接访问呈现宿主 404/403；unavailable 默认隐藏或使用不依赖模块 locale 的宿主 disabled 状态，业务页面不得挂载。 |
| REQ-040 | Activation、Delivery、Availability 与 Access 必须保持独立类型和 authority，不得复用单个布尔值、任意字符串或页面局部异常来推断其他状态。 |

## 9. 质量与验证要求

- 架构测试证明 platform 不导入任何业务模块，模块只导入 SDK public surface，模块之间无 import。
- 普通模块 fixture 只新增模块文件和 composition entry，`webui/` 零 Diff 即可生成 route、menu、locale 和 lazy page。
- 新 SDK fixture 证明缺失 capability 时生成/类型检查失败，adapter 与模块 ID 无关。
- 全局 CSS 扫描拒绝业务 selector；模块局部 style 不污染其他模块。
- Binding 校验覆盖 ownership、path escape、duplicate、unknown SDK requirement、route/navigation/locale 引用和 operation ID。
- 状态矩阵覆盖未选择、disabled、not-implemented、authentication-required、denied、unknown/unavailable、degraded 和 available，并证明失败分支不会执行 Entry/Locale/Query loader。
- locale/Entry 单模块故障注入证明 Shell、公共登录和其他模块保持可用；状态变化证明 query 能取消且不会重新自动加载。
- Auth/Ops 迁移保持真实 setup/login/logout/session、CSRF、Origin、management query、权限和错误语义。

## 10. 非目标

- 不把业务 WebUI 移入 `webui/src/module`。
- 不追求 Go 与 WebUI 完全独立构建；当前是同仓库、静态编译的业务模块 WebUI。
- 不实现第三方插件市场、远程模块、Module Federation 或运行时安装卸载。
- 不为所有模块强制创建 WebUI；没有真实浏览器用例的模块继续无 WebUI Binding。
- 不建立万能 `utils`、万能 SDK 或运行时 capability resolver。
- 不提供静态模块的运行时安装、卸载或热启用；Activation 变化走重新生成、构建和部署。
- 不在 048 基础重构中实现完整账号权限、审计或系统配置业务。

## 11. 验收标准

1. 现有 Auth/Ops 页面仍位于各自业务模块，且业务 CSS、API、locale 和页面测试全部模块自有。
2. 新增一个普通模块测试 fixture 时，`webui/src/platform`、Router、Shell、global CSS 和 SDK adapter 零修改。
3. 只有新增真实宿主能力时才增加 SDK interface/adapter，并有独立研究、任务和 contract test。
4. 宿主代码不包含具体业务模块 import、ModuleID 分支、业务 DTO 或业务 selector。
5. SourcePath 仅构建期可见且受 owner/path 校验，runtime manifest 保持低敏。
6. Go、生成、TypeScript、React、架构、E2E 和视觉门禁全部通过后才完成单轨迁移。
7. 未启用或未交付模块在 registry、manifest、菜单和浏览器资源请求中均不存在；无权限或 unavailable route 不执行业务 loader。
8. degraded route 只执行声明可用的能力；任一模块 locale/Entry/page 失败不影响宿主与其他模块。
