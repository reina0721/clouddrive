# 069 WebUI 骨架 HeroUI 拼装与布局重构 — 设计方案

> 支撑研究：[R069-001](research/R069-001-current-skeleton-audit/report.md)、[R069-002](research/R069-002-skeleton-design-language/report.md)；需求：[requirements.md](requirements.md)

## 1. 目标

把 068 之后仍自绘的 Shell 与页面骨架替换为「HeroUI 组件 + RAC 受控交互底座 + Tailwind 布局」拼装，并按 HeroUI 视觉语言重建骨架与布局规范、重排全部业务模块页面；`@webui/sdk/ui` 导出契约与平台契约层不回归。

## 2. 骨架拼装目标结构

### 2.1 Shell

| 区域 | HeroUI/RAC 拼装 | 保留的平台逻辑 |
| --- | --- | --- |
| AppShell 网格 | `Surface` 语义容器 + `Separator` 分区，Tailwind 布局 | 访问页签状态、移动抽屉 inert/focus、快捷键 |
| AppSidebar | `Surface`/自绘容器 + `Link`+`Tooltip`+`Badge`+`Avatar`+`Separator`；菜单项平台类 | 菜单树、active 祖先、collapsed/mobile |
| AppHeader | `Header` + `Toolbar` + `Separator` + `TextField`(搜索) + `Kbd` + `Avatar` + `Dropdown`/`Menu` | breadcrumb、语言、全屏、主题、zone 注入 |
| WorkspaceTabs | `Tabs` 复合（RAC roving） | visited 路由、close/refresh、面板语义 |
| RouteSearch | RAC `Modal`+`Dialog`（受控） | 过滤纯逻辑、键盘导航、aria-activedescendant |
| ThemeDrawer | RAC `Modal`+`Dialog`（右侧 placement 样式） | experience 配置、旧主题迁移 |
| ConfirmDialog | RAC `Modal`+`Dialog`（center）+ HeroUI 语义 | 确认语义、Escape/backdrop |
| SDK Drawer | RAC `Modal`+`Dialog`（end placement） | 关闭语义 |
| Switch/Checkbox | RAC `Switch`/`Checkbox`（label+input） | 平台样式类（pill/box） |

- 显式依赖：`react-aria-components`（HeroUI v3 自身底座，MIT）加入 package.json。
- 遮罩视觉：RAC Modal 的自定义类走 Tailwind + HeroUI 变量（`bg-content1`/`border-default`/阴影）。

### 2.2 页面模板（新骨架规范）

```
PageHeader（HeroUI Header 化：eyebrow/title/description/actions）
→ StatGrid（KPI 行，语义色 tone）
→ SectionCard（Card.Header + Card.Title/Description + Card.Content + Card.Footer）
→ CardTable（Card 包装 DataTable + Pagination footer）
→ FormCard（Card 包装 form-panel）
→ Toolbar（HeroUI Toolbar 语言）/ EmptyState / InlineAlert
```

- `.page-header`/`.page-sections`/`.toolbar`/`.card-grid`/`.item-card` 等平台容器类保留（语义），样式对齐 HeroUI 密度标尺。

## 3. 布局 token 与主题

- `styles.css` token 对齐：`--space-*`、`--radius-*`、`--shadow-*` 以 HeroUI 变量为基准；页面容器 gap/padding 用统一标尺。
- preset 语义色：`tailwind.config.js` 的 `heroui({ themes })` 目前用 CSP；改为在 `:root[data-theme-preset=...]` 覆写 `--heroui-primary*` 系列 + 既有 `--primary` 同步，保证 preset 切换同时驱动 HeroUI 与平台样式。
- 暗色：保持 `.dark` class 联动；HeroUI 语义色随主题自动切换。

## 4. 文件影响

| 区域 | 文件 |
| --- | --- |
| 依赖 | webui/package.json、pnpm-lock.yaml（+react-aria-components） |
| 主题 | webui/tailwind.config.js、webui/src/theme.ts（preset→--heroui-*）、styles.css（token 对齐/Shell 类） |
| Shell | webui/src/components/AppShell.tsx、components/shell/*、RouteSearch.tsx、ThemeDrawer.tsx |
| SDK | webui/src/ui/index.tsx（ConfirmDialog/Drawer/Switch/Checkbox/PageHeader/Toolbar 拼装） |
| 模块页面 | internal/module/*/binding/webui/web/*.tsx（按模板重排）+ *.module.css（收口） |
| 测试 | webui/src/*.test.*（遮罩/Switch 断言客户端化）、webui/e2e/webui.spec.ts（class 选择器校准 + 069 截图） |
| 文档 | docs/development/webui.md、webui/README.md、docs/architecture/technology-selection.md、docs/changes/README.md、069 变更文档 |

## 5. 失败语义与验证

- 单点替换后断言红 → 该点回滚为当前实现并在 tasks 记录，门禁绿后再继续（单轨）。
- 遮罩迁移以 e2e dialog 断言为最终门禁；SSR 空输出的单测改客户端渲染。
- 全部替换后通过 REQ-D 全部门禁 + 069 截图（亮/暗/移动）。

## 6. 实施顺序（任务）

1. token/主题基础（B1/B2）；
2. RAC 依赖 + 遮罩/Switch/Checkbox 底座（A4 先做可独立验证的部分）与测试客户端化（D1）；
3. Shell 拼装（A1/A2/A3）+ 页面模板规范（C1）；
4. 模块页面重排（C2）+ 模块 CSS 收口；
5. e2e 校准与截图（D2）+ 文档（E1）+ 提交（E2）。

## 7. 待确认决策

1. 遮罩与 Switch/Checkbox 采用 RAC 受控底座（显式依赖 react-aria-components）——推荐；
2. 骨架规范按第 2.2 模板与 HeroUI 密度标尺实施，module 页面整体重排——推荐；
3. preset 语义色同步驱动 HeroUI（--heroui-* 覆写）——推荐；
4. 测试策略：SSR 空输出断言改客户端渲染，e2e 为最终门禁——推荐；
5. 侧栏/顶栏无 HeroUI 原生组件，用 HeroUI 控件 + Tailwind 布局拼装并如实记录——推荐。