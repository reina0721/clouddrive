# 047 任务清单

## 1. 当前状态

- 研究门禁：已通过（`R001`）。
- 计划状态：已停止；未完成任务不再沿 047 实施，由 [048 全栈业务模块化 WebUI 重构](../048-full-stack-webui-modules/README.md) 取代目标设计。
- 实施授权：047 原授权仅解释已经提交的历史增量，不授权继续修改。048 非文档实施必须在新计划报告后重新确认。
- Git 基线：本轮从 `19b0fa7` 开始；047 采用增量提交，当前分支只保留本任务已审查的提交，不 push。

> 本文件下方“已实施未闭合”“验证中”“进行中”状态冻结为停止时快照，不表示仍应继续执行。未闭合项不得跨任务继承授权。

## 2. 研究与计划

| ID | 依赖 | 任务 | 完成条件 | 状态 |
| --- | --- | --- | --- | --- |
| RES-001 | 无 | 复核 042–046、Contract、Composition、registry、宿主、模块页面、i18n 与能力状态 | R001 区分事实、推断、目标和局限 | 已完成 |
| RES-002 | 无 | 浏览器观察 SoybeanAdmin 并以官方主源交叉核对产品组织 | 登录、首页 Shell、用户列表/筛选、新增 Drawer、403 与主题 Drawer 有 DOM/截图实测；移动观察失败边界明确；形成后续逐任务观察方法 | 已完成 |
| RES-003 | RES-002 | 吸收“宿主本体优先、布局骨架先行、完全参考”的最新用户决策 | 高保真 parity 与不复制源码/品牌/Demo 的边界写入研究、需求和设计 | 已完成 |
| PLAN-001 | RES-001, RES-002, RES-003 | 形成需求、设计、任务和重新确认边界 | 047 固定文档齐全，可供用户确认首次宿主范围 | 已完成 |

## 3. 首次待确认实施任务：布局与骨架

