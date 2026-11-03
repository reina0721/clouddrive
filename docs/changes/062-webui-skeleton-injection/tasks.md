# 062 任务清单：WebUI 骨架与注入点设计体系

状态：研究门禁已通过，计划已确认（2026-08-24 用户确认，含决策 1–6 推荐项），实施完成；全量门禁证据见下方「实施证据」。下列任务 ID 已完成；证据与验证命令逐项记录。

## 实施证据（T1–T9 完成摘要）

| 任务 | 状态 | 要点证据 |
| --- | --- | --- |
| SKEL-062-001 契约层 | 已完成 | `internal/webui/contract.go`：Binding zone 字段（HeaderActions/SidebarPanels/PageHeaderItems/WorkspaceTabActions/FooterStatusItems）、`ActionPermissions`、`validateZoneContribution`（唯一性/entry owner/图标目录/kind/order/数量上限）、`validateBindings` 导航图标目录校验；`internal/webui/icons.go` 图标目录 authority；`internal/webui/icons_test.go` 前后端图标目录一致性守护。 |
| SKEL-062-002 Manifest 投影 | 已完成 | `Manifest.Zones` + `Manifest.ActionPermissions` 投影（access/availability 门禁、从严 action access、骨架布局序稳定排序）；`projectImplementedRoutes` 保留 zone entry；测试覆盖 denied/unavailable/auth-required/排序/从严语义。 |
| SKEL-062-003 生成器 | 已完成 | `internal/composition/webui_registry.go` 输出 `webuiZoneRegistry`（zone → 贡献 ID → lazy import），`validateWebUILocaleCoverage` 扩展到 zone 标题；`TestGenerateWebUIRegistryIncludesZoneContributions` 守护。 |
| SKEL-062-004 SDK 与交互原语 | 已完成 | 新增 `@webui/sdk/zone`（useZoneContributions/useActionAccess/ZoneSlot/ZoneRendererContext/ZoneComponentProps）；`@webui/sdk/ui` 增加 `ActionTrigger`/`BulkActionBar`/`FormSubmitActions`，`PageHeader` zone 化；`useOptionalHostRuntime`；Vitest `zone.test.tsx`/`action.test.tsx`（14 项新增）。 |
| SKEL-062-005 图标目录 | 已完成 | Go 校验集合 + 前端 `webui/src/icon-catalog.ts`（Lucide 映射 + IconID 联合类型）；`MenuIcon` 单轨迁移；`--menu-indent-base/--menu-indent-step` token 化（`styles.css` + `SidebarMenu.tsx`）。 |
| SKEL-062-006 宿主骨架分区 | 已完成 | `webui/src/zone/{registry.ts,ZoneRenderer.tsx,ZoneItems.tsx}` 宿主渲染层；AppHeader/AppSidebar/WorkspaceTabs/Footer/PageHeader 分区槽；`ZoneRendererProvider` 装入 App；`bulk-action-bar`/`form-actions`/`sidebar-zones`/`data-action-state` 样式。 |
| SKEL-062-007 真实用例 | 已完成 | Ops 声明 header-actions（能力清单快捷入口 HeaderAction.tsx + ActionTrigger + navigate）与 footer-status（Management 数据源状态 FooterStatus.tsx + 重试）、`ActionPermissions{ops.diagnostics}`、SDK zone 依赖；CapabilitiesPage 页头刷新迁移到 `ActionTrigger`；双语 locale 补齐。 |
| SKEL-062-008 文档 | 已完成 | `docs/development/webui.md` 新增「骨架分区注入点（zone）与交互规范」节；`application-module-development.md` binding 清单与接入要点更新；本变更记录与条目更新。 |
| SKEL-062-009 全量验收 | 已完成 | 下方验证矩阵全绿；Playwright 11/11（dev + mock）通过；zone 视觉截图 `webui/test-results/zone-injection-mock.png`。 |

## 验证矩阵（T9）

| 检查 | 结果 |
| --- | --- |
| `go build ./...` / `go vet ./...` / `go test ./...` | 通过（含新增 contract/icons/generator 测试） |
| `pnpm generate:check` | 通过 |
| `pnpm lint`（eslint + i18n + architecture） | 通过 |
| `pnpm lint:modules` / `pnpm typecheck` | 通过 |
| `pnpm test`（Vitest） | 79/79 通过（新增 14 项 zone/交互原语测试） |
| `pnpm build` | 通过；zone 组件独立 async chunk（HeaderAction 0.37 kB、FooterStatus 1.03 kB），不进初始 Shell bundle |
| `pnpm e2e -- --workers=1`（dev + mock） | 11/11 通过；mock 用例覆盖顶栏快捷入口与底部状态注入点 |
| 视觉 | mock 桌面视口 zone 截图人工复核（`zone-injection-mock.png`）；dev 用例桌面/移动截图沿用 059 矩阵 |

