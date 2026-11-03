# 设置插件与页面组合

## 1. 目标与边界

新建独立 `settings` 插件（pluginId `settings`，mount `/settings`），承载八分类设置页、
分类文案、设置搜索目录与页面组合；只在 group `system` 贡献一个"设置"入口（Child 或 leaf
Parent），账户菜单同步指向该入口；**移除 system-tools 内的 preferences 页**（单轨清理见
migration-cleanup.md）。设置运行时**不使用 packages/schemas API**（表单校验沿用 plugin zod
schema 先例）。

## 2. 插件结构与生成

```text
surfaces/plugins/settings/
├── plugin.ts                  pluginId 'settings'，mount '/settings'（目录名可任意，解耦）
├── plugin.navigation.ts       group 'system' 下入口（见 §3）
├── i18n.ts                    settings.* 双语（分类/文案/说明/搜索提示/恢复默认等）
├── schemas.ts                 plugin zod schema（表单校验边界；不使用 packages/schemas API）
├── stores/                    Plugin 私有 store（按 filesystem ownership）
└── routes/
    └── page.tsx               设置页（'use client'；Page+PageHeader+SettingsLayout）
        └── src/               页内组合组件/分类区段/setting 行（colocate，framework 忽略）
```

- 只改源文件 → `pnpm codegen:plugins` 生成 catalog/plugin-routes/Host adapter；
  `codegen:plugins:check` 复核 freshness；dev watch 自动 reconcile。
- 路由为静态路径 `/settings`（无 `[param]`），不触发 Host static 模式动态路由限制；
  searchParams `category`/`setting` 控制定位（Next 原生）。

## 3. 导航入口

- 复用既有 group `system`（Group Alias authority `surfaces/plugins/navigation-groups.ts`，
  不新增 Group）；iconId 复用 `settings`（vocabulary authority
  `surfaces/src/navigation-icon.ts`，不扩 vocabulary——若最终需要新语义 icon 才走 Surface 治理）。
- 形态候选（design 决策，实施前确认）：`settings.root` 作为带 routeId 的 leaf Parent（点击
  直达 /settings），与 system-tools.root（纯 Disclosure，icons 保留）并列同 group；或作为
  system-tools 之外的独立 Parent。推荐 leaf Parent（单一入口语义，避免嵌套"设置"）。
- 账户菜单（apps/web app-shell）原硬编码 `/system-tools/preferences` → 改 Route Target
  `route('settings')`（经 usePluginNavigation/RouteLink 语义引用，不手写 URL）。

## 4. 页面组合与分类模型

- 页面骨架（SET-009 多页 + SET-010 去索引 + SET-011 持久化壳）：**无索引主页**——`/settings` 根即
  默认分类页（外观，canonical 居根），另 7 个分类静态子路由 `/settings/<shortId>`。
  **内页壳 = `routes/layout.tsx`（Next layout，跨分类 client 导航不重挂）**：`Page >
PageHeader(usePathname 解析当前分类 title/desc + 分类恢复 + 恢复全部默认) >
SettingsLayout(左 SettingsSidebar + 右 SettingsShellProvider{children})`；8 个 page.tsx
  只渲染对应分类区段（useSettingsShell() 取 ctx）。共享壳插件私有（settings-layout-shell.tsx：
  SETTINGS_CATEGORIES 含 targetRouteId/iconId/group + SettingsSidebar(固定顶部跨目录搜索 +
  分组分类导航 NavigationIcon + active) + SettingsShellContext + 持久化失败统一呈现）。
  - **内容动效复用主 Shell 同一 Route-Transition Motion（SET-012，替代早期 SET-011 ContentSwap 方案）**：
    surface-foundation route-enter 编排并列新增 `[data-route-content]` 契约分支（与主 Shell
    `.surface-page-stack` 分支同一定义：fade+rise / nth-child 错峰 / forward 方向 / motion-screen
    降级，由 Host RouteTransition 同一门控触发）。settings layout 壳（PageHeader + SettingsSidebar +
    失败横幅）静止持久；右侧内容 children 放 `<div data-route-content>` 内，分类路由切换时内容
    区段执行与主 Shell 页面切换一致的进入编排，壳 opacity 恒 1 不参与动效。settings 不自建路由
    状态机或第二套 Motion；ContentSwapTransition（content-swap = 同路由内容替换语义）不再用于
    settings 分类切换。
  - `SettingsLayout` 现为静态两栏（detail-settings.tsx + styles.css `.surface-settings-layout`/
    `--surface-settings-nav:14rem`）；设置页在 Plugin 侧组合**带 active 状态与滚动定位的导航**
    （分类 anchor 高亮、`scroll-mt`），不扩 SettingsLayout 为万能组件；若确需"左侧分类导航
    可滚动 + active"成为跨页公共能力，先按 foundation 门禁评估再进 surface-foundation
    （至少两个真实消费者）。
