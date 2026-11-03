# 061 WebUI 多环境数据源兼容（含全 WebUI mock）设计

引用研究：[R061-001](research/R061-001-ops-management-reachability/report.md)、[R061-002](research/R061-002-whole-webui-mock-design/report.md)。

## 1. 总体模型

```text
WebUI 显式声明数据源环境（VITE_WEBUI_DATA_SOURCE，默认 server-hosted）
  server-hosted（默认）| separated | mock

真实模式（默认/separated）：传输层照常 fetch，浏览器视角统一为 /management/*
  模式 A（hosting.enabled=false）：Vite 代理去前缀 -> management listener 9090 根路径（现状，不回归）
  模式 B（hosting.enabled=true ）：业务 listener 8080 受保护 facade（本任务新增）
      -> 复用 generation.opsModule.ManagementHTTP；未知子路径 -> chi NotFound -> JSON 404（不回退 SPA）
  Ops 数据层：六查询 + 可达性探测（connected 正常 / unreachable 显示"数据源不可达"横幅，值 "—"、零伪造）

mock 模式（显式声明 VITE_WEBUI_DATA_SOURCE=mock）：宿主 SDK 传输层切换本地 mock router，零真实请求
  宿主 mock（manifest/session/logout）  -> webui/src/mock/（宿主管辖）
  模块 mock（IAM/Org/Navigation/Ops）    -> 各模块 binding/webui/web/mock.ts（模块自有路由表）
  mock manifest                          -> Go catalog 投影生成 webuiMockManifest（catalogRevision == webuiRevision）
  全局"模拟环境 / Mock environment"徽标  -> AppShell（host locale 双语，i18n 门禁）
```

## 2. 服务端：模式 B management facade

### 2.1 路径清单单一来源

- `internal/module/ops/binding/http/handler.go` 导出稳定路径清单：

  ```go
  func ManagementRoutePaths() []string { return []string{"/startupz", "/livez", "/readyz", "/build", "/diagnostics", "/metrics"} }
  ```

  `New` 内注册循环改为消费同一份清单；`handler_test.go` 增加“清单与注册一致性”断言。

### 2.2 facade 组成与挂载

- `internal/composition/generation.go`：托管启用（`hosting.Enabled`）时构造 `managementFacade := generation.opsModule.ManagementHTTP`（已是 `middleware.Management` 包裹后的最终 handler）。
- `internal/composition/service.go` 的 `applicationRouter` 增加可选参数 `managementFacade http.Handler`（nil 不挂载）；非 nil 时在 `Mount("/", rootHandler)` 前逐子路径注册 GET handler（`httpbinding.ManagementRoutePaths()`，`request.URL.Path` 改写为子路径后委托 facade）。
- 外层基础设施中间件链对 facade 生效；AcceptJSON 不作用于 facade；未知 `/management/*` → chi NotFound → JSON Problem 404；非 GET → JSON 405。
- 模式 A 不传 facade，`/management/*` 与现状一致（JSON 404；Vite 代理在浏览器侧继续去前缀到 9090）。

### 2.3 安全语义与测试

- facade 复用 `protect`（Authenticate + Authorize）：probes/build 公开；diagnostics/metrics 会话或 Bearer + `management:read`（`metricsAccess: protected` 时 metrics 同保护）。
- 测试翻转：`generation_test.go` 原“托管模式 `/management/metrics`=404”→ facade 行为（`/management/readyz` 200 JSON、`/management/nope` 404 非 HTML、POST 405）；`service_test.go` 增加“传 facade/不传 facade”两组断言（200/404 JSON）。

## 3. 环境声明（显式配置）

### 3.1 声明承载与校验

- `VITE_WEBUI_DATA_SOURCE`：`server-hosted`（默认）/ `separated` / `mock`。
- `webui/.env.example` 增加该键与三值注释（默认、覆盖方式、部署一致性：托管产物按默认或 server-hosted 构建；mock 仅用于无后端预览/演示）。
- `webui/scripts/project-layout.mjs` 的 `loadWebUIDevConfig` 增加 `dataSource`：枚举校验（非法 `fail()`），默认 `server-hosted`；Vite/Playwright 共用。
- `webui/src/vite-env.d.ts` 扩展 `ImportMetaEnv` 类型化该键。
- `webui/scripts/build-webui.mjs`（决策 4 采纳后）：检测 `VITE_WEBUI_DATA_SOURCE=mock` 时拒绝执行并提示（演示构建用普通 `pnpm build` + `.env.local`）。

