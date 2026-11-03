# 047 Admin WebUI 产品化与模块化装配需求

## 目标

在不改变当前 Module、Binding、Composition、权限、i18n owner 和生命周期原则的前提下，先把现有 WebUI 基础原型演进为完整、成熟、可操作、可持续扩展的后台宿主，再让真实模块沿稳定契约渐进接入。界面可以先于部分后端能力出现，但必须如实表达状态，不得以 Demo 或假业务数据替代真实能力。

## 功能要求

| ID | 要求 |
| --- | --- |
| REQ-001 | 生成的 Entry registry 与 runtime manifest 必须成为模块页面路由和延迟加载的唯一来源；宿主不得直接 import 或手写 Auth/Ops 模块路由。 |
| REQ-002 | 模块真实页面实现必须由模块自己的 `binding/webui/web` 拥有；宿主只提供稳定、窄的页面运行契约，不暴露 Router、Menu、Store 或布局内部对象。 |
| REQ-003 | 新增有后台需求的模块只需实现页面、声明 WebUI Binding 并在 `internal/composition` 显式装配；不得修改宿主核心菜单、集中模块路由表或其他业务模块。 |
| REQ-004 | Todo 和没有真实管理用例的模块继续不提供 WebUI Binding，不创建空目录、空页面或虚假菜单。 |
| REQ-005 | Binding、manifest、registry 和宿主必须保持稳定 ID、引用、operation、revision 与 fail-closed 校验；`SourcePath` 不得进入浏览器 manifest。 |
| REQ-006 | 权限继续引用项目 Auth authority 登记的 operation ID，菜单过滤和 403 只用于呈现；服务端 operation gate 继续是最终授权 authority。 |
| REQ-006A | 需要认证的 WebUI 页面必须由模块 Binding 声明自己的查看 operation，并由 Composition 装配到现有 Auth policy；未认证主体不得因为缺少 operation 声明而获得页面访问。 |
| REQ-007 | WebUI i18n 是强制规范契约，不是约定或可选最佳实践。浏览器只允许一个由宿主初始化的 i18n 实例；业务模块只允许通过自身 Binding 声明一个或多个 locale namespace，由 Composition/codegen 聚合，宿主负责语言选择、fallback、加载失败和缺失资源状态。没有 locale Binding 的 WebUI 业务模块不得进入生产 registry。 |
| REQ-008 | 菜单、页面标题、公共动作、字段、帮助文本、状态文案、诊断标题、校验提示和错误提示等所有用户可见文本必须来自 locale message。模块页面必须使用宿主公开的 `useWebUITranslation(namespace)` 或等价的窄翻译契约，不得直接初始化/操作 i18n singleton，不得直接依赖 `react-i18next` 的内部实例，也不得在生产模块 Web 源码中写入用户可见硬编码文案。 |
| REQ-008A | 后端 error code 与 locale message ID 必须分离。模块只能声明 `errorCode -> messageID` 映射，再由 i18n 契约翻译 message ID；`setupErrorMessages` 这类直接返回中文/英文文本的映射违反契约。locale namespace、message ID、语言和资源文件由模块拥有并由 Contract/codegen 校验，缺失 key、namespace 或语言时必须 fail closed 或呈现明确诊断状态。 |
| REQ-009 | 页面统一表达 `Available / Degraded / Unavailable / Not Implemented`；权限状态、加载状态和能力状态不得混为同一语义。 |
| REQ-010 | `Not Implemented` 页面不得调用不存在的 API、模拟写入成功或使用假业务数据；应明确目标流程、缺失能力和当前可执行动作。 |
| REQ-011 | `Degraded` 必须保留仍可用的真实内容并标出失败区块；`Unavailable` 必须禁用受影响操作并提供低敏诊断与重试。 |
| REQ-012 | 宿主建立统一的 Shell：响应式侧栏/移动导航、Header、面包屑、工作区页签、manifest route 搜索、页面标题、全屏、用户入口、主题/语言、通知、Footer、错误边界、403/404/装配失败；这些均由宿主拥有，不由业务模块注册内部对象。 |
| REQ-013 | 建立集中设计 Token 和公共后台模式：Surface/Card、Button、Form Field、Status、Skeleton、Empty/Error、Dialog/Drawer、Table、Filter、Pagination；模块不得各自复制一套视觉基础。 |
| REQ-014 | 表格和表单模式必须覆盖 loading、empty、error、disabled、validation、submit pending/success/failure、keyboard focus 和移动端溢出；fixture 只能进入组件测试或隔离 harness，不得形成生产 Demo 页面、导航或虚假模块。 |
| REQ-015 | 首次宿主阶段只把 Auth/Ops 页面迁回模块 owner 并完成新骨架所需最小适配；只有宿主本体里程碑通过后才进行页面产品化。全程继续调用真实 API，不改变既有 Session、CSRF、Origin 和 management 语义。 |
| REQ-016 | Ops dashboard 必须把 build、probe、diagnostics、metrics 分层呈现；单个可选数据源失败时表现为 degraded，而不是抹掉全部成功数据。 |
| REQ-017 | 主题使用全局 Drawer 承载，支持 system/light/dark、现有预设、布局相关开关、键盘可达性、重置和持久化；认证数据不得进入主题存储，不保留第二个独立主题入口。 |
| REQ-018 | 每进入一个新的公共模块、页面或重要交互，必须重新观察对应 SoybeanAdmin 场景，再保存同视口对照矩阵与本项目截图；布局比例、密度、层级、交互反馈和响应式行为以高保真参考为验收目标。计划阶段证据不是后续实现的固定视觉规格；不复制品牌、数据、源码、Demo 或 Vue 架构。 |
| REQ-019 | 宿主本体里程碑先覆盖桌面与移动断点、明暗主题、Shell、导航、页面容器、主题、四态、403/404 和 revision mismatch；真实模块里程碑再覆盖 Auth 与 Ops，不得用模块页面反向掩盖宿主缺口。 |
| REQ-020 | 新增架构测试、Contract/codegen clean check、React unit、E2E 与视觉门禁，证明宿主无模块硬编码、模块无宿主内部穿透、生产路由无 Demo、页面状态不伪造能力。 |
| REQ-021 | 实施必须按“宿主装配契约 -> Shell/导航/页面承载 -> 公共交互与状态 -> 宿主视觉一致性 -> 真实模块接入”推进；宿主本体门禁未通过时不得开始模块页面产品化。 |
| REQ-022 | 建立 SoybeanAdmin 宿主本体功能/视觉 parity 矩阵；每个条目标记“高保真实现 / 因项目边界项目化替代 / 不适用”，不允许用“风格类似”代替可复核结果。 |