| ID | 依赖 | 任务 | 完成条件 | 状态 |
| --- | --- | --- | --- | --- |
| ARC-001 | 用户确认 | 单轨收敛交付状态与四态运行语义 | `preview` 旧语义删除；权限/交付/运行/交互状态分离；Go/TS 测试覆盖 | 已实施未闭合 |
| GEN-001 | ARC-001 | 扩展 codegen 为 Entry + locale registry | registry/revision 唯一来源；非法/缺失 locale fail closed；clean check 通过 | 已实施未闭合 |
| HOST-001 | GEN-001 | 用 manifest + generated registry 动态建立模块路由 | 宿主无 Auth/Ops import 和集中模块 Route；lazy/error/access boundary 生效 | 已实施未闭合 |
| I18N-001 | GEN-001 | 接入单一 i18next/react-i18next 实例并落实强制 WebUI i18n 契约 | 每个 WebUI 模块声明 locale Binding；模块只使用 `useWebUITranslation(namespace)`；host/module 文案均来自资源；缺失资源可诊断 | 已实施未闭合 |
| I18N-CONTRACT-001 | I18N-001 | 固化 locale owner、message ID、error code -> message ID、无硬编码文案和公开翻译 hook 规范 | `setupErrorMessages` 类映射只返回 message ID；Contract/codegen、静态扫描和运行期边界测试通过；调整后计划已确认 | 已实施未闭合 |
| I18N-LOCALE-001 | I18N-CONTRACT-001, VIS-HOST-001 | 让语言入口消费已装配 locale 并覆盖现有页面 | Header 语言选项来自 registry；`zh-CN`/`en-US` 的 host、Auth、Ops namespace 完整；Shell/overlay 订阅公开 i18n hook；切换和未知语言边界有测试 | 已实施未闭合 |
| MOD-001 | HOST-001, I18N-CONTRACT-001 | 把 Auth/Ops 页面迁回模块 owner，完成宿主骨架所需最小适配并遵守 i18n 契约 | 删除反向 re-export 和宿主具体模块 import；模块只依赖公开宿主契约/UI；所有用户文案走模块 namespace；真实流程行为不扩展 | 已实施未闭合 |
| UI-001 | HOST-001, I18N-001 | 高保真建立 Token、AuthLayout、AppLayout 与响应式 Shell | 侧栏、Header、breadcrumb、workspace tabs、route search、内容 Surface、Footer、用户/主题/语言/全屏入口在桌面/移动与明暗主题通过对照；blank 认证壳也提供 host i18n 驱动的语言/主题入口；Header/页签/Footer 固定且仅页面视口滚动 | 已实施未闭合 |
| UI-002 | UI-001 | 建立页面容器、toolbar、feedback、state、form、table、filter、pagination、Drawer 模式 | 测试 fixture 覆盖状态且不进入生产 manifest/navigation；模块不复制视觉基础 | 已实施未闭合 |
| UI-002-COMMON-001 | UI-002, I18N-CONTRACT-001 | 落地公共管理模式的可复用宿主组件 | `DataToolbar`、`FilterPanel`、`DataTable`、`Pagination`、`EmptyState`、`InlineAlert`、`Toast`、`ConfirmDialog`、`Drawer` 由模块注入翻译/业务内容；toolbar/table/pagination label、列显隐、四态 banner、选择 mixed 状态、加载、空态、分页、筛选 region 语义、Toast 状态播报、ConfirmDialog 焦点边界和 Drawer 焦点边界有测试；不注册 Demo 路由 | 已实施未闭合 |
| VIS-OPS-001 | UI-002, VIS-HOST-001 | 基于最新 Soybean 工作台观察校准已有 Ops Dashboard 的概览层级 | 仅使用六个真实 management 查询；概览统计、加载/失败状态和诊断详情均经 i18n 契约与响应式样式验证 | 已实施未闭合 |
| VIS-OPS-002 | VIS-OPS-001 | 按参考工作台层级分组真实 Ops 查询并补齐刷新交互 | 核心探针/可选诊断分组；整体刷新与失败项独立重试；核心失败为 Unavailable、可选失败为 Degraded；不引入模拟数据或新后端接口 | 已实施未闭合 |
| OPS-CAPABILITIES-001 | UI-002-COMMON-001, VIS-OPS-002, I18N-CONTRACT-001 | 为 Ops 模块增加真实能力清单页 | Ops Binding 声明独立 entry/route/menu；六个真实 management query 形成表格行；搜索、核心/可选筛选、状态/结果摘要、单项重试、分页和 Toast 反馈均有 i18n；无新增后端 wire contract | 已实施未闭合 |
| OPS-CAPABILITIES-002 | OPS-CAPABILITIES-001, UI-002-COMMON-001 | 对照列表到详情操作补齐能力详情 Drawer | 行级“查看详情”打开公共 Drawer，展示当前真实结果、范围和状态；关闭/焦点边界由 Drawer 测试覆盖；失败能力仍可重试，不复制后端规则 | 已实施未闭合 |
| OPS-DASHBOARD-OVERVIEW-001 | VIS-OPS-001, VIS-OPS-002, I18N-CONTRACT-001 | 按 Soybean 工作台层级整理真实 Ops 概览 | 只使用已有 build/diagnostics 查询；构建信息、运行快照、依赖健康和字段缺失状态有结构化 Surface；不生成天气、待办、活动或模拟统计；投影函数与中英文 locale 有测试 | 已实施未闭合 |
| OPS-METRICS-SNAPSHOT-001 | VIS-OPS-001, OPS-DASHBOARD-OVERVIEW-001, I18N-CONTRACT-001 | 对照参考站指标卡补齐真实 Metrics 快照 | 只解析现有 `/management/metrics` 稳定指标；四张指标卡有中英文 i18n、Unavailable/— 缺失语义与响应式样式；无历史数据不绘制伪造趋势；解析函数有测试且原始文本详情保留 | 已实施未闭合 |
| HOST-THEME-001 | UI-001, VIS-HOST-001 | 对照 Soybean Header 补齐宿主一键明暗切换入口 | 复用现有主题 authority；入口有 host i18n、桌面/移动规则明确且不新增第二套状态 | 已实施未闭合 |
| HOST-TABS-001 | UI-001, VIS-HOST-001 | 对照 Soybean 页签行补齐宿主刷新当前页入口 | 刷新动作由宿主基于当前 route 执行；模块不接触页签状态；入口有 i18n 与响应式样式；页签具备 `tablist`/`tab`/`tabpanel` 关联、唯一可 Tab 聚焦项及方向键/Home/End roving focus | 已实施未闭合 |
| HOST-SEARCH-001 | UI-001, VIS-HOST-001 | 补齐 RouteSearch 的键盘与可访问选中态 | 只搜索 manifest 可访问 route；打开/关闭焦点、Tab 循环、上下键、Enter、Escape 和 ARIA 状态通过前端验证；不增加第二套路由注册 | 已实施未闭合 |
| HOST-MENU-001 | UI-001, VIS-HOST-001 | 消费 ManifestMenu.parentId 建立宿主递归导航 | 分组展开、当前路径祖先自动展开、孤立项安全落根；模块只提供 Binding，不改宿主菜单实现 | 已实施未闭合 |
| HOST-MOBILE-001 | UI-001, VIS-HOST-001 | 基于 390×844 参考观察校准移动 Header 与页签密度 | 移动面包屑隐藏、工具区不溢出、页签操作保留、侧栏打开/关闭焦点连续、关闭态不进入键盘路径、桌面规则不回归 | 已实施未闭合 |
| HOST-MOBILE-002 | HOST-MOBILE-001, HOST-THEME-001 | 保留移动端语言与账号入口的紧凑形态 | 语言切换、用户菜单和退出登录仍可访问；移动导航关闭态焦点隔离；不泄漏会话信息，不破坏桌面布局 | 已实施未闭合 |
| HOST-ACCOUNT-001 | UI-002-COMMON-001, I18N-CONTRACT-001 | 将用户菜单退出流程接入宿主确认与失败反馈 | 退出由宿主 `ConfirmDialog` 确认；失败由宿主 i18n `Toast` 低敏呈现；模块不接触账号菜单或全局状态；中英文资源完整 | 已实施未闭合 |
| AUTH-SESSION-001 | HOST-ACCOUNT-001, I18N-CONTRACT-001, VIS-MODULE-001 | 产品化现有 Auth Session 页面 | 只使用真实 WebUISession 字段；状态 Banner、主体/权限/创建摘要、生命周期和 scope Surface 全部通过 Auth locale；未登录状态明确，不新增认证后端能力 | 已实施未闭合 |
| AUTH-SESSION-ACCESS-001 | HOST-001, ARC-001 | 为 Auth Session 补齐模块拥有的查看 operation 与导航 | Binding 声明 `auth.webui.session` operation/menu；Composition 装配到既有 `management:read` policy；manifest 对未认证主体返回 authentication-required；Go/宿主测试覆盖；不新增 Session wire 或写操作 | 已实施未闭合 |
| HOST-DENSITY-001 | HOST-THEME-001, VIS-HOST-001 | 让 ThemePreferences.density 真正驱动宿主视觉密度 | Compact 消费 `data-density` 调整核心容器/控件间距；Comfortable 默认不变；不影响业务语义 | 已实施未闭合 |
| HOST-THEME-002 | HOST-THEME-001, HOST-DENSITY-001 | 按参考主题抽屉补齐宿主布局/通用/预设分区 | 四分区由单一 ThemePreferences 驱动；面包屑、页签、底部、侧栏默认状态和减少动效均真实生效；Drawer 焦点进入/恢复、关闭隔离和键盘操作可验证；主题分区具备唯一 Tab 聚焦项、方向键/Home/End roving focus 与 tabpanel 关联；所有新增文案走 host i18n | 已实施未闭合 |
| BUILTIN-001 | UI-001, ARC-001 | 建立 Theme Drawer、403、404、mismatch 和 not-implemented 宿主页面 | 单一主题 authority；状态一致、错误低敏、解析错误可见；lazy 模块异常落入宿主 route error 状态；不发不存在 API | 已实施未闭合 |
| VIS-HOST-001 | UI-001, UI-002, BUILTIN-001 | 建立 SoybeanAdmin 宿主 parity 矩阵并逐任务动态观察 | 同视口 DOM/截图覆盖 Shell、导航、页签、搜索、主题 Drawer、Surface、状态页、响应式/主题；差异修正或有项目边界理由 | 已实施未闭合 |
| TEST-HOST-001 | ARC-001, GEN-001, HOST-001, MOD-001, I18N-001, I18N-CONTRACT-001, UI-001, UI-002, BUILTIN-001, VIS-HOST-001 | 补宿主 Go/TS/React/E2E/visual/architecture 门禁 | 证明无用户可见硬编码/直接 i18n singleton/穿透/Demo/假能力；error code -> message ID、locale completeness、现有 Auth/Ops 流程和宿主 parity 全部通过 | 验证中 |
| DOC-HOST-001 | TEST-HOST-001 | 同步 WebUI authority 与模块开发指南 | 当前宿主结构、强制 i18n 接入、状态、视觉流程和未完成模块产品化边界进入主题文档 | 已同步未闭合 |
| GIT-HOST-001 | DOC-HOST-001 | 审查并持续提交已确认范围的宿主增量 | 每轮只提交已审查的宿主范围；有完整验证证据；不 push | 进行中 |