- 分类渲染：八分类各为一个/一组 `Section`（id 可定位）；每设置项表达：名称/说明/当前值/
  可修改性/跟随系统/立即生效。控件**全部沿用现有**：RadioGroupField、ToggleGroup、
  SwitchField、SelectField、ComboField、CheckboxField（值/模式选择用 Radio/Toggle/Switch，
  内容切换用 TabsView）；不新建第二套设置控件。
- 状态表达不堆 Badge：跟随系统/默认/推荐少量呈现；"未保存到此浏览器"失败用 AlertBanner/
  Alert 语义呈现并给恢复动作。

## 5. 分类设置模型与即时生效链路

- 每设置项 = `{ id, category, valueType(union), default, labelKey, descriptionKey,
scope(当前会话立即/重启后), systemControlled?, followsSystem?, searchSynonyms[] }`，
  集中声明在 surface 产品模型（capability-ports.md §3.1）；i18n key 与 search synonyms 双语。
- 用户改动 → `PreferencesPort.updateCategory` → Host store 持久化 + 返回 PersistResult →
  设置页按结果更新 UI（成功静默/失败呈现原因+重试）→ 展示策略 context 更新 → 即时生效
  （如 html data-theme/data-accent/data-density 等，见 design-system-theming.md）。
- 同义设置共享字段：外观与可访问性共享动效/对比度/字号；导航与操作偏好共享离开提醒/删除
  确认——产品模型同一 key，不同分类入口只读同一值。

## 6. 搜索定位

- 索引页顶部 SearchBox；目录 = 全部设置项名称/说明/分类 label 的本地化文本 + 中英文同义词
  （如 zh "动画" 命中 appearance.motion 说明"动效"；en 同义处理）。
- 命中结果点击 → 跳转对应分类子路由（RouteLink，该设置在分类页内可见）；分类页为独立
  URL 可深链直达；`?category/setting` 参数保留兼容（单分类页内容短，字段级滚动不再需要）。
- 搜索目录与关键词在插件内维护（设置插件拥有）；**不受业务搜索时机偏好影响**（不进搜索
  历史）。

## 7. 恢复默认

- 分类级：每分类头部"恢复分类默认"（或在页操作区）；全部级：PageHeader actions"恢复全部
  默认"。
- 两者都用现有 `ConfirmDialog`/`DestructiveConfirmDialog` 语义做二次确认；`impact` 列出
  影响范围（该分类/全部设置项），说明**不触碰**账号/业务数据、收藏、历史、通知、草稿与
  已保存筛选方案；确认后调用 `resetCategory/resetAll`，失败同样呈现原因。
- 恢复即"回默认值"而非删除记录（写默认值，保持版本/migrate 一致性）。

## 8. i18n 与文案

- 文案入 plugin i18n.ts（`settings.*`），双语 zh-CN/en；分类 label、每项说明、搜索提示、
  恢复默认/确认框、失败文案齐备；Shell 账户菜单 label 用 Shell 自己的 i18n 键指向入口
  （Shell 禁引用 Plugin namespace——删除 Plugin 后 Shell 完整运行）。
- 日期/数字/相对时间展示统一经 i18n 工具（list-form-adapters.md）。

## 9. 验证方案

- 单测：分类模型 defaults/校验、搜索匹配（中英文同义词）、恢复默认影响范围、URL 定位解析。
- e2e/浏览器：八分类即时生效（每项真实消费者证据见各实施任务）、失败呈现与重试、
  `?category&setting` 直达、清空搜索恢复分类。
