# 048 业务模块自有 WebUI 与通用 SDK 整体设计

## 1. 设计结论

采用“业务模块完整持有 WebUI + WebUI core 提供通用 SDK”的静态装配模型：

```text
internal/module/account/
├─ model / service / handler / repo / adapter
└─ binding/webui/
   ├─ binding.go                    Go 构建期声明
   └─ web/
      ├─ page / component / api
      ├─ locale / style / test
      └─ 只依赖 @webui/sdk/*
                         │
                         ▼
webui/src/sdk/            项目自有稳定接口
                         │
                         ▼
webui/src/platform/       Router/Shell/i18n/query/UI 等 SDK adapter
```

业务模块是页面 owner。`webui` 是 platform/SDK owner。普通模块接入不改变 platform；只有出现无法由现有 SDK 表达的宿主能力时，才单独扩展 SDK interface 和 adapter。

## 2. 为什么保留模块目录中的 WebUI

模块页面需要与本模块的 operation、错误码、locale、API DTO、数据状态和验收共同演进。把页面搬到 `webui/src/module` 虽然物理上分离前后端，却会形成第二个业务目录和两套 owner。

当前 `internal/module/<id>/binding/webui/web` 的所有权方向是正确的。问题在于：

- 宿主 public surface 仍直接暴露 Auth Session；
- 业务 selector 进入 `webui/src/styles.css`；
- 公共 UI 缺少稳定 SDK 分层，业务缺什么就向 core 加什么；
- 缺少“module-local adapter 还是 host SDK capability”的升级门禁。

048 修复这些契约和治理问题，不迁移业务页面 owner。

## 3. 目录与职责

```text
internal/
├─ composition/
│  └─ http_contracts.go             applicationWebUIModules 唯一汇总点
├─ module/<id>/
│  ├─ model / service / handler / repo / adapter
│  └─ binding/webui/
│     ├─ binding.go                 Entry/Route/Nav/Locale/SDK requirement
│     └─ web/
│        ├─ api/                    模块 API client 与 DTO
│        ├─ page/                   route page
│        ├─ component/              模块复合组件
│        ├─ locale/                 模块 namespace
│        ├─ style/                  CSS Modules
│        └─ test/                   模块页面与 contract test
└─ webui/
   └─ contract.go                   Go 构建期 Binding 与 runtime manifest

webui/src/
├─ sdk/
│  ├─ runtime/                      HostRuntime、RouteID、Access、Principal
│  ├─ http/                         request、取消、错误 envelope、凭据
│  ├─ i18n/                         模块翻译 hook
│  ├─ query/                        项目自有 query contract/hooks
│  ├─ navigation/                   route navigation，不暴露 Router
│  ├─ ui/                           project-owned primitives
│  └─ feedback/                     toast/dialog/drawer/overlay contract
├─ platform/
│  ├─ router / shell / identity
│  ├─ http / i18n / query
│  ├─ ui / feedback / theme
│  └─ styles.css                    仅 reset/token/platform
├─ generated/
│  └─ webui-registry.ts             只含校验后的 lazy Entry/Locale import
└─ App.tsx                          只装配 platform 与通用 manifest
```

实际实施不机械创建空目录。目录只在当前能力迁移时建立。

## 4. 依赖方向

```text
business web source -> @webui/sdk/* -> webui platform adapter
business web source -X-> webui/src/platform/*
business module A   -X-> business module B
webui platform      -X-> internal/module/*

internal/composition -> module WebUI Binding -> internal/webui Catalog
Catalog -> codegen registry + runtime manifest
```

例外只有 composition root：它显式列出当前应用包含的模块 Binding。composition 不读取模块页面内部、不创建业务组件。

## 5. Go WebUI Binding

### 5.1 应用注册与模块声明

```go
type ModuleRegistration struct {
    Binding    Binding
    Activation ActivationState
}

type ActivationState string

const (
    ActivationEnabled  ActivationState = "enabled"
    ActivationDisabled ActivationState = "disabled"
)

type Binding struct {
    ModuleID   string
    Entries    []Entry
    Routes     []Route
    Navigation []Navigation
    Locales    []Locale
    Requires   []SDKRequirement
}

type SDKRequirement struct {
    ID           string
    MajorVersion uint
}
```

