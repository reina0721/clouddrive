# 059 任务清单

## 1. 门禁状态

- 研究门禁：已通过（R001、R002、R003）。
- 计划状态：已确认（2026-08-23 用户确认；仅 059 自身范围被确认，058 工作区变更不在 059 提交内）。
- 实施授权：已获得；可开始下列非文档任务。
- 当前工作区：存在独立 058/RBAC 未提交变更；059 必须避开这些文件并只处理自身范围。
- 实施前置条件：058 当前正在修改 IAM Accounts/Roles 页面及相关 locale/API；开始 `PAGE-059-001` 前必须先确认 058 已收敛到可复核基线，不能覆盖或混合提交其页面变更。Shell/公共 UI 也不得以分批开始为由越过 059 的整体确认门禁。

## 2. 研究与计划

| ID | 任务 | 完成条件 | 状态 |
| --- | --- | --- | --- |
| `RES-059-001` | 复核当前 WebUI 宿主、公共 UI、样式、测试与视觉产物 | R001 区分已实现事实、缺口、推断和局限 | 已完成 |
| `RES-059-002` | 观察 TailAdmin 官方 Vue/React 实现与 React Demo，完成技术/许可适配判断 | R002 给出保留、退役、不引入和不复制边界 | 已完成 |
| `RES-059-003` | 复核模块页面、SDK、Host adapter、Binding/codegen 与可插拔语义 | R003 固定 A/中间契约/B owner，并区分静态装配与 runtime plugin | 已完成 |
| `PLAN-059-001` | 形成需求、设计、文件影响、验证和任务计划 | 固定文档齐全并提交待确认报告 | 已完成 |

## 3. 待确认实施任务

| ID | 依赖 | 任务 | 完成条件 | 状态 |
| --- | --- | --- | --- | --- |
| `BOUNDARY-059-001` | 用户确认 | 固定模块/SDK/Host owner 门禁并补充静态可插拔回归 | 根 Host 无业务页面、ModuleID 特判或手写 module import；普通模块 core 零修改；disabled/removed 模块不进入 registry/Manifest | 已完成；lint-architecture 增加 ModuleID 分支禁止；`TestGenerateWebUIRegistryExcludesDisabledModule` 全链路回归；058 已收敛到 b81b956 基线 |
| `TOK-059-001` | 用户确认 | 整理 design/layout/z-index/motion token 并格式化平台样式 authority | `styles.css` 可逐规则审阅；语义 token 覆盖 light/dark/preset；无业务 selector | 已完成；329 条规则重排为 8 分区、引入 `--shell-*`/`--z-*`/`--motion-*`/surface/border/radius/shadow/spacing token；`--warning`/`--danger` 语义色补全；架构 lint 证实无业务 selector |
| `ARC-059-001` | TOK-059-001 | 拆分 AppShell 视觉区域与 typed props/state owner | 新 `components/shell/*` 职责单一；AppShell 公开边界不变；无 global store/万能 context | 已完成；AppSidebar/AppHeader/WorkspaceTabs/AccountMenu/SidebarMenu/ShellSkeleton 拆分，AppShell re-export 保持测试 import 不变 |
| `SHELL-059-001` | ARC-059-001 | 重构 desktop sidebar、workspace offset、递归 menu 和 collapsed detail | sidebar/content 同步 motion；submenu、active ancestor、collapsed label 与 keyboard 可验证 | 已完成；`--shell-sidebar-current` 统一驱动、子菜单常驻 DOM + grid row 动画 + inert、active inset indicator、anchor 找祖先链测试补齐 |
| `SHELL-059-002` | ARC-059-001 | 重构 Header、WorkspaceTabs、AccountMenu 与 responsive priority | desktop/tablet/mobile 无溢出；search/theme/language/fullscreen/account 仍可访问 | 已完成；AccountMenu 由 `<details>` 迁移到统一 popover dismiss/focus；1000px/720px 断点保留能力；Header/WorkspaceTabs typed props 拆分 |
| `MOTION-059-001` | TOK-059-001, ARC-059-001 | 建立 overlay phase 与 reduced-motion 决策 | search/account/drawer/dialog/toast/mobile/menu 进退场一致；系统偏好与显式偏好通过测试 | 已完成；`overlay.ts` 四态机 + 纯函数测试；`motion.ts` 常量；RouteSearch/Toast 保留 exiting DOM；`effectiveReduceMotion` 合并系统偏好并有测试 |
| `LOAD-059-001` | TOK-059-001, ARC-059-001 | 建立 Shell/Page/Data skeleton 并迁移临时 loading dots | boot/route/table/card loading 几何稳定、aria-busy 完整、无假业务值 | 已完成；ShellSkeleton/PageSkeleton + 公共 `Skeleton` 单轨；跳点 `.page-loading` 与 `pulse` keyframes 删除；locale 文案补齐 |
| `UI-059-001` | BOUNDARY-059-001, TOK-059-001, MOTION-059-001 | 通过项目自有 UI/feedback SDK 统一 Button/Surface/Field/Table/feedback 细节 | SDK 仍按能力分包且只暴露项目类型；Host adapter 实现契约；现有 module 调用方单轨消费新外观 | 已完成；公共 primitive 消费 token/motion；平台层补齐 select/textarea field 语义；sdk/ui、feedback 契约不变 |
| `PAGE-059-001` | UI-059-001, LOAD-059-001 | 由 Auth、Ops、IAM、Organization、Navigation 各 owner 校准自身当前真实页面 | 改动只落在对应 module facet；根 WebUI 无页面副本；surface/form/table/detail/empty/error/loading 一致且业务契约不变 | 已完成（058 收敛后）；Organization/Navigation/IAM 复制的全局 select 样式单轨到平台 field-input；Auth/Ops 已消费 SDK | 
| `DEP-059-001` | UI-059-001 | 再次扫描并退役零消费者 HeroUI | 删除 package 与 lock 记录；旧 symbol/import 搜索为零；不新增替代依赖 | 已完成；`@heroui/react` 从 package.json/lockfile 移除，全仓 import 搜索为零，`pnpm install --frozen-lockfile` 通过 |
| `PERF-059-001` | BOUNDARY-059-001, PAGE-059-001 | 复核 production chunk graph 与冷启动/首次路由网络加载 | 页面保持 async chunk；未访问/无权/disabled 模块不 eager load；不引入 runtime plugin loader 或全量 prefetch | 已完成；build chunk graph 证据保存（evidence/perf-chunk-graph.txt），页面独立 chunk、locale 按语言独立 |
| `TEST-059-001` | BOUNDARY-059-001, SHELL-059-001, SHELL-059-002, MOTION-059-001, LOAD-059-001, UI-059-001, PAGE-059-001, DEP-059-001, PERF-059-001 | 补齐 unit/architecture/i18n/E2E 回归 | 需求 059-001 至 022 均有自动化或构建/浏览器证据；已有 route/access/logout/module flow 不回归 | 已完成；56 单测（含 shell/menu/theme/motion/route-search/app-shell/i18n/ui）通过；lint/i18n/架构/模块 lint 通过；10 个 E2E 全通过 |
| `VIS-059-001` | TEST-059-001 | 生成并人工复核多视口/主题/交互视觉矩阵 | 1440、1024、390 light/dark 与关键 overlay/skeleton 有截图和差异结论 | 已完成；19 张截图生成于本地 `webui/test-results/**`（被 gitignore），覆盖 1440/1024/390、light/dark、sidebar expanded/collapsed、submenu、search、theme drawer、reduced-motion、mobile drawer 与各业务页面；用户已接受当前截图为视觉验收 |
| `DOC-059-001` | VIS-059-001 | 同步 WebUI authority 与变更证据 | `webui/README.md`、`docs/development/webui.md`、documentation impact 与 tasks 证据准确 | 已完成；webui/README、webui.md、documentation-impact.yaml 与 tasks 证据已同步 |
| `GIT-059-001` | DOC-059-001 | 审查、验证并提交 059 | 只 stage 059 文件；Conventional Commit；不 push | 已完成；commit `b36dcc6`，只含 059 文件，未 push |

