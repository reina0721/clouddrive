# R083-002 样式权威与布局骨架事实基线

> 研究档案(快照 `5a3def3`,2026-08-28)。事实均来自对当前仓库代码的直接读取与 PowerShell 脚本统计,引用均带文件+行号。区分**事实**(可复核代码证据)与**推断**(基于事实的推论,标注「推断」)。

## 1. 研究问题

083 方案 11b「修复样式污染,重建统一样式权威」与 11c「重写布局骨架,修复滚动与视口缺陷」(`docs/changes/temp-new-changes.md` L470-508)声称:

- 模块 `*.module.css` 大量使用 `:global(...)` 定义**平台级通用语义类**(如 `.permission-matrix`、`.role-checklist`、`.form-error`、`.session-row` 等),把本应属于统一样式层的类泄漏为全局样式(11b,提出时称「122 处」,见 083 README L9/L14);
- 同一语义出现**命名分裂**:平台 kebab-case(`page-meta`、`filter-bar`),模块出现 camelCase/近似变体(`pageMeta`、`formHint`、`shellSearchTrigger`、`footerStatus`)(11b L475);
- 平台类在模块内被**私有覆盖**(如移动断点下 `.toolbar` 在模块 media query 里被改写)(11b L476);
- 主区域用 `height: 100vh` 固定(`.app-workspace`),移动端地址栏伸缩时底部截断(11c L493);
- 页面内容被压进**居中容器**(`.page-viewport` `max-width:1600px + margin:0 auto`),1440/1600/1920 宽度下两侧留白(11c L494);
- **滚动发生在内容容器内而非独立 Main Workspace**(`.page-viewport` 自身 `overflow:auto`),Sidebar 用 grid 列 + `min-height:100vh`,非真正固定在 viewport(11c L495);
- 全局 Tab Bar(WorkspaceTabs 顶部页签)仍在(11c L496);
- 响应式与页面内容宽度由容器统一承担,缺少按场景的宽度档(11c L497)。

本研究回答:上述声明的**精确现状**(统计数字、selector 清单、行号级定义)与每项缺陷的**修复触及面**和**可守护性**。

## 2. 方法与范围

- **样本**:HEAD `5a3def3` 下 `internal/module/*/binding/webui/web/*.module.css`(7 个)全文读取;`webui/src/styles.css`(2934 行,`[System.IO.File]::ReadAllLines` 实测)按分区读取;壳层组件 `AppShell.tsx`/`WorkspaceTabs.tsx`/`AppSidebar.tsx`/`AppHeader.tsx`/`ScrollExperience.tsx`/`App.tsx`/`theme.ts` 全文;lint 脚本 `lint-architecture.mjs`/`lint-modules.mjs`/`eslint.config.js`/`package.json` 全文。
- **统计方法**:PowerShell `[regex]::Matches($raw, ':global\(')` 逐一计数并提取 `:global(...)` 内 selector;`Get-ChildItem + Measure-Object` 行数;`git show c3a23c0:<path>` 对账历史快照。死代码判断:对每个 `:global` 类名在 `internal/module/**/*.tsx` 中搜索 className 消费方(含模板字符串的动态类名,如 `ops-metric-${key}`,单独核验)。
- **表格/行号标定**:styles.css 使用字节级 `[System.IO.File]::ReadAllLines` 计行;read/grep 工具行号与之一致(Get-Content 默认编码在该环境会错 9 行,已弃用,并已在「局限」说明)。
- **未运行**:未启动浏览器渲染验证;所有滚动行为结论来自 CSS/装配代码事实,视觉表现标为推断。

## 3. 样式污染现状(精确统计)

### 3.1 总览数字

`webui/src` **零** `:global`(grep 全目录无匹配);`webui/scripts/` 无 CSS;全部 `:global` 只存在于 6 个模块 CSS(openapi.module.css 为 0)。

| 模块 CSS(路径 `internal/module/<m>/binding/webui/web/`) | 文件行数 | `:global(` 出现次数 | 去重 selector 数 | 模块根前缀 |
|---|---|---|---|---|
| auth.module.css | 34 | **9** | 6 | `.authModule` |
| iam.module.css | 114 | **25** | 21 | `.iamModule`(1 处复合 `.iamModule:global(.auth-panel)`) |
| navigation.module.css | 1(单行压缩) | **15** | 13 | `.navigationModule` |
| openapi.module.css | 578 | **0** | 0 | —(全部局部类) |
| ops.module.css | 87 | **75** | 60 | `.opsModule`(1 处无前缀 `:global(.header-zone-action)`) |
| organization.module.css | 36 | **5** | 5 | `.organizationModule` |
| settings.module.css | 44 | **8** | 7 | `.settingsModule` |
| **合计** | | **137** | **112** | |

- 两种计数口径一致:`:global(` = 137,裸 `:global` 全部为括号形式 137。
- 与 083 README 声称的「122 处」**不符**;在 c3a23c0(082 快照)对账同样为 137,说明 122 既非当前状态也非 082 快照状态(差异 15 = navigation.module.css 的计数,推断 122 可能漏计该文件或出自更早版本;属推断,未找到 122 的来源快照)。
- **137 处中只有 1 处是无模块根前缀的真全局**:ops.module.css L87 `:global(.header-zone-action)`(ops 模块 header-actions zone 贡献按钮)。其余 136 处均有模块根类前缀,在 CSS Modules 编译后形如 `<hashed>.moduleRoot`(如 `.opsModule<hash>`)限定作用域——但**内层类名/元素名不哈希**,属于「模块根内全局」:类名仍以裸名存在于全局样式表,且元素级 selector(`dl`/`dt`/`dd`/`fieldset`/`legend`/`label`)在模块根内影响所有匹配元素(推断:这也是样式污染的一种,但污染半径小于真正的全局泄漏)。

### 3.2 每模块 :global 完整清单与分类

