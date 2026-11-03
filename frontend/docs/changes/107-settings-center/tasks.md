# 107 设置中心 —— 唯一完成清单（tasks.md）

研究基线：`77740c19`（工作区干净，2026-09-06）。状态：研究门禁通过 → 计划**已确认**
（2026-09-06 用户确认，进入 SET-002 起实施）。研究档案：`research/R107-001`（架构快照）、
`R107-002`（能力落点）、`R107-003`（Design System 主题扩展）。只有完成条件满足且证据记录的
任务才能标 `- [x]`；SET-002 的 TailAdmin 外部复核未完成前不得标完成。

## 研究与计划（SET-001）

- [x] `RES-107-001` 建立 R107-001 当前架构与能力缺口快照；证据：research/R107-001
      （report.md + metadata.yaml，revision 77740c19）。
- [x] `RES-107-002` 建立 R107-002 公共能力落点与边界比对；证据：research/R107-002。
- [x] `RES-107-003` 建立 R107-003 Design System 主题扩展与 TailAdmin 复核门禁；证据：
      research/R107-003。
- [x] `PLN-107-001` 产出需求/设计/任务（本目录 README/requirements/design/tasks）并登记
      docs/changes/README.md 107 索引；证据：本目录 + docs:check 通过；状态：已确认
      （2026-09-06）。

## 外部视觉复核与 Design System 扩展（SET-002）

- [x] `SET-002-001` 确认 https://react-demo.tailadmin.com/ 可达性并记录；证据：R107-004 §2.1
      （HTTP 200，2026-09-06，历史超时已恢复）。
- [ ] `SET-002-002` TailAdmin 外部复核（表格 Basic/Data Tables、Tabs、表单 Form Elements、
      通知 Notifications 四组 + ui-visual-calibration §5 全状态矩阵：关闭态→交互态→打开态→
      Light/Dark→中英长文本→三档视口）；证据：R107-004 §2.2-2.6（DOM/控件/标题/通知 tone/
      分页搜索每页 + 截图 01-08）。**剩余（不阻塞设计，阻塞标完成）**：交互态/Dark/长文本/
      三档视口逐项 + 像素级目检与视觉基线人工确认（SET-008 人工门禁）。
- [x] `SET-002-003` 四套强调色（紫/蓝/绿/橙）light/dark 受控色值选配 + 对比度验证（WCAG AA
      on-brand/文字），来源记录；purple = 现 --ds-brand。证据：R107-004 §4 候选对比度 +
      wcag-accent-final.mjs（light brand/white 紫 6.20/蓝 5.17/绿 5.02/橙 5.18；dark
      brand/on 均 AA；soft/ink 与 soft/brand 均 AA——真实产品用法全达标）；色值已入
      schema accents 源（见 SET-002-004）。
- [x] `SET-002-004`（accent 部分）design-system.schema.json 增补 `$defs.accentSource` +
      `tokenSource.accents` 实例（order/roles/palettes 四套 light/dark）+ fact +
      patchable pointer + tokens.css artifact 8 个 accent-* region bindings → `pnpm
codegen:design` 生成 tokens.css `html[data-accent]` 覆盖块（含 purple 默认组）；
      `codegen:design:check` fresh、schemas 50 测试通过、prettier 通过。**消费**：Host
      providers 写 `data-accent`（SET-003-004）——强调色有真实运行时消费者。**剩余**
      （SET-002-004 其余）density/fontScale/contentWidth/contrast 语义增补待后续任务。
- [x] `SET-002-004`（runtime 消费部分）density/fontScale/contentWidth/contrast 真实
      运行时消费者：tokens.css 保留外层 data-* 覆盖（界面字号 root rem 缩放 small/
      large；界面密度 compact/comfortable 重映射 --spacing-control*/--radius-_；内容
      宽度 standard/wide 约束 #main-content；高对比度 high 加强 --spacing-focus-ring_；
      预设数值只由 Design System 管理；与 motion-mode 外层 CSS 同例，runtime-codegen
      原样保留——regen 后仍存 + fresh 通过）；Host providers 写 `data-density/
data-font-scale/data-content-width/data-contrast`（外观设置改动即时生效）。
      证据：appearance-display.spec.ts e2e 4 passed（compact → --spacing-control
      2.25rem；large → root 18px；standard → data 属性；high → 焦点环 .1875rem）；
      gates 全绿（architecture 425）+ visual/settings 19 regression 全过（默认档
      不触发覆盖，基线无漂移）。**剩余**：schema 源语义化（现为 tokens.css 保留
      外层 + 注释；schema `source.tokens` 无 density 等源）——若需 schema 单轨
      权威化待后续设计系统任务。
- [x] `SET-002-005`（列显隐/顺序分片）插件层列设置：`page-archetypes/stores/
column-layout.ts`（独立持久化 key `clouddrive.page-archetypes.column-layout`：
      按 pageId 存 visibleOrder；normalize 过滤已退役列 + workstream 标识列强制首位 +
      **保存序缺失列 = 显式隐藏不补回**）+ resource-list"列设置"对话框（CheckboxField
      显隐 + 键盘可操作 ←/→ 前移后移，标识列锁定；**rememberColumnLayout 门控**：
      开默认 → 进入页面反应式恢复（订阅 store hydration setState 落地后应用），改动
      即存）。证据：column-layout.test.ts 4 tests（normalize 过滤/退役/缺省隐藏/
      持久化/rehydrate 落地）+ column-settings.spec.ts e2e 2 passed（隐藏状态列立即
      消失；重载后仍隐藏）；architecture 421 files + reference/visual/page-size
      19 e2e 全过。**排序记忆落地**：per-page 记录增 `sort` 字段（与 visibleOrder
      合并持久化，互不覆盖）；resource-list 订阅 rememberSort（默认关）——排序
      变化即存、进入页面恢复。证据：remember-sort.spec.ts e2e 2 passed（默认关
      重载回默认；开：工作流升序重载保持）；architecture 422 files + column-
      settings/reference 10 e2e 全过。
      **剩余**：ui-adapter DataTable ResizableContainer/ColumnResizer 列宽封装 +
      /ui-elements Showcase 同步（历史判断已由 109 纠正，见下条）。
- [ ] `SET-002-005`（由 109 接手）安装的 HeroUI 3.2.4 已提供
      `Table.ResizableContainer` / `Table.ColumnResizer`，无需独立 resizable 子路径。
      109 已实现 Adapter、Showcase、稳定 column id 宽度与 v1→v2 兼容迁移；
      当前鼠标/键盘调整和刷新恢复回归通过。完整矩阵及人工视觉确认未完成，
      不以旧阻塞描述或单项测试替代最终验收。见 [109 账本](../109-ui-ux-optimization/tasks.md)。
- [x] `SET-002-004`（109 Schema 权威收尾）density/fontScale/contentWidth/contrast
      原有七个 profile 已进入 `source.tokens.appearanceProfiles`，生成器统一输出
      对应 data-* 区域，数值与优先级保持。Schema 单测、codegen freshness 和当前
      生产构建通过；当前证据见 109 `evidence/check-final.txt`。
- `SET-002-002` 当前补证：应用内浏览器成功打开五个具体页面，已保存 30 张
  Light/Dark × 手机/桌面/超宽截图及选择/翻页/日期打开态；见
  [109 外部矩阵](../109-ui-ux-optimization/evidence/tailadmin-review.html)。
  不再以终端超时描述当前可达性；人工视觉门与未覆盖状态仍明确保留。

## 偏好契约、Host 装配与持久化（SET-003）

- [x] `SET-003-001` plugin-framework 能力子路径（./preferences ./workspace ./notifications
      ./commands 类型契约 + Provider/context/hook，react peer）+ package.json exports +
      foundation-contracts 登记。证据：`packages/plugin-framework/src/{preferences,workspace,
notifications,commands}.tsx`（Preferences Port 含 PersistResult 失败码；Workspace
      页面白名单/冲突不静默覆盖；Notifications 可序列化无函数；Commands 注册/注销/统一
      可用性）+ `capabilities.test.tsx`（8 tests：provider 注入读写/未装抛错/保存恢复
      clear/未读与序列化/注册注销与可用性）；package.json exports ./preferences ./workspace
      ./notifications ./commands + foundation-contracts；framework 38 tests + typecheck +
      foundation/architecture/dependency gates 全绿。dependency-policy 无需改动
      （framework 未新增 runtime 依赖）。
