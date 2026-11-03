# R085-001 Workspace Tabs 当前边界与可实施性

> 研究快照：HEAD `a60de23986313700e2c35638ca4e1b697eb9a685`，复核日期 2026-08-28。当前工作区另有用户对 `.gitignore` 的修改，本研究未读取其 diff、未修改也未纳入计划。

## 1. 研究问题与方法

本研究回答四个问题：当前宿主是否已有可复用的全局标签能力；083 删除的旧实现能否满足新输入；“只有独立工作上下文才能生成标签”应落在哪个项目契约；未保存状态、恢复、溢出和持久化如何在不制造无限状态或敏感数据泄漏的前提下成立。

方法为：读取根 README 与项目范围 authority；检索既有 research metadata；复核 059/067/083/084 变更记录；读取当前 `AppShell`、Router、route/manifest、runtime SDK、样式与滚动装配；用 Git 查看 `WorkspaceTabs.tsx` 删除提交及删除前源码；最后用 W3C APG 与 WHATWG HTML 标准复核键盘和 Web Storage 语义。没有启动应用、写入外部系统或执行实现命令。

## 2. 当前事实

### 2.1 当前没有全局 Workspace Tabs 运行时

- `webui/src/components/AppShell.tsx` 的工作区只有 `AppHeader` 与承载单个 `<Outlet />` 的 `ScrollExperience`，没有 tab registry、visited routes、关闭或恢复逻辑。
- `webui/src/App.tsx` 由一个 React Router 路由树渲染当前 location；`ManifestRoute` 只有 route、layout、权限、availability 与 group layout 信息，没有“独立工作上下文”资格或实例键。
- `HostRuntime` 只提供 manifest、principal、认证完成、刷新 manifest、默认导航和可选 `navigate`，模块没有向宿主报告 dirty/active/close guard 的契约。

因此，新方案不是切换一个现成开关；它需要 route 契约、宿主状态、渲染模型与模块生命周期四处同步设计。

### 2.2 083 删除的是菜单访问历史，不是本方案定义的工作上下文

Git 记录显示 commit `6c7bd338`（`refactor(webui): remove workspace tab bar and fixed footer from shell`）删除了旧 `WorkspaceTabs.tsx`。删除前实现具有以下行为：

| 旧行为 | 证据 | 与本方案差距 |
| --- | --- | --- |
| 每次进入允许访问的 app route 就把 route ID 追加到 `visitedRouteIDs` | 删除前 `AppShell` effect | 普通导航也生成标签，正是本方案禁止的“菜单历史” |
| route ID 唯一，一个 route 只能有一个标签 | `visitedRouteIDs: string[]` | 无法表达同一路由下多个独立实体/文档上下文 |
| 默认 route 不可关闭，其余可关闭 | `isWorkspaceTabClosable` | 没有固定/取消固定、关闭其他、恢复与上限策略 |
| 方向键/Home/End 切换，具备基础 tablist 语义 | `getWorkspaceTabTargetIndex` 与 `role=tab*` | 可复用交互原则，但缺 Delete、上下文菜单、溢出焦点与 dirty 语义 |
| 刷新当前 route 与 `workspace-tabs` zone | `WorkspaceTabs` actions | 刷新会丢未保存状态；zone 目前无可见宿主装配 |
| 仅进程内状态 | 无 storage owner | 刷新/重启不能恢复标签 |

结论：旧组件最多提供键盘与样式参考，不能原样恢复。085 应明确取代 083 的“全局访问历史标签不成立”结论，但不推翻其原因；只有显式 opt-in 的真实工作上下文例外成立。

### 2.3 当前存在未完成的单轨清理

当前代码仍可检索到 `.workspace-tabs`、`.workspace-tab-scroll`、`.workspace-tab*` 等样式规则，`ZoneID` 仍包含 `workspace-tabs`，`ScrollExperience` 注释仍称 Shell 页签轨会启用磁吸。当前 authority `webui/README.md` 与 `docs/development/webui.md` 又明确声称 083 已移除宿主 Tab Bar。

这些是残留契约/样式，不是已实现能力。085 实施时必须逐项裁决：新组件需要的规则按新视觉重写；不再需要的旧 dot、refresh、compact 特例、zone 或注释删除。不得同时保留新旧两套 tab 语义。

## 3. 独立工作上下文资格

【事实】当前 24 个 route 主要是 dashboard、列表、设置分区、组织管理与单 route OpenAPI 工作台；详情与编辑普遍由 Drawer、Inspector 或页内分区承载。当前没有通用多文档 route 契约。

【推断】资格不能由 path、菜单层级、是否访问过或页面标题推断，否则必然重新退化为 visited-route 历史。正确 owner 是声明 route 的模块，宿主只校验与执行 typed policy：

- `disabled`（默认）：普通导航、列表、设置、详情 Drawer、子路由均不生成标签。
- `singleton`：该 route 本身是一个独立工作区，同一 principal 只存在一个实例。
- `contextual`：同一路由可按模块提供的稳定 `contextID` 打开多个实例；缺少 context ID 时拒绝生成，不回退 route ID。

首批生产 opt-in 建议仅使用已经明确命名为工作台的 `openapi.workspace`，且用 `singleton` 验证宿主链路。不要为了展示多标签而把 Accounts、Roles、Settings 或 Drawer 页面错误标为 workspace；真正的实体详情/编辑工作台应在对应任务出现后单独 opt-in。