分类口径:**〔平台级〕**= 平台 styles.css 已有同义类、或语义为跨模块通用、应由平台统一提供的类被模块用 `:global` 定义(含平台类被引用/被覆盖);**〔元素级〕**= 裸元素选择器;**【死代码】** = 无 tsx 消费方;**〔模块专属〕** = 模块业务专属语义(如 ops-*)。同时标注 live(有消费方)/dead。

#### 3.2.1 auth.module.css(9 处,6 去重)——**全部为死代码**

| selector | 次数 | 分类 | 消费方 |
|---|---|---|---|
| `.audit-table-head` | 3 | 〔模块专属〕审计网格 | 无——AuditPage.tsx 已迁移 DataTable(L88-108),类名无消费 |
| `.audit-row` | 2 | 〔模块专属〕 | 无 |
| `.audit-scroll` | 1 | 〔模块专属〕横向滚动容器 | 无 |
| `.audit-mono` | 1 | 〔模块专属〕 | 无 |
| `.audit-empty` | 1 | 〔模块专属〕 | 无 |
| `.audit-meta` | 1 | 〔模块专属〕 | 无 |

文件 head-context 全部为 `.authModule`(PowerShell 80 字符回溯确认)。L1100 断点(L28-33)同样依赖死类。结论:**auth.module.css 整文件是 082 DataTable 迁移后的遗留,9 处 :global 全部可删**(推断:删除零风险,见 §7)。

#### 3.2.2 iam.module.css(25 处,21 去重)

| selector | 次数 | 分类 | 消费方(live/dead) |
|---|---|---|---|
| `.auth-panel`(经 `.iamModule:global(.auth-panel)` 复合 L3/L108) | 2 | 〔模块专属〕登录面板 | live:LoginPage.tsx L7、SetupPage.tsx L7(`Surface className={styles.iamModule + ' auth-panel'}`) |
| `.auth-heading`(+`h1`/`p`) | 3 | 〔模块专属〕认证页头部 | live:LoginPage/SetupPage |
| `.iam-form`(+`.ui-button` 引用) | 2 | 〔模块专属〕 | live:LoginPage/SetupPage;`.ui-button` 引用平台 Button 钩子类 |
| **`.form-error`** | 1 | **〔平台级〕**通用表单错误 | live:LoginPage/SetupPage(`className="form-error"`);与 ops.module.css L13 重复定义 |
| `.permissions`(+`code`) | 2 | 〔平台级〕通用权限陈列(仅 iam 使用) | live:PermissionsPage |
| `.role-checklist` | 1 | 〔平台级〕通用角色勾选清单 | live:AccountsPage.tsx L142 |
| `.permission-row` | 1 | 〔平台级〕权限行(与 organization.module.css L24 重复) | live:RolesPage/AccountsPage/AssignmentsPage |
| `.permission-matrix`(+`fieldset`/`legend`) | 3 | 〔平台级〕权限矩阵 | live:RolesPage.tsx L166 |
| `.permission-description` | 1 | 〔平台级〕 | live:RolesPage L166 |
| `.admin-note` | 1 | 〔平台级〕通用说明 | live:RolesPage L165 |
| `.session-table-head` | 3 | 〔模块专属〕会话表头 | **dead**——SessionsPage.tsx 用 DataTable(L42-60),类名无消费 |
| `.session-row` | 2 | 〔模块专属〕会话行 | **dead** |
| `.session-mono` | 1 | 〔模块专属〕 | **dead** |
| `.sessions-empty` | 1 | 〔模块专属〕 | **dead** |
| **`.toolbar`** | 1 | **〔平台级·私有覆盖〕** | L111-113 `@media (max-width:720px){ .iamModule :global(.toolbar){display:grid} }`——覆盖平台 `.toolbar`(styles.css L1966 `display:flex`) |

L900 断点(L100-105)作用于死类 session-*。小结:25 处中平台级 ≈9(form-error/permissions/role-checklist/permission-row/matrix/description/admin-note/toolbar),死代码 7(session-*),模块专属 9(auth-*/iam-form 等)。

#### 3.2.3 navigation.module.css(15 处,13 去重)——单行压缩文件

| selector | 次数 | 分类 | 消费方 |
|---|---|---|---|
| `.revision` | 1 | 〔模块专属〕版本行 | live:MenusPage.tsx L57 |
| `.policy-grid` | 1 | 〔模块专属〕策略网格 | **dead**——MenusPage 已迁移 TreeView+InspectorPanel,无 `policy-grid` 消费 |
| `.policy-card`(+`header`/`h2`/`p`) | 4 | 〔模块专属〕策略卡 | **dead** |
| `.policy-controls`(+`label`/`label:first-child`) | 3 | 〔模块专属〕策略控件行 | live:MenusPage.tsx L80 |
| `dl` / `dl div` / `dt` / `dd` | 4 | **〔元素级〕**裸元素 selector | 无直接消费(推断:作用于模块根内任意 dl/dt/dd,当前页面无 dl,潜在死代码) |

L760 断点(media)作用于 policy-controls/dl。小结:模块专属 8(其中 dead 5),元素级 4。

#### 3.2.4 openapi.module.css(0 处 :global,578 行)——**命名分裂样本,非 :global 泄漏**

全局部类(CSS Modules 哈希),但存在与平台 kebab-case 的**近义 camelCase 变体**:

| openapi 局部类 | 平台对应(styles.css) | 说明 |
|---|---|---|
| `.pageMeta`(L5) | `.page-meta`(L2449) | 同义不同名;openapi 用 `styles.pageMeta`(OpenAPIPage.tsx L104),其余模块用平台 `page-meta` |
| `.formHint`(L417) | (平台无 form-hint;平台有 `.form-panel` L2501) | camelCase 变体 |
| `.shellSearchTrigger`(L19) | (平台 `.search-trigger` L551) | 近义变体 |
| `.workspaceTabs/.workspaceTabsRoot/.workspaceTabsList/.workspaceTab`(L212-267) | `.workspace-tabs/.workspace-tab`(L742-818) | openapi 模块内多标签条与平台全局 Tab Bar **同名近义**(camel 区分),易混淆 |
| `.workspaceShell/.workspaceRow/.workspaceMain/.workspaceInner/.workspaceEmpty`(L12-69) | `.app-workspace`(L467) | 模块自建「workspace」语义层 |
| `.footerStatus`(ops.module.css L85) | (平台无 footer 状态类;是 ops 模块 footer-status zone 贡献组件 FooterStatus.tsx 的局部类) | 11b L475 声称的 camelCase 变体样本之一(footerStatus);局部类、非 :global |

