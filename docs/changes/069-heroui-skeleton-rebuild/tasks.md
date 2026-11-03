# 069 WebUI 骨架 HeroUI 拼装与布局重构 — 任务清单

> 依赖：研究门禁通过（R069-001/R069-002）；计划按 design.md 第 7 节推荐项执行；非文档实施需用户对计划报告的独立确认。

## 任务总览

| ID | 任务 | 依赖 | 完成条件 |
| --- | --- | --- | --- |
| SKL-069-A | 布局 token 与主题对齐（B1/B2） | 计划确认 | REQ-B |
| SKL-069-B | RAC 依赖 + 遮罩/Switch/Checkbox 底座 + 测试客户端化 | A | REQ-A4、D1 |
| SKL-069-C | Shell 拼装（Sidebar/Header/Tabs） | A、B | REQ-A1..A3 |
| SKL-069-D | 页面模板规范 + 模块页面重排 | C | REQ-C1、C2 |
| SKL-069-E | e2e 校准与截图证据 | B..D | REQ-D2、D3 |
| SKL-069-F | 文档同步与提交 | E | REQ-E1、E2 |

## 状态记录

- 2026-08-26：研究门禁通过（R069-001 复核：控件已 HeroUI、骨架仍自绘；R069-002：HeroUI 视觉语言 + 四层骨架规范）；计划建立，用户确认四层方案全量实施（决策 1–5 推荐项）。
- SKL-069-A（完成）：`styles.css` 的 `--radius-*`/`--shadow-*` 对齐 HeroUI（`--heroui-radius-*/--heroui-box-shadow-*`）；preset 覆写新增 `--heroui-primary*` HSLA 阶梯（cyan/green/violet/orange）同步驱动 HeroUI 语义色；显式添加 `react-aria-components@1.20` 依赖；构建通过。
- SKL-069-B1（完成）：SDK 新增 `Check`（RAC Checkbox 底座，children 可访问名 + indeterminate）与 `Switch`（RAC Switch 底座，label 子节点或 ariaLabel 可访问名）；视觉类 `.rac-checkbox/.rac-switch`（HeroUI pill/box 语言）入 styles.css；迁移 ThemeDrawer 开关与 IAM/Organization/Navigation 4 处页面复选框；e2e 交互改为 RAC 键盘触发（Space）与 checkbox 键盘取消（RAC 隐藏 input 被 label 拦点击、视口外问题均已解决）。验证：typecheck/Vitest 109/build/Playwright 15 全绿。
- RAC Modal 装配证据（B2 前置）：`react-aria-components` 的受控 `Modal`+`Dialog` 在 SSR 输出为空、jsdom 客户端渲染正常（`role="dialog"` + focus scope）——B2 的对话框单测需改为客户端渲染（createRoot+act+portal 断言）。
- SKL-069-B2（完成）：`ConfirmDialog`/`Drawer` 迁到 RAC 受控 Modal+Dialog（`.rac-modal-backdrop/.rac-modal-panel/.rac-drawer-panel` 视觉类对齐 HeroUI 语言；关闭态不渲染 DOM，portal 挂载；焦点/Escape/backdrop 由 react-aria 承担）；`ThemeDrawer`（右置 drawer）与 `RouteSearch`（top-center 搜索）同步迁移；新增 `src/test-utils.tsx` 的 `renderClient`（createRoot+act）并客户端化 `ui.test`（对话框 4 例）/`theme-drawer.test`/`route-search.test`/`app-shell.test`（关闭态不渲染断言）/`action.test`（BulkActionBar 关闭态弹窗不渲染断言）；e2e 改 dialog role 定位与关闭后 toHaveCount(0)。验证：typecheck/Vitest 109/build/Playwright 15 全绿。
- SKL-069-C（完成）：Shell 控件 HeroUI/RAC 拼装——搜索触发器与页签触发器改用 HeroUI Button（页签触发器保留 role=tab/aria-selected/roving 语义）、账号菜单迁 RAC `MenuTrigger+Popover+Menu`（`.rac-menu-popover/.rac-menu/.rac-menu-item` 视觉）；侧栏/顶栏布局容器按 R069-002 记录为「HeroUI 控件 + Tailwind 布局」拼装。
- SKL-069-D（完成核心）：页面模板规范写入 `docs/development/webui.md`（069 章节：PageHeader→StatGrid→PageSection→DataCard→Toolbar→FormCard→EmptyState/InlineAlert）；PageHeader 标题改用 HeroUI `Typography.Heading`；模块页面经 067/068 已符合模板结构。
- SKL-069-E/F：e2e 069 截图证据、authority 文档其余同步与提交——进行中/待收尾。
- 收尾补充：侧栏品牌区用 HeroUI `Avatar`（Fallback 字母）、折叠侧栏叶子菜单用 RAC `Tooltip`（collapsed prop 由 AppShell 传入）；e2e 新增 `069 theme preset drives heroui semantic colors and persists`（切换 cyan → `data-theme-preset=cyan` + `--heroui-primary` 含 188 断言 + 截图 069-preset-cyan）。验证：typecheck/eslint/i18n/arch/modules/Vitest 109/build/generate/go/e2e 17 全绿。
- 待推进：无（069 收尾完成；截图人工复核由用户执行）。