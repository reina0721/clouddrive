# 087 Settings 导航与 Workspace 隔离修复

## 状态

**已确认，实施完成（2026-08-28）。**

已恢复显式 typed `WorkspaceTabPolicy`：普通路由默认 `disabled`，Settings 八分区与
Accounts 使用唯一普通 Router Outlet；OpenAPI 保留 `singleton + restorable` 工作区。
运行态审计已接入 Accounts query → Settings 的真实侧栏点击链，未发现需要猜测式 CSS 或
事件拦截补丁的证据。

本变更处理两个同源问题：Settings 八个分区在 085 Rev.2 后被拆成八个常驻
workspace，破坏了 073 的共享固定布局语义，导致页内导航出现无响应感、重复懒加载和
生硬面板切换；同时 Accounts 等普通列表页也被常驻，账号筛选 location 可以在工作区
再次激活时把浏览器导航回 `/admin/accounts?...`。

实施方案恢复 085 初始研究中的显式 workspace 资格：普通列表页和 Settings 分区使用
唯一 React Router Outlet；只有真实独立工作上下文显式 opt-in mounted workspace。
该方案取代当前“所有正式页面自动生成标签”的 Rev.2 行为；确认消息已记录在任务证据中。

## 范围

- 恢复 typed `WorkspaceTabPolicy`，默认 `disabled`，不从菜单或 app route 自动推断。
- Settings 八分区和 IAM Accounts 等普通页面回到普通 Router Outlet。
- Settings 继续复用 `settings.layout`，切换分区时只替换 `<Outlet />` 内容。
- 保留真正工作台的显式 opt-in；首批以 OpenAPI singleton 为既有真实用例。
- 新增带 Accounts query、Settings 中性点击、页内导航、刷新和 workspace 数量的回归测试。
- 不修改 IAM API、数据库、账号数据、权限、migration 或筛选语义。

## 阅读顺序

1. [研究索引](research/README.md)
2. [R087-001 研究报告](research/R087-001-settings-workspace-conflict/report.md)
3. [需求](requirements.md)
4. [设计](design.md)
5. [任务与确认状态](tasks.md)
