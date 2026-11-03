# R071-001 菜单层级多形态：全局菜单树 vs 页内侧边栏

## 研究问题

- （a）两形态适用场景与并存方式；
- （b）shadcn-admin settings 页内导航交互/语义；
- （c）平台原语需求；
- （d）settings 模块改造。

## 证据

### 现状（070）
settings = 全局菜单树（host.center → settings.center → 四子页）+ 四个 /settings/* 路由页面（PageHeader + PageSection），页面内无导航。全局菜单与页内导航是两类不同的「分类层级」：

| 形态 | 适用场景 | 交互 |
| --- | --- | --- |
| 全局菜单树（现有） | 分区较多且各自需要全局可达/可收藏/移动端可折叠 | 侧栏多级展开 |
| 页内侧边栏（参考站） | 分区属于同一入口、用户多在同一工作流内切换 | 页面内垂直导航切换内容 |

### 参考形态（shadcn-admin settings）
全局菜单仅「Settings」一个入口；进入后页面内左侧（窄屏顶部）垂直导航列出 Profile/Account/Appearance/Notifications，点击切换内容面板；URL 可深链分区（?section= 或子路径）；语义上是 `navlist`/tabs 型二次导航。

### 平台原语
SDK `SectionNav`：`{items:[{id,label,icon?,href}], activeId, onSelect}`；渲染 `<nav role="navigation">` 内列表（aria-current=page 高亮、键盘上下/Home/End 移动 focus、Enter 选择）；响应式（≤720px 转横向滚动条）；支持业务模块复用（账号中心/运营中心等多分区页）。

### settings 模块改造
共享 `settings-layout`：左侧 `SectionNav`（四分区 + 当前高亮）+ 右侧内容区；四 /settings/* 路由共用，全局菜单保留（两类形态并存展示：全局树可进任意分区，页内导航在同一区域切换）。

## 事实与推断

**事实**：070 无页内导航；参考站点内垂直分区导航；现有 SDK 无 SectionNav 原语。

**推断**：新增 SectionNav 原语 + settings 布局改造即可落地第二形态，且不改菜单契约/路由。

## 对本任务的影响

071 计划：SDK `SectionNav` → settings 共享布局与四页接入 → 响应式与键盘语义 → 单测/e2e（页内导航点击与截图）→ 文档（两类层级规范）→ 提交。