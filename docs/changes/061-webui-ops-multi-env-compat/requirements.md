# 061 WebUI 多环境数据源兼容（含全 WebUI mock）需求

引用研究：[R061-001](research/R061-001-ops-management-reachability/report.md)、[R061-002](research/R061-002-whole-webui-mock-design/report.md)。

## 1. 目标

修复默认启动（模式 B：Go 服务托管 WebUI）下 Ops `运行状态`/`能力清单` 页请求 `/management/*` 恒 4xx 的问题，并让 WebUI **显式声明**当前数据源环境（默认：服务托管构建产物），实现以下语义：

- **服务端真实接口响应**：模式 B（`server-hosted`，默认声明）同源直读业务 listener 上的受保护 management facade；模式 A（`separated`）经 Vite 代理读取——浏览器视角统一为 `/management/*`；
- **mock 无真实数据响应**：显式声明 `mock` 时，**整个 WebUI（宿主骨架 + 骨架数据 + 全部模块页面数据）**使用本地 mock 数据，可在无后端环境下完整运行，并通过全局“模拟环境”标识（i18n 双语）与真实状态区分；
- **兼容两种启动方式**：声明与部署方式一致即可，默认声明 `server-hosted` 正好对应默认托管模式；mock 只在显式声明时启用。

## 2. 功能要求

| ID | 要求 |
| --- | --- |
| `REQ-061-001` | 模式 B（`webui.hosting.enabled: true`）下，业务 listener 必须提供受保护的 management 读接口 facade：`/management/startupz`、`/management/livez`、`/management/readyz`、`/management/build`、`/management/diagnostics`、`/management/metrics`（GET），复用与 management listener 完全相同的 handler、`middleware.Management` 预算与 Authenticate/Authorize/metricsAccess 语义。 |
| `REQ-061-002` | 模式 A（`enabled: false`）保持现状：业务 listener 不挂载 facade，`/management` 未命中维持 JSON 404；Vite `/management` 代理（去前缀 → 9090）继续工作，行为不得回归。 |
| `REQ-061-003` | facade 路径清单必须由 management 路由的单一来源导出（不得在 composition 复制路径字面量）；未知 `/management/*` 子路径仍返回非 HTML 404（优先保持 JSON Problem `route_not_found`），方法不受支持时 405/JSON，绝不回退 SPA。 |
| `REQ-061-004` | WebUI 必须**显式声明数据源环境**：枚举 `server-hosted`（服务托管构建产物，默认）、`separated`（前后端分离 / Vite 代理）、`mock`（无真实数据响应，全 WebUI 模拟）。声明由受控配置承载（`VITE_WEBUI_DATA_SOURCE`），默认值 `server-hosted` 集中声明并与默认托管模式一致。 |
| `REQ-061-005` | 环境声明的合法取值必须经过校验：`webui/scripts/project-layout.mjs` 的 typed dev 配置解析器（052 模式）覆盖该键并拒绝非法枚举（dev/tooling 启动前失败）；客户端读取非法值保守回退默认 `server-hosted`。Vite 与 Playwright 使用同一校验结果。 |
| `REQ-061-006` | 声明 `mock` 时，**整个 WebUI 使用本地 mock 数据源**：宿主骨架（manifest、session、logout）与所有模块页面（IAM、Organization、Navigation、Ops）经宿主 SDK 传输层切换到 mock router，不发起任何真实网络请求；WebUI 可在无后端环境下完成 boot、登录态呈现与全部页面浏览。 |
| `REQ-061-007` | mock 数据必须**模块自有**：每个声明 Entry 的模块在其 `binding/webui/web/` 提供 mock 路由表（复用模块自有 `api.ts` 类型），经生成 registry（`webuiMockRegistry`）汇总；宿主 mock（manifest/session/logout）由宿主持有。禁止在宿主集中维护业务模块的 mock 数据。 |
| `REQ-061-008` | mock manifest 必须由 Go catalog 投影生成（全路由 `allowed + available + implemented`、默认导航策略），其 `catalogRevision` 与生成 registry 的 `webuiRevision` 一致，满足宿主 revision 门禁；禁止手写会漂移的 manifest fixture。 |
| `REQ-061-009` | mock 环境必须全程可见标识并遵守 i18n 双语：宿主 shell 全局渲染“模拟环境 / Mock environment”徽标（host locale 双语键）；所有 mock 数据与交互不得冒充真实服务状态。 |
| `REQ-061-010` | 声明 `server-hosted`/`separated` 时传输层行为与现状完全一致（mock 绝不在未声明时启用）；Ops 数据层执行真实查询并结合运行时可达性探测分级：可达（connected）按现有行为展示，不可达（网络错误、任意 4xx/5xx）显示“management 数据源不可达”横幅与卡片降级（值 `—`、保留重试、不伪造数字）。 |
| `REQ-061-011` | 单能力失败（数据源可达但某项 probe/能力失败）的既有展示语义（required→unavailable / optional→degraded、重试、刷新 Toast）不得回归。 |
| `REQ-061-012` | 新增文案必须进入对应 locale 并满足强制 i18n 门禁：宿主 mock 徽标/说明进 `webui.host`（zh-CN/en-US）；Ops 数据源不可达进 `webui.ops`（zh-CN/en-US）；模块 mock 数据不引入需翻译的服务端文案。 |

