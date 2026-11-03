# 087 设计

支撑研究：[R087-001](research/R087-001-settings-workspace-conflict/report.md)；需求见
[requirements.md](requirements.md)。

## 决策

### `DEC-087-001` 恢复显式 WorkspaceTabPolicy

在 Go `Route/ManifestRoute` 与 TypeScript `ManifestRoute` 恢复 typed policy，默认
`disabled`；支持当前已有真实语义所需的 `singleton` 与 `contextual`。未声明 route
不能因为 layout=app、访问成功或出现于菜单就自动生成标签。

首批生产声明：OpenAPI workspace 保持 singleton；Settings、Accounts 和其他普通
列表/配置页保持 disabled。测试 fixture 可覆盖 contextual，但不伪造生产业务入口。

### `DEC-087-002` AppShell 双路分流但单一资格来源

```text
current route
  ├─ workspace policy enabled -> WorkspaceProvider/WorkspaceOutlet
  └─ default disabled          -> React Router Outlet
                                  └─ settings group layout + child Outlet
```

删除 `routeIsFormal => openWorkspace` 的自动资格推断；formal 只继续承担访问/可加载判断，
workspace eligibility 由 policy 唯一决定。普通 route 激活时 deactivate workspace，保留
已打开的真实工作台标签但不渲染其 panel。

### `DEC-087-003` Settings 恢复共享布局不变量

八个 Settings route 继续声明同一 `groupLayoutId=settings.layout`，但不声明 workspace
policy。`renderAppRoutes` 的 grouped route 树成为唯一活动渲染路径：`SettingsLayout`
常驻，SectionNav 使用 HostRuntime SPA navigate，child Outlet 切换。

现有 e2e 中“每个设置分区独立标签/面板”的注释和断言删除，恢复验证同一 SectionNav
DOM 标记跨分区保留、workspace tab 数不因八个分区增长。

### `DEC-087-004` Query 与 inactive 页面隔离

Accounts 仍使用 `useSearchParams` 同步筛选，但因其为普通 route，离开页面后组件卸载，
不会作为 inactive mounted panel继续观察全局 Router。返回 Accounts 时由 URL 决定筛选；
不额外复制 query 到宿主 store。

Workspace storage 只处理显式 opt-in route；恢复时按当前 policy reconcile。旧 Rev.2
快照中的普通 route descriptor 被丢弃，不读取业务响应或表单，不迁移为第二套状态。

### `DEC-087-005` 失败用例先行

确认实施后，先用可认证 dev fixture/现有 e2e state 建立：

1. Accounts URL 带 `query=xiaolin%40iqwq.com&archived=false`；
2. 导航到 `/settings/profile`；
3. 点击 settings 内容中性区域、控件、每个 SectionNav 项；
4. 断言 URL 始终属于预期 Settings 子路由，active workspace 不为 Accounts；
5. 断言切换无 document load，固定 SectionNav 节点保持，标签数不增长；
6. 显式进入 OpenAPI 时仍创建并恢复 singleton workspace。

如果第 3 步的“中性点击跳转”在确认环境无法复现，保留测试覆盖可证明的跨页面隔离，
报告环境差异，不添加未经证实的 overlay/click 修补。

## 文件影响

| 范围 | 计划文件 |
| --- | --- |
| Go contract/catalog | `internal/webui/contract.go`、catalog/manifest tests、OpenAPI binding |
| TS contract/runtime | `webui/src/contracts/index.tsx`、generated registry、workspace policy helpers |
| Router/workspace | `webui/src/components/AppShell.tsx`、`webui/src/routes.tsx`、`webui/src/workspace/*` |
| Settings | `internal/module/settings/binding/webui/binding.go`、`SettingsLayout.tsx`（仅必要的反应式/导航收敛） |
| Tests | workspace unit/component tests、`webui/e2e/webui.spec.ts`、mock e2e |
| Authority | `webui/README.md`、`docs/development/webui.md`、085/087 documentation impact 与索引 |

不计划修改 IAM service/API、数据库、migration、配置、依赖版本或外部系统。

## 失败语义与迁移

- manifest 中未知 policy：catalog validation 失败，不静默当作 enabled。
- 旧持久化条目对应 disabled route：reconcile 丢弃该标签元数据；不删除浏览器其他 key。
- workspace 上限：只统计显式 workspace；普通 route 不占 12 个名额。
- 当前普通 route 被激活：workspace panel 全部 inactive，普通 Outlet 显示当前页面。
- 实施发现用户必须保留“所有页面自动标签”：停止并回到研究，不并存自动和显式两套规则。

## 验证

- Go：相关 contract/catalog tests、`go test ./...`、`go vet ./...`。
- 生成：WebUI registry generate/check，确认 policy 单源投影。
- WebUI：typecheck、lint、Vitest、build。
- E2E：Accounts query → Settings 中性点击/八分区 SPA；固定 layout DOM；标签数；刷新；
  OpenAPI singleton；inactive workspace 不可交互。
- 文档：docs guard、完整 diff、旧 Rev.2 文案/符号检索。
