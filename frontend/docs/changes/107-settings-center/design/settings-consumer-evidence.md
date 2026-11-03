# 设置逐项真实消费者证据矩阵（SET-008-001）

> 目标：证明"逐项生效"——每一项设置都有真实消费者及证据，不是仅控件选中或存储值改变。
> 消费者一律经 `@clouddrive/plugin-framework/preferences` Port 读取，禁止跨插件读私有 Store。
> 证据列 = 对应 e2e spec（`apps/web/e2e/*.spec.ts`）或单测文件；全部在实施轮次中真实通过。

## 外观 Appearance

| 设置                          | 字段                                               | 默认        | 真实消费者                                                                                                                                                                                                    | 证据                                                                                                            |
| ----------------------------- | -------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 主题模式                      | appearance.themeMode                               | system      | Host providers 写 `html[data-theme]`（CSS token 门控）；旧值 migrate 保留                                                                                                                                     | settings.spec / providers.test.tsx（v0→v1 迁移）                                                                |
| 强调色                        | appearance.accent                                  | purple      | Host providers 写 `html[data-accent]`；design-system 生成 4 组 accent 覆盖块                                                                                                                                  | settings.spec（purple/blue/green/orange 切换）                                                                  |
| 动效偏好                      | appearance.motion                                  | system      | Host MotionPolicyProvider preference prop → `html[data-motion-mode]`（reduced 硬设，Inspector 不覆盖）                                                                                                        | motion-preference.spec                                                                                          |
| 界面密度/字号/内容宽度/对比度 | appearance.density/fontScale/contentWidth/contrast | standard 档 | Host providers 写 `html[data-density/data-font-scale/data-content-width/data-contrast]`；tokens.css 保留外层 data-* 覆盖（rem 缩放 / --spacing-* 密度映射 / #main-content 约束 / --spacing-focus-ring* 加强） | appearance-display.spec（4 e2e：compact→spacing 2.25rem、large→root 18px、standard→attr、high→焦点环 .1875rem） |
| 侧栏行为                      | navigation.sidebarBehavior                         | remember    | ShellRoot collapsed 投影 + 折叠/展开按钮                                                                                                                                                                      | navigation.spec / shell-store.test                                                                              |

## 导航 Navigation

| 设置               | 字段                             | 默认    | 真实消费者                                                  | 证据                    |
| ------------------ | -------------------------------- | ------- | ----------------------------------------------------------- | ----------------------- |
| 记住展开的菜单     | navigation.menuMemory            | false   | ShellNavigation menuMemory prop（carryAccordionModel）      | menu-memory.spec        |
| 跳转后自动滚顶     | navigation.scrollToTopOnNavigate | true    | resolveScrollOption → 全部 router.push（scroll:false 关时） | scroll-to-top.spec      |
| 面包屑             | navigation.breadcrumbs           | true    | reference detail PageHeader 面包屑                          | breadcrumbs.spec        |
| 顶部页面标签       | navigation.pageTabsEnabled       | false   | Shell PageTabs 条（记录/高亮/关闭）                         | page-tabs.spec          |
| 恢复上次标签       | navigation.restoreLastTabs       | false   | usePageTabsRecorder 会话恢复 + pruneTabs 失效过滤           | page-tabs.spec          |
| 关闭标签策略       | navigation.tabCloseBehavior      | recent  | PageTabs closeTabAt 跳转                                    | page-tabs.spec          |
| 新页面打开方式     | navigation.newPageOpenMode       | current | RouterTextLink browser-tab 原生锚点                         | new-page-open-mode.spec |
| 显示最近访问       | navigation.showRecents           | true    | Overview 首页"最近访问"区段                                 | workbench-home.spec     |
| 记录最近访问       | navigation.rememberRecents       | true    | useRecentVisitRecorder 门控                                 | recents.spec            |
| 自动恢复未完成工作 | navigation.autoRestoreWorkspace  | false   | Overview 首页草稿重定向                                     | auto-restore.spec       |
| 启动首页           | navigation.homeTarget            | '/'     | startup-target 纯函数（Host 接线随首页段）                  | startup-target.test     |

## 数据展示 Data display

