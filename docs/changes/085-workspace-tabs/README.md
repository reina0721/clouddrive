# 085 页面标签栏：自动页面标签（Rev.2）

## 状态

**已确认，实施完成（Rev.2：自动页面标签）。**

顶部标签栏代表后台当前「已打开的页面」：**所有正式路由自动创建并保留标签**，不再要求路由显式声明；Dashboard 为固定首页标签；动态详情按具体实体生成独立标签；只有 Drawer/Modal/Popover 等临时交互不生成标签。Rev.1 的「显式 opt-in（默认 disabled）」模型已按用户指令单轨移除。

> 需求反转：Rev.1 计划把顶部标签定义为「显式声明的独立工作上下文」（不恢复 083 的访问历史标签）；用户后续指令明确推翻该判定——标签应覆盖所有正式页面而非 opt-in workspace。本变更按 Rev.2 语义重新实现并验证。

## 研究结论（事实基线）

- 旧实现（083 删除前）按所有已访问 app route 自动追加标签，只支持 route ID 去重、关闭、刷新与基础键盘；不支持固定、恢复、关闭其他、溢出、未保存状态、持久化或数量上限。Rev.2 在旧模型语义上补齐这些能力，并以 mounted panel 保证真实工作状态。
- 当前（Rev.1 后）代码基于显式 `WorkspaceTabPolicy` 契约；Rev.2 移除该契约，资格判定交给宿主 `routeIsFormal`。

## 实现摘要（Rev.2）

1. Go/TS 契约移除 `WorkspaceTabPolicy`（route 不再声明标签资格）；manifest 不再携带 workspaceTab 字段；`webui generate` 重新生成。
2. 宿主 `WorkspaceProvider.routeIsFormal` 判定正式路由（app+implemented+loadable+allowed）自动 open/activate；`deriveContextKey` 让动态详情按实体生成独立标签。
3. Dashboard（default route）以 `fixedHome` 固定首页标签（pinned、不可关闭、不可取消固定、不被批量动作影响）。
4. `WorkspaceRegistry`（12/10 上限、pinned/fixedHome 分组、dirty 确认、批量原子性、reconcile）+ 版本化低敏 `localStorage`（principal 隔离、allowlist 投影、全正式路由可恢复，不存 dirty/草稿/任意 query）。
5. `WorkspaceOutlet` 为每个打开的正式页面挂载固定 location 的 mounted panel（inactive hidden+inert）；普通 Router Outlet 仅作 fallback；`ManifestRouteView` 共用不复制路由树。
6. 42px 文本式标签栏：底部指示线、hover 显隐关闭、pinned/dirty 图标+可访问名称、溢出菜单、APG 键盘（roving focus、Space/Enter、Delete、Shift+F10 上下文菜单）。
7. 单轨清理：`WorkspaceTabPolicy`、旧 `.workspace-tab*` 样式、`workspace-tabs` zone 全部移除。

## 阅读顺序

1. [研究档案](research/R085-001-current-workspace-tab-boundary/report.md)
2. [需求](requirements.md)（含 Rev.2 功能要求与需求反转记录）
3. [设计](design.md)
4. [任务与确认状态](tasks.md)