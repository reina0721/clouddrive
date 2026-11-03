# 063 需求规格：当前业务模块侧边栏菜单层级分类

引用研究：[R063-001](research/R063-001-sidebar-menu-hierarchy/report.md)。

## 1. 目标

在 **webui 契约**（各业务模块的 `binding/webui` 静态声明）内，把当前业务模块（Ops、IAM、Organization、Navigation）的侧边栏菜单整理为清晰的**菜单层级分类**：为多页面模块引入顶级“组”父节点，同模块页面归入其下；ops 已具备两级结构保持现状；navigation 单页按决策处理。目标形态通过现有 `Navigation.ParentID` 契约与宿主递归菜单渲染实现，**不修改任何 webui 代码**。

## 2. 功能要求

| ID | 要求 |
| --- | --- |
| `REQ-063-001` | 不得修改 webui 代码：不得改动 `webui/src/**` 宿主源码、`SidebarMenu`/`AppShell`/`menu.test.ts`、SDK、契约类型定义（`internal/webui/contract.go`）、生成器生成逻辑。现有的宿主递归菜单能力即目标渲染基础。 |
| `REQ-063-002` | IAM 菜单层级：引入顶级父节点（“身份与权限”等组标题），把 `iam.security`、`iam.accounts`、`iam.roles`、`iam.permissions` 按决策归属；父节点必须引用 `iam` 模块一个已实现路由作为落地页，且父项顺序在所有子项之前。 |
| `REQ-063-003` | Organization 菜单层级：引入顶级父节点（“组织管理”等组标题），把 `organization.departments`、`organization.positions`、`organization.assignments` 归入其下；父节点引用 `organization` 模块已实现路由，顺序在子项之前。 |
| `REQ-063-004` | Ops 保持现状两级：`ops.dashboard`（工作台）仍为父，`ops.capabilities`（能力清单）仍为其子；不得打乱当前顺序。 |
| `REQ-063-005` | Navigation 单页：按决策确定为保持平铺（`navigation.menus` 根级）或归入自身模块父组；两种形态都必须通过契约校验。 |
| `REQ-063-006` | 新增父节点必须满足全部既有契约校验：NavigationID 唯一、ParentID 同模块且无环、RouteID 引用同模块已实现路由、IconID 属于受控目录、Order 在界内、locale 覆盖所有 Navigation TitleMessageID。 |
| `REQ-063-007` | 组标题文案：新增父节点的标题与（若需要）图标/顺序 message ID 必须写入对应模块 locale（`binding/webui/web/locale/{en-US,zh-CN}.json`），满足强制 i18n 与 `validateWebUILocaleCoverage`；不得新增宿主 locale 键。 |
| `REQ-063-008` | 生成物与 mock 同步：重新生成 `webui/src/generated/webui-registry.ts`（含 mock manifest 的 menu 树）；同步 `internal/module/navigation/binding/webui/web/mock.ts` 的菜单行以匹配新声明；`generate:check` 通过。 |
| `REQ-063-009` | 回归不破坏：宿主 `menu.test.ts`、e2e `webui.spec.ts`/`webui-mock.spec.ts` 不得因菜单层级变化失败；Navigation 策略服务对新增父节点的 Manageable/parent/order 语义按既有逻辑成立。 |
| `REQ-063-010` | 先研究、后计划：research 档案与本计划文档必须在实施前落地；实施前必须获得用户确认（状态流转见 tasks.md）。 |

## 3. 非功能要求

- 不新增路由、不新增页面、不新增操作权限、不修改 Manifest 结构字段（继续使用 `parentId`）。
- 不改变 access/availability 投影门禁与授权语义；菜单隐藏依旧不构成授权。
- 不修改 `internal/webui/contract.go` 的 `Navigation` 类型与校验规则（现有能力已满足）。
- 分类顺序遵循“父节点在子节点之前 + 子节点保持既有相对顺序/更新为组内合理顺序”，manifest 排序稳定可重复。

## 4. 验收标准

1. 重新生成后，`webui/src/generated/webui-registry.ts` 的 `webuiMockManifest.menu` 出现新父节点且 `parentId` 正确；`pnpm generate:check`（或等价检查）通过。
2. IAM/Organization 侧边栏呈现两级：顶级组（正确标题/图标）展开后包含对应页面；ops 两级结构不变；navigation 按决策呈现。
3. `go test ./internal/webui/...`、`go test ./internal/composition/...`、Navigation service 相关测试全量通过；新增/更新的契约测试覆盖：父节点校验、ParentID 同模块、无环、顺序、mock/registry 同步。
4. 宿主 `pnpm test`（含 `menu.test.ts`）通过；e2e 既有用例不回归（本机可运行时）。
5. 文档 authority 与实现一致：`docs/development/webui.md`、变更记录与 `documentation-impact.yaml` 反映新菜单层级结论。

## 5. 非目标

- 不做跨模块父节点（契约当前不允许，也未获得需求授权）。
- 不实现运行时动态菜单、不引入数据库新增菜单、不扩展 NavigationPolicy 模型。
- 不修改 webui 宿主代码、不改渲染/交互行为；不新增第三方依赖。
- 不实施容器 runtime / 远端 CI 浏览器验收（保持既有验证边界）。