即:11b「命名分裂」声明有据(样本 pageMeta/formHint/shellSearchTrigger/footerStatus 均存在),但**机制是局部类(哈希)而非 :global**,不构成全局污染;风险是平台与模块双份语义、行为随模块而异(推断)。

#### 3.2.5 ops.module.css(75 处,60 去重)——最大的 :global 来源

- **〔模块专属〕占绝大多数**:`ops-grid`(3)、`diagnostic-*`(card/heading/title/icon×3/actions×2/pre 等 ≈13)、`ops-overview-*`(grid/card×2/heading/kicker/detail ≈8)、`ops-metric-*`(grid×3/card×2/tile×2/strong×2/span/value/unit/bar/bar-fill/heading/degraded/unavailable/requests/inFlight/exported/dropped/monitoring-lower/metrics-card ≈25)、`ops-runtime-grid`(2)、`ops-build-list`(4:div/div:last-child/dt/dd)、`ops-health-list`/`ops-health-row`(+`:last-child`/`attention`)≈4、`ops-component-name`、`refresh-icon`、`icon-spin`、`capability-preview`、`capability-row-actions`(+`.ui-button`)、`capability-detail-result`。全部有 DashboardPage.tsx/CapabilitiesPage.tsx/monitoring-section.tsx 消费(live)。
- **〔平台级〕**:`.form-error`(L13,`color:#dc2626`)与 iam 重复定义;`.status-pill`(L38 `.ops-health-row .status-pill`)引用平台 StatusPill 生成的类(webui/src/ui/index.tsx L84 `status-pill status-${state}`);`.capability-row-actions .ui-button`(L18)引用平台 Button 钩子类。
- **无前缀真全局**:L87 `:global(.header-zone-action)`——不带模块根,直接作用于全局任意 `.header-zone-action` 元素(ops HeaderAction.tsx L10 zone 贡献);这是全仓唯一无作用域收口的 :global。
- L84 注释为乱码(编码损坏),不影响规则。
- 断点:L1050(65-68)/L1000(L70)/L720(L72-82)。

#### 3.2.6 organization.module.css(5 处,5 去重)

| selector | 次数 | 分类 | 消费方 |
|---|---|---|---|
| `fieldset` | 1 | **〔元素级〕** | live:AssignmentsPage.tsx L54(裸 `<fieldset>`) |
| `fieldset legend` | 1 | **〔元素级〕** | live:同页 |
| `fieldset label` | 1 | **〔元素级〕** | live:同页 |
| `.permission-row` | 1 | 〔平台级〕与 iam 重复 | live:AssignmentsPage L54 |
| `.toolbar` | 1 | **〔平台级·私有覆盖〕** | L32-36 `@media (max-width:720px){ .organizationModule :global(.toolbar){display:grid} }`——与 iam L111 相同模式 |

#### 3.2.7 settings.module.css(8 处,7 去重)——全部模块专属且 live

`.settings-summary`(+`>div`/`dt`/`dd`,4)、`.settings-stack`(1)、`.settings-inner`(2,L29/L41 media)、`.settings-content`(1)。消费方:SettingsLayout.tsx(L44-46,注意 L40-42 注释说明模块根与 settings-inner 必须分开节点)、AboutPage/AccountPage/LanguagePage/NotificationsPage。L900 断点(40-44)作用于 settings-inner。

### 3.3 死代码汇总(**推断:全部可安全删除**)

| 文件 | 死 :global 类 | 出现次数 |
|---|---|---|
| auth.module.css | audit-table-head/audit-row/audit-scroll/audit-mono/audit-empty/audit-meta | 9 |
| iam.module.css | session-table-head/session-row/session-mono/sessions-empty | 7 |
| navigation.module.css | policy-grid/policy-card(+header/h2/p) | 5 |
| **合计** | | **21** |

判断依据:类名在 `internal/module/**/*.tsx` 零消费(静态搜索;动态类名已单独核验,session/audit/policy 无动态生成)。风险点:menu 相关 e2e 可能引用类名(未核验 Playwright fixture,见 §9)。

### 3.4 平台公共布局类 vs 模块同名/近义类冲突矩阵

平台 styles.css 布局原语(供 067/082 迁移后模块消费):`.page-sections`(L1959)、`.toolbar`(L1966)/`.toolbar-actions`(L1979)、`.filter-bar`(L1987)/`.filter-bar-fields`/`.filter-field`/`.filter-bar-clear`/`.filter-bar-count`/`.search-input-*`、`.page-header`(L832)/`.page-eyebrow`/`.page-description`/`.page-actions`、`.stat-grid`(L2460)、`.card-grid`(L2468)/`.item-card`(L2472)/`.item-card-meta`、`.page-meta`(L2449)、`.form-panel`(L2501)、`.data-toolbar`(L1806)/`.data-table-wrap`(L1858)/`.data-table`(L1861)/`.pagination-*`、`.page-section/.stat-card/.data-card`(仅语义钩子,L2457-2458 注释)。模块实际消费的平台类(tsx 统计):`page-meta` 34 处、`toolbar`/`toolbar-actions` 24 处、`page-sections`、`page-header` 系列、`data-table-wrap`(via DataTable)。

**冲突矩阵**:

| 平台类(styles.css) | 模块 CSS 同名 :global | 模块 camelCase 近义局部类 | 冲突性质 |
|---|---|---|---|
| `.toolbar` L1966(flex) | iam L111、organization L33(720px 改 `display:grid`) | openapi `.toolbar?` 无 | **同名私有覆盖**:模块在断点内以 `.iamModule .toolbar`(0,2,0) 覆盖平台 `.toolbar`(0,1,0),平台升级/新需求时表现不一致(11b L476 声明属实) |
| `.page-meta` L2449 | — | openapi `.pageMeta` | 命名分裂(局部,哈希,无级联冲突) |
| `.form-panel` L2501 | — | openapi `.formHint` | 命名分裂 |
| `.search-trigger` L551 | — | openapi `.shellSearchTrigger` | 命名分裂 |
| `.workspace-tabs` L742(全局 Tab Bar) | — | openapi `.workspaceTabs`(模块内标签条) | 同名近义:模块内 tab 条与全局 Tab Bar 语义撞车,变量命名易误用 |
| `.app-workspace` L467 | — | openapi `.workspaceShell/.workspaceRow/.workspaceMain` | 语义近义,模块自建 workspace 层 |
| (平台无) `.form-error` | iam L28、ops L13 | — | **平台缺失 + 模块重复定义**:两个模块各自 `#dc2626`,应上收平台 |
| (平台无) `.permission-matrix/.role-checklist/.permission-row/.permission-description/.permissions/.admin-note` | iam L32-80、organization L24(permission-row) | — | 平台缺失(11b 声称的这些类确实不在 styles.css),其中 permission-row 双模块重复定义 |
| (平台无) `.session-table-head/.session-row` 等 | iam(dead) | — | 平台缺失;081/082 前遗留,现死 |
| `.status-pill`(index.tsx L84 生成) | ops L38(`.ops-health-row .status-pill` 引用) | — | 模块 :global 引用平台组件类进行后代微调 |
| `.ui-button`(index.tsx L45 钩子) | iam L25、ops L18 | — | 同理,模块 :global 引用平台组件类 |
| (平台无) `dl/dt/dd/fieldset/legend/label` | nav、organization | — | **元素级全局**:模块根内所有匹配元素受影响,平台引入新组件出现 dl/fieldset 时会被模块规则覆盖(推断风险) |

**结论**:11b 的三条主张——平台级通用语义类被模块全局化(.form-error/permission-matrix/role-checklist/session-row 等,实测存在)、命名分裂(pageMeta/formHint/shellSearchTrigger/footerStatus 存在,但为局部类)、私有覆盖平台类(.toolbar 在 iam/organization 断点被改写,属实)——**全部有代码证据**;唯一偏差是计数 122 vs 实测 137。

### 3.5 lint 现状(实际检查规则摘录)

- **`webui/scripts/lint-architecture.mjs`**(56 行,全文已读):
  - L10-17:`platformStylesSource.includes(...)` 检查 **平台 styles.css 不得包含业务 selector**,业务类必须模块拥有。业务 selector 清单:`auth-panel, auth-form, auth-summary, auth-session, scope-list, scope-item, ops-grid, ops-summary, ops-overview, ops-metric, diagnostic-, capability-preview, capability-row-actions, capability-detail-result, refresh-icon`(L11-15)。方向是「平台不得偷业务类」,**不检查模块 :global 泄漏/平台类重复/私有覆盖**。
  - L29-40:逐模块源码扫描——禁用 `@webui/contracts`/`@webui/ui`(L33)、react-query 必须走 `@webui/sdk/query`(L34)、禁止 import 平台 internals(L35)、禁止跨模块 import(L36-38)。
  - L42-50:平台源码扫描——禁止 import 业务模块(L46)、禁止按 moduleId 分支(L49)。
  - **不涉及任何 CSS 文件**:`sourceFiles()` 只收 `/\.(?:ts|tsx)$/`(L24)。CSS Modules 文件整树不在检查范围。
- **`webui/scripts/lint-modules.mjs`**(16 行):只跑 `eslint ...moduleRoots --config webui/eslint.config.js`(L15)。
- **`webui/eslint.config.js`**(28 行):files 只匹配 `**/*.{ts,tsx}`(L9),唯一规则 `@typescript-eslint/no-unused-vars: warn`(L21-26)。**无任何 CSS/样式规则**。
- **`package.json`**:`"lint": "eslint . && pnpm lint:i18n && pnpm lint:architecture"`;`lint:modules` 独立不并入主 lint。
- tsc/vite build 不检查 CSS 语义。

**结论**:当前没有 lint 守护样式权威;11b L485 声明「重构后 lint:architecture 全面执行——平台类重复定义/:global 泄漏/私有覆盖均不得通过」,现状为零检查,**修复必须同时新增规则**。

## 4. 布局骨架现状(精确)

### 4.1 骨架五元素完整定义(styles.css,行号=字节级标定)

**token(分区 1,L114-125)**:
```css
--shell-sidebar-expanded: 264px;   /* L115 */
--shell-sidebar-collapsed: 80px;   /* L116 */
--shell-header-height: 64px;       /* L117 */
--shell-tabs-height: 44px;         /* L118 */
--shell-content-max: 1600px;       /* L119 */
--shell-sidebar-current: var(--shell-sidebar-expanded); /* L124 */
```
另有未消费的宽度档 token(L109-112):`--content-max-wide:1600px / --content-max-detail:1200px / --content-max-settings:960px / --content-max-form:760px`——**全仓唯一消费方检查结果:仅 styles.css L823 用 `--shell-content-max`;四个 `--content-max-*` 零消费**(11c L497「缺少按场景宽度档」间接证实:档位 token 已定义但从未接线)。

**`.app-shell`(L263-269)**:
```css
.app-shell {
  display: grid;
  grid-template-columns: var(--shell-sidebar-current) minmax(0, 1fr);
  min-height: 100vh;
  background: var(--page);
  transition: grid-template-columns var(--motion-layout) var(--ease-standard);
}
.app-shell.sidebar-collapsed { --shell-sidebar-current: var(--shell-sidebar-collapsed); } /* L270-272 */
```

