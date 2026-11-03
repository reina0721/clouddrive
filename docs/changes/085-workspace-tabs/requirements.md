# 085 需求规格：页面标签栏（Rev.2：自动页面标签）

引用研究：[R085-001](research/R085-001-current-workspace-tab-boundary/report.md)。

> 实施状态：Rev.1「显式 opt-in workspace」已按用户后续指令**反转**为 Rev.2「自动页面标签」——顶部标签栏代表当前已打开的页面，所有正式路由自动生成并保留标签，不再要求路由显式声明；Dashboard 为固定首页标签，动态详情按实体独立，Drawer/Modal/Popover 不生成标签。全部要求已实现，验证证据见 [tasks.md](tasks.md)。

## 1. 目标

在不恢复菜单访问历史标签的前提下，为 WebUI 增加有界的 Workspace Tabs：只有模块显式声明的独立工作上下文才能生成标签；标签能够在切换时保留真实内存工作状态，并提供固定、恢复、关闭其他、溢出清单、未保存保护与低敏状态持久化。

## 2. 功能要求（Rev.2）

| ID | 要求 |
| --- | --- |
| `REQ-085-001` | 顶部标签栏代表后台当前「已打开的页面」。**所有正式路由自动创建并保留标签**（app 布局 + implemented + 可加载 + access 放行），无需路由显式声明；Drawer/Modal/Popover 等临时交互不是路由，不生成标签。 |
| `REQ-085-002` | 已打开的页面再次访问只激活原标签而不重复创建；动态详情页按具体实体生成独立标签（同 route 子路径按 contextKey 隔离），静态导航按 routeID 去重。 |
| `REQ-085-003` | Dashboard（`default` 路由）作为固定首页标签：打开即 pinned、不可关闭、不可取消固定、不被「关闭其他/关闭右侧」批量影响。 |
| `REQ-085-004` | 标签栏为 40–44px 高紧凑文本式布局，无 Card 外框；Active 用底部指示线；文本不换行并省略；关闭按钮只在 hover、focus-within 或 active 时显示。 |
| `REQ-085-005` | 支持 pin/unpin、恢复最近关闭、关闭当前、关闭其他、关闭右侧和溢出列表；pinned/fixedHome 默认不被“关闭其他/右侧”影响，dirty 标签未经确认不得关闭。 |
| `REQ-085-006` | 打开标签默认硬上限 12、最近关闭历史上限 10；达到上限拒绝创建并引导用户管理现有标签，不静默淘汰。标签禁止换行，空间不足进入可访问的溢出清单。 |
| `REQ-085-007` | 页面通过 runtime SDK 窄契约报告 dirty、关闭前决策与 active 状态；宿主统一处理关闭、批量关闭、logout 和 browser unload。dirty 必须来自仍保留的真实工作状态，不能只保留视觉标记。 |
| `REQ-085-008` | 切换标签时保留已打开页面的 mounted 状态；inactive panel 不可聚焦/交互，模块能够依据 active 信号暂停轮询、订阅与高成本绘制。 |
| `REQ-085-009` | 使用版本化 `localStorage` 保存低敏标签元数据并按 principal 隔离；不得保存草稿值、凭据、响应 body、任意 query、错误文本或 dirty。存储不可用/损坏/过期时安全降级到内存与空状态。标签在刷新后恢复。 |
| `REQ-085-010` | 恢复时重新通过当前 manifest 的 access、delivery 与 availability 校验；已撤权、已删除、不可用的页面丢弃，不绕过服务端授权。 |
| `REQ-085-011` | 遵循 WAI-ARIA Tabs 的 tablist/tab/tabpanel、aria 关联和 roving focus；支持 Left/Right、Home/End、Space/Enter、Delete 与 Shift+F10/上下文菜单，关闭后焦点目标确定。 |
| `REQ-085-012` | 现有 `.workspace-tab*` 样式、`workspace-tabs` zone、滚动注释与 `WorkspaceTabPolicy`（显式 opt-in 契约）必须逐项删除；不得保留新旧两套标签语义。 |

## 3. 非目标