- [x] `SET-003-002` surface 产品偏好模型 subpath（八分类 typed 模型/默认值/边界校验/migrate
      形状）+ exports 登记。证据：`surfaces/src/preferences-model.ts` +
      `preferences-model.test.ts`（14 tests）；surfaces package.json `./preferences-model` +
      foundation-contracts（exports/evidence）；surfaces 33 tests + typecheck +
      foundation/architecture/dependency gates 全绿。**剩余**：搜索 i18n key + synonyms
      目录（属 settings 插件分类文案，随 SET-004 落插件 i18n）。
- [x] `SET-003-003` `clouddrive.shell` version 0→1 migrate（旧 theme/locale/sidebarCollapsed
      保真；无记录用新默认）。证据：`apps/web/src/state/use-shell-store.ts`（v1 嵌套
      preferences + migrate 调 migrateShellV0Preferences + 兼容投影；partialize 只存
      preferences）；`apps/web/src/test/providers.test.tsx`（v0 记录保真迁移 + data-theme/
      data-accent 应用 + version 1 回写）；`shell-store.test.ts`（6 tests：初始/update/
      快捷入口/remember 会话折叠/resetCategory/resetAll）。**剩余**：损坏记录失败语义呈现
      （SET-003-005）。
- [x] `SET-003-004`（Host 装配·完成）Preferences Port 真实实例 + composition root 装配：
      `apps/web/src/host/preferences-port.ts`（createHostPreferencesPort：getSnapshot/
      subscribe/updateCategory/resetCategory/resetAll 落到 shell store，写入抛错→
      PersistResult 失败码 quota/storage-unavailable/write-failed；startCrossWindowSync
      监听 storage 事件，完整快照校验后 applyPersistedPreferences 收敛、损坏快照忽略；
      parseStoredSnapshot 要求含全部八分类 + validatePreferences）→ providers.tsx 挂载
      `PreferencesProvider`（port 单例 + hydration 后启动跨窗口同步）。证据：
      preferences-port.test.ts（3 tests：更新持久化与 resetAll、subscribe、跨窗口收敛与
      损坏忽略）+ providers.test.tsx。**剩余**：Workspace/Notifications/Commands Provider + 独立 AppearanceContext（SET-003-006/SET-005 接续）。
- [x] `SET-003-005`（核心）持久化失败语义 + 跨窗口同步：损坏/未知版本 → migrate 抛错 →
      onRehydrateStorage 写 `hydrationIssue`（呈现层据码显示恢复动作）；写入抛错 →
      PersistResult 失败码（quota/storage-unavailable/write-failed）；storage 事件按完整
      快照收敛、损坏快照不静默覆盖；页签活动独立（无全局写）。证据：store onRehydrate +
      preferences-port classifyStorageError/parseStoredSnapshot + tests。**剩余**：失败/
      损坏记录的**呈现层 UI**（Alert + 恢复动作按钮）与重试，随 settings 插件/SET-004
      （设置页需要呈现"未保存到此浏览器"）与 AppLoading 恢复落地。
- [x] `SET-003-006` Preferences 集成测试：providers.test.tsx 折叠进同一 hydration 的
      运行时链——v0→v1 迁移应用展示策略 + **updateCategory（分类更新）即时应用到
      DOM（data-theme/data-accent）+ v1 持久化回写**（避免跨测试重复 rehydrate 的
      持久化闩锁：persist middleware 的 hydrated 闩锁一次后不可重置，第二次
      rehydrateStore no-op → 跨测试双 hydration 不可行，故同测试内验证）。
      订阅/恢复返回语义在 preferences-port.test.ts 单测覆盖；分类/全部恢复 + 失败
      呈现 + 持久化由 settings.spec.ts e2e 端到端覆盖（恢复默认两类 + 即时生效 +
      刷新保持）。apps 单测全过。

## 设置插件（SET-004）

- [x] `SET-004-001` settings 插件脚手架（plugin.ts/navigation/i18n）+ group `system` 入口
      （leaf Parent，iconId settings）+ `pnpm codegen:plugins` + check。证据：
      `surfaces/plugins/settings/{plugin.ts,plugin.navigation.ts,i18n.ts,routes/page.tsx}`；
      codegen 生成 9 plugins/32 routes（含 settings）；codegen:plugins:check fresh；
      侧栏渲染"设置 → /settings"（e2e 快照证实）。
- [x] `SET-004-002`（全部八分类）页面组合 + 分类真实控件：`settings/src/category-sections.tsx`
      实现 navigation（侧栏/记忆/最近/滚顶/面包屑/标签）、dataDisplay（每页/密度/记忆/空态/
      长文本）、actionPreferences（去向/确认/聚焦/刷新/搜索行为）、localeRegion（语言/日期/
      时区格式/秒/相对/周起始 + numbersFollowLocale 产品固定不可关）、notifications（开关/
      时长）、accessibility（增强项）、shortcuts——复用 Radio/Select/Switch/说明块；
      routes/page.tsx 组合全部 Section。**剩余**：外观↔可访问性同义共享字段的显式引用
      呈现（增强项才属 accessibility 自有，动效/对比度/字号在设置页两处入口共享同一
      preferences 字段已成立——呈现层双入口展示待 SET-004-002 收尾时统一）。
- [x] `SET-004-003`（全分类链路）即时生效：改动 → PreferencesPort.updateCategory → shell
      store → providers data-*/lang 生效；持久化失败呈现 Alert（notSaved）+ 重试。证据：
      settings.spec.ts（切深色→data-theme=dark；切蓝色→data-accent=blue；切 English→
      lang=en；刷新后保持；Axe 无违规）——真实浏览器验证。
      **失败呈现全分类落地**：zustand persist 的 setItem 经 toThenable catch **吞错**
      （quota/安全错误不上抛）→ Host preferences-port 在内存变更后**显式写完整快照**
      （persistSnapshot）取得真实失败语义；settings 页 reportingPort 代理让**所有分类
      控件**（switchRow/Radio/Select/恢复）统一上报 PersistResult → notSaved 横幅 +
      重试（重放上次操作）。证据：persist-failure.spec.ts e2e 通过（模拟 setItem
      QuotaExceededError → 开关会话保留 + 横幅出现 → 恢复存储点重试 → 横幅消失 +
      重载值保持）。
- [x] `SET-004-008` 外观 → 动效偏好（motion）真实消费：Host `MotionPolicyProvider`
      新增 `preference` prop（订阅 shell store appearance.motion）——用户 reduced/standard
      硬设 `data-motion-mode`（**Motion Inspector 的开发配置不得覆盖用户更强的减少动效
      要求**）；system 仍走 Inspector/OS（prefers-reduced-motion 由 CSS media query
      处理，不把 OS 结果烘焙进 dataset）。证据：motion-preference.spec.ts e2e 3 passed
      （默认 system / 设减少动效→data-motion-mode=reduced / 设标准→full）；apps/web
      typecheck + visual/settings/motion 16 e2e 全过。
- [x] `SET-004-004` 设置搜索（名称/说明/分类 + 中英文同义词；结果定位滚动；清空恢复分类；
      不受业务搜索时机影响）。证据：`settings/src/settings-index.ts`（纯搜索目录：字段/
      同义词如"动画"→动效、nameKey/descriptionKey 经 resolveText 取当前语言文案匹配）+
      `settings-index.test.ts`（7 tests）+ 页面 SearchPanel（命中列表，点结果 scrollIntoView
      定位到分类区段；清空恢复）。e2e：搜"动画"→动效偏好、搜"删除"→操作偏好（滚动>0）、
      清空后外观/快捷键标题可见。
- [x] `SET-004-005` 分类级与全部恢复默认（ConfirmDialog 二次确认 + 影响范围 + 不触碰独立
      Store）。证据：`settings/src/restore-defaults.tsx`（RestoreAllButton/RestoreCategoryButton
      经 PreferencesPort.resetAll/resetCategory，只写偏好 store；ConfirmDialog 列影响范围与
      "不触碰收藏/历史/通知/草稿/筛选方案"说明）；页面每个 Section action + PageHeader
      actions 接入；失败经 onResult→notSaved Alert。e2e：切深色后"恢复全部默认"确认 →
      data-theme 回 light。
