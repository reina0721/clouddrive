# R001 当前 WebUI 产品化与参考样本差距

## 1. 研究问题与方法

本研究回答三件事：当前 WebUI 哪些能力已真实存在；哪些地方仍与用户要求的模块化后台宿主冲突；如何把视觉参考转化为可重复的产品验收，而不是一次性仿制页面。

内部证据从根 README、042–046、`internal/webui`、Auth/Ops Binding、`internal/composition`、生成 registry、React 宿主、页面与样式逐层追踪。外部证据包括对 `https://soybeanjs.cn` 的浏览器 DOM 与截图观察，以及 SoybeanAdmin 官方文档和官方仓库。没有启动本地服务、修改运行状态或把目标设计写成已实现能力。

当前 Git 事实：`HEAD` 为 `72e99de`，当前分支相对本地 `origin/main` ahead 8。接续本轮复核时，工作树已经包含未提交的 047 草案与 `docs/changes/README.md` 修改，均按用户既有工作保护。本任务没有 fetch、push、暂存或提交。

## 2. 已实现事实

### 2.1 契约、Composition 与权限方向已经成立

- `internal/webui.Binding` 已声明模块、Entry、Route、Navigation 与 Locale；`BuildCatalog` 校验重复 ID/path、引用、导航环和语言标签，并计算稳定 revision。
- `applicationWebUICatalog()` 在 `internal/composition` 显式聚合 Auth 与 Ops Binding，并用已有 HTTP/management operation inventory 校验权限引用。
- runtime manifest 剥离 `SourcePath`，按当前 Principal 通过已有 Auth authorizer 计算 `allowed / authentication-required / denied`；页面可见性没有取代服务端 operation gate。
- Auth 与 Ops 按需提供 Binding；Todo 不提供 WebUI Binding。这已经证明 WebUI 不是所有模块的强制契约。
- Auth Session、CSRF、Origin、本地 HTTPS、首次设置、登录、会话与离线密码重置已有 042–046 的实现和测试证据；本任务不重建这些能力。

**结论：** 用户要求的依赖方向已经有正确骨架，应闭合而不是替换：模块拥有声明与页面，Composition 选择并装配，宿主加载和呈现。

### 2.2 当前宿主尚未真正由模块声明驱动

- `GenerateWebUIRegistry()` 已生成 Entry ID 到动态 import 的映射，`webui/src/generated/webui-registry.ts` 也包含 Auth/Ops 页面入口。
- 但 `webui/src/App.tsx` 只读取 `webuiRevision`，没有使用 `webuiEntryRegistry`；它仍直接 import Auth/Ops 页面并手写全部 `<Route>`。
- Auth/Ops 模块目录下的 TSX 文件只是反向 re-export `webui/src/pages/*`，真实页面实现仍集中在宿主目录。
- 菜单来自 manifest，但 active 判定写死为 dashboard；宿主自身页面、模块页面、权限跳转和 route fallback 还没有统一路由模型。

**推断：** 新模块目前仍需修改宿主 import 和集中路由表，尚未达到“实现页面 -> 声明 Binding -> Composition 装配”的目标。第一实施优先级应是让 registry 和 manifest 成为宿主唯一模块页面来源，并把真实页面实现迁回模块 owner。

### 2.3 i18n 声明存在，浏览器运行链缺失

- Auth/Ops Binding 已声明 `zh-CN` JSON locale 和 namespace。
- 当前生成器只输出 Entry registry 与 revision，没有输出 locale registry；宿主没有浏览器 i18n 实例。
- 菜单把 `titleMessageId` 原样显示，页面大量直接写死中文。
- 后端 `pkg/i18n` 属于 Go 请求呈现边界，不能被浏览器直接复用；可复用的是“模块拥有资源、Composition 聚合、宿主单实例”的治理机制。

**外部主源：** `react-i18next` 官方方案以单一 i18next 实例接入 React，`useTranslation` 支持 namespace 与语言切换，适合承载构建期生成的模块 locale；这比项目自研翻译引擎更符合成熟技术优先原则。

