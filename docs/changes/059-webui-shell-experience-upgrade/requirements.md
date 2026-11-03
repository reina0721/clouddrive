# 059 需求规格

## 1. 产品目标

把当前可用但仍显临时的 Admin WebUI 收敛为完整、稳定、克制且可持续扩展的后台宿主。用户在 desktop、tablet 和 mobile 中应获得一致的信息层级、清晰的当前导航、可感知但不干扰的状态变化，以及不会在内容到达时明显跳动的 loading experience。

## 2. 需求

| ID | 需求 |
| --- | --- |
| `REQ-059-001` | 必须保留 generated registry、Manifest route/menu/access、module-owned page、HostRuntime、i18n、Session/CSRF 和 `@webui/sdk/*` 现有边界，不建立第二套路由、菜单、权限或业务页面注册。 |
| `REQ-059-002` | App Shell 必须把 Sidebar、Header、WorkspaceTabs、AccountMenu、mobile backdrop 和内容容器拆成职责明确的宿主组件；状态仍由宿主显式拥有，不引入万能 Context 或第三方全局 store。 |
| `REQ-059-003` | desktop sidebar 展开/收起、内容位移和品牌/菜单标签必须使用同一尺寸 token 和同一 layout motion timeline；mobile drawer 必须使用自身尺寸驱动的 transform，不得保留 `-1000px` 魔法值。 |
| `REQ-059-004` | Sidebar 必须支持递归菜单、当前 route/ancestor 层级、子菜单可感知展开动画、collapsed label 提示、键盘焦点与移动关闭；不得按 ModuleID 猜测不存在的业务分组。 |
| `REQ-059-005` | Header 必须按 desktop/tablet/mobile 明确搜索、breadcrumb、主题、语言、全屏和账号操作的优先级；不存在的通知、消息或业务快捷入口不得以占位形式出现。 |
| `REQ-059-006` | RouteSearch、AccountMenu、Theme Drawer、公共 Drawer、ConfirmDialog、Toast、mobile sidebar 和 submenu 必须拥有一致的 entering/open/exiting/closed 状态、Escape/click-outside/focus return 语义；关闭态不得进入键盘路径。 |
| `REQ-059-007` | 必须建立 quick、standard、layout 三档 motion duration 和统一 easing；动效优先使用 transform/opacity，只在必要的 submenu/layout 尺寸协调中改变几何，不使用持续装饰动画冒充细节。 |
| `REQ-059-008` | 最终 reduced-motion 决策必须同时尊重显式主题偏好与操作系统 `prefers-reduced-motion: reduce`；减少动效时状态仍必须可理解，不能依赖动画表达唯一含义。 |
| `REQ-059-009` | manifest boot、route locale/lazy entry、卡片/表格数据必须使用与目标几何相近的 Shell/Page/Data skeleton；skeleton 必须有低敏可访问 label，不能伪造业务值或历史趋势。 |
| `REQ-059-010` | design token 必须覆盖 surface、border、radius、shadow、spacing、typography、layout size、z-index 和 motion；light/dark/preset 只覆盖语义 token，不让业务模块复制宿主颜色。 |
| `REQ-059-011` | 平台 CSS 仍由声明的 `webui/src/styles.css` authority 持有，但必须格式化并按 token/reset/Shell/overlay/public UI/responsive/motion-reduction 分区，允许逐规则审阅。 |
| `REQ-059-012` | 公共 Button、Surface、Field、Skeleton、Toast、Dialog、Drawer、DataTable、Pagination 和 Shell 自有组件必须消费同一 token 与 motion 语义；现有模块调用方单轨迁移，不保留新旧两套外观。 |
| `REQ-059-013` | 不引入 Tailwind CSS、Framer Motion、第二套 UI library 或新全局状态；实施前再次确认 `@heroui/react` 零消费者后，从 package.json 与 lockfile 单轨删除。 |
| `REQ-059-014` | 所有新增/修改用户文案必须来自 `webui.host` locale；源码注释、测试场景和维护说明以中文为主。 |
| `REQ-059-015` | 视觉验收必须覆盖 1440×1000、1024×768、390×844 的 light/dark，至少包含 sidebar expanded/collapsed、mobile drawer、search、account menu、theme drawer、Shell/Page/Data skeleton、Auth、Ops Dashboard、IAM 表格/表单、Organization 与 Navigation 页面；截图必须人工复核。 |
| `REQ-059-016` | keyboard、focus、inert、scroll lock、ARIA、route access、logout confirm 和现有 module flows 必须不回归；参考站观察到的无标签菜单或背景滚动行为不得复制。 |
| `REQ-059-017` | 业务模块或插件必须拥有自己的 Page、业务状态、API adapter、locale、模块 CSS 与 WebUI `Binding`；页面体验调整只能在该 owner 内完成，根 `webui/` 不得建立同名、代理或兜底业务页面。 |
| `REQ-059-018` | WebUI Host 只拥有 generated registry 装载、Router、Shell、主题、全局 overlay、凭据、共享 query client 和 SDK adapter，不得按 ModuleID 分支、导入模块源码、解释业务 DTO 或直接调用模块私有 API。generated registry 是构建生成的唯一模块 import 汇合点。 |
| `REQ-059-019` | 模块与宿主之间只通过项目自有、按能力分包且具有主版本的 `@webui/sdk/*` 契约通信；模块静态 import SDK，不允许运行时 service locator、万能 HostServices、宿主内部类型或第三方 UI/Router/HTTP client 类型穿透边界。 |
| `REQ-059-020` | 普通模块的接入或移除必须通过 `Binding`、composition 和通用 generator 完成；现有 SDK 足以表达时，宿主核心和 generator source 应保持零修改。架构测试必须证明禁用模块后其 entry、route、menu 和 locale 不进入生成产物或 Manifest。 |
| `REQ-059-021` | 本任务的“可插拔”明确为源码/构建期静态装配，不承诺浏览器运行时安装、卸载或下载远程 bundle。若需要 remote plugin runtime，必须另立研究评估签名、版本协商、CSP、隔离、权限、资源生命周期与独立发布。 |
| `REQ-059-022` | 构建期 registry 必须继续生成静态 lazy import，使 Vite 能按页面拆分 chunk；route access/availability 与 locale 门禁必须发生在模块资源加载前。验收必须记录 production build chunk graph 和冷启动/首次路由网络证据，证明未访问或已禁用模块不会被宿主首屏 eager load。 |

