# R002 WebUI 托管模式与构建脚本设计方案

## 研究问题

在“Go 服务托管”与“前后端分离”两种模式下，托管路径与前置构建脚本应如何建模；静态托管采用哪种承载策略；会触碰哪些现有边界；各候选的取舍依据是什么。

## 方法与范围

- 前置事实来自 [R001](R001-current-webui-delivery-and-hosting-gap/report.md)。
- 候选比较只依据当前仓库可验证的事实与标准库/成熟做法，不引入新第三方依赖。
- 外部比较对象：Go 标准库 `net/http` 静态服务与 SPA fallback 的常见做法（`http.FileServer` + 自控 fallback）；`go:embed` 官方语义（编译期打包、不可运行期改路径）；Vite 产物约定（hash 文件名、`base` 默认 `/`）。

## 候选一：托管模式的选择模型

模式由 `webui.hosting.enabled` 决定：

- **模式 A（前后端分离，`enabled: false`）**：现行行为不变。Vite dev server（HTTPS 5173，代理 `/api/v1` 与 `/management`）+ Go Service（8080/9090）。用于需要 HMR、浏览器调试的开发联调。
- **模式 B（Go 服务单进程托管，`enabled: true`）**：Go Service 在业务 listener 同时托管 `webui/dist`（SPA + 静态资源），API/manifest 同源提供，浏览器访问一个地址。用于本地验收、容器与发行包交付。

默认值采纳用户提案：`enabled` 默认 `true`。推断：新鲜克隆的用户执行 `config init` 后即进入模式 B；本地无产物时由“托管前构建脚本”补齐（见候选四），production 环境缺产物则快速失败。已有本地 `config.yaml` 无 `webui` 节时，strict 解析按缺失节回退默认值，因此现有配置自动获得模式 B 默认；若用户希望保持旧二终端流程，显式 `enabled: false` 或使用 `config init` 重新生成即可。

## 候选二：托管目录策略——运行期目录 vs 编译期 go:embed

| 维度 | 运行期目录（`http.FileServer(http.Dir(dir))`） | 编译期 `go:embed webui/dist` |
| --- | --- | --- |
| 与需求匹配 | 托管路径是配置值，可指向任意目录（含容器挂载），完全符合“托管路径配置”要求 | 路径编译期固定，无法作为运行期配置值；“路径可配置”需求无法满足 |
| 构建时序 | dist 缺失才需要前置脚本；存在即服务，无编译顺序依赖 | `go build` 前必须存在 dist 目录且至少一个文件，否则 embed 失败；Docker/goreleaser 必须强约束顺序 |
| 单文件分发 | 需随二进制分发 dist 目录（镜像/归档） | 单二进制，分发最简 |
| 运行期语义 | 磁盘即事实，替换 dist 后重启即可 | 内容冻结在二进制，必须重新编译发布 |
| 安全面 | 需要目录校验 + 穿越防护 + fallback 白名单 | 天然受限，但 SPA fallback 仍要处理 |
| 配置 consistency | 默认值需与 layout 一致性门禁守护 | 与 layout 一致性更弱（embed 路径硬编码） |

结论：以**运行期目录托管为主轨**（满足用户“托管路径配置”与“托管前脚本”两项需求），`go:embed` 作为后续 ADR 候选记录，不在本任务实施。理由：本任务的两条配置需求都由目录模式直接承载；单二进制诉求可留待首个正式 release 后评估。不保留两套实现并行。

## 候选三：静态处理器与 SPA fallback 语义

- 挂载点：业务 Router 根部；`/api/*`（含 manifest）严格优先，非 API 的 GET/HEAD 进入静态处理器。
- 行为：
  - 命中现有文件：按文件类型返回，带正确 Content-Type；
  - 未命中且路径不以 `/api/`、`/management` 开头：返回 `index.html`（SPA fallback，状态 200）；
  - 未命中且属于 `/api/`、`/management`：必须保持现有 JSON 404/405 Problem 语义，绝不回退 HTML；
  - 非 GET/HEAD：405 JSON Problem；
  - 路径穿越（`..`、反斜杠、NUL、编码绕过）：拒绝，依赖 `http.FileServer` 与前置校验双保险。
- 缓存头：`/assets/*`（Vite hash 文件名）`public, max-age=31536000, immutable`；`index.html` 与其余文件 `no-cache`。
- 目录校验（generation Prepare 时，fail closed）：目录存在、是真实目录、含 `index.html`；缺失即候选 generation 失败，错误信息给出修复指引。
- Reload 语义：`enabled`/`dir` 变化随配置 reload 重建 generation，新代重新校验目录；进程内不缓存文件内容，重建后按磁盘现状服务。
- 非目标：不做 gzip/brotli（交反向代理）、不做运行期热替换检测、不做子路径 base（`base` 恒为 `/`）、不做 dotfile 策略扩展。

## 候选四：托管前构建脚本与执行器

脚本职责链（与用户提案一致）：

```text
业务模块 WebUI 产物（registry 生成：pnpm generate 链）
 -> webui 依赖安装（pnpm install --frozen-lockfile）
 -> 构建打包（pnpm build -> webui/dist）
```