## 剩余风险

- 交互状态链的最终视觉细节（尺寸/色值）以 Ops 真实用例与模块 owner 校准为准，契约语义不变。
- 图标目录首版覆盖真实使用与常用操作图标；扩大目录属于后续演进（机制与一致性守护已固化）。
- zone 不支持 degraded 部分能力（availability 非 available 即不投影），需要时按 route 语义扩展。

## 依赖顺序

```text
T1 契约层(Go) ─> T2 Manifest 投影(Go) ─> T3 生成器(Go/TS)
T5 图标目录(Go/TS) ─┐
                    ├─> T4 SDK zone + 交互原语(TS) ─> T6 宿主骨架分区(TS) ─> T7 真实用例(TS/Go) ─> T8 文档 ─> T9 全量验收
T1 ────────────────┘
```

## 确认范围

用户已确认当前计划（含 design.md 第 10 节决策 1–6 推荐项）：typed zone facets 模型、Manifest 投影动作权限、自研交互原语 + APG、受控图标目录、限定骨架进阶范围、既有模块真实用例。确认范围只覆盖 062；本变更完成不自动授权任何后续变更。

## 任务

### T1 契约层：Binding zone 字段与校验（Go）

- ID：`SKEL-062-001`
- 依赖：无（只改 `internal/webui/contract.go` + 测试）
- 内容：`Binding` 增加 `HeaderActions/SidebarPanels/PageHeaderItems/WorkspaceTabActions/FooterStatusItems`（typed facets，复用 Entry）；`validateBindings` 扩展：zone ID 全局唯一、Entry 属于本模块、TitleMessageID locale 覆盖、OperationID 属于应用 inventory、Order 合法、zone 数量上限；图标目录校验入口（配合 T5）。
- 完成条件：`go test ./internal/webui/...` 通过；新增反向 fixture（重复 zone ID、未知 entry、未知 operation、越界 order 均失败）；`go vet ./...` 通过。
- 对应 REQ：REQ-062-001/003/005/007

### T2 Manifest zones 投影（Go）

- ID：`SKEL-062-002`
- 依赖：T1
- 内容：`Manifest` 增加 `zones`；`ManifestForWithNavigation` 按 access（OperationID）/availability/implemented 门禁投影并按 (Zone,Order,ID) 稳定排序；`projectImplementedRoutes` 同轨过滤 zone；mock manifest 投影全可用 zones。
- 完成条件：access/availability/排序/快照测试通过；`denied`/未知 operation/不可用均不投影；mock manifest 与生成器一致；`go test ./...` 通过。
- 对应 REQ：REQ-062-002/003/008

### T3 生成器 zone registry（Go/TS）

- ID：`SKEL-062-003`
- 依赖：T1、T2
- 内容：`webui_registry.go` 输出 `webuiZoneRegistry`（zone 标识 → zone ID → lazy import），复用 SourcePath owner 校验；`generate:check` 快照覆盖新 registry。
- 完成条件：`pnpm generate:check` 通过；生成文件审阅确认 zone import 仍唯一来自生成器。
- 对应 REQ：REQ-062-002/007/009

### T4 SDK：zone capability 与交互状态链原语（TS）

- ID：`SKEL-062-004`
- 依赖：T2、T3
- 内容：新增 `@webui/sdk/zone`（v1：`ZoneID`、`ZoneContribution`、`useZoneContributions`、`ZoneSlot`、`useActionAccess`）；`@webui/sdk/ui` 增加 `ActionTrigger`（pending/disabled 原因/success/failure/防重复/ARIA）、`BulkActionBar`、`FormSubmitActions`，`PageHeader` 增强 zone 注入位；`@webui/sdk/runtime` 增加 `ManifestZone` 类型；`contracts` 增加 zone access 查询（投影来源，非客户端判定）。设计 token 增加 `--interaction-*` 与 `--menu-indent-*`。
- 完成条件：Vitest 覆盖状态链（idle/pending/disabled 原因/success/failure/防重复）、`useActionAccess`（denied 隐藏、authentication-required 禁用）、`BulkActionBar` 联动、`ZoneSlot` lazy 装载与错误态；`pnpm lint`/`typecheck`/`test` 通过。
- 对应 REQ：REQ-062-003/004/005/006/009

### T5 受控图标目录（Go/TS）