`Binding` 仍由业务模块持有，`ModuleRegistration` 与 Activation 由应用 composition 持有。源码或 Binding 存在不代表启用；应用必须逐项写明 `enabled` 或 `disabled`，零值、未知值和配置缺失均失败，禁止自动扫描和默认启用。

构建先把 registration 投影成 deployable Catalog：未选择模块完全不存在，`disabled` 模块不进入 Entry/Locale registry 与 runtime manifest。Activation 改变静态 registry，必须重新生成、构建和部署，不承诺运行时热启用。

`DeliveryState` 与 Activation 不得混用。Activation 回答“应用是否发布该模块”，Delivery 回答“某 route 是否已经实现”。`not-implemented` route 只作为非交付声明，不得声明 Entry、默认路由、匿名默认路由或 Navigation；只有 `implemented` route 的可达 Entry/Locale 才能进入生成投影。

`Requires` 是构建期兼容声明，不是运行时 Service Locator。模块生产代码仍通过静态 `@webui/sdk/*` import 使用接口，不调用 `resolve("capability")`。

首阶段如果 SDK public export 与 TypeScript 类型检查已经能够提供同等 fail-fast 证据，可以暂缓把 `Requires` 写入 runtime manifest；但 Binding/生成检查必须存在唯一可复核的 capability inventory，不能靠文档约定。

### 5.2 SourcePath 边界

`SourcePath` 保留，因为页面由业务模块持有且 registry 需要生成静态 lazy import。它必须满足：

- 使用仓库相对路径；
- 解析后位于 `internal/module/<Binding.ModuleID>/binding/webui/web`；
- Entry 只接受 `.ts`/`.tsx`，Locale 只接受 `.json`；
- 禁止 symlink/reparse point 逃逸、绝对路径和 `..` 穿越；
- 只存在于构建期 Catalog，runtime manifest 永远剥离；
- 生成文件不可手工编辑。

因此需要删除的不是 SourcePath 本身，而是任何让 SourcePath 越过构建边界或让宿主按模块分支处理的逻辑。

### 5.3 唯一汇总点

```go
func applicationWebUIModules() []webui.ModuleRegistration {
    return []webui.ModuleRegistration{
        {Binding: authwebui.Binding(), Activation: webui.ActivationEnabled},
        {Binding: opswebui.Binding(), Activation: webui.ActivationEnabled},
    }
}
```

新增普通模块只在这里增加一项并显式决定 Activation，再在模块自己的 composition 中接上实际 API/operation。Catalog 的 route、menu、locale、entry 和权限引用全部从该列表派生，不在其他文件重复模块名。尚未形成有效 Binding 的模块保持未选择；`disabled` 不能作为绕过启用时完整校验的手段。

## 6. WebUI SDK 分层

### 6.1 `sdk/runtime`

公开：

- `HostRuntime`；
- 通用 `PrincipalView`、`Access`、`CapabilityState`；
- `useHostRuntime()`；
- `refreshManifest()`、`refreshPrincipal()` 等窄动作。

不公开：WebUISession、账号角色、CSRF 存储、Ops diagnostics、Router、Store 或全局 mutable context。

### 6.2 `sdk/http`

统一处理：

- `credentials`、Origin/CSRF adapter；
- AbortSignal 与 timeout；
- JSON/text response；
- 稳定 protocol error 与 correlation ID；
- 低敏错误，不泄漏 raw body/URL query。

模块 API client 再负责本模块 path、DTO、operation 和 error code -> message ID。

### 6.3 `sdk/i18n`

提供模块 namespace 翻译 hook。模块不能初始化或直接操作 i18n singleton。locale SourcePath 仍由模块 Binding 声明并生成 lazy loader；宿主启动只加载 host locale，模块 namespace 必须等 manifest 与 route 门禁通过后按需加载。

