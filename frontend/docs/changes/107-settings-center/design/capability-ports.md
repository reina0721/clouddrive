# 公共能力 Port 与 Host 装配

## 1. 目标与边界

让五类跨边界能力被设置插件、Host Shell、其它页面消费**同一份实现**，同时满足：

- 设置插件拥有分类/文案/搜索目录/页面组合，但不独占公共能力；
- 禁止跨 Plugin 读取私有 Store；Plugin 不 import apps/web；Host 不 import plugins/* 内部；
- Universal 与 Surface Foundation 只经 props/context 接收展示策略。

决策依据见研究 [R107-002](../research/R107-002-settings-capability-placements/report.md)。

## 2. 层与归属

```text
能力契约（类型 + Provider/context/hook）        @clouddrive/plugin-framework
  ./preferences ./workspace ./notifications ./commands（react peer；纯模型，不读 pathname/history）
产品偏好模型（分类/默认值/受限联合/边界校验/migrate 形状/展示 i18n key）  @clouddrive/surface
  ./preferences-model（新公共 subpath；schema 不依赖 packages/schemas API）
运行时实例 + 展示策略下发 + 事件/失败语义        apps/web Host composition root（一次性安装）
Store 归属：Host store → apps/web；Shell store → surfaces shell；Plugin store → 各插件 stores/
```

- plugin-framework 只增**纯契约与 client 运行时 Port**（先例：`./plugin` 的
  PluginNavigationPort/PluginLocalePort + Provider/hook；Host 单点注入）。
- 产品偏好模型不塞 framework（framework AGENTS 禁产品数据），落 surface 公共 subpath，
  先例 = icons 页 import `@clouddrive/surface/shell`；需改 surfaces/package.json exports +
  foundation-contracts 登记 + dependency-policy。
- zustand 只许 state-foundation import；跨 Host/Plugin 能力一律经 Port，不为每个私有 Store
  建 Port。

## 3. 接口增量（契约草案，最终以代码为准）

### 3.1 Preferences

- 分类模型（产品层）：八分类（appearance/navigation/dataDisplay/actionPreferences/
  localeRegion/notifications/accessibility/shortcuts）+ 每分类字段（有限联合、边界校验、
  defaults）；集中默认值表见 §6。
- `PreferencesPort`（runtime）：`getSnapshot()/subscribe(listener)`（可订阅）、
  `updateCategory(category, patch): PersistResult`、`resetCategory(category)`、
  `resetAll(): PersistResult`。
- `PersistResult = { ok: true } | { ok: false; code: 'storage-unavailable' | 'quota' |
'corrupt' | 'unknown-version' | 'write-failed'; reason: string }`——调用方可判断成功/失败，
  不静默宣称成功。
- Host 实现：单 store（key 见 migration-cleanup.md）+ storage 事件同步 + 失败保留会话效果。

### 3.2 Workspace（工作状态/草稿）

- 按**页面身份**保存/恢复：`pageId`（稳定页面标识）+ `version`；页面显式声明允许保存字段
  （白名单，禁止黑名单）。
- 契约：`registerPageState(pageId, descriptor)`、`savePageState(pageId, fields)`、
  `restorePageState(pageId): PageState | null`（校验 version/过滤失效字段）、
  `clearPageState(pageId)`（业务提交成功后调用）。
- 列表状态（筛选/分页/滚动）与草稿分离；恢复不恢复"危险的批量选择"；显式 URL 条件优先。
- 草稿冲突（多窗口/刷新时序）不静默覆盖：保留"使用当前 / 恢复本地"选择（Port 返回冲突态）。

### 3.3 Notifications

- 受控类别（system/success/failure/warning/task）、严重性、关联 ID、展示文本、可选
  Route Target；**持久化内容不包含函数**（跳转存 Route Target 形状）。
- `NotificationsPort`：`publish(event)`、`subscribe`、`markRead/markAllRead`、`unreadCount()`；
  中心数据由 Host store 持久化（未读/角标）；FeedbackProvider Toast 仍是瞬时反馈层，
  publish 与 Toast 由业务按需双写（真实事件既 Toast 也进中心，或仅中心——产品规则）。
- 高风险/错误/安全类别不可完全关闭（产品强制）；桌面通知/提示音属展示策略（见 4）。

### 3.4 Commands

- `registerCommand({id, label, description, scope, available(): Availability, run()})` →
  `unregister()`；页面/组件卸载注销；按钮入口/命令菜单/快捷键/常用操作引用同一执行函数与
  可用性（`useCommandRunner(id)` / CommandMenu items 从注册表聚合）。
- 无任意键位编辑器；组合固定（Ctrl/Cmd+K 保留 + Alt+Shift 组，见 shell-integration）。

### 3.5 导航保护（Leave-confirm）

- 页面注册：`registerDirtySource({pageId, isDirty(), message(), isSubmitting()})`（可返回
  恢复信息）；Host 在 `shouldProceedWithNavigation` 前统一询问（见 shell-integration.md）；
  结果 complete/cancel/fail 区分；取消不改路由/标签/进度。

## 4. Host composition root 装配与展示策略下发

- composition root（apps/web providers/app-shell 扩展）一次性安装：
  Preferences/Workspace/Notifications/Commands/LeaveConfirm Provider + Navigation/Locale
  Port 既有；
- 注入：存储（state-foundation storage adapter）、Router（现有 HostNavigationPort）、
  媒体查询（matchMedia prefers-color-scheme / prefers-reduced-motion / prefers-contrast
  订阅）、权限（Notification.permission 查询/请求）、计时器（提示时长、定期刷新、进度兜底）、
  浏览器生命周期（visibilitychange/pagehide/beforeunload/storage 事件）。
- 展示策略经 **context 下发**（新 `AppearanceContext`/扩展现有 MotionPolicyContext）：
  resolvedTheme/accent/density/fontScale/contentWidth/contrast/motion/locale/weekStart；
  Universal 组件与 Surface Foundation 只消费该 context/props，不 import settings 插件、
  不读 Host Store（依赖方向保持）。

## 5. 持久化、失败语义与跨窗口同步

- 偏好继续用 `clouddrive.shell`（升 version + migrate，见 migration-cleanup.md）；
  收藏/通知/搜索历史/页面状态/草稿分别独立 Store（各自 key），不混入设置记录。
- 失败不静默：损坏/未知版本/存储拒绝/容量不足 → `PersistResult` 失败码 + 设置页呈现
  "未保存到此浏览器"与原因/恢复动作（重试/清除损坏记录）；当前会话效果保留。
- 跨窗口：`storage` 事件监听，按**最后成功写入的完整快照**收敛；页签活动状态保持当前窗口
  独立；草稿冲突不静默覆盖（见 3.2）。
- 资源生命周期：Port 实例卸载/页面卸载时取消订阅、清理计时器与未完成异步写入
  （AGENTS §3.4）；验证覆盖。

## 6. 新用户默认值（集中声明；老用户走 migrate 保留旧值）

| 主题        | 默认                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------- |
| 外观        | 跟随系统主题；紫强调色；标准密度/字号；内容宽度=自适应（宽屏语义不变）；侧栏记忆开；动效/对比度跟随系统 |
| 导航        | 启动=当前首页；自动滚顶开；面包屑开；页面标签/跨启动恢复/菜单记忆关；当前页面打开                       |
| 数据        | 每页 20；标准密度；行分隔、固定表头、空态说明开；文本截断；列布局记忆开；排序/筛选/分页记忆关           |
| 操作        | 编辑成功留在当前页、创建成功返回列表；离开/重置/删除/批量确认开；自动保存关；首字段聚焦关、首错误定位开 |
| 搜索与工作  | Enter 搜索；建议开；历史记录/显示关；最近入口记录与显示开；工作自动恢复关                               |
| 地区        | zh-CN；自动时区；YYYY-MM-DD；24 小时、无秒；精确时间；跟随地区数字；周一起始                            |
| 通知        | 应用内通知/未读/角标开；声音/桌面通知关；非关键成功提示=标准时长                                        |
| 辅助/快捷键 | 保留产品焦点键盘底线；增强焦点/交互区默认关；快捷键与提示开                                             |

- 提示时长仅短/标准/长（3/5/8s 集中常量）；定期刷新统一 60s 预设，不暴露毫秒。

## 7. 验证方案

- 契约单测（framework/surface）：PersistResult 失败语义、migrate 形状、命令注册/注销、
  通知序列化无函数、页面状态 version/白名单过滤。
- Host 集成：composition root 单点安装、storage 事件收敛、失败呈现与重试、卸载清理。
- e2e：跨窗口同步（双 tab）、草稿冲突、权限拒绝/声音失败、通知中心未读/角标。
