# 071 设置中心页内侧边栏形态（第二类菜单层级）

状态：研究门禁已通过（R071-001）；计划已确认（用户选择按推荐方案全部实施）；实施完成（NAV-071-A/B/C 全绿，已提交）。

## 背景

用户指出当前 WebUI 菜单分类层级设计单一：只实现了「全局菜单树」（host.center→settings.center→四子页），而参考站 shadcn-admin settings 展示的是第二种形态——「菜单与页面内共持的页内侧边栏」：全局菜单仅保留设置入口，四个分区（Profile/Account/Appearance/Notifications）在设置页面内部以垂直导航切换。菜单层级应支持多形态并存。

研究（R071-001）：070 设置中心无页内导航；参考站形态为「页面内垂直分区导航 + 可深链」；平台缺「页内分区导航」原语。

## 交付

- 平台 SDK 原语 `SectionNav`（@webui/sdk/ui）：navlist 语义、`aria-current="page"` 高亮、键盘上下/Home/End、href/button 双渲染、≤720px 横向折叠；平台样式 `.section-nav*`。
- settings 模块 `SettingsNavLayout`：页内侧边栏 + 内容区，四路由 `/settings/{profile,account,appearance,notifications}` 共用并深链；无 lucide/react-router 依赖（模块边界内）。
- 两类菜单层级共存（全局菜单树保留），规范写入 [WebUI 开发指南](../../development/webui.md)。
- 验证：typecheck / eslint / lint:i18n / lint:architecture / lint:modules / Vitest 110 / build / Playwright 19（新增 `071 settings in-page section navigation…` 与移动视口截图 071-settings-*.png）。

## 明确不做

- 不改全局菜单契约/路由/宿主 Shell（070 形态保留）；
- 不引入第三类层级（动态菜单等）。

## 阅读顺序

1. [研究档案](research/README.md)：R071-001（两形态差距与参考形态）
2. [需求规格](requirements.md)：REQ-071-A..C
3. [设计方案](design.md)：SectionNav 原语、settings 布局、样式、文件影响
4. [任务清单](tasks.md)：NAV-071-A..C 与逐轮状态