**`.app-sidebar`(L273-284)**:
```css
.app-sidebar {
  z-index: var(--z-sidebar);            /* =20, L146 */
  display: flex;
  flex-direction: column;
  width: var(--shell-sidebar-current);
  min-height: 100vh;
  padding: var(--space-4) var(--space-3);
  background: var(--surface);
  border-right: 1px solid var(--border);
  transition: width ..., transform ...;
  overflow: hidden;                     /* L283:无 overflow-y 滚动容器 */
}
```
全仓 styles.css **无任何 `overflow-y` 声明**(grep:overflow-y 0 匹配);`overflow-x` 仅 2 处(L730 section-nav 720px、L754 workspace-tab-scroll)。`.sidebar-nav`(L340-343)为 `display:grid`,无滚动。推论:侧栏「尺寸=内容高度,min-height =100vh,溢出 hidden」——**桌面端内容超高时内容被裁而非滚动**(推断需浏览器确认);11c L495「Sidebar 用 grid 列 + min-height:100vh,非真正固定在 viewport」属实(没有 position:fixed/sticky 于桌面断点,只有 720px 内 `position:fixed`,L2653)。

**`.app-workspace`(两段定义,L467-472 与 L474-478)**:
```css
.app-workspace {                       /* 第一段 L467-472 */
  display: flex;
  min-width: 0;
  min-height: 100vh;
  flex-direction: column;
}
/* 参考站式的固定 Header/页签/Footer：仅把中间工作区交给页面滚动 */
.app-workspace {                       /* 第二段 L474-478（后定义覆盖） */
  min-height: 0;
  height: 100vh;
  overflow: hidden;
}
```
第二段生效:`height:100vh` 固定工作区、`overflow:hidden` 由中间 .page-viewport 承担滚动。11c L493「主区域用 height:100vh 固定」属实;`100dvh` 全仓无(见 §4.5)。

**`.topbar`(L480-488,AppHeader.tsx 渲染 `<header className="topbar">`)**:
```css
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--shell-header-height);  /* 64px */
  padding: 0 18px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}
```

**`.workspace-tabs`(L742-749)与横滚轨(L750-759)**:
```css
.workspace-tabs {
  display: flex;
  height: var(--shell-tabs-height);    /* 44px */
  padding: 0 12px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  overflow: hidden;
}
.workspace-tab-scroll {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  overflow-x: auto;                    /* 页签轨横向滚动 */
  scrollbar-width: none;               /* 隐藏滚动条 */
}
```
`.workspace-tab`(L760-766)/`.workspace-tab-actions`(L806-818);density compact 档高度 38px(L912-914)。

**`.page-viewport`(L820-828)——滚动与限宽核心**:
```css
.page-viewport {
  flex: 1;
  width: 100%;
  max-width: var(--shell-content-max); /* 1600px 居中限宽 */
  margin: 0 auto;
  padding: var(--space-6) clamp(18px, 3vw, 40px) var(--space-2);
  min-height: 0;
  overflow: auto;                      /* 页面滚动的实际容器 */
}
.module-page { min-width: 0; }         /* L829-831,每个模块页根都挂 */
```
11c L494「页面内容被压进居中容器,1600px 限宽、两侧留白」属实。720px 以下(L2713-2715)改 `padding: var(--space-5) 14px var(--space-1)`。

**`.app-footer`(L866-872)**:
```css
.app-footer {
  display: flex;
  justify-content: space-between;
  padding: var(--space-4) clamp(18px, 3vw, 40px) var(--space-5);
  color: var(--text-muted);
  font-size: 11px;
}
```

### 4.2 document/body 滚动模型

- `body`(L235-240):`margin:0; min-width:320px; background:var(--page); color:var(--text)`。**无 html/body overflow 声明**。
- `html` 仅经 scrollbar-gutter 开关(L2850-2857):`[data-experience-scrollbar="stable"] .page-viewport, [data-experience-scrollbar="stable"] html { scrollbar-gutter: stable; }`,overlay 档 `auto`。
- **页面滚动发生在哪一层**:app 布局中,`.app-workspace`(100vh + overflow hidden)→ `.page-viewport`(flex:1 + overflow auto)是**唯一纵向滚动容器**;Lenis 以 `.page-viewport` 为 wrapper、`.page-flow` 为 content(ScrollExperience.tsx L39-43,panel 模式)。**window 不滚动 app 布局**(推断:app-shell min-height 100vh + workspace height 100vh 使文档高度恰为视口;唯一例外是 sidebar 内容超高撑破 100vh,见 §4.1 推断——此时 window 会出现滚动,与「Sidebar 非固定」同源)。
- 滚动体验运行时(styles.css 7.1,L2838-2907):`.page-flow`(L2869-2876)min-height:100% + translateY(edge-band);`.snap-x`(L2879-2888)磁吸;`[data-scroll-hijack]` overscroll-behavior(L2886-2888);`[data-reveal]` 弹入(L2891-2907)。
- Blank 布局(Login/Setup):`ScrollExperience target="window"`(AppShell.tsx L27),此时 window 滚动;`.blank-layout` min-height:100vh(L1679-1685)。

### 4.3 全局 Tab Bar(WorkspaceTabs)装配点

- **DOM 装配**:AppShell.tsx L145 `{theme.layout.showTabs && <WorkspaceTabs routes={visitedRoutes} ... />}`,位于 `<div className="app-workspace">`(L143)内、AppHeader 之后、ScrollExperience 之前。
- **visitedRoutes 状态**:L50 初值(当前 app 路由)→ L73-78 effect(导航时追加 route id)→ L96 映射为 ManifestRoute[];closedTab(L97-102)过滤 + 导航到剩余最后页/默认页;isWorkspaceTabClosable(WorkspaceTabs.tsx L8-11)默认首页不可关 201。
- **WorkspaceTabs.tsx**(42 行):`workspace-tab-scroll` 内 map 渲染 `.workspace-tab`,右侧 `.workspace-tab-actions`(refresh + zone `workspace-tabs` 注入点 L41);roving keyboard 由 getWorkspaceTabTargetIndex(L18-25)与 AppShell handleWorkspaceTabKeyDown(L129-137)协作;`activeWorkspaceTabID`(L138)驱动 panelProps role="tabpanel"。
- **theme.layout 契约**:theme.ts L9 `ThemeLayoutPreferences = { showBreadcrumb; showTabs; showFooter; sidebarCollapsed }`;L52 default 全 true;AppShell L51 `setCollapsed(theme.layout.sidebarCollapsed)`;setTheme 持久化 localStorage(L142-146)。
- **结论**:11c L496「全局 Tab Bar 仍在且按 showTabs 可关」属实;移除 Tab Bar 只涉及 AppShell.tsx(装配行)+ WorkspaceTabs.tsx + theme.layout.showTabs 契约 + 相关 a11y,见 §6。

