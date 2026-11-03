# R063-001 侧边栏菜单层级分类的契约现状与可行路径

## 1. 研究问题

用户要求：在 webui 契约中，对当前业务模块的 webui 侧边栏进行菜单层级分类，且**不修改 webui 代码**。需要回答：

1. 契约与宿主当前如何表达和渲染侧边栏菜单层级？
2. 当前业务模块的菜单声明现状是什么、是否已有层级？
3. 在不改 webui 代码的前提下，把菜单整理为「层级分类」的最小可行改动是什么？
4. 改动会波及哪些文件、测试、mock 与文档？

## 2. 方法与范围

- 只读检查 `internal/webui/contract.go`、`internal/composition/{webui_registry.go,navigation.go,webui_http.go}`、四个模块的 `binding/webui/binding.go`、Navigation 策略 service/model、导航模块 mock、宿主 `SidebarMenu.tsx`/`AppShell.tsx`/`menu.test.ts`、生成 registry 与 Playwright e2e 用例；快照 commit `e059a1638ab88b2ee0664931d7272b5c4ed11e76`。
- 复用既有研究：`056/R001`（菜单静态所有权 + NavigationPolicy 边界）、`059/R003`（模块自有 Binding/Host 可插拔边界）、`062/R062-001`（导航多级已实现、图标目录缺失的历史结论；图标目录现已落地）。
- 不修改任何实现文件；不启动服务；不执行浏览器验收。

## 3. 证据：当前事实（有代码证据）

### 3.1 契约已经完整支持多级菜单

- `webui.Binding.Navigation` 是 `[]Navigation`，字段为 `ID/ParentID/RouteID/TitleMessageID/IconID/Order`（`internal/webui/contract.go` `Navigation` 类型）。**`ParentID` 契约与校验早已存在**。
- 契约校验（`validateBindings`）保证：NavigationID 唯一、RouteID 必须引用同模块已实现路由、ParentID 必须引用同模块已声明 Navigation、无环（`validateNavigationCycles`）、IconID 属于受控目录、Order 在 `[-1_000_000, 1_000_000]`。
- Manifest 投影（`ManifestForWithNavigation`）只输出满足「policy enabled + RouteID 可加载（access 放行且 availability 可用/降级）」的菜单项，`ManifestMenu` 携带 `parentId`；`retainMenuWithVisibleParents` 保证父级不可见时整棵子树不输出。
- 宿主 `SidebarMenu` 对 `manifest.menu` 按 `parentId` 递归建树并递归渲染（`buildMenuTree`），支持任意多层、展开/折叠、祖先激活；`menu.test.ts` 已覆盖多级组装、孤儿节点落根、子孙展开、active link。

### 3.2 当前模块菜单声明现状：几乎全部平铺

| 模块 | 当前 Navigation 声明 | Order |
| --- | --- | --- |
| ops | `ops.dashboard`（父，RootID=ops.dashboard）→ `ops.capabilities`（ParentID=ops.dashboard） | 10 / 20 |
| iam | `iam.security`、`iam.accounts`、`iam.roles`、`iam.permissions`（全部无 ParentID） | 30/40/50/60 |
| organization | `organization.departments`、`organization.positions`、`organization.assignments`（全部无 ParentID） | 70/80/90 |
| navigation | `navigation.menus`（无 ParentID） | 100 |

结论：唯一展示「层级分类」的是 ops（工作台展开能力清单）；IAM、Organization、Navigation 目前全部平铺在根级。

### 3.3 页面路由对应关系（做分类必须引用真实路由）

- iam：`iam.accounts`（/admin/accounts 用户管理）、`iam.roles`（/admin/roles 角色）、`iam.permissions`（/admin/permissions 权限）、`iam.security`（/account/security 账号安全）。
- organization：`organization.departments`（/admin/departments 部门）、`organization.positions`（/admin/positions 岗位）、`organization.assignments`（/admin/account-organization 组织分配）。
- navigation：`navigation.menus`（/admin/menus 菜单策略）。
- ops：`ops.dashboard`（/dashboard 工作台）、`ops.capabilities`（/dashboard/capabilities 能力清单）。

### 3.4 Navigation 策略模块与 mock

- `navigation` 模块（056）只管理**已注册 NavigationID** 的 enabled/parent/order 覆盖；`Definition.Manageable` 由 Route 是否 implemented 决定，因此**只要父节点引用已实现路由，新父节点自动成为可管理项**，无需改动 Navigation service/model。
- 菜单管理页 mock 数据（`internal/module/navigation/binding/webui/web/mock.ts`）硬编码了全部菜单行；若静态声明变化，该 mock 必须同步，否则 mock 模式与管理页不一致。
- 生成 registry（`webui/src/generated/webui-registry.ts`）内嵌 `webuiMockManifest`（Go catalog 投影），其中含 `menu` 顶点；静态菜单变化后必须重新生成，否则 `generate:check` 与 mock revision 门禁失败。

### 3.5 宿主 e2e 不依赖具体菜单树

- `webui/e2e/webui.spec.ts` 中菜单数据由用例自建（手写 manifest），不读取 catalog；菜单层级变化不会破坏这些用例的既有断言（断言锚定的是路由、标题、能力名，而非树形）。
- `webui/src/menu.test.ts` 只测通用建树逻辑，不依赖具体模块声明。

## 4. 事实与推断的区分

**事实**：契约与宿主支持多级菜单；当前除 ops 外全部平铺；父节点必须引用同模块已实现路由；Policy 只管理已注册 ID；mock/registry 需要与静态声明同步。

**推断（需设计确认）**：
- 「菜单层级分类」的目标形态 = 为 IAM / Organization 引入顶级父组（如「身份与权限」「组织管理」），把同模块页面归入其下；ops 保持现状；navigation 单页保持平铺或归组由计划确认。
- 父节点标题/图标采用「组语义」而非「页面语义」（新建父 Navigation 节点，不等同复用某页面标题），以体现「分类」；这要求在模块 locale 增加组标题 message ID。
- 分类只做「声明层」调整即可达成，不需要改契约类型、不需要改宿主、不需要新路由/新页面。

## 5. 适用与不适用场景

- 适用：当前五个模块（iam/organization/navigation/ops）的侧边栏层级分类；mock 与生成物同步；契约测试加固。
- 不适用：跨模块共享父节点（契约校验要求 ParentID 同模块）、运行时动态分组、数据库新增任意菜单、改宿主渲染逻辑（用户明确禁止）。

## 6. 局限与剩余未知

- 未执行浏览器验收；运行期视觉（展开/激活/移动端）沿用宿主既有能力，不因声明变化而改变行为契约。
- 分类后的具体父子关系、标题文案、顺序是否含用户偏好，属于计划确认内容，研究不代答。
- 本地 `navigation_menu_policies` 表当前为空（只读检查 `.data/app.db` 确认 0 行），改动不涉及既有策略迁移；生成 registry 与 mock 需重新生成。

## 7. 对本任务的影响

- 结论：**契约与宿主已具备多级菜单能力**；对当前业务模块做「菜单层级分类」属于纯声明调整 + locale + mock + 生成物 + 测试 + 文档，不需要修改 webui 代码，也不需要扩展契约核心。
- 研究门禁：证据充分（契约、宿主渲染、当前声明、Policy/mock/生成物均已核实），足以形成计划。