## 4. 宿主门禁后的后续任务

下列任务属于当前 Goal 的后续增量，不在首次“布局与骨架”确认范围内。宿主本体完成后应根据当时参考站和真实 API 重新复核；若接口、依赖或边界发生实质变化，另行确认。

| ID | 依赖 | 任务 | 完成条件 | 状态 |
| --- | --- | --- | --- | --- |
| AUTH-001 | TEST-HOST-001 | 产品化 setup/login/session 页面 | 真实 API/Session/CSRF 语义不变；pending/error/success/移动端完整 | 后续 |
| OPS-001 | TEST-HOST-001 | 产品化真实 Ops dashboard | 六类真实数据分层；局部失败 degraded；必要失败 unavailable；可独立重试 | 后续 |
| VIS-MODULE-001 | AUTH-001, OPS-001 | 逐页高保真对照 Auth/Ops | 每页重新观察参考站并形成多断点/主题差异矩阵 | 后续 |
| TEST-MODULE-001 | VIS-MODULE-001 | 完成真实模块 E2E 与视觉回归 | Auth/Ops 关键流、权限、四态和低敏证据通过 | 后续 |

## 5. 实施顺序与检查点

```text
首次检查点 A（装配骨架）：ARC-001 -> GEN-001 -> HOST-001 -> I18N-001 -> I18N-CONTRACT-001 -> MOD-001
首次检查点 B（布局骨架）：UI-001 -> UI-002 -> BUILTIN-001
首次检查点 C（宿主验收）：VIS-HOST-001 -> TEST-HOST-001 -> DOC-HOST-001 -> GIT-HOST-001
后续检查点 D（真实页面）：AUTH-001 -> OPS-001 -> VIS-MODULE-001 -> TEST-MODULE-001
```