## 3. 非目标

- 不迁移到 Vue，不复制 TailAdmin 源码、品牌、Pro 页面、Figma/图片/Logo 或演示数据。
- 不新增 Dashboard 收入、订单、客户、趋势图、通知、消息、聊天、日历等不存在的业务能力。
- 不修改 Go Manifest/WebUI Binding、API、数据库、IAM/Organization/Navigation/Ops 业务语义或权限模型。
- 不把业务页面移回根 `webui/`，不为视觉重构穿透 module CSS owner。
- 不改变现有模块的 API、字段、权限、状态机或业务操作；页面调整只使用真实数据和现有契约。
- 不实现运行时远程插件市场、Module Federation、动态脚本下载、热安装/卸载或独立前端发布单元。
- 不实施 production static hosting、Docker/release 打包或外部部署。

## 4. 验收标准

1. 所有 Shell/overlay/loading 状态有可重复的组件测试和浏览器行为证据。
2. sidebar 与 workspace 在 desktop 切换中没有瞬时 grid jump；mobile 打开后背景不可滚动且焦点被正确约束，关闭后恢复。
3. 系统 reduced-motion 和显式减少动效都能把动画降到近零，同时保留可见状态变化。
4. route loading 不再只显示跳点；table/card loading 不再引起明显几何塌陷。
5. 当前业务模块、menu projection、route access、logout、主题、语言与 E2E 继续通过；根 `webui/src` 中没有业务页面副本、ModuleID 特判或对模块源码的手写 import。
6. fixture 模块或现有模块装配测试证明普通模块只需声明自身 facet 与 composition registration；generated registry 的机械变化不视为宿主核心修改。
7. production build 与浏览器网络记录证明业务页面保持独立 async chunk；首屏不下载未访问模块页面/locale，禁用模块不进入构建 registry。
8. `pnpm generate:check`、`pnpm lint`、`pnpm lint:modules`、`pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm e2e -- --workers=1`、文档门禁和 `git diff --check` 均通过；视觉截图已人工检查。
