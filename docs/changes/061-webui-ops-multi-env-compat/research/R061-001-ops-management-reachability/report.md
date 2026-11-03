# R061-001 Ops 页面 management 数据通路与默认启动 4xx 根因

## 研究问题

默认启动（模式 B：`webui.hosting.enabled: true`，Go 服务托管 `webui/dist`）下，WebUI 的 Ops 页面（`运行状态` Dashboard 与 `能力清单` Capabilities）请求 `/management/*` 一直返回 4xx。需要回答：

1. 两种模式（A/B）的 management 数据通路分别是什么，谁在什么端口、什么路径提供服务；
2. 默认启动下 4xx 的直接原因与证据链；
3. WebUI 在没有真实 management 数据的环境（mock 或无后端静态预览）中的现有表现与缺口；
4. 修复可选的路径及其与既有安全/架构决策（024 OPS-REQ-001、060 REQ-060-007）的关系。

## 方法与范围

- 依据：`internal/module/ops/binding/webui/web/{api.ts,operations.ts,DashboardPage.tsx,CapabilitiesPage.tsx}`、`internal/module/ops/binding/http/handler.go`、`internal/module/ops/module.go`、`internal/composition/{service.go,generation.go,ops.go}`、`internal/webuihost/spa.go`、`webui/vite.config.ts`、`webui/.env.example`、`internal/composition/{generation_test.go,service_test.go}`、`webui/src/contracts/index.tsx`、`webui/src/sdk/query/index.ts`。
- 快照：HEAD `20a634c`（2026-08-22），工作区干净。
- 只读检查：未启动服务、未修改任何文件、未执行数据库或迁移操作；全部结论来自源码、测试与既有变更记录。

## 当前事实

### 1. Ops 页面硬编码 `/management/*` 同源请求

- `internal/module/ops/binding/webui/web/api.ts`：

  ```ts
  export const loadBuild = () => requestJSON<DiagnosticsValue>("/management/build");
  export const loadStartup = () => requestJSON<DiagnosticsValue>("/management/startupz");
  export const loadLiveness = () => requestJSON<DiagnosticsValue>("/management/livez");
  export const loadReadiness = () => requestJSON<DiagnosticsValue>("/management/readyz");
  export const loadDiagnostics = () => requestJSON<DiagnosticsValue>("/management/diagnostics");
  export const loadMetrics = () => requestText("/management/metrics");
  ```

  全部为相对路径、同源（`fetch` 走当前页面 origin，`credentials: include`）。`operations.ts` 把 build/startupz/livez/readyz 声明为 `required: true`，diagnostics/metrics 为 `required: false`；`DashboardPage` 对失败项显示 unavailable/degraded 与重试，`CapabilitiesPage` 相同数据流。

### 2. management 能力只挂在独立 management listener（9090）的根路径

- `internal/module/ops/binding/http/handler.go` 的 `New` 构造固定 ServeMux：`GET /startupz`、`/livez`、`/readyz`、`/build`、`/diagnostics`（protect）、`/metrics`（按 `metricsAccess` 为 public 或 protect）。
- `internal/module/ops/module.go`：`ManagementHTTP` 再包 `middleware.Management`（requestTimeout 2s、maxBody 4KB、maxInFlight 16），`Management` 是 `httpx.ServerConfig`（默认 `127.0.0.1:9090`）。
- `internal/composition/generation.go`：`generation.managementServer = httpx.NewServer(&generation.opsModule.Management, generation.opsModule.ManagementHTTP)`，独立 listener 绑定 9090；业务 listener（8080）由 `applicationRouter` 组成，**从未挂载 management 路由**。`docs/changes/024` 的 `OPS-REQ-001` 明确“业务 listener 不暴露这些入口”，`internal/composition/service.go` 的注释与 `config.example.yaml` 的 management 节注释延续该语义。

### 3. 模式 A 能工作：Vite 代理去前缀转发 9090

- `webui/vite.config.ts`：

  ```js
  proxy: {
    "/api/v1": dev.apiTarget,                                    // -> 8080
    "/management": { target: dev.managementTarget,               // -> 9090
                     rewrite: (path) => path.replace(/^\/management/, "") }
  }
  ```

