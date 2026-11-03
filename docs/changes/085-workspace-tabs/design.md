# 085 设计方案：页面标签栏（Rev.2：自动页面标签）

引用研究：[R085-001](research/R085-001-current-workspace-tab-boundary/report.md)；需求见 [requirements.md](requirements.md)。

> 实施状态：Rev.2 已按用户指令落地并全部验证；实现细节以代码为准，变更记录与逐任务证据见 [tasks.md](tasks.md)。关键收敛：标签资格改为宿主对正式路由自动判定（`routeIsFormal`），Go/TS 契约移除 `WorkspaceTabPolicy`；Dashboard（default route）以 `fixedHome` 固定首页标签；动态详情以 `deriveContextKey` 按实体独立；恢复全部用 `hydrate` 并入；普通 Router Outlet 仅作 fallback，页面真实内容由 mounted panel 承载。

## 1. 总体边界

```text
module Route declaration
  └─ WorkspaceTabPolicy (default disabled)
       ↓ catalog validation / manifest projection
AppShell
  ├─ normal route outlet (不生成 tab)
  └─ WorkspaceProvider
       ├─ WorkspaceRegistry (typed state + cap + persistence)
       ├─ WorkspaceTabs (presentation + keyboard + menus)
       └─ WorkspaceOutlet (mounted panels + active/inert)
             ↕ @webui/sdk/runtime lifecycle
          workspace page (dirty / beforeClose / active)
```

菜单仍只负责导航；route policy 决定是否能成为 workspace。模块拥有业务工作状态，宿主只拥有标签元数据和生命周期，不读取表单字段。

## 2. 构建期与 manifest 契约

在 `internal/webui` 增加专用类型，避免 bool 或任意字符串：

```go
type WorkspaceTabMode string

const (
    WorkspaceTabDisabled   WorkspaceTabMode = "disabled"
    WorkspaceTabSingleton  WorkspaceTabMode = "singleton"
    WorkspaceTabContextual WorkspaceTabMode = "contextual"
)

type WorkspaceTabPolicy struct {
    Mode       WorkspaceTabMode
    Restorable bool
}
```

`Route.WorkspaceTab` 与 `ManifestRoute.WorkspaceTab` 使用该结构；零值归一化为 disabled。catalog validate 拒绝未知 mode，并要求 blank/default auth route 不能 opt-in。contextual 的实例 ID 不放在静态 manifest 中，由运行时打开动作提供。

TypeScript contract 镜像为 discriminated union：

```ts
type WorkspaceTabPolicy =
  | { mode: "disabled" }
  | { mode: "singleton"; restorable: boolean }
  | { mode: "contextual"; restorable: boolean };
```

首批只在 `internal/module/openapi/binding/webui/binding.go` 声明 singleton。生成链与 contract tests 必须证明未声明 route 输出 disabled/省略后仍按 disabled 处理。

## 3. Workspace identity 与状态机

```ts
type WorkspaceID = string; // 只由工厂创建，不接受页面拼接

type WorkspaceDescriptor = {
  id: WorkspaceID;
  routeID: string;
  contextID?: string;
  location: { pathname: string; search: string };
  pinned: boolean;
  dirty: boolean;
  active: boolean;
  openedAt: number;
};
```

- singleton ID = versioned hash/encoding of route ID；重复打开只激活。
- contextual ID = route ID + 模块提供的稳定 context ID；context ID 只用于相等性，不直接显示。
- 普通 `navigate(path)` 不创建 workspace；宿主识别到 singleton route 时打开/激活。contextual 必须经新增 `openWorkspace({ routeID, contextID, location, restoreKey? })`，缺参数返回 typed error。
- registry reducer 是唯一状态 owner，所有 pin/close/restore/activate/reconcile/persist 行为使用纯函数测试。
- pinned tabs 排在左侧；pin/unpin 保持其分组内相对顺序。active tab 可以是未固定标签；普通 route 激活时 tabs 保留但 `activeWorkspaceID` 为空。

## 4. mounted panel 与生命周期 SDK

当前单 `<Outlet />` 无法保留多个本地表单。实施时从 `App.tsx` 提取可按明确 `ManifestRoute + location` 渲染的 `ManifestRouteView`，由 `WorkspaceOutlet` 为每个打开 workspace 建立一个 panel。普通 route 仍走现有 Router outlet，不复制业务 route 声明。

inactive panel：

- 设置 `hidden` 与 `inert`，移出 tab sequence；active panel 使用 `role=tabpanel` 并关联 tab ID。
- 不卸载 React tree，因此本地输入和 dirty owner 保留。
- SDK 暴露 `useWorkspaceSession()`，只提供 `{ workspaceID, active, setDirty, requestClose }` 与注册 `beforeClose` 的 typed API；页面不得读取全 registry。
- `active=false` 是资源边界：采用 workspace 的模块必须暂停 polling/subscription/animation；普通一次性 query cache 不要求销毁。