### 2.4 能力状态语义不足

- 当前 Contract 只有 `available / preview`，注释把它解释成页面是否接入真实操作。
- `available` 是静态 Binding 值，不能证明运行期依赖当前可用；`preview` 又同时承担“页面先行”和“能力未完成”，语义不够明确。
- Ops 页面把六个查询合并成全屏 loading 或首个 error；一个可选指标失败就会掩盖其他真实数据，无法表达 degraded。
- 权限状态与能力状态是不同维度：`denied` 不能被解释为 unavailable，未认证也不能被解释为 not implemented。

**目标语义推断：**

| 状态 | 证据来源 | 页面行为 |
| --- | --- | --- |
| `Available` | 所需真实请求成功且数据可用 | 正常展示与允许已有操作 |
| `Degraded` | 核心页面可用，但可选/局部真实依赖失败或数据过期 | 保留可用内容，指出受影响区块和重试入口 |
| `Unavailable` | 当前实现存在，但必要真实依赖失败 | 禁用受影响操作，显示可诊断失败与恢复入口 |
| `Not Implemented` | Binding 明确声明页面先行但后端能力尚未实现 | 展示完整信息架构和目标流程，不发起不存在的 API、不模拟成功 |

运行可用性必须来自真实请求结果；静态 Binding 只能声明是否已实现，不能伪造健康状态。权限继续单独显示和执行。

### 2.5 当前视觉完成度仍是基础原型

- `styles.css` 主要是单文件暗色布局，缺少成体系的 Token、密度、层级、状态颜色、焦点、Skeleton、Toast、Dialog、Drawer、Table、Filter、Pagination 和响应式导航模式。
- `package.json` 已包含 HeroUI，但当前 TS/TSX 没有使用 HeroUI 组件；React Hook Form、Zod 等也没有形成统一表单模式。
- Dashboard 直接展示 JSON/pre 文本，真实但没有把 build、probe、diagnostics、metrics 组织成后台用户可读的信息层级。
- 042 明确记录 E2E、桌面/移动视觉和真实部署验收未完成。

## 3. SoybeanAdmin 参考观察

### 3.1 浏览器实测：认证入口

2026-08-21 对在线站点登录页进行了真实 DOM 与截图观察：

- 认证流程使用独立 blank layout，而不是把后台侧栏强行带入登录页；
- 全屏浅紫渐变与大面积抽象形状建立背景层，中心白色卡片承担主要交互；
- 品牌、主题和语言入口位于卡片头部，表单主体保持单列、稳定宽度和充足间距；
- 主操作、次操作、辅助链接与演示身份切换通过间距、分隔线、填充/描边按钮形成明确层级；
- 页面同时表达默认值、密码遮罩、记住我、找回、验证码登录和注册等完整认证场景，但本项目只借鉴信息层级，不复制这些并不存在的业务能力。

### 3.2 浏览器实测：后台首页与全局布局

登录响应较慢，但页面最终进入 `/home`；随后取得首页 DOM 与截图：

- 左侧固定品牌和分组菜单，菜单自身可滚动；选中态使用低饱和主题底色，不依赖粗重边框。
- 顶部 Header 集中放置侧栏折叠、当前位置、搜索、全屏、语言、主题与用户入口；其下还有可关闭页签层，内容区不承担全局操作。
- 内容区、侧栏和全局 Footer 分层清楚。页面主体在独立浅色背景上使用白色 Surface，并保持统一圆角、边距和弱阴影。
- 首页先用欢迎区和项目/待办/消息摘要建立上下文，再用高识别度统计卡展示访问量、成交额、下载量和成交量，之后才进入项目动态等明细内容。
- 当前浏览器视口较窄时，统计卡按单列堆叠而侧栏仍保持稳定；这说明响应式需要围绕内容优先级与滚动边界设计，不能简单把桌面 Grid 压缩。