### 3.2 客户端读取（host SDK）

- `webui/src/contracts/index.tsx`：

  ```ts
  export type WebUIDataSource = "server-hosted" | "separated" | "mock";
  export function readWebUIDataSource(env: Record<string, string | undefined> = import.meta.env): WebUIDataSource {
    const declared = env.VITE_WEBUI_DATA_SOURCE;
    return declared === "server-hosted" || declared === "separated" || declared === "mock" ? declared : "server-hosted";
  }
  ```

  `@webui/sdk/runtime` re-export 类型与函数。

## 4. 全 WebUI mock 架构

### 4.1 宿主 mock 传输层（单一拦截点）

- `internal/module/*/binding/webui/web/api.ts` 与宿主 `webui/src/api.ts` 均经 `contracts.requestJSON/requestText`。在这两个函数入口检查 `readWebUIDataSource() === "mock"`，是则交给 `webui/src/mock` 的 mock router，否则原样 `fetch`：

  ```ts
  export async function requestJSON<T>(input, init = {}) {
    const path = typeof input === "string" ? input : String(input);
    if (readWebUIDataSource() === "mock") {
      return (await mockTransport.requestJSON(path, init)) as T;
    }
    // 现有 fetch 逻辑保持不动
  }
  ```

- `webui/src/mock/router.ts`（宿主内部）：按 `method + path` 匹配注册表（支持精确路径与带参数/前缀模式），未命中返回与真实语义一致的 404 错误（`requestJSON` 抛 `route_not_found`，与真实 4xx 行为同构）；`requestText` 同样支持（Ops metrics 文本）。

### 4.2 模块 mock 贡献与生成 registry（单一来源）

- **契约扩展**（`internal/webui/contract.go`）：`Binding` 增加 `MockSource string`（模块 WebUI 相对路径，如 `mock.ts`）；校验规则：**声明 Entry 的模块必须声明 `MockSource`**（与 Locale 规则对齐，保证全量 mock 完整）；`bindingSourcePaths`/`ValidateSourcePathOwnership`/`validSourcePath(".ts")` 扩展；`cloneBindings` 无需新增（string 字段）。
- **SDK 能力**：新增 `@webui/sdk/mock`（major 1），导出：

  ```ts
  export type WebUIMockRequest = { method: string; path: string; body?: unknown };
  export type WebUIMockRoute = {
    method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE" | "HEAD";
    pattern: string;                       // 精确路径或带 {param}/前缀匹配
    handler: (request: WebUIMockRequest) => unknown | Promise<unknown>;
  };
  ```

  模块 Binding `Requires` 声明 `{ID: "mock", MajorVersion: 1}`；`SDKInventory` 增加 `mock: 1`；vite alias、`lint-architecture` SDK 清单同步。
- **模块 mock 文件**：每个声明 Entry 的模块新增 `binding/webui/web/mock.ts`，导出 `webuiMockRoutes: ReadonlyArray<WebUIMockRoute>`，fixture 复用模块自有 `api.ts` 类型（示例：IAM 返回账号/角色/权限 fixture、登录/设置返回 mock session；Org 返回部门树/岗位/分配；Navigation 返回菜单与 catalog/navigation revision；Ops 返回 build/probe/diagnostics/metrics fixture）。
- **生成器**（`internal/composition/webui_registry.go`）：
  - 从 catalog 渲染 `webuiMockRegistry = { "<moduleId>": () => import(".../mock") }`（复用 entries 的 source path 校验与 relativeImport）；
  - 从 catalog 投影渲染 `webuiMockManifest`：`catalog.ManifestForWithNavigation(BuildNavigationPolicySnapshot(catalog), accessAllAllowed, availabilityAllAvailable)`（等价真实 runtime 的“全部可用”视图），输出到生成的 `webuiMockManifest` 常量（routes/menu/navigationRevision 固定字符串），`catalogRevision` 天然等于 `webuiRevision`；
  - 生成文件仍为 `webui/src/generated/webui-registry.ts` 一并输出（或追加 `webui-mock-manifest.ts`，按渲染整洁度选择，`generate --check` 稳定性测试覆盖）。