如果实施验证发现 React Router group layout 无法在不复制路由树的情况下安全生成 mounted panels，停止 `ROUTER-085-001`，回到研究阶段，不用隐藏 DOM clone 或第二套路由器冒充完成。

## 5. 关闭、dirty 与恢复

关闭管线统一为：

```text
close intent
  → collect target IDs (respect pinned)
  → dirty/beforeClose checks
  → one controlled confirmation summary
  → commit registry removal
  → unmount panels
  → focus next/right, else left, else normal workspace entry
```

- `close others/right` 先计算目标，再一次确认；任一 handler 返回 deny/error 时不部分关闭，错误保留原因并显示低敏反馈。
- pinned 默认排除；用户显式单个关闭 pinned 时先要求 unpin，避免“固定但可随手关闭”语义冲突。
- `beforeunload` 只在存在 dirty workspace 时注册，使用浏览器标准提示；logout 走应用确认并在成功前保留状态。
- 最近关闭栈只记录已确认关闭的 descriptor 元数据。恢复重新过 manifest/access/policy/cap 校验；不恢复 dirty 和业务草稿。

## 6. 持久化 Adapter

新增宿主私有 `workspace-storage.ts`，不把 Web Storage 暴露给模块：

```ts
type PersistedWorkspaceStateV1 = {
  version: 1;
  principalID: string;
  tabs: PersistedWorkspaceTab[];
  activeID?: string;
  closed: PersistedWorkspaceTab[];
};
```

保存前执行 allowlist 投影：routeID、pinned、order、允许恢复的 pathname 与明确 allowlist search key、模块提供的低敏 restore key。标题、dirty、任意 query 和业务数据不进入 JSON。读取采用 parse + schema validation + manifest reconcile；异常、版本不支持、principal 不匹配均返回空状态。`setItem` 异常被捕获并只记录稳定错误码 `workspace_storage_write_failed`。

同源多窗口不合并内存状态；只在初始化读取一次，之后当前窗口 last-writer-wins。这个限制写入开发文档与测试。

## 7. 呈现与交互

- 容器高度使用 `--shell-tabs-height: 42px`（满足 40–44px），单行 flex，不 wrap。
- tab 为透明文本按钮，不使用 Surface/Card/shadow；active 用 2px bottom indicator 与文字色/字重，不使用整块填充。
- label 单行 `text-overflow: ellipsis`；设置可读最小/最大宽度。pinned 与 dirty 用图标/圆点加可访问名称，不只依赖颜色。
- close button 默认 `opacity:0/pointer-events:none`，在 hover、focus-within、active 显示；触屏通过 active 与上下文菜单可达。
- 可见轨支持横向滚动，但不展示第二行；尾部 overflow button 打开 RAC Menu，列出全部被遮挡标签、dirty/pinned 状态与管理动作。
- tab context menu 提供 pin/unpin、restore（全局动作）、close、close others、close right；禁用原因有可读说明。
- 采用 APG 手动激活：方向键只移动焦点，Space/Enter 激活；Home/End、Delete、Shift+F10 完整实现。

`workspace-tabs` zone 本轮不继续作为万能操作注入点：先检索真实贡献方；若为零则从 Go/TS contract 与生成链删除。未来 workspace 全局动作必须基于真实用例重新定义窄 zone。

## 8. 文件影响

| 范围 | 计划文件 |
| --- | --- |
| Go contract | `internal/webui/contract.go`、对应 contract/catalog tests、OpenAPI WebUI binding |
| TS contract/SDK | `webui/src/contracts/index.tsx`、`webui/src/sdk/runtime/index.tsx`、新增 `webui/src/workspace/*` |
| Router/Shell | `webui/src/App.tsx`、`webui/src/components/AppShell.tsx`、新增 `components/shell/WorkspaceTabs.tsx` |
| styles/i18n | `webui/src/styles.css`、host zh-CN/en-US locale、滚动注释与残留清理 |
| tests | registry/storage/component Vitest、AppShell tests、mock Playwright 与视觉截图 |
| authority | `webui/README.md`、`docs/development/webui.md`、`documentation-impact.yaml`、本变更记录与 `docs/changes/README.md` |

不计划修改后端业务 API、数据库、migration、权限键、配置文件或第三方依赖。若实现需要这些范围，退回研究并重新确认。

## 9. 验证

- Go：contract/catalog projection tests，`go test ./...`、`go vet ./...`。
- WebUI：`pnpm generate:check`、`pnpm typecheck`、`pnpm lint`、`pnpm test`、`pnpm build`。
- E2E：disabled route 不增 tab、singleton 去重、fixture contextual、多动作/上限/storage/access reconcile/dirty/focus/unload。
- Visual：1440×1000、1024×768、390×844，light/dark；检查 42px、indicator、hover/active close、不换行、overflow menu。
- 文档：`scripts/Verify-Docs.ps1`；实现完成后更新 authority，不能只留 change 记录。