- [x] `SET-004-006` 账户菜单指向 `/settings`（app-shell 用 routeTargetResolver 解析
      `route('settings')`，移除硬编码 `/system-tools/preferences`）+ Host i18n
      `nav.settings`/`shell.settingsDescription` + `?category&setting` URL 定位（mount
      effect 解析 location.search → category 滚动区段 / setting 经 SETTINGS_INDEX 定位
      所属分类）。证据：app-shell.tsx、resources.ts、routes/page.tsx 深链 effect；
      e2e `/settings?category=shortcuts&setting=enabled` 直达快捷键分类（滚动>0）；
      e2e 侧栏含"设置 → /settings"。

## SET-004 收尾（同义共享字段）

- [x] `SET-004-007` 外观↔可访问性同义共享字段：AccessibilitySection 顶部引用块统一查看
      外观的 fontScale/motion/contrast 当前值（同一 preferences 字段，不重复建开关，
      含"前往外观分类"锚点）。证据：category-sections.tsx AccessibilitySection +
      i18n shared* keys；e2e 4/4 通过。导航↔操作偏好的离开提醒/删除确认同字段双入口
      已成立（confirmLeave/confirmDelete 仅一处存储字段，两处入口共享）。

## Shell 集成（SET-005）

- [x] `SET-005-001`（完成）leave-confirm 全链路。Host 核心（leave-confirm.ts
      registry + proceedAfterLeaveConfirm 异步前置询问 + setLeaveConfirmResolver +
      installBeforeUnloadGuard 仅 dirty 注册）+ leave-confirm-dialog.tsx（受控
      ConfirmDialog）+ 全部导航入口接线（app-shell/navigation-tree/navigation-port/
      router-text-link/not-found）+ framework `./leave-confirm` client Port
      （LeaveConfirmProvider + useRegisterDirtySource，ref 持最新 source 惰性读取；
      package.json exports + foundation-contracts 登记）+ Host
      `leave-confirm-port.ts` adapter（providers 装配）+ 真实消费方 reference-resources
      edit 页（name 改动 → dirty → 导航询问）+ **操作偏好 confirmLeave 真实行为消费**
      （leave-confirm.ts 增 isLeaveConfirmEnabled/setLeaveConfirmEnabled；
      LeaveConfirmationGuard 订阅 preferences.actionPreferences.confirmLeave 即时绑定
      开关——关闭则不询问直接离开；默认开）。证据：leave-confirm.test.ts（9 tests：
      放行/取消/确认/提交中豁免/文案/beforeunload/注销/偏好关闭不询问/默认开恢复）、
      capabilities.test.tsx（+2）、leave-confirm.spec.ts e2e（2：确认流 + 设置页关
      confirmLeave 后 dirty 离开不再弹确认）；apps 93 + framework 40 + surfaces 40
      tests、settings 4 e2e + overlays/design-contract 全过。
- [x] `SET-005-002`（首段：标签条真实切片）Host Page Tabs：`use-page-tabs-store.ts`
      （key `clouddrive.page-tabs` sessionStorage v1：openTab 同 pathname 去重前移/
      LRU 上限 12/closeTab/closeAllTabs/migrate 校验）+ `page-tabs.tsx`（PageTabs
      strip：标签 = 页面入口 pathname 身份、切换走 Next Router 不缓存树、当前高亮、
      X 关闭；usePageTabsRecorder 导航提交打开标签；**pageTabsEnabled 门控** +
      restoreLastTabs=false 首个启用帧清空陈旧会话标签防竞态）+ app-shell 挂载
      （strip 在 header 与 main 之间；recorder 与 recents 同源）。证据：
      page-tabs-store.test.ts 3 tests（去重前移/上限/开关清空）+ page-tabs.spec.ts
      e2e 2 passed（默认关无条；开：访问列表+设置出现去重标签、可关闭）；
      architecture 417 files + navigation/visual/workbench 19 e2e 全过。
      **关闭策略落地**：closeTabAt 按 tabCloseBehavior（recent 默认/right/left，相对
      显示序）选目标——关闭激活标签 → router.push 目标（无其他标签回 '/'）；非激活
      关闭仅移除。证据：page-tabs.spec.ts 3 passed（含"关闭激活标签按 recent 导航到
      另一标签"）。
      **设置 UI 落地**：导航分类新增 SelectField"关闭当前标签后跳转"（recent 最近使用/
      right 右邻优先/left 左邻优先 + hint，即时持久化）。证据：page-tabs.spec.ts
      4 passed（含"选择器存在并持久化（右邻优先）"）。
      **恢复落地**：restoreLastTabs=true → 会话标签重载恢复 + **失效目标过滤**
      （pruneTabs：不在当前导航入口集合的标签移除）；false → 首个启用帧清空。
      证据：page-tabs-store.test.ts 4 tests（含 prune）+ page-tabs.spec.ts
      5 passed（含"重载后标签保持"）。
      SET-005-002 完成。
- [x] `SET-005-003` 新页面打开方式（当前页/浏览器新标签/顶部标签）：settings 导航分类
      新增 RadioGroup（current/browser-tab/page-tab + hint 说明仅作用于声明允许入口、
      Ctrl/Cmd 点击/下载/外链保留原生语义）；**真实消费**：Host RouterTextLink
      （Overview 等声明允许入口）——browser-tab → external 原生锚点（浏览器新标签，
      Ctrl/Cmd 原生保留，当前页不被导航离开）；current/page-tab → 应用内导航
      （page-tab 经顶部标签条记录打开）。证据：new-page-open-mode.spec.ts e2e
      2 passed（默认 current：点"查看基座地图"同页导航到 /foundations；设浏览器新
      标签页：点击触发 popup 到 /foundations 且当前页仍首页）；settings 基线随
      导航新控件再生成（待人工确认）；architecture 418 files + visual 9 e2e 全过。
- [x] `SET-005-004`（完成）收藏/最近数据层 + 记录接线 + 启动目标解析：
      Workbench Store（Host 独立 Store，key `clouddrive.workbench` v1，recents LRU 上限
      12 + favorites + remember 开关关闭不删已有）；providers 装配（rehydrate +
      rememberRecents 偏好即时绑定）；**recents 记录消费方** `recent-visit-recorder.ts`
      （app-shell 挂载：pathname 页面入口提交 → href→i18n 标题 → recordVisit，非入口
      404/search 不记录）；**启动目标解析纯函数** `startup-target.ts`（深链接不重定向；
      恢复目标→最近→homeTarget→默认区域首入口→当前首页；失效跳过；'/' 自身无效）。
      证据：workbench-store.test.ts（6）+ startup-target.test.ts（7：深链接优先/恢复优先/
      最近/指定首页/默认区域/全失效回首页/根无效跳过）；recents.spec.ts e2e（访问
      settings+reference-resources → localStorage workbench recents 含两者、最近在前、
      i18n 标题非空）；apps 106 tests；gates + 8 e2e 全过。**恢复目标接线完成**：
      Overview 首页根入口 effect——autoRestoreWorkspace 开且存在含未提交草稿的页面
      记录 → router.replace 回草稿页（工作恢复目标优先于首页）；默认关保持首页。
      证据：auto-restore.spec.ts e2e 2 passed（默认关：有草稿进首页不重定向；开：
      首页 → 重定向回创建页且草稿恢复）；architecture 413 files + draft/workbench/
      visual 15 e2e 全过。
- [x] `SET-005-005`（首页工作区段）Host Overview 首页（`/`）增收藏 + 最近访问区段
      （复用 Page/Section；数据来自 Host workbench store——收藏由
      reference-resources detail 星标写入、最近由 recent-visit-recorder 驱动；
      **显示开关 showRecents 门控**最近区段；收藏区段有内容才渲染）+ 新增 framework
      `./workbench` Port（WorkbenchPort：listRecents/listFavorites/isFavorite/
      toggleFavorite/subscribe + Provider/hook；Host workbench-port 实现 + providers
      装配 + foundation-contracts 登记）+ foundations 页次级消费（同端口）。证据：
      workbench-home.spec.ts e2e 2 passed（详情收藏 → 首页"收藏"区段展示；访问参考
      列表 → 首页"最近访问"区段展示）；architecture 412 files + visual 9 e2e 全过
      （Overview 基线随区段再生成）。快捷键部分见 SET-006-006（已完成）。
      **剩余**：常用命令/可恢复工作区段（随启动目标接线）。
