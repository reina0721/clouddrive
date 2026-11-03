# 060 WebUI 托管模式与构建产物配置管理需求

引用研究：[R001](research/R001-current-webui-delivery-and-hosting-gap/report.md)、[R002](research/R002-webui-hosting-design-options/report.md)。

## 1. 目标

为当前 Admin WebUI 提供两种可切换的运行模式，并建立两处受控配置：**WebUI 构建产物托管路径**与**托管前构建脚本启动路径**。

- **模式 A：前后端分离启动**（`webui.hosting.enabled: false`）——Vite dev server 提供页面并代理 API/management，Go Service 只提供业务 HTTP，维持现状。
- **模式 B：Go 服务单进程托管**（`webui.hosting.enabled: true`，默认）——Go Service 在业务 listener 上托管 WebUI 构建产物（SPA + 静态资源），API 与页面同源提供。

默认由 Go 服务托管（模式 B）；切换由配置节 `webui.hosting` 控制；托管前通过可配置脚本（默认 node）完成“业务模块 WebUI 产物生成 -> 依赖安装 -> 构建打包”，产物落盘到可配置托管目录（默认 `webui/dist`，即布局声明的 WebUI 根 + `dist`）。

## 2. 功能要求

| ID | 要求 |
| --- | --- |
| `REQ-060-001` | 必须提供类型化配置节 `webui.hosting`，以 `enabled` 布尔选择托管模式；默认值 `true`（模式 B），`false` 保持模式 A 全部现有行为不变。 |
| `REQ-060-002` | `webui.hosting.dir` 是托管目录配置：默认值为布局声明的 WebUI 根拼接 `/dist`（当前字面量 `webui/dist`），非空相对/绝对路径；生产 Service 不得运行期读取 `.scaffold/layout.json`。 |
| `REQ-060-003` | `webui.hosting.buildScript` 是托管前构建脚本路径配置：默认 `webui/scripts/build-webui.mjs`；`buildRuntime` 枚举 `node`/`bash`，默认 `node`。脚本职责链固定为：业务模块 WebUI 产物（registry）生成 -> 依赖安装（frozen lockfile）-> 构建打包，产物输出到 `dir` 指向的目录。 |
| `REQ-060-004` | 必须提供 `webui build` CLI：按当前配置（配置缺失时使用默认值）执行前置构建脚本；脚本退出码、信号与超时必须原样向上导出，禁止忽略或静默回退。 |
| `REQ-060-005` | 模式 B 且托管目录缺失（或缺少 `index.html`）时：development 环境允许在进程启动、首次 generation 前自动执行一次前置构建脚本（每进程至多一次）；production 环境不允许启动期构建，必须快速失败并给出可执行的修复指引。目录已存在且有效时不重复构建。 |
| `REQ-060-006` | 脚本执行必须由执行器直接用 `runtime + scriptPath` 启动（`os/exec` 直启），禁止拼接 shell 命令字符串；执行有界超时；stdout/stderr 流入注入的 Logger（Debug 级），错误链保留原始退出信息。 |
| `REQ-060-007` | 模式 B 下，业务 Router 必须提供静态文件服务：`/assets/*` 等已存在文件按真实类型返回；未命中且不属于 `/api/`、`/management` 前缀的 GET/HEAD 请求返回 `index.html`（SPA fallback）；`/api/`、`/management` 前缀未命中仍保持现有 JSON 404/405 Problem 语义，绝不回退 HTML。 |
| `REQ-060-008` | 静态文件服务必须拒绝路径穿越（`..`、反斜杠、NUL、编码绕过）；非 GET/HEAD 方法返回 405 JSON Problem；缓存头规则：Vite hash 资源（`/assets/*`）`immutable`，`index.html` 与其余文件 `no-cache`。 |
| `REQ-060-009` | `AcceptJSON` 中间件必须收窄到 API 分组（`/api/*` 与 manifest），静态处理器不经过它；其余基础设施中间件对 API 与静态请求保持一致，API 响应契约不因本任务变化。 |
| `REQ-060-010` | generation 在 Prepare 阶段校验托管目录（存在、真实目录、含 `index.html`），非法即候选 generation 失败；`enabled`/`dir` 变化随配置 reload 重建 generation，新代按新目录重新校验。 |
| `REQ-060-011` | 托管目录与前置脚本的默认值必须与 `.scaffold/layout.json` 一致性门禁守护：扩展 `internal/tools/project-layout` 新增检查，接入 `Verify-Quality`/`verify-quality.sh`；默认脚本文件必须存在。 |
| `REQ-060-012` | `Dockerfile` 必须新增 webui 构建 stage（固定 node 镜像与 pnpm 版本），产物复制进 runtime 镜像；distroless runtime 不得执行前置构建脚本，也不得要求在运行期安装 node。 |
| `REQ-060-013` | `.goreleaser.yaml` 归档必须包含 `webui/dist/**`，保证发布包解压后可直接进入模式 B。 |
| `REQ-060-014` | 必须提供与 node 默认脚本等价的 bash 脚本（Linux 场景）；两脚本逻辑一致且从 layout 解析路径，不复制路径字面量。 |
| `REQ-060-015` | 文档 authority 必须同步：根 README 的 WebUI 启动章节改为双模式说明；`docs/getting-started/webui.md`、`docs/configuration/README.md`、`docs/development/webui.md`、`docs/operations/build-and-container.md`、`docs/operations/release.md`、`docs/operations/runtime-capabilities.md`、`docs/repository-scope.md` 与 `config.example.yaml` 更新；不得保留“Docker/release 不托管 webui/dist”的过期表述。 |
| `REQ-060-016` | 必须验证模式 B 下的 Session 语义并写入文档：同源请求不依赖 CORS 白名单；iam Session Cookie 带 `Secure`，loopback 纯 HTTP 可工作，非 loopback 纯 HTTP 必须 TLS 终结；不改动现有安全语义。 |

