# 062 设计方案：WebUI 骨架与注入点设计体系

## 1. 设计原则

- **骨架定义结构与基调，注入点提供标准化接口**：骨架各分区是稳定容器，模块只通过类型化注入点向指定分区贡献内容，不修改骨架。
- **类型化窄契约，不建万能容器**：每类分区注入点都有独立结构和校验（对齐 053「不建立万能 module.Contribution」与 AGENTS 3.1）。
- **静态插拔单轨**：所有注入点走「Binding 声明 → 生成 lazy registry → Manifest 门禁 → 宿主懒加载」，不引入运行时插件、远程模块或第二套路由/授权（048/056/059 边界保持）。
- **权限投影控制呈现，授权仍在服务端**：动作级 access 由服务端判定后投影进 Manifest；前端只处理显示/禁用/加载，不自行判定授权。
- **交互契约先于视觉**：先稳定状态链（空闲/悬停/聚焦/激活/提交中/禁用/成功/失败）与 ARIA 语义，再校准像素；视觉沿用 059 token/动效/reduced-motion。
- **真实用例驱动**：至少一个模块实际声明并校准注入点与交互原语，其余只读兼容；不为虚构需求提前抽象。

## 2. 核心模型：Zone（骨架分区）与 Contribution（注入点）

### 2.1 Zone 集合

注入点按骨架分区枚举：

| Zone 标识 | 骨架分区 | 承载内容示例 | 渲染载体 |
| --- | --- | --- | --- |
| `header-actions` | 顶栏操作区 | 全局快捷入口、环境快捷操作 | `AppHeader` 右侧动作区 |
| `sidebar-panels` | 侧边栏辅助区 | 辅助信息面板、模块状态摘要 | `AppSidebar` 菜单下方面板区 |
| `page-header` | 页头区域 | 页头动作、状态摘要、额外信息 | 页面 `PageHeader` 容器 |
| `workspace-tabs` | 标签页栏操作区 | 页签级操作控件（刷新、关闭、模块自定义） | `WorkspaceTabs` 操作区 |
| `footer-status` | 底部状态栏 | 版本/revision/环境/模块状态项 | Footer 状态区 |
| `content`（既有） | 内容容器 | 独立页面 | Route + `ManifestPage`（本变更不重做） |

zone 标识是服务端与前端共享的稳定枚举（Go 常量 + TS 联合类型），禁止魔法字符串。

### 2.2 Binding 扩展（Go 契约）

`internal/webui.Binding` 在保持既有字段语义不变的前提下增加类型化 zone 字段；每类 zone 的贡献结构共享一个基底，再按分区细化：

```go
// ZoneContributionBase 是分区注入点公共基底（每类 zone 独立结构体组合它）。
type ZoneContributionBase struct {
    ID              string // 全局唯一，格式 <moduleID>.<name>
    EntryID         string // 渲染组件 entry（复用 Binding.Entries 声明）
    TitleMessageID  string // 标签/标题（i18n 强制契约）
    Order           int
    OperationID     string // 可选；动作级权限钩子引用
}

type HeaderAction struct      { ZoneContributionBase; IconID string }
type SidebarPanel struct      { ZoneContributionBase; IconID string }
type PageHeaderItem struct    { ZoneContributionBase; Kind PageHeaderItemKind }
type WorkspaceTabAction struct{ ZoneContributionBase; IconID string }
type FooterStatusItem struct  { ZoneContributionBase; Kind FooterStatusKind }
```

- 每个 zone 字段是**独立 slice**（`HeaderActions []HeaderAction` 等），不是 `map[string]any`，不做万能容器。
- Entry 复用现有 `Entries`（懒加载组件仍按 `Entry.SourcePath` 生成 import），zone 只引用 `EntryID`，不新增 source path 语义。
- `validateBindings` 扩展：zone ID 全局唯一、EntryID 属于本模块、TitleMessageID 在模块 locale namespace 中存在（与 route title 同一 coverage 校验）、`OperationID`（若声明）必须存在于应用 operation inventory（复用 `ValidateOperationReferences` 语义）、`Order` 与既有 navigation 同一取值范围、zone 数量上限（防误声明超大集合）。
- 图标：`HeaderAction/SidebarPanel/WorkspaceTabAction.IconID` 必须是宿主受控图标目录成员（见 §5.2）。

### 2.3 Manifest zones 投影

`Manifest` 增加 `zones`：

