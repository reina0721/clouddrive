# R091-002 TailAdmin 设计规律研究（内部复核）

> 状态说明：web_search 工具因 API key 无效不可用（报错 Authentication Fails）。
> 本档案基于对 TailAdmin 公开模板结构、常用后台设计惯例与本项目现状的交叉复核，
> 以可复核的项目内证据为主；外部链接研究留待网络可用时补充快照。

## 研究问题

TailAdmin（https://demo.tailadmin.com/）没有大量华丽视觉效果，却让用户感觉布局稳定、
页面舒适、组件成熟、层级清晰。这种感受来自哪些可迁移的设计规律？当前项目缺什么？

## 事实与推断（区分标注）

### TailAdmin 的设计规律（推断，基于其公开结构与后台设计通用惯例）

1. **单一组件来源**：所有页面共用同一套 Form 控件（Select/Input/Checkbox/DatePicker）、
   同一套 Table/Card/Button。用户在不同页面不会看到"另一种 Select"。
   ——对应本项目问题：FilterBar 用原生 select、表单用 HeroUI Select，同页两种外观。
2. **克制的 Surface 层级**：页面背景、卡片、悬浮层三级分明，卡片不堆阴影，用
   边框/背景差分层级而非阴影。
   ——本项目 `--surface-muted`/`--surface-raised` 已存在但组件未完全遵守。
3. **一致的 Control Height 与间距**：所有输入控件同高（32px 量级）、同圆角、
   同间距节奏；下拉弹出层与控件同语言。
   ——本项目 `--control-height-sm/md/lg` 已存在，但原生 select 完全不受其约束。
4. **稳定的内容边界与 Page Header 节奏**：内容区宽度恒定、Header 与内容间距一致、
   Card Padding 统一。
   ——本项目 PageFrame/ContentViewport 已提供，需保持。
5. **有限 Typography Scale**：标题/正文/辅助文本三级，不滥用字号。
   ——本项目已收敛（见 090）。
6. **统一 Dropdown/Popover/Menu**：所有下拉/菜单同一组件、同一动画、同一定位。
   ——本项目自研 popover（DataTableRowMenu、WorkspaceTabs context-menu、DangerZone
   confirm）与 HeroUI Popover 并存。

### 本项目与 TailAdmin 的差距本质（推断）

差距不是"缺少设计 Token"（本项目 Token 已较完善），而是**组件来源不统一**：
- 同一筛选区域：select 原生、input 原生、switch 统一（FilterBar 三个分支三个来源）
- 表单与筛选：表单 SelectField（HeroUI）、筛选 select（原生）
- 弹层：HeroUI Popover（SelectField）、自研 popover（行菜单）、自研 dialog（DangerZone）
- 宿主与页面：语言切换原生 select、页面表单 HeroUI

这正是用户描述的"每个区域各做各的"的来源。

## 结论

TailAdmin 的"稳定感"可归纳为：**统一组件来源 + 克制表面层级 + 一致控件度量 + 稳定内容边界**。
091 重构的核心是把组件来源收敛到单一层级（HeroUI/RAC → 项目统一层 → 业务复合组件），
并让所有控件（含筛选/分页/语言切换）遵守同一套 Control Height/Radius/Surface Token。
不复制 TailAdmin 的具体颜色、卡片或布局，只迁移"组件治理"原则。

## 局限

- 本档案未引用在线快照（web_search 不可用）；TailAdmin 规律为基于公开结构与通用
  后台设计惯例的推断，已在"事实与推断"中明确标注。
- 后续网络可用时可按 metadata 的 refresh 触发器补外部链接快照。
