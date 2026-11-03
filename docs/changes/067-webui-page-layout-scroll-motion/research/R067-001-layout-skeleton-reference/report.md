# R067-001 组织模块报错事实、TailAdmin 布局骨架与现有业务页面结构差距

## 研究问题

用户要求修复「组织管理及下级模块在 Web UI 页面中存在报错」，并把全部业务模块页面布局骨架重构为参考 TailAdmin（https://react-demo.tailadmin.com/）的形态。需要回答：

- （a）组织模块三个页面（部门/岗位/分配）的报错具体是什么、文件位置与根因；
- （b）TailAdmin 布局骨架的区域与卡片形态；
- （c）当前全部业务模块页面结构与平台样式 authority 约束下的差距与最小改法。

## 方法与范围

- 只读检查：组织模块页面/api/locale/mock、宿主 i18n 契约、各业务模块页面与 CSS Module、平台 `styles.css` 分区、架构/模块 lint、E2E 断言、快照 `5a44bdc`。
- 外部样本：TailAdmin 公开 demo 仅作布局形态参考，不进入依赖候选。
- 不修改任何文件；不下推与运行期行为冲突的结论。

## 证据：组织模块报错根因

### 1. 缺失翻译键（用户可见「翻译资源缺失」占位）

`internal/module/organization/binding/webui/web/AssignmentsPage.tsx`（快照 5a44bdc 引入）在三条路径使用 `webui.organization.assignments.*` 键：

- 保存成功反馈：`t("webui.organization.assignments.saved")`
- 409 冲突反馈：`t("webui.organization.assignments.conflict")`
- 版本行：`t("webui.organization.assignments.revision")`

而 locale 资源（`locale/zh-CN.json`、`locale/en-US.json`）只声明了无 `assignments.` 前缀的键：

- `webui.organization.saved` / `webui.organization.conflict` / `webui.organization.revision`

宿主 i18n（`webui/src/i18n.ts`）配置 `keySeparator: false`、`nsSeparator: false`，缺失键不会回退到近似键，而是被 `parseMissingKeyHandler` 统一替换为宿主 `webui.host.i18n.missing`（zh-CN「翻译资源缺失」/ en-US "Translation resource missing"）。因此分配页的版本行恒定渲染错误占位文案，保存成功/冲突反馈也显示占位。静态检查（lint:i18n、typecheck、Vitest 82 项）均无法捕获该键缺失，因为 i18n 扫描只校验 namespace/前缀覆盖与资源存在性，不校验「页面用到的完整键」是否在资源中定义。

### 2. 未捕获的 Promise 拒绝（控制台错误、页面无反馈）

- `DepartmentsPage.tsx`：`createDepartment(...).then(...)`、`updateDepartment(...).then(refresh)` 均无 `.catch`；
- `PositionsPage.tsx`：`createPosition(...).then(...)`、`updatePosition(...).then(refresh)` 均无 `.catch`；
- 失败时触发浏览器 unhandled rejection，页面没有任何错误反馈（对比 IAM 页面普遍 `.catch(() => setMessage(t("webui.iam.error")))` 的既有模式）。

### 3. 其他核对结论（未发现新报错）

- `organization.module.css` 的 `.organizationModule :global(...)` 选择器与页面节点合法；`.toolbar`/`.admin-grid`/`.admin-card`/`.admin-meta`/`.assignment-panel` 在模块 CSS 内有定义；
- `mock.ts` 路由模式与 `api.ts` 一致；`flatten` 导出被 `management.test.ts` 消费；
- e2e `webui.spec.ts` 组织段落（departments/positions/assignments）断言的是标题/文案与 label 值，快照下通过。

## 证据：TailAdmin 布局骨架形态（外部参考）

TailAdmin（react demo）的业务页面骨架：

- **Shell**：固定/可折叠侧边栏（品牌 + 「MAIN MENU」分组导航 + 底部用户卡）＋ 固定顶栏（汉堡、搜索、通知/日历/消息、用户菜单）；内容区为窗口滚动。
- **页面骨架**：页面标题区（面包屑 + 标题 + 动作）→ 统计卡行（4 张卡：图标 + 数值 + 标签 + 趋势/pill）→ 图表/内容卡（白色圆角卡：卡头标题 + 卡体）→ 表格卡（卡头 + 表格 + 页脚分页）→ 表单/设置卡。
- **卡片形态**：白色 surface、细边框、圆角、轻阴影、内部统一 padding；页间距与卡间距一致（16px 级）；响应式断点降列。