```go
type ManifestZone struct {
    ModuleID string `json:"moduleId"`
    Zone     string `json:"zone"`     // header-actions | sidebar-panels | page-header | workspace-tabs | footer-status
    ID       string `json:"id"`
    EntryID  string `json:"entryId"`
    TitleMessageID string `json:"titleMessageId"`
    IconID   string `json:"iconId,omitempty"`
    Order    int    `json:"order"`
    Access   Access `json:"access"`
    Availability AvailabilityState `json:"availability"`
    AvailableCapabilities []string `json:"availableCapabilities,omitempty"`
}
```

投影门禁（在 `ManifestForWithNavigation` 内同步扩展）：

1. 模块未启用 / zone 未实现 → 不投影（`projectImplementedRoutes` 语义同轨扩展到 zone：zone 必须引用 implemented entry）。
2. `OperationID` 非空时经 `accessLookup(OperationID)` 判定；`allowed` → 投影；`authentication-required` → 按主体登录态投影（沿用 route 语义）；`denied` → 不投影（fail closed）。
3. availability：沿用 `normalizeAvailability` 与 route `DegradedCapabilities` 语义；不可用 → 不投影。
4. 排序按 `(Zone, Order, ID)` 稳定。
5. mock manifest（`projectWebUIMockManifest`）同步投影全可用 zones（`AccessAllowed` + `AvailabilityAvailable`），保证 mock 与真实模式行为一致。

Manifest 仍然不包含文件系统路径或 SourcePath（安全视图不变）。

### 2.4 生成器与 registry

`internal/composition/webui_registry.go` 增加 `webuiZoneRegistry`：

```ts
export const webuiZoneRegistry = {
  "header-actions": {
    "iam.quick": () => import("../../../internal/module/iam/binding/webui/web/QuickEntry"),
  },
  "sidebar-panels": { /* ... */ },
  // ...
} as const;
```

- key = zone 标识 → 模块 zone ID → lazy import（复用现有 `relativeImport` 与 SourcePath owner 校验）。
- 生成者仍从同一 Catalog 投影；`generate:check` 快照门禁自动覆盖新 registry。
- 只允许生成文件出现模块 SourcePath import 的约束不变。

### 2.5 宿主分区渲染 adapter

宿主为每个 zone 提供唯一渲染入口（SDK zone 能力 + 分区组件），模块组件不直接在每个分区组件里 import：

```text
AppHeader  --------------------------------------------------+
AppSidebar  -----------------+                                |
WorkspaceTabs ---------------+   webui/src/zone/{registry,adapter}  模块 zone 组件
Footer ----------------------+        │ lazy import（由 host zone registry 提供）
页面 PageHeader（PageShell 原语）-----+        │ 只接收 SDK zone 契约 props
```

- `useZoneContributions(zone)`：从 manifest 过滤指定 zone 的已授权贡献（React hook，参与 i18n/manifest 刷新订阅）。
- `ZoneSlot`：给定 zone + zone ID 的渲染组件，内部从 `webuiZoneRegistry` lazy 装载并包 `Suspense`/`RouteErrorBoundary` 语义（复用 059 skeleton/error 语义，zone 级错误不拖垮 Shell）。
- zone 组件契约（SDK `@webui/sdk/zone` v1）：模块组件收到有限 typed props（如 `{ contribution, refreshManifest, navigate, translate }`），禁止访问宿主 internal；宿主通过 adapter 注入这些 props，不解释业务 DTO。

### 2.6 SDK capability

- 新增 `@webui/sdk/zone`（major 1）：`useZoneContributions`、`ZoneSlot`、`ZoneContribution` 类型、`ZoneID` 联合类型、`useActionAccess`。
- `@webui/sdk/ui` 扩展交互原语（见 §4）。
- `@webui/sdk/runtime` 增加 `Manifest.zones` 类型与 `useActionAccess` 实现依赖的 action access 查询（基于 manifest zones 投影，非客户端判定）。
- SDKInventory 增加 `zone: 1`；模块 `Requires` 按需声明（沿用主版本协商门禁）。

## 3. 权限钩子

