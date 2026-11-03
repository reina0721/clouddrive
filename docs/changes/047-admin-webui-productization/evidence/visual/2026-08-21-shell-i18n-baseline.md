# Shell 与 i18n 视觉对照记录

## 参考站

- 参考：[SoybeanAdmin](https://soybeanjs.cn/)
- 观察日期：2026-08-21
- 视口：约 1280 × 720
- 页面：在线工作台首页（`/home`）
- 方式：浏览器 DOM 快照与截图

## 观察到的产品结构

- 左侧固定导航约占 220px，品牌区、激活菜单、分组菜单和底部版本/辅助信息分层明确。
- 顶部 Header 负责侧栏折叠、当前位置、搜索、全屏、语言、主题和用户入口；业务操作不挤入 Header。
- Header 下方独立工作区页签，当前页签使用浅色激活 Surface。
- 主内容使用浅色背景与白色 Surface 分层，统计卡片、图表和动态列表保持统一间距与密度。
- Footer 固定在工作区底部，整体视觉密度偏紧凑但保留明显层级和留白。

## 本轮采纳与项目化处理

| 参考关系 | 当前实现 |
| --- | --- |
| 固定侧栏 + Header + 页签 + 内容 Surface + Footer | `AppShell` 继续作为唯一宿主承载层，模块不接触这些内部对象 |
| Header 统一承载语言/主题/搜索/全屏/用户入口 | 所有入口保留在 host，并通过 `webui.host` locale 资源取文案 |
| 页面和菜单标题由后台语言资源提供 | manifest message ID 经单实例 i18n 翻译；模块页面使用 `useWebUITranslation(namespace)` |
| 状态反馈清晰分层 | capability/status 文案进入模块 locale；缺失翻译显示 host 诊断文案，不显示原始 message ID |

## 验证边界

本轮尝试使用本地 HTTPS Vite 服务进行浏览器视觉回归，但浏览器拒绝本地自签名证书（`ERR_CERT_AUTHORITY_INVALID`），无法取得本项目页面截图。因此本记录只证明参考站观察和实现结构对照，不能宣称本地视觉门禁已通过；后续应在受信任的本地证书或用户可访问环境下补齐桌面/移动、明暗主题截图。

## 异常页补充观察

- 页面：[SoybeanAdmin 403](https://soybeanjs.cn/exception/403)，同一约 1280 × 720 视口。
- 异常页没有脱离宿主骨架：侧栏、Header、页签和 Footer 保持可见，主内容只替换为状态表达。
- 主内容采用“较大的插画/状态编号 → 简短标题 → 说明 → 主按钮”的单列层级；按钮文案为“返回首页”，操作入口明确且不与导航重复。
- 403 插画使用明亮的主色块和柔和阴影，视觉重量集中在内容区中央，避免把异常细节堆成诊断面板。
- 尝试访问 `/login` 时站点回到工作台首页，未取得独立登录页快照；本项目认证页因此继续沿用 BlankLayout 的独立空白骨架，并保持品牌、表单、反馈、Footer 的同一语言系统。

## 本轮状态页校准

- `SystemStatePage` 保留 `Available / Degraded / Unavailable / Not Implemented` 语义和原有详情入口，只调整异常插画、状态编号、阴影、标题层级与主按钮表现。
- 插画由项目 CSS 与既有图标组合生成，不引入 Soybean 的品牌资源、业务数据或源码；页面仍由宿主统一承载，模块不操作 Router、Menu 或全局状态。

## Ops 页面补充观察

- 页面：[Soybean 工作台](https://soybeanjs.cn/)，同一约 1280 × 720 视口；通过浏览器 DOM 与截图重新观察。
- 工作台主区先放一排高密度统计卡片，再进入较大的图表/列表 Surface；卡片承担“先看总体，再看细节”的信息层级。
- 页面：[Soybean 用户管理](https://soybeanjs.cn/manage/user)。实测结构为页面标题、`新增/批量删除/刷新/列设置` 工具栏、表格、状态单元格和分页。
- 当前项目没有用户、角色或菜单 CRUD 的业务 Binding 与真实 API，因此不复制该页面，也不生成演示数据；本轮只把相同的信息层级迁移到已有 Ops 真实查询。

## 本轮 Ops 校准

- `DashboardPage` 新增三张概览 Surface：已声明诊断、正常响应、需要关注；数值只来自当前六个 management 查询的声明数量与实时查询结果。
- 原有六个诊断结果仍保留，失败继续显示 `Degraded` 与低敏提示，加载时使用 i18n 的占位文案，不把占位状态伪装成成功。
- 概览与诊断卡片使用项目自己的 CSS token 和图标，不复制 Soybean 的品牌、样例数据或业务页面；模块仍只通过公开 WebUI/i18n 契约工作。

## 主题交互补充观察

- Soybean Header 实测同时提供一键明暗模式切换与独立“主题配置”抽屉；抽屉内按“外观 / 布局 / 通用 / 预设”组织设置，并在右侧保持固定 Surface 与遮罩。
- 本项目的主题 authority 仍由 `useThemePreferences` 单点持有；本轮只在 Header 增加一键 light/dark 切换，原有 ThemeDrawer 继续承载主题色、密度与恢复默认，不新增第二套主题状态。
- 新增入口使用 `webui.host.theme.toggle` 文案，保持 host-owned i18n；移动端按现有 Header 响应式规则隐藏，不制造溢出。

## 页签操作补充观察

- Soybean 工作区页签行右侧保留宿主级刷新/显示操作，页签本身仍由宿主统一承载；业务页面不直接控制这组动作。
- 本项目新增“刷新当前页面”宿主入口，调用当前 route 的既有导航语义，不新增模块 API、缓存策略或全局状态；按钮文案来自 `webui.host.tabs.refresh`。

## 搜索交互补充观察

- Soybean Header 的搜索入口在同一组全局工具中，并提供明确 tooltip；本次会话未展开其搜索面板，因此不推断其内部结果组织。
- 当前项目 RouteSearch 保持“只搜索 manifest 可访问 route”的契约，本轮补充 ArrowUp/ArrowDown 选择、Enter 导航、Escape 关闭、ARIA `listbox/option` 选中态和 host-owned 关闭文案。
- 搜索仍不扫描模块源码、不新增第二套路由注册，选中结果只调用宿主已有 `navigate(path)`。

## 多级导航补充观察

- Soybean 侧栏实测包含可展开的分组菜单，例如“系统管理”下继续呈现用户、角色、菜单子项；分组展开状态由宿主侧栏维护，当前路径会保持可见。
- 当前项目的 `ManifestMenu` 已有 `parentId` 契约，但此前宿主只把所有可访问项平铺渲染。本轮开始消费该字段，形成递归菜单树、分组展开按钮和当前 route 的祖先自动展开。
- 菜单树仍由 manifest/access 过滤结果构成；孤立或不可见父级不会阻断其他导航，模块无需修改宿主菜单文件。

## 移动端补充观察

- 视口：390 × 844；Soybean 移动状态下隐藏品牌与面包屑，Header 只保留菜单、搜索、语言、主题和用户等紧凑工具入口；工作区页签仍保留刷新/显示操作。
- 主内容 Surface 继续保持卡片层级和滚动，不把侧栏直接堆到页面顶部；菜单打开时页面出现遮罩，导航作为独立侧栏层承载。
- 当前项目新增移动规则：隐藏面包屑、压缩 Header icon 间距和页签左右留白，保留 mobile sidebar/backdrop 结构；未改变模块页面的业务布局。
- 参考站在当前会话的移动菜单点击后出现页面遮罩，但侧栏内容未稳定呈现，无法据此推断其抽屉宽度；项目不以该不确定状态宣称像素级一致。
- Soybean 移动 Header 仍显示语言、主题和用户入口；本项目此前把语言与账号入口整体 `display:none`，本轮改为紧凑显示头像/图标，避免移动端丢失语言切换与安全退出能力。

## 移动侧栏焦点补充校准

- 本轮再次尝试以 390×844 视口观察参考站；当前浏览器会话的 viewport override 未稳定生效，仍返回桌面尺寸，因此不把本轮当作新的移动像素证据。此前已记录的移动观察仍只用于 Header/遮罩/侧栏结构边界。
- 基于已观察到的“菜单入口 → 左侧 Drawer → 遮罩 → 关闭返回”的交互关系，项目移动侧栏现在在窄视口打开时聚焦关闭入口、Tab 在侧栏内循环、Escape/遮罩/关闭按钮关闭并恢复菜单入口焦点；关闭态用 `aria-hidden`/`inert` 隔离，桌面侧栏保持可用。
- 语言、账号和搜索仍由 Header 宿主承载，移动侧栏只负责导航，不新增模块注册或第二套全局状态。

## 工作区滚动所有权补充校准

- 2026-08-21 重新观察 `https://soybeanjs.cn/home`：浏览器实测 `header` 位于 `y=0,h=56`，左侧 `aside` 覆盖 `h=720`；宿主内容区从 `y=56` 开始，页签后 `main` 位于 `y=100,h=572` 且 `overflow:auto`，`footer` 固定在 `y=672,h=48`。这证明参考站把 Header、页签、Footer 留在宿主层，仅让中间工作区滚动。
- 项目 `AppLayout` 现在将 `.app-workspace` 设为 `height: 100vh; overflow: hidden`，`.page-viewport` 设为 `min-height: 0; overflow: auto`；这样长页面不会把 Header、页签和 Footer 一起推走，移动 Drawer 仍沿用既有窄视口规则。

## 公共 Drawer 交互补充校准

- 2026-08-21 通过 Soybean `/manage/user` 的“新增”入口观察到：页面主体被遮罩压暗，右侧固定 Drawer 包含标题与关闭按钮、中间可滚动表单区和底部固定“取消/确认”操作区；当前可见 DOM 提供 close、多个输入控件和底部动作入口。
- 项目公共 `Drawer` 现在沿用该交互边界，但不复制用户管理业务：模块继续注入标题、内容和 footer；宿主公共层统一处理 `role=dialog`、`aria-labelledby`、打开聚焦、Tab 循环、Escape、关闭恢复焦点、遮罩禁用和关闭态 `inert`。
- 同一页面的列表区还显示“搜索”折叠行、重置/搜索动作、批量删除禁用态、刷新/列设置、表头选择和分页；公共 `FilterPanel` 与 `DataTable` 本轮只吸收这些结构和可访问语义，不引入用户字段、模拟行或新的业务路由。
- 工具栏的可访问名称由调用模块注入并走其 locale，不在公共 UI 内硬编码“用户操作”等业务文案。
- Soybean 403 页面把异常结果与返回入口放在同一内容层级；项目保留 `Available / Degraded / Unavailable / Not Implemented` 四态，不伪造参考站业务状态，并让 `CapabilityBanner` 的状态转换以 `role=status`、`aria-live=polite` 对辅助技术可见。
- 宿主现在为 manifest lazy 页面增加 `RouteErrorBoundary`：模块加载或渲染异常只呈现 host locale 的“页面加载失败”低敏状态并提供返回首页入口，不把异常对象、堆栈或模块内部文案泄漏到页面。
- Soybean 用户列表的表格标题、分页总数/页码/页大小均属于页面上下文；公共 `DataTable` 与 `Pagination` 现在只提供结构，表格/分页可访问名称必须由模块以当前 locale 注入。
- Soybean 的“列设置”弹层还包含全选、列显隐、拖动排序和固定列；当前没有真实模块消费该弹层，因此项目只把 `DataTableColumn.visible` 作为模块驱动的显隐边界，暂不建立全局列设置状态、拖拽排序或固定列协议。

## 密度设置补充校准

- Soybean 主题配置抽屉把布局/密度作为独立的外观设置层；本项目已有 Comfortable/Compact 选择，但此前只写入 `data-density`，没有实际 CSS 消费。
- 本轮为 Compact 增加宿主级间距与控件高度规则：页签、侧栏项、页面头部、状态 Banner、Ops 概览/诊断卡片和表单字段均收紧；默认 Comfortable 规则不变。
- 密度仍是宿主主题 authority 的纯视觉设置，不改变模块数据、权限或业务行为。

## Ops 工作台层级补充校准

- 本轮重新观察 Soybean `/home`：工作区按“欢迎/摘要 → 指标卡 → 分组内容 Surface”递进，Header 与页签行提供独立的全局操作入口；页面底部保留连续内容滚动，不把全部信息压进一个无层级列表。
- 当前项目没有对应的模拟业务统计，因此不复制 Soybean 的示例数字或图表；将同一信息层级映射到真实 Ops 查询：摘要卡继续只统计六个 management operation，诊断区按核心运行探针与可选诊断/指标分组。
- 核心探针失败整体进入 `Unavailable`，可选诊断/指标局部失败进入 `Degraded`；顶部刷新和失败卡片重试都只重新触发现有 query，不新增后端接口或第二套状态源。
- 本轮把顶部刷新与失败卡片重试接入模块自己的 `Toast`：刷新结束后按真实失败数量显示成功或危险反馈，首次自动加载不弹伪造成功提示；反馈文案全部来自 `webui.ops` locale。
- 本轮启动本地 Vite 后再次尝试同视口浏览器回归，浏览器仍因项目要求的 basic-ssl 自签名证书返回 `ERR_CERT_AUTHORITY_INVALID`；因此本轮保留自动化构建/类型/测试证据，不把本地截图误报为已完成。

## 公共管理模式补充校准

- 本轮重新观察 Soybean `/manage/user`：筛选区是可折叠的独立 Surface；页面工具栏把新增、批量删除、刷新、列设置放在列表标题右侧；表格提供选择列、状态标签、行级操作和分页/页容量；内容区保持横向可滚动。
- 当前项目没有用户管理业务，因此没有复制 Soybean 的用户字段、示例数据或 CRUD 路由；公共层只提供可由模块注入 locale 文案和业务单元格的 `DataToolbar`、`FilterPanel`、`DataTable`、`Pagination`、`EmptyState`、`InlineAlert` 和 `Drawer` 模式。
- 表格选择、加载、空态、分页和抽屉开关均由调用模块控制，公共 UI 不创建业务状态、不注册 manifest，也不绕过模块能力边界。

## Ops 能力清单页补充校准

- 2026-08-21 重新观察 Soybean `/manage/user`：主内容依次呈现筛选入口、带新增/批量删除/刷新/列设置的标题工具栏、表格状态列与操作列、分页和页容量；当前 DOM 还明确标出表头选择列和无数据状态。
- 当前项目没有用户管理后端，因此不复制用户字段、批量删除或示例行；Ops 模块把同一页面组织映射到现有六个 management query，提供能力名称、核心/可选范围、四态状态、结果摘要和单项重试。
- 新页面由 `ops` Binding 声明 `ops.capabilities` entry/route/menu，宿主只消费生成 manifest；筛选、分页和反馈文案由 `webui.ops` locale 提供，模块不操作宿主 Router/Menu。
- 参考站列表页的新增/编辑操作通过右侧固定 Drawer 承载标题、说明、可滚动内容和底部操作区；当前 Ops 页面将同一列表到详情关系收敛为“查看详情” Drawer，展示真实 management 结果快照，不伪造编辑表单或写操作。

## Ops Dashboard 概览层补充校准

- 2026-08-21 重新观察 Soybean `/home` DOM：主内容依次是欢迎区、项目/待办/消息摘要、统计卡、项目动态列表和 Footer；页面先给总体上下文，再进入细节。
- 当前项目没有天气、待办、消息或项目活动后端，因此不复制这些示例数据。Ops Dashboard 将同一“先总览、后详情”关系映射到现有真实 management 查询：Build 信息、Diagnostics 运行快照和依赖健康状态位于原始诊断卡片之前。
- 运行快照只读取 `processState`、`generation`、`phase`、活动请求/连接；依赖健康只读取服务端 diagnostics 的 `authReady`、`databaseReady`、`schedulerHealth`、`messagingHealth`。字段缺失显示 `—` 并标记 `Unavailable`，不会由浏览器推断状态。
- 原有六个查询、核心/可选四态、重试和原始结果详情保留；这次只是增加真实数据的结构化 Surface，不新增后端 wire contract。
- Soybean `/home` 视觉快照还显示四张高对比指标卡和后续图表。当前项目只有一次性 Prometheus metrics 快照，没有历史序列，因此实现四张真实指标卡（HTTP 请求、活动请求、导出 Span、丢弃 Span），不伪造折线趋势；卡片继续放在概览之后、原始诊断之前。

## 主题抽屉分层补充校准

- 本轮重新观察 Soybean 主题配置抽屉：固定右侧 Drawer + 遮罩，顶部标题/关闭入口，下方按“外观、布局、通用、预设”四个分区切换；布局分区集中管理页签、面包屑、侧栏、底部和动效等宿主级偏好。
- 项目 ThemeDrawer 现在采用同样的四分区信息层级：外观承载模式/密度，布局承载面包屑/页签/底部/侧栏默认状态，通用承载减少动效，预设承载主题色；所有标题、开关标签和辅助说明来自 `webui.host` locale。
- 新增偏好只由 `useThemePreferences` 单点持有并持久化；布局开关直接影响宿主可见层级，减少动效通过 `data-motion` 消费，不创建第二套主题 authority，也不影响业务模块语义。
- 本轮补充主题分区的键盘契约：激活分区 `tabIndex=0`，其余分区 `tabIndex=-1`；左右/上下方向键与 `Home`/`End` 循环切换并恢复目标焦点，`tabpanel` 通过 `aria-labelledby` 关联当前分区；模式、密度和预设选项通过 `aria-pressed` 暴露当前选择。

## 语言切换补充校准

- 本轮重新观察 Soybean Header 语言入口：语言图标打开可选择菜单，至少提供中文与 English；切换后宿主壳层与当前业务页面同步变更，而不是只改变一个标签。
- 项目语言入口现在由已装配的 host/module locale registry 共同决定，当前提供 `zh-CN` 与 `en-US`；Host、Auth、Ops 三个 namespace 均有完整英文资源，切换测试覆盖跨 namespace 文案。
- 语言切换仍由唯一 i18n instance 执行，未知语言被拒绝；业务模块无需修改宿主 Header，只需继续在自身 Binding 声明对应 locale。

## Header 搜索与语言刷新补充校准

- 本轮重新观察 Soybean 工作台 Header：搜索入口位于全局工具区，与全屏、语言、主题和账号入口同层；工作区页签与主内容 Surface 位于其下方，保持“宿主操作 → 页面定位 → 页面内容”的信息顺序。
- 项目 `RouteSearch` 继续只消费 manifest 中可访问的 route，并保留输入框、键盘上下选中、Enter 导航、Escape 关闭和空结果状态；不增加第二套路由注册。由于参考站搜索弹层在当前会话点击后未稳定返回 DOM，未对其内部动画或结果样式作未经验证的复制。
- 语言切换后，`AppShell` 通过 `useWebUITranslation("webui.host")` 订阅公开 i18n 契约，保证 Header、页签、侧栏和挂载在宿主下的 ThemeDrawer/RouteSearch 一起重新渲染；语言选择器自身增加可访问名称，未知语言边界测试保持 fail closed。

## 认证壳补充校准

- 认证壳的既定产品边界是沿用后台产品的品牌、语言和主题入口，不把登录/设置页面做成脱离宿主的第二套视觉壳；当前项目的 `BlankLayout` 现在在认证内容上方提供同一 host i18n 驱动的语言选择、明暗切换和主题 Drawer 入口。当前参考站会话将 `/login` 重定向到工作台，未据此推断未展示的认证字段或流程。
- `BlankLayout` 只装配宿主控制与 `ThemePreferences`，setup/login/session 页面仍由 Auth module 自身负责；没有新增认证 API、会话状态或独立主题存储。
- 认证表单内容仍保持独立 blank Surface，主题 Drawer 继续复用公共焦点、遮罩和关闭契约；本轮未宣称参考站认证页的未实测字段、品牌或业务流程。

## Auth Session 页面补充校准

- 2026-08-21 重新访问 Soybean `/user-center`，当前页面只呈现“敬请期待”，没有可复核的用户中心字段、编辑表单或写操作；因此项目不复制该占位页，也不虚构用户中心后端能力。
- 当前项目已有真实 `WebUISession` 契约，Session 页面改为“状态 Banner → 主体/权限/创建摘要 → 生命周期与 scope Surface”层级，展示 `user.id`、用户名、scope、创建时间、空闲过期和绝对过期。
- 未登录时页面明确 `Unavailable` 与登录提示；登录后只展示服务端签发的只读会话信息，不在前端推算过期、不新增密码修改、权限编辑或账号设置流程。

## Auth Session 访问装配补充校准

- 参考站 Header 保留用户入口，但当前 `/user-center` 仍是占位页；本项目不据此虚构用户中心写操作，而是把已有真实 Session 作为模块自己的可见导航入口。
- `auth` Binding 现在同时声明 `auth.webui.session` 查看 operation、`auth.session` route/menu 和 `user` 图标；Composition 通过现有 `management:read` policy 装配服务端授权，manifest 对未认证主体返回 `authentication-required`，宿主再统一跳转登录。
- 这次补齐的是已有会话页面的访问边界和导航可发现性，不改变 Session/CSRF/Origin wire，不新增后端业务操作或模拟数据。

## 路由搜索焦点补充校准

- 参考站 Header 的搜索入口位于全局工具区，打开后应成为当前操作焦点，而不是把键盘操作留在页面下方；关闭后继续回到触发入口，符合后台连续操作的使用节奏。
- `RouteSearch` 现在在打开时保存触发元素并聚焦输入框，关闭时恢复焦点；Tab 在对话框内部循环，Escape、遮罩、关闭按钮、上下键和 Enter 都保持可预期路径。
- 结果列表采用 `combobox/listbox/option` 语义与 roving `tabIndex`，空结果表达为 `role=status`；搜索标题会随宿主语言变化重新计算，不把旧语言的过滤结果留在内存中。

## 工作区页签补充校准

- Soybean 工作台把页签行放在 Header 下方、内容 Surface 上方；当前页签以浅色语义背景突出，页签行保留横向滚动空间，右侧提供刷新等宿主操作。
- 项目页签行现在声明 `tablist`/`tab` 语义，激活页签提供 `aria-selected`，所有按钮明确 `type="button"`；默认首页按宿主设计保持不可关闭，其他已访问页面可关闭并回退到相邻页面/默认页面。

## 工作区页签焦点补充校准

- 本轮重新观察 Soybean `/manage/user` 的页签行：激活的“用户管理”页签与默认“首页”页签同处 Header 下方工作区，页签行右侧仍固定提供刷新入口；参考站当前 DOM 未暴露可复核的 `tablist`/`tab` ARIA 角色，因此不把其无障碍实现细节误写成参考事实。
- 当前项目在保持上述视觉组织和宿主归属的基础上补充可验证的键盘契约：激活页签 `tabIndex=0`，其余页签 `tabIndex=-1`；`ArrowLeft`/`ArrowRight` 循环切换，`Home`/`End` 跳转首尾，并通过 `aria-controls` 关联唯一 `tabpanel`。导航后恢复目标页签焦点，模块不接触 Router 或页签状态。
- 该增强只属于宿主公共交互与可访问性，不新增业务页面、缓存机制或模块注册入口；后续若参考站交互继续变化，只需在宿主层和本证据档案中增量复核。
- 页签标题仍来自 route message ID，关闭与刷新只由宿主基于稳定 route ID 执行，模块不接触页签状态；新增“已打开页面”标签进入 host locale，保持中英文资源完整。

## 公共反馈与确认模式补充校准

- 参考站官方请求与表格操作文档把请求失败提示、退出确认、增删改确认和 Drawer 操作放在统一的公共交互层，页面只提供业务状态与操作回调；本轮以该可复核产品组织为约束，不把业务文案或确认规则写进宿主组件。
- 项目公共层新增受控 `Toast` 与 `ConfirmDialog`：调用模块必须传入当前 namespace 的标题、说明、关闭/确认/取消文案及回调；组件不读取业务 store、不创建全局 toast manager、不操作 Router，也不生成 message ID。
- `Toast` 用 `status`/`alert` 和 `aria-live` 表达普通/危险反馈；`ConfirmDialog` 复用公共焦点进入/恢复、Escape 取消、Tab 循环、遮罩和关闭态 `inert` 约束。视觉层沿用当前 Surface、border、shadow 和移动端双按钮布局 token，未复制参考站源码、品牌或业务数据。

## 账号退出交互补充校准

- Soybean 的后台请求规范明确区分直接退出、需要弹窗确认后退出和请求失败提示；退出确认属于宿主公共交互，不由具体业务页面重新实现。[官方请求处理说明](https://admin-docs.soybeanjs.cn/guide/request/usage)
- 当前项目 Header 账号菜单的退出入口现在由宿主 `ConfirmDialog` 承载，确认后调用既有 `onLogout`；调用失败只显示 host-owned `Toast` 的稳定错误说明，不把原始异常或会话信息写入页面。
- 退出确认、取消、关闭和失败提示全部来自 `webui.host` 的 `zh-CN`/`en-US` 资源；账号菜单仍只展示会话中的用户名首字母，不扩展用户中心或业务权限页面。

## 主题 Drawer 焦点补充校准

- 本轮通过参考站主题入口实测确认：右侧 Drawer 由遮罩承载，顶部关闭按钮在打开后成为可操作焦点，分区 tab 位于标题下方，内容区独立滚动，底部重置/复制操作固定在 Drawer 底边。
- 当前 `ThemeDrawer` 保留项目已有四分区和单一 `ThemePreferences` authority，并新增打开聚焦关闭入口、Escape/遮罩关闭、Tab 内循环、关闭恢复触发入口焦点；关闭态用 `aria-hidden` 与 `inert` 隔离，避免隐藏控件进入键盘路径。
- 主题分区继续只消费宿主 locale 与主题状态，不复制参考站品牌配置对象或不存在的主题能力；本轮只采纳其操作层级和焦点行为。