每个任务先完成对应参考页面观察，再实施与验证。后一个任务不得用前一个任务的粗略截图替代自己的页面/交互对照。首次确认只覆盖 A–C；D 不能随 A–C 自动启动。

## 6. 验证矩阵

| 范围 | 计划检查 |
| --- | --- |
| Go Contract/Composition | `go test ./internal/webui ./internal/composition/...`，最终 `go test ./...` |
| Codegen | `pnpm generate` 审查差异；`pnpm generate:check` clean |
| Frontend static | `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build` |
| Architecture | 搜索宿主模块 import/硬编码 route、模块导入宿主内部、生产 Demo、Todo WebUI、旧 `preview` 语义 |
| i18n contract | locale Binding 与 registry 完整性；模块生产 Web 源码无用户可见硬编码；无直接 i18n singleton；error code 只映射 message ID；缺失 key/namespace/language fail closed 或可诊断 |
| E2E | 首次覆盖 manifest 装配、导航/页签/search/theme、权限菜单/直达 403、404、revision/entry/locale mismatch，并证明现有 setup/login/session/Ops 不回归 |
| Visual | 首次覆盖 Auth/App Shell、导航、页签、search、Theme Drawer、Surface、builtin/四态在桌面/移动与 light/dark 的同视口 parity；Auth/Ops 页面产品化后续单独验收 |
| 低敏 | 截图、日志、fixture、错误与提交不含 Token、Cookie、密码、Authorization、内部地址 |
| Diff | `git diff --check`，逐文件审查，只提交已确认范围 |

## 8. 当前实施证据与剩余风险

- 已通过：`go test ./...`、`pnpm test`、`pnpm lint`（包含 i18n contract scan）、`pnpm lint:modules`、`pnpm typecheck`、`pnpm build`、`pnpm generate:check`、`git diff --check`。
- 已通过：模块生产 TSX 无中文/用户可见硬编码、无直接 `react-i18next` import、无 `setupErrorMessages` 展示文本映射；错误码映射测试只接受 message ID。
- 未闭合：浏览器本地视觉回归未完成。Vite 使用项目要求的 HTTPS，但浏览器拒绝本地自签名证书（`ERR_CERT_AUTHORITY_INVALID`）；SoybeanAdmin 参考站 Shell 的 DOM/截图观察已完成，项目页面桌面/移动与明暗主题截图需在受信任证书环境补齐。

## 7. 重新确认触发器

- 新增或改变后端 API、数据库 migration、Auth/Session/CSRF/Origin 或普通业务权限语义；
- 为 Todo 或其他新业务模块增加 WebUI 页面；
- 引入动态插件、远程页面、新全局状态框架或替换前端技术栈；
- 实施发现当前 Binding 无法表达模块页面 owner，必须改变模块边界；
- i18n 规范需要新增或改变 Binding 字段、`@webui/contracts` 公开翻译 API、locale owner、message ID 或静态架构门禁；
- 参考视觉要求演变为复制品牌、源码或不存在的业务能力；
- 计划中的文件影响、依赖选择或外部副作用发生实质变化。