- 不把浏览器 history 或 breadcrumb 替换成标签；标签与 URL 各自独立，URL 由 React Router 管理。
- 不把 Drawer/Inspector/页内 SectionNav 强制升级为标签（它们是页面内交互，不产生路由）。
- 不实现服务端草稿、IndexedDB 草稿、跨设备同步或多窗口实时合并。
- 不恢复旧的 refresh action；刷新涉及 dirty 时必须由页面自己的受控动作处理。
- 不重构 OpenAPI 模块内部的接口标签（模块级 Tabs）；它与宿主页面标签栏是不同层级。
- 不新增第三方状态管理库。当前 React、React Router、RAC/HeroUI 与 Web Storage 足够承载。

## 4. 验收标准（Rev.2）

1. 连续访问任意正式路由（Dashboard、列表页、设置页、管理页、OpenAPI）都自动新增标签；重复访问只激活原标签不重复。
2. Dashboard 固定首页标签存在且不可关闭/取消固定；「关闭其他/关闭右侧」不波及固定首页。
3. 动态详情 fixture（同 route 子路径）生成独立标签、同实体去重、标题区分实体；Drawer/Modal/Popover 不生成标签。
4. 标签视觉在 1440×1000、1024×768、390×844 的 light/dark 下满足高度、指示线、关闭显隐、不换行与溢出要求。
5. dirty fixture 在切换标签后值仍存在；关闭/关闭其他/logout/unload 都触发一致保护，确认后才卸载。
6. 12 个标签达到上限后第 13 个被拒绝且无静默丢失；pinned/fixedHome/dirty 不被批量动作越权关闭。
7. reload 后恢复打开标签的低敏元数据；切换 principal、撤权、manifest route 删除、坏 JSON、storage throw 均 fail closed 且导航仍可用。
8. 键盘与屏幕阅读语义通过组件测试与 Playwright：roving focus、手动激活、Delete、上下文菜单、关闭后的焦点目标及 inactive panel 不可交互。
9. Go contract（无 WorkspaceTabPolicy 残留）、manifest projection、生成 TypeScript、WebUI unit/mock E2E/build/lint/docs guard 全绿；相关当前 authority 同步更新。

## 5. 决策记录

| ID | 决策 | 结论 |
| --- | --- | --- |
| `DEC-085-001`（Rev.1） | 是否以「显式 opt-in 独立工作上下文」取代 083 的全局 Tab Bar 移除 | Rev.1 采用；Rev.2 被用户指令反转 |
| `DEC-085-002`（Rev.2） | 标签资格 owner | 宿主按正式路由自动判定（app+implemented+loadable+allowed），不要求路由声明；Drawer/Modal/Popover 不生成标签 |
| `DEC-085-003`（Rev.2） | Dashboard 固定首页 | `default` 路由 fixedHome：pinned、不可关闭、不可取消固定、不被批量动作影响 |
| `DEC-085-004`（Rev.2） | 动态详情 identity | 宿主从 pathname 相对 route.path 派生低敏 contextKey，按实体独立标签；只用于相等性与标题 |
| `DEC-085-005`（Rev.2） | mounted panel 与资源边界 | 采用，上限 12；inactive 信号要求模块暂停副作用 |
| `DEC-085-006`（Rev.2） | 持久化范围 | `localStorage` 低敏元数据、按 principal 隔离；所有正式路由可恢复，不保存 dirty/草稿/任意 query |
| `DEC-085-007`（Rev.2） | 数量边界 | open 12、closed history 10；达到上限拒绝，不自动 LRU 淘汰 |

## 6. 需求反转记录

Rev.1（显式 opt-in、默认 disabled、仅 openapi singleton）由用户在 Rev.2 指令中明确推翻：

> 顶部标签栏代表后台当前"已打开的页面"…所有通过侧边栏菜单、页面导航或路由进入的正式页面都应自动创建并保留一个标签…Dashboard 作为固定首页标签…禁止再要求路由显式声明 workspace 才能出现标签。

本文件与 design.md/tasks.md 均已更新为 Rev.2 语义；Rev.1 的 opt-in 契约、manifest 字段与相关测试已单轨移除。