### 4.4 Footer:是否固定占用工作区

- AppShell.tsx L147 `{theme.layout.showFooter && <footer className="app-footer">…<ZoneItems zone="footer-status" />…</footer>}`;在 `.app-workspace`(flex column)内、ScrollExperience 之后。
- 因 `.app-workspace` height:100vh + overflow hidden,且 `.page-viewport` flex:1,**Footer 是 flex 列末尾固定项,不随内容滚动,恒占工作区底部**(推断:视觉上为底部固定栏;非 position:fixed 而是 flex 布局达成)。content 滚动区是其上方 page-viewport。
- zone `footer-status` 由 ops 模块 FooterStatus.tsx 贡献(styles.footerStatus 局部类 L85)。

### 4.5 移动端视口:100vh vs 100dvh;响应式断点

- **全仓库用于布局的 vh 单位均为 `100vh`,`100dvh/svh/lvh` 零出现**(grep `dvh|svh|lvh` 全 webui/src 无匹配)。styles.css 11 处 100vh:
  - L266 `.app-shell` min-height;L278 `.app-sidebar` min-height;L470 `.app-workspace` min-height(第一段,被 L476 覆盖后 min-height:0);L476 `.app-workspace` height(生效);L1043 `.theme-drawer` height;L1060 `.ui-drawer` height;L1507 `.rac-modal-panel` max-height calc(100vh - 60px);L1526 `.rac-drawer-panel` height;L1664 `.startup-state/.standalone-state` min-height;L1682 `.blank-layout` min-height;L2656(720px 内).app-sidebar min-height。
  - 模块 CSS 与模块 tsx **零 vh**(PowerShell 扫描确认)。
- **11c L493 声明属实**:主骨架 3 处(.app-shell/.app-sidebar/.app-workspace)都是 100vh,移动端地址栏伸缩时底部截断风险成立;修复路径见 §6。
- **响应式断点全集**:
  - styles.css:720px(8 个:L725 section-nav、L2646 壳层、L2725、L2750、L2772、L2795、L2821、L2915 stat-grid)、900px(L2442 org-tree-inspector)、1000px(L2640 account-menu)、1050px(L2910 stat-grid data-stat-columns=4)。
  - 模块 CSS:auth 1100px(audit 死类)、iam 900px(L100 session死类)/720px(L107 toolbar 覆盖 + auth-panel padding)、navigation 760px(policy-controls 1fr)、ops 1050px(L64)/1000px(L70)/720px(L72)、organization 720px(L32 toolbar 覆盖)、settings 900px(L40 settings-inner)。
  - AppShell.tsx L54 移动判定 `matchMedia("(max-width: 720px)")`。
- 720px 内壳层(L2646-2723):app-shell/sidebar-collapsed 改 `display:block`;sidebar `position:fixed; inset:0 auto 0 0; width: var(--shell-sidebar-expanded); transform: translateX(-100%)`,`.mobile-open` 复位;topbar padding 0 10px;page-viewport padding 14px;breadcrumb 隐藏(L2751-2753)。

### 4.6 水平滚动风险点(哪些可能产生整页水平滚动)

- **结构性防护**:`.app-workspace` overflow:hidden + `.page-viewport` overflow:auto → 内容宽于视口时滚动**发生在 page-viewport 容器内**,不是 window(document 级)。`body min-width:320px`(L237)兜底最小宽。因此「整页水平滚动(window 滚动条)」在当前结构下基本不发生(**推断**:除非 sidebar 超高撑破文档宽,或模块页出现超宽内容且其外层无滚动容器)。
- **组件级横向滚动容器(设计为内部滚动)**:
  - `.data-table-wrap`(styles.css L1858-1860)`overflow:auto`;`.data-table`(L1861-1864)`min-width:680px` → **DataTable 在 wrapper 内横滚**(平台语义组件,index.tsx L190 Table.Root class="data-table-wrap")。
  - `.workspace-tab-scroll`(L750-759)overflow-x:auto —— 全局 Tab Bar 页签轨。
  - openapi `.workspaceTabsList`(openapi.module.css L222-228)overflow-x:auto —— 模块内标签条。
  - `.section-nav`(styles.css L725-740,720px 内)overflow-x:auto。
  - `.pagination`(L2806-2809,720px 内)overflow:auto。
- **可能造成 page-viewport 内横向溢出的候选**(推断,未逐页浏览器验证):
  - ops 表格类(DataTable 由 wrapper 包裹,安全);ops `.ops-metric-grid` repeat(4) 在 <1050px 收 2 列,安全;
  - navigation `.policy-controls` grid `140px minmax(180px,1fr) 160px auto` + gap 12px(L1 单行),720-760px 之间可能超出窄视口内容宽(760px 断点收 1 列,720px 是平台断点,故 721-760px 区间是潜在横溢窗口——推断);同时它放在 InspectorPanel 内,平台面板应有约束;
  - auth/iam 的 audit-*/session-* 网格为死代码,不参与;
  - openapi treePanel flex 0 0 280px + workspaceRow overflow:hidden(L41),安全。
- **数据表横滚路径**:平台 DataTable 已内置(详见 082 研究,R001);模块不需要自写,死代码 audit-*/session-* 正是 082 迁移前自写网格的残留。

## 5. 与 082 现状/既有研究的对账

