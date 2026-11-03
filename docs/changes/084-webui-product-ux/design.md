# 084 设计：逐页新 IA 与实现方式

支撑研究 R084-001；全部文本走模块 locale（zh/en 成对），JSX 用户文案必须 t()（i18n 契约 lint）。

## 平台原语（webui/src/styles.css / webui/src/ui/index.tsx）

新增/修订平台级语义（不被业务模块复制）：

- `.field-grid`：受限表单网格 `grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); max-width: 640px;`，供创建/编辑表单在宽卡片内保持字段有界（解决 .toolbar flex 撑宽根因）。
- `.row-actions`：行内动作区（secondary 按钮 + 危险按钮）右对齐的紧凑行。
- `.split-workspace`：master-detail 网格 `grid-template-columns: minmax(0, 300px) minmax(0, 1fr)`（900px 以下单列），替代 org-tree-inspector 的固定 320px（Menus 截断根因修一处）。
- `InspectorPanel`：内容允许纵向滚动（`overflow-y:auto`，由使用方给 max-height/height），子内容不再横向溢出。

## 各页面

### Departments（重写 DepartmentsPage.tsx + organization.module.css + locale）

IA：PageHeader（actions: New department）→ 单个「Department directory」PageSection 内 split-workspace：

- 左列：目录头（count）+ 名称/编码搜索（过滤树，命中保持祖先）+ TreeView（expandAll）。
- 右列（视图模式）：EntityHeader（名称 + archived/active StatusBadge）；字段组 code/parent/status；编辑区 name 输入 + Save changes（PATCH name，乐观锁 version；成功刷新树）；DangerZone：archive/restore（ConfirmActionTrigger）。
- 创建模式：Drawer（code/name/parent select + Create），维持 PageHeader 动作入口。
- flatten 导出保留（测试引用）。

### Positions（重写 PositionsPage.tsx + locale）

IA：PageHeader（actions: New position）→ 单个「Positions」PageSection：

- toolbar：SearchInput（客户端过滤 code/name）+ 结果计数。
- DataTable：code(mono)/name/status(active/archived pill)/createdAt(datetime)；行菜单 = 1 主操作 Rename + …（Archive/Restore 危险最后，ConfirmDialog 二次确认）。
- Rename 用 Drawer（name 输入 + Save）。创建 Drawer（code + name）。
- Position 前端类型补 createdAt/updatedAt（handler DTO 已有）。

### Assignments（重写 AssignmentsPage.tsx + locale）

IA：PageHeader → 单个「Organization assignment」PageSection 内 split-workspace：

- 左列：账号列表（SearchInput 过滤 + 行：displayName + @username，选中高亮），默认第一个。
- 右列：编辑器：department select（仅 active）、positions 复选组（active，分组显示？mock 无分组字段——保持平铺但 2 列 grid）、revision 行、Save（主按钮）。冲突提示保留（乐观锁回落）。

### Menus（重写 MenusPage.tsx + navigation.module.css + 平台 inspector 溢出修复）

- sdk/i18n 导出 `translateMessage` 与 `ensureRouteLocale`（webui/src/i18n.ts 已有实现）。
- refresh 后对全部菜单 titleMessageId 调用 ensureRouteLocale，渲染 title() 统一 translateMessage —— 消除原始 key。
- 右列：InspectorPanel 改可滚动容器；策略控件改为纵向分组（enabled Check 行、parent Select 行、order 输入行、Save 行），不再四列 grid。
- 空态：树为空时提示。

### OpenAPI（OpenAPIPage.tsx + openapi.module.css + locale）

- 首访（无 `op` 参数且无选中）自动打开第一个 operation（roots 顺序第一个 row）。
- workspaceEmpty 改为图标 + 标题 + 说明 + 「打开第一个接口」按钮（打开后隐藏）。
- treeScroller 保持滚动，补充在底部 padding 防截断观感。

### Permissions（PermissionsPage.tsx + iam locale）

- 定位缺失描述的 permission key，补齐 zh/en 文案；缺失时 translateMessage 回落可读文本。
- 列宽：key 列 CodeText 不换行 + overflow 省略；description/usedBy 列 min-width 收敛；表格密度 default。

## 文件影响（第一批）

- `internal/module/organization/binding/webui/web/{DepartmentsPage,PositionsPage,AssignmentsPage}.tsx`、`organization.module.css`、`locale/{zh-CN,en-US}.json`
- `internal/module/navigation/binding/webui/web/MenusPage.tsx`、`navigation.module.css`、`locale/{zh-CN,en-US}.json`
- `internal/module/openapi/binding/webui/web/OpenAPIPage.tsx`、`openapi.module.css`、`locale/{zh-CN,en-US}.json`
- `internal/module/iam/binding/webui/web/PermissionsPage.tsx`、`locale/{zh-CN,en-US}.json`
- `webui/src/styles.css`（平台原语）、`webui/src/sdk/i18n/index.ts`（导出 translateMessage/ensureRouteLocale）
- 文档：`docs/changes/084-*/`、`docs/changes/README.md` 索引

## 失败语义与验证

- 所有写操作沿用乐观锁 version/409 处理（既有 Save 逻辑），失败展示错误提示并重新加载最新数据。
- 验证：`pnpm lint`（modules/i18n/architecture）、`tsc --noEmit`、`vitest run`、mock Playwright（含 084 新增断言：menus 无原始 key、openapi 默认选中、org 编辑/重命名）、`vite build`、重新截图 + codex 复查。