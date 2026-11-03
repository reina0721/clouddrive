# R107-004 TailAdmin 外部视觉复核证据（SET-002 前置门禁）

## 1. 研究问题与方法

ui-visual-calibration.md 规定：新增/修改公共 Button/Alert/Badge/Card/Dropdown/Modal/
Form Control/Notification/Overlay、Token 或新增/升级 HeroUI 前，必须重开 TailAdmin 对应
UI Elements 页面复核。设置中心（107）将扩展表格（密度/分隔/表头/列组合）、Tabs、表单控件、
通知四类能力——本记录回答"外部校准样本当前长什么样、能取到什么可复核证据"。

方法：真实 Chromium（Playwright）访问 https://react-demo.tailadmin.com/ 五个页面（basic-
tables、data-tables、tabs、form-elements、notifications），采集 DOM 结构（标题层级、表格
列/行、控件类型与状态、通知标题与 tone 容器、分页/搜索/每页控件）+ 全页截图（1440/390）；
另跑 WCAG 对比度脚本为四套强调色候选选值。样本快照 2026-09-06；只读外部样本，不进入门禁，
不复制其源码/DOM/CSS/数值。

## 2. 已验证事实

### 2.1 可达性（SET-002-001）

- `https://react-demo.tailadmin.com/` 与 `/basic-tables /data-tables /tabs /form-elements
/notifications /forms /alerts` 均 HTTP 200（HEAD 探测，2026-09-06）。历史"两次超时"已恢复。

### 2.2 表格（Basic Tables + Data Tables）

- basic-tables：多张表格（User/Project Name/Team…、Name/Date/Price…、Products/Campaign/
  Status… 等），每表 5-7 行；页面用卡片分区多表并列；表头与行分隔、语义状态列（Status）。
- data-tables：单表 10 行（User/Position/Office + 更多列）；带 **Search 输入**（4 个）与
  **Previous/Next 分页** + **每页 5/8/10 Select**；另有 Salary 列表格。这是"结构化数据
  列表 = 搜索 + 筛选 + 分页"的真实组合边界（R094-001 已确认"不堆入基础 DataTable"）。
- 项目对应：DataTable（ui-adapter）保持 HeroUI 交互；列宽 Resizable/列序/列显隐是 107 新增
  语义（SET-002-005）。

### 2.3 Tabs

- 标题与分组：Default Tab / Tab With Underline / Tab with line and icon / Tab with badge /
  Vertical Tab 五组。DOM 未用 `[role=tab]`（TailAdmin 用按钮 + 样式表达），视觉规律 = 内容
  切换的 Tab 本体 + 外层 Surface 负责内容容器（与项目 TabsView line/section/soft 语义一致，
  无需为复刻 TailAdmin 增加视觉 Variant）。

### 2.4 表单（Form Elements）

- 分组：Default Inputs、Select Inputs、Textarea、Input States、Input Group、File Input、
  Checkbox、Radio Buttons、Toggle switch、Dropzone。
- 控件证据：Input/Input with Placeholder/Password/Date Picker/Time Picker/Email/Phone；
  Select（含 Multiple Select Options）；Checkbox/Radio/Toggle 均含 **Checked/Disabled/
  Default/Selected** 状态标签；Textarea×3。项目 DatePickerField 已存在，Time Picker 项目无
  （107 不引入 TimeInput——设置页无时间选择需求，记录"未采用"）。

### 2.5 通知（Notifications）

- 分组标题：Announcement Bar / Toast Notification / Success / Info / Warning / Error
  Notification；内容证据：Success! Action Completed!（success 容器 border-b-4 圆角白卡）、
  Heads Up! New Information（info）、Alert: Double Check Required（warning）、Something
  Went Wrong（error）。=> 反馈渠道分契约（Announcement/Toast/Notification 语义分离）与项目
  AlertBanner/NotificationCard/Toast 三轨一致。

### 2.6 截图与限制

- test-results/tailadmin-review/01-08 png：basic-tables、data-tables、tabs、form-elements、
  notifications（1440 桌面）+ dark 尝试（--color-scheme 对 TailAdmin 无效——demo 用应用内
  dark 切换，未采集到 dark 变体）+ form-elements 390 移动。
- **限制**：hover/focus/active/打开态全矩阵未逐项完成；中英长文本与三档视口未逐页完成；
  本模型无图像输入，像素级目检未做——视觉基线人工确认属 SET-008 门禁（不得以"已复核"
  冒充目检）。

## 3. 推断与项目适配

- 【推断】表格扩展聚焦"列宽可调 + 列序 + 列显隐 + 每页 + 搜索/分页组合"，TailAdmin 的
  Data Tables 页面再次证明这些是**列表页组合**而非 DataTable 基础 props（保持 DataTable
  精简 + 页面组合 Collection/FilterBar/Pagination 责任）。
- 【推断】Tabs 无需新增 Variant：项目 TabsView 的 line/section/soft 已覆盖 TailAdmin 展示
  的 Default/Underline/Icon/Badge/Vertical 语义（内容切换 + 内容容器在外层）。
- 【推断】通知中心 UI（107）参照 Announcement/Toast/Notification 分离：瞬时反馈走 Toast
  （FeedbackProvider 现有），通知中心收纳"真实事件/任务结果"，不复制 TailAdmin 样式。

## 4. 局限与剩余未知

- TailAdmin 是外部可变样本，结论只对 2026-09-06 快照有效（metadata refresh_triggers）。
- Dark 变体与交互态完整矩阵待 SET-002 视觉复核补齐（无法自动采集时由人工/基线完成）。
- 四套强调色 light/dark 的**终值**待 SET-002-003 依据对比度结果 + 产品复核锁定；候选已在
  wcag-accent.mjs 计算（light brand/white：紫 6.20/蓝 5.17/绿 5.02/橙 5.18 均 ≥4.5 AA）。

## 5. 对 107 的影响

- SET-002-001（可达性）证据 = 本记录 §2.1。
- SET-002-002（四组复核）证据 = §2.2-2.6；**剩余**：交互态/Dark/长文本逐项与像素目检由
  人工视觉基线在 SET-002/SET-008 完成（不阻塞设计，阻塞"标完成"）。
- SET-002-003（强调色）以 §4 对比度结果 + 现有 --ds-* 语义为基准。
- DataTable 扩展只加语义 props 不把搜索/分页堆进组件；Tabs 不扩 Variant；通知沿用三轨分离。