| 设置                     | 字段                                                  | 默认         | 真实消费者                                                                                 | 证据                                          |
| ------------------------ | ----------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------ | --------------------------------------------- |
| 默认每页数量             | dataDisplay.pageSize                                  | 20           | resource-list 分页切片                                                                     | page-size.spec                                |
| 表格密度                 | dataDisplay.tableDensity                              | standard     | resource-list DataTable density（页面显式操作优先）                                        | table-density.spec                            |
| 行分隔/固定表头/空态说明 | dataDisplay.rowSeparators/stickyHeader/emptyStateHint | true×3       | DataTable props                                                                            | empty-state.spec                              |
| 记住分页位置             | dataDisplay.rememberPagination                        | false        | Workspace list-state 页码恢复/保存                                                         | remember-pagination.spec                      |
| 记住筛选条件             | dataDisplay.rememberFilters                           | false        | Workspace list-state filters 恢复/保存                                                     | remember-filters.spec                         |
| 列显隐/顺序/排序记忆     | rememberColumnLayout/rememberSort                     | true×1/false | 插件列布局 store（per-page visibleOrder + sort）→ 列设置对话框；恢复过滤退役列、标识列置首 | column-settings.spec / remember-sort.spec     |
| 长文本默认处理           | dataDisplay.longText                                  | truncate     | resource-list 工作流列名 `truncate` vs `break-words`                                       | detail-longtext.spec（换行 → break-words 类） |

## 操作偏好 Action preferences

| 设置                 | 字段                                    | 默认    | 真实消费者                                                                              | 证据                                      |
| -------------------- | --------------------------------------- | ------- | --------------------------------------------------------------------------------------- | ----------------------------------------- |
| 创建成功去向         | createSuccessDestination                | list    | reference create submit 真实回调                                                        | create-destination.spec                   |
| 编辑成功去向         | editSuccessDestination                  | stay    | reference edit submit 真实回调                                                          | edit-destination.spec                     |
| 本地草稿自动保存     | autosaveDrafts                          | false   | reference create workspace draft 自动保存/恢复/清除                                     | draft-autosave.spec                       |
| 离开提醒             | confirmLeave                            | true    | leave-confirm 全链路（dirty 注册 → 导航前确认）                                         | leave-confirm.spec                        |
| 重置前确认           | confirmReset                            | true    | reference edit 重置 ConfirmDialog                                                       | confirm-reset.spec                        |
| 批量操作前确认       | confirmBulk                             | true    | resource-list 导出已选 ConfirmDialog                                                    | confirm-bulk.spec                         |
| 首字段自动聚焦       | focusFirstField                         | false   | reference create 表单：开 → 进入聚焦首个文本输入；关 → 不聚焦                           | form-focus-relative.spec                  |
| 首错误聚焦           | focusFirstError                         | true    | useFoundationForm focusFirstError → RHF shouldFocusError                                | focus-first-error.spec                    |
| 复制反馈             | copyFeedback                            | true    | reference detail 复制 ID → toast 门控                                                   | copy-feedback.spec                        |
| 自动刷新             | refreshMode                             | off     | resource-list periodic/on-enter 时间戳指示                                              | auto-refresh.spec                         |
| 默认详情展示模式     | detailMode                              | compact | reference 详情页：full → 附加信息块（资源标识/完整说明）；compact → 仅关键信息          | detail-longtext.spec（简洁隐藏/完整展示） |
| 自动展开详情附加信息 | expandDetailInfo                        | false   | reference 详情页：compact + 开 → 附加信息展开                                           | detail-longtext.spec                      |
| 搜索时机             | searchTrigger                           | enter   | resource-list appliedQuery 门控                                                         | search-trigger.spec                       |
| 搜索建议             | showSearchSuggestions                   | true    | resource-list 键入时候选（负责人/地区/状态标签）建议按钮，点击应用为搜索词；关 → 不渲染 | search-suggestions.spec                   |
| 保留各页面最近搜索   | keepLastSearchPerPage                   | false   | resource-list 独立恢复搜索词（重载保持）；默认关清空                                    | search-suggestions.spec                   |
| 保留/显示搜索历史    | rememberSearchHistory/showSearchHistory | false×2 | page-archetypes search-history store + chips/清空                                       | search-history.spec                       |

## 语言与地区 Locale

