# 107 设计摘要与导航

本变更的详细设计按技术主题拆分；每个文件覆盖模块边界、接口、数据与控制流、状态与生命周期、
资源所有权、错误与失败语义、并发与安全、配置与迁移、文件影响与验证方案。

- [公共能力 Port 与 Host 装配](capability-ports.md)：preferences/workspace/notifications/
  commands 四类公共契约（plugin-framework 子路径 + surface 产品模型 subpath）、Host
  composition root 装配、storage 事件跨窗口同步、失败语义。
- [设置插件与页面组合](settings-plugin.md)：settings 插件路由/八分类模型/搜索定位/恢复默认/
  Page+SettingsLayout 组合与 i18n。
- [Shell 集成：导航保护、标签、收藏/最近与工作恢复](shell-integration.md)：leave-confirm
  统一接线、页面标签、启动目标、首页区段、恢复优先级。
- [列表、表单与地区适配](list-form-adapters.md)：DataTable 列能力（Resizable/列序/显隐）、
  列/筛选/分页记忆、草稿、提交去向、聚焦、刷新、搜索历史、i18n 日期/时区/周起始/纯日期工具。
- [Design System 主题语义扩展](design-system-theming.md)：强调色×对比度×密度×字号×内容宽度×
  动效语义映射、schema 受控区段扩展、Motion Inspector 优先级、展示策略下发。
- [迁移与单轨清理](migration-cleanup.md)：`clouddrive.shell` v0→v1 migrate、旧用户值保留、
  删除引用面清单、codegen/contracts/authority 同步。
- [设置逐项消费者证据矩阵](settings-consumer-evidence.md)（SET-008-001）：每项设置 ↔
  消费点 ↔ e2e 证据；明列无消费者项（Design System 密度/字号/宽度/对比度语义源、
  DataTable 列能力）及其归属任务。

## 关键决策

- 能力契约 = plugin-framework 新子路径（纯契约 + client Port/context/hook，仿 ./plugin）；
  产品偏好模型 = surface 公共 subpath；运行时实例 = Host composition root 一次性装配。
- 偏好继续用 key `clouddrive.shell`，version 0→1 带 migrate；老用户 theme/locale/
  sidebarCollapsed 优先保留；临时 Shell 状态不持久化。
- 设置运行时不使用 packages/schemas API（表单校验沿用 plugin zod schema 先例 + 集中默认值）。
- 展示策略（theme/accent/density/fontScale/contrast/motion/locale/weekStart）经 context/
  props 下发；Universal 与 Surface Foundation 不 import settings 插件或 Host Store。
- Design System 开发期沿用 schema→codegen（受控区段）流程；预设数值只由 Design System 管理。
- 新页面打开方式/标签/收藏等只作用于声明允许的入口；关闭记忆不删历史；危险操作既有输入
  确认不被削弱；高风险/错误/安全提示不可完全关闭。

## 文件影响总览（目标态；实施时按 tasks.md 增量）

- 新增：`surfaces/plugins/settings/**`（plugin.ts/navigation/i18n/schemas/routes/stores）、
  plugin-framework `src/{preferences,workspace,notifications,commands}.ts*` 与 package.json
  exports、surface 产品模型 subpath、apps/web Host ports/stores/providers、surface-foundation
  表现组件（TabBar/NotificationCenter/HomeSections 等，经 Contract 门禁）、design-system
  schema 区段（受控生成）、ui-adapter 扩展（Resizable/列序等）。
- 删除：`surfaces/plugins/system-tools/` 的 preferences 页/导航/i18n/schema、apps/web
  preferences 相关 i18n/账户入口/e2e 快照。
- 生成与登记：`pnpm codegen:plugins`、`codegen:design`、foundation-contracts.json、
  dependency-policy.json、docs/changes/README.md 索引。