- 082 R001 记录「样式以 styles.css 单一 authority(token/reset/Shell/overlay/public UI/loading/responsive/reduced-motion 八分区)+ lenis…」;本次在 HEAD 复核:分区注释实际为 1 token(L14-227)/2 reset(L229-258)/3 Shell(L260-925)/4 overlay(L926-1710)/5 public UI + 5.1 布局原语(L1712-2504)/6 loading(L2506-2635)/7 responsive(L2637-2836)/7.1 滚动体验(L2838-2920)/8 reduced-motion(L2922-2934)——八分区结构延续,`--content-max-*` 与 `--shell-*` token 同源。
- 082 R001 记录「Vitest 151+Playwright 22」;与本研究无样式数字直接冲突。
- c3a23c0(082 快照)与 HEAD 的 :global 计数相同(137),说明样式污染在 082 期间未归零,是遗留债务而非 083 新增。

## 6. 可修复性评估(每项缺陷)

### 6.1 样式污染(:global 泄漏 / 命名分裂 / 私有覆盖)

**修复需触及的文件**:

| 缺陷 | 文件 | 契约面 |
|---|---|---|
| 平台级类缺失(form-error/permission-matrix/role-checklist/permission-row 等) | styles.css 新增 §5.1 原语;iam.module.css L28-80/org L24 删除对应 :global;iam/login/setup、roles/accounts/assignments 页 className 改用平台类 | 平台类名 kebab-case 成为公共契约;模块 className 从裸串改为平台原语/局部类 |
| 私有覆盖 .toolbar | iam.module.css L111-113、organization.module.css L32-36 删除;断点行为上收 styles.css(如 720px .toolbar 统一 grid) | 响应式行为平台单一归属;需核对两模块移动端视觉 |
| 命名分裂(pageMeta/formHint/workspaceTabs 等) | openapi.module.css 局部类迁移为平台原语(page-meta 等)或改用 styles.xxx 局部命名区分;OpenAPIPage.tsx L104、WorkspaceTabs.tsx(模块内)等消费方 | 局部类哈希安全,迁移是纯样貌/语义统一,不破坏级联;工作量中等 |
| 元素级全局(dl/fieldset/legend/label) | navigation.module.css dl 系、organization.module.css fieldset 系改为显式类名(如 .menu-policy-meta/.assign-fields)并同步 tsx | 避免平台组件内含 dl/fieldset 被误伤;建议在新 lint 中禁止裸元素 :global |
| 死代码(auth 9/iam 7/nav 5) | 三文件整段删除;确认 Playwright fixture 无类名引用 | 零功能影响;低风险 |
| 唯一真全局 `:global(.header-zone-action)`(ops L87) | 改为局部类(styles.headerZoneAction)并同步 HeaderAction.tsx L10 | 消除全仓唯一无作用域全局 |

**可守护手段(基于现有 lint-mjs 结构)**:
- lint-architecture.mjs 已有 `sourceFiles()`(只收 ts/tsx)与 `discoverWebUIModuleRoots`;**新增 CSS 扫描扩展**:对每个模块根扩展 `.module.css` 匹配,检查:
  1. `:global\(` 出现即报错(或允许白名单前缀,最终目标为零);
  2. 裸元素 selector(`:global\(([a-z])`)报错;
  3. 模块 CSS 中出现的类名若与 platformStylesSource 中 `.类名` 匹配(如 `.toolbar`/`.page-meta`)报「平台类重复/私有覆盖」——复用 L10-17 已有的 `platformStylesSource.includes` 模式,把方向反转;
  4. platformStylesSource 含模块业务类(L11-15 现有检查)继续保留。
- 可行性:中(纯文本扫描,与现有 lint-architecture 同构);需注意 `.module.css` 中 `styles.xxx` 局部类不受影响(它们以哈希发射,不参与 :global 检查)。
- eslint 侧无需改动(ts/tsx 无样式规则)。

### 6.2 100vh 固定

**文件**:styles.css 11 处(§4.5 列全)。核心 3 处(L266/L278/L476)换 `100dvh`(fallback:先 100vh 再 100dvh 双声明,或 `min-height:100svh`,平台需定策略);drawer/modal 4 处(L1043/L1060/L1526/L1507)同样处理(overflow 容器建议 `max-height:100dvh`);状态页 2 处(L1664/L1682)可保持 100vh 或 100dvh。空布局 window 目标不变。
**契约面**:无 API 变更,纯样式;需浏览器兼容测试(桌面 Chrome/Safari 15.4+/Firefox 101+ 支持 dvh;项目桌面优先,移动为 720px 断点,可论证)。守护:可在 lint-architecture 加「styles.css 主布局禁固定 100vh」的字符串规则,或依赖视觉回归。

### 6.3 居中限宽 / 按场景宽度档

**现状**:page-viewport `max-width:1600px + margin:0 auto` 单一路径;`--content-max-*` 4 档已定义零消费。
**修复**:styles.css L820-828 按场景分配宽度档(Table/Dashboard 全宽、Settings 640-960、Detail 中宽);模块页或平台原语选择宽度档(如 `.page-viewport[data-width="detail"]` 或 settings 布局自带 960px)。**文件**:styles.css、SettingsLayout.tsx(可引宽度档)、新页面模板;契约面:宽度档成为平台原语属性。守护:lint 查 page-viewport 只允许经 token 宽度,防再引入裸 max-width(低优先级)。

### 6.4 滚动模型(独立 Main Workspace/Sidebar 固定)

**现状**:滚动在 .page-viewport 元素级;11c 目标「Fixed Sidebar + 独立滚动 Main Workspace;document/body 不承担页面滚动」。
**文件与契约**:
- ScrollExperience.tsx(panel 模式渲染 .page-viewport/.page-flow,L76-81)、styles.css(.app-workspace L474-478/.page-viewport L820-828/.app-sidebar L273-284);
- Sidebar 桌面端无 position:fixed/sticky → 需在 styles.css 增加桌面 sticky/fixed(如 `.app-sidebar{position:sticky; top:0; height:100vh}` 或改为独立布局),同时解决「内容超高被裁(overflow hidden 无滚动)」——需给 sidebar-nav/wrapper 加 overflow-y:auto;
- Lenis 生命周期(ScrollExperience useEffect)与 panelProps a11y 保持不变。
**风险**:滚动容器从 .page-viewport 改为「独立 workspace 列」会影响所有模块页(它们都挂在 page-flow 内),属于全 WebUI 布局变更,必须与 11a/11c 骨架重写一起评估;**守护**:现有 ScrollExperience 测试(smooth-scroll/edge-band/snap 的 Vitest)可做回归;新增「overflow-y 存在性」lint 规则防 Sidebar 再丢滚动。

