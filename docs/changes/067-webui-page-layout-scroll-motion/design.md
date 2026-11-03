# 067 WebUI 业务页面布局骨架与滚动/动效体验 — 设计方案

> 支撑研究：[R067-001](research/R067-001-layout-skeleton-reference/report.md)、[R067-002](research/R067-002-scroll-motion-technology/report.md)；需求：[requirements.md](requirements.md)

## 1. 目标

本变更在 WebUI 平台内完成三件事：

1. 修复组织模块页面的用户可见报错（缺失翻译键 + 未捕获操作失败）；
2. 建立 TailAdmin 式平台布局骨架原语，并把全部业务模块页面迁移到该骨架；
3. 实现滚动体验运行时（Lenis 阻尼平滑滚动、边缘阻尼/橡皮筋、磁吸吸附、显式滚动劫持、滚动条稳定插槽）与弹入响应（Reveal），并由 ThemePreferences `experience` 派生配置驱动，尊重 reduced-motion。

不修改模块 Binding/Manifest/路由/服务端契约/数据库/Go 行为；不引入动画库/Tailwind（059 边界保持）；Lenis 作为唯一新增第三方依赖并在平台窄边界内封装（R067-002）。

## 2. 术语

| 词 | 含义 |
| --- | --- |
| 区块卡片（page-section） | TailAdmin 式白色内容卡：卡头（标题/说明/动作）+ 卡体 + 可选卡脚 |
| 统计行（stat-grid） | 横向 KPI 卡行：图标 + 数值 + 标签 + 趋势 |
| 数据表格卡片（data-card） | 表格的外层卡：卡头 + 表格 + 页脚（分页/汇总） |
| 名录卡网格（card-grid） | 卡片列表网格（替代既有 admin-grid） |
| 弹入响应（Reveal） | 元素进入视口时的 spring 弹入进场 |
| 派生配置（experience） | ThemePreferences 的 experience 组，落到 `data-experience-*` |

## 3. 组织模块报错修复（任务 A）

### A1 翻译键

- `internal/module/organization/binding/webui/web/locale/{zh-CN,en-US}.json`：把 `webui.organization.saved|conflict|revision` 重命名为 `webui.organization.assignments.saved|conflict|revision`（消费侧键不变）。
- 新增通用错误键 `webui.organization.error`（en-US "Operation failed" / zh-CN 「操作失败」）供 A2 使用。
- 新增用例：在组织模块 `management.test.ts`（或宿主测试）中对「页面消费键 ⊆ locale 定义键」做快照断言，防止同类缺失回归。

### A2 操作失败反馈

- `DepartmentsPage.tsx`：创建、归档/恢复 `.catch(() => setError(t("webui.organization.error")))` 并在页面呈现（沿用 `page-meta`/InlineAlert 语义，见 B）。
- `PositionsPage.tsx`：同 A2 处理。
- `AssignmentsPage.tsx`：保存冲突已在 catch 内重载 + 显示 conflict 键；补充 `getAssignment`/列表加载失败的低敏提示（可选，最小化）。

### A3 验证

- `pnpm lint:i18n`、typecheck、Vitest；页面进入 e2e 断言无「翻译资源缺失」文本。

## 4. TailAdmin 式布局骨架（任务 B）

### B1 平台原语（`webui/src/sdk/ui` + `styles.css` public UI 分区）

新增 SDK UI 组件（`webui/src/ui/index.tsx` 导出，`@webui/sdk/ui` 透传）：

| 组件 | 结构 | 说明 |
| --- | --- | --- |
| `PageSection` | `section.page-section` > `header.page-section-header`(kicker/title/description/actions) + `div.page-section-body` + 可选 `footer.page-section-footer` | 区块卡片；内部挂 `Reveal`（见 C6） |
| `StatCard`/`StatGrid` | `div.stat-grid` > 每项 `div.stat-card`（`stat-icon` 可选 + `stat-copy`(strong/small) + `stat-trend` 可选） | KPI 行；`stat-grid` 支持计数与断点 |
| `DataCard` | `section.data-card` > header(title+actions) + body(DataTable) + footer(Pagination) | 表格卡片 |
| `Reveal`/`RevealList` | 见 C6 | 弹入进场包装 |
| `Toolbar`（纯样式类） | `.toolbar` 平台样式（flex wrap 工具行） | 替代模块各自 toolbar |

保留 `Surface/PageHeader/DataTable/DataToolbar/FilterPanel/Pagination/EmptyState/InlineAlert` 等既有原语，仅调整视觉挂接。

平台样式（`styles.css` 分区 5 追加）：

```css
.page-sections   /* 主内容纵向栈 */
.page-section / .page-section-header / .page-section-body / .page-section-footer
.section-kicker / .section-title / .section-description
.stat-grid / .stat-card / .stat-icon / .stat-copy / .stat-value / .stat-label / .stat-trend
.data-card / .data-card-header / .data-card-body / .data-card-footer
.card-grid / .item-card
.toolbar / .page-meta / .form-panel
```

以上 selectors 不属于 lint-architecture 封禁清单（已核对）。

### B2 模块页面迁移对照

统一目标结构（逻辑/操作 ID/权限/i18n 键不变）：

| 页面 | 目标结构 |
| --- | --- |
| iam Accounts | 页头 + `page-section`(创建工具栏) + `page-section`(选中账号管理) + `page-section`(筛选工具栏 + 名录卡网格 + 分页脚) |
| iam Roles | 页头 + 创建工具栏卡 + 角色权限管理卡 + 角色名录卡 + 分页脚 |
| iam Permissions | 页头 + 权限名录卡 |
| iam Sessions | 页头 + 工具栏 + 会话表格卡（保留 `.session-*`） |
| iam Security | 页头 + 表单面板卡 |
| org Departments | 页头 + 创建工具栏卡 + 部门树名录卡（保留 h2 标题语义） |
| org Positions | 页头 + 创建工具栏卡 + 岗位名录卡 |
| org Assignments | 页头 + 分配表单卡 |
| auth Audit | 页头 + 筛选工具栏 + 审计表格卡（保留 `.audit-*`） |
| navigation Menus | 页头 + revision 页元 + 策略卡网格（保留 `.policy-card`/`.revision code`） |
| ops Dashboard | 页头 + `stat-grid`（替代 ops-summary）+ 概览区块卡 + 指标区块卡 + 诊断卡组（保留 ops-* 专属样式） |
| ops Capabilities | 页头 + 工具栏/筛选 + banner + 数据表格卡（保留 DataTable 语义） |

### B3 模块 CSS 收口

- 删除各模块 CSS Module 中被平台替代的 selector（`.toolbar/.admin-grid/.admin-card/.admin-meta` 等）；保留模块专属（`ops-*`、`policy-*`、`session-*`、`audit-*`、`permission-matrix`、`role-checklist`、`iam-form`、`auth-*` 等）。
- `lint-architecture` 已封禁的业务 selector 继续只出现在模块 CSS。

## 5. 滚动体验运行时（任务 C）

### C1 依赖

- `webui/package.json` 增加 `lenis@^1.3.26`（R067-002 结论；MIT；`corepack pnpm add` 更新 lockfile）。
- 记录到 `docs/architecture/technology-selection.md`（新增第三方结论）。

### C2 目录与模块

```
webui/src/scroll/
  smooth-scroll.ts   SmoothScrollController（Lenis 窄边界封装）
  edge-band.ts       computeEdgeBand 纯函数 + EdgeBand 类（视觉回弹）
  scroll-hijack.ts   hijackHorizontalWheel 工具（wheel deltaY → scrollLeft）
  snap.ts            applyMagneticSnap（data-snap-x 类应用）
  ScrollExperience.tsx  Provider 组件（装配以上 + 读 experience/read 属性）
webui/src/motion/
  use-in-view.ts     useInView(IntersectionObserver, 缺失回退可见)
  reveal.tsx         Reveal / RevealList（spring 弹入）
```

### C3 SmoothScrollController（Lenis 边界封装）

- 公开窄契约：`attach({ wrapper, content })`、`setSettings({ enabled, damping, reduced })`、`destroy()`、`scrollTo(y)`。
- Lenis 用法：`new Lenis({ wrapper, content, duration, easing, smoothWheel: true, syncTouch: false })`（syncTouch=false 保留触控原生惯性）；rAF 循环随实例；`classes` 默认。
- 阻尼档位：`subtle {duration:0.8}` / `standard {duration:1.2}` / `relaxed {duration:2.0}`，easing 沿用 Lenis 默认（指数衰减）。
- `enabled=false` 或 `reduced=true` → `destroy()` 回退原生；`scrollbar-gutter` 与平滑无关。
- 构造注入 Lenis 工厂（测试注入 fake；不 mock window 行为）。
- 挂载点：AppShell 的 `.page-viewport`（wrapper）+ 新增 `.page-flow`（content）；BlankLayout 挂 window（`document.documentElement`）。

### C4 边缘阻尼 / 橡皮筋（EdgeBand）

- 纯函数：`computeEdgeBand(deltaY, scrollTop, maxScroll)` → `{ offset, direction }`（越界位移 clamp 到 ±16px 量级）。
- 表现：`.page-flow` 瞬态 `--edge-band-offset`（translateY）+ 边缘辉光（`.page-edge` 上下渐变条），`--ease-emphasized` 回弹；`overscroll-behavior-y: contain`。
- 监听：`.page-viewport` 的 wheel/touchmove（Lenis 不拦截事件传播）；仅当 `scrollTop` 在边界上且滚动方向指向边界外时触发。
- 设置 `edgeDamping=false` 或 reduced → 不挂载。

### C5 磁吸吸附与显式滚动劫持

- 磁吸：CSS `.snap-x { scroll-snap-type: x proximity; }` + `scroll-snap-align: start`；`applyMagneticSnap(container, enabled)` 切换类；应用于 `.workspace-tab-scroll`（页签轨）与声明 `data-snap-x` 的滚动区。
- 劫持：`hijackHorizontalWheel(container)`：wheel 事件目标位于容器内且容器可横向滚动时，`deltaY → scrollLeft` 并 `preventDefault`；应用于横向溢出的 `.data-table-wrap`（ops 能力表、审计表等，经 `data-scroll-hijack="x"`）；设置 `scrollHijack=false` 时不挂载。

### C6 弹入响应（Reveal）

- `useInView(options)`：IntersectionObserver（`rootMargin` 默认 `0px 0px -8% 0px`、`threshold` 0.01）；无 IO（jsdom）回退 `{ inView: true }`。
- `Reveal`：`<Reveal as="div" rhythm delay>` → 元素带 `data-reveal="hidden|shown"`、`data-reveal-rhythm`、`style={{ transitionDelay }}`；CSS `--reveal-duration/--reveal-ease/--reveal-offset` 由节奏预设驱动（calm/balanced/playful）。
- `RevealList`：children index 派生 delay（stagger 步进 token `--reveal-stagger`）。
- 降级：`data-motion=reduce` 或 experience `reveal=false` → 直接渲染可见态（无 hidden 类）。
- 应用：`PageSection` 内部挂 reveal；名录卡网格用 `RevealList`；领域列表/表格用 `Reveal`。

## 6. 派生配置设置（任务 D）

### D1 theme.ts

```ts
type ScrollbarStrategy = "stable" | "overlay";
type DampingTier = "subtle" | "standard" | "relaxed";
type RevealRhythm = "calm" | "balanced" | "playful";
type ThemeExperience = {
  smoothScroll: boolean;
  damping: DampingTier;
  edgeDamping: boolean;
  magneticSnap: boolean;
  scrollHijack: boolean;
  reveal: boolean;
  revealRhythm: RevealRhythm;
  scrollbar: ScrollbarStrategy;
};
ThemePreferences = { ..., experience: ThemeExperience };
defaults: { smoothScroll: true, damping: "standard", edgeDamping: true,
  magneticSnap: true, scrollHijack: true, reveal: true, revealRhythm: "balanced",
  scrollbar: "stable" }
```

- `readTheme`：合法对象直接读取；**旧结构（无 experience）迁移补默认值**（升级 `isLegacyThemePreferences` 分支）。
- `applyTheme`：`document.documentElement.dataset.experienceSmoothScroll/Damping/EdgeDamping/MagneticSnap/ScrollHijack/Reveal/RevealRhythm/Scrollbar` 与既有 data-motion 一并写入。

### D2 styles.css

- token 增加：`--scrollbar-slot`（预留宽度参考）、`--reveal-duration/--reveal-ease/--reveal-offset/--reveal-stagger`、`--edge-band-max`、节奏预设变量。
- `[data-experience-scrollbar="stable"] .page-viewport, [data-experience-scrollbar="stable"] html { scrollbar-gutter: stable; }`；overlay 档 `scrollbar-gutter: auto`。
- Reveal/edge-band/snap 样式进分区 6/9（motion/scroll 分区）。
- 分区 8 reduced-motion 规则继续覆盖 Reveal/edge-band。

### D3 ThemeDrawer

- `ThemePanel` 增加 `"experience"`；新面板：开关（smoothScroll/edgeDamping/magneticSnap/scrollHijack/reveal）+ 三段选择（damping/revealRhythm/scrollbar）。
- host locale en-US/zh-CN 新增 `webui.host.experience.*` 文案键。

## 7. Shell 集成

- `AppShell.tsx`：`<main class="page-viewport">` 内新增 `<div class="page-flow">` 包住 `<Outlet/>`；`ScrollExperience` 挂载（读 `theme.experience` 与 `data-motion`），卸载时销毁。
- `BlankLayout.tsx`：`ScrollExperience` 以 window 为目标挂载（login/setup 全站平滑）；`.blank-layout` 页面保持原生滚动条 + `html` gutter（stable 默认）生效。
- 不改变 Shell 静态插拔/路由结构；app-shell 测试同步 `.page-flow` 结构断言。

## 8. e2e 与视觉证据

- 更新 `webui/e2e/webui.spec.ts`：组织/IAM 断言按新骨架语义等价调整（标题、卡片、label 值、`.policy-card`、`.revision code` 等保留）。
- 新增 `webui/e2e/webui-experience.spec.ts`（dev project）：
  - 默认 `data-experience-scrollbar="stable"` 与 `data-experience-smooth-scroll="true"`；
  - ThemeDrawer 体验面板切换 → dataset 变化；
  - Reveal 元素出现 `reveal-shown` 类；reduced-motion 下无 `reveal-hidden`；
  - 截图：账号页/部门页/分配页/仪表盘（桌面 + 折叠 + 滚动条插槽证据）。
- mock project 规格保持通过（零后端引导不受影响）。

## 9. 文件影响清单

| 区域 | 文件 |
| --- | --- |
| 依赖 | `webui/package.json`、`pnpm-lock.yaml`（+lenis） |
| 平台样式 | `webui/src/styles.css`（token + 布局原语 + scroll/motion 分区） |
| 平台组件 | `webui/src/ui/index.tsx`（PageSection/StatCard/StatGrid/DataCard/Reveal 导出）、`webui/src/sdk/ui/index.tsx`（透传）、新建 `webui/src/motion/{use-in-view,reveal}.tsx`、新建 `webui/src/scroll/{smooth-scroll,edge-band,scroll-hijack,snap,ScrollExperience}.tsx` |
| 主题 | `webui/src/theme.ts`、`webui/src/components/ThemeDrawer.tsx`、host locale |
| Shell | `webui/src/components/AppShell.tsx`、`webui/src/components/shell/AppSidebar.tsx`（页签轨 snap 类，若有） |
| 模块页面 | `internal/module/{iam,auth,navigation,ops,organization}/binding/webui/web/*.tsx` 与 `*.module.css`、org locale |
| 测试 | 新增 scroll/motion/theme/ui/e2e 用例；更新 app-shell.test.tsx、e2e |
| 文档 | `docs/changes/067-*/`、`docs/development/webui.md`、`webui/README.md`、`docs/architecture/technology-selection.md`、`documentation-impact.yaml` |

## 10. 失败语义与验证

- 平滑滚动失败 → 销毁 Lenis，回退浏览器原生滚动（可见、可观测，属设计内降级，非静默双轨）。
- Reveal/edge-band/hijack/snap 失败 → 对应功能不挂载，页面结构与内容不受影响。
- 页面迁移后必须通过 `pnpm typecheck`、`pnpm lint`、`pnpm lint:modules`、`pnpm test`、`pnpm build`、`pnpm generate:check`、`pnpm e2e -- --workers=1`。
- Go 侧无代码改动；`go build ./...` 与既有 Go 测试应保持通过（作为回归哨兵）。

## 11. 待确认决策（本变更默认按推荐项实施）

1. 引入 `lenis` 作为平滑滚动第三方（R067-002 推荐）——确认；
2. 弹入响应自研（不引入动画库），Reveal 内建到 PageSection/RevealList——确认；
3. experience 派生配置默认值（稳定插槽 / 平滑开 / standard / 边缘开 / reveal 开 / balanced）——确认；
4. 页面迁移保持操作 ID/权限/i18n 键不变，e2e 断言按语义等价调整——确认；
5. 平台收编通用布局样式（toolbar/card-grid/stat-grid/data-card 等进 styles.css），模块 CSS 收口——确认。