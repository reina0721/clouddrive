# 047 Admin WebUI 产品化与模块化装配设计

## 1. 单轨架构

```text
模块拥有 WebUI 页面、locale 和 Binding
  -> internal/composition 显式选择 Binding
  -> internal/webui Catalog 校验与 revision
     -> runtime manifest（route/menu/access/交付状态）
     -> webui-gen（entry + locale registry/revision）
        -> WebUI Host（Shell/Router/i18n/feedback/state boundary）
           -> lazy module page
              -> 模块自身 HTTP/management capability
```

不增加自动扫描或运行时插件。Composition 仍是唯一知道应用选择和模块契约的位置；宿主只解释已校验的 manifest/registry，不知道 Auth、Ops 或未来模块的源码路径。

### 1.1 首次实施范围：布局与骨架

用户当前要求先重构 WebUI 布局和骨架。047 首次待确认实施范围因此固定为：

```text
宿主装配契约闭环
  -> Router / Shell / 导航 / 页面容器
  -> i18n / 主题 / 公共状态与反馈
  -> 桌面 / 移动、明暗主题视觉门禁
```

Auth/Ops 在首次范围内只做删除宿主硬编码、迁回模块 owner 和保持现有真实流程可运行所需的最小迁移，不在此阶段扩展业务功能或完成页面产品化。表格、表单、筛选、分页和 Drawer 等通用管理模式只通过组件测试或隔离 harness 建设，不注册生产 Demo 路由。Auth/Ops 的完整视觉产品化属于宿主本体门禁通过后的后续检查点，未来示例模块属于 047 之外的独立变更。

## 2. 契约语义收敛

当前 `Route.State = available/preview` 把交付成熟度和运行状态混为一体。实施时单轨替换为两个清晰维度：

- Binding/manifest 的交付状态只表达 `implemented / not-implemented`；它是构建期事实。
- 宿主公共 `CapabilityBoundary` 表达 `available / degraded / unavailable / not-implemented`；除 not-implemented 外，状态由真实 Query/operation 结果派生。
- `Access` 保持 `allowed / authentication-required / denied`，不参与 capability state 计算。
- loading、empty、stale、validation、submitting 是交互状态，不冒充 capability state。

不保留 `preview` alias 或兼容分支。042 尚未发布的旧契约在本仓库内完成调用方、测试、生成物和文档的单轨迁移。

每个页面通过宿主窄契约提交状态描述，例如“必要数据源”和“可选数据源”的查询结果；宿主负责统一视觉呈现，模块负责判断哪些真实能力属于必要或可选。宿主不理解业务响应内容。

## 3. Registry 驱动的路由和模块页面所有权

生成器同时输出：

- revision；
- `entryId -> lazy import`；
- `language -> namespace -> locale loader`；
- 仅供 TypeScript 校验的 Entry/namespace 联合类型。

宿主先验证 manifest revision 和所有 Entry 是否存在，再从 manifest routes 建立 React Router route objects。模块路由的 element 统一包裹权限、lazy loading、错误边界和 capability boundary。403、404、装配失败等宿主路由留在宿主自己的 builtin registry，不与模块 registry 混写；Theme Drawer 属于 Shell overlay，不占用业务或 builtin 页面路由。

Auth/Ops 的真实页面实现迁入各自 `binding/webui/web`。模块页面只允许依赖：

- React、HeroUI 和已确认的普通前端依赖；
- 宿主公开的 `@webui/contracts` 与 `@webui/ui`；
- 模块自身 API adapter、DTO 和 locale。

禁止导入 `App`、Router 实例、菜单实现、Session store、Shell 内部状态或其他模块页面。Auth 登录/设置成功后调用窄的 `refreshSession()`/`navigateByRouteID()` 类宿主能力，不直接写全局 Store；最终 API 名在实现时按测试驱动收敛，不扩大为万能上下文。

## 4. 浏览器 i18n 强制契约

采用 `i18next + react-i18next`，只在宿主 i18n adapter 初始化一个实例。这个单实例和下列规则是 WebUI 的规范契约，不是可选的编码风格：