## 4. 未保存状态与渲染模型

【事实】当前只有一个 `<Outlet />`。切换 location 会卸载上一页面；仅在标签上画一个 dirty dot 不能保存实际表单状态。

可选路径：

| 路径 | 收益 | 风险 | 结论 |
| --- | --- | --- | --- |
| 继续单 Outlet，只保存 route | 改动小 | 切换即卸载，dirty 标识与真实草稿分离，可能丢数据 | 不采用 |
| 把任意页面状态放入宿主 `map<string, any>` | 可跨卸载 | 违反 typed contract/owner 边界，宿主知道业务草稿 | 不采用 |
| 为每个打开上下文保留 mounted panel | 页面本地状态与 dirty 真实保留，宿主只管生命周期 | 非活动页面仍占内存并可能继续 I/O | 采用；通过 12 个硬上限、active 信号和模块暂停后台副作用约束 |
| 服务端/IndexedDB 持久化草稿 | 可跨进程恢复 | 超出当前需求，涉及数据模型、安全与冲突语义 | 非目标，需另立研究 |

模块经窄 runtime SDK 注册 `dirty`、`beforeClose` 和 active 变化；宿主拥有关闭/关闭其他/logout/beforeunload 的统一决策。非活动 panel 必须 `hidden`/`inert`，不得继续接收焦点；模块通过 `active` 信号暂停轮询、订阅和高成本绘制。关闭确认通过后才卸载 panel。持久化时不保存 `dirty`，因为浏览器重启后内存草稿已经不存在；伪造 dirty 恢复会给出错误安全感。

## 5. 持久化、恢复与数量边界

WHATWG Web Storage 说明 `localStorage` 跨浏览会话保存，且同源多窗口共享状态、没有可依赖的锁；`setItem` 还可能因禁用存储或 quota 抛出 `QuotaExceededError`。因此：

- 使用带 schema version 的单一 host key，并按当前 `principal.id` 隔离；登出后不把 A 账号的标签恢复给 B 账号。
- 只保存 route ID、允许持久化的 context restore key、顺序、pinned、active 与关闭栈；标题从当前 i18n/manifest 重算。
- 不保存表单值、响应 body、Token、Authorization、任意 URL/query、错误文本或 dirty 状态。contextual route 只有声明低敏 restore codec/allowlist 时才可持久化。
- 写入失败时继续使用内存状态并给出一次低敏诊断，不让存储失败拖垮导航。
- 多窗口不做实时双向合并；每个窗口以内存为 authority，启动时读取快照，持久化采用 last-writer-wins。跨窗口协同不是本任务目标。
- 打开标签硬上限默认 12，关闭历史上限 10，均由宿主集中常量与测试守护。达到上限时拒绝新建并打开溢出管理，不静默淘汰 pinned、dirty 或其它上下文。

“恢复”包含两层：启动时恢复可恢复标签元数据，以及本窗口恢复最近关闭的干净/已确认关闭标签。它不承诺恢复未保存草稿。

## 6. 可访问性与视觉结论

W3C APG Tabs Pattern 要求 `tablist/tab/tabpanel` 关联、`aria-selected`、roving focus，并给出 Left/Right、Home/End、Space/Enter、可选 Delete 与 `Shift+F10` 上下文菜单规则。085 按手动激活模型实现，避免焦点横移时触发昂贵工作区切换；关闭后焦点落到右侧邻居，否则左侧邻居，最后一个关闭时回到主导航或明确空工作区入口。

用户指定的视觉边界可直接形成验收：总高 40–44px；文本单行省略；无 Card 化外框；Active 仅用底部指示线和文字强调；关闭按钮在 hover、focus-within 或 active 时出现；dirty、pinned 必须同时具备非颜色语义；标签本身不换行，空间不足进入横向滚动与溢出列表，不压缩到不可读。

## 7. 研究门禁结论与计划影响

研究门禁通过。关键事实已用当前代码和 Git 复核，历史决策冲突已解释，剩余未知不妨碍形成计划。后续计划必须：

1. 把 route opt-in 默认关闭写进 Go contract、manifest 与 TypeScript contract，不从菜单自动推断。
2. 先建立 registry/panel/lifecycle，再 opt-in route；不能先恢复旧 visitedRoutes。
3. 明确 12 上限、10 条关闭历史、低敏持久化、storage 失败降级和 principal 隔离。
4. 用真实 mounted state 验证 dirty；只测一个圆点不算完成。
5. 更新 `webui/README.md`、`docs/development/webui.md` 与 083 移除结论的当前 authority 表述；历史 083 记录保留，不重写。

## 8. 局限与刷新条件

- 未运行浏览器，不声称 40–44px、溢出或焦点行为已实现/已验证。
- 当前没有 contextual production route，首批只能用 singleton 与测试 fixture 证明平台机制；新增实体工作台需独立验收其 context/restore/dirty owner。
- mounted multi-panel 与现有 React Router group layout 的具体抽取点需在实施任务 `ROUTER-085-001` 中以测试先行验证；若发现必须改变模块边界或公开 API 超出本设计，退回研究并重新确认。

## 9. 外部主源

- [W3C WAI-ARIA APG Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)
- [WHATWG HTML Living Standard: Web storage](https://html.spec.whatwg.org/multipage/webstorage.html)