本项目不会复制欢迎语、天气、业务指标或多页签机制。首轮只采纳稳定 Shell 分层、工具入口归组、内容 Surface、信息由概览到明细和窄视口的连续性。

### 3.3 浏览器实测：列表与表单

从系统管理进入用户管理页并打开“新增用户” Drawer，取得 DOM 与截图：

- 位置感知同时体现在 breadcrumb、页签和侧栏选中态，用户不需要从 URL 猜测当前位置。
- 搜索条件默认折叠为独立 Surface；列表 Surface 的标题、主要新增、禁用的批量删除、刷新和列设置位于同一工具栏，操作层级与当前选择状态一致。
- 表格将选择、序号、业务字段、状态和行操作分列；状态使用小型语义标签，分页、总数和每页数量在表格底部形成独立控制区。
- 窄视口没有把所有列挤成无法阅读的最小宽度，而是让内容区裁切/滚动；这要求项目表格显式设计最小列宽和 overflow，而不是依赖浏览器偶然换行。
- 新增表单使用右侧 Drawer 保留列表上下文，遮罩降低背景竞争；标题与关闭位于固定 Header，确认/取消位于固定 Footer，中间表单独立滚动。
- 字段按单列分组，必填标记靠近 label，文本、radio 和 select 使用一致高度与间距；初始状态不在用户输入前制造红色错误海洋。

用户管理数据与 CRUD 只是参考站点演示内容，不构成当前项目真实需求。047 只把这里观察到的 Table/Filter/Pagination/Drawer/Form 模式沉淀为宿主公共组件和组件级 fixture，不创建用户管理生产页面。

### 3.4 官方主源交叉核对

SoybeanAdmin 官方介绍与目录说明证明其成熟后台体验不是单一配色，而是一套系统：base/blank layout、全局 header、sider、menu、breadcrumb、tab、search、theme drawer、异常页、用户中心、管理页、表格/表单 hooks、i18n、权限路由和移动适配。

官方还明确把 `main` 作为不含高业务性示例的精简核心框架，把完整示例菜单放在 `example` 分支。这直接支持本任务“Admin WebUI 本体优先、示例后置”的范围：高保真参考 Shell、导航、页面容器、主题、状态和公共交互，不复制演示模块。

这些信息只用于确定观察维度与产品模式，不用于复制源码或技术架构。本项目继续使用 React、现有 WebUI Contract、显式 Composition 和项目自己的权限/生命周期边界。

### 3.5 浏览器 i18n 技术选择复核

当前项目没有浏览器 i18n 实现，Go `pkg/i18n` 也不适合搬入 React。可选路径如下：

| 路径 | 结论 |
| --- | --- |
| 自研 key/namespace loader | 能减少依赖，但会重复实现实例生命周期、fallback、namespace、React 更新和测试语义，不符合成熟技术优先。 |
| FormatJS / react-intl | 成熟并以 ICU/Intl 为中心，但当前核心是由 Binding/codegen 生成 namespace 并按模块加载；采用它仍需另建模块资源装配层。 |
| i18next + react-i18next | 官方支持 React hook、namespace、按需资源和单实例；与当前 `Language + Namespace + SourcePath` 契约直接匹配，选为计划方案。 |

截至本次复核，i18next 与 react-i18next 均为 MIT，仍有 2026 年发布/提交；react-i18next 要求 React 16.8+，兼容当前 React 19。它们提供可注入实例、ready/loading 和测试入口，便于把失败显式呈现。替换成本被限制在宿主 i18n adapter 与项目窄 hook，模块不直接初始化第三方实例。

安全边界上不引入 `i18next-http-backend` 或浏览器语言检测插件；模块 locale 由受校验的构建期 registry 动态导入，语言与 namespace 只接受 Catalog 已声明集合。上游 `i18next-http-backend < 3.0.5` 曾有 URL 注入公告，但该插件不在计划依赖内。实施时仍需审查 lockfile、运行依赖审计并记录结果，不能把本次网页检索当作完整供应链证明。

