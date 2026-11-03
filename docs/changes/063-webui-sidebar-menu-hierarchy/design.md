# 063 设计方案：当前业务模块侧边栏菜单层级分类

## 1. 背景与目标形态

宿主对 `manifest.menu` 按 `parentId` 递归建树并渲染（`buildMenuTree`/`SidebarMenu`），契约 `Navigation.ParentID` 原生支持多级；当前只有 ops 使用了两级。本任务把 IAM、Organization（以及按决策的 Navigation）从平铺整理为「父组 + 子项」的层级分类，全部在模块 WebUI Binding 静态声明内完成，不触碰 webui 代码。

目标侧边栏（示例，最终文字/图标/归属由决策 1–3 确认）：

```text
工作台 (ops.dashboard)                    [10] 父
└ 能力清单 (ops.capabilities)              [20] 子
身份与权限管理 (iam.access，新增父)          [30] 父（落地页引用已实现路由）
├ 账号安全 (iam.security)                  [40]
├ 用户管理 (iam.accounts)                  [50]
├ 角色管理 (iam.roles)                     [60]
└ 权限管理 (iam.permissions)               [70]
组织管理 (organization.directory，新增父)    [80] 父（落地页引用已实现路由）
├ 部门 (organization.departments)          [90]
├ 岗位 (organization.positions)            [100]
└ 组织分配 (organization.assignments)      [110]
菜单管理 (navigation.menus)                [120] 按决策平铺或归组
```

## 2. 方案对比

| 方案 | 做法 | 结论 |
| --- | --- | --- |
| A（采纳） | 只调整模块 `binding/webui/binding.go` 的 Navigation 声明：新增父 Navigation（引用本模块已实现路由作落地页），设置子项 `ParentID`，重排 Order；同步 locale、mock、生成物、测试与文档 | 纯声明 + 配套，契约与宿主零改动，符合“不修改 webui 代码” |
| B（不采纳） | 扩展 `Navigation` 类型新增“Category/Group”字段并改 Manifest 结构 | 修改契约与宿主消费逻辑，违反约束且无必要（ParentID 已足够） |
| C（不采纳） | 跨模块统一父组（如“系统管理”容纳 navigation+iam） | 契约校验强制 ParentID 同模块；跨模块需改契约核心，超范围 |

## 3. 数据流与实现位置

```
internal/module/<id>/binding/webui/binding.go  (声明父/子 Navigation、Order、落地页 RouteID)
  → internal/composition/webui_registry.go     (catalog 投影 mock manifest menu 树)
  → webui/src/generated/webui-registry.ts      (重新生成，含 menu parentId)
  → 宿主 SidebarMenu 递归渲染                   (零改动)
  → internal/module/navigation/.../mock.ts     (菜单管理页 mock 数据同步)
```

## 4. 具体改动清单（按决策采纳后）

### 4.1 IAM（`internal/module/iam/binding/webui/binding.go`）

- 新增父 `Navigation`：`ID: "iam.access"`，`ParentID: ""`，`RouteID: "iam.accounts"`（落地页=用户管理，已实现），`TitleMessageID: "webui.iam.access.title"`，`IconID` 选受控目录内成员（如 `users`/`shield`），`Order` 置于所有 iam 子项之前（如 30）。
- 将 `iam.security`、`iam.accounts`、`iam.roles`、`iam.permissions` 的 `ParentID` 设为 `"iam.access"`，并为其设置组内顺序（如 40/50/60/70）。
- 子项顺序必须“父在前、子在后”以满足 manifest 排序直觉；父子相对顺序由 Order 保证。

### 4.2 Organization（`internal/module/organization/binding/webui/binding.go`）

- 新增父 `Navigation`：`ID: "organization.directory"`，`RouteID: "organization.departments"`（落地页=部门，已实现），`TitleMessageID: "webui.organization.directory.title"`，`IconID` 选目录内成员（如 `building`/`users`），Order 置于子项之前。
- `organization.departments`、`organization.positions`、`organization.assignments` 设置 `ParentID: "organization.directory"` 与组内顺序。

### 4.3 Ops / Navigation

- ops：不修改（保留两级现状与顺序）。
- navigation（决策 3）：默认保持平铺；若确认归组，则在 navigation 模块声明父节点并引用 `navigation.menus` 路由。

### 4.4 Locale（强制 i18n）