- ID：`SKEL-062-005`
- 依赖：T1
- 内容：集中 IconID 目录（Lucide 映射，覆盖既有真实使用 + 显式新增常用图标）；`MenuIcon` 单轨迁移为目录驱动；`internal/webui` 目录校验 + TS 联合类型双声明 + Go 测试守护一致性；删除硬编码 activity/user + fallback 路径。
- 完成条件：既有菜单图标渲染正确（全部真实 iconId 通过校验）；新增图标进目录才可用；反向 fixture（未知 iconId 失败）。
- 对应 REQ：REQ-062-005

### T6 宿主骨架分区与 zone 渲染（TS）

- ID：`SKEL-062-006`
- 依赖：T3、T4、T5
- 内容：`webui/src/zone/{registry,adapter}`；`AppHeader` 注入区（遵守工具优先级折叠）、`AppSidebar` 面板区（collapsed/mobile 语义）、`WorkspaceTabs` 操作区（roving 保持）、Footer 状态区（宿主项保留）、页面 `PageHeader` zone 位；`PageShell` 内容容器原语；token/样式落地（`styles.css` token 分区，业务 selector 不回流）。
- 完成条件：组件测试 + `pnpm lint:architecture`（zone 边界，宿主不 import 模块、模块不 import 宿主 internal）通过；视觉初校（默认视口）。
- 对应 REQ：REQ-062-001/002/006/009

### T7 真实用例与权限呈现（Go/TS）

- ID：`SKEL-062-007`
- 依赖：T4、T6
- 内容：选择一个既有模块（候选：Ops 顶部状态/能力入口，或 Navigation 页头动作）声明并校准首个 zone，作为真实示例与验收锚点；该模块页面内至少一组动作迁移到 `ActionTrigger`（含 operationId 权限钩子与成功/失败反馈链路）；其余模块只读兼容回归。
- 完成条件：模块 zone 在真实模式与 mock 模式均正确装载与授权呈现；E2E 覆盖该用例；页面视觉校准截图。
- 对应 REQ：REQ-062-006/007/008/010

### T8 文档与 authority 同步

- ID：`SKEL-062-008`
- 依赖：T4、T6、T7
- 内容：`docs/development/webui.md` 增加分区注入点、SDK zone、交互状态链与动作权限契约；`docs/development/application-module-development.md` 增加 WebUI 骨架接入四步示例；`webui/README.md` 同步；`documentation-impact.yaml` 更新；变更记录 README/状态更新；删除/更新失效描述（单轨演进，不留旧叙述）。
- 完成条件：文档与实现一致（能力在代码中真实存在）；文档链接门禁通过。
- 对应 REQ：REQ-062-007/010

### T9 全量验收与证据收口

- ID：`SKEL-062-009`
- 依赖：T1–T8
- 内容：Go（`go test ./...`、`go vet ./...`）、WebUI（`generate:check`/`lint`/`lint:modules`/`typecheck`/`test`/`build`）、`pnpm e2e -- --workers=1`（zone 装载/权限呈现/交互状态链/mock/既有回归）、视觉矩阵（桌面/移动/深浅色）人工复核、chunk graph 与冷浏览器 network 确认 zone 懒加载；`docs/changes/readme` 062 记录更新；未执行项如实标注。
- 完成条件：全部门禁绿且证据记录于本文件；无未完成项或剩余风险已明示。
- 对应 REQ：REQ-062-010

## 验证矩阵（T9 汇总）

| 检查 | 命令/方式 | 覆盖 |
| --- | --- | --- |
| Go 契约与投影 | `go test ./...`、`go vet ./...` | T1/T2/T5 |
| 生成快照 | `pnpm generate:check` | T3 |
| 静态质量 | `pnpm lint`、`pnpm lint:modules`、`pnpm typecheck`、`pnpm lint:architecture` | T4/T5/T6 |
| 单元/组件 | `pnpm test` | T4/T6 |
| 构建 | `pnpm build` | T6/T7 |
| E2E | `pnpm e2e -- --workers=1` | T7/T9 |
| 视觉 | 固定视口截图人工复核（1440×1000/1024×768/390×844，light/dark） | T6/T7/T9 |
| 性能 | chunk graph 审阅 + 冷浏览器 network | T6/T9 |

## 剩余风险

- 交互状态链视觉细节依赖真实页面校准，若出现与模块既有视觉冲突，由模块 owner 在校准轮内调整（不改变契约语义）。
- zone 呈现（顶栏折叠/侧边栏 collapsed 面板）在极端视口的细节可能超出初校，作为 T9 视觉验收项处理。
- 图标目录扩大属于后续演进（T5 只固化机制与首版目录）。
- 用户确认计划后，若实施中发现需求、公共接口或模块边界实质变化，返回研究阶段并重新确认。