### 6.4 `sdk/query`

提供项目约束后的 query/mutation 使用面：取消、retry policy、invalidations、degraded/error state 和 route runtime gate。TanStack Query 具体 client 和 provider 留在 adapter，不让模块创建第二个 client。access 收回、availability 变为 unavailable 或 manifest generation/revision 改变时，SDK 取消在途请求并拒绝新的自动 query。

### 6.5 `sdk/ui` 与 `sdk/feedback`

只暴露无业务语义的 project-owned primitives，例如 Button、Field、Surface、DataTable、Dialog、Drawer、Toast 和通用状态容器。第三方 UI 类型不得穿透。

`AccountSummaryCard`、`AuditEventDetail`、`MetricsSnapshot`、系统配置表单等留在模块，不能因为样式相似就进入 SDK。

### 6.6 `sdk/navigation`

模块通过 RouteID/path params 的窄 API 导航，不获得 Router 实例、visited tabs、menu tree 或 Shell store。

## 7. SDK adapter 不是万能容器

SDK 采用静态 import 和 React provider/hook 的明确组合，不允许：

- `resolve(id)`、`get(type)` 或字符串 service lookup；
- 模块注册任意全局 callback；
- 模块获取 Router/QueryClient/i18n instance；
- adapter 根据 ModuleID 选择业务分支；
- 用一个巨型 `HostServices` 对象包含所有能力。

每个 SDK package 职责单一。没有使用方需求的接口不提前创建。

## 8. 新能力或新技术的判定流程

```text
模块提出需求
  -> 现有 SDK 已覆盖？
       -> 是：模块直接消费，webui core 零修改
       -> 否：是否只服务当前模块且不需宿主集成？
            -> 是：模块内定义窄 port + module-local adapter
            -> 否：进入 SDK capability 研究
                 -> 定义 project-owned interface
                 -> 在 webui platform 实现 adapter
                 -> contract/architecture test 通过
                 -> 模块声明并消费 capability
```

### 8.1 module-local adapter 示例

- Audit 模块独有的日志语法高亮库；
- System Settings 独有的 schema diff formatter；
- 单一报表页面独有的图表投影算法。

这些技术由模块封装，不能把第三方类型交给 SDK 或其他模块。

### 8.2 host-level SDK capability 示例

- 需要 Shell 持久显示的全局上传进度；
- 需要 Router blocker 的未保存表单离开确认；
- 需要统一凭据、重连和可见性治理的 SSE/WebSocket；
- 需要跨模块一致焦点、遮罩和层级管理的全局 overlay；
- 需要主题/无障碍联动的通用图表渲染 contract。

这些能力必须先形成通用 interface 和 adapter。adapter 不得知道最初提出需求的模块。

### 8.3 单独确认边界

新 SDK capability 会改变模块可用公共 API、依赖选择或宿主生命周期，属于实质设计变化。即使它由某个业务模块触发，也必须有独立任务 ID、研究证据和确认；模块 adoption 依赖 SDK task 完成。

## 9. Router、manifest 与 registry

### 9.1 构建期

```text
module Binding
  -> applicationWebUIModules 显式 registration/activation
  -> deployable Catalog validation/projection
  -> 只生成 enabled + implemented 可达的 lazy Entry/Locale registry
  -> React/Vite build
```

生成器只处理通用记录，不出现业务模块 import 的手写分支。新增模块后生成文件变化属于预期产物，生成器源码不变。

### 9.2 运行期

```text
GET /api/v1/webui/manifest
  -> enabled/implemented route + menu + access + availability + revision
  -> host 按 access/availability 执行加载前门禁
  -> 按需加载 locale
  -> registry[entryID] lazy load module page
  -> sdk/query 只启动当前允许的 capability
```

manifest 不包含 SourcePath、CSS、SDK adapter、原始 policy 或敏感 Session 数据。服务端 operation gate 仍是最终授权 authority。

### 9.3 失败语义