- 业务模块必须在 WebUI Binding 中声明自己的 locale namespace 和资源文件；没有 locale Binding 的模块页面不得进入生产 registry。
- 生成 locale registry 提供模块 namespace 资源；宿主提供自己的 builtin namespace。默认 `zh-CN`，fallback 语言必须有实际资源，不能配置不存在的伪 fallback。
- `@webui/contracts` 只暴露窄的 `useWebUITranslation(namespace)`（以及必要的 message-ID 解析辅助）；模块页面只能使用该契约，不得自行初始化 i18next、直接操作宿主 singleton 或导入 `react-i18next` 内部实例。
- 所有用户可见文本都必须是 locale message，包括标签、按钮、帮助、状态、诊断、校验、空态、错误和操作反馈。技术标识符、CSS class、协议字段和测试断言不属于用户文案。
- 后端 error code 只映射到稳定的 message ID，不映射到中文或英文展示文本。例如：

  ```ts
  const setupErrorMessageIDs: Record<string, string> = {
    username_invalid: "webui.auth.errors.usernameInvalid",
  };
  ```

  页面随后通过 `t(setupErrorMessageIDs[reason] ?? "webui.auth.errors.unknown")` 得到当前语言文案；禁止保留直接返回中文文本的 `setupErrorMessages`。
- Host 自有的壳层文案也必须放入 host-owned locale resource，不以 `i18n.ts` 内联展示文本绕过同一契约。
- Header 语言入口只展示已装配且拥有 host resource 的语言；当前 `zh-CN` 与 `en-US` 由 host/module registry 共同装配。切换通过唯一 i18n instance 完成，未知语言在边界拒绝，不允许模块自行添加第二个选择器或 singleton。
- Contract/codegen 校验 locale 文件存在、语言/namespace 唯一、顶层为字符串 message map、SourcePath 在仓库内且 message ID 合法；运行期缺失 registry、namespace、语言或 key 必须 fail closed 或进入可诊断状态。
- 静态架构检查扫描生产模块 Web 源码，发现用户可见硬编码文本或直接 i18n singleton 依赖即失败；测试同时覆盖 error code -> message ID、locale completeness 和缺失资源边界。

message ID 按 owner 命名，不把后端 Translator 对象搬进浏览器；模块 locale 由模块拥有，宿主只负责统一加载、选择语言和呈现状态。

## 5. Shell 与公共产品模式

### 5.1 布局层

- `AuthLayout`：独立 blank layout，承载 setup/login；参考站点的“聚焦卡片 + 品牌/主题/语言 + 明确操作层级”，但使用项目品牌与真实入口。语言选择、明暗切换和主题 Drawer 由宿主复用同一 host i18n 与 `ThemePreferences`，认证模块只拥有表单和真实流程。
- `AppLayout`：高保真参考 SoybeanAdmin 的桌面侧栏、Header、面包屑、工作区页签、内容 Surface 与 Footer；移动端使用 Drawer/Sheet 导航，不把侧栏粗暴堆到页面顶部。宿主固定 Header、页签和 Footer，仅把中间页面视口交给滚动；移动侧栏打开时聚焦关闭入口并在侧栏内循环，关闭时恢复菜单入口焦点；窄视口的关闭侧栏通过 `aria-hidden`/`inert` 隔离，桌面侧栏不受影响。
- `WorkspaceTabs`：由宿主根据稳定 route ID 管理已访问页面、激活、关闭、刷新和不可关闭默认页；不允许模块直接写页签状态。页签行使用 `tablist`/`tab`/`tabpanel` 关联，激活页签是唯一进入普通 Tab 顺序的项，方向键与 `Home`/`End` 在页签间循环移动焦点并同步导航；只实现页面切换所需语义，不复制参考站的页面缓存技术实现。
- `RouteSearch`：只搜索当前 manifest 中可访问的 route/menu，并通过 route ID 导航；不扫描模块源码，不成为第二套路由注册。打开时聚焦输入框、Tab 在弹层内循环，关闭时恢复触发入口焦点；结果使用 `combobox/listbox/option` 语义，搜索文案随宿主语言变化重新计算。
- Header 统一承载折叠、route search、全屏、语言、主题和用户入口；用户入口的退出操作由宿主使用受控 `ConfirmDialog` 确认，失败只呈现宿主 i18n 的低敏 `Toast`，不暴露原始异常；主题配置 Drawer 的四个宿主分区使用 `tablist`/`tab`/`tabpanel` 关联，激活分区是唯一普通 Tab 入口，方向键与 `Home`/`End` 循环切换；业务页面自己的筛选、刷新、新增等操作留在 PageHeader/Toolbar。

### 5.2 设计系统