- `webui/.env.example`：`WEBUI_MANAGEMENT_TARGET=http://127.0.0.1:9090`。
- 浏览器向 `https://127.0.0.1:5173/management/readyz` 请求时由 Vite 转发到 `http://127.0.0.1:9090/readyz`，命中 management listener 根路径 handler。因此模式 A 下 Ops 页面可以拿到真实数据（前提是已登录；diagnostics/metrics 需要会话与 scope）。

### 4. 模式 B 直接 404：业务 listener 没有 `/management` 路由

- `internal/composition/service.go` 的 `hostedRootHandler` 只区分 `/api` 前缀与其余路径；其余路径交给 `staticHandler`。
- `internal/webuihost/spa.go` 的 `newSPAHandler` 把 `apiPrefix` 与 `managementHTTPPrefix`（`/management`）列为 excluded prefixes：命中即 `httpx.WriteProblem(404, "route_not_found")`，绝不回退 HTML。
- 综合结果：模式 B 下浏览器同源请求 `/management/readyz` 等全部返回 `404 route_not_found`（JSON Problem）；`运行状态` 页四个必需探针全部失败 → 页面整体 unavailable，表现为“一直 4** 响应状态码”。
- 060 的实施证据（`docs/changes/060-webui-hosting-modes/tasks.md`，E2E-060-001）甚至把 `managementStatus=404 managementJson=True` 作为模式 B 的期望验收断言——该断言证明了“不回退 SPA”的语义，但没有发现 Ops 页面正是 `/management/*` 的真实消费者，功能缺口由此固化。

### 5. 无真实数据环境的现有表现

- 模式 B 修复前：单能力失败显示 unavailable/degraded + `请求失败` 文案，`snapshot.missing` 以 `—` 显示；但错误成因无法区分“真实接口失败”与“数据源根本不存在/未连接”，也没有面向“mock/离线环境”的明确说明。
- 完全无后端（例如静态打开 `webui/dist` 或仅有静态托管）时，`App.tsx` 的 manifest 加载先失败，宿主停在装配错误页；Ops 页面本身只有进入宿主后才能触达。完整的“脱离后端预览 webui”需要 manifest 级别 mock，属本任务范围外（见非目标）。
- 仓库既有红线：`docs/changes/042` REQ-012 与 047 设计明确“Ops 页面使用真实 management 数据，不使用模拟系统数据”“不得用 mock 冒充成功”；`webui.ops.dashboard.description`（zh-CN）也写明“数据来自现有 management build、probe、diagnostics 和 metrics，不使用模拟系统数据”。

### 6. 相关既有行为

- chi Router（`pkg/httpx/router.go`）的 `NotFound` 走 `DefaultErrorHandler` → JSON Problem `route_not_found`；因此“在路由树上对 /management 已知子路径注册 GET handler、未知子路径落入 chi NotFound”可以精确保持既有 JSON 404 语义（REQ-060-007）。
- `generation_test.go`（`TestGenerationHostingModeServesWebUIAssets`）当前断言托管模式下 `/management/metrics` 返回 404；`service_test.go` 断言 `/management/readyz` 404 JSON。二者施实方案转化后需要同步翻转/扩展。
- management 保护：`handler.go` 的 `protect` = `Access.Authenticate`（Session 或 Bearer）+ `Access.Authorize`（`management:read` scope 的 diagnostics/metrics）；probes 与 build 公开。Ops 页面在 mode B 同源携带 Session Cookie 即可通过 ManagementMiddleware（`auth.Module.ManagementMiddleware` 先试 SessionSource）。

## 推断