### 3.6 用户当前视觉决策

用户把近期实施目标收窄为“重构当前 WebUI 的布局和骨架”，并要求对 `https://soybeanjs.cn` 做完全参考。结合此前明确边界，本计划把“完全参考”落实为宿主本体的高保真 parity：侧栏、Header、面包屑、工作区页签、route search、主题 Drawer、内容 Surface、Footer、状态页、响应式和明暗主题均需同视口对照；项目继续保留自己的品牌、数据、React/HeroUI 技术栈与 Binding/Composition 机制，不复制源码、业务页面或 Demo。

## 4. 能力与边界评估

| 维度 | 结论 |
| --- | --- |
| 真实用例 | 管理员完成首次设置/登录/会话管理，查看运行状态；未来模块按运营、配置、查询、审核或人工干预需求贡献页面。 |
| 现有能力复用 | WebUI Catalog/manifest/codegen、Auth policy/Session、Ops management、React/Vite/HeroUI、TanStack Query、React Hook Form、Zod。 |
| 最小新能力 | 浏览器 i18n 依赖与生成 locale registry；宿主公共组件/上下文；可复核的视觉测试资产。 |
| 模块 owner | Auth 拥有认证页面和 Auth API；Ops 拥有运行看板；宿主只拥有 Shell、公共交互、异常页、外观与运行契约。 |
| Composition | 继续显式聚合；不扫描目录、不使用 `init`、Service Locator、动态脚本或远程模块。 |
| 数据与业务规则 | 页面只调用模块现有 HTTP/management 能力；不得访问数据库、复制服务端规则或用 mock 冒充成功。 |
| 生命周期 | 静态 WebUI 构建不进入 Kernel 生命周期；后端资源与 Application Generation 保持现状。 |
| Reload | Binding、registry 与 locale 是构建期固定；revision 不一致继续 fail closed。运行数据按 Query 生命周期刷新，不引入模块热插拔。 |
| 安全 | 权限 access 与 capability status 分离；服务端 operation gate 仍是 authority；Session/CSRF/Origin 语义不变。 |
| 第三方边界 | `i18next/react-i18next` 只在宿主 i18n adapter 中初始化，模块页面消费项目提供的窄 hook，不自行创建第二实例。 |

## 5. 适用、不适用与局限

适用于现有宿主、Auth、Ops 和未来确有管理用例的模块。它不授权新增 Todo 管理页面、动态插件、远程页面、数据库直连、MFA、多管理员治理、部署或任何不存在的业务 API。

剩余局限：

- 本轮已抽样登录、首页 Shell、用户列表/筛选、新增 Drawer、403 与主题 Drawer，但显式移动视口观察在加载阶段超时，且没有覆盖全部主题/布局选项和页面切换细节；实施相应阶段时必须重新观察，不能把当前样本外推为全部 SoybeanAdmin 行为。
- 当前没有本地 WebUI 运行截图；根据门禁，本轮不启动服务。确认实施后应先建立隔离、低敏的本地验收数据，再做视觉基线。
- 表格/表单模式先作为宿主能力建立，首轮没有真实列表型业务模块时用组件级 fixture 测试其状态，不把 fixture 宣称为业务页面或后端能力。

## 6. 研究结论与门禁

当前架构足以表达目标，不需要重构整个项目或新建平行后台体系。首次实施应按“装配闭环 -> 高保真 Shell/导航/页面承载 -> 四态与公共交互 -> 宿主视觉/E2E 门禁”推进；Auth/Ops 首次只做解除宿主硬编码所需的最小迁移，完整页面产品化后置，不在当前变更建设 Demo 或示例模块。

关键内部事实、外部主源、视觉事实与局限已区分，剩余未知不妨碍形成计划，研究门禁通过。非文档实施仍必须等待用户在本计划报告之后明确确认。