- [x] `SET-005-008` 导航 → 跳转后自动滚动到顶部（scrollToTopOnNavigate）真实消费：
      Host `scroll-preference.ts`（resolveScrollOption：开默认交给 Next 滚顶；关 →
      `scroll: false` 保持位置）统一接入全部 Host 导航入口（navigation-port 3 处 /
      app-shell 2 处 / navigation-tree / router-text-link）。证据：scroll-to-top.spec.ts
      e2e 2 passed（默认开：长页滚下 SPA 导航到设置 → 回顶部；关：保持滚动位置）；
      apps/web typecheck + architecture 406 files + menu-memory/leave-confirm 6 e2e
      全过（导航链路无回归）。
- [x] `SET-005-006` 导航 → 记住展开的侧栏菜单（menuMemory）真实行为消费：
      surface-foundation shell-navigation-accordion 增 `carryAccordionModel`（跨路由携带
      exploration：推进 routeKey 保留手动展开；active ancestor 仍锚定、同 scope 至多一个
      exploration 约束不变）+ ShellNavigation 增 `menuMemory` prop（Route Commit 时
      carry vs reset 分支）+ apps/web navigation-tree 读偏好传入。证据：
      shell-navigation-accordion.test.ts（+4：携带保留/同 routeKey 原样/携带后可收起/
      active 锚定不受影响，共 18 tests）+ menu-memory.spec.ts e2e 2 passed（默认关：
      SPA 换路由展开重置；开：手动展开跨 SPA 导航保留——设置页开关实测）；
      design-contract + navigation 7 e2e 无回归；apps 110 tests。

## 列表/表单/搜索/草稿/地区/通知命令消费（SET-006）

- [x] `SET-006-001`（表格密度首段）参考场景一（page-archetypes/resource-list 高密度数据
      工作台）：初始表格密度 = 全局默认（数据展示 → tableDensity，三档偏好映射到
      DataTable 两档表面：compact→compact，standard/comfortable→comfortable；经
      usePreferencesPort 惰性读取）→ **页面显式操作优先**（本地 SelectField 覆盖）。
      证据：table-density.spec.ts e2e 2 passed（设紧凑 → resource-list 密度触发按钮
      "紧凑 表格密度"；页面显式切舒适 → "舒适 表格密度"）；gates + surfaces tests 全过。
- [x] `SET-006-001`（默认每页数量）参考列表分页消费 `dataDisplay.pageSize`（全局默认
      10/20/50/100 经 useSyncExternalStore 订阅 → 分页 pageRecords 切片；原硬编码
      12 移除——真实"全局默认每页 20"生效）。证据：page-size.spec.ts e2e 2 passed
      （默认 20 → 首页 21 行含表头=20 数据；设 10 → 11 行）；apps 120 + surfaces 42
      tests；reference/date-format/table-density/page-size 12 e2e 全过（visual 基线随
      默认 12→20/页 再生成，标注待 SET-008 人工确认）。
      **剩余**：列宽/列序/列显隐、筛选/滚动恢复、批量/删除确认、
      退役列过滤/标识列保留/分页校正。
- [x] `SET-006-001`（分页/筛选记忆）resource-list 经 Workspace Port（registerPageState
      allowListState；无草稿字段）订阅 `dataDisplay.rememberPagination` /
      `rememberFilters`（默认关，合并恢复/保存块 + 共享 listRestored ref）：
      开 → 进入页面恢复已存页码/筛选（页码按当前页数校正、筛选项逐一校验；
      双帧等 workspace 就绪后再恢复，**首次恢复完成前不写回**——避免 mount 初始
      值覆盖已存记录），状态变化保存（filters 存 status/region/query）。
      证据：remember-pagination.spec.ts e2e 2 passed（默认关：翻到第 3 页全量重载回
      列表回第 1 页；开：重载后仍在第 3 页，localStorage workspace 记录 page:3）+
      remember-filters.spec.ts e2e 2 passed（默认关：状态"需关注"筛选后重载回全部；
      开：重载后筛选保持且行数减少）；apps/web typecheck + architecture 408 files +
      search-trigger/reference 6 e2e 全过。
- [x] `SET-006-001`（搜索历史）page-archetypes 插件私有 persist store
      `stores/search-history.ts`（独立 key `clouddrive.page-archetypes.search-history`，
      LRU 上限 8 去重前移；record/clear；migrate 损坏走失败语义；skipHydration +
      页面 mount rehydrateStore）+ surfaces 增 `@clouddrive/state-foundation` 依赖
      （dependency-policy 已允许 surfaces；node_modules junction 与既有 workspace
      链接一致）+ resource-list 接线：执行搜索记录（rememberSearchHistory 门控）、
      "最近搜索"chips + 清空搜索历史按钮（showSearchHistory 门控，clear 为明确动作
      不随关闭记忆删除）。证据：search-history.test.ts 3 tests（去重前移/上限/record-
      clear）+ search-history.spec.ts e2e 2 passed（开启后记录显示并清空；默认关不记录）；
      surfaces 45 tests、search-trigger/history/reference 10 e2e 全过。
- [x] `SET-006-001`（批量操作确认）resource-list 真实多选"导出已选"动作接
      `actionPreferences.confirmBulk`（默认开）：开 → 受控 ConfirmDialog（标题
      "导出所选 N 条？"，impact 说明仅生成本地快照不修改数据；取消不导出）；关 →
      直接导出无弹窗。证据：confirm-bulk.spec.ts e2e 2 passed（默认开：选 2 条 →
      弹"导出所选 2 条？" → 取消不导出；关：直接执行无确认）；architecture 409
      files + reference/visual 11 e2e 全过。
- [x] `SET-008`（前置快照）修正 reference/visual spec 的每页行数断言（12→20 默认后
      reference.spec 13→21 行并移除与 page-size.spec 重复的第 2 页步骤；
      visual.spec expectReferenceReady 13→21）并再生成 2 张 Reference 视觉基线
      （标注待人工确认）。**全量验证快照：e2e 120/120 passed；apps 120 + surfaces 45 +
      surface-foundation 45 + plugin-framework 40 + form-foundation 2 单测；全部 gates
      （foundation/architecture 399/dependency/codegen×2/docs）绿**。注意：e2e 运行
      期间产生的 test-results trace .css 会被 architecture gate 扫到（非代码问题），
      跑完清理 test-results 后再跑 gate。
- [x] `SET-008`（快照 2 + 导航基线）全套 e2e 140/142（2 个 navigation 收缩侧栏 Flyout
      visual 失败 → 顶部通知铃铛合法改变头部 → 导航基线再生成 6/6 通过，标注待 SET-008
      人工确认）；范围审计（子代理只读）确认剩余未勾选项：SET-002-002/002-004其余/
      002-005/003-006/005-002/005-003/008-001..007。**运行时缺口（已修复）**：
      根因 = state-foundation hydration lifecycle 在失败态仍允许再次 trigger
      （StrictMode 重挂载触发第 3 次 rehydrate），读到被 persist 随错误分支 setState
      静默回写的默认记录 → 把失败清成成功（横幅不出）。修复 = lifecycle
      `status === 'error'` 不再自动 trigger + Host shell store 错误分支先清除损坏键
      再置 hydrationIssue（不静默覆盖损坏记录）。证据：corrupt-settings.spec.ts
      e2e 通过（横幅原因 + 恢复默认 → 无横幅）+ `hydration/corrupt.test.ts` 单测 +
      lifecycle 8 tests。
- [x] `SET-008`（快照 4）**全套 e2e 155/155 passed**（11.9m；含导航保护 2/
      column-settings 2/remember-sort 2 新增；round-60 恢复横幅无回归）；全部 gates
      绿（architecture 424）。提交：be87704c/105f69f2/94b830d1/69a3259b/84dcd6fc/
      e9437cb1（feat×4 + test + fix + docs，均未推送）。剩余见 SET-002/008-008 条目。
- [x] `SET-008`（快照 5）**全套 e2e 169/169 passed**（12.1m）+ 单测全绿
      （apps/web 124 + surfaces 49 + plugin-framework 40 + surface-foundation 45 +
      state-foundation 39 = 297）；round-69 corrupt runtime 修复无回归。**corrupt
      runtime 缺口已修复**（lifecycle error 态不再自动 trigger + shell 错误分支清
      损坏键，见 SET-008-002）；**桌面通知拒绝原因**经真实通知管线呈现（SET-008-005
      完成）；全模型字段孤儿扫描全清（timeZone 补控 + i18n formatTimeOfDay 时钟显示）。
      3 个 visual 基线随新控件/时间 caption 再生成（reference-desktop/
      reference-multi-select/settings-desktop，待人工确认）。提交至 760deae8 共
      17 个（均未推送）。**剩余**：SET-002-002/008-004 人工视觉门 + SET-002-005
      列宽（由 109 实施，历史导出判断已纠正）+ density schema 权威化 + 存储拒绝/容量不足呈现。
