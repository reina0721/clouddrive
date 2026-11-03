# 071 设置中心页内侧边栏形态（第二类菜单层级） — 需求规格

> 支撑研究：[R071-001](research/R071-001-in-page-nav-gap/report.md)

## 1. 目标与范围

用户指出菜单分类层级应支持多形态：除现有「全局菜单树」外，实现参考站（shadcn-admin settings）的第二种形态——**页内侧边栏**（菜单与页面内共持：全局菜单保留入口，分区切换发生在页面内部的垂直导航）。范围为：平台新增「页内分区导航」原语 `SectionNav`（`@webui/sdk/ui`）；settings 模块接入共享页内导航布局（四路由共用）；两类层级并存并在文档给出规范。

不改模块菜单契约/路由（070 不变）；不改宿主 Shell；新增仅 SDK 原语 + settings 页面布局。

## 2. 需求项

### REQ-071-A 平台原语 SectionNav

- A1：`@webui/sdk/ui` 新增 `SectionNav`：props `{ items: {id,label,icon?,href}[]; activeId?: string; onSelect?: (id)=>void }`。
- A2：渲染 `<nav role="navigation">` 内列表（`navlist` 语义）：当前项 `aria-current="page"` 高亮；键盘上下移动焦点、Enter 选择；点击触发 onSelect。
- A3：响应式：≤720px 时转顶部横向滚动分区条（可滚动切换）。

### REQ-071-B settings 页内侧边栏布局

- B1：settings 模块新增共享 `settings-layout`（左侧 `SectionNav` + 右侧内容区）：四路由 `/settings/{profile,account,appearance,notifications}` 共用；当前路由高亮、点击跳转对应子路由（深链保留）。
- B2：全局菜单树保留（host.center→settings.center→四子页）不变；两类形态并存展示。
- B3：体验一致：页内导航使用既有受控图标与 i18n 键；移动端使用 A3 折叠形态。

### REQ-071-C 验证与文档

- C1：SectionNav 单测（aria/navlist/active/键盘）；typecheck/lint/vitest/build 全绿。
- C2：e2e：/settings/profile 页内导航可见且高亮 Profile；点击「Account」→ /settings/account 页内导航高亮更新；Appearance/Notifications 同理；截图 071-settings-*.png。
- C3：`docs/development/webui.md` 新增「菜单层级多形态：全局菜单树与页内侧边栏」规范；070/071 changelog 同步；提交。

## 3. 非目标

- 不改全局菜单契约/路由/宿主 Shell；不引入(下一级)第三类层级（如动态菜单）。
- 页内导航不做路由参数驱动（保持子路由深链语义）。

## 4. 风险

- SectionNav 键盘/Focus 语义需与既有 nav 模式一致（复用 SidebarMenu 的 roving 经验）；窄屏折叠观感依赖截图复核。