## 3. 非功能要求

- 不新增公开业务 API operation，不进入 contract-gen/openapi（management 仍不是公开 API 契约）。
- 不改变 CORS 白名单取值、IAM Session/CSRF/Origin 语义、Cookie 属性；mock 模式不发送真实请求，不涉及跨域。
- 不新增前端第三方依赖；mock 不使用任何外部 mock 库（如 MSW），由宿主 SDK 层内置实现。
- 模式 B facade 与 management listener 共享同一 handler 实例与预算语义；重复挂载不得产生第二套实现。
- 环境声明与服务方式必须一致：托管产物按默认（或显式 `server-hosted`）构建；`mock` 声明只用于无后端预览/演示，不得进入托管构建链（`webui build`，决策 4）；模式 A 开发如需明确声明使用 `separated`。
- 安全评估：模式 B 业务 listener 的对外暴露面增加 management 公开集合（probes/build）与受保护集合（diagnostics/metrics），必须在确认决策中明确接受。

## 4. 验收标准

1. 模式 B 下浏览器访问 `http://127.0.0.1:8080` 完成 setup/login 后，`运行状态` 页六个诊断卡片返回真实结果；默认构建产物声明为 `server-hosted`。
2. 模式 B 下 `curl http://127.0.0.1:8080/management/readyz` 返回 200 JSON（或等价）；`/management/nope` 返回非 HTML 404（JSON Problem）；`/management/metrics` 按 `metricsAccess` 与授权返回文本或 4xx（不回退 SPA）。
3. 模式 A 下 `/management` 代理行为与 060 验收一致，业务 listener 上 `/management/*` 未命中仍 JSON 404。
4. 环境声明：无覆盖时 `readWebUIDataSource()` 返回 `server-hosted`；设置 `separated`/`mock` 生效；非法值在 tooling 解析时失败（dev 启动前）且客户端回退默认；`webui build` 拒绝 `mock` 声明（决策 4 采纳后）。
5. **全 WebUI mock**：以 `VITE_WEBUI_DATA_SOURCE=mock` 构建并静态启动（无任何后端）时，页面能完成 boot（manifest/session）、显示全局“模拟环境”徽标（zh/en 切换正常），并可浏览 IAM 用户/角色/权限、Organization 部门/岗位/分配、Navigation 菜单、Ops 运行状态等全部页面，数据来自本地 mock，无真实网络请求。
6. mock 数据模块自有：`webuiMockRegistry` 覆盖全部声明 Entry 的模块；模块 mock 文件与自带 `api.ts` 类型一致；mock manifest `catalogRevision === webuiRevision`。
7. 真实模式回归：默认/`separated` 下传输层零 mock 代码路径；Ops 数据源不可达（后端未启动或全部请求被拒）显示“数据源不可达”横幅与 `—` 值，无伪造数字，可重试；单能力失败只影响该卡片状态。
8. Go 单元/composition 测试翻转并扩展：原“托管模式 `/management/*` 404”断言改为 facade 行为断言；Catalog 契约对 `MockSource` 的校验与生成 registry/mock manifest 稳定性测试通过。
9. WebUI Vitest：环境声明读取（默认/覆盖/非法回退）、mock router 调度（路径+方法→fixture、未命中 404 语义）、mock manifest revision 一致、模块 mock 形状、徽标双语渲染、Ops 不可达渲染、i18n 键存在性通过。
10. 文档 authority 与实现一致：`docs/getting-started/webui.md`、`docs/development/webui.md`、`docs/operations/runtime-capabilities.md`、`docs/repository-scope.md`、`config.example.yaml`、根 README、`webui/.env.example` 中的环境声明与 management/托管/mock 语义为本任务当前结论；`060` 与 `024` 遗留的“业务 listener 不挂载 management / managementStatus=404”表述被 061 替换并在变更记录中标注。
11. Windows 本机可执行项：`go test ./... -count=1`、`go vet ./...`、`pnpm typecheck`、`pnpm test`、`pnpm lint:modules`、`pnpm generate:check`、`git diff --check` 通过；Playwright mock project（零后端导航）与托管模式 Ops 检查在本机可执行时执行，受限则记录为 CI/后续项。

## 5. 非目标

- 不为 mock 模式提供真实服务能力；mock 只用于无后端预览/演示，数据与交互不冒充真实状态（全局标识强制）。
- 不删除独立 management listener（9090）；Ops 工具、探针与编排仍使用它。
- 不把 management 折叠进公开 API 契约，不改变 `metricsAccess`/scope 策略。
- 不引入 MSW/Service Worker 等第三方 mock 方案；不进 `frontend/`、`old-backend/`；不动其它模块的非 WebUI 导出面。
- 不实施容器 runtime 或远端 CI 浏览器验收（保持现有独立验证边界）。