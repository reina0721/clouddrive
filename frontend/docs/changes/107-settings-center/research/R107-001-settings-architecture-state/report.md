# R107-001 设置中心当前架构与能力缺口快照

## 研究问题

在新增独立 `/settings` 设置插件与配套能力（页面标签、通知中心、本地草稿、搜索历史、
收藏/最近、工作状态恢复、命令/快捷键、离开确认）之前，需要一份**可复核的当前事实基线**：
现有偏好页真实行为、Shell 与插件与 Host 的归属与装配、生成与门禁流程、以及目标能力中
哪些已经存在、哪些缺失。本记录回答"当前是什么"，不回答"应该怎么做"（后者见
R107-002 与 R107-003 及 design/）。

## 方法与范围

- 只读勘察：4 个并行 subagent（Shell/Host/Plugin 现状、Universal/DS/state-foundation
  清单、Showcase/依赖/校准基线、docs authority/门禁/序号）+ 委托方对关键文件逐文件核实
  （app-shell、navigation-lifecycle、providers、route-transition、shell store、
  surface shell accordion、SettingsLayout、DataTable、form-field、overlays、state-foundation
  config/storage、design-system tokens/schema、codegen、navigation-groups/icon 等）。
- 快照：revision `77740c19`，工作区干净；研究日期 2026-09-06。
- 范围：`frontend/`（React 19 + HeroUI v3.2.4 + Tailwind v4 + Next 16 monorepo）。
- 不访问网络（TailAdmin 外部复核是 SET-002 的独立动作，不在本快照内）。

## 证据（事实）

### 1. system-tools 偏好页现状

- `surfaces/plugins/system-tools/`：`plugin.ts` 声明 `{pluginId:'system-tools', mount:'/system-tools'}`；
  `plugin.navigation.ts` 在 group `system` 下注册纯 Disclosure Parent `system-tools.root`
  （iconId `settings`，无 routeId）+ 2 Child：`system-tools.icons`、`system-tools.preferences`。
- `routes/preferences/page.tsx`（'use client'）：form-foundation 表单（interfaceName TextField、
  locale SelectField、density ToggleGroup、reduceMotion SwitchField），submit 唯一真实副作用 =
  `usePluginLocale().changeLocale` 写 Host locale + `useFeedback().notify` 成功提示。
  **density/reduceMotion/theme 不落任何 store、不生效**（页面注释 L24-30 自证：审计结果
  "theme/density/reduceMotion 字段本页不写 store"）。schema = `schemas.ts` zod
  （interfaceName min2/max40、locale enum、density enum comfortable|compact、reduceMotion bool）。
- i18n namespace `systemTools.*`（nav/root/icons/preferences + preferences.*）双语。

### 2. Shell Store 与 Host 装配

- `apps/web/src/state/use-shell-store.ts`：`useShellStore` = `createPersistStore`，
  name **`clouddrive.shell`**、**version 0、无 migrate**（注释：破坏性变更才升 version+migrate）、
  skipHydration、localStorage、partialize 白名单 `{theme, locale, sidebarCollapsed}`、
  onRehydrateStorage → setHasHydrated(true)。字段全集含 mobileNavigationOpen/hasHydrated。
- `apps/web/src/host/providers.tsx`：FrontendI18nProvider > MotionPolicyProvider >
  ViewportRevealProvider > GlobalProgressProvider > RuntimeProviders（rehydrateStore、
  hasHydrated 门控、html.dataset.theme/lang、appI18n.changeLocale 两帧后 hydrated）。
- `apps/web/src/shell/app-shell.tsx`：桌面侧栏 + 移动抽屉 + 顶栏（汉堡/折叠/CommandMenu
  Ctrl+K/locale/theme/账户 MenuButton）。**账户菜单唯一入口硬编码 `{id:'/system-tools/preferences'}`**
  （非 Route Target）。`shell.notifications` 文案键存在但无 UI 入口。
- `packages/state-foundation`：`definePersistConfig` 强制 name 非空、version 非负整数、
  name 须 `clouddrive.*` 前缀（isManagedKey）；storage 默认 createLocalStorage（SSR-safe，
  unavailablePolicy 默认 error 不静默降级）；`rehydrateStore`/`useHydratedStore`/hydration
  lifecycle 齐备。全仓真实 persist 调用点**仅 useShellStore 一个**。

### 3. 侧栏展开状态模型（无跨导航记忆）

