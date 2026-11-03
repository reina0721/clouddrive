# R004 WebUI 模块启用、降级与加载门禁

## 1. 研究结论

当前实现已经用 `React.lazy` 延迟执行页面 Entry import，但还没有形成完整的“是否允许加载”契约：

- composition 会把 Auth/Ops Binding 无条件交给 Catalog；
- Catalog 和生成器会处理所有 Entry、Route 与 Locale，包括 `not-implemented` 路由引用的资源；
- runtime manifest 会返回所有 route，再由 `App.tsx` 在渲染时判断 `deliveryState` 和 `access`；
- `initializeI18n()` 在 manifest 到达前遍历 `webuiLocaleRegistry`，启动时加载全部模块 locale。

因此，“页面没有渲染”不等于“模块没有加载”。当前页面 chunk 通常能被 route guard 截住，但 locale 已被全量加载；一个模块的 locale import 失败还会让整个 i18n 初始化失败。048 必须把门禁前移到 composition、生成投影和资源加载边界。

### 1.1 方法与范围

本研究沿 `applicationWebUICatalog -> BuildCatalog/ManifestFor -> GenerateWebUIRegistry -> initializeI18n -> App/ManifestPage` 追踪模块从 Go 声明到浏览器渲染的真实路径，并区分“进入构建”“发起浏览器 import”“挂载页面”“启动页面查询”四种行为。

范围只包含后台 WebUI 的静态模块装配、运行状态与资源加载；不研究远程模块、动态插件市场，也不改变后端 operation 授权、Session/CSRF 或具体业务 API。

## 2. 当前事实

### 2.1 composition 没有显式启用状态

`applicationWebUICatalog()` 直接调用 `BuildCatalog(authwebui.Binding(), opswebui.Binding())`。源码存在且被列入该调用，就自动进入 Catalog；没有独立的 `disabled` 状态，也没有“未指定状态必须失败”的安全默认。

### 2.2 `not-implemented` 仍进入构建与 manifest

`DeliveryState` 当前允许 `implemented` 和 `not-implemented`。`BuildCatalog` 对两者都要求有效 Entry，`GenerateWebUIRegistry()` 又遍历 Catalog 的全部 Entry/Locale 生成 dynamic import。`ManifestFor()` 也会返回全部 route。

`App.tsx` 会在取得 route 后先返回宿主 `notImplemented` 状态，因而该次访问不会执行页面的 lazy loader；但该 Entry 仍被编译进 registry，模块 locale 也不受该 route guard 保护。

### 2.3 locale 是当前最早的自动加载点

`main.tsx` 在挂载应用前执行 `initializeI18n()`。该函数遍历 `webuiLocaleRegistry` 的全部 language/namespace 并逐一 `await loadMessages()`。这发生在 manifest、access 和运行可用性判定之前，任一模块 locale 失败都可能阻止整个 WebUI 启动。

### 2.4 已存在状态没有清晰分层

当前前端定义了 `CapabilityState = available | degraded | unavailable | not-implemented`，但 runtime manifest 没有通用 availability authority，`DeliveryState`、权限结果与运行故障之间也没有统一的加载顺序。页面可以自行呈现 degraded，但宿主无法在 import 前判断某个模块是否应被加载。

## 3. 目标状态模型

必须分开五种含义，不能合并成一个布尔值：

1. **Selection**：应用 composition 是否包含该模块注册；未选择时完全不存在于本次 WebUI 构建。
2. **Activation**：已注册模块是否由应用 profile 显式启用；只允许 `enabled`/`disabled`，未指定或未知值构建失败。
3. **Delivery**：route 是否已经实现并可交付；`not-implemented` 只作为非交付声明，不得暴露为可访问业务页。
4. **Availability**：已交付 route 当前是 `available`、`degraded` 还是 `unavailable`；由服务端通用运行快照给出。
5. **Access**：当前主体是 `allowed`、`authentication-required` 还是 `denied`；服务端 operation gate 仍是最终授权 authority。

只有以下条件同时成立时，浏览器才允许加载业务资源：

```text
selected
&& activation == enabled
&& delivery == implemented
&& access == allowed
&& availability in {available, degraded}
```

其中 `degraded` 还必须由模块明确声明支持降级呈现；否则按 `unavailable` 处理。未知、缺失、超时和非法状态一律 fail closed，不推断为 `enabled` 或 `available`。

## 4. 分阶段门禁

### 4.1 构建投影门禁

composition 使用显式模块注册，而不是目录扫描。未选择模块不进入注册列表；`disabled` 注册不进入可部署 Catalog、registry 或 runtime manifest。Activation 改变静态 registry，必须重新生成、构建和部署，不承诺浏览器热启用。

`not-implemented` route 不得声明默认路由、匿名默认路由或导航，不得进入 runtime manifest。生成器只输出至少被一个 `implemented` route 引用的 Entry，以及这些已交付 route/导航实际引用的 locale namespace。这样未完成页面不会以占位 Entry 的形式进入生产 bundle。

`disabled` 不是跳过结构检查后偷偷发布的兼容开关；启用时必须完整通过 Binding、SourcePath、locale、SDK requirement 和 operation 校验。源码尚未形成有效 Binding 的模块应保持未选择，而不是靠运行时错误兜底。

### 4.2 runtime manifest 门禁

服务端在安全 manifest 中提供已启用、已交付 route 的 access 与 availability 快照。宿主验证 revision 后，按固定顺序处理：