- [x] SET-008（快照 6）**实现范围全部交付**：8 分类全部设置项真实消费（严格孤儿扫描全清——
      R62-77 落地 density/fontScale/contentWidth/contrast 运行时、列显隐/顺序/排序记忆、
      搜索建议/每页最近搜索、相对时间/时刻、首字段聚焦、未读提醒/收纳非关键通知/声音/
      桌面通知拒绝呈现/损坏记录恢复/持久化失败全分类呈现+重试）；SET-003/004/005/006/007 + SET-008-001/002/003/005/006 **完成**；SET-008-004 自动部分完成（visual 基线
      3 张再生成 + reference/overview/navigation 基线，待人工确认）。~183 e2e + 297 单测
      全绿、全 gates 绿、codegen x2 fresh；24 个 Conventional Commits（至 a19a3b7d，
      均未推送）。**仅剩外部门控**：SET-002-002 TailAdmin 人工视觉复核（需图像输入/
      人眼）、SET-002-005 列宽 Resizable（由 109 接手验收）、density
      schema 单轨权威化。SET-002 依目标明示不得标记完成——目标保持 active 至外部条件满足。
- [x] `SET-006-001`（搜索时机）resource-list 订阅 `actionPreferences.searchTrigger`：
      enter（默认）→ 键入不立即过滤（appliedQuery 回车/表单提交应用，clear 同步重置）；
      auto → 键入即时过滤。证据：search-trigger.spec.ts e2e 2 passed（默认 enter：
      键入 "Lin Chen" 仍 21 行，回车后行数下降；auto：键入立即下降）；apps 120 +
      surfaces 42 tests、19 regression e2e 全过。
- [x] `SET-005-007` 导航 → 显示面包屑（breadcrumbs）真实消费：reference detail 按
      canonical hierarchy 渲染 PageHeader 面包屑（参考资源 → 详情）；偏好关（默认开）
      则不渲染。证据：breadcrumbs.spec.ts e2e 2 passed（默认开：面包屑 list 可见含
      参考资源；关：不可见）；apps 120 tests + reference/copy-feedback 10 e2e 全过。
- [x] `SET-006-001`（行分隔/固定表头/空态说明）DataTable 增可选
      rowSeparators/stickyHeader/emptyStateHint（默认均开 = 现行行为，向后兼容）；
      resource-list 订阅 dataDisplay 三项偏好传入（即时生效）。证据：
      empty-state.spec.ts e2e 2 passed（空态说明默认开：无匹配显示"筛选条件没有
      结果…"；关：表格为空不显示）；overlays/visual 29 e2e 全过（默认档视觉无回归）。
- [x] `SET-006-001`（复制反馈）reference detail 增"复制 ID"按钮（真实
      navigator.clipboard.writeText）；**操作偏好 copyFeedback 门控反馈**：开（默认）→
      复制成功 Toast + 按钮变"已复制"；关 → 无 Toast（复制本身仍可用）。证据：
      copy-feedback.spec.ts e2e 2 passed（clipboard 权限下开 → "资源 ID 已复制到
      剪贴板"可见；关 → 不可见）；apps 120 tests + reference/visual 7 e2e 全过。
- [x] `SET-006-002`（提交去向首段）创建/编辑成功去向（操作偏好 → create/edit
      SuccessDestination，**真实成功回调后执行**）：reference-resources create（list 默认
      返回列表 / continue 留在本页清空表单继续；detail 本参考场景无真实新建实体目标——
      settings 该选项附 "detailNotApplicableHint" 说明不适用，不伪装跳转）+ edit（stay
      默认留在本页且保存值成为新基线不再 dirty / list 返回列表 / detail 进详情；保存
      publish 通知保持）。证据：create-destination.spec.ts 2 passed（默认返列表 /
      继续创建留页清空）+ edit-destination.spec.ts 2 passed（stay 留页且不再触发离开
      确认 / detail 导航详情）+ notifications.spec.ts（stay 默认下保存仍收纳通知）；
      apps 115 + surfaces 42 tests、settings/reference/leave-confirm 12 e2e 全过。
- [x] `SET-006-002`（草稿自动保存/恢复）Host Workspace Store（独立 key
      `clouddrive.workspace` v1：records + setRecords + clear + hasHydrated/
      onRehydrateStorage 门控；migrate 损坏走 hydration 失败语义）+ `workspace-port.ts`
      （registerPageState 描述注册表/白名单过滤草稿字段；**跨窗口冲突**：stored 指纹 ≠
      本实例 lastWritten 且 ≠ 输入 → conflict 不覆盖；同窗口顺序 autosave 不误报；
      restore/clear）+ providers WorkspaceProvider 装配 + **workspaceHasHydrated 门控**
      （children 在 workspace 就绪后才渲染，保证首帧恢复确定性）+ 真实消费方：
      reference-resources create（autosaveDrafts 开时字段变化自动保存白名单 name/kind；
      mount 恢复草稿保持未提交语义；提交成功/放弃 clear）。证据：workspace-port.test.ts
      5 tests（白名单过滤/跨窗口 conflict/同窗口不误报/无记录与 clear/list+草稿分离）；
      draft-autosave.spec.ts e2e 2 passed（开：输入 → 刷新恢复 → 提交清除；关默认：
      不写草稿）；apps 120 tests；9 regression e2e 全过。
- [x] `SET-006-002`（首错误聚焦）form-foundation `useFoundationForm` 增
      `focusFirstError?` 选项（默认 true，向后兼容；RHF shouldFocusError 收口）；
      create-edit archetype 读操作偏好 focusFirstError 传入。证据：
      focus-first-error.spec.ts e2e 2 passed（默认开：填 x 提交 → 焦点落在首个错误
      字段；关：不自动聚焦）；form-foundation 2 + apps 120 tests、visual 7 e2e 全过。
- [x] `SET-006-002`（重置前确认）reference edit 增"重置"动作（恢复初始值）；
      **操作偏好 confirmReset 门控**：开（默认）→ ConfirmDialog（取消保留修改/
      确认恢复初始，impact 说明不触碰收藏/最近/通知/草稿）；关 → 直接重置无弹窗。
      证据：confirm-reset.spec.ts e2e 2 passed；edit-destination/leave-confirm/
      copy-feedback 8 e2e 全过（编辑页改动无回归）。
      SET-006-002 完成（去向 + 草稿 + 首错误聚焦 + 重置确认）。
- [x] `SET-006-003`（日期格式首段）preferences-model 增 `formatDateOnly`（dateFormat
      三格式确定性排版，UTC 字段读取**纯日期不因时区偏移**）+ `timeToIntlOptions`
      （hourCycle+showSeconds → Intl 选项）；真实消费方：page-archetypes/resource-list
      updated 列（useSyncExternalStore 订阅 localeRegion.dateFormat → 列渲染
      formatDateOnly）。证据：preferences-model.test.ts（+2：三格式排版不偏移/
      h24 无秒与 h12 有秒选项）；date-format.spec.ts e2e 2 passed（默认
      `2026-08-29`；切 MM/DD/YYYY → `08/29/2026`）；surfaces 42 tests；
      reference/visual/table-density 19 e2e 全过（visual 基线随默认列格式再生成，
      标注待 SET-008 人工确认）。**剩余**：时区自动/IANA 有限集合、带时区时间、相对 vs
      精确、周起始、DatePicker 接语言/weekStart、数字跟随地区。