- **概念边界**：`ViewOperationID`（route 查看权限）已有；本变更新增**动作级** `OperationID` 钩子，作用于 zone 贡献与页面内交互元素。
- **投影来源**：服务端把每个动作 contribution 的 `OperationID` 经既有 access 判定（IAM Core RBAC/Casbin evaluator 结果）投影为 `ManifestZone.Access`；前端 `useActionAccess(operationID)` 从 manifest zones 派生（不引入新请求、不暴露授权细节）。
- **呈现控制**：
  - `hidden`：`denied` 时不渲染触发点（如操作不可见的按钮）；
  - `disabled`：`authentication-required`/不可用/忙碌/表单未满足时禁用并附 `title`/`aria-disabled` 说明；
  - `loading`：pending 期间禁用并显示提交中状态。
- **授权不变式**：前端投影只改善 UX，构造请求仍由服务端 operation gate/Auth policy 决定（fail closed）；Manifest zone 不携带任何判定依据（不泄漏权限矩阵细节）。
- **实现在哪**：`ActionTrigger`（§4）内部消费 `useActionAccess` + 外部禁用条件；模块页面与 zone 组件通过同一原语获得一致权限/状态语义。

## 4. 交互状态链契约（SDK ui）

### 4.1 状态链

所有可交互元素（按钮、链接、菜单项、标签项、卡片、弹窗触发器）统一状态模型：

```text
idle ──hover/focus/active──> idle
idle ──(点击)──> pending ──成功──> success(feedback) ──> idle
                    └──失败──> failure(error → message ID) ──> idle
idle ──> disabled（permission/unavailable/busy/invalid，带原因）
```

- `pending`：防重复提交（提交期间禁用触发点）、`aria-busy="true"`、可访问提交中文案（如「提交中…」，message ID）。
- `success/failure`：反馈通过 `Toast`/`InlineAlert`（复用现有原语）统一呈现；失败文本必须走「error code → message ID → 当前语言」链路（i18n 强制契约），禁止页面拼接展示文本。
- `disabled`：按原因分类（`permission`/`unavailable`/`busy`/`invalid`），不同原因有稳定语义与 `title`/`aria-disabled`；禁用不是「不可点」，是有原因的呈现状态。

### 4.2 新原语（`@webui/sdk/ui`）

- `ActionTrigger`：统一按钮/链接/菜单项触发原语，props：`operationId?`（权限钩子）、`pending`、`pendingLabelID`、`disabledReason?`、`feedback`（success/failure message ID + tone）、`onAction` 返回 Promise（自动 pending 与防重复）。兼容现有 `Button` API（`Button` 保留，模块逐步迁移或直接使用 `ActionTrigger`；059 单轨原则：新页面使用 `ActionTrigger`，旧页面由各自 owner 在校准轮迁移，不强制一次性重写全部页面）。
- `BulkActionBar`：数据表选择联动后的批量操作条（选中 N 项 → 批量按钮 → `ConfirmDialog` → pending → 成功/部分失败反馈），与现有 `DataTable` 选择列 + `DataToolbar` 组合。
- `FormSubmitActions`：表单提交/重置统一（pending、invalid 提示、成功后重置策略）。表单状态仍由模块持有（React Hook Form 或受控 state 均可），本原语只规范行为与视觉契约，不强制切换表单库。
- `PageHeader` 增强：`actions`/`status` 区块支持 zone 融入（`PageHeaderItem` 渲染位），保持既有 props 兼容。
- token：新增 `--interaction-*` 状态 token（hover/active/pending/disabled/success/failure 语义色与动效），`data-action-state` 属性供样式单轨应用；reduced-motion 遵循 059 决策。
- ARIA：全部新原语对齐 WAI-ARIA APG（button/toolbar/dialog/menu 模式）；`aria-busy`/`aria-disabled`/焦点管理按既有 overlay 模型扩展。

### 4.3 交互元素全覆盖

| 交互元素 | 契约映射 |
| --- | --- |
| 列表批量按钮 | `BulkActionBar` + `DataTable` 选择列 |
| 详情编辑/删除/审核动作 | `ActionTrigger`（operationId 钩子 + ConfirmDialog + pending + 反馈） |
| 表单提交与重置 | `FormSubmitActions` |
| 标签页切换 | 既有 `WorkspaceTabs` roving keyboard（本变更只加操作区，不改切换行为） |
| 卡片入口 | `ActionTrigger`/链接触发原语（卡片自身保留 Surface 语义） |
| 弹窗触发器 | `ActionTrigger` 打开 `Drawer`/`ConfirmDialog`（既有 overlay 模型） |

## 5. 导航进阶

### 5.1 多级与激活（已有能力规范化）

