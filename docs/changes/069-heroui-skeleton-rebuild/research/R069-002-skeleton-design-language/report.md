# R069-002 基于 HeroUI 视觉语言重新设计 Web UI 骨架与布局

## 研究问题

（a）HeroUI v3 视觉语言要素；（b）TailAdmin 形态与本项目 067 骨架差距；（c）新骨架规范分层；（d）模块页面重排与验证矩阵。

## HeroUI v3 视觉语言（来自 @heroui/theme / @heroui/styles）

- 半径：`--heroui-radius` 体系（small/medium/large + 组件的 radius prop）。
- 阴影/层级：轻基础阴影 + hover 提升、overlay/dialog 层级阴影（Modal/Drawer/Popover）。
- 间距：4px 标尺上的 density 体系（组件 size sm/md/lg；空格与组件内 padding 由 tv 变体统一）。
- 语义色：primary/secondary/success/warning/danger/foreground/background/content1..4 等 HSLA 变量；明暗双主题（`.dark`），本项目已联动 `<html>.dark`。
- 组件状态：hover/focus-visible/disabled/pressed 由 RAC 统一；focus ring 用主色。

## TailAdmin 参考形态 vs 067 骨架差距

| TailAdmin 形态 | 067 现状 | 差距 |
| --- | --- | --- |
| 固定侧栏 + 固定顶栏 + 内容滚动 | 已有（.app-shell 网格 + .page-viewport 滚动） | 侧栏/顶栏视觉为自绘，非 HeroUI 语言 |
| 统计卡行（图标+数值+标签+趋势） | StatGrid/StatCard（已 Card 化） | 已接近，需对齐 HeroUI 语义色/密度 |
| 标题区块卡（card header + body） | PageSection（Card 化） | 已接近 |
| 表格卡（header + table + 分页 footer） | DataCard + DataTable + Pagination | 已 HeroUI，需统一间距 |
| 表单/设置卡 | PageSection + form-panel | 已接近 |
| 工具栏/筛选 | `.toolbar` 自绘 flex | 需换 HeroUI Toolbar/Surface 语言 |

差距集中在：**Shell（侧栏/顶栏/页签/遮罩）仍是自绘**，页面级容器（page-header/toolbar/card-grid/item-card）的间距/圆角/阴影 token 未与 HeroUI 变量统一。

## 新骨架规范（四层）

1. **布局 token**：`styles.css` 的 `--space-*`/`--radius-*`/`--shadow-*`/`--shell-*` 对齐 HeroUI 变量（radius/space 引入 `--heroui-*` 引用或同值），页面容器间距（section-gap/card padding/工具栏）统一为 HeroUI 密度标尺；`tailwind.config.js` 用 `extendTheme` 把 preset 语义色映射到 HeroUI primary。
2. **Shell 组件由 HeroUI/RAC 拼装**：
   - Sidebar：`Surface`（或 Tailwind 布局）+ `Link`/`Tooltip`/`Avatar`/`Badge`/`Separator` + 递归菜单样式收口为平台类；
   - Header：`Header`（HeroUI）+ `Toolbar` + `Separator` + `TextField` 搜索 + `Kbd` + `Avatar` + `Dropdown`/`Menu`（账号）+ 已有 IconButton；
   - WorkspaceTabs：HeroUI `Tabs` 复合（RAC roving 键盘）承载访问页签 + 自定义 close/refresh；
   - 遮罩：`ConfirmDialog`/`Drawer`/`ThemeDrawer`/`RouteSearch` 迁到 **RAC 受控 `Modal`/`Dialog`**（显式依赖 react-aria-components，HeroUI 自身底座）承载，视觉用 HeroUI 语义类 + Tailwind；关闭语义/aria 保持；
   - `Switch`/`Checkbox`：RAC `Switch`/`Checkbox`（label+input）承载，视觉对齐 HeroUI pill/box（平台类）。
3. **页面模板**：`PageHeader`（HeroUI Header 化）→ `StatGrid` → `SectionCard`（Card+Header+Content+Footer）→ `CardTable`（DataCard）→ `FormCard` → `Toolbar`（HeroUI Toolbar）→ `EmptyState` → `Pagination`；暗色与密度全局生效。
4. **验证**：SSR 空输出的遮罩/Switch/Checkbox 断言改为客户端渲染（vitest jsdom + createRoot/act）或 e2e；e2e 全部语义断言（role/aria）保持；新增 069 骨架截图证据。

## 事实与推断

**事实**：HeroUI 组件面与 token 语言如上；067 骨架为自绘；Modal/Drawer 为 DialogTrigger 模式；Switch/Checkbox 缺交互 input；本仓库已有 dark class 联动与 Tailwind。

**推断**：RAC 受控 Modal/Switch/Checkbox 可以补齐 HeroUI 缺失的受控交互而保持在 HeroUI 体系内（HeroUI 本身基于 RAC）；TailAdmin 形态与现状差距主要在 Shell 与 token 统一。

## 对本任务的影响

- requirements/design/tasks 按四层展开；Shell 重构 + 页面模板重排 + token 对齐 + 测试/e2e 校准与截图。
- 「侧栏/顶栏没有 HeroUI 原生组件」属组件库能力边界：用 HeroUI 控件 + Tailwind 布局拼装，符合「由 HeroUI 组件拼装」的可行语义，需在文档如实说明。