| 失败 | 处理 |
| --- | --- |
| Binding path 越过模块目录 | generate 失败 |
| 模块 import platform internal | lint/architecture 失败 |
| 模块请求未知 SDK capability | generate/typecheck 失败 |
| route/entry/locale 重复或缺失 | Catalog 失败 |
| revision mismatch | 宿主停止装配并显示低敏状态 |
| Activation 缺失或未知 | 构建失败；不得自动启用 |
| availability 缺失、超时或未知 | 归一为 unavailable，业务资源不加载 |
| 单模块 locale/lazy page 失败 | 隔离该 route/module，宿主与其他模块继续运行 |
| API/operation 不可用 | 取消/拒绝相关 query，服务端 fail closed |

### 9.4 五层状态与 authority

| 层 | Authority | 语义 | 不通过时 |
| --- | --- | --- | --- |
| Selection | application composition | 本次应用构建是否包含模块注册 | 不进入任何 WebUI 投影 |
| Activation | application profile/registration | 已注册模块是否发布 | 不进入 Catalog/registry/manifest |
| Delivery | module Binding | route 是否完成并可交付 | 不生成 Entry/Locale，不暴露 route/menu |
| Access | server operation decision | 当前主体能否查看 | 登录跳转或宿主 403，不加载业务资源 |
| Availability | server runtime snapshot | 当前依赖是否支持页面能力 | unavailable 时宿主短路；受支持 degraded 才加载 |

状态必须是有归属的专用类型。Activation 未指定、Availability 未知/缺失/超时一律 fail closed，不能由目录存在、HTTP 成功、页面 catch 或任意字符串推断。

### 9.5 加载判定与呈现矩阵

业务资源唯一允许条件为：

```text
selected
&& activation == enabled
&& delivery == implemented
&& access == allowed
&& availability in {available, supported-degraded}
```

| 最终状态 | 菜单 | 直接访问 | 业务 Entry/locale/query |
| --- | --- | --- | --- |
| 未选择 / disabled | 不出现 | 404 | 不生成、不加载 |
| not-implemented | 不出现 | 404 | 不生成、不加载 |
| authentication-required | 不展示受保护项 | 跳转登录 | 目标模块不加载 |
| denied | 不出现 | 宿主 403 | 不加载 |
| unavailable / unknown | 默认隐藏，或宿主通用 disabled item | 宿主通用不可用页 | 不加载 |
| degraded 且明确支持 | 带 degraded 标识 | 模块降级页 | 只加载允许资源与请求 |
| available | 正常 | 模块页面 | route 级 lazy load |

`degraded` 必须由模块声明支持，并由 availability snapshot 给出仍可用的 capability/operation 集合；没有声明时按 `unavailable`。宿主 disabled item 只能使用 host locale，不能为了显示状态提前加载模块 locale。

### 9.6 locale、query 与错误隔离

`initializeI18n()` 目标上只初始化 `webui.host`。manifest/revision 验证后，platform 从 eligible route/navigation 计算 namespace，按当前语言加载；进入 route 前保证其 namespace 就绪。切换语言仍只加载 eligible 集合，不全量遍历 registry。

route guard 必须先于 `React.lazy` component 解析、模块 locale 和页面 query。若模块 locale、Entry 或 render 失败，通用 boundary 只把对应 route 标为 unavailable，并保留 Shell、公共登录和其他模块。runtime revision mismatch 属于宿主级错误，仍停止全部业务装配。

`sdk/query` 以 route runtime snapshot 作为自动请求前置条件，并拥有 AbortSignal。状态失效时取消在途请求；degraded 页面只能请求 snapshot 明确允许的能力，不允许页面用无限 retry 假装恢复。

## 10. 身份与账号模块

完整账号与权限模块继续拥有：

- setup/login/logout/password/session API；
- 用户、角色、权限、安全策略和管理页面；
- 模块 DTO、错误码、locale 和 CSS。

宿主只需要通用 principal 和 access view。当前 `WebUISession`、`csrfToken`、Auth endpoint 等直接进入 `webui/src/contracts`/`App.tsx` 的部分需要收敛到 `sdk/runtime`/`sdk/http` 的通用接口与 platform adapter。宿主不理解角色、权限表或账号页面流程。

