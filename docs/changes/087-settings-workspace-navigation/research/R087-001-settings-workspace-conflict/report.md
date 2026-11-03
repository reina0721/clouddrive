# R087-001 Settings 页内导航与自动 Workspace 冲突

> 研究快照：`bf78f1b472399c6af9b031234f846fcdb4d17432`，复核日期
> 2026-08-28。研究期间只读取代码、文档、Git 与本地端口状态；未启动、停止或修改
> 运行进程，未读取浏览器存储或凭据。

## 1. 研究问题与方法

本研究回答：Settings 页内侧栏为什么出现无响应感或生硬加载；为什么目标地址会精确
回到带 `query=xiaolin%40iqwq.com&archived=false` 的 Accounts URL；085 Rev.2 的
“所有正式页面自动标签”是否适合 Settings 分组布局和普通列表页。

方法：从 README/仓库状态进入，检索 research metadata；复核 072、073、085；追踪
`AppShell -> WorkspaceProvider -> WorkspaceOutlet -> Routes -> SettingsLayout`；检查
Accounts `useSearchParams` 和 workspace location；检查现有 e2e；最后尝试连接
`localhost:8080/settings/profile`，服务当时未监听，因此没有伪造登录态复现结论。

## 2. 已验证事实

### 2.1 `/settings` 不是当前正式路由

settings binding 只注册 `/settings/profile`、`account`、`security`、`appearance`、
`notifications`、`language`、`about`、`acknowledgement`。`/settings` 本身没有
manifest route；当前正式入口是 `/settings/profile`。本任务把用户表述理解为
“`/settings/*` 下的页面”，不擅自新增宿主硬编码 redirect。

### 2.2 073 的不变量是一个固定 SettingsLayout

073 引入 `groupLayoutId=settings.layout`，目标是八个设置路由共享同一个
`ModuleGroupLayout`：SectionNav 常驻，只替换 `<Outlet />` 子内容。072 同时把
SectionNav 切换改为 `HostRuntime.navigate`，要求 SPA 切换、不整页刷新。

### 2.3 085 Rev.2 把八个分区重新拆成八个 workspace

当前 `AppShell` 对每个 formal route 执行 `openWorkspace`。workspace ID 对静态路由按
route ID 生成，因此 `settings.profile`、`settings.account` 等是八个不同实例。
`WorkspaceOutlet` 又按每个 descriptor 建立固定 `location` 的 `<Routes>` 和 mounted
panel；inactive panel 只 hidden/inert，不卸载。

现有 071/072 e2e 注释和断言已经把这个行为写成基线：“每个正式设置分区是独立标签/
面板”“点击分区打开对应设置的独立标签”。这不再满足 073 的“布局固定单实例”，而是
每个分区首次进入都经历 open、lazy route/locale、panel 激活和旧 panel 隐藏。因此用户
感知到的迟滞/生硬切换有明确结构原因，不只是动画参数问题。

### 2.4 Accounts 精确 URL 来自 workspace location 重放

Accounts 的 query SDK 把 `query`、`archived` 等筛选写入浏览器 URL。AppShell 打开
Accounts workspace 时把当前 `pathname + search` 放入 descriptor；标签激活函数随后
直接 `navigate(tab.location.pathname + tab.location.search)`。因此目标 URL 的完整
筛选串证明 Accounts workspace 的 location 被重新激活，而不是 Settings 页面主动生成
了邮箱筛选条件。

当前持久化投影只 allowlist OpenAPI 的 query，按代码本应剥离 Accounts query；但同一
页面会话中的内存 descriptor 会保留完整 query。用户报告“刷新后仍出现完整 query”与
这一持久化规则存在冲突，可能是运行构建版本、浏览器 history、恢复时序或具体点击命中
路径不同，不能在无运行态证据时任选一个解释冒充事实。

### 2.5 没有找到“任意页面点击即跳 Accounts”的通用监听