### 4.3 宿主 mock（骨架数据）

- `webui/src/mock/host.ts`（宿主管辖）：`/api/v1/webui/manifest` → `webuiMockManifest`；`/api/v1/iam/session` → 固定管理员身份（全部权限、固定 CSRF、会话时间字段静态值）；`/api/v1/iam/logout` → 204。
- 客户端状态闭环：登录/设置提交（模块 mock）返回 mock session → `completeAuthentication` 流程复用现有代码；登出 204 后 `handleLogout` 刷新 manifest（仍是 mock）并回到默认页——mock 循环内可正常使用，全部由全局徽标标识。

### 4.4 全局模拟标识（i18n 双语）

- `webui/src/components/shell/` 增加 `MockBadge`（宿主 shell 组件）：`readWebUIDataSource() === "mock"` 时在 AppHeader 渲染徽标（含 tooltip 说明），host locale 新增双语键：
  - `webui.host.mock.badge`：zh “模拟环境” / en “Mock environment”；
  - `webui.host.mock.title`、`webui.host.mock.detail`：zh “当前 WebUI 运行在模拟环境，所有数据均为本地示例，不代表真实服务状态。” / en 等价。
- 同时 `App.tsx` 装配失败/异常路径不必特判；mock boot 正常即可。

### 4.5 Ops 数据层（真实模式分级，mock 直接走 4.1 传输层）

- `internal/module/ops/binding/webui/web/environment.ts`：`resolveManagementSource()` = 声明 mock → **不调用**（传输层已被 mock router 接管，无需探测）；声明真实 → `loadReadiness()` 探测 → `"connected" | "unreachable"`。
- Dashboard/Capabilities：`unreachable` 显示 `webui.ops.dashboard.source.unreachable.*` 横幅（双语）+ 卡片降级（值 `—`、保留重试）；`mock` 模式下 ops 查询收到 fixture 数据正常渲染，mock 标识由全局徽标承担（页面不再显示“数据源不可达”，避免双重标签）。

### 4.6 测试

- Go：Binding `MockSource` 校验（Entry⇒必需、路径归属、扩展名）；`webuiMockRegistry` 与 `webuiMockManifest` 生成稳定性（`generate --check`、manifest `catalogRevision==Revision`、全路由 allowed/available）；facade 路由测试（§2.3）。
- WebUI Vitest：`readWebUIDataSource`（默认/覆盖/非法回退）；mock router 调度（方法+路径匹配、参数路径、未命中 404 语义）；模块 mock 与自身类型形状一致；mock manifest revision 一致；MockBadge 双语渲染；Ops unreachable 渲染；i18n 键门禁。
- Playwright：新增 mock project（`VITE_WEBUI_DATA_SOURCE=mock` 的 Vite dev 或静态服务，**不启动 Go 后端**）跑 boot/导航/徽标/双语；模式 B 托管 project 检查 Ops 真实数据；本机受限时记录 CI/后续项。

## 5. 文件影响

