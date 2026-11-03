# 069 WebUI 骨架 HeroUI 拼装与布局重构 — 需求规格

> 支撑研究：[R069-001](research/R069-001-current-skeleton-audit/report.md)（现状复核）、[R069-002](research/R069-002-skeleton-design-language/report.md)（HeroUI 视觉语言与骨架分层）

## 1. 目标与范围

用户两点要求：

1. 核实「当前 Web UI 是否已全量使用 HeroUI、骨架是否也由 HeroUI 拼装」，未拼装部分替换为 HeroUI 体系；
2. 基于新组件（HeroUI）的视觉张力，重新设计一套 Web UI 骨架与布局（当前旧骨架与新组件样式不匹配）。

研究结论（R069-001）：068 已完成控件层 HeroUI 化；**骨架层（AppShell/AppSidebar/AppHeader/WorkspaceTabs/RouteSearch/ThemeDrawer/ConfirmDialog/Drawer/PageHeader/页面布局容器）仍为自绘**。替换路径（R069-002）：HeroUI 控件/布局组件 + RAC 受控交互底座（Modal/Switch/Checkbox，HeroUI 自身依赖）+ Tailwind 布局原语；并按 HeroUI 视觉语言（半径/阴影/间距/语义色/暗色/密度）重建骨架规范与页面模板。

范围：WebUI 平台（Shell、SDK 遮罩/表单原语、布局 token、页面模板）与全部业务模块页面的骨架重排。不改模块 Binding/Manifest/路由/服务端契约/数据库/Go 行为；`@webui/sdk/ui` 导出契约保持。

## 2. 需求项

### REQ-069-A Shell 由 HeroUI/RAC 拼装

- A1：AppSidebar → HeroUI/Tailwind 拼装（Surface 语义容器 + Link/Tooltip/Avatar/Badge/Separator + 平台菜单类），保留递归菜单、active 祖先、移动抽屉 inert/focus。
- A2：AppHeader → HeroUI `Header` + `Toolbar` + `Separator` + `TextField`（搜索占位）+ `Kbd` + `Avatar` + `Dropdown`/`Menu`（账号），保留 breadcrumb/语言/全屏/主题/搜索语义。
- A3：WorkspaceTabs → HeroUI `Tabs` 复合（RAC roving 键盘），保留 visited 路由、close/refresh、面板语义。
- A4：遮罩容器（ConfirmDialog/Drawer/ThemeDrawer/RouteSearch）→ RAC 受控 `Modal`/`Dialog`（显式依赖 react-aria-components），保留 role/aria/focus/inert/关闭语义；`Switch`/`Checkbox` → RAC（label+input）视觉对齐 HeroUI。

### REQ-069-B 布局 token 与主题对齐

- B1：`--space-*`/`--radius-*`/`--shadow-*`/页面容器间距对齐 HeroUI 密度标尺；preset 语义色经 `@heroui/theme` `extendTheme`/CSS 变量映射到 HeroUI primary；暗色含 HeroUI 语义色。
- B2：`styles.css` 收窄为 reset/token/平台行为 + Shell 布局类；业务 selector 禁令保持。

### REQ-069-C 页面模板与模块页面重排

- C1：页面模板规范（PageHeader + StatGrid + SectionCard + CardTable + FormCard + Toolbar + EmptyState + Pagination），形成权威文档并实施。
- C2：全部业务模块页面按新模板重排；操作 ID/权限/i18n 键/aria 语义不变；模块 CSS 只保留专属 selector。

### REQ-069-D 测试与 e2e

- D1：SSR 空输出的遮罩/Switch/Checkbox 相关单测改为客户端渲染（vitest jsdom + createRoot/act）或载荷断言；其余 109 项保持。
- D2：e2e 的 role/aria 断言保持，class 选择器按新骨架校准；新增 069 骨架/暗色/移动端截图证据。
- D3：typecheck/lint/lint:modules/vitest/build/generate:check/e2e/go build 全绿。

### REQ-069-E 文档与提交

- E1：`docs/development/webui.md`（骨架章节重写为 HeroUI 拼装规范）、`webui/README.md`、`docs/architecture/technology-selection.md`（RAC 显式依赖说明）、`docs/changes/README.md` 与 069 变更文档。
- E2：提交。

## 3. 验收标准

- Shell 与页面骨架全部可见交互/布局组件来自 HeroUI 或 RAC（HeroUI 底座），自绘只保留布局原语与平台行为；
- 页面模板统一，模块页面重排后操作/权限/i18n/aria 零回归；
- 全部门禁绿；截图人工复核新视觉（亮/暗/移动）。

## 4. 非目标

- 不改模块契约/服务端/数据库/Go；
- 不引入运行时插件、不建第二套授权；
- 不为「统一」做无收益重构；HeroUI 原生缺失的受控交互（Modal/Switch/Checkbox）用 RAC 底座补齐并显式声明依赖。

## 5. 风险

- Modal/Drawer 迁移触及现有 focus/inert/测试断言，需逐项校准（D1/D2）；
- 骨架重构的视觉回归依赖截图人工复核；
- bundle 与 068 基线持平或微涨（显式 RAC 依赖）。