- 默认脚本：`webui/scripts/build-webui.mjs`（Node 运行时）；同时提供 `webui/scripts/build-webui.sh`（bash 运行时），两脚本逻辑等价、从 layout 解析 webui root。
- 配置：`webui.hosting.buildScript`（脚本路径，相对进程工作目录）+ `webui.hosting.buildRuntime`（枚举 `node` | `bash`，默认 `node`）。
- 执行器：`os/exec` 直接 `exec.Command(runtime, scriptPath)`，**不拼接 shell**，杜绝注入；cwd 为进程工作目录（与仓库其它相对路径配置一致）；超时由配置的有界 `buildTimeout` 约束；输出流入注入 Logger（Debug 级）；退出码/信号/超时全部向上导出，禁止忽略。
- 触发时机：
  1. CLI：`go run ./cmd/app webui build`——显式执行配置的脚本（配置缺失时使用默认值），作为模式 B 的“产物装配”入口；
  2. Service 启动（模式 B 且产物缺失）：首次 generation Prepare 前执行一次，成功后继续；生产环境（`logger.environment: production`）若产物缺失，**不执行脚本**而是快速失败（镜像内没有 node，且启动期构建不可预期）；
  3. 产物已存在时不重复构建；需要重建一律显式 CLI。
- Windows/Linux：默认 node 运行时两侧可用；bash 运行时用于 Linux（Windows 下若 `exec.LookPath("bash")` 不可用则启动期明确失败并提示）。

## 候选五：配置节与注册

新增 `webui` 配置节，owner 为应用 WebUI 托管组件（新包 `internal/webuihost`，避免与 `internal/webui` 契约包重名）：

```yaml
webui:
  hosting:
    enabled: true
    dir: ./webui/dist
    buildScript: ./webui/scripts/build-webui.mjs
    buildRuntime: node
    buildTimeout: 10m
```

- `dir` 默认值 = `.scaffold/layout.json` 的 `roots.webui` + `/dist` 的字面量；默认值集中声明于 `Default()`，并新增 layout 一致性门禁（见候选六）。
- 校验：`buildRuntime` 枚举；`dir`/`buildScript` 非空且无 NUL；`buildTimeout` 为正；production 环境禁止任何“缺失自动构建”。
- 注册：加入 `internal/composition/configuration.go` 的 `applicationOwnedConfigurationBindings()`，Bootstrap/Service/one-shot CLI 与 `config init` 自动识别；同步 `config.example.yaml` 与配置说明。

## 候选六：layout 一致性门禁

- 生产 Service 不读取 `.scaffold/layout.json`（052 固化决策），因此 `webui.hosting.dir` 与 `webui.hosting.buildScript` 的**默认值**与 layout 的一致性必须由构建期门禁守护。
- 扩展 `internal/tools/project-layout`：新增检查（如 `--check-webui`），断言 `webuihost.Default()` 的 `dir`/`buildScript` 与 `layout.Roots.WebUI` 关系一致，且默认脚本文件存在；接入 `scripts/Verify-Quality.ps1` 与 `scripts/verify-quality.sh`（与 `--check-identity` 并列）。
- WebUI 侧 `build-webui.mjs` 与 `build-webui.sh` 使用 `project-layout.mjs` 解析目录，不复制路径字面量。

## 候选七：交付链集成

- `Dockerfile`：新增 webui 构建 stage（固定 node 镜像 digest + corepack pnpm），执行 `install --frozen-lockfile`、`generate`、`build`；runtime 镜像复制 `/app/webui/dist`。容器 runtime（distroless、无 node）永远不执行前置脚本。
- `.goreleaser.yaml`：archives 增加 `webui/dist/**`（release job 已在 goreleaser 前运行 `verify-webui.sh`，产物存在）。
- `scripts/container-smoke.sh`：增加模式 B 冒烟断言（8080 根返回 index.html 且含应用挂载点），由容器验证任务执行并记录证据。

## 候选八：中间件边界重构（AcceptJSON）

AcceptJSON 中间件当前在 `applicationRouter` 外层，对静态 HTML/JS 请求有 406 误伤风险（R001 第 3 条）。方案：把 AcceptJSON 收窄到 API 分组（`/api/*` 与 manifest），静态处理器不经过它；其余基础设施中间件（RequestID/Recovery/AccessLog/TrustedProxy/SecureHeaders/RejectUpgrade/RequestTimeout/BodyLimit/CORS/rateLimit/overload）对两类请求保持一致。API 语义与响应契约不变。

## 候选九：Session/CORS 语义（仅文档）

- 同源模式下 CORS 与 IAM Origin 校验自动放行（`SameOrigin` 精确比较），`http.cors.allowedOrigins` 保持 5173 两项用于模式 A。
- IAM Session Cookie `Secure: true`：loopback（localhost/127.0.0.1）在浏览器为潜在可信来源，纯 HTTP loopback 可工作；非 loopback 纯 HTTP 无法保全 Session，必须 TLS 终结。该约束写入启动与部署文档，不改代码语义。

## 适用与不适用场景

- 适用：单 webui 根、相对 API 路径、`base: /`、严格配置与布局治理、distroless 容器、需要“目录可配置 + 前置脚本可配置”的交付形态。
- 不适用：需要单二进制分发且路径不可配置的强约束（转 go:embed 候选）；需要子路径部署；需要运行期热替换 dist；需要在生产容器内执行 node 构建。

## 局限与剩余未知

- chi 路由优先级与 NotFound 兜底的最终行为未实测，实施期用测试固定并前后对比 API 404 行为。
- `containersmoke`、Playwright 托管模式 E2E 属于实施期验证，本机与 CI 证据边界按任务矩阵记录。
- pnpm 安装的网络耗时与首次构建时长未实测，`buildTimeout` 默认值先取 10m，文档标注可按环境校准。

## 对当前任务的影响

- 需求：两项配置（托管路径、前置脚本路径）成为 typed config；模式选择为 `enabled`；默认值遵循用户提案（`enabled: true`、`dir: webui/dist`、`buildRuntime: node`）。
- 设计需要明确的待确认决策：缺失产物的启动语义（自动构建 vs 快速失败）、`buildOnStart` 是否需要独立开关、默认 `enabled` 是否采纳 `true`。