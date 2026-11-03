# 087 需求

支撑研究：[R087-001](research/R087-001-settings-workspace-conflict/report.md)。

## 目标

修复 `/settings/*` 分区导航被自动 workspace 拆散的问题，并阻止普通 Accounts 列表的
隐藏 mounted 状态在 Settings 交互期间重新夺取浏览器 URL。

## 验收标准

| ID | 要求 |
| --- | --- |
| `REQ-087-001` | 普通 app route 默认不创建 workspace；资格必须由 route owner 用 typed policy 显式声明。 |
| `REQ-087-002` | Settings 八个分区不生成八个 workspace；切换时共享同一 `settings.layout` 实例，只替换分区内容。 |
| `REQ-087-003` | Settings SectionNav 点击使用 SPA 导航，URL、标题、内容和 `aria-current` 一致，不发生整页 load。 |
| `REQ-087-004` | 从带 `query`/`archived` 的 Accounts 页面进入 Settings 后，点击 Settings 内容、控件或页内导航不得回到 Accounts URL。 |
| `REQ-087-005` | Accounts 筛选 URL 在 Accounts 当前活动时继续正常工作；本任务不删除 query 同步能力。 |
| `REQ-087-006` | 真正独立工作台仍可显式 opt-in singleton/contextual workspace，并继续获得 mounted state、关闭保护和低敏恢复。 |
| `REQ-087-007` | 旧“所有 formal route 自动生成标签”的代码、测试和当前文档必须单轨清理。 |
| `REQ-087-008` | 运行态复现必须记录 URL transition、active workspace、可见 panel 与点击目标；无法复现时如实报告，不用猜测补丁冒充修复。 |

## 范围

- Go WebUI route/manifest workspace policy contract 与生成链。
- TypeScript contract、AppShell workspace eligibility、registry/reconcile/storage。
- Settings group layout 与 SectionNav 回归。
- Accounts query 与 Settings 跨页面隔离 e2e。
- WebUI authority、085/087 当前结论和变更索引同步。

## 非目标

- 不修改 IAM API、Accounts 筛选字段、数据库、账号资料、权限或 migration。
- 不读取、清除或迁移用户浏览器 localStorage。
- 不用 CSS/事件拦截掩盖未复现的点击目标。
- 不在本任务中新增 `/settings` manifest route 或宿主硬编码 redirect；正式入口仍为
  `/settings/profile`。如产品明确要求 `/settings` alias，另行研究模块拥有的 alias 契约。

## 约束

- 这是对 085 Rev.2 产品行为的实质调整，必须在本计划报告后获得用户明确确认。
- 实施发现必须保留所有普通页面 mounted，或需要嵌套 Router/history 同步时，返回研究
  阶段重新比较，不临时增加第二套路由器。