## 证据：当前业务页面结构与平台约束下的差距

### 当前各页面结构（快照 5a44bdc）

| 页面 | 结构 |
| --- | --- |
| iam Accounts | PageHeader + `Surface.toolbar`（创建）+ `Surface.management-panel` + `Surface.toolbar`（筛选）+ `admin-grid` 卡片 + 分页 |
| iam Roles | 同上模式 |
| iam Sessions | PageHeader + `Surface.toolbar` + `Surface.session-list` 网格表 |
| iam Security | PageHeader + `Surface` 内嵌 `iam-form` |
| iam Permissions | PageHeader + Surface 权限列表 |
| org Departments/Positions | PageHeader + `Surface.toolbar` + `admin-grid` 卡片 |
| org Assignments | PageHeader + `Surface.assignment-panel` 表单 |
| auth Audit | PageHeader + `Surface.audit-toolbar` + `Surface.audit-list` 网格表 |
| navigation Menus | PageHeader + revision 行 + `policy-grid` 策略卡 |
| ops Dashboard | PageHeader + `ops-summary` 统计行 + `ops-overview` 卡区 + `ops-metric` 卡 + 诊断卡组 |
| ops Capabilities | PageHeader + DataToolbar/FilterPanel + banner + DataTable + Pagination |

### 差距

- **平台缺少统一布局原语**：`toolbar`、`admin-grid`、`admin-card`、`admin-meta`、`management-panel`、`assignment-panel` 等近似通用布局样式由各模块在各目的 `*.module.css` 中重复定义（组织与 IAM 各定义了一份几乎相同的 `.toolbar/.admin-grid/.admin-card/.admin-meta`）。
- **缺少 TailAdmin 式骨架层级**：没有「区块卡片（标题 + 主体 + 页脚）」「统计卡行」「表格卡片」的平台组件；ops 的 `ops-summary` 与 IAM/org 的 `admin-grid` 形态不统一。
- **平台样式 authority 边界允许容纳通用布局原语**：`lint-architecture.mjs` 只禁止列出的业务 selector（auth-panel/ops-grid/diagnostic- 等）进入 `styles.css`；通用布局名（toolbar/page-section/stat-card/data-card 等）进入平台分区不违反门禁，反而是「业务 selector 禁止进入平台 + 通用布局由平台提供」的既有精神。

## 事实与推断的区分

**事实（有代码证据）**：组织分配页三条 `assignments.*` 键缺失；页面创建/更新操作无 `.catch`；各模块重复定义近似布局样式；TailAdmin 骨架由「统计行 + 区块卡 + 表格卡 + 页脚分页」构成；平台 lint 只封禁列明业务 selector。

**推断（需设计确认）**：
- 缺失键与无反馈操作就是用户在浏览器里看到的「报错」主体；
- 把通用布局原语收编到平台（`webui/src/ui` 组件 + `styles.css` 分区 5）并让模块迁移，能消除重复且形成 TailAdmin 式骨架，同时不触碰模块 Binding/Manifest/权限契约。

## 适用与不适用场景

- 适用：修复组织模块报错；建立并迁移平台布局骨架；统一统计行/区块卡/表格卡形态。
- 不适用：引入 Tailwind/组件库（059 否定）；改动服务端契约与模块边界；重写业务逻辑。

## 局限与剩余未知

- 未在真实浏览器逐页采集控制台错误；结论基于源码静态事实与 i18n 契约语义，E2E/visual 复核留到实施验证阶段。
- TailAdmin 具体视觉参数（色板/间距）不作为硬性规格，仅参考骨架形态；本项目以 `styles.css` token 为准。

## 对本任务的影响

- 计划阶段把「组织模块 locale 键修复 + 操作失败反馈」列为任务 A；
- 「平台布局原语 + 全模块页面迁移」列为任务 B，并在设计文档中给出每个页面的目标结构；
- 结论支撑「布局原语进入平台分区 + 模块 CSS 保留模块专属 selector」的边界方案。