- [x] `SET-006-004`（能力层）定期刷新：surface-foundation `periodic-refresh.ts`（纯规则：
      `PERIODIC_REFRESH_INTERVAL_MS=60s` 集中预设、`shouldPauseRefresh`（后台/离线/提交中/
      未提交编辑任一 → 暂停）、`createPeriodicRefresh`（start 幂等/stop 清理/isRunning；
      每 tick 先判暂停；onTick 返回 thenable 时 pending 期间**不并发重入**——同步 onTick
      不阻塞下一周期））+ `use-periodic-refresh.ts`（enabled+isPaused ref 惰性读取；
      卸载自动 stop）+ exports（surface-foundation package.json + foundation-contracts
      登记）。证据：periodic-refresh.test.ts 7 tests（暂停矩阵/预设 60s/周期触发与
      stop/start 幂等/暂停跳过恢复继续/不并发重入）；surface-foundation 45 tests；
      全 gates 过。**接线完成**：resource-list 订阅 `actionPreferences.refreshMode`；
      periodic 时 usePeriodicRefresh（isPaused 接 document.visibilityState +
      navigator.onLine）驱动 `lastRefreshedAt` 时间戳，表格上方显示"自动刷新已开启/
      上次自动刷新 HH:MM:SS"指示。证据：auto-refresh.spec.ts e2e 2 passed（默认
      off 无指示；设定期刷新 → 指示可见）；apps 120 + surfaces 42 tests；
      visual/page-size/table-density 11 e2e 全过（默认 off → 视觉基线无变化）。
      **on-enter 档补齐**：refreshMode=on-enter → mount（每次进入本页）刷新一次时间戳
      并显示"上次自动刷新 HH:MM:SS"；auto-refresh.spec.ts 增至 3 passed（仅页面重新
      进入时 → 进入即显示上次时间）；11 regression e2e 全过。
- [x] `SET-006-005`（数据层 + 真实事件）通知中心：Host Notifications Store（独立
      Store，key `clouddrive.notifications` v1，上限 50 淘汰最旧；publish/markRead/
      markAllRead；migrate 损坏走 hydration 失败语义不静默覆盖；持久化内容可序列化
      无函数）+ `notifications-port.ts`（NotificationsPort 实现：publish/list/
      unreadCount/subscribe/markRead/markAllRead，订阅 emit）+ providers 装配
      （NotificationsProvider + rehydrate）+ **真实前端事件消费方**：reference-resources
      edit 保存成功 → publish success 通知（含 Route Target
      reference-resources.detail）。证据：notifications-store.test.ts（4 tests：
      publish 前置/已读/上限截断/Port 全链路含退订）；notifications.spec.ts e2e
      （编辑保存 → localStorage notifications 收纳 success 通知：标题/描述/Route
      Target/read=false）+ **提示时长真实消费**：ui-adapter FeedbackProvider 增可选
      `toastDurationMs`（非关键 toast 时长，persistent/loading 不受影响；Host 经展示
      策略 props 传入，不 import Host Store）；providers 读
      `preferences.notifications.toastDuration` → TOAST_DURATION_MS(3/5/8s) 传入。
      证据：toast-duration.spec.ts e2e（长=8s：toast 在 6.5s 仍可见；短=3s：4.5s 已
      消失——旧 5s 硬编码下长档会在 6.5s 消失，证明偏好已流入）；apps 110 tests；
      reference-resources + leave-confirm e2e 8 passed + Toast visual e2e 无回归。
      **剩余**：Shell 铃铛 + 通知中心 Popover（未读角标/已读/全部已读/列表渲染 + 关键
      提示不可关的呈现侧），随 SET-005-005 shell 组装落地。
- [x] `SET-006-005`（Shell 铃铛 + 通知中心呈现）`apps/web/src/shell/notification-center.tsx`：
      顶部铃铛（未读角标 Badge；showBadge 关不显示角标）+ 受控 Drawer（ui-adapter
      DrawerSurface 增 isOpen/onOpenChange 受控模式，向后兼容）列表渲染真实事件
      （点击条目标已读/全部标为已读/空态）；**通知偏好 inAppNotifications 关 → 隐藏
      铃铛入口**（产品强制高风险/错误通知仍由发布方收纳，入口隐藏不丢失）。证据：
      notification-center.spec.ts e2e 2 passed（编辑保存成功 → 铃铛未读角标 → Drawer
      列表含"参考资源已保存" → 全部已读清角标；应用内通知关 → 铃铛隐藏）；
      apps/web typecheck + architecture 403 files + notifications/visual/settings
      16 e2e 全过。
- [x] `SET-006-006`（命令 Port + 命令菜单聚合）Host `commands-port.ts`（注册表 +
      cachedList 稳定快照供 useSyncExternalStore + subscribe/runCommand 可用性校验，
      不可用不执行返回原因 + 注销）+ providers CommandsProvider 装配 + app-shell
      命令菜单聚合注册命令（id `command:` 前缀区分，onAction 分发 run vs 导航）+
      真实消费方：reference-resources list 注册 `reference-resources.new`（命令菜单
      与页面按钮同一目标，页面作用域，卸载注销）。证据：commands-port.test.ts
      （5 tests：注册/注销、订阅通知、runCommand 执行、未知 id、不可用不执行）；
      commands.spec.ts e2e（/reference-resources Ctrl+K → 搜"新建资源" → 激活 →
      /reference-resources/create）；apps 115 tests + 12 regression e2e 全过。
      **快捷键层落地**：app-shell keydown 统一监听——Ctrl/Cmd+K 命令菜单保留；
      Alt+Shift+N → runCommand('reference-resources.new')（与命令菜单/页面按钮同一
      执行函数与可用性，不可用退回命令菜单呈现原因）；输入框/IME 组合期间避让；
      **快捷键偏好 shortcuts.enabled 门控**（关 → 全局监听停止，注册保留）。
      证据：shortcuts.spec.ts e2e 2 passed（Alt+Shift+N 参考列表 → 创建页；启用快捷键
      关 → 不执行）；apps/web typecheck + architecture 404 files + commands/reference
      9 regression e2e 全过。
- [x] `SET-006-006`（剩余）快捷键统一注册层落地（见上）；公共 Pattern ≥2 独立参考
      场景验证由 SET-002-005 DataTable/Showcase 场景收尾时一并核验。

## 单轨清理与 authority 同步（SET-007）

- [x] `SET-007-001` 删除 system-tools preferences 资产（routes/preferences/page.tsx、
      schemas.ts 删除；plugin.navigation 收敛为 leaf Parent → system-tools.icons；
      i18n 清理 nav.preferences/preferences.*）→ `pnpm codegen:plugins` 收敛
      （9 plugins/31 routes，preferences 路由产物消失）+ codegen:plugins:check fresh；
      grep 旧符号零残留（源码/生成物/e2e/apps web）；`/system-tools/preferences` → 404、
      `/system-tools/icons` → 200（dev server 实测）。
- [x] `SET-007-002` apps/web i18n/resources 清理（nav.preferences/preferencesDescription
      移除；nav.settings/shell.settingsDescription 保留）+ e2e preferences.spec 删除（由
      settings.spec 取代）+ visual.spec 快照迁移（preferences-desktop.png 删除 →
      settings-desktop.png 生成，标注待 SET-008 人工确认）。
- [x] `SET-007-003` foundation-contracts.json：framework `./leave-confirm` subpath 登记 +
      state-foundation authorityRoutes `/preferences` → `/settings`。
- [x] `SET-007-004` authority 同步：plugin-framework.md（§示例 children 与 system-tools
      结构描述更新：leaf → icons、preferences 迁出为 settings 插件）、quality-evidence.md
      （路由/Vitest/e2e/基线现状更新）；grep authority 无旧偏好叙述残留。
- [x] `SET-007-005` surface-foundation.md 复核（无旧偏好叙述）+ docs/changes/README.md 107
      索引更新（计划待确认 → 已确认实施中，进度如实标注）+ dependency-policy 复核
      （leave-confirm Port 用 react peer，无新增运行时依赖，无需改动）；visual.spec
      navigation/mobile 基线随侧栏 tree 变更（系统工具 disclosure → Icon 大全 leaf）
      再生成，**标注待 SET-008 人工视觉确认**。

## 全量验证与交付（SET-008）

- [x] `SET-008-001` 逐项设置真实消费者证据清单：`design/settings-consumer-evidence.md`
      矩阵（外观/导航/数据展示/操作偏好/语言地区/通知/可访问性/快捷键 × 字段/默认/
      消费点/证据 e2e spec），并明列无消费者项归属 SET-002-004/002-005 剩余（非
      "无效开关"而是未落地能力）；滚动核对 8 分类全部设置项与实施证据一一对应。
