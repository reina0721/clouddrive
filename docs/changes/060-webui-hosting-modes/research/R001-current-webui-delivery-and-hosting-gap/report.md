# R001 当前 WebUI 交付链与 Go 服务托管缺口

## 研究问题

当前 WebUI 的构建产物由谁产出、被谁消费；Go Service 是否具备任何静态托管能力；已有的前后端分离开发模式依赖哪些机制；若新增“Go 服务托管”模式，哪些现有契约会受到影响。

## 方法与范围

- 依据：根 README、`docs/repository-scope.md`、`docs/configuration/README.md`、`docs/operations/*`、`webui/package.json`、`webui/vite.config.ts`、`webui/scripts/*`、`internal/composition/*`、`internal/transport/http/*`、`Dockerfile`、`.goreleaser.yaml`、`.github/workflows/*`、`.scaffold/layout.json`。
- 快照：commit `e641206`（2026-08-22，`main`），本地 Go 1.26.6、Node 24.11.1、pnpm 10.22.0。
- 只读检查：`webui/dist` 存在（含 `assets/` 与 `index.html`），来自本地 `pnpm build`。

## 当前事实

### 1. WebUI 构建产物

- `webui/package.json` 的 `build` 脚本为 `vite build`；`webui/vite.config.ts` 固定 `build.outDir = <webuiRoot>/dist`、`sourcemap: false`，未配置 `base`（默认 `/`，产物资源使用绝对路径 `/assets/...`）。
- `webui/dist/` 已被 `.gitignore` 忽略（`/webui/dist/`）。
- 质量链：`scripts/Verify-WebUI.ps1`、`scripts/verify-webui.sh` 固定执行 `go run ./cmd/app webui generate --check`、`pnpm install --frozen-lockfile`、`pnpm lint`、`pnpm lint:modules`、`pnpm typecheck`、`pnpm test`、`pnpm build`；`.github/workflows/quality.yml` 的 webui-windows/webui-linux job 与 `release.yml` 的 release job 都调用它们。
- registry 生成：`pnpm generate` -> `webui/scripts/generate.mjs` -> `scripts/generate-tsconfig.mjs` + `go run ./cmd/app webui generate [--check]`；`cmd/app/main.go` 在进入 Bootstrap CLI 前特判 `webui generate`，产物为 `webui/src/generated/webui-registry.ts`（布局声明于 `.scaffold/layout.json` 的 `webui.registryOutput`）。
- `cmd/app` 尚未注册 `webui build` 类命令；`pnpm build` 只做 Vite 打包，不包含 registry 生成与依赖安装。

### 2. 交付链不托管 `webui/dist`

- `Dockerfile`：builder 只做 Go build，runtime 镜像只复制二进制、`config.example.yaml` 与空 `.data`；没有 Node/pnpm 阶段，也不复制 `webui/dist`。
- `.goreleaser.yaml`：archives 只包含 README、config.example.yaml、api/openapi.yaml 与 docs/operations/*.md，不包含 `webui/dist`。
- `docs/repository-scope.md` 明确声明“不应声称 Docker/release 已托管 `webui/dist`”。
- 根 README 的“五分钟本地启动”不涉及 WebUI；WebUI 需要独立终端运行 Vite（模式 A）。

### 3. Go Service 的 HTTP 组成与前置事实

- `internal/composition/generation.go` 的 `Prepare` 组装 `httptransport.NewRouteBinding(...)`（chi 路由树）、`newWebUIManifestHandler(...)`（`/api/v1/webui/manifest`）、`applicationRouter(...)`（中间件 + 挂载 manifest 与 `Mount("/", apiRoutes)`），随后在准备阶段绑定 listener 并启动 server。
- `applicationRouter` 的中间件链：RequestID、Recovery、AccessLog、TrustedProxy、SecureHeaders、RejectUpgrade、RequestTimeout、BodyLimit、**AcceptJSON**、CORS、rateLimit（可配置）、overload。其中：
  - `AcceptJSON()`（`pkg/httpx/production_middleware.go`）会拒绝“显式且不接受 JSON/Problem+JSON 的 Accept”；浏览器文档请求的 Accept 若不含 `*/*`/`application/*`/`application/json` 会被 406 拒绝——静态 HTML/JS 请求若不加区分地经过它就会失败（当前浏览器通常携带 `*/*` 所以碰巧能过，但这不是可依赖的语义）。
  - CORS 中间件与 IAM `requireOrigin` 都先做 `httpx.SameOrigin(request, origin)`（`scheme+"://"+request.Host` 精确比较），同源请求不需要进入 `http.cors.allowedOrigins` 白名单。
- IAM Session Cookie 固定 `Secure: true, HttpOnly: true, SameSite: Lax`（`internal/module/iam/binding/http/huma.go`）。现代浏览器将 loopback（localhost/127.0.0.1）视为潜在可信来源，`http://127.0.0.1:8080` 上 Secure Cookie 通常可用；非 loopback 纯 HTTP 部署则无法保存 Session，必须由 TLS 终结的反向代理承载。Vite dev server 使用本地 HTTPS 正是为了满足 Cookie Secure 语义。
- `app/src/api.ts` 全部使用相对路径（`/api/v1/...`），SPA 使用 react-router 客户端路由（`/setup`、`/login`、`/dashboard`、`/admin/*` 等来自 manifest）；托管模式下同源请求无需改写任何 API 路径。
- management（`/management`、9090）不挂在业务 Router 上；webui/src 当前不调用 `/management`。

