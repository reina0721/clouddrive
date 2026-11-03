# R003 方案与现状差异分析

> 研究快照:commit `c3a23c0`、研究/验证日期 2026-08-27。
> 输入:`docs/changes/temp-new-changes.md`(方案全文 80 节,下称「方案」)、R001(WebUI 前端现状审计)、R002(后端真实能力清单)。
> 本档案只回答「方案每项要求在**当前已实现现状**下的差距与判定」,判定一律引用 R001/R002 的明确事实;不替 082 做实现,不做未证实推断。
> **方案版本说明**:本档案发表于方案沿用 80 节编号结构时(commit `c3a23c0`);方案后于 commit `3b758bd` 重构为 81 章中文编号(「一、核心原则」~「八十一、最终执行指令」)。差异矩阵仍以 80 节编号记录(研究快照),新旧编号映射见下方 §4.11;映射后的需求落点见 [requirements.md](../../requirements.md) 各 REQ 的「来源(新章节)」列。

---

## 1. 研究问题

方案(80 节)在当前 WebUI 现状下的逐项差距是什么?每一节应判定为「已满足 / 部分满足(需补齐)/ 未满足(需新增)/ 与已验证边界冲突(需否决或重述)/ 纯愿望或超出当前阶段(候选)」,并给出建议动作与影响文件域,作为 082 requirements/design/tasks 的逐项输入。

## 2. 方法与范围

- 方法:将方案 80 节按主题聚类(方法论与红线 / 信息架构与导航 / 页面解剖与响应式 / 设计系统 / 核心 UI 基础设施 / 业务页面模式 / Ops / Audit / 全局交互与 URL / 实施流程),逐节对照 R001(现状事实,含节号)与 R002(后端能力事实,含节号)给出判定。判定口径:
  - **已满足**:现状已实现且语义一致,证据来自 R001/R002 明确事实。
  - **部分满足**:能力存在但形态/覆盖/交互细节有差距。
  - **未满足**:现状缺失,且方案要求在真实数据基础上可实现。
  - **与已验证边界冲突**:方案要求与 062/068/069/059/067 等已确认边界或「禁止 Fake」红线正面冲突 → 否决或重述。
  - **候选**:纯愿望 / 超出当前阶段 / 无真实数据支撑(仅记录)。
- 范围:仅前端 `webui/` 与 `internal/module/*/binding/webui/*` 的产品架构与 UI 层;后端能力评估引用 R002 结论,不重复评估。
- 纪律:现状已有必须引用 R001/R002 证据;方案要求 Fake(后端不存在的能力/数据)时按 AGENTS.md 判「不可实施,重述为展示不可用态」,不默认新增。

## 3. 结论速览