- [x] `SET-008-002`（完成）迁移与失败：旧版本 v0→v1 保真迁移（providers.test.tsx +
      shell-store.test）、首次启动默认值（providers/settings e2e）、损坏/未知版本
      （shell-store.test 失败语义单测 + **非法 JSON runtime 缺口已修复**：根因 =
      state-foundation lifecycle 失败态自动重试（StrictMode 重挂载）读到被静默回写
      的默认记录把失败清成成功 + persist 随 setState 静默回写默认值——修复 =
      lifecycle error 态不再自动 trigger + shell store 错误分支清除损坏键不静默
      覆盖；corrupt-settings.spec.ts e2e 通过：横幅原因 + 恢复默认动作 →
      重建记录无横幅）、草稿冲突（workspace-port.test 5 tests：跨窗口
      conflict 不覆盖/同窗口不误报）、重试/刷新恢复（恢复默认 e2e + draft/分页/
      筛选/排序记忆重载恢复）。**存储拒绝/容量不足 runtime 呈现已完成**：
      preferences-port 显式写快照 + settings reportingPort 全分类 notSaved 横幅 +
      重试（persist-failure.spec 通过）。SET-008-002 **完成**。
- [x] 随功能适用字段说明（非无效开关——控件存在但参考场景无对应操作，不伪造假场景）：
      confirmDelete（无删除操作页面；危险操作确认底线由 confirmReset/confirmBulk 先例保证，
      待删除能力出现时接入）、weekStart/numbersFollowLocale（产品固定/地区语义，随日历
      与数字展示能力落地）、collectNonCriticalToCenter（R75 落地）、unreadReminder
      （R74 落地）、showSearchSuggestions/keepLastSearchPerPage（R72 落地）。
- [x] `SET-008-003`（完成）导航与数据保护用例：navigation-protection.spec.ts
      （同路由 no-op + 浏览器返回）+ rapid-navigation.spec.ts e2e 2 passed
      （**连续导航**：快速依次跳转 5 次全部成功无错误边界；**连续导航含离开确认**：
      脏表单确认离开后继续导航正常）。**失效目标**：resolveStartTarget 纯函数
      7 tests（无效 restore/recents/home 过滤）+ 首页 autoRestoreWorkspace
      allowlist（未知 pageId 天然跳过）覆盖。**已确认边界**：浏览器历史返回的
      脏表单离开确认不在应用内 leave-confirm 覆盖（平台限制接受）；应用内离开
      确认由 leave-confirm.spec 覆盖；标签关闭/筛选/分页/滚动恢复由 page-tabs/
      remember-pagination/remember-filters 等 spec 覆盖。SET-008-003 完成。
- [x] `SET-008-004`（自动部分已覆盖）桌面/超宽/移动/英文扩张/Dark/Light/四强调色/
      reduced-motion/键盘/焦点/Overlay/Axe：visual.spec 9（含 settings/Reference/
      Overview/铃铛/导航基线，再生成待人工确认）+ navigation.spec + reference.spec
      Axe WCAG AA + 各交互 spec 键盘路径。**剩余（人工门）**：基线逐张人眼确认 +
      高对比/大字号（SET-002-004 语义源落地后）视觉复核。
- [x] `SET-008-005`（完成）通知与资源生命周期：离线——periodic-refresh isPaused 接
      navigator.onLine（单测矩阵 7）+ 非关键提示时长/收纳（toast-duration/
      notification-center spec）；卸载清理——usePeriodicRefresh 卸载 stop、Port
      subscribe 退订（framework/surface-foundation 单测）；**声音/桌面通知真实
      消费**——Host NotificationAlerts（真实新通知 → WebAudio 提示音，无资源文件；
      granted 时 new Notification）+ useDesktopNotificationGate（开启桌面通知即请求
      权限；拒绝/不支持 → 回退偏好，不保留无效开关 + **经真实通知管线呈现原因**：
      通知中心收纳"无法开启浏览器桌面通知"+ 拒绝/不支持文案）。证据：
      notification-alerts.spec.ts e2e 2 passed（AudioContext 探针：保存发布触发
      提示音；权限不可用开启即回退且通知中心出现原因条目）。SET-008-005 **完成**。
- [x] `SET-008-006` 工程门禁：codegen:plugins:check + runtime-codegen:check fresh、
      全部旧符号引用检查（grep system-tools/preferences|preferences.spec|旧路由 →
      零残留）、`pnpm check` 等价门禁全绿（foundation-governance 12/11、
      architecture 423 files、dependency 25、docs）+ 各 workspace typecheck 干净。
      `pnpm` CLI 环境受限（registry 解析失败，历史记录）——逐项 gate 已等价覆盖
      `pnpm check` 构成。
- [x] `SET-008-007` 审阅完整 Diff；Conventional Commit：`be87704c feat(settings): add
independent settings center with real preference consumers`（163 变更路径全部
      收敛，无推送）；提交前最后验证：foundation/architecture 418/dependency/
      codegen×2/docs gates 全绿 + apps/web 24 测试文件通过；全套 e2e 149/149（本轮
      早前快照）。commit 后工作区 clean。

## 验收标准（全部满足才声明完成）

- 每项设置都有真实消费者与证据（不能只证明控件选中或存储值改变）。
- 迁移与失败、导航与数据保护、界面与可访问性、通知与资源生命周期、工程门禁五类验收
  （目标 §5）全部通过。
- system-tools preferences 无残留引用；`pnpm check` 全绿；提交为 Conventional Commit 且不推送。

## 设置插件按分类拆分独立页面（SET-009，用户新需求）

> 把八分类全部挤在 /settings 单路由（纵向堆叠 + hash 锚点）重构为每分类一个独立
> 静态子路由：/settings 索引页 + /settings/{appearance,navigation,data-display,actions,
> locale,notifications,accessibility,shortcuts} ×8。侧栏/账户菜单仍单入口 /settings；
> 分类导航为 SettingsLayout 左栏 RouterTextLink；搜索跨目录 → 跳对应分类页 + ?setting
> 聚焦；分类级恢复默认进分类页、恢复全部保留索引页。

- [x] SET-009-001（完成）validPathnames 仅纯函数测试入参（无运行装配）；navEntries 只含导航叶子 → 分类页不进 recents/标签独立记录（页面标签仍以 /settings 根为入口）；settings-index category 用模型 key → 新增 SETTINGS_CATEGORIES 短 id 映射表（appearance/navigation/data-display/actions/locale/notifications/accessibility/shortcuts）落 settings-layout-shell.tsx；design/settings-plugin.md §4/§6 同步多页架构 勘察落盘：validPathnames 仅纯函数测试入参（无运行装配，子路由无需
      注册）；navEntries 只含导航叶子 → 分类页不进 recents/标签独立记录；settings-index
      category 用模型 key → 新增短 id 映射表（appearance/navigation/data-display/actions/
      locale/notifications/accessibility/shortcuts）。计划文档同步 design/settings-plugin.md。
- [x] SET-009-002（完成）共享壳 src/settings-layout-shell.tsx：SETTINGS_CATEGORIES 映射 + SettingsCategoryNav（RouteLink 左导航 active 高亮）+ useSettingsPersistReport（reportingPort+ctxFor+banner）+ CategoryPage（PageHeader/恢复分类/SettingsLayout/响应式 prefs）+ SettingsContentFrame；category-sections.tsx 导出 Ctx + 新增 AppearanceSection（外观控件从旧索引页迁入） 共享壳：src/settings-layout-shell.tsx（SettingsCategoryNav 左导航
      RouterTextLink + active；SettingsPageFrame；useSettingsPersistReport=reportingPort+
      lastResult/lastApply+notSaved AlertBanner）；category-sections.tsx 增 AppearanceSection
      （迁移索引页内联外观控件）；Ctx 不变。
- [x] SET-009-003（完成）8 分类子路由 routes/<shortId>/page.tsx（39 routes codegen）+ 索引页 routes/page.tsx 重写（左导航+8 分类入口卡+跨目录搜索+恢复全部默认）；i18n 增 navLabel + categoryIntro.* zh/en 8 分类子路由 routes/<category>/page.tsx ×8 + 索引页 routes/page.tsx 重写
      （左导航 + 8 分类入口卡 + 搜索 + 恢复全部）；i18n 增分类页 title/description 键；
      codegen 再生成（catalog/plugin-routes）。
- [x] SET-009-004（完成）搜索跨页跳转：索引页命中 → RouteLink 到对应分类子路由（该设置在分类页可见）；分类页为独立 URL 可深链直达（?category 兼容：索引 ?category 不再需要——分类页即目标）；单分类页内容短，字段级滚动不再需要 深链/搜索跨页：索引搜索命中 → push(route('settings.<shortId>')+'?setting='+
      fieldId)；分类页 effect 读 searchParams.setting → 定位聚焦；?category= 兼容跳转。