1. **根因**：默认启动（模式 B）下业务 listener 不提供 `/management/*` 数据通路，而 Ops 页面按“同源 `/management/*`”这一唯一浏览器约定取数；该约定只在模式 A 经 Vite 代理成立。两种模式对浏览器的 `/management/*` 语义从未统一，mode B 的 SPA 排除逻辑把它变成稳定 404。
2. 最小且与既有架构一致的修复是：**模式 B 时在业务 listener 挂载受保护的 management facade**（已知子路径 GET handler → 复用 `generation.opsModule.ManagementHTTP`；未知子路径保留 JSON 404）。它复用同一 handler 与同一 Authenticate/Authorize/metricsAccess 语义，不新增公开业务 API 契约（不违背 033“management 不作为公开 API”的立意），只把既有 management 面在模式 B 下以同源入口呈现给托管 webui。模式 A 保持现状（业务 listener 不暴露，Vite 代理 9090），浏览器视角两种模式统一为 `/management/*`。
3. 该修复改变 024 `OPS-REQ-001`“业务 listener 不暴露这些入口”的适用范围（模式 A 仍不暴露；模式 B 暴露同一受保护集合），属于安全语义范围变化，必须提交用户确认。
4. WebUI 数据层需要显式“数据源分级”：真实接口可达（connected）→ 现有行为；不可达/4xx/网络错误（unreachable，即 mock/离线环境）→ 清晰的“数据源不可达”降级状态，保留真实失败语义，不伪造数字。这与仓库“不使用模拟系统数据”红线一致。
5. 未知 `/management/*` 子路径是否保持 JSON Problem 404：通过“显式注册已知子路径 + chi NotFound 兜底”可以零成本保持，推荐采纳。

## 适用与不适用场景

- 适用：当前仓库（单一 webui 根、同源相对 API 路径、独立 management listener、Ops 页面为 `/management` 唯一浏览器消费者、模式 B 默认启用）。
- 不适用：多前端根、子路径部署（base 非 `/`）、需要把 management 折叠进公开 API 契约、需要 mock 数据伪装真实状态、容器 runtime/远端 CI 浏览器验收。

## 局限与剩余未知

- 未执行真实启动复现（启动服务属状态变更，按门禁留在实施验证阶段）；根因结论来自路由组成源码、SPA 排除实现与 060 E2E 断言，证据充分但浏览器侧截图未采集。
- `middleware.Management` 的 `maxInFlight: 16` 在 facade 与 9090 之间共享同一通道，业务 listener 高并发下可能更早触发 503“management overloaded”——属于可接受的既有预算语义，实施时用测试固定。
- 模式 B facade 暴露后，公网部署会把 probes/build 暴露在业务 listener；与 management listener 相同的公开集合，但网络面扩大，安全评估依赖用户确认（决策 1）。

## 修订补充（2026-08-22）

计划提交后用户补充要求：**多环境兼容需要 WebUI 显式声明配置，声明使用哪种环境，默认服务托管构建产物环境**。据此：

- 前端方案从“运行时自动探测驱动呈现”修订为“**显式声明为主 + 运行时探测为辅**”：新增受控配置 `VITE_WEBUI_DATA_SOURCE`（`server-hosted` 默认 / `separated` / `mock`），经 052 typed 解析器校验（非法值 tooling 启动前失败），host SDK `readWebUIDataSource()` 导出，客户端非法值回退默认；
- 声明 `mock` 时 Ops 数据层短接（不发起真实查询）并明确标记“模拟环境：无真实数据响应”；声明真实时执行查询并叠加可达性探测分级（connected / unreachable）；
- 默认 `server-hosted` 与默认托管模式（060：`webui.hosting.enabled: true`）一一对应；托管构建脚本 `webui build` 拒绝 `mock` 声明（决策 4，待确认）。

上述内容已合并进 061 `requirements.md`/`design.md`/`tasks.md`；本记录的事实与根因结论不变。

## 对当前任务的影响

- 服务端：`internal/module/ops/binding/http` 导出 management 子路径清单（单一来源），`internal/composition/{service.go,generation.go}` 在模式 B 下按清单注册 facade；翻转/扩展 `generation_test.go` 与 `service_test.go` 的 404 断言。
- 前端：Ops binding 增加数据源探测与“不可达”降级呈现（i18n zh/en），仅降级不伪造。
- 文档：`webui.md`、`docs/development/webui.md`、`docs/operations/runtime-capabilities.md`、`docs/repository-scope.md`、`config.example.yaml`、根 README 同步；`060` 中“业务 listener 不挂载 management / managementStatus=404”表述标注为被 061 替换的语义。
- 界面契约：浏览器视角两种模式统一为 `/management/*`；模式 A 保持代理到 9090，模式 B 同源直读 facade。