如果账号模块需要驱动 Shell 的当前主体与退出动作，先定义稳定 identity SDK contract；账号后端通过 composition 提供通用 principal/session adapter，账号 Web 页面只调用 SDK refresh/sign-out，不把业务 Session DTO 注入宿主。

## 11. Audit、Ops 与 System 模块示例

### 11.1 Audit

Audit 模块持有审计事件模型、查询/导出 API、筛选页、详情页、locale、样式和脱敏规则。若语法高亮只用于 Audit，封装在模块内部；若需要全局下载任务中心，先建设通用 download/task SDK。

### 11.2 Ops

Ops 模块持有 build、probe、diagnostics、metrics 页面和 query。`ops-*`、`diagnostic-*`、`metrics-*` 样式迁回模块 CSS Modules。宿主只提供 Surface、Table、Drawer、Toast 等 primitives。

### 11.3 System Settings 与 Maintenance Tools

System Settings 模块持有配置候选、校验、差异和应用结果页面。高风险维护动作按真实 owner 拆分，具有 operation、确认、Execution Record 和审计；不能建立万能“工具集”。

若需要全局离开确认，先建设 navigation blocker SDK；若只是模块内部表单校验，留在模块。

## 12. 样式与视觉

### platform 持有

- reset、design tokens、theme/density；
- Shell/layout/navigation/system state；
- SDK UI primitives 的内部样式。

### 模块持有

- 页面布局、业务卡片、表格列、筛选器、表单和业务状态视觉；
- CSS Modules；
- 本模块桌面/移动、明暗主题视觉证据。

模块不得向 document 注册业务全局 selector。平台不得通过模块名或 route ID 添加业务样式。

## 13. 单轨迁移

### Phase 0：冻结错误扩张

- 继续停止 047 未完成页面产品化；
- 不再向 global CSS、HostRuntime 或 UI primitives 添加业务专属字段；
- 保留当前 Auth/Ops 行为基线。

### Phase 1：建立 SDK public/private 边界

- 将 `@webui/contracts`、`@webui/ui` 收敛为分层 `@webui/sdk/*`；
- 增加 module -> SDK、module !-> platform、platform !-> module 架构门禁；
- 建立 capability 变更规则与 contract fixture。

### Phase 2：模块样式与 API 收口

- Auth/Ops 页面继续留在业务模块；
- 把业务 selector 从 `webui/src/styles.css` 迁到模块 CSS Modules；
- 页面只导入 SDK public surface；
- 模块 API/query/locale/error mapping 继续由模块持有。

### Phase 3：宿主去业务化

- HostRuntime 只保留 Principal、Access、Route 和通用刷新动作；
- Auth Session/CSRF 等通过 SDK adapter 收敛；
- Router/Shell/State Page 不出现具体 ModuleID 分支。

### Phase 4：Binding 与生成治理

- `applicationWebUIModules()` 成为唯一列表；
- 增加显式 ModuleRegistration/ActivationState 和 deployable Catalog 投影；
- `disabled` 与 `not-implemented` 不进入 Entry/Locale registry、manifest 和导航；
- 增加 SourcePath owner/path、SDK requirement 和 catalog 引用校验；
- generator 保持通用，仅生成 lazy Entry/Locale registry；
- runtime manifest 继续剥离 SourcePath。

### Phase 5：加载前门禁与错误隔离

- 建立通用 availability snapshot，未知状态 fail closed；
- Router 在 lazy import 前处理 access/availability；
- i18n 改为 host-first、eligible namespace 按需加载；
- query 随 route runtime state 启停并支持取消；
- 单模块 locale/Entry/page 故障不影响宿主和其他模块。

### Phase 6：普通模块零 core Diff 证明

- 架构 fixture 新增完整 Binding/Page/Locale/CSS/API mock contract；
- 只改 fixture 模块和 composition fixture，证明 `webui/` 零 Diff；
- Auth/Ops 真实流程证明 SDK 能承载生产模块。