HeroUI 作为可访问交互原语，宿主在其上定义项目 Token 和语义组件；不把第三方 API 原样暴露给每个模块。Token 至少覆盖色彩、Surface、文字层级、间距、圆角、边框、阴影、动效、密度和状态色。

公共模式分为：

- feedback：Toast、Inline Alert、Error Boundary、Confirm Dialog；
- data state：Skeleton、Empty、Error、Stale、Capability Badge；
- input：Form Field、validation summary、submit state；
- data：Toolbar、Filter、Table、Pagination、Drawer/Detail；
- navigation：Menu item、breadcrumb/location、mobile drawer、user actions。

表格/表单组件用 unit harness 或测试 fixture 验证，但 fixture 不进入生产导航、manifest 或构建期模块 Catalog，不声明业务能力，也不形成 Demo 页面。

当前公共 UI 已提供 `DataToolbar`、`FilterPanel`、`DataTable`、`Pagination`、`EmptyState`、`InlineAlert`、`Toast`、`ConfirmDialog` 和 `Drawer`。这些组件只接受调用方传入的 locale 文案、行数据、单元格和状态回调；不持有业务查询、权限或路由状态。`DataToolbar` 的 toolbar label 由模块注入当前语言文案，`FilterPanel` 暴露 toggle/region 关联语义，`DataTable` 暴露模块注入的表格 label、列显隐、加载状态、列 scope 和批量选择 mixed 状态，`Pagination` 暴露模块注入的分页 label，`CapabilityBanner` 以 `role=status`/`aria-live=polite` 表达四态变化，`Toast` 只负责受控的短时反馈，`ConfirmDialog` 负责受控确认、焦点进入/恢复、Tab 循环、Escape 取消和关闭态 `inert`，公共 `Drawer` 统一负责遮罩、焦点进入/恢复、Tab 循环、Escape 关闭和关闭态 `inert` 隔离。模块仍通过自身 Binding 与 Composition 接入，不能把公共组件测试 fixture 当作生产页面。

## 6. 现有真实模块页面演进

本节的完整页面产品化只有在 1.1 的宿主本体门禁通过后开始。首次布局与骨架范围只做保持真实流程可运行所需的适配，Auth/Ops 不能反向决定 Shell、Router、Menu、i18n 或公共状态组件的内部结构。

### 6.1 Auth

- Setup/Login 使用 AuthLayout，保留当前真实 API、密码约束和错误 code 翻译；补齐 pending、失败、成功跳转、键盘和小屏状态。
- Session 页面使用 AppLayout，分组呈现主体、scope、创建/空闲/绝对过期；注销保持 CSRF 与服务端撤销语义。
- Session 页面按“状态 Banner → 摘要卡 → 生命周期/权限 Surface”组织真实会话信息；不把用户中心、密码修改或权限编辑等未存在的后端能力伪装成可用操作。
- Session Binding 声明 `auth.webui.session` 查看 operation 和 `auth.session` 导航；Composition 将该 operation 绑定到现有 `management:read` scope。这样页面访问沿既有服务端 operation gate fail closed，前端 manifest 只呈现授权结果，不自行判断权限。
- 不增加忘记密码、验证码、注册或多账号切换，因为当前后端没有这些能力。

### 6.2 Ops

- 顶部提供运行摘要和最近刷新信息；build、startup、liveness、readiness 形成概览卡片。
- diagnostics 与 metrics 分区呈现，原始数据只作为可展开的诊断详情，不作为默认主界面。
- 六个查询独立结算：核心探针失败为 unavailable；可选 diagnostics/metrics 失败为 degraded；成功数据继续显示。
- 刷新与重试使用 TanStack Query，取消、错误和过期语义保持可诊断。
- 能力清单页由 Ops Binding 按需贡献，复用六个查询作为真实行数据，提供搜索、核心/可选筛选、状态列、结果摘要、单项重试和分页；不引入用户管理示例数据或新的后端 wire contract。
- 能力清单的“查看详情”使用公共 `Drawer` 承载完整查询结果；Drawer 只接收模块当前行的真实快照，关闭、焦点和遮罩由公共层处理，失败行仍保留模块注入的重试动作。
- Dashboard 概览层按“真实构建 → 运行快照 → 依赖健康 → 原始诊断详情”组织信息；Build 与 Diagnostics 只读取已有 management 响应字段，缺失字段显示 Unavailable，不补造天气、待办、活动或示例统计。
- Metrics 概览复用已有 `/management/metrics` 文本响应，只投影稳定的 HTTP 请求、in-flight、导出 Span 和丢弃 Span 指标；没有历史样本时不绘制趋势图，原始 Prometheus 文本仍保留在诊断详情。