## 非目标

- 不新增 Todo WebUI、用户/角色/菜单 CRUD、审核运营页、组件展示页、框架 Demo 或其他缺少真实业务用例的页面。
- 不新增动态插件、Module Federation、远程脚本、运行时目录扫描或第二套前端模块容器。
- 不替换现有 Auth policy、Session、CSRF、Origin、Application Generation、HTTP/management listener 或后端 i18n。
- 不复制 SoybeanAdmin 源码、业务路由、业务数据、Logo、插画、品牌文案或 example/Demo 菜单，也不迁移到 Vue/NaiveUI/UnoCSS；宿主本体的布局、交互和视觉高保真参考不受此条排除。
- 不在本变更实现部署、反向代理、MFA、多管理员治理、历史指标存储或新的底层业务能力。

## 首次布局与骨架验收标准

- 宿主本体先独立通过 Shell、导航、页面容器、主题、i18n、四态、异常页和公共交互验收；此门禁通过前 Auth/Ops 产品化任务保持未开始。
- 删除宿主对 Auth/Ops 页面和模块路径的直接 import/集中 Route；新增测试模块 fixture 时只改测试 Binding 与 Composition 测试输入即可进入生成 registry，fixture 不进入生产 manifest。
- Auth/Ops 页面由模块源码加载并保持现有真实流程可运行，Todo 不出现在 Binding、manifest、registry、菜单或路由中；本阶段不要求完成 Auth/Ops 页面产品化。
- locale registry 与单一 i18n 实例生效；每个贡献 WebUI 的业务模块均声明 locale Binding，模块页面只通过公开翻译契约取文案；生产模块 Web 源码不存在用户可见硬编码文案；错误码映射只返回 message ID；缺失 namespace、语言或 key 明确 fail closed 或呈现诊断状态。
- Auth/Ops 页面中的所有用户可见文案（包括 setup 错误、表单校验、按钮、状态和诊断文本）均可由模块 locale 资源覆盖；`setupErrorMessages` 不再返回展示文本。
- 四态公共边界具有组件和宿主测试覆盖，not-implemented 不发不存在请求。
- 生产导航、路由和构建产物不包含为了展示框架能力而建立的 Demo；表格/表单等公共模式由组件测试和隔离 harness 验证。
- 页面通过 lint、typecheck、unit、build、codegen clean check、Go 定向/全量测试、E2E、桌面/移动及明暗主题视觉对照。
- 视觉证据记录参考页面、观察日期、视口、状态、本项目截图、差异和接受理由；不得只写“类似 SoybeanAdmin”。
- 宿主 parity 矩阵覆盖侧栏、Header、面包屑、页签、route search、主题 Drawer、内容 Surface、Footer、异常页、响应式与明暗主题；未达到的差异必须修正或记录项目边界理由。
- 当前宿主主题文档与实现同步，未执行的真实 HTTPS/部署或浏览器组合不得宣称通过。

## 宿主门禁后的整体验收标准

- Auth setup/login/session 和 Ops dashboard 在各自模块边界内完成页面产品化，不改变现有真实 API、Session、CSRF、Origin 或 management 语义。
- Ops 局部失败呈现 degraded，必要失败呈现 unavailable，成功数据不被失败区块抹掉。
- Auth/Ops 每个页面重新观察参考站并完成桌面/移动、明暗主题、关键交互和权限状态的独立视觉/E2E 门禁。
- 当前 WebUI authority 与模块开发指南同步完整接入流程；后续示例模块仍需独立研究与确认。