| 范围 | 文件 |
| --- | --- |
| Ops binding/http | `internal/module/ops/binding/http/handler.go`（`ManagementRoutePaths()`）、`handler_test.go` |
| Composition | `internal/composition/{service,generation}.go`（facade）、`service_test.go`、`generation_test.go`、`webui_registry.go`（`webuiMockRegistry`/`webuiMockManifest` 渲染）、`blueprint.go`（SDKInventory `mock`）、`webui_registry_test.go` |
| WebUI 契约 | `internal/webui/contract.go`（`Binding.MockSource`、校验、source-paths、ownership）、`contract_test.go` |
| 模块 Binding | `internal/module/{iam,organization,navigation,ops}/binding/webui/binding.go`（`MockSource` + Requires mock） |
| WebUI 声明配置 | `webui/.env.example`、`webui/scripts/project-layout.mjs`（`dataSource`）、`project-layout.test.mjs`、`webui/vite-env.d.ts`、`webui/scripts/build-webui.mjs`（决策 4）、`webui/vite.config.ts`（SDK alias `mock`） |
| WebUI 宿主 | `webui/src/contracts/index.tsx`（mock 切换 + `readWebUIDataSource`）、`webui/src/sdk/runtime/index.tsx`（re-export）、`webui/src/mock/{router.ts,host.ts}`、`webui/src/components/shell/{MockBadge.tsx,AppHeader.tsx,…}`、`webui/src/i18n/locale/{zh-CN,en-US}.json`、`webui/src/generated/webui-registry.ts`（生成物）、`webui/playwright.config.ts`（mock project） |
| WebUI SDK | `webui/src/sdk/mock/index.ts`（新，类型）、lint-architecture SDK 清单 |
| 模块 mock | `internal/module/{iam,organization,navigation,ops}/binding/webui/web/mock.ts`（新）+ 各模块 test |
| Ops WebUI | `internal/module/ops/binding/webui/web/environment.ts`（新）、`DashboardPage.tsx`、`CapabilitiesPage.tsx`、`locale/{zh-CN,en-US}.json`、相关 test |
| 文档 | `docs/getting-started/webui.md`、`docs/development/webui.md`、`docs/operations/runtime-capabilities.md`、`docs/repository-scope.md`、`config.example.yaml`、根 `README.md`、`docs/changes/README.md`（061 索引）、本变更记录 |

## 6. 失败语义与原子性

- facade 构造失败 → generation abort，旧代不变；未知 `/management/*` 404 JSON；非 GET 405。
- 声明非法 → tooling `fail()`（dev/Playwright 启动前）；客户端回退默认 `server-hosted`；`webui build` 拒绝 mock（决策 4）。
- mock router 未命中 → 与真实 4xx 同构的错误语义（页面按既有失败/降级呈现）；mock 绝不泄漏真实网络请求；禁止在真实声明下进入 mock 路径（运行时断言 + 测试固定）。
- mock manifest 投影失败（catalog 校验错误）→ 生成器报错，`generate --check` 失败，不产出漂移文件。
- reload 切换 A/B：facade 随 generation 重建原子生效；环境声明是构建/开发期值，不随 reload 变化（文档写明：换环境需重新构建或设置 `.env.local` 后重启 dev）。

## 7. 验证方案

- Go：`go test ./... -count=1`、`go vet ./...`；契约/生成器/路由定向测试。
- WebUI：`pnpm generate:check`、`pnpm lint`、`pnpm lint:modules`、`pnpm lint:i18n`、`pnpm typecheck`、`pnpm test`；`project-layout.test.mjs` 枚举校验。
- 本机 E2E：模式 B 真实数据（登录 → 运行状态 available；`curl /management/readyz` 200、未知 404）；mock 模式（`VITE_WEBUI_DATA_SOURCE=mock` 静态/Vite 启动，无后端完成 boot+全页面导航+徽标双语）；模式 A 由 Go 套件（hosting disabled）回归。
- 文档：`Verify-Docs` 与表述残留搜索（`060/024` 遗留只在历史记录）。

## 8. 待确认决策（提交用户）

1. **模式 B 业务 listener 暴露受保护 management facade**（改动 024 `OPS-REQ-001` 适用范围，模式 A 保持不暴露）：推荐接受。
2. **全 WebUI mock 的模块归属采用“模块自有 mock 源 + 生成 registry + 新增 SDK 能力 `mock`”**（推荐）：符合 048 模块所有权与统一生成单一来源；代价是 Binding 契约与 SDK 面扩展。备选：宿主集中维护全部 mock（更快但违反模块数据所有权与跨模块边界），不推荐。
3. **mock manifest 由 Go catalog 投影生成**（推荐）：保证 `catalogRevision` 与 `webuiRevision` 一致、杜绝漂移；备选：手写 fixture（会因 catalog 变更失效）。
4. **未知 `/management/*` 保持 JSON Problem 404**：推荐采纳。
5. **托管构建脚本 `webui build` 拒绝 `mock` 声明**（普通 `pnpm build` + `.env.local` 供 mock 演示）：推荐采纳，防演示产物进入托管/发布链。