## 4. 实施顺序

```text
BOUNDARY-059-001 + TOK-059-001
  -> ARC-059-001
  -> SHELL-059-001 + SHELL-059-002
  -> MOTION-059-001 + LOAD-059-001
  -> UI-059-001
  -> PAGE-059-001 + DEP-059-001
  -> PERF-059-001
  -> TEST-059-001
  -> VIS-059-001
  -> DOC-059-001
  -> GIT-059-001
```

同一实施轮可以在已确认范围内迭代视觉 token，但若需要改变 Manifest/Binding、module owner、业务 API、依赖路线、断点策略或新增业务能力，必须退回研究并重新确认。

## 5. 验证矩阵

| 范围 | 命令/证据 |
| --- | --- |
| Generate | `pnpm generate:check` |
| Frontend lint | `pnpm lint`、`pnpm lint:modules` |
| Type/Test/Build | `pnpm typecheck`、`pnpm test`、`pnpm build` |
| Browser | `pnpm e2e -- --workers=1` |
| Performance | production build chunk graph + 冷浏览器 Shell/首个模块 route network 记录 |
| Static total | 根目录 `scripts/Verify-WebUI.ps1` |
| Docs | 根目录 `scripts/Verify-Docs.ps1` |
| Visual | Playwright 固定视口截图 + 人工复核记录 |
| Scope | 旧 HeroUI/import、magic transform、loading dots、宿主业务 selector/页面/ModuleID 特判、手写 module import、模块跨 owner import、业务契约意外改动和 TailAdmin 资产搜索 |
| Diff | `git diff --check`，逐文件审阅 staged diff |

## 6. 重新确认触发器

- 需要新增/修改 Go Manifest、WebUI Binding、业务 API、数据库或权限语义；
- 需要迁移模块页面 owner 或修改普通模块业务行为；
- 需要把当前静态装配升级为运行时远程插件、独立 bundle、热安装/卸载或多发布单元；
- 决定引入 Tailwind、动画库、popover library、第三方 design system 或新全局状态；
- 把 mobile breakpoint 从 720px 改为新的产品断点；
- 需要复制 TailAdmin 源码、品牌、Pro 内容或资产；
- 现有 RBAC 工作区变更与 059 发生文件冲突，无法安全隔离。