- [x] SET-009-005（完成）e2e 适配：38 spec goto 按操作目标分类改子路由（外观系→appearance；导航系→navigation；数据展示系→data-display；操作偏好系→actions；语言系→locale；通知系→notifications；可访问性/快捷键单独页）；settings.spec 重写（外观独立页/搜索跳转/恢复全部/语言页/深链 active）；settings-routes.spec 新增 9 passed（8 子路由可达+标题+active+刷新保持+索引卡）；visual.spec 增 settings-appearance 基线 e2e 适配：逐 spec 按操作目标分类改 goto 子路由（外观系→/settings/
      appearance 等；仅清空/重置保留 /settings）；settings.spec 重写；settings-routes.spec
      新增（8 子路由可达/标题/左导航 active/刷新保持/?setting 聚焦/索引卡进入）。
- [x] SET-009-006（完成）门禁全绿（foundation/architecture 464/dependency/codegen fresh/docs）+ surfaces 49 + apps/web 124 单测 + 全套 e2e 193/193（含 settings-routes 9/visual 9）；visual 基线 settings-desktop（索引页）+ settings-appearance 生成待人工确认 门禁全绿 + visual 基线（索引 + 8 页）生成标注待人工确认 + tasks.md 证据。

## 去掉设置索引主页：/settings 直接打开外观默认分类页（SET-010，用户新需求）

- [x] SET-010-001（完成）勘察：settings.title/description 仅旧索引页使用（已随删除移除键）；
      settings.appearance 源码无 route 引用（仅 i18n 文案键与 e2e URL）；codegen 39→38 routes。
- [x] SET-010-002（完成）shell：SettingsCategoryMetaInner 增 targetRouteId（appearance='settings'，
      其余='settings.<shortId>'）；SettingsCategoryNav 用 targetRouteId；useSettingsPersistReport
      返回 setLastResult；CategoryPage PageHeader actions=分类恢复+恢复全部默认（onResult 上报），
      顶部新增跨目录 SettingsSearch（命中跳对应分类页）；导出 appearanceMeta/DEFAULT_CATEGORY。
- [x] SET-010-003（完成）路由：删 routes/appearance/page.tsx（外观 canonical 并入根）；根
      routes/page.tsx 重写为默认页（CategoryPage appearance + AppearanceSection）；codegen 再生成
      38 routes；i18n 删 settings.title/description zh/en 死键。
- [x] SET-010-004（完成）e2e：appearance-display/motion-preference goto 改 /settings；settings.spec
      重写（根=外观页默认/搜索跳 actions/恢复全部任意页/语言页/深链 shortcuts/左导航互跳 active）；
      settings-routes.spec appearance 案例改 /settings + 尾部改"左导航含 8 分类可跳转"；visual.spec
      删 settings-appearance 独立截图（settings-desktop 基线=根外观页重拍）。
- [x] SET-010-005（完成）门禁全绿（foundation/architecture 461/dependency/codegen fresh/docs）+
      surfaces 49 + apps/web 124 单测；settings 相关 e2e 25/25；全量 e2e 见快照；visual 基线重拍待人工确认。

## 设置内页 Shell UI/UX 修正：持久化布局壳 + 搜索入侧边栏 + 分类语义图标（SET-011，用户需求）

- [x] SET-011-001（完成）勘察：codegen HOST_ADAPTER_KINDS 含 layout（routes/layout.tsx 装配为 Host
      layout）；.surface-settings-layout ≥64rem 两栏 grid（左 14rem sticky + 右内容）；
      Icon 体系 = Surface 受控 vocabulary（navigation-icon.ts）+ icon-components 唯一 lucide 映射 +
      NavigationIcon 呈现组件（@clouddrive/surface/icon-presentation）。
- [x] SET-011-002（完成）Icon vocabulary 受控扩展：navigation-icon.ts + palette/globe/accessibility/
      keyboard（4 新语义，不改现有 15）；navigation-icon-components.ts 映射 Palette/Globe/Accessibility/
      Keyboard。8 分类 iconId：appearance→palette、navigation→navigation、data-display→data、
      actions→action、locale→globe、notifications→feedback、accessibility→accessibility、
      shortcuts→keyboard（写入 SETTINGS_CATEGORIES）。
- [x] SET-011-003（完成）持久化壳 routes/layout.tsx：Page > PageHeader(usePathname 解析活动分类 title/
      desc/分类恢复+恢复全部) > SettingsLayout(左 SettingsSidebar + 右 SettingsShellProvider{children})；
      8 page.tsx 收敛为薄渲染（useSettingsShell() 取 ctx → XxxSection）；SettingsSidebar = Panel 内固定
      顶部 SettingsSearch + 分组分类导航（SETTINGS_NAV_GROUPS 显示与数据/偏好与反馈/辅助与输入，
      NavigationIcon + active 高亮沿用主导航 leaf 视觉）；i18n 增 navGroups zh/en。
- [x] SET-011-004（完成）Host RouteTransition 修正：去 key={pathname}（原强制整树重挂破坏 Next layout
      语义）→ 动画改 dataset 先 false 后 rAF true 重播；layout/Provider 跨导航保留（settings 壳搜索输入
      切分类后保留，mount 计数 2→2 验证）。e2e：settings-routes.spec 新增壳持久化 + 侧边栏图标/分组 2
      测试；settings/导航/转场相关 spec 全过；visual settings-desktop 基线重拍（侧栏搜索顶置+图标+分组）。
- [x] SET-011-005（完成）门禁全绿（foundation/architecture/dependency/codegen fresh/docs）+ surfaces 49 +
      apps/web 124 单测；settings 相关 e2e 全过；全量 e2e 见快照；visual 基线待人工确认。

- [x] SET-011-006（视觉不重载修正，用户复验）根因：Host route-content page-enter 动画选择器
      （route-content > .surface-page-stack > 区段）要求直接子 page-stack——settings layout 原用 Page
      直接包壳，导致每次切分类（pathname 变 → data-route-enter false→true）壳整体重放 fade+rise，
      观感即整页重新加载（React 未重挂但视觉在闪，mount 2→2 无法覆盖此观感）。修复：layout 根包一层
      非 page-stack 容器（动画选择器不命中，壳 opacity 恒 1）+ 右侧内容区 ContentSwapTransition
      (contentKey=pathname) 克制淡入。验证：切分类壳 opacity 全程 1、搜索输入保留、196/196 e2e、
      visual 无变化。

## 设置内容切换复用主 Shell Route-Transition Motion（SET-012，用户需求：不重复设计）

- [x] SET-012-001（完成）勘察：主 Shell route-enter 编排唯一 authority（surface-foundation styles.css
      .surface-route-content > .surface-page-stack > 区段 fade+rise/stagger/forward/motion-screen 降级，
      无 exit——React 同步替换只有进入编排）；上一轮 settings 用 ContentSwapTransition（content-swap
      语义 = 同路由内容替换）替代 route/screen 语义属错位设计；壳被整页动画根因 = layout 整体包 Page。
- [x] SET-012-002（完成）surface-foundation styles.css：route-enter 编排并列新增
      [data-route-content] 分支（route-content 内任意深度的路由内容容器直接区段），与 page-stack
      分支同一 fade+rise/nth-child 错峰/forward/motion-screen-off 定义；data-route-content 契约 =
      layout 壳页面的路由内容容器（壳不在其内则不动效）；page-stack 分支原样保留（主 Shell 零回归）。
- [x] SET-012-003（完成）settings layout 重构：删除 ContentSwapTransition 与整体 Page 包裹；壳
      （PageHeader + SettingsSidebar + 失败横幅）静止；右侧内容 children 放 <div data-route-content>
      内（SettingsShellProvider 包 children）→ 分类切换由 Host RouteTransition 同门控触发，内容区段
      执行与主 Shell 一致的进入编排；间距对齐 --surface-section-gap（space-y-6）。
- [x] SET-012-004（完成）e2e：settings-routes.spec 新增"分类切换复用 route-enter 动效：内容区段
      animation-name 含 content-fade-in、壳 opacity 恒 1"；settings 12/12 + 回归子集 38/38 + visual
      无像素变化；全量 e2e 见快照。
- [x] SET-012-005（完成）门禁全绿（codegen/architecture/foundation/dependency/docs）+ 单测 + 全量 e2e；
      design 文档同步动效复用说明；无 ContentSwapTransition 残留（grep）。