- `packages/surface-foundation/src/shell-navigation-accordion.ts`（纯函数）+ `shell-navigation.tsx`
  （React state）：AccordionModel{routeKey, exploration}；顶层共享 root scope；每 scope 至多
  「1 个 active branch + 1 个 exploration branch」；active ancestor（当前 Route 推导）恒展开且
  不可被 toggle 收起；exploration 绑定产生它的 routeKey，真实 Route Commit 后立即失效清空
  （same-route no-op 保留）；收起/替换时 subtree cleanup。Compact Flyout 用 openBranchId（单开）。
- **无持久化**：跨导航/跨刷新不记忆展开菜单——"菜单记忆"是待新增能力（须满足：active
  ancestor 恒可见 + 每 scope 数量约束不破坏）。

### 4. 导航生命周期、离开确认与进度

- `apps/web/src/host/navigation-lifecycle.ts`：`shouldProceedWithNavigation`（同 resolved
  target no-op 短路 + begin）、`completeRouteNavigation`/`cancelRouteNavigation`/
  `failRouteNavigation`、commitResolvedHref；`navigation-progress.ts` begin/complete/cancel/fail
  - 15s 超时兜底；`route-transition.tsx` 串行化 resolved href 比较 → complete、pathname 变化设
    data-route-enter/kind（方向由 data-route-kind + CSS Token 纯 CSS 驱动，不依赖 React ViewTransition）。
- **离开确认缺口**：`packages/form-foundation` `LeaveConfirmationPort{confirmLeave(message):Promise<boolean>}`
  - `requestFoundationFormLeave`；`packages/surface-foundation/form-actions` `requestPageLeave`。
    均**仅契约与测试**——apps/web 与全部 Plugin 页未 import/未提供 confirmLeave 实现；无 beforeunload、
    无统一 leave-confirm Port 装配。

### 5. 插件、分组、生成与门禁

- 8 个插件同构：plugin.ts = `{pluginId, mount}`（pluginId 与目录名解耦）；routes/ 是真实 Next
  App Router 子树；navigation 两种模式（带 routeId leaf Parent / 纯 Disclosure Parent + Child）。
- Group Alias 单一 authority = `surfaces/plugins/navigation-groups.ts`：`system`/`reference`/
  `development`（新增 Group 属 plugins 范围公共 IA 变更）。iconId vocabulary = `surfaces/src/navigation-icon.ts`
  14 项（dashboard/foundations/catalog/action/feedback/async/identity/navigation/data/surfaces/list/
  overlay/states/settings/resource）。
- codegen：`pnpm codegen:plugins` → tooling/plugin-codegen/codegen.mjs（discovery + semantic
  validation + Host capability + preflight 后 mutation）；产物 = generated/catalog + composition +
  plugin-routes shim + apps/web Host adapter（`// @generated` 禁手改）；`codegen:plugins:check`
  freshness 纳入 `pnpm check`；dev 自动 watch reconcile。**新插件/路由/导航只改源文件，无中央登记**。
- `pnpm check` 全链：foundation:check（workspace 分类/依赖方向/contract registry）+
  architecture:check（HeroUI 只许 ui-adapter、arbitrary value/!important 禁、zustand 只许
  state-foundation、surface/plugins 内部禁导入）+ dependency:check + codegen:plugins:check +
  codegen:design:check + lint + typecheck + test + build + performance + test:browser + format +
  docs:check。公共导出登记 `tooling/foundation-contracts.json`（layer/owner/maturity/exports/
  authorityRoutes/evidence，与 package.json exports 逐字节一致）。
- docs:check：docs/README.md 必备章节、8 篇 authority 存在、authority 文件相对链接可解析、
  `docs/changes/README.md` 索引覆盖最大序号（含 "107" 字符串）。

### 6. Design System 与 i18n / form 事实

- `packages/design-system`：唯一事实源 `design-system.schema.json` → schemas/runtime
  `createSchemaRuntime` → 生成 `tokens.css`（受控区段）+ `motion.css`（整文件）；
  `pnpm codegen:design` / `:check`。仅 light/dark（`[data-theme='dark']`）+ **1 套 brand 紫**
  （`--ds-brand:#5d49d6`、soft #eeebff、strong #4e3bc3）；无强调色变体、无 density/字号缩放/
  对比度 token；motion token（--motion-duration-_/distance-_）+ reduced-motion policy
  （data-motion-mode + prefers-reduced-motion media query）已齐；`--spacing-control[-sm|-lg]`、
  `--radius-control`、z-index 栈存在。
- i18n：zh-CN|en；`formatDate/formatNumber/formatRelativeTime`（Intl）；**无周起始/时区/纯日期
  防偏移工具、无 IANA 时区支持、无复数/单位注册**。语言切换 = Host shell store locale →
  appI18n.changeLocale。
