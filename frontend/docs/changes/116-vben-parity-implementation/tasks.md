# 实施清单与状态

来源映射：VP-01…VP-06 ← 115 校准账本（原包 Task 114–119）。本轮实现全部六类，
每个条目都以当前源码与浏览器结果为准，不以"文件存在"代替验收。

## VP-01 演示与多角色登录

- [x] 三个演示身份单一事实源（`apps/web/src/auth/demo-accounts.ts`），复用 fixture 密码常量。
- [x] 登录/会话过期页快捷身份面板：点击即真实登录（`demo-access.tsx` + `auth-form.tsx`）。
- [x] "上次使用"记忆（`demo-session.ts`，不存密码）。
- [x] 重置演示数据（`demo-reset.ts`）：清业务/身份记录、保留界面偏好、重载播种。
- [x] 模式与安全边界文案；后端模式不渲染演示面板。
- [x] e2e：三身份登录、权限差异、重置（`apps/web/e2e/demo-access.spec.ts`）。

## VP-02 Shell 布局、页签与命令

- [x] `navigation.layoutMode`（vertical/horizontal/mixed）+ 设置页与抽屉控件。
- [x] `ShellRoot layout` + `data-layout` 网格；顶部导航组件复用同一导航模型与权限过滤。
- [x] 混合布局：顶部分组切换、侧栏只显示当前分组、路由变化回到跟随当前页。
- [x] 页签固定（置顶/不可关闭/批量保留）、单项操作菜单（固定/关闭/左右/全部/刷新）、中键关闭。
- [x] 菜单标题覆盖贯通侧栏、页签、命令面板（`useNavigationLabelOverrides`）。
- [x] 单位测试：固定/批量/左右关闭（`page-tabs-store.test.ts` 新增 2 例）。

## VP-03 偏好、水印、锁屏

- [x] 模型：`security` 分类、`appearance.colorWeak/grayscale`、`navigation.layoutMode`；版本 2。
- [x] 设置页第九分类（水印/空闲锁屏/后台锁定/立即锁定）+ 外观色弱灰阶 + 布局模式。
- [x] 快捷偏好抽屉（Host）复用 `PreferencesPort`，含失败提示与恢复默认。
- [x] 配置复制（抽屉）、下载/导入（设置页，整包校验）。
- [x] 水印覆盖层（`shell/watermark.tsx` + Host CSS，aria-hidden）。
- [x] 锁屏（`shell/lock-screen.tsx` + `use-lock-store` + `use-idle-lock`），密码复核、错误保持锁定。
- [x] e2e：抽屉切换水印/布局并刷新保持、锁屏错误/正确密码（`shell-security.spec.ts`）。

## VP-04 表格与查询生产力

- [x] `core/table.ts`：`normalizeColumnLayout` + `toCsv`（RFC 4180），单测 10 例。
- [x] `ui-adapter` DataTable：三档密度、固定列、树形行（aria-level/aria-expanded）。
- [x] `surface-foundation/collection-tools`：列设置对话框/密度切换/导出菜单/工具栏组合。
- [x] `CollectionQuery`：可折叠高级筛选、可移除 chips、重置。
- [x] users：列布局按用户持久化、CSV（页面/选中）、固定姓名列、高级排序/每页、chips。
- [x] audit：选择、列布局、密度、CSV、折叠高级、chips。
- [x] `/ui-elements/data` 同源 Showcase（固定列/树形/列设置+导出）。
- [x] e2e：`apps/web/e2e/table-productivity.spec.ts`（列设置持久化、密度、CSV、选中导出、树形）。

## VP-05 权限与系统管理

- [x] `menus` 插件：读 `generatedRouteCatalog`，三级树，标题/排序/可见性/权限码覆盖，冲突恢复。
- [x] Host `navigation-admin` store + Port：覆盖真正作用于侧栏（可见/排序/权限/标题）。
- [x] `departments` 插件：16 节点三级树、增删改、删除保护、乐观版本、演示数据恢复。
- [x] `dictionaries` 插件：5 类型 18 条目、编码唯一校验、语义 tone、类型+条目 CRUD。
- [x] 三者 `settings.update` 门控、只读拒绝态、损坏记录恢复。
- [x] 单测：overlay 纯函数、部门模型、字典模型、Host store。
- [x] e2e：`system-management.spec.ts`（菜单隐藏生效、部门新增/删除保护、字典 CRUD、权限拒绝）。

## VP-06 Analytics 与 Workspace

- [x] `ui-adapter/charts`：Area/Donut/Bar/Sparkline + 纯几何 + 可访问数据表 + roving tabindex。
- [x] `analytics` 插件：KPI、7/30/90 天趋势、来源/设备/排行、空/错/刷新、演示数据说明。
- [x] `workspace` 插件：问候、统计、快捷导航（`route()`）、项目、动态、持久化待办。
- [x] 导航贡献（management 分组）与图标词汇扩展（analytics/workspace）。
- [x] 单测：数据集确定性、图表几何、工作台数据、待办 store。

## 横切

- [x] codegen 插件与设计产物；图标词汇 + components 映射。
- [x] foundation-contracts 登记（charts、collection-tools、navigation-admin）。
- [x] Showcase 与业务同源。
- [x] 中英文案（每个 Plugin 自有 namespace）。
- [x] 文档：116 账本、115 修订、auth/README、surface-foundation、ui-element-system、
      plugin-framework、quality-evidence、docs/changes 索引。
- [x] 视觉基线：仅按逐项截图复核后更新受影响快照。
- [x] `pnpm check` 全绿（退出码 0，见 [pnpm-check.log](evidence/pnpm-check.log)）。
- [x] 六类场景定向复测：19 个 spec / 109 项通过，见
      [parity-retest.log](evidence/parity-retest.log)；
      逐项结论见 [final-parity-matrix.md](research/final-parity-matrix.md)。

## 后续（真实限制，不是待决策）

- 虚拟滚动、单元格/行内编辑、页签拖拽排序、13 色板/px 圆角：见
  [需求明确不做](../requirements/README.md#明确不做有依据不是缩减范围)。
- 真实后端联调：认证已有 backend adapter；菜单/部门/字典/分析当前为演示数据。