### 4. 配置 ownership 与布局声明

- `internal/composition/configuration.go` 的 `applicationOwnedConfigurationBindings()` 是 Bootstrap/Service/one-shot CLI 共享的官方配置节集合；新增配置节必须在此注册，否则 strict 解析会拒绝。
- 052（`docs/changes/052-declarative-project-layout/`）固化了“生产 Service 运行期不读取 `.scaffold/layout.json`”，布局与运行值的一致性通过 `internal/tools/project-layout`（`--check-identity` 模式，接入 `Verify-Quality`）守住。
- `webui/scripts/project-layout.mjs` 与 `internal/projectlayout/layout.go` 是 Go/Node 两侧的布局解析器；`.scaffold/layout.json` 声明 `roots.webui = "webui"`。

## 推断

1. 模式 B（Go 服务托管）需要新增的唯一能力集中在业务 Router：静态文件服务 + SPA fallback，并必须在 **AcceptJSON 边界之外**挂载，否则浏览器 HTML/JS 请求会被 406。
2. 托管目录作为运行期配置值，其默认值只能是“webui root + dist”的字面量（如 `webui/dist`），并需要一致性门禁守护它与 layout 的声明关系；不能运行期读 layout。
3. 前置构建脚本（node 默认、bash 可选）的职责是：模块 WebUI 产物生成（registry，即 `pnpm generate` 链）-> 依赖安装（`pnpm install --frozen-lockfile`）-> 构建打包（`pnpm build` -> `webui/dist`）。
4. 容器与发行包必须把 `webui/dist` 打进镜像/归档；容器 runtime（distroless、无 node）永远不执行前置构建脚本，只能在镜像构建期完成。
5. 托管模式同源访问时，CORS 白名单（5173）与 IAM Origin 校验都不需要改变；需要文档化的是 Secure Cookie 的 loopback/TLS 前提。

## 适用与不适用场景

- 适用：当前仓库（单一 webui 根、相对 API 路径、SPA 客户端路由、严格配置 ownership、布局单一声明）。
- 不适用：存在多前端根、子路径部署（base 非 `/`）、需要运行期热更新产物、需要在 runtime 镜像内运行 node/pnpm 的部署。

## 局限与剩余未知

- 未执行 Playwright 托管模式 E2E、容器 runtime 验证（本机验证边界按文档记录）；这些属于实施期验证任务。
- chi 路由“/api 前缀挂载 + NotFound 兜底”的具体优先级行为未在本记录中实测，属实施期通过测试固定的细节。
- `go:embed` 与目录托管的取舍详见 R002，本记录只保留“当前无任何静态能力”的事实。

## 对当前任务的影响

- 需求与设计必须覆盖：AcceptJSON 边界重构、SPA fallback 与缓存头、托管目录校验、前置构建脚本与 CLI、layout 一致性门禁、Docker/goreleaser 产物纳入、文档 authority 同步。