### Phase 7：后续业务模块

完整 Account、Audit、System Settings/Tools 分别建立独立变更；如触发新 SDK capability，先走 SDK 研究与确认，再进入模块 adoption。

## 14. 文件影响预估

实施预计影响但本轮不修改：

- `webui/src/contracts/**`、`webui/src/ui/**` 向 `webui/src/sdk/**` 收敛；
- `webui/src/App.tsx`、`components/**`、`styles.css` 的业务耦合清理；
- Auth/Ops `binding/webui/web/**` 增加模块局部 style 并迁移 import；
- `internal/webui/**` 增强 Binding/SourcePath/SDK requirement 校验；
- `internal/composition/http_contracts.go` 收敛唯一 module registration/activation list；
- `internal/composition/webui_registry.go` 保持通用并增加 deployable projection、owner/capability 验证；
- `webui/src/i18n.ts` 改为 host-first 与 eligible namespace 按需加载；
- Router、SDK runtime/query 增加 access/availability 加载前门禁和取消；
- WebUI alias、lint、architecture tests、生成检查和 authority 文档。

不把模块页面迁到 `webui/src/module`，不删除构建期 SourcePath，不修改 Todo、数据库 schema、Kernel lifecycle、普通 API 业务语义或社区 Nuxt `frontend/`。

## 15. 验证设计

| 层级 | 门禁 |
| --- | --- |
| Go Contract | registration/activation、Binding owner/path、delivery、duplicate、SDK requirement、operation reference |
| Codegen | disabled/not-implemented 零输出；普通模块只改变 generated registry；SourcePath 不进入 runtime manifest |
| TypeScript | SDK public surface、模块 import、capability contract、typecheck |
| Architecture | platform 无模块 import/ID，模块只依赖 SDK，模块间零 import |
| Style | global CSS 无业务 selector，CSS Modules 不跨模块泄漏 |
| Runtime | manifest/revision/access/availability/lazy/locale/query 状态矩阵与错误隔离 |
| Security | Session/CSRF/Origin/CORS/operation gate 不回归 |
| E2E | setup/login/logout/session、403、Ops 真实 query |
| Visual | Auth/Ops 桌面/移动、明暗主题和模块状态 |
| Diff | 普通 module fixture 对 `webui/` 零 Diff；`git diff --check` |

## 16. 风险与控制

| 风险 | 控制 |
| --- | --- |
| SDK 演变为万能服务容器 | 静态分包接口、禁止 resolve/get 和巨型 HostServices |
| 每个模块需求都扩张 core | module-local/host-level 判定门禁，SDK 单独研究确认 |
| SourcePath 越权 | module owner 路径、扩展名、reparse point 与 runtime 剥离校验 |
| 业务 CSS 再进 global | CSS Modules + selector architecture scan |
| 第三方类型泄漏 | module-local adapter 或 SDK adapter，public contract 使用项目类型 |
| Auth 继续污染宿主 | generic Principal/Access/identity SDK，业务 Session DTO 留模块 |
| 生成器出现模块特判 | fixture 证明普通模块只改 Binding/生成结果，不改 generator |
| 未完成模块被自动发布 | composition 显式 Activation；not-implemented 不进入可加载投影 |
| locale 启动级联失败 | host-first、eligible namespace 加载和 route/module 级隔离 |
| degraded 变成无限重试 | 显式支持声明、允许 capability 集合、query gate 与取消 |

## 17. 重新确认触发器

- 新增或破坏性修改 SDK public interface；
- 引入 Router、query、UI、chart、editor、SSE/WebSocket 等新技术到 platform；
- 需要运行时 capability resolver、远程模块或动态安装；
- 需要改变 Session/CSRF/Origin、数据库 migration、API path 或 operation semantics；
- 新能力无法判断为 module-local 或 host-level；
- SourcePath 需要越过业务模块目录；
- Activation 需要改为运行时热启用或引入动态 registry；
- availability authority、状态集合或 degraded capability 语义改变；
- 业务模块需要直接访问另一个模块或 platform internal。