## 3. 非功能要求

- 不新增前端第三方依赖；不引入运行时插件加载、Module Federation 或目录扫描注册。
- 不改变 HTTP API 路由、operation ID、Manifest/Binding、业务模块 owner、CORS 白名单取值或 IAM 安全语义。
- 托管目录缺失时不得“降级为 API-only 静默服务”；必须失败或按 `REQ-060-005` 明确处理。
- 脚本与目录路径不得泄露到日志污点；执行输出只做 Debug 级记录，不包含凭据。
- 托管目录校验、SPA fallback、缓存与穿越防护必须有单元测试；`AcceptJSON` 边界前后行为需要 API 404 回归测试。
- 产物缺失自动构建只发生在 development；`production` 环境执行任何构建脚本都会被配置校验拒绝。

## 4. 验收标准

1. `config init` 生成的配置包含 `webui.hosting` 节且 `enabled: true`、`dir: webui/dist`、`buildScript: webui/scripts/build-webui.mjs`、`buildRuntime: node`；已存在的旧 `config.yaml` 不带该节也能以默认值启动。
2. 修改 `.scaffold/layout.json` 的 `roots.webui` 后一致性门禁失败（默认值与其漂移被拒绝）；修复后通过。
3. `go run ./cmd/app webui build` 在 node 环境把 `webui/dist` 装配到最新（registry 生成 + 安装 + 打包）；脚本失败时 CLI 非零退出且保留失败原因。
4. 模式 B（`enabled: true`）下，浏览器访问 `http://127.0.0.1:8080` 可完成 setup/login 全流程；刷新深链（如 `/dashboard`）返回 SPA fallback；`/api/...` 未命中仍返回 JSON 404；`/management` 未命中返回 JSON 404；目录不存在时启动快速失败或（development + 允许自动构建）先构建再启动。
5. 模式 A（`enabled: false`）下，Vite 5173 HTTPS 联调、代理与 Origin/CORS 行为与现在完全一致。
6. 静态资源返回正确 Content-Type 与缓存头（`/assets/*` immutable、`index.html` no-cache）；穿越路径 fixture 返回 4xx。
7. Docker 镜像包含 `/app/webui/dist` 且容器启动后 8080 根路径返回应用 HTML；release 归档包含 `webui/dist`。
8. `AcceptJSON` 收窄后：所有既有 API 用例（含 `not_acceptable` 门禁测试）不回归；新增“浏览器 Accept 加载 index.html/JS 成功”的托管回归测试。
9. Windows/Linux 的 Go/WebUI/Docs 质量门禁、`git diff --check` 通过；新增 Playwright 托管模式 E2E（若当前环境可执行）或明确记录人工/CI 验证证据。
10. 文档断言与实现一致：不残留“Docker/release 未托管 webui/dist”的过期表述；两种模式的启动路径在根 README 与 webui 指南中均可直接执行。

## 5. 非目标

- 不实施 `go:embed` 静态打包（记录为后续 ADR 候选）。
- 不支持子路径部署（`base` 恒为 `/`）、运行期热替换/热更新 `dist`、构建缓存层级或 CDN 集成。
- 不修改 `frontend/`（Nuxt/Vue 独立前端）与 `old-backend/`。
- 不改变 `webui generate` 契约、Manifest/Binding 生成链或模块 Owner 边界。
- 不在生产容器内引入 node/pnpm，也不为容器添加 shell。
- 不引入 gzip/brotli 压缩或磁盘缓存（交反向代理层）。