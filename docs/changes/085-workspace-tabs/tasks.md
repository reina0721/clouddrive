# 085 任务与证据（Rev.2：自动页面标签）

## 当前门禁

用户在本轮以目标指令对 085 提出**实质需求反转**并明确下令实施：

> 顶部标签栏代表后台当前"已打开的页面"，不是显式 opt-in 的特殊 workspace：所有通过侧边栏菜单、页面导航或路由进入的正式页面都应自动创建并保留一个标签；Dashboard 作为固定首页标签；普通列表页、设置页、管理页都必须生成标签；动态详情页按具体实体生成独立标签；只有 Drawer/Modal/Popover 等临时交互不生成标签；标签在页面切换后持续存在并在刷新后恢复；支持关闭、关闭其他、关闭右侧、固定、溢出管理和未保存状态；**禁止再要求路由显式声明 workspace 才能出现标签**。

该指令推翻 Rev.1 的「显式 opt-in（默认 disabled + 仅 openapi singleton）」模型：标签资格不再由 `WorkspaceTabPolicy` 声明决定，而由宿主对**所有正式路由**（已实现、可加载、app 布局、access 放行）自动判定。Drawer/Modal/Popover 不是路由，天然不进入标签语义。Rev.1 的 mounted panel、42px 标签栏、关闭/固定/溢出/未保存/持久化等工程能力全部保留并扩展为全路由覆盖。

## 修订决策（Rev.2）

| ID | 决策 | 值 |
| --- | --- | --- |
| `REV2-001` | Go/TS 契约移除 `WorkspaceTabPolicy`（route 不再声明标签资格） | 移除 `Route.WorkspaceTab`/`ManifestRoute.workspaceTab`/TS union；`webui generate` 重新生成 |
| `REV2-002` | 标签资格判定 owner 为宿主 | 所有 `layout=app` + `deliveryState=implemented` + `routeIsLoadable` + `access=allowed` 的 route 自动 open/activate |
| `REV2-003` | 标签身份 = routeID + 上下文键 | 静态路由（pathname === route.path）contextKey 为空，同 route 去重激活；动态路由（子路径）按 pathname 差异生成独立标签 |
| `REV2-004` | Dashboard 固定首页 | `manifest.routes[].default == true` 的 route 打开即 pinned（不受关闭其他/右侧批量影响）；显式 unpin 后可关 |
| `REV2-005` | 持久化无 restorable 门禁 | 所有正式路由的元数据都可按 principal 隔离恢复（仍只存低敏 allowlist 投影，不存 dirty/草稿/任意 query） |
| `REV2-006` | SDK 窄会话保留 | `useWorkspaceSession`（dirty/active/requestClose/registerBeforeClose）不变，供正式页面报告未保存状态 |
| `REV2-007` | 普通路由渲染迁移到面板 | AppShell 对任何 app 路由打开/激活标签并由 mounted panel 承载；普通 Outlet 仅保留为 fallback |

## 任务清单（Rev.2）

| ID | 依赖 | 工作量 | 任务 | 完成条件 | 状态 |
| --- | --- | --- | --- | --- | --- |
| `REV2-R-001` | — | S | 复核 Rev.1 代码与需求差异（契约/registry/路由/存储/UI） | 差异清单可复核 | 完成 |
| `REV2-C-001` | REV2-R-001 | M | Go/TS 契约移除 WorkspaceTabPolicy 并重新生成 | contract tests 全绿；`generate --check` 通过 | 完成 |
| `REV2-S-001` | REV2-C-001 | L | registry 改为 routeID+contextKey 身份、Dashboard 固定、去 opt-in | 纯函数测试覆盖去重/固定/动态上下文 | 完成 |
| `REV2-P-001` | REV2-S-001 | M | storage 去掉 restorable 门禁，全正式路由可恢复 | principal 隔离/allowlist/坏数据 fail closed 测试 | 完成 |
| `REV2-R-002` | REV2-S-001 | XL | AppShell/routes 全路由 open/activate + 普通 Outlet fallback | 普通页面也生成标签；重复访问不重复；inactive inert | 完成 |
| `REV2-U-001` | REV2-R-002 | M | 42px 标签栏适配全路由（关闭其他/固定/溢出沿用） | REQ-003/004/005/010 全路由通过 | 完成 |
| `REV2-Q-001` | REV2-U-001 | L | 全量验证（Go/TS/e2e/视觉） | 与 Rev.2 语义一致的全链路证据 | 完成 |
| `REV2-D-001` | REV2-Q-001 | M | 更新 085 requirements/design/authority/索引 | 现状只描述 Rev.2 语义 | 完成 |
| `REV2-CM-001` | REV2-D-001 | S | 精确暂存并提交确认范围 | Conventional Commit；不混入用户修改 | 完成 |

## 关键实施边界

- 移除 `WorkspaceTabPolicy` 后，`openapi` binding 不再声明任何 workspace 字段（REV2-001）。
- 动态详情实体的 contextKey 由宿主从 `location.pathname` 相对 `route.path` 的差异派生，只用于相等性，不持久化敏感原文（仍只存 routeID + 低敏 context key 派生）。
- beforeunload 保护、logout 决策、批量关闭原子性与 pinned 语义沿用 Rev.1 实现。