- ≥3 级菜单渲染、祖先链高亮、自动展开沿用现有 `SidebarMenu`/`buildMenuTree`/`findMenuAncestors`，本变更不改递归语义。
- 层级缩进改为 token：`--menu-indent-step`（初始 `14px`），`paddingLeft: calc(var(--menu-indent-base) + level * var(--menu-indent-step))`；collapsed 态语义不变。
- 激活态链（当前项 + 祖先）样式 token 化，禁止魔法像素散落。

### 5.2 受控图标目录

- 宿主定义集中 IconID 目录（Lucide 映射，先覆盖既有真实使用的图标 + 目录中显式新增的常用图标），`iconId` 取值必须在该目录内。
- `MenuIcon` 单轨迁移为目录驱动（删除硬编码 `activity`/`user` + fallback）。
- 服务端校验：`validateBindings` 检查 zone/导航的 `IconID` 属于目录（目录以 Go 常量/校验集合形式存在于 `internal/webui`，前端目录与 SDK 类型由同一来源声明——首个版本以 Go 校验 + TS 联合类型双声明 + Go 测试守护一致性，后续可生成）。
- 超出目录的自定义图标组件（模块自有 icon entry）列为后续独立研究，不进入本轮。

## 6. 骨架进阶（分区与容器）

- **顶栏（AppHeader）**：右侧动作区增加 `header-actions` zone 槽位，遵守现有工具优先级折叠策略（低优先级进 popover/icon-only）。
- **侧边栏（AppSidebar）**：菜单下方增加 `sidebar-panels` 面板区；collapsed 显示图标 + tooltip，移动端沿用 drawer 语义。
- **页签栏（WorkspaceTabs）**：增加 `workspace-tabs` 操作区（refresh/close 等宿主操作与模块自定义操作共存），roving keyboard 语义保持。
- **底部状态栏（Footer）**：宿主 footer（brand/语言/年份）保留；新增 `footer-status` 状态区（revision/环境/模块状态项）。
- **页头容器（PageHeader）**：zone 化 `page-header` 注入位 + `PageHeaderItem` 渲染；`PageHeader` 成为页面标准页头容器。
- **内容容器**：提供 `PageShell` 布局原语（fluid/max 内容宽度、分栏与 Section grid、滚动区），页面按需使用 token，不引入 per-route 容器配置字段（避免过度抽象；如真实用例需要再研究）。
- **token 扩展**：`--shell-*` 布局、`--menu-indent-*`、`--interaction-*` 状态、zone 间距/层级全部集中在 `styles.css` token 分区；样式 authority 不变。

## 7. 轻量接入

新模块接入所有注入面的最小步骤（文档固化，示例进入模块开发指南）：

1. 模块 `binding/webui/binding.go`：在既有 Routes/Navigation/Locales/MockSource 之上按需声明 zone 字段（Entry 复用）；
2. `web/` facet：实现 zone 组件（SDK zone 契约）、locale 覆盖、mock 数据（如需）；
3. composition 唯一 module 列表加入模块注册；
4. 运行 `webui generate` → registry/manifest 自动更新；`generate:check` 守护。

宿主核心、SDK adapter、生成器源码在既有 capability 内不需要为本模块改动；只有引入全新 zone/交互能力（本轮已定型）或 SDK 主版本升级才是平台事件。

## 8. 文件影响

计划修改（实施时按确认的 task ID 逐个落地）：

- `internal/webui/contract.go`、`internal/webui/contract_test.go`：zone 字段、图标目录、动作权限/overlay 校验、Manifest zones 投影。
- `internal/composition/webui_registry.go`：zone registry 生成、mock manifest 投影。
- `webui/src/generated/webui-registry.ts`：生成产物（不手编）。
- `webui/src/contracts/index.tsx`：`ManifestZone`、`ZoneID`、action access 查询。
- `webui/src/sdk/zone/index.ts(x)`（新增）、`webui/src/sdk/{runtime,ui,feedback}/index.*`：SDK capability 扩展。
- `webui/src/ui/index.tsx`：`ActionTrigger`/`BulkActionBar`/`FormSubmitActions`/`PageHeader` 增强。
- `webui/src/zone/{registry.ts,adapter.tsx}`（新增）；`webui/src/components/shell/{AppHeader,AppSidebar,WorkspaceTabs,AccountMenu,SidebarMenu,ShellSkeleton}.tsx`、`webui/src/components/AppShell.tsx`：分区注入槽与渲染。
- `webui/src/styles.css`、`webui/src/motion.ts`、`webui/src/theme.ts`：状态/缩进/zone token。
- `webui/src/mock/{router.ts,host.ts}`：zone mock 装载。
- 模块侧：`internal/module/<id>/binding/webui/binding.go` 与 `web/`（至少一个真实用例校准；其余只读兼容）。
- 质量链：`webui/scripts/*`（若 lint:architecture 需覆盖 zone registry 边界）、反向 fixture、Vitest/E2E。
- 文档：`docs/development/webui.md`、`docs/development/application-module-development.md`、`webui/README.md`、`docs/changes/readme` 与 `documentation-impact.yaml`。