源码检索没有发现 body/document click 导航 Accounts、`history.back()`、`navigate(-1)`
或 Settings 到 Accounts 的显式跳转。inactive panel 同时声明 `hidden` 与 `inert`，CSS
也把 `[hidden]` panel 设为 `display:none`。所以“任意位置”的具体触发点尚未由源码
证明为透明覆盖层；必须在带认证、带 Accounts query workspace 的真实 DOM 上记录
`event.target`、当前 active workspace 和 URL transition 才能定责。

## 3. 历史决策冲突

R085-001 最初明确把“普通菜单、列表、设置分区”列为不适用 workspace 的场景，并
推荐默认 disabled 的 typed `WorkspaceTabPolicy`，首批只让真实 OpenAPI 工作台
singleton opt-in。Rev.2 后续把它反转为“所有正式路由自动标签”，同时删除 policy。

这次真实缺陷表明，Rev.2 把“页面访问历史”和“需要保持本地工作状态的独立工作上下文”
再次混成同一概念。Settings group layout 被拆散、Accounts query location 被常驻，都是
该资格边界扩大后的直接后果。

## 4. 候选方案比较

| 候选 | 收益 | 主要问题 | 结论 |
| --- | --- | --- | --- |
| 只修 CSS 覆盖层或给 click `stopPropagation` | 改动小 | 尚无覆盖层证据；不解决八个 Settings panel 和隐藏列表状态 | 不采用 |
| 保留所有页面 mounted，为每个 panel 建独立 Router/history | 可保留全页面标签 | 需要嵌套 Router、双向 history 同步、runtime navigate 重写和 query owner 重构；复杂度源于错误资格扩大 | 不作为默认方案 |
| 按 `groupLayoutId` 合并 Settings workspace | 可缓解 Settings 八面板 | Accounts 等普通列表仍常驻；query 隔离问题继续存在 | 单独使用不足 |
| 恢复显式 workspace 资格，普通页面走单 Outlet | 重新满足 073；离开 Accounts 即卸载；query 只有活动页面拥有；架构和测试显著收敛 | 改变 Rev.2“所有页面都有标签”的产品行为，需要重新确认 | **推荐** |

## 5. 推荐目标设计

恢复 typed `WorkspaceTabPolicy`，默认 disabled：

- Settings 八分区、Accounts/roles 等列表页不创建 mounted workspace，统一走当前
  BrowserRouter Outlet；Settings 的 `settings.layout` 在分区切换时保持同一布局实例。
- 真正独立工作上下文由 route owner 显式声明 singleton/contextual；首批保留 OpenAPI
  singleton 作为真实工作台。
- AppShell 不再从“formal route”自动推断标签资格；WorkspaceProvider 只恢复、对账和
  渲染 opt-in descriptor。
- query URL 只属于当前活动普通 route 或显式 workspace；inactive 普通列表不再挂载。

这不是保留新旧两套行为：实施完成后删除“所有正式页面自动标签”的分支、测试和文档，
只保留显式资格单轨。

## 6. 研究局限与实施前阻断证据

2026-08-28 当前复核时 8080 未监听，浏览器访问 `/settings/profile` 返回连接拒绝。
仓库门禁又禁止计划阶段启动服务，因此没有带认证 UI 的 event-target 证据。

实施第一项必须先在确认后的运行环境建立失败用例：打开带邮箱 query 的 Accounts，进入
Settings，在内容空白区、控件和八个 SectionNav 项分别点击，记录 URL、active workspace
和可见 panel；若无法复现“中性点击跳转”，不得虚构覆盖层修复，只实施已证实的
workspace 资格与 Settings 布局回归，并把环境差异留作风险。

## 7. 研究门禁结论

研究门禁通过：Settings 生硬切换与 workspace 资格冲突已有当前代码、历史设计和 e2e
三方证据；Accounts 精确 URL 的重放链也已定位。具体误点击 hit target 未知，但不妨碍
形成以失败用例先行、恢复显式资格为核心的计划。计划不得声称该细节已复现。
