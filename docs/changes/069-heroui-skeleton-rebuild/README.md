# 069 WebUI 骨架 HeroUI 拼装与布局重构

状态：研究门禁已通过（R069-001/R069-002）；计划已建立，**待确认**（等待用户对 design.md 第 7 节决策 1–5 的确认）。

## 背景

用户两点修复方案：1）核实 Web UI 是否已全量使用 HeroUI、骨架是否由 HeroUI 拼装，未拼装则替换；2）当前仍保留旧骨架布局设计，与新组件视觉张力不匹配，需基于新组件重新设计一套骨架与布局。

研究复核（R069-001）：068 仅完成控件层 HeroUI 化（Button/Input/Select/Table/Pagination/Card 区块/提示/Toast 等）；**Shell 与页面骨架仍大量自绘**（AppShell/AppSidebar/AppHeader/WorkspaceTabs/RouteSearch/ThemeDrawer/ConfirmDialog/Drawer/PageHeader/布局容器）。HeroUI v3 机制：Modal/Drawer 为 DialogTrigger 模式（受控 isOpen 时 SSR 空输出是有意设计）、Switch/Checkbox 复合不含交互 input；可拼装组件面含 Header/Surface/Toolbar/Tabs/TextField/Kbd/Avatar/Dropdown/Menu/Link/Tooltip/Separator/Alert/Spinner 等。

## 范围

按 R069-002 的四层方案实施：Shell 改用「HeroUI 控件 + RAC 受控底座（Modal/Switch/Checkbox，HeroUI 自身依赖）+ Tailwind 布局」拼装；布局 token 与 preset 语义色对齐 HeroUI 视觉语言；建立页面模板规范（PageHeader + StatGrid + SectionCard + CardTable + FormCard + Toolbar + EmptyState + Pagination）并重排全部业务模块页面；测试（SSR 空输出断言客户端化）与 e2e 校准及截图证据；`@webui/sdk/ui` 导出契约与平台契约层不回归。

## 明确不做

- 不改模块 Binding/Manifest/路由/权限/服务端契约/数据库/Go；
- 不引入运行时插件/远程模块；不留新旧双轨；
- 不为「统一」做无收益重构；HeroUI 原生缺失的受控交互用 RAC 底座补齐并显式声明依赖。

## 阅读顺序

1. [研究档案](research/README.md)：R069-001（现状复核）、R069-002（HeroUI 视觉语言与骨架分层）
2. [需求规格](requirements.md)：REQ-069-A..E
3. [设计方案](design.md)：Shell 拼装目标结构、页面模板、token/主题、文件影响与待确认决策 1–5
4. [任务清单](tasks.md)：SKL-069-A..F