1. **方案主题多数已由 059–081 实现或部分实现**:Design Token/样式 authority(#17/22/23/24/61)、主导航唯一(#08/33/63/64)、按钮层级(#26)、Feedback 基座(#56)、权限感知 UI(#71)、Ops 监控语义(#45)、API Token 体系(#39/41/42)、Audit 后端过滤(#48 数据)、表单与 DataTable 原语(#27/32 底座)均已在现状中。
2. **真实差距集中在三类**:(a) 平台底座缺口——DataTable 增强(#27)、统一 Filter/Search + URL 状态同步(#28/72)、表单架构规范化(#32)、状态/反馈语义体系(#52-54/56-58)、语义组件补齐(CodeText/ErrorState/DangerZone/TreeView/InspectorPanel/LogTable/CodeViewer/PermissionMatrix,#21/65);(b) 页面模式迁移——Master–Detail Drawer 化(#29/30/34/35/36/48/49)、Ops 顶栏上下文(#43)、Org Tree(#47)、Menu Inspector(#50);(c) 视觉与 token 补齐——font/control/info/success token(#17/18/20/25)、Group Label(#11)、桌面 grid(#16)、Command Search 入口(#13/51)。
3. **需重述/否决的项**:WorkspaceTabs 去留(#09,与 059/071 现状冲突但非已验证边界,属 082 决策点);Permission 呈现按真实 taxonomy 不硬套 CRUD(#38);Audit Detail 与 User Activity 不得 fake 后端不存在的字段(#49/35);任何多实例 workspace/远程模块(#09 后半)无真实数据,判候选。
4. **红线不变**:单轨 3.8、静态插拔(062)、HeroUI 单轨(068)、禁 Fake(方案 #69=AGENTS)、强 i18n(lint-i18n-contract)、模块页面 owner(lint-architecture)、样式 authority styles.css、Backend Contract 不动(R002 §13)。

---

## 4. 差异矩阵(核心,覆盖全部 80 节)

### 4.1 方法论与红线(#01–05、#67–70、#73–74、#76–77、#80)

| 方案节 | 要求 | 现状事实(证据) | 判定 | 差距描述 | 建议动作 | 影响文件域 |
| --- | --- | --- | --- | --- | --- | --- |
| #01 | 动手前扫描整个产品,以真实代码+API+数据模型为唯一事实来源 | R001 §1 已对路由/manifest/SDK/样式/权限/表单/测试全量审计;R002 §2 证据清单覆盖 55 operation/23 权限键/9 模块 | 已满足 | 无(方法已被 R001/R002 执行) | —(作为 082 研究与计划基线) | 无 |
| #02 | 建立 Backend Capability Map(能力→目标→任务→流程→UI 模式) | R002 §5 已建立 operation→权限键→说明的权威映射;R001 §4.1 页面/路由清单 | 已满足(研究层面) | 方案要求的「页面映射」在 R001/R002 齐备 | —(082 design 直接引用) | 无 |
| #03 | 后端能力不等于前端页面,禁止 1 API=1 screen | 现状 24 路由聚合 55 operation/46 路径,页面已按任务组织(R001 §4.1 vs R002 §7.1) | 已满足(方法论) | 无冲突;广度已收敛 | —(作为设计约束) | 无 |
| #04 | 产品定位为 Enterprise Administration Console(品牌气质清单) | 现状 admin console 形态成立(R001 §4.1 七大模块) | 候选 | 气质清单是设计愿景,无量化现状对比 | 记录:作为 082 design 审美输入,不作为验收硬项 | 无 |
| #05 | 删除 Component-first,遵守 Task/Data/Workflow/State First | R001 §4.10-6 页面呈现模式未完全收敛(card-grid vs DataTable) | 部分满足 | 原则已在 059–081 设计中体现,但部分页面仍以容器优先(AccountsPage card-grid) | 补齐:082 页面迁移阶段按 Task-first 重排 | `webui/src/pages`、模块 facet 页面 |
| #06 | Card 不再作为主要页面骨架,内容优先 Table/List/Tree/…/Drawer | DataTable/charts/SectionNav 等非 Card 原语已建(R001 §4.4);但业务页仍有 card-grid 形态(AccountsPage,R001 §4.10-6) | 部分满足 | 平台原语已去 Card 化,业务页面未完全收敛 | 补齐:页面迁移批量替换 Card Collection 为 Table/List/Detail 模式(与 #14/#34/#66 联动) | `webui/src/styles.css`、模块 facet 页面 |
| #67 | 不无意义替换技术栈 | HeroUI v3 + Tailwind v4 单轨(068);react-query 唯一查询入口 lint 强制(R001 §4.3/4.4) | 已满足 | 与方案「保留能用的技术栈」一致 | —(红线) | 无 |
| #68 | 保留 Backend Contract/权限/安全语义 | R001 §4.7 服务端授权 fail closed;R002 §13-4/5 mutation 契约(Origin+CSRF)、cookie 运行时名 | 已满足 | 无冲突 | —(红线;前端仅呈现投影) | 无 |
| #69 | 禁止 Fake Frontend | 托管链拒绝 mock(`build-webui.mjs`),mock 只在显式数据源下用(R001 §4.5/§4.10-8);R002 无 fake 能力 | 已满足 | 与 AGENTS 一致;是 082 的否决性红线 | —(红线;所有新增 UI 需真实数据) | 无 |
| #70 | 所有 Action 必须 Backend 闭环 | api.ts 真实调用+CSRF;ActionTrigger 真实 pending 防重复(R001 §4.5/§4.7) | 已满足 | 无 Fake 交互 | —(红线) | 无 |
| #71 | Permission-aware UI(Hide/Disable/Read-only/Explain,不让用户点击后 403) | ViewOperationID 路由门禁 + 按钮级 useActionAccess/ActionTrigger 投影(denied 隐藏/禁用,R001 §4.7);manifest 权限投影是呈现控制、服务端 fail closed(R001 §4.7) | 已满足 | 现状已实现 hide/disable 双层;Read-only/Explain 形态依业务选择 | —(迁移时保持投影契约) | 无 |
| #73 | 页面完成标准(位置/数据/状态/动作/结果五问) | 无单页判定现状 | 候选 | 方案定义的验收准则,非功能差距 | 记录:作为 082 requirements 验收标准输入 | `docs/changes/082/requirements.md` |
| #74 | 页面不是功能清单(5 完整工作流 > 20 不完整页) | 24 路由对 46 路径,非 1:1;Settings 8 分区聚合(R001 §4.1) | 已满足(方法论) | 无冲突 | —(设计约束) | 无 |
| #76 | 允许删除旧 UI,保留业务能力 | 059/073 已删除旧结构;AGENTS 3.8 单轨 | 已满足 | 与单轨一致 | —(082 迁移时删除旧页面形态) | 模块 facet 页面 |
| #77 | 不以现有截图作为新设计约束 | 无冲突(082 定位即重构) | 已满足(方法论) | 无 | — | 无 |
| #80 | 先 audit→重构架构→设计系统→Shell→模式→迁移 | R001/R002 已完成 audit;方案 PHASE 1-2 已被覆盖 | 已满足(方法论) | 无 | —(082 按 PHASE 3-10 规划) | 无 |

### 4.2 信息架构与导航(#07–13、#33、#50)

| 方案节 | 要求 | 现状事实(证据) | 判定 | 差距描述 | 建议动作 | 影响文件域 |
| --- | --- | --- | --- | --- | --- | --- |
| #07 | 重新建立稳定 IA(Overview/Operations/Identity/Organization/Governance/Settings/Developer) | 现状 25 菜单节点/4 顶级组(ops.dashboard、iam.access、organization.directory、settings.center)+ 3 平铺(auth.audit、navigation.menus、openapi.docs)(R001 §4.1);且 IA 由 manifest 驱动、无宿主硬编码 | 部分满足 | 与方案模型大部分吻合(Operations≈ops、Identity≈iam.access、Organization≈organization.directory、Settings≈settings.center);差异:Audit 平铺而方案放 Governance、API Docs 平铺而方案放 Developer | 补齐:082 设计阶段评估将 audit 归位 Governance 组、openapi 归位 Developer 组(仅 manifest 声明调整,不新增能力) | `internal/module/*/binding/webui/binding.go` 菜单声明 |
| #08 | 一套主导航逻辑,消除多导航竞争 | 现状仅 Sidebar 主导航 + 可选面包屑;无 secondary sidebar(R001 §4.2) | 已满足 | 已符合;WorkspaceTabs 属页签非第二导航(去留见 #09) | — | 无 |
| #09 | 移除无业务意义的 Global Page Tab Strip(仅真实 multi-document/workspace 才允许 tabs) | 现状有 WorkspaceTabs:visitedRouteIDs 驱动的已访问路由页签,含 roving 键盘/可关闭(R001 §4.2,059/071 实现并测试) | 部分满足(需重述决策) | 现状 tabs 是「历史页签」而非业务 multi-document workspace;方案主张 Navigation+Breadcrumb+browser history | 需决策:082 在 requirements 中明确 WorkspaceTabs 保留(若视为导航辅助)或降级删除(若视为无业务意义页签);二者只能取一,禁止「保留+宣称符合」;**与已验证边界无冲突**(无 ADR 锁定 tabs),属实现取舍 | `webui/src/components/shell/WorkspaceTabs.tsx`、AppShell |
| #10 | App Shell:Sidebar + Top Context Bar + Main Workspace | 现状 AppShell grid(侧栏+工作区,`app-shell`)、720px 断点、mobile 抽屉(R001 §4.2) | 已满足 | 结构一致 | —(PHASE 4 复核细节) | 无 |
| #11 | Sidebar 232–248/64–72px、Brand/主导航/组/分区/Label | 现状 `--shell-sidebar-expanded:264px/collapsed:80px`;品牌行+递归菜单+底部 revision(R001 §4.2/4.6) | 部分满足 | 宽度 token 超出方案范围(264/80 vs 232-248/64-72);Group Label 分区未证实 | 补齐:收敛宽度 token;如采用 Group Label 则加在 SidebarMenu 渲染层(manifest 已有顶级组概念) | `webui/src/styles.css`、`shell/SidebarMenu.tsx` |
| #12 | Active State 明显但克制,Hover/Selected/Focus/Disabled 区分 | styles.css Shell 分区有交互态样式;HeroUI/RAC 基座自带状态(R001 §4.2/4.6) | 部分满足 | 具体视觉是否符合「克制」需复核 | 补齐:PHASE 4/10 视觉复核,不新增机制 | `webui/src/styles.css` |
| #13 | Top Context Bar:左面包屑/上下文,右 Command Search/系统状态/帮助/主题/用户 | 现状 AppHeader 有 trigger/搜索/全屏/语言/主题/AccountMenu/ZoneItems(R001 §4.2);无 Command Search 输入框、无 System Status;header 高度 64px vs 方案 52–60 | 部分满足 | 右侧少 Command Search 触发表单与系统状态位 | 补齐:Command Search 入口常驻化(依赖 #51);System Status 位(可接 081 健康数据,不 fake);高度收敛 | `webui/src/components/shell/AppHeader.tsx`、`webui/src/components/AppShell.tsx` |
| #33 | 个人设置收敛到统一 Settings Local Navigation | settings.center 顶级组 + 8 分区(Profile/Account/Security/Appearance/Notifications/Language/About/Acknowledgement,R001 §4.1),非全局一级入口 | 已满足 | 方案列 6 项,现状 8 项(多 About/Acknowledgement),方向一致 | —(082 复核分区命名) | 无 |
| #50 | Menu/Navigation Management:Tree + Configuration Inspector(Label/Route/Icon/Permission/Visibility/Parent/Order) | navigation.menus.list/update 提供 enabled/parentOverride/orderOverride/version 策略(R002 §5.4);/admin/menus 页(R001 §4.1) | 部分满足 | 后端支持 reorder(由 override 承载);页面是否 Tree+Inspector 形态未逐页通读(R001 §8 局限);Drag&Drop 未证实 | 补齐:复核/重排 MenusPage 为 Tree+Inspector;仅当真实 reorder 支持时允许 DnD | `internal/module/navigation/binding/webui/web/*` |

### 4.3 页面解剖与响应式(#14–16)

| 方案节 | 要求 | 现状事实(证据) | 判定 | 差距描述 | 建议动作 | 影响文件域 |
| --- | --- | --- | --- | --- | --- | --- |
| #14 | 统一 Page Anatomy(Header/Toolbar/Content/Pagination),不允许每页发明 Layout | 现状 PageHeader(含 page-header zone)已建(R001 §4.4);DataToolbar/FilterPanel 原语存在(R001 §4.4);但页面模式未收敛(AccountsPage card-grid vs ApiTokensPage DataTable,R001 §4.10-6) | 部分满足 | Toolbar/Search/Filters 各页自写,未统一成 PageToolbar 语义组件 | 补齐:新增统一 PageHeader+PageToolbar+SearchInput/FilterBar 语义组件并迁移各列表页 | `webui/src/ui/index.tsx`、各列表页 |
| #15 | 页面宽度按场景(Table/Dashboard 全宽,Settings/Form 收窄) | `--content-max:1600px`(R001 §4.6),非中央 1000px | 部分满足 | 全局 max 已满足「不全压中央」;Settings/Form 收窄宽度未见明确 token/实现 | 补齐:为 Settings/Form/Detail 定义宽度档 token | `webui/src/styles.css` |
| #16 | Desktop Fluid 12-column Grid;Tablet/Mobile 分形态 | 720px 断点 + mobile 抽屉导航已实现(R001 §4.2);桌面 12 列 grid 无证据 | 部分满足 | 桌面横向空间利用未用 grid 体系;Tablet 断点单一 | 补齐:桌面流体栅格(仅在需跨段对齐页面使用,不强制全站);Tablet 适配复核 | `webui/src/styles.css`、布局原语 |

### 4.4 设计系统与样式(#17–26、#61–64)

| 方案节 | 要求 | 现状事实(证据) | 判定 | 差距描述 | 建议动作 | 影响文件域 |
| --- | --- | --- | --- | --- | --- | --- |
| #17 | 全 Token 驱动(color/surface/text/border/space/radius/font/shadow/motion/zIndex/control) | styles.css token 分区:语义色/surface/border/space/radius/shadow/motion/zIndex/shell 布局已齐(R001 §4.6);font.*、control.* 未见证据 | 部分满足 | font/control 命名 token 缺失 | 补齐:增补 font.*(字号/字重/字体栈)与 control.*(控件尺寸)token,建立完整 Typography/Control Scale | `webui/src/styles.css` |
| #18 | Color System:Neutral(Canvas/Surface/…)+Brand/Info/Success/Warning/Danger | 现状 --primary/-soft/-strong、surface、--border*、--warning/--danger(R001 §4.6);Info/Success 语义 token 未见明确证据 | 部分满足 | Info/Success 语义色未系统化 | 补齐:补 info/success 语义 token(与 081 Dash 语义色对齐) | `webui/src/styles.css` |
| #19 | Semantic Color(绿=健康/黄=警告/红=错误/蓝=信息) | 081 Dashboard 用语义横幅(available/degraded/unavailable,R001 §4.5);StatusPill 语义(R001 §4.4) | 部分满足 | 语义色已局部使用,全系统语义映射表未文档化 | 补齐:输出语义色使用规范(design 文档层) | `docs/development/webui.md`(样式 authority 附录) |
| #20 | Typography Scale + 中英文/等宽字体栈 | 未见字体 scale 与字体栈声明证据(R001 §4.6 未覆盖) | 部分满足 | 字体体系未确认/未文档化 | 补齐:定义字号 scale 与字体栈 token(系统 UI + monospace),落地到 styles.css font.* | `webui/src/styles.css` |
| #21 | Code/Developer Metadata 用 monospace 呈现 | 无 CodeText 语义组件(R001 §4.4 原语清单无),权限 ID/Token ID 等 monospace 呈现未证实 | 未满足 | 技术标识符呈现原语缺失 | 新增:CodeText/CodeViewer 语义组件,并应用于 Permission ID/Token ID/审计 hash 等 | `webui/src/ui/index.tsx`(+sdk/ui 透传) |
| #22 | Radius 克制(6/8/10/12,避免 20+) | --radius-* 对齐 HeroUI(R001 §4.6) | 已满足 | 机制对齐,数值复核属 Polish | —(PHASE 10 复核) | 无 |
| #23 | Border 为主、Shadow 只用于浮层 | --shadow* 对齐 HeroUI,shadow 语义用于 overlay(R001 §4.6) | 已满足 | 一致 | — | 无 |
| #24 | 4px 基准 spacing、中等密度 | --space-1..8 + density 偏好(R001 §4.6) | 已满足 | 一致 | — | 无 |
| #25 | Control Density(输入 36–40/按钮 32–36/行高 40–48) | density 参数化存在(R001 §4.6);具体控件尺寸规范未见 | 部分满足 | 缺 control.* 尺寸档 | 补齐:control.* token 化(与 #17 合并) | `webui/src/styles.css` |
| #26 | Button Hierarchy(页面最多一个 Primary) | Button primary/secondary/ghost/danger 映射(R001 §4.4);ActionTrigger 权限+状态 | 已满足 | 机制具备 | —(页面迁移时执行,不新增) | 无 |
| #61 | Motion 120–180ms、Fast/Subtle/Functional | --motion-quick:120ms/standard:180ms/layout:240ms + reduced-motion 覆盖(R001 §4.6) | 已满足 | 一致 | — | 无 |
| #62 | Brand 来自 Typography/Color/Precision 而非花哨视觉 | 无品牌资产系统化证据;现状主题预设 4 套(preset cyan/green/violet/orange,R001 §4.6) | 候选 | 品牌气质属 design 愿景 | 记录:082 design 阶段落品牌准则 | `docs/development/webui.md` |
| #63 | Sidebar Brand 区简洁(CG Mark + Community Go) | AppSidebar 品牌行(Avatar+Fallback 徽标,R001 §4.2) | 已满足 | 结构满足 | —(视觉复核 PHASE 10) | 无 |
| #64 | 不固定大 Footer,版本信息移至 Sidebar 底部/About | 版本信息在 Sidebar 底部(catalogRevision 前 8 位,R001 §4.2);/settings/about 分区存在(R001 §4.1) | 已满足 | 已按方案布局 | — | 无 |

### 4.5 核心 UI 基础设施(#27–32、#52–60、#65–66)

| 方案节 | 要求 | 现状事实(证据) | 判定 | 差距描述 | 建议动作 | 影响文件域 |
| --- | --- | --- | --- | --- | --- | --- |
| #27 | 统一 Production DataTable(Search/Filter/Sort/Pagination/Selection/Batch/Column visibility/Sticky/Row menu/Density/空/载/错态) | DataTable(HeroUI Table=RAC 底座)+ Pagination + 空/载/错态(R001 §4.4);BulkActionBar 已有(R001 §4.4) | 部分满足 | 列可见性/密度/Sticky/Row menu 未建;Selection+Batch 需要真实批量后端(sessions.revoke 批量可用,R002 §5.2;其余无批量 operation) | 补齐:DataTable 增强列可见性/密度/Sticky/Row menu;批量操作仅对真实后端(会话吊销)实现,其余按 #69 不可 fake | `webui/src/ui/index.tsx`、`ui/DataTable` |
| #28 | 统一 Toolbar 模型(Search/Primary filters/Advanced/Clear/Result count),Filter State 同步 URL | 各页自写 Toolbar;列表分页/过滤在组件内 `useState`(R001 §4.5/§4.10-6);后端列表全部支持 typed 过滤+分页(R002 §7.3) | 未满足 | 无统一 FilterBar;URL 状态不同步(刷新丢上下文) | 新增:FilterBar/SearchInput 语义组件 + 列表页 `useSearchParams` URL 同步(数据基础已具备) | `webui/src/ui/index.tsx`、各列表页 |
| #29 | Master–Detail:List+Detail Drawer 优先(User/Role/Permission/Token/Session/Audit/Dependency) | 现状 Detail 多为独立完整页(24 路由逐一页面,R001 §4.1);Drawer 原语已建(R001 §4.4)但业务零采用(未见业务消费者) | 部分满足 | 统一 Master–Detail 模式未在业务落地 | 补齐:核心实体(User/Role/Token/Session/Audit)改用 List+Detail Drawer,保留核心实体的深链(path 或 ?selected=) | 各业务列表页 + `ui/Drawer` |
| #30 | 标准 Drawer(Header/Metadata/Actions/Tabs/Content/Footer;480/560/640/720) | Drawer 原语存在(R001 §4.4);宽度档/结构模板未规范 | 部分满足 | 宽度与结构模板需规格化 | 补齐:Drawer 规格化 + 业务采用(与 #29 合并) | `webui/src/ui/index.tsx` |
| #31 | Modal 只用于确认/短表单/破坏性/聚焦决策 | 现状 Modal 用于 ConfirmDialog/ThemeDrawer/RouteSearch(R001 §4.2/4.4),复杂表单在页面/抽屉 | 已满足 | 边界符合 | — | 无 |
| #32 | 统一 Form Architecture(Label/Description/Control/Helper/Error;字段宽度按数据定义) | 表单全手写 useState+submit(R001 §4.8);Field/SelectField/Check/Switch/FormSubmitActions 原语存在(R001 §4.4/4.8);react-hook-form/zod 声明未用(R001 §4.10-1) | 部分满足 | 无统一 FormField 结构/字段宽度规范;表单库启用与否未决 | 补齐:规范 FormField(Label/Desc/Control/Helper/Error 统一);082 决策 react-hook-form/zod 正式启用(与 lint 无冲突)或移除声明依赖,二选一,禁止悬置 | `webui/src/ui/index.tsx`、`webui/package.json`、各表单页 |
| #52 | 真实 Empty State(发生了什么/为什么/能做什么/动作) | EmptyState(HeroEmptyState)原语存在(R001 §4.4);结构化内容未见 | 部分满足 | 空态文案结构化未统一 | 补齐:EmptyState 结构模板 + 业务文案落地 | `webui/src/ui/index.tsx` |
| #53 | 统一 Skeleton(Table/Panel/Inline Spinner,不用全屏) | ShellSkeleton/PageSkeleton/路由级 Skeleton(R001 §4.2/4.4) | 部分满足 | Table/Panel/Inline 分级 Skeleton 未建立 | 补齐:Skeleton 分级原语 | `webui/src/ui/index.tsx` |
| #54 | 区分 Page/Section/Inline/Action/Permission/Connectivity Error | SystemStatePage 七态(403/404/NI/401/503/REG/ERR)+ RouteErrorBoundary(R001 §4.2);模块级 InlineAlert(R001 §4.4/4.5) | 部分满足 | Section/Inline/Connectivity 分级未系统化 | 补齐:ErrorState 语义组件与分级呈现规范 | `webui/src/ui/index.tsx` |
| #55 | Optimistic UX 谨慎,安全操作等待真实成功 | 现状无乐观更新;表单等待后端 + 409 差异确认(R001 §4.8) | 已满足 | 符合方案「优先等待真实成功」 | — | 无 |
| #56 | 统一 Feedback(Toast/Inline/Banner/Dialog;不滥弹 Toast) | Toast(HeroUI queue)/InlineAlert/ConfirmDialog 均建(R001 §4.4) | 部分满足 | 体系具备,使用规范未固化 | 补齐:Feedback 分层规范(design 文档)+ 采用审计 | `docs/development/webui.md` |
| #57 | Danger Zone 完整危险操作设计(后果说明/确认/标识符确认/失败恢复) | 危险操作(archive/revoke/reset)用 ActionTrigger+ConfirmDialog(R001 §4.4/4.7);无统一 DangerZone 组件 | 部分满足 | 危险操作流程未统一封装 | 新增:DangerZone 语义组件(后果说明+确认步骤) | `webui/src/ui/index.tsx` |
| #58 | 统一 StatusBadge(Active/…/Revoked),Badge 只用于状态与分类 | StatusPill 存在(R001 §4.4);完整状态集与 Badge 边界未系统化 | 部分满足 | 状态枚举未统一;ID/权限码/元数据可能被滥用为 Badge | 补齐:StatusBadge 统一组件 + 状态集映射(对照 080 Token/会话/账号状态机,R002 §4.6/§5.2) | `webui/src/ui/index.tsx` |
| #59 | Interaction States(Default/Hover/Focus/Active/…/Error),Focus 清晰 | RAC/HeroUI 基座自带;键盘圈养/aria-activedescendant(R001 §4.2/4.4) | 已满足 | 基座覆盖 | —(PHASE 10 复核) | 无 |
| #60 | Accessibility(Keyboard/Focus/ARIA/Dialog trap/Escape/Table/Form/Contrast/Reduced) | 焦点圈养+Esc、aria、reduced-motion 已实现(R001 §4.2/4.6);完整逐项 QA 未见 | 部分满足 | Contrast/Semantic HTML 全量核查未做 | 补齐:PHASE 10 a11y QA 检查单(Playwright 可加测) | `webui/e2e/*.spec.ts` |
| #65 | 建立核心 Semantic Components(27 个清单) | 已建:AppShell/Sidebar/Topbar/PageHeader/DataTable/Pagination/StatusPill/EmptyState/ConfirmDialog/Drawer/Skeleton/FormField(部分)/PageSection/StatCard/StatGrid/ActionTrigger/BulkActionBar/DataToolbar/FilterPanel/SectionNav(R001 §4.4) | 部分满足 | 缺:PageToolbar、FilterBar、SearchInput、CodeText、ErrorState、DetailDrawer(业务化)、DangerZone、MetricSummary、HealthIndicator、PermissionMatrix、TreeView、InspectorPanel、LogTable、CodeViewer | 新增/补齐:按方案语义命名补齐缺口组件(业务语义驱动,不建 BlueCard 类) | `webui/src/ui/index.tsx`、`ui/charts.tsx` |
| #66 | Design System 优先于 Page CSS(Token→Primitive→Semantic→Page) | lint-architecture 已强制业务 selector 不进 styles.css、模块不得 import 平台 internal(R001 §4.9) | 部分满足 | 层级护栏已建;业务页面布局仍存在 page 级变体(card-grid) | 补齐:页面迁移收敛到语义组件(与 #14/#34 联动) | 模块 facet 页面 |

### 4.6 业务页面模式(#34–42)

| 方案节 | 要求 | 现状事实(证据) | 判定 | 差距描述 | 建议动作 | 影响文件域 |
| --- | --- | --- | --- | --- | --- | --- |
| #34 | User Management 以 Directory 为核心(搜索/状态/角色/组织过滤;Create 用 Drawer/流程;不用巨大 Card) | AccountsPage 已实现 search/status/role 过滤 + 表格(R001 §4.5/4.7);但呈现为 card-grid(R001 §4.10-6);Create 形态未证实为 Drawer | 部分满足 | Directory 数据能力齐(iam.accounts.list typed filters,R002 §5.2),呈现模式未按 DataTable+Drawer 收敛 | 补齐:迁移为 DataTable + Create User Drawer;组织过滤依赖 account 关联(organization 分配,可选高级过滤) | `internal/module/iam/binding/webui/web/AccountsPage.tsx` |
| #35 | User Detail 按真实能力组织(Overview/Roles/Sessions/Security/Activity),能力不存在不伪造 | Roles 替换/Status/Pwd Reset/Archive 在 AccountsPage 行操作(operation 齐全,R002 §5.2);Sessions 独立页(/admin/sessions,R001 §4.1);无用户级 Activity 明细后端(审计只有 subjectHash 摘要,R002 §5.1) | 部分满足 | 无 User Detail 聚合视图(Overview/Roles/Sessions/Security);Activity 无真实数据 | 补齐:新增 User Detail Drawer 聚合 Roles/Sessions/Security;**Activity 判不可实施**——后端无 user activity timeline,按 #69 重述为省略或「不可用」态 | `internal/module/iam/binding/webui/web/*` |
| #36 | Role List/Table + Role Detail(Overview/Members/Permissions) | RolesPage 存在(R001 §4.1);后端 roles.permissions.read/roles.accounts.list 影响分析齐全(R002 §5.2) | 部分满足 | Role Detail 聚合形态未证实(可能内联) | 补齐:Role Detail Drawer(Roles/Members/Permissions,数据全真实) | `internal/module/iam/binding/webui/web/*` |
| #37 | Permission Catalog(Search/Domain/Action/Description/Used by Roles),技术 ID 用 monospace secondary | PermissionsPage 存在(R001 §4.1);iam.permissions.list 全量无分页 + permissions.roles.list 影响分析(R002 §5.2) | 部分满足 | 目录页形态未证实;Used by Roles 引用未证实呈现;技术 ID 非 monospace(缺 CodeText,#21) | 补齐:Permission Catalog 用 DataTable+CodeText;启用 permissions.roles.list 影响分析(数据真实) | `internal/module/iam/binding/webui/web/*`、`ui` |
| #38 | Permission Matrix 按真实 Taxonomy 生成,不硬套 CRUD | 权限模型是 23 权限键按 owner 分组(R002 §4.7);角色权限分配为全量替换 PermissionKeys(R002 §5.2) | 部分满足(需重述) | 方案允许「按真实 Taxonomy 生成对应 Matrix」;应呈现为按模块分组的权限键矩阵(选中态),非 CRUD 网格 | 重述:实现为分组 Permission Matrix(owner 模块→权限键→勾选),基于 iam.roles.permissions.replace 全量替换语义 | `internal/module/iam/binding/webui/web/*` |
| #39 | API Token 创建工作流(Identity→Expiration→Scopes→Review→Create→Reveal) | 080 已实现权限知情创建 + 明文一次展示(R001 §4.10-6;R002 §4.6/5.2);创建为管理页表单/弹窗 | 部分满足 | 闭环能力齐;是否多步 Wizard 取决于 080 形态(「复杂功能可作入口不作实操页」) | 补齐(可选):评估将 Token 创建收敛为 Drawer 工作流;保持 scopes⊆创建者权限硬约束 | `internal/module/iam/binding/webui/web/ApiTokensPage.tsx` |
| #40 | Scopes 按 Domain 分组 + Search/Read-only preset/Clear | 权限知情创建强制 scopes⊆创建者权限(R002 §4.6);按 Domain 分组呈现未证实 | 部分满足 | scope 分组/搜索辅助未证实 | 补齐:Scope 选择区按 owner 模块分组 + 搜索(数据=创建者可投影权限,真实) | `internal/module/iam/binding/webui/web/*` |
| #41 | Secret 只展示一次,不假装可再读 | 明文仅创建/轮换一次(R001 §4.10-6;R002 §4.6 secret 只存 sha256) | 已满足 | 一致 | — | 无 |
| #42 | Token List(真实字段)+ 基于 Backend 的 Actions | iam.api-tokens.list + disable/enable/rotate/revoke/update 全套(R002 §5.2);ApiTokensPage 用 DataTable(R001 §4.8) | 已满足 | 字段与操作均为真实 API | —(复核 Last Used 等字段以 API 为准) | 无 |

### 4.7 Ops 与监控(#43–46)

| 方案节 | 要求 | 现状事实(证据) | 判定 | 差距描述 | 建议动作 | 影响文件域 |
| --- | --- | --- | --- | --- | --- | --- |
| #43 | Operations Overview(Environment/Health/Version/Uptime/Last Refresh/Refresh/Time Range) | 081 已实现 1Panel 式健康横幅/指标卡/组件表/AxisLineChart(R001 §4.4/§4.10-5、R002 §8);Dashboard 页(R001 §4.1) | 部分满足 | 顶栏 Context(Environment/Version/Uptime/Time Range)未证实齐备 | 补齐:Dashboard 顶部 Context 行(数据来自 /management/build+diagnostics,R002 §8,真实) | `internal/module/ops/binding/webui/web/DashboardPage.tsx` |
| #44 | Operations 信息层级(五层:Health/请求…、Trend、Dependencies、Instances、Host) | 081 实现:组件状态+滚动窗口趋势(5s×60 点)+ 磁盘/网络未接入+node-exporter 指引(R001 §4.10-5;R002 §8 无 Dependencies/Instances 数据) | 部分满足 | Dependencies/Instances 层级无真实数据;Host Resources 依赖 node-exporter(非本后端提供) | 补齐:对无数据层级呈现「未配置/不可用」态;不 fake 图表 | `internal/module/ops/binding/webui/web/DashboardPage.tsx` |
| #45 | 绝不伪造监控数据 | 未接入态用「未接入+指引」而非假图(R001 §4.10-5、§4.5 available/degraded/unavailable 语义) | 已满足 | 符合 | —(红线持续) | 无 |
| #46 | 区分 Failure/Unavailable/Unsupported/Not configured/No data/No history/Permission denied | 现状区分 available/degraded/unavailable(R001 §4.5) | 部分满足 | 七类语义状态未系统化(UNAVAILABLE vs NOT_CONFIGURED vs NO_DATA 呈现一致) | 补齐:语义状态分类与呈现规范(与 #54/#58 联动) | `webui/src/ui/index.tsx`、ops 页面 |

### 4.8 Organization / Audit(#47–49)

| 方案节 | 要求 | 现状事实(证据) | 判定 | 差距描述 | 建议动作 | 影响文件域 |
| --- | --- | --- | --- | --- | --- | --- |
| #47 | Organization:Tree+Detail(名称/父级/成员/岗位/元数据);Move/Reorder/Archive 仅后端支持时 | departments.tree 无环树后端(R002 §5.3);/admin/departments 路由与 DepartmentsPage(R001 §4.1/§4.5);Move/Reorder/Archive 无后端保护证据 | 部分满足 | Tree 前端视图未证实;Detail 聚合(成员/岗位)依赖 assignments.get(R002 §5.3,真实) | 补齐:TreeView+Detail 呈现;Move/Reorder/Archive 无后端→不展示或禁用(禁止 fake) | `internal/module/organization/binding/webui/web/*`、`ui/TreeView` |
| #48 | Audit Log 设计为 Log Explorer(Search/Actor/Action/Resource/Result/Date Range),点击开 Detail | /admin/audit 页(R001 §4.1);后端过滤 operation/action/outcome/actorKind/subjectHash/resourceType/since/until 全支持(R002 §5.1) | 部分满足 | 页形态未逐页通读;Audit 无 Detail 视图 | 补齐:复核/重排为 Log Explorer;新增 Audit Event Detail | `internal/module/auth/binding/webui/web/*` |
| #49 | Audit Detail:Event ID/Timestamp/Actor/Action/Resource/Result/Request metadata/Related metadata + JSON 代码展示 | 无 audit 详情页/Drawer(路由清单无,R001 §4.1);后端审计低敏化:subject/resource 只返回 hash 摘要,无完整 request metadata(R002 §4.1/§5.1) | 未满足(部分字段需重述) | Detail 视图缺失;request metadata 等字段后端不存在 | 新增:AuditDetail Drawer(Event ID/时间/操作/结果/摘要字段 + CodeText/CodeViewer 展示 hash 元数据);**Request metadata/Related metadata 判不可实施**——低敏审计不存,按 #69 重述为仅展示返回的摘要字段 | `internal/module/auth/binding/webui/web/*`、`ui/CodeViewer` |

### 4.9 全局交互与 URL 状态(#51、#72)

| 方案节 | 要求 | 现状事实(证据) | 判定 | 差距描述 | 建议动作 | 影响文件域 |
| --- | --- | --- | --- | --- | --- | --- |
| #51 | Command Search:Page Navigation 优先,如架构允许再支持实体检索(Users/Roles/Settings/Resources),Ctrl/Cmd+K | RouteSearch 已实现:Cmd/Ctrl+K、按标题/path 过滤、仅列出可访问路由(R001 §4.2/§4.1 深链约定) | 部分满足 | 已满足 Page Navigation;实体检索未做(需跨模块检索架构) | 补齐:Command Search 入口常驻化(#13);实体检索为扩展项——用户/角色等列表 API 支持 query(R002 §5.2),但跨模块统一检索架构需 design 决策,列为候选 | `webui/src/components/RouteSearch.tsx`、AppHeader |
| #72 | URL State:列表过滤/分页 URL 化,Detail 深链,Refresh/Back/Share 稳定 | 深链以 path 为主(settings/admin 页面),OpenAPI 用 ?op=&mode= 深链+popstate(R001 §4.1);列表过滤/分页在组件内 useState,未 URL 化(R001 §4.5) | 部分满足 | 列表页过滤/分页刷新丢上下文 | 补齐:列表页 query 参数 URL 同步(与 #28 合并实现) | 各列表页 |

### 4.10 实施流程与验收(#75、#78–79)

| 方案节 | 要求 | 现状事实(证据) | 判定 | 差距描述 | 建议动作 | 影响文件域 |
| --- | --- | --- | --- | --- | --- | --- |
| #75 | 10 Phase 实施顺序(Audit→Architecture→Design Foundation→Shell→Core UI→Page Patterns→Business Migration→Workflow→System States→Polish) | R001/R002 已完成 PHASE 1–2 产物;PHASE 3–10 均为待实施面 | 候选(实施规划) | 无 gap;是 082 任务切片依据 | 记录:082 tasks 按此 Phase 切片,并映射差异矩阵建议动作 | `docs/changes/082/tasks.md` |
| #78 | 最终视觉标准(清晰层级/高信息效率/克制/一致性/开发者精度) | 无量化现状 | 候选 | 验收性愿望 | 记录:作为 082 验收标准 | `docs/changes/082/requirements.md` |
| #79 | 最终产品标准(完整 Administration Product 而非 API 可视化) | 现状已是 Admin Shell(能力聚合),产品完整度待迁移后验收 | 候选 | 验收性愿望 | 记录:作为 082 叙事目标 | `docs/changes/082/requirements.md` |

### 4.11 方案新旧编号映射(commit `3b758bd` 重构为 81 章后)

方案文档于 commit `3b758bd` 由 80 节(数字编号)重构为 81 章(中文编号)。差异矩阵及以上各节引用均为重构前的节号;本章节给出旧编号 → 新章节的完整映射,供 requirements/design/tasks 落点校对。新方案新增、旧版无对应独立章节的要求已在 requirements.md 以「新增自新版方案」标注。

| 旧节号 | 新版章节 | 对齐说明 |
| --- | --- | --- |
| #01–03 | 三 不要先改 UI、四 扫描现有 Backend Capability、五 扫描现有 Frontend Capability、一 核心原则(原则 B) | 扫描/映射/后端≠页面方法论 |
| #04 | 二 最终目标、七 达到主流成熟项目标准 | 定位与标准 |
| #05–06 | 十六 禁止 Card-first UI、十五 Admin 页面必须 Data First | Card 取舍合并 |
| #07–09 | 八 重新建立 IA、九 导航不暴露后端模块结构、十二 不要继续使用全局页面 Tabs | 信息架构与导航 |
| #10–13 | 十 重新建立 App Shell、十一 Sidebar、十三 Top Bar | Shell 三件套 |
| #14–16 | 十四 统一 Page Architecture、五十五 Responsive、五十二 Density | 页面解剖与响应式 |
| #17–21 | 四十七 Design System、五十 Color、五十一 Typography、五十三 Radius、五十四 Shadow | Token/风格(monospace 在 五十一) |
| #22–25 | 五十三 Radius、五十四 Shadow、五十二 Density | 克制视觉 |
| #26 | 十四 统一 Page Architecture(Actions 区)、二十六 Permission-aware Frontend | 按钮层级并入 Page 模板与权限动作 |
| #27–32 | 十七 建立 Production DataTable、十八/十九 Search/Filter、二十 URL 也是 Frontend State、二十一 Master–Detail、二十二 Detail Drawer、二十三 Form System、二十四 Create Flow | 核心基础设施 |
| #33 | 四十六 Settings | 设置收敛 |
| #34–42 | 四十 User Management、四十一 Role Management、四十二 Session Management(新章节)、四十三 API Token Management、二十七/二十八 Permission UX/Matrix | IAM 页面模式 |
| #43–46 | 三十七 Runtime/Operations、三十八 不要伪造监控、三十九 区分状态语义 | Ops 与状态 |
| #47–49 | 四十四 Organization、四十五 Audit Log | 组织与审计 |
| #50 | 八/九 IA 与导航原则 + 082 REQ-082-019(菜单管理核查) | 菜单管理在新版并入导航原则,实施落点以真实 navigation 模块能力为准 |
| #51–58 | 五十七 Command Search、二十九/三十/三十一/三十二 状态/Loading/Empty/No Results、三十三/三十四 Error 架构与不倾倒、三十五 Feedback、三十六 Destructive | 状态与反馈体系 |
| #59–61 | 五十六 Accessibility、四十七 Design System(motion)、一 核心原则 | 交互态/a11y/动效并入 |
| #62–64 | 四十八/四十九 视觉方向/品牌视觉、十一 Sidebar(品牌区)| 品牌与 Footer 收敛 |
| #65–66 | 五十九 核心组件层、六十 组件必须是 Semantic Component、五十八 Frontend Engineering Standard | 组件体系 |
| #67–72 | 六十一 兼容现有技术栈、六十二 保留真实 Backend Contract、六十五 但禁止虚构业务数据、二十五 Mutation 必须完整、二十六 Permission-aware Frontend、二十 URL 也是 Frontend State | 红线与闭环 |
| #73–74 | 七十八 最终验收标准、六十七 前端能力补齐原则 | 验收与补齐 |
| #75 | 七十六 实施顺序 | Phase 顺序 |
| #76–77 | 六 不要按照旧页面重构 | 删除旧 UI/不按截图 |
| #78–80 | 七十九 视觉验收、八十 最终产品模型、八十一 最终执行指令 | 验收与执行 |

新版新增的独立章节(旧版无直接对应,082 已作为新增 REQ 吸收):二十四 Create Flow(并入 REQ-082-012 创建流程选型)、三十二 No Results(并入 REQ-082-002)、三十四 Backend 错误不倾倒(REQ-082-010)、四十二 Session Management(REQ-082-021)、六十三 Frontend Adapter Layer(REQ-082-011)、六十四 Frontend 可以比 Backend 更聪明(REQ-082-011)、六十六 Progressive Disclosure(REQ-082-011)、六十八 不要过度设计(非目标)、六十九 复杂度匹配(非目标)、七十 性能(REQ-082-009/025)、七十一 Query/Mutation 体系(REQ-082-009)、七十二/七十三/七十四 三层 QA(REQ-082-024)、七十五 不要保留后端管理页面思维(目标叙事)、七十七 每模块 Capability Review(tasks 完成条件)。

---

## 5. 逐项判定与理由(要点展开)

- **已满足(28 节)**:#01、#02、#03、#08、#10、#22、#23、#24、#26、#31、#33、#41、#42、#45、#55、#59、#61、#63、#64、#67、#68、#69、#70、#71、#74、#76、#77、#80(R001 §4.1–4.7 任一项直接支撑;其中 #67/68/69/70/71 为红线段,已在 §4.1 展开)。
- **部分满足(42 节)**:#05、#06、#07、#09、#11、#12、#13、#14、#15、#16、#17、#18、#19、#20、#25、#27、#30、#32、#34、#35、#36、#37、#38、#39、#40、#43、#44、#46、#47、#48、#50、#51、#52、#53、#54、#56、#57、#58、#60、#65、#66、#72。共性:能力底座或机制已存在(R001 §4.4 原语清单、§4.6 token),缺语义组件化、业务采用或规格化。
- **未满足(4 节)**:#21(CodeText/monospace 原语)、#28(统一 FilterBar+URL State)、#29(Master–Detail 业务采用)、#49(Audit Detail)。
- **候选(6 节)**:#04/#62(设计愿景输入)、#73/#78/#79(验收标准输入)、#75(实施规划输入)——均为愿景/标准类,无代码 gap,记录供 requirements/design/tasks 引用。
- 合计 28+42+4+6 = 80,全部方案节已归属。

## 6. 与已验证边界冲突清单(需否决或重述)

| 方案要求 | 冲突边界 | 裁决 | 理由 |
| --- | --- | --- | --- |
| #69/#45/#35/#44/#49 涉及的「必须有」的数据(用户 Activity、Audit request metadata、监控 Dependencies/Instances、Host Resources 图表、批量操作) | AGENTS 禁止 Fake + 托管链拒绝 mock(R001 §4.5/§4.10-8);R002 §5.1/§8 证明这些数据后端不存在 | **否决**(不实现该数据视图),重述为「省略或展示不可用态」 | R002 §5.1 审计只返回 hash 摘要;§8 无 Dependencies/Instances node-exporter 属宿主机职责;方案 #69 自身即红线 |
| #27 批量操作(Selection→Batch) | 后端无批量 mutation(IAM 仅 sessions.revoke 按 IDHashes 批量,R002 §5.2;其余 CRUD 单条) | **重述**:批量 UI 仅对 sessions.revoke 真实实现;其余对象的批量选择不提供或禁用 | 数据/能力不存在,按 #70 禁止假交互 |
| #07 Developer 分组(API Documentation)与 Governance 分组(Audit) | 无已验证边界冲突;仅与现状 IA 平铺不同(R001 §4.1) | **重述**(不否决):调整属于 manifest 菜单声明,可实施 | 不新增能力,仅归位 |
| #09 移除 tab strip | 现状 WorkspaceTabs 是 059/071 已实现且测试的功能(R001 §4.2),但无 ADR 锁定;不属 062/068/069 已验证技术边界 | **重述**(082 决策点):requirements 明确去留,去掉则删除组件与测试(单轨 3.8),保留则注明与方案 #09 的偏离理由 | 避免「保留+宣称符合」双轨 |
| #47 Move/Reorder/Archive(Drag & Drop) | 后端无移动/归档保护(只 create/update,R002 §5.3);archive 无操作 | **否决**(不做 DnD/Archive UI),重述为树+详情只读编辑 | 方案 #50/#47 均要求「仅真实支持时允许」 |

不构成冲突(明确兼容)的边界:静态插拔(062,方案未要求微前端)、HeroUI 单轨(068,方案 #67 保留栈)、overlay 自绘边界(069,方案 #31/65 现原语满足)、当前 authority styles.css(#66 的 lint 已强制)、i18n 红线(方案所有文案要求与 lint-i18n-contract 一致)。

## 7. 可落地范围建议(082 真正落地项)

按「有真实数据 + 数量可控 + 收益可验证」筛选,分三档:

### 7.1 平台底座(优先,工作量 L,一次性投入长期复用)
对应差异矩阵「新增/补齐」的语义组件与机制:
- DataTable 增强:列可见性、密度、Sticky、Row menu(#27);批量操作仅 sessions.revoke(#27/#69)。
- FilterBar + SearchInput + 列表页 URL State 同步(#28/#72)。
- FormField 规范化与表单架构决策(RHF/zod 启用或移除,#32)。
- 状态体系:EmptyState 结构化(#52)、ErrorState 分级(#54)、StatusBadge 全状态集(#58)、DangerZone(#57)。
- 语义组件补齐:CodeText/CodeViewer(#21/#65)、TreeView+InspectorPanel(#47/#65)、LogTable(#48/#65)、DetailDrawer 规格化(#30/#65)、PermissionMatrix(按真实 taxonomy,#38)。
- Token 补齐:font.*/control.*/info/success(#17/18/20/25);Typography/字体栈(#20)。
- Command Search 入口常驻化(#13/#51 前半)。

### 7.2 页面模式迁移(工作量 M,逐模块)
- IAM:Accounts Directory(DataTable+Create Drawer,#34)、User Detail Drawer(#35,Roles/Sessions/Security 聚合)、Role Detail Drawer(#36)、Permission Catalog+影响分析(#37)、Scope 分组选择(#40)。
- Audit:Log Explorer 复核 + AuditDetail Drawer(#48/#49)。
- Ops:Dashboard Top Context 行(#43)、无数据层级不可用态(#44/#46)。
- Org:Tree+Detail(#47)。
- Navigation:Tree+Inspector 复核(#50)。
- IA 归位:audit/openapi 菜单分组(#07),WorkspaceTabs 决策(#09)。

### 7.3 打磨与验收(工作量 S,收尾)
Motion/a11y/响应式复审(#12/16/59/60)、视觉密度档复核(#15/25)、E2E 补充(a11y 清单,§4.5/#60)。

### 7.4 工作量层级判断
- **平台底座 = 一次投入的架构与组件层**(PHASE 3–5),是 082 的主体工作量与最大收益项;
- **页面迁移 = 每页中等的业务工作**(PHASE 6–7),依赖底座先就绪;
- **打磨 = 低-中**(PHASE 9–10)。
- 禁止把 i18n/owner/lint 三护栏揉进底座一次性重写——护栏属既有约束,扩展语义组件时同步更新 `docs/development/webui.md`。

## 8. 拒绝项与理由

| 拒绝项 | 理由 |
| --- | --- |
| User Detail 的 Activity timeline(#35) | 后端无用户活动明细(R002 §5.1 审计仅摘要且面向审计过滤),违反 #69 禁止 Fake |
| Audit Detail 的 Request metadata/Related metadata 字段(#49) | 低敏审计不存完整元数据(R002 §4.1),只展示返回摘要字段 |
| Ops Dependencies/Instances 层级图表(#44) | 后端无此数据(R002 §8);Dependencies 列表不存在,Instances 单进程无实例概念 |
| Host Resources(磁盘/网络)实时图表(#44/#43) | 需宿主机 node-exporter,非本后端提供(R002 §8);呈现「未配置+指引」 |
| Organization Move/Reorder/Archive DnD(#47) | 后端只有 create/update(R002 §5.3),无移动/归档能力 |
| 全局实体检索(Command Search 的 Users/Roles 实体级,#51 后半) | 需跨模块统一检索架构,属 design 决策;当前仅路由检索有真实数据面,实体检索列为候选 |
| 多实例/多控制台 Workspace Tabs(#09 条件) | 后端为单进程视角(R002 §10 不适用多实例),无真实多实例场景,候选 |
| 移除表格批量操作的「假批量」(#27) | 无批量后端时展示批量 UI = Fake,违反 #69/#70 |

## 9. 局限

- 判定基于 R001/R002 静态审计快照;个别页面形态(menus 页、audit 页、roles 页、permissions 页、organization 部门页)未逐页通读(R001 §8 局限),标注「复核」的建议动作需在 082 开始前补一轮页面级核对。
- 未运行构建/测试/浏览器验证;视觉类判定(active state、克制程度、密度档)以「机制存在」为准,数值复核归 PHASE 10。
- DataTable 现有能力边界(HeroUI v3 Table 具体支持列)以 R001 §4.4 记载为准,未在浏览器实测。
- WorkspaceTabs 的「去留」是产品决策,本档案只指出双轨风险,不替 082 拍板。

## 10. 剩余未知

- IAM accounts 是否需要在 Directory 中增加 organization 维度过滤(organization 分配数据存在,R002 §5.3,但账号列表 API 仅 query/status/archived/roleId,R002 §5.2)——高级过滤需前端组合或后端扩展,需 082 design 裁定。
- iam.sessions.list 的 accountId 管理员语义边界(R002 §12)——影响 User Detail Sessions 视图的权限呈现,需后端复核。
- 各列表页当前「自写 Toolbar」的具体差异面(未逐页盘点),决定 FilterBar 迁移清单。
- risk:react-hook-form/zod 启用会改变全部表单实现面与测试基线(Vitest 151+Playwright 22),082 需评估回归成本后再决策。

## 11. 对 082 requirements/design/tasks 的影响

1. **requirements.md**:以差异矩阵为逐项输入——「已满足」项写入非目标(明确不重做,防止范围蔓延);「部分满足/未满足」项转为功能需求;「候选」项写入愿景/验收;「否决」项写入非目标并引用本档案裁决。新版方案新增的独立章节(Query/Mutation、Backend 错误分类、Frontend Adapter、Session 管理、Token 成熟管控、三层 QA、复杂度匹配)以「新增自新版方案」REQ-082-009..011/021/022/024 吸收;验收标准采用方案「七十八/七十九/八十」五问标准(旧 #73/#78/#79)。
2. **design.md**:平台底座与页面迁移两阶段,含 Query/Mutation 统一层与 Adapter 层数据流;显式记录 6 个决策点——WorkspaceTabs 去留(方案「十二」/旧 #09)、表单库启用/移除(方案「二十三」/旧 #32)、DataTable 增强边界(方案「十七」/旧 #27)、IA 归位(方案「八」/旧 #07)、Command 实体检索是否立项(方案「五十七」/旧 #51)、Query/Mutation 统一层推行范围(DEC-082-006,新增)。
3. **tasks.md**:任务切片按「底座→迁移→打磨」三档编号;每条任务标注来源方案新章节与差异矩阵建议动作;红线段(兼容 Backend Contract、保留权限/安全语义、禁止虚构数据、Mutation 真实闭环、兼容技术栈=原则 A/B)不接受拆解与删除;测试回归基线 Vitest 151+Playwright 22 作为每个已完成任务的验收底线。
4. **文档同步**:任何语义组件/token/导航变化与 Query/Mutation 契约必须同步 `docs/development/webui.md` 与 `documentation-impact.yaml`(单轨);HostNavigation README 滞后项(R001 §4.10-2)属纯文档清理,可并入 082。
5. **范围裁剪结论**:082 不做后端能力扩展(R002 §13-1/4)、不做多实例/远程模块(候选)、不为 Audit/User 伪造数据(否决)、不为「成熟」过度设计(方案「六十八/六十九」);后端 55 operation/23 权限键是页面↔operation 映射的唯一事实来源。