### 6.5 全局 Tab Bar 移除

**文件**:AppShell.tsx L145(装配)、L96-102(visitedRoutes/closeTab)、L129-137(键盘导航)、L146(panelProps role 依赖 showTabs);WorkspaceTabs.tsx(整文件退役或保留为可选组件);theme.ts L9/L52(layout.showTabs 契约)——若移除 Tab Bar,`showTabs` 是否仍保留为「关闭后无恢复」需方案裁决(11c L505 明确移除全局页签,保留主导航+面包屑+浏览器历史);styles.css L742-818(workspace-tabs 规则可删,workspace-tab-scroll 磁吸挂钩 L60 ScrollExperience 引用需同步清理)。
**契约面**:zone `workspace-tabs`(WorkspaceTabs.tsx L41 ZoneItems)若存在贡献方需迁移;visitedRoutes 状态机删除;tabpanel a11y 语义移除。**守护**:无现成;Playwright e2e 若断言页签需同步删改。

### 6.6 Footer 固定占用

**现状**:flex 列尾部固定(§4.4),非缺陷项;若 11c 改滚动模型为独立 workspace 列,Footer 保持 workspace 内 flex 尾部即可,无需 position:fixed(否则内容区高度需扣除)。**文件**:AppShell.tsx L147 + styles.css L866-872 + FooterStatus.tsx/HeaderAction.tsx zone 贡献。**守护**:无。

## 7. 缺陷定级(事实+推断,供 11b/11c 任务切片)

| 缺陷 | 证据级别 | 修复量 | 风险 |
|---|---|---|---|
| 死代码 :global(21 处,3 文件) | 事实(零消费) | 小(整段删) | 低(需核 Playwright fixture) |
| 唯一真全局 :global(.header-zone-action) | 事实 | 小 | 低 |
| .toolbar 私有覆盖(iam/organization 720px) | 事实 | 小 | 中(移动端视觉需确认) |
| 平台级类缺失/重复(form-error/permission-*/role-checklist) | 事实 | 中(建原语+迁消费方) | 中 |
| 命名分裂(pageMeta/formHint/workspaceTabs/footerStatus) | 事实 | 中 | 低(局部类已隔离) |
| 100vh(移动端截断) | 事实(11 处) | 中(3 处核心+8 处可选) | 中(浏览器兼容) |
| 居中限宽(1600px 单档) | 事实(token 零消费佐证) | 中(宽度档接线) | 中 |
| 滚动模型(Sidebar 非固定/无滚动容器、page-viewport 元素滚动) | 事实 + 推断(未浏览器验证) | 大(骨架级) | 高(全模块页受影响) |
| Tab Bar 移除 | 事实(装配点已确认) | 中 | 中(zone/键盘/e2e 迁移) |

## 8. 对 083 的影响(任务输入)

1. **11b 样式权威重建的精确基线与验收口径**:以「137 处 :global(6 文件)+ 21 处死代码 + 2 处平台类私有覆盖 + 5 组命名分裂」为输入,修正「122 处」口径;验收规则(§6.1)可直接写入 lint-architecture<｜begin▁of▁sentence｜> sector。
2. **11c 布局骨架重写的现状基线**:滚动发生在 .page-viewport(元素级)已由 ScrollExperience 实现,与 11c「独立 Main Workspace 滚动」的分歧点收敛为「Sidebar 固定/滚动容器归属 + workspace 列结构」;1600px 限宽与 4 个未接线宽度档给出宽度档设计的直接落点。
3. **Tab Bar/Footer 决策**:移除 Tab Bar 的装配点、状态机、zone 挂钩与 a11y 依赖已列全(§6.5),可直接进 design;Footer 固定机制(§6.6)保持即可,无需改造。
4. **可守护性**:现有 lint 结构可低成本扩展(§3.5),11b 的验收可由 lint 自动化覆盖;滚动/Ghost 类缺陷无 lint 覆盖,需 e2e/视觉回归承担。
5. **与 R083-001 的接线**:本档案提供 11b/11c 的「事实层」,R083-001 提供方案差异裁决,两者在 design/tasks 引用时应成对出现。

## 9. 局限

- **未做浏览器渲染**:所有「推断」项(内容超高裁剪、721-760px 横溢、Footer 视觉固定、window 不滚动)均未验证;IFrame/真实视口验证留待计划阶段。
- **Playwright fixture 未核验**:e2e 可能引用样式类名(死代码删除前必须全仓搜索,含 `webui/e2e/`)。
- **行号口径**:styles.css 计数以字节级 ReadAllLines(2934 行,与 read 工具一致)为准;PWSh Get-Content 默认编码错行 9 行,报告中行号均经双口径交叉确认。
- **类名消费统计**:静态正则 + 重点动态类名人工核验;个别模板字符串类名可能遗漏,死代码结论已聚焦在动态类名场景不存在的 audit/session/policy。
- **ops.metric-* 动态类名**:`ops-metric-${key}` 的 key 集合来自后端 metrics 键,未在本次核验服务端键值全集;`.ops-metric-requests/inFlight/exported/dropped` 是否全部 live 待数据契约确认。

## 10. 剩余未知(事实缺口)

1. 「122 处」的来源快照/口径(§3.1 推断,c3a23c0 与 HEAD 均 137)。
2. 桌面端 sidebar 内容超高时的真实表现(裁剪 vs 撑破文档产生 window 滚动)——需浏览器。
3. navigation policy-controls 在 721-760px 区间是否横溢(InspectorPanel 是否限宽)。
4. Playwright fixture 对死类名的引用。
5. ops metrics 键集合与 `.ops-metric-*` 动态度。
6. 平台 `--content-max-*` 四档 token 的意图(方案稿 11c L504 与 token 命名是否一一对应)。