## Rev.2 实施证据

### REV2-C-001（契约移除）

- `internal/webui/contract.go`：删除 `WorkspaceTabMode`/`WorkspaceTabPolicy`/`ManifestWorkspaceTabPolicy`、`Route.WorkspaceTab`、`ManifestRoute.workspaceTab` 投影与 `validateRouteWorkspaceTabPolicy` 调用链；manifest 不再携带任何 workspaceTab 字段。
- `internal/module/openapi/binding/webui/binding.go`：openapi.workspace 恢复为普通路由声明。
- `internal/webui/contract_test.go`：替换为 `TestManifestRoutesCarryNoWorkspaceTabContract`（守护契约面不再出现该字段）。
- `webui/src/contracts/index.tsx`、`webui/src/sdk/runtime/index.tsx`：删除 `WorkspaceTabPolicy` 与 `workspaceTab`；保留 `WorkspaceSession`/`useWorkspaceSession` 窄契约。
- `webui/src/generated/webui-registry.ts`：重新生成（mock manifest 移除 workspaceTab），`generate --check` 通过。

### REV2-S-001（registry 自动标签）

- `webui/src/workspace/registry.ts`：`OpenWorkspaceInput` 去掉 policy → 改为 `routeID/path/location/contextKey/isDefaultHome/restoreKey`；ID 工厂 `ws:r:<routeID>`（静态）/ `ws:d:<routeID>:<contextKey>`（动态详情按实体）；`fixedHome`（Dashboard 首页）pinned 且不可关闭/取消固定/被批量动作波及；`hydrate` 并入保留。
- `webui/src/workspace/registry.test.ts`：19 用例（全路由可开、静态去重、动态详情按实体分离、12 上限、fixedHome 保护、pinned/dirty 原子性、关闭焦点、restore、reconcile）。

### REV2-P-001（持久化全路由）

- `webui/src/workspace/storage.ts`：删除 `RestorableRoute` 门禁，任何正式路由元数据都可持久化；动态详情仍需低敏 `restoreKey`（host 派生）才能进 JSON；principal 隔离 / allowlist / 坏数据 fail closed 不变。
- `webui/src/workspace/storage.test.ts`：9 用例更新为全路由可投影语义。

### REV2-R-002（路由与分流）

- `webui/src/routes.tsx`：移除 `WorkspaceTabPolicy`/`isWorkspaceRoute` 分支；`RouteSlot` 供**所有** app 正式路由（layout=app + implemented + loadable + access=allowed）在 fallback 树占位（access 门禁不变），`renderPanelRoutes` 过滤所有正式路由；`ManifestRouteView` 共用不复制路由树。
- `webui/src/workspace/WorkspaceProvider.tsx`：新增 `routeIsFormal`/`deriveContextKey`；hydration/reconcile 按正式路由过滤；`projectPersistedState` 无 restorable 参数；`resolveTabTitle` 对动态详情追加低敏 contextKey。
- `webui/src/components/AppShell.tsx`：导航 effect 对每个正式路由 `openWorkspace`（contextKey 派生、Dashboard `isDefaultHome`），非正式路由 deactivate；`WorkspaceArea` 常驻渲染标签栏 + mounted panels，普通 Outlet 仅作 fallback。
- `webui/src/workspace/WorkspaceOutlet.tsx`：open 面板按标签渲染；inactive `hidden`+`inert` 不卸载。

### REV2-U-001（UI 全路由）

- `webui/src/components/shell/WorkspaceTabs.tsx`：`fixedHome` 标签不渲染关闭按钮、上下文菜单禁用相关动作；自动标签全路由可固定/关闭其他/关闭右侧/溢出/键盘。
- `test-results/085-workspace-tabs-{desktop,laptop,mobile}-{light,dark}.png` 重新生成（Dashboard 首页标签 + 42px/指示线/不换行断言）。

### REV2-Q-001（验证）

- Go：`go build ./...`、`go vet ./...`、`go test ./internal/webui/... ./internal/module/openapi/... ./internal/composition/...` 全绿。
- WebUI：`generate --check`、ESLint（0 错误）、typecheck、Vitest（49 文件 234 用例，含 Rev.2 新增/更新 35）、`vite build` 全绿。
- E2E：dev `webui.spec.ts` 新增「085 automatic page tabs, dedup, mounted state and fixed home」；071/072 settings 测试改为活动面板作用域；mock `webui-mock.spec.ts` 新增「085 automatic page tabs...」并更新 082/084 为活动面板作用域；全套件 26 通过、仅存 5 个基线上已存在失败（setup「Password」重复、organization「Platform」标题、navigation policy、067×2），与 Rev.2 无关。
- 视觉：`085-workspace-tabs-*.png` 6 张 + mock 流程截图，断言 42px/指示线/不换行/Dashboard 首页标签。

### REV2-D-001（authority）

- `docs/development/webui.md`、`webui/README.md`：085 章节改写为「自动页面标签」语义（正式路由自动建标签、Dashboard 固定首页、动态详情按实体、Drawer/Modal/Popover 不生成）。
- `docs/changes/085-workspace-tabs/requirements.md`、`design.md`、`README.md` 与 `docs/changes/README.md` 索引同步 Rev.2 语义与完成状态；`documentation-impact.yaml` 更新影响范围。