- form-foundation：`useFoundationForm`（**shouldFocusError:true 内建 = 校验后聚焦首个错误已具备**）、
  `FoundationForm`/`FoundationControlledField`、dirty 追踪；无 reset 确认、无首字段聚焦 hook。

### 7. 缺失能力核对（grep 全仓）

页面顶部标签、面包屑 UI（BreadcrumbTrail 仅组件，Shell 无消费）、通知中心（FeedbackProvider/
Toast + NotificationCard 存在但无"中心/未读/角标"数据模型与 UI）、收藏/最近、本地草稿、搜索
历史、工作状态恢复、命令注册表、快捷键系统、RAC I18nProvider（DatePicker locale/weekStart 未接）、
Table Resizable/列设置透出、CopyFeedback、TimeInput——均不存在（见 R107-002 缺口清单）。

### 8. 待删除引用面（system-tools preferences 移除时）

system-tools plugin.navigation.ts/i18n.ts/schemas.ts、apps/web i18n/resources.ts
（nav.preferences/shell.preferencesDescription）、app-shell.tsx 账户 MenuButton 项、
e2e/preferences.spec.ts + visual.spec.ts 快照、generated catalog/composition/shims（codegen 自动
收敛）、foundation-contracts state-foundation authorityRoutes `/preferences`、
quality-evidence.md、plugin-framework.md §9/§10 叙述、changes 索引 094/098 等提及
preferences 的历史条目（历史账本不改，仅 authority 同步）。

## 推断（分析，与事实分离）

- 设置从"偏好表单 + locale 副效应"升级为"完整八分类设置中心"需要三类新增承载：
  (a) 产品级偏好领域模型（typed 分类 + 默认值 + migrate 形状）——不能进 Universal（产品语义）、
  不能只进 Host（Plugin 运行时不可 import apps/web）、不能只进 plugin（Shell/其它页也要消费）
  → 落在 Surface 层公共 subpath（如 `@clouddrive/surface/preferences-model`）或等价位置；
  (b) 跨 Host/Plugin 的运行时能力（preferences/notifications/workspace/commands）→ 现有
  Navigation/Locale Port 模式的扩展（plugin-framework client Port/context 或 surface Port）；
  (c) Host 装配 + 展示策略应用 + storage 事件同步 + 失败语义（composition root）。
- 移除 preferences 不是孤立页面删除：账户菜单、Shell i18n、e2e/visual 快照、registry
  authorityRoutes、quality-evidence、plugin-framework authority 都要单轨同步（AGENTS §3.8）。
- HeroUI v3.2.4 已装 Table ResizableContainer/ColumnResizer 与 Calendar firstDayOfWeek；项目
  未透出/未装配 → 走 ui-adapter 语义封装 + 登记，而非新依赖。
- 当前 Host 无"权限/通知 permission/媒体查询/计时器/浏览器生命周期"Port 化注入（除 motion
  policy 的 matchMedia 与 progress 超时）；新增能力（桌面通知 permission、storage 事件、音效、
  周期刷新、beforeunload）应集中在 Host 装配，不散落 Plugin。

## 适用与不适用场景

- 适用：107 设置中心的需求/设计/实施基线；任何触碰 clouddrive.shell、侧栏手风琴、导航
  生命周期、ui-adapter 表格、Group Alias/icon vocabulary、design-system schema 的变更。
- 不适用：后端/账号/跨设备设置；旧 webui 与 070-087 设置系列（对象是 internal/webui，
  对 frontend 无约束，仅历史参考）；新增 Runtime Host；schemas 运行时设置管线（设置运行时
  不使用 packages/schemas API）。

## 局限与剩余未知

- 未做浏览器运行验证（TailAdmin 复核、真实交互）——属 SET-002 的独立前置，本快照不替代。
- 未核实每个 ui-adapter/Showcase 组件的最新视觉证据（PNG 基线）是否仍与当前源码一致；
  SET-002 视觉复核时以 /ui-elements 9 Family 页与 Design Contract 为准。
- 4 套强调色具体色值未定（R107-003/SET-002 从现有 32 位色板选配或新增受控值）。
- page-archetypes/settings 与 page-patterns/detail-settings 是静态演示样板，不含真实设置
  交互；其 SettingsLayout 是唯一真实"设置两栏布局"承载。

## 对当前任务的影响

- 107 的范围与顺序以本快照为实施基线；R107-002 承接"新能力放哪"边界决策，R107-003 承接
  "Design System 怎么扩展"，design/ 承接模块/接口/数据流/生命周期/失败语义。
- 实施入口按 docs/research/README.md 流程：记录快照与 revision，只把与研究边界相交的变更与
  refresh_triggers 比较；命中才定向复核，未命中记录"基线未漂移"直接实施。
