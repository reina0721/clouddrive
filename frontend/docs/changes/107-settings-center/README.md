# 107 独立 Settings 插件与完整用户设置中心（settings-center）

## 范围与状态

将 `system-tools` 的偏好页移除，新增独立 `/settings` 设置插件，覆盖完整设置中心及其必要
配套能力：八分类即时生效设置、设置搜索与双层恢复默认、页面标签、通知中心、本地草稿、搜索
历史、收藏/最近、工作状态恢复、命令与快捷键、Design System 主题语义扩展与地区格式。

设置在当前浏览器持久化（不接账号/后端/跨设备同步）；自动保存指本地草稿；通知来源于真实
前端事件与真实本地任务结果；补齐紫/蓝/绿/橙四套受控强调色；允许跨导航侧栏菜单记忆并保持
当前页面祖先可见与既有展开数量约束；设置运行时不使用 `packages/schemas` API（Design System
开发期继续用现有 schema→codegen 流程）。

研究基线：`77740c19`（工作区干净，2026-09-06）。研究门禁已通过（`R107-001/002/003`，
外部复核证据 `R107-004`），计划状态：**已确认**（2026-09-06 经用户确认后进入实施）。
SET-002 进行中：TailAdmin 可达性已确认、四组页面 DOM/截图证据已采集（R107-004）；
交互态/Dark/长文本/三档视口的像素目检与视觉基线人工确认未完成，**SET-002 不得标完成**。

## 阅读顺序

1. [需求](requirements/README.md)：八分类设置页、导航/标签/工作恢复、列表/表单/操作、通知/
   命令/快捷键的可验收行为。
2. [设计](design/README.md)：能力 Port 与 Host 装配、设置插件、Shell 集成、列表/表单/地区
   适配、Design System 主题语义、迁移与单轨清理。
3. [研究档案](research/README.md)：当前架构快照、能力落点边界、Design System 主题扩展。
4. [tasks.md](tasks.md)：唯一 checkbox 完成清单。

## 关键决策

- **能力契约落点**：preferences/workspace/notifications/commands 四类公共契约 + client
  Port/context/hook 扩展 `@clouddrive/plugin-framework`（仿 `./plugin`，react peer）；
  产品偏好模型（分类/默认值/受限联合/校验/migrate 形状）落 `@clouddrive/surface` 公共
  subpath（先例 icons import `@clouddrive/surface/shell`）；运行时实例由 apps/web Host
  composition root 一次性装配注入。禁止跨 Plugin 读私有 Store。
- **偏好持久化**：继续用 `clouddrive.shell`，version 0→1 带 migrate；老用户 theme/locale/
  sidebarCollapsed 优先保留（显式 light/dark、显式折叠态不套 system/remember 新默认）；
  首次无记录用新默认。收藏/通知/搜索历史/页面状态/草稿各自独立 Store，不混入设置记录。
- **展示策略**：theme/accent/density/fontScale/contentWidth/contrast/motion/locale/weekStart
  经 Host context/props 下发；Universal 与 Surface Foundation 不 import settings 插件或 Host
  Store；预设数值只由 Design System 管理（schema 受控区段 + `pnpm codegen:design`）。
- **导航保护**：Host 在导航生命周期前统一 leave-confirm（页面注册 dirty/提交中/恢复信息；
  结果 complete/cancel/fail；取消不改路由/标签/进度）；仅未提交输入注册 beforeunload
  （接受平台限制，配合草稿恢复）。
- **页面标签**：标签 = 页面入口（Route Target + 实体标识），切换仍走真实 Next Router、
  不缓存页面树；筛选/排序变化不建重复标签；恢复只恢复本地状态非组件树。
- **强制规则优先**：高风险/错误/安全提示不可完全关闭；危险操作既有输入确认不被全局偏好
  削弱；新页面打开方式只作用于声明允许的入口；关闭记忆不删历史。
- **Motion Inspector** 不覆盖用户更强的减少动效要求；大文字/增强点击区优先于紧凑密度。

## 终态同步

- `docs/plugin-framework.md`：§9 system-tools 示例改为 icons-only、新增 settings 插件示例；
  §10 迁移叙述更新（preferences 已迁出 system-tools 至独立 settings 插件）。
- `docs/surface-foundation.md`：如有新公共 Pattern（设置分类导航/标签条/通知中心等经 Contract
  门禁后）登记 authority。
- `docs/quality-evidence.md`、`tooling/foundation-contracts.json`（surface/plugin-framework
  新 subpath + state-foundation authorityRoutes 修正）、`tooling/dependency-policy.json`、
  `docs/changes/README.md` 索引（107）。