### 6.3 宿主页面

- 当前独立 Appearance 页面单轨替换为宿主 Theme Drawer，承载主题模式、预设、布局/通用设置、重置和持久化；布局偏好由 `ThemePreferences.layout` 持有，减少动效由 `ThemePreferences.reduceMotion` 映射到宿主 `data-motion`；Drawer 打开时聚焦关闭入口、Tab 在内部循环、关闭时恢复触发入口焦点，关闭状态通过 `aria-hidden`/`inert` 隔离；导入或解析错误必须可见，不再静默吞掉，也不保留两个主题 authority。
- 403、404、route error、revision mismatch、manifest/entry/locale failure 使用统一 State Page；模块 lazy 加载与渲染由宿主 `RouteErrorBoundary` 收敛到 route error 状态。
- Not Implemented 使用统一页面骨架，明确缺失后端能力、目标流程和禁用原因。

## 7. 视觉观察与验收循环

每个公共模块、重要交互和真实页面任务固定执行；上一个任务的截图与本计划中的分析不能替代下一任务的重新观察：

```text
选择本阶段页面/交互
  -> 浏览器观察 SoybeanAdmin 对应场景（DOM + 截图 + 交互反馈）
  -> 记录信息层级、间距、密度、状态、响应式模式
  -> 实现本项目页面
  -> 本地桌面/移动、明暗主题截图与交互检查
  -> 差异矩阵：采纳 / 不采纳 / 项目化理由
  -> 自动化回归
```

本轮研究已实测 SoybeanAdmin 的工作台 Shell、用户列表/筛选、创建表单 Drawer、403 状态页和主题 Drawer，确认其成熟度来自布局、导航、容器、操作层级、状态反馈和一致性，而不是示例菜单数量。官方文档同时把精简核心框架与 example 分支分开；047 不复制演示页面。

视觉证据放在 047 的 `evidence/visual/`，使用语义文件名和 Markdown 矩阵；截图不得包含 Token、Cookie、Authorization、真实用户名或内部地址。参考站点更新或目标页面无法访问时如实记录，不以官方目录或旧截图伪装实时观察。

## 8. 文件影响

预计影响：

- `internal/webui/**`：交付状态语义、校验和测试；
- `internal/composition/webui_registry.go` 与相关测试：Entry/locale 生成；
- `webui/src/**`：Host contracts、Shell、i18n、UI patterns、builtin pages、route assembly、测试与样式；
- `webui/package.json`/lock：i18next/react-i18next 依赖；
- Auth/Ops `binding/webui/web/**`：首次只做模块 owner 与宿主公共契约适配，后续再产品化真实页面；
- `docs/development/webui.md` 与模块开发指南：当前接入流程；
- 047 任务证据与视觉矩阵。

其中 i18n 调整还会影响宿主 locale resource、`@webui/contracts` 翻译 hook、Auth/Ops 模块 locale JSON、error code -> message ID 映射和硬编码文案架构测试。

不修改 Todo 实现、数据库 migration、后端 Session wire、普通 API Auth 或 Kernel lifecycle；本轮只为已有 Session 页面补齐其 WebUI 查看 operation 的装配，不新增认证数据或管理 API。

## 9. 实施与重新确认边界

首次实施确认只覆盖布局与骨架检查点 A–C，并在其内部按装配、Shell、公共模式与宿主视觉门禁分检查点提交。Auth/Ops 完整页面产品化属于宿主门禁后的后续增量，不能随首次确认自动启动。出现以下事实必须返回研究并重新确认：

- 需要修改普通 API/management wire contract、Auth policy 或 Session/CSRF/Origin；
- 需要新增业务模块、后台写操作、数据库迁移或后端能力；
- 需要动态插件、远程模块、第二个 Router/Store/i18n 实例；
- 需要替换 React/HeroUI 技术栈或引入新的全局状态框架；
- 需要把 i18n 从“已接入实现”提升为新的公共强制契约，改变 Binding、前端公开 API、locale 资源所有权或静态门禁；
- 视觉目标要求复制参考项目品牌/源码或改变既有模块边界。