- IAM：`webui/iam/.../locale/{en-US,zh-CN}.json` 增加 `webui.iam.access.title`。
- Organization：`webui/organization/.../locale/{en-US,zh-CN}.json` 增加 `webui.organization.directory.title`。
- 若 navigation 归组：`webui/navigation/.../locale/{en-US,zh-CN}.json` 相应增加组标题。

### 4.5 Mock 与生成物

- `internal/module/navigation/binding/webui/web/mock.ts`：菜单行数组按新声明同步（新增父行、修正 defaultParentId/order）。
- 重新生成 `webui/src/generated/webui-registry.ts`（catalog → mock manifest menu 树）。生成命令见 `docs/development/webui.md`（`go run ./cmd/app webui generate` 或等价的 webui 生成入口）。

### 4.6 测试与文档

- 契约测试：在 `internal/webui/contract_test.go` 或 composition 测试中补充“父节点落地页引用已实现路由、同模块 ParentID、无环、顺序、locale 覆盖、mock/registry 同步”的断言（保持既有测试通过）。
- `docs/development/webui.md`：在导航/菜单段落补充“当前应用菜单层级分类（分类父节点 + 落地页语义）”与「新增分类父节点时同步 mock/locale/生成物」的操作说明。
- 变更记录：本目录 README/requirements/design/tasks 与 `documentation-impact.yaml`。

## 5. 失败语义与边界

- 父节点不可加载（access 拒绝或 availability 不可用）时，`ManifestForWithNavigation` 与 `retainMenuWithVisibleParents` 会连带隐藏子项——这是既有语义，父落地页应选择**同组内普遍可访问**的已实现路由，避免单页权限导致整组消失；确认决策时需说明该选择。
- locale 缺失、icon 越界、ParentID 越模块/成环都会被 `validateBindings` 拒绝，协作任务必须保持“声明与契约一致”。
- mock 数据与生成 registry 若不同步会导致 mock 模式菜单与管理页不一致；必须重新生成并跑 `generate:check`。

## 6. 验证方案

1. Go：`go test ./internal/webui/... ./internal/composition/...` 与 Navigation service 相关测试；`go vet ./internal/...`。
2. WebUI：`pnpm generate:check`、`pnpm test`（menu.test.ts 等）；Playwright e2e 既有用例本机可运行时执行。
3. 文档：`scripts/Verify-Docs.ps1`（或等价）通过；`documentation-impact.yaml` 覆盖命中 authority。
4. 人工复核生成 registry diff：确认新增父节点与 parentId 正确、ops 结构未变。

## 7. 待确认决策

- 决策 1（推荐）：IAM / Organization 采用“新增组父节点（新标题与图标）+ 子项 ParentID”的形态（方案 A），落地页分别引用 `iam.accounts`、`organization.departments`。
- 决策 2（推荐）：父节点 IconID 使用目录内已有语义图标：IAM 父组 `users`（或 `shield`）、Organization 父组 `building`；组标题文案按模块 locale 双语编写。
- 决策 3（推荐）：navigation 单页保持平铺根级（不建单一子项的父组），与 ops 结构共存。
- 决策 4（推荐）：父落地页选择同组内最常用页（IAM=用户管理、Organization=部门），并接受“父不可加载则整组隐藏”的既有门禁语义。
- 决策 5（推荐）：本变更只做声明与配套（不含任何 webui 源码修改），交付后 running 行为由宿主既有能力呈现。

## 8. 文件影响

| 文件 | 动作 |
| --- | --- |
| `internal/module/iam/binding/webui/binding.go` | 修改 Navigation 声明（新增父 + 子项 ParentID/Order） |
| `internal/module/organization/binding/webui/binding.go` | 修改 Navigation 声明 |
| `internal/module/{iam,organization}/binding/webui/web/locale/{en-US,zh-CN}.json` | 增加组标题 message |
| `internal/module/navigation/binding/webui/web/mock.ts` | 同步菜单行 |
| `webui/src/generated/webui-registry.ts` | 重新生成（生成物，非手改） |
| `internal/webui/contract_test.go` / composition 测试 | 增加/更新层级断言 |
| `docs/development/webui.md` | 菜单层级说明 |
| `docs/changes/063-webui-sidebar-menu-hierarchy/**`、`docs/changes/README.md`、`documentation-impact.yaml` | 变更记录 |
| （决策 3 若归组）`internal/module/navigation/binding/webui/binding.go` 等 | 修改声明 |