| 设置                      | 字段                  | 默认       | 真实消费者                                                                                                               | 证据                                         |
| ------------------------- | --------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| 界面语言                  | localeRegion.language | zh-CN      | i18n locale + html lang                                                                                                  | settings.spec（English 即时生效持久化）      |
| 日期格式                  | dateFormat            | YYYY-MM-DD | resource-list updated 列 formatDateOnly                                                                                  | date-format.spec                             |
| 时区/时间格式/秒/相对时间 | 其余 localeRegion     | —          | 时刻显示（timeZone/hourCycle/showSeconds）→ i18n `formatTimeOfDay`；相对时间 relative → `formatRelativeTime`（N 分钟前） | time-display.spec + form-focus-relative.spec |

## 通知 Notifications

| 设置           | 字段                       | 默认     | 真实消费者                                                                                                             | 证据                                              |
| -------------- | -------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 应用内通知     | inAppNotifications         | true     | Shell 铃铛入口隐藏                                                                                                     | notification-center.spec                          |
| 未读提醒       | unreadReminder             | true     | 通知中心未读行高亮 + "刚刚"标记；关 → 视觉同已读（角标计数仍独立）                                                     | unread-reminder.spec                              |
| 显示通知角标   | showBadge                  | true     | 铃铛未读 Badge                                                                                                         | notification-center.spec                          |
| 非关键提示时长 | toastDuration              | standard | FeedbackProvider toastDurationMs（3/5/8s）                                                                             | toast-duration.spec                               |
| 播放提示音     | sound                      | false    | Host NotificationAlerts：真实新通知到达 → WebAudio 提示音（无资源文件）                                                | notification-alerts.spec（AudioContext 探针触发） |
| 收纳非关键通知 | collectNonCriticalToCenter | true     | reference detail 复制反馈：开 → toast 同步 publish 进通知中心；关 → 仅 toast                                           | collect-noncritical.spec                          |
| 浏览器桌面通知 | desktopNotifications       | false    | Host useDesktopNotificationGate：开启时请求权限，拒绝/不支持 → 回退偏好（无无效开关）；granted 时真实 new Notification | notification-alerts.spec（权限不可用回退）        |

## 可访问性 Accessibility

| 设置                         | 字段                                | 默认  | 真实消费者                                                                           | 证据                         |
| ---------------------------- | ----------------------------------- | ----- | ------------------------------------------------------------------------------------ | ---------------------------- |
| 增强焦点轮廓                 | accessibility.enhanceFocus          | false | Host `html[data-enhance-focus]` → tokens.css 焦点环 .25rem（只增强不降底线）         | accessibility-effects.spec   |
| 增强交互区域尺寸             | accessibility.enhanceTargetSize     | false | Host `html[data-enhance-target]` → tokens.css 控件 spacing 3.25rem（优先于紧凑密度） | accessibility-effects.spec   |
| 跟随系统辅助设置             | accessibility.followSystemAssistive | true  | Host 监听 `prefers-contrast: more` → `html[data-system-contrast]`（关时清除）        | accessibility-effects.spec   |
| 显示键盘提示                 | accessibility.showKeyboardHints     | true  | 与快捷键 showHints 共享（命令菜单提示）                                              | commands.spec                |
| 同义共享（字号/动效/对比度） | 引用外观字段                        | —     | AccessibilitySection 引用块（同字段不重复建开关）                                    | settings 页面 + 搜索定位 e2e |

## 快捷键 Shortcuts

| 设置       | 字段              | 默认 | 真实消费者                                     | 证据           |
| ---------- | ----------------- | ---- | ---------------------------------------------- | -------------- |
| 启用快捷键 | shortcuts.enabled | true | app-shell keydown 门控（Ctrl+K / Alt+Shift+N） | shortcuts.spec |
| 显示提示   | showHints         | true | 命令菜单入口提示（与可访问性共享）             | commands.spec  |

## 未完成（无消费者，非"无效开关"而是未落地能力）

- ~~`appearance.density/fontScale/contentWidth/contrast`~~ → **已落地**（tokens.css 保留
  外层 data-* 覆盖 + Host data-* 写入，见上表 appearance-display.spec）；schema 源
  语义化（`source.tokens` 增 density 等）留待后续设计系统单轨权威化任务。
- `dataDisplay.rememberColumnLayout/rememberSort` 列宽部分（列显隐/顺序/排序记忆已
  落地；Resizable 列宽依赖 HeroUI resizable API，见 SET-002-005）
- `dataDisplay.rememberColumnLayout/rememberSort` 等列能力 → DataTable Resizable/列显隐/序 = **SET-002-005**
- `navigation.homeTarget` 启动接线（纯函数已测）→ 首页段 = SET-005-005 剩余