1. `authentication-required`：跳转公共登录路由，不加载目标业务资源；
2. `denied`：呈现宿主 403，不加载目标业务资源；
3. `unavailable` 或未知：呈现宿主通用不可用状态，不加载业务 Entry/locale/query；
4. `degraded` 且模块支持：加载模块页面，并把受限 capability 快照交给 SDK；
5. `available`：正常加载。

禁用或未交付 route 根本不出现在 manifest，直接访问其旧 path 得到宿主 404，避免泄漏未发布能力。

### 4.3 locale 门禁

宿主启动只加载 `webui.host` locale。manifest/revision 接受后，只加载当前允许展示的 route/navigation 所需 namespace；进入具体 route 前保证该 route namespace 就绪。

模块 locale 加载失败只把受影响 route 标为不可用并记录低敏诊断，不能让 Shell、登录页或其他模块一起失败。语言切换复用同一 eligible namespace 集合，不得重新全量遍历 registry。

### 4.4 query 与副作用门禁

`sdk/query` 和 `sdk/http` 接收 route runtime snapshot 与 `AbortSignal`。页面只有在 route guard 通过后才能挂载；route 变为 unavailable、access 收回或 manifest generation 变化时，SDK 取消相关请求并禁止新的自动查询。

`degraded` 不是“请求失败后继续无限重试”。模块必须声明仍可用的 capability/operation，并只启动这些请求；没有声明的能力默认不可调用。服务端 operation 与资源检查仍会 fail closed，前端门禁不能替代授权。

## 5. 呈现策略

| 状态 | 菜单 | 直接访问 | Entry/locale/query |
| --- | --- | --- | --- |
| 未选择 / disabled | 不出现 | 404 | 全部不生成、不加载 |
| not-implemented | 不出现 | 404 | 全部不生成、不加载 |
| authentication-required | 不展示受保护菜单 | 跳转登录 | 目标模块全部不加载 |
| denied | 不出现 | 宿主 403 | 全部不加载 |
| unavailable / unknown | 默认隐藏；必要时可用宿主通用 disabled item 呈现 | 宿主通用不可用页 | 业务资源全部不加载 |
| degraded 且明确支持 | 显示 degraded 标识 | 模块降级页 | 只加载该 route 资源和允许的请求 |
| available | 正常显示 | 模块页面 | 按 route lazy load |

“显示 disabled item”只能使用宿主通用文案和状态，不得为了展示 unavailable 模块而提前加载其 locale。

## 6. 错误隔离与诊断

- 构建期结构错误继续 fail fast，不能产出半有效 registry。
- runtime revision mismatch 是宿主级错误，停止全部业务装配。
- 单模块 availability、locale、Entry 或页面异常只隔离该 route/module；Shell 与其他模块保持可用。
- 诊断只记录稳定 ModuleID、RouteID、phase、generation/revision 和低敏错误码，不记录 token、原始响应、URL query 或业务数据。
- 不允许“加载失败就回退旧实现”。恢复只能刷新同一代状态或部署新的有效构建。

## 7. Capability、资源 owner 与生命周期影响

- 复用当前 Binding/Catalog、runtime manifest、静态 lazy registry、React Router 和 i18n 基础，不引入 Module Federation、目录扫描或第二套路由器。
- 新增的是通用 activation/deployable projection、availability snapshot、route load gate、locale gate 与 query cancellation contract；这些属于 host-level SDK/platform capability，不能由单一业务页面私有实现。
- composition 拥有 Selection/Activation 和 availability provider 聚合；业务模块拥有 Delivery 声明与本模块 degraded capability 描述；服务端 operation 仍拥有最终 Access；platform 拥有资源 loader、错误隔离和请求取消。
- Selection/Activation 属于构建期固定状态，变化需要重新生成、构建和部署。Availability/Access 属于运行快照，可刷新但不能改变静态 registry；刷新失败保留宿主并把未知业务 route fail closed。
- 不新增数据库、外部消息、后台 goroutine 或第三方远程 I/O。availability provider 如果后续需要探测外部依赖，必须在对应业务任务中另行明确超时、缓存、资源 owner 和生命周期。

## 8. 适用性、局限与剩余未知

本结论适用于当前同仓库、静态编译的模块 WebUI，以及 Account、Audit、System Settings、Maintenance Tools 等未来模块。它不适用于运行时安装、卸载、远程 chunk 或多版本同时装载；出现这些需求必须重新研究，不能扩张当前 Activation 语义。

当前尚未冻结 `ModuleRegistration`、availability provider、route runtime snapshot 和 SDK query gate 的逐符号签名，也未决定 unavailable 菜单在具体产品中默认隐藏还是显示宿主 disabled item。这些未知不影响“未通过门禁绝不加载”的计划，但必须分别在 ACT-001、AVAIL-001、LOAD-GATE-001 与 SDK-001 中冻结并验证。

## 9. 对 048 的影响

048 需要新增 application-owned `ModuleRegistration/ActivationState`、可部署 Catalog 投影、通用 availability contract、route 加载门禁、按需 locale 和 query 取消语义。普通业务模块仍只持有自身页面；所有门禁都是无 ModuleID 分支的通用 SDK/platform 能力。

这是一项目标设计，当前代码尚未实现。实施必须按 tasks 中独立任务和验证矩阵完成，不能把现有 `CapabilityState` 类型视为已具备运行降级能力。