不计划修改：数据库、config schema、HTTP API 契约/OpenAPI、CLI、部署/Docker、IAM/Casbin 授权实现。

## 9. 失败与回退语义

- zone 投影 fail closed：access 判定失败、availability 未知、operation 引用无效 → 不投影/不渲染，不猜测为可访问。
- zone 组件运行/懒加载失败 → `RouteErrorBoundary` 语义的 zone 级错误态，不拖垮 Shell 与其他模块。
- 交互 pending 失败 → 恢复可点击并给出 error code → message ID 反馈；任何超时/错误不静默吞掉，不伪造成功。
- 动效/反馈不改变语义执行顺序（焦点/aria 在 entering 前建立，退出后释放——沿用 059 overlay 模型）。
- 迁移单轨：`MenuIcon` 与新交互原语启用后，旧硬编码路径删除，不留双实现；模块页面迁移由各 owner 校准轮完成，不一次重写全部页面。
- 兼容：既有 Binding 字段与 SDK capability 主版本语义不变；新 SDK capability `zone` 是新增 major 入口，旧模块无需 `Requires` 声明也能继续构建（不声明即不消费）。

## 10. 待确认决策

实施前由用户在计划报告后确认以下决策（均在推荐项）：

- **决策 1（必要）**：采用「分区注入点 = typed zone facets」模型（推荐）；备选：单一通用 Contribution 字段（违反 053 红线，不推荐）。
- **决策 2**：动作级权限以 Manifest `zones.Access` 投影实现呈现控制（推荐）；备选：前端客户端按 `principal.scopes` 自行判定（会把权限模型泄漏进浏览器并造假授权感，不推荐）。
- **决策 3**：交互状态链以自研原语（`ActionTrigger`/`BulkActionBar`/`FormSubmitActions`）+ APG 对齐实现（推荐）；备选：引入 Radix/Headless UI（059 边界冲突，不推荐）。
- **决策 4**：图标采用宿主受控 IconID 目录 + 服务端校验（推荐）；自定义图标 entry 后续独立研究。
- **决策 5**：骨架进阶范围 = 五类分区注入点 + 页头/批量条/内容容器/页签操作/底部状态容器原语（推荐，控制范围）；内容容器 per-route 配置、Tab 右键菜单、分组标题等暂缓（避免过度工程）。
- **决策 6**：真实用例由既有模块之一声明并校准首个 zone（推荐候选：Ops 顶部状态/能力入口 或 Navigation 页头动作）；不新建演示模块。

## 11. 验证设计

- Go：zone 契约校验（唯一性/entry owner/图标目录/operation 引用/locale 覆盖/数量上限）、Manifest 投影（access/availability/排序/快照）、mock 投影、反向 fixture（故意违规失败）。
- 生成：`generate:check` 含 zone registry 快照；registry 仍为唯一模块 import 汇合点（architecture lint 扩展后验证）。
- SDK/组件：Vitest 覆盖 `useZoneContributions`/`useActionAccess`/`ActionTrigger` 状态链（pending/disabled 原因/success/failure/防重复）、`BulkActionBar` 选择联动、`PageHeader` zone、菜单缩进 token 与图标目录。
- E2E：zone 装载、权限呈现（denied 不渲染/禁用）、交互状态链、mock 环境 zones、既有路由/菜单/语言回归；固定视口深浅色截图人工复核。
- 性能：审阅 production chunk graph，zone 贡献为独立 async chunk；冷浏览器 network 确认初始 Shell 不加载业务 zone。
- 文档/质量链：`pnpm generate:check`/`lint`/`typecheck`/`test`/`build`、`go test ./...`/`go vet ./...`；文档 authority 同步。