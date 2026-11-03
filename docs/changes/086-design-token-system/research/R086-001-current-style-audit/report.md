# R086-001 现状审计：公共框架几何稳定性与 Design Token 缺失

> 研究快照：HEAD `8614e77`（085 Rev.2 自动页面标签落地后）。复核日期 2026-08-28。
> 方法：读取 `webui/src/styles.css`（3363 行）、`webui/src/theme.ts`、`webui/src/App.tsx`、
> `webui/src/components/AppShell.tsx`、`webui/src/routes.tsx`、`webui/src/components/shell/*`、
> `webui/src/ui/index.tsx`、7 个业务模块 `binding/webui/web/*.module.css`、`tailwind.config.js`
> 与 `@heroui/theme` 装配；用脚本枚举散落 px/hex/!important；未启动应用、未写入外部状态。

## 1. 研究问题

后台公共框架（AppShell、Header、WorkspaceTabs、Sidebar、Table、Form 容器）在不同路由切换、
light/dark 与 compact/default density 切换下出现尺寸/样式不稳定。本研究表明：污染源是
**缺乏唯一 Design Token 系统**——宿主与业务 CSS 大量散落 magic values、重复语义值、
页面级覆盖与 HeroUI 默认值混用，且没有 primitive/semantic/component 三级 token 继承关系。

## 2. 发现的事实

### 2.1 宿主平台样式 authority 现状（webui/src/styles.css）

- `:root` 已声明一批语义变量（`--primary*`、`--surface*`、`--text*`、`--border*`、
  `--radius-*`、`--space-1..8`、`--font-scale-*`、`--control-height-*`、`--content-max-*`、
  `--shell-*`、`--z-*`、`--motion-*`），但它们是**扁平混排**的：同一文件内既无
  primitive（基础尺度/色板）层，也无 component（Header/Sidebar/Tabs/Table/Form 各自）层，
  部件直接消费全局语义变量，无法按组件维度统一调整。
- **magic values 大量存在**：Shell/Tabs/Sidebar 区（styles.css 264–1050 行）枚举到约
  105 处裸 px 字面量，例如：
  - `.topbar { height: var(--shell-header-height) }`（token 化了，但 `--shell-header-height: 64px` 本身是裸值）；
  - `--shell-tabs-height: 42px`（裸值，未由任何 density/size token 推导）；
  - `.sidebar-link { min-height: 40px; padding: 0 11px; gap: 11px }`、`.workspace-tab { min-width: 96px; max-width: 220px }`、
    `.brand-mark { width/height: 32px; border-radius: 9px }`、`.workspace-tab-close { width/height: 22px }`、
    `.icon-button { width/height: 34px }`、`.rac-menu-item { padding: 9px }` 等。
- **裸色值**：`:root`/dark/preset 之外的规则里仍有 `#fff`、`#dc2626`、`#ef4444`、
  `border-left-color: #059669/#d97706/#dc2626`（state 页）、`.field-error { color: #dc2626 }`、
  `.field-error-message { color: #dc2626 !important }`、`.color-preset.* { --color: #3b82f6,... }`
  （五组 preset 颜色在 theme 与 color-preset 两处复制）。
- **!important 8 处**：`.field-error-message`、1 处 HeroUI 清除等。
- **density 处理不统一**：`[data-density="compact"]` 用 8 个分散选择器逐条覆盖
  （`.sidebar-link min-height:34px`、`.page-viewport padding-top:18px`、`.form-field gap:5px`、
  `.capability-banner padding:10px 12px` 等），没有“density → 尺寸 token 缩放”的单一管道；
  DataTable 自有一套 `--table-row-height-{compact,default,comfortable}` 变量。
- **宽度档规则无生产端**：`[data-page-width="settings|detail|form"] .module-page { max-width: ... }`
  在 styles.css 中定义，但**没有任何组件写入 `data-page-width`**（全库 grep 无 JSX 生产端）——
  属于死规则，属于“平行/残留样式规格”。
- **组件 token 缺失**：没有 `--workspace-tabs-height` 之类的组件级 token；
  `--shell-tabs-height` 被 `.workspace-tabs` 与 `ShellSkeleton` 共用，但取值即裸 42px。

### 2.2 组件库 token（HeroUI/Tailwind）

- `tailwind.config.js` 仅 `plugins: [heroui()]`；Tailwind v4 由 styles.css `@config` + `@import "tailwindcss"` 装配。
- HeroUI 提供 `--heroui-*` 主题变量（`--heroui-primary` 等由 `data-theme-preset` 同步）；宿主
  `--primary*` 与 `--heroui-primary*` 两套语义色重复维护（styles.css 每 preset 同时写两份）。
- HeroUI 各组件（Button/Input/Table/Switch/Checkbox）使用 `--heroui-*` 与其自身字号/尺寸；
  宿主公共控件（如 `.icon-button`、`.rac-menu-item`）又用 `--radius-*`/`--space-*`/裸 px 重画，
  两套体系并存，易在组件边界（focus ring、高度、padding）产生不一致。

### 2.3 业务模块 CSS 污染

7 个模块 CSS 共约 1241 行，普遍存在：

- **裸选择器泄漏**：ops 大量 `.opsModule :global(.ops-grid / .diagnostic-*)`（57 条可疑规则）、
  openapi `.shellSearchTrigger`、organization `:global(fieldset)` 等——业务全局类与宿主布局类重名风险。
- **裸色值**：openapi.module.css `#16a34a/#fff/#d97706/#dc2626`（status chip）、
  ops 旧示例等；部分与 `--success/--warning/--danger` 重复。
- **裸 px**：openapi（padding/radius/font-size 若干、`border-radius:8px/12px`）、ops、
  organization、settings、navigation、iam、auth 各类间距/高度/圆角字面量，很少复用
  `--space-*`/`--radius-*`/`--font-scale-*`。
- **重复语义**：`.diagnostic-heading h2, .diagnostic-card h3 { font-size: 14px; font-weight: 600 }`
  与宿主 `.page-header h1 { font-size:24px }` 体系并存；settings/organization 局部控件与宿主原语视觉近似但独立定义。

### 2.4 根布局与渲染分流

- `App.tsx` 中 `<Route element={<AppShell/>}>` 是唯一 app 布局宿主：AppShell 渲染
  Sidebar + Header + WorkspaceArea（Tabs + Outlet/Panels）。已满足“AppShell 由根布局唯一渲染”。
- 但 `WorkspaceArea` 内部存在**双滚动容器/双 padding 定义**：普通 fallback 用
  `<ScrollExperience target="panel">` → `.page-viewport`（`padding: var(--space-6) clamp(...)`），
  mounted panel 用 `.workspace-panel-scroll`（同样的 `padding: var(--space-6) clamp(18px,3vw,40px)`）
  复制同一段页面衬距；两处 padding 字面量重复，是“平行规格”的典型。
- `RouteSlot`/`ManifestRouteView` 只在 fallback 路径渲染 `.page-viewport/.page-flow`；
  mounted 面板内 `renderPanelRoutes` 直接渲染业务页（无统一 ContentViewport 语义层）。
- 业务页各自输出 `.split-workspace`/`.module-page`/`.settings-*` 等容器，页头、
  内容宽度、间距由各模块自行排版，缺少“ContentViewport 语义唯一入口”。

## 3. 事实与推断分离

- **事实**：styles.css 是一份 3363 行、token/规则混排的单文件；Shell/Tabs/Sidebar 有 ~105 处裸 px；
  8 处 !important；若干裸 hex；`data-page-width` 无生产端；模块 CSS 有大量 `:global` 与裸值；
  Header/Sidebar/Tabs 高度来自裸值 token（64px/42px）；density 用散点覆盖实现。
- **推断**：这些数值的漂移（例如 tabs 高度 42px 在 compact 下仍 42px、WorkspaceTabs 与
  fallback/panel 双 padding）是“不同路由下公共 Shell 几何不稳定”的根因；缺少唯一 token
  继承关系使 light/dark/preset/density 无法统一缩放。

## 4. 主源

- W3C CSS Custom Properties / CSS Variables 规范语义（继承、回退、`@property` 类型）。
- Design Tokens Community Group：primitive / semantic / component 分层惯例。
- HeroUI（@heroui/theme）与 Tailwind v4 官方文档（`@config`/`@theme` 扩展）。
- WAI-ARIA APG Tabs（WorkspaceTabs 键盘/标签语义复核）。

## 5. 适用与不适用场景

- 适用：本仓库 WebUI 公共框架与全部已接入模块页面的样式统一；后续新增页面/组件复用 token。
- 不适用：后端 Go 端样式；非 WebUI 的独立前端（frontend/ 目录不在本仓库 scope）。

## 6. 局限与刷新条件

- 未启动浏览器逐页 computed style 测量（方案确认后由 QA 任务补测并锁定基准）。
- 模块 CSS 污染统计为脚本枚举，个别 `:global` 可能属有意为之（如 ops 收敛前的历史类），
  需在实施 delta 中逐条裁决。
- 若 `@heroui/theme` 升级或 Tailwind 主版本变化，本 token 分层需重核。

## 7. 对任务的影响（结论）

- 需要在 styles.css 建立 **primitive（base scale/color/typography）→ semantic（surface/text/
  accents/status）→ component（header/sidebar/workspace-tabs/table/form 等）** 三级 token，
  并用 `@property`/`:root`/`[data-color-scheme]`/`[data-theme-preset]`/`[data-density]` 分层覆写。
- `--workspace-tabs-height` 应成为组件 token，由全局 density/size primitive 推导
  （如 `--size-control-md`/`--density-multiplier`），而不是裸 42px；Header/Sidebar 同理。
- AppShell 保留为根布局唯一渲染方；业务路由改为只渲染 **ContentViewport**（统一滚动容器 +
  `data-page-width` 语义），消除 `.workspace-panel-scroll`/`.page-viewport` 双 padding 复制。
- 逐页/逐组件清扫裸 px/hex/!important/重复语义，改消费 token；删除死规则与重复变量。