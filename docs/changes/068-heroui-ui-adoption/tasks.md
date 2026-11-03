# 068 WebUI 全量采用 HeroUI 组件库 — 任务清单

> 依赖：研究门禁通过（R068-001/R068-002）；计划按 design.md 第 11 节推荐项执行；非文档实施需用户对计划报告的独立确认。

## 任务总览

| ID | 任务 | 依赖 | 完成条件 |
| --- | --- | --- | --- |
| HER-068-A | 依赖与主题装配（含 Tailwind 冒烟） | 计划确认 | REQ-A1..A3 |
| HER-068-B | SDK 原语替换（@webui/sdk/ui 契约稳定） | A | REQ-B1..B4 |
| HER-068-C | Shell 迁移（Sidebar/Navbar/Tabs/Search/ThemeDrawer） | B | REQ-C1、C2 |
| HER-068-D | 模块页面校准 + 模块 CSS 收口 | B | REQ-B4 |
| HER-068-E | 测试与质量门禁（单测/e2e/截图） | B..D | REQ-D1..D3 |
| HER-068-F | 单轨收口与文档 authority 迁移 | E | REQ-E1、E2 |

## 状态记录

- 2026-08-26：研究门禁通过（R068-001 澄清「未接入、已退役」事实；R068-002 推荐方案 A）；计划建立，用户确认方案 A（全量采用 HeroUI v3 + Tailwind v4）。

### 第一轮：依赖装配 + SDK 原语首批替换

- A1：安装 `@heroui/react@3.2.4 / @heroui/theme@2.4.26 / @heroui/toast@2.0.22 / tailwindcss@4.3.3 / @tailwindcss/vite`；`vite.config.ts` 接入 tailwindcss 插件；`tailwind.config.js`（content 覆盖宿主 + 模块页面、darkMode=class、heroui() 插件）；`styles.css` 引入 `@config` + `@import "tailwindcss"`。
- A3：`applyTheme` 联动 `<html>.dark`；`App.tsx` 挂载 `Toast.Provider`。
- B（首批）：Button/Field（TextField+Label+Input+Description+FieldError）/StatusPill（Chip）/CapabilityBanner/InlineAlert（Alert 复合）/Skeleton/EmptyState/Toast（@heroui/toast 队列）/PageSection/StatCard/StatGrid/DataCard（Card 复合 + Tailwind，保留 class 钩子）/ActionTrigger/BulkActionBar/FormSubmitActions（HeroUI Button 底座），导出契约不变。
- 验证：typecheck / Vitest 109 / build / Playwright 14 绿。

### 第二轮：样式补全 + 复合组件扩展

- 补装 `@heroui/styles`（`/css` 静态组件样式；`@heroui/react/styles.css` 仅为占位转发），`main.tsx` 引入；构建后 `button--primary/select__trigger/card--default` 组件类进入 dist（index bundle ~1.06 MB raw / ~310 KB gzip 基线）。
- `DataTable` → HeroUI Table（RAC 底座；选择列/loading/empty/wrapperProps 滚动劫持语义保留）。
- 新增 `SelectField`（HeroUI Select 复合）迁移 5 处模块页面 select + ThemeDrawer 3 处分段选择；新增 `IconButton`（isIconOnly）迁移 Shell/抽屉/搜索/页签图标按钮。
- Switch/Checkbox：HeroUI v3 复合无交互 input，RAC 底座 label/role 与 Playwright 冲突 → 回退自绘并记录边界。
- e2e：主部门改断言 HeroUI Select 触发值；滚动条插槽改 button+option；新增 `068 heroui adoption`。
- 验证：typecheck / Vitest 109 / build / Playwright 15 含新用例绿。

### 第三轮：Pagination + 单轨收口 + 文档 + 提交

- `Pagination` → HeroUI Pagination 复合（Root/Content/Item/Link/Previous/Next/Ellipsis，props 契约不变）。
- 单轨收口：删除被替换组件旧样式（`.ui-button*/.status-*/.capability-banner*/.empty-state/.inline-alert*/.data-table*（保留 wrap 溢出与分页布局）/.page-section*/.section-*/.stat-card*/.data-card*/.theme-select`）；保留 `.page-sections/.toolbar/.toolbar-actions/.page-meta/.card-grid/.item-card/.form-panel/.stat-grid` 布局与 `.surface` 容器。
- 边界（如实记录）：遮罩容器（ConfirmDialog/Drawer/ThemeDrawer/RouteSearch）与 Switch/Checkbox 自绘——HeroUI v3 Modal/Drawer SSR 输出为空（portal）、Switch/Checkbox 复合不含交互 input；preset → `@heroui/theme` extendTheme 语义色映射列为后续优化。
- authority 文档更新：`docs/development/webui.md`（068 章节）、`webui/README.md`、`docs/architecture/technology-selection.md`、`docs/changes/README.md`。
- 验证：typecheck / Vitest 109 / build / Playwright 15（含 `068 heroui adoption` 与截图）全绿；提交见 git log。