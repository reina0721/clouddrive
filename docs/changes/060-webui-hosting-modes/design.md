# 060 WebUI 托管模式与构建产物配置管理设计

引用研究：[R001](research/R001-current-webui-delivery-and-hosting-gap/report.md)、[R002](research/R002-webui-hosting-design-options/report.md)。

## 1. 总体模型

```text
                 config.yaml  webui.hosting.{enabled,dir,buildScript,buildRuntime,buildTimeout}
                                    |
        +---------------------------+----------------------------+
        |                            |                            |
   模式 A (enabled=false)      模式 B (enabled=true)         CLI: webui build
   Vite dev(5173/HTTPS)      Go Service 单进程:            显式执行前置构建脚本
   + Go service(8080)        业务 listener + 静态托管         (generate->install->build->dist)
        |                            |
     保持现状                  dist 缺失: development 启动前自动构建一次
                             production: 快速失败
```

- `webui.hosting` 是应用 WebUI 托管组件的配置节，owner 为新建包 `internal/webuihost`。
- 模式 B 的静态托管只在业务 listener（默认 8080）；management listener（9090）保持不变。
- 托管路径与前置脚本的**默认值**与 `.scaffold/layout.json` 的一致性由构建期门禁守护（生产 Service 不读 layout，沿用 052 决策）。

## 2. 配置节与注册

新包 `internal/webuihost`（与 `internal/webui` 契约包区分）：

```yaml
webui:
  hosting:
    enabled: true
    dir: ./webui/dist
    buildScript: ./webui/scripts/build-webui.mjs
    buildRuntime: node        # node | bash
    buildTimeout: 10m
```

- 类型与校验（仿 `internal/module/ops/binding/config` 的 Binding/Decode/Default 模式）：
  - `dir`/`buildScript`：非空、无 NUL；允许相对或绝对路径；解码时规范化。
  - `buildRuntime`：枚举 `node` | `bash`，其余值拒绝。
  - `buildTimeout`：正时长，默认 `10m`；同时约束 CLI 与启动期自动构建。
  - 跨节校验（Prepare 阶段）：`logger.environment == production` 时禁止“缺失产物自动构建”语义（见 §5），发现即候选 generation 失败。
- 注册：`applicationOwnedConfigurationBindings()` 增加 `webuihost.Binding()`；`config init` 生成节默认值；`config.example.yaml` 增加带注释章节。
- 运行期只暴露 `webuihost.Config` 的不可变副本给 generation；配置 reload 变更 `enabled`/`dir` 走整代重建（§6）。

## 3. 静态托管处理器（`internal/webuihost`）

### 3.1 处理器构造

`NewSPAHandler(dir string, apiPrefixes ...string) (http.Handler, error)`：构造时不读目录；`serveHTTP` 时才访问磁盘。

行为矩阵（顺序执行）：

| 条件 | 行为 |
| --- | --- |
| 目录校验失败（构造前由 generation 完成） | 候选 generation 失败，不绑定 listener |
| 路径含 `..`、反斜杠、NUL 或编码穿越 | 400 JSON Problem |
| 方法非 GET/HEAD | 405 JSON Problem（与路由 MethodNotAllowed 风格一致） |
| 命中 `dir` 下真实文件 | 按文件类型返回；`/assets/*` 带 `public, max-age=31536000, immutable`，其余 `no-cache` |
| 未命中且前缀属于 `/api/`、`/management` | 交由原 404 语义（JSON Problem），绝不回退 HTML |
| 未命中且非上述前缀 | 返回 `dir/index.html`（200），带 `no-cache` |

- SPA fallback 只对 GET/HEAD 生效；`index.html` 必须存在（generation 校验）。
- 安全双保险：`http.Dir` 的 `Open` 内置清理 + 前置路径校验；穿越 fixture 必须 4xx。
- 磁盘读取无内存缓存；不实现 gzip/brotli（文档标注交由反向代理）。

### 3.2 目录校验

`ValidateDir(dir string) error`：`os.Stat` 为真实目录、`index.html` 存在。在 generation `Prepare` 阶段 fail closed；错误信息给出修复指引（提示 `webui build` 或托管路径配置），不泄露绝对路径细节之外的信息。

## 4. 中间件边界重构

- 现状：`applicationRouter` 外层中间件链含 `AcceptJSON()`，`Mount("/", apiRoutes)`。
- 目标：AcceptJSON 收窄到 API 分组。
- 组成（`internal/composition/service.go` 的 `applicationRouter`）：
  - 外层基础设施链保持：RequestID、Recovery、AccessLog、TrustedProxy、SecureHeaders、RejectUpgrade、RequestTimeout、BodyLimit、CORS、rateLimit（可选）、overload。
  - API 分组（`/api/*` + `/api/v1/webui/manifest`）：再包一层 `AcceptJSON`。
  - 模式 B：非 API 前缀的 GET/HEAD 进入静态处理器（不经过 AcceptJSON）；其余保持 404/405 JSON。
  - 模式 A：非 API 请求行为与现状一致（JSON 404）。
- 路由实现：外层 chi Router 上 `Mount("/api", apiRoutes)`、显式 `GET /api/v1/webui/manifest`、`NotFound` 分支按模式接入静态处理器或现状 404；具体 chi 挂载优先级以单元测试固定并覆盖“未知 /api 路径仍 JSON 404”。

## 5. 前置构建脚本与执行器

### 5.1 脚本职责链（默认 node 脚本 `webui/scripts/build-webui.mjs`）

```text
1) 业务模块 WebUI 产物生成：node scripts/generate.mjs（registry + tsconfig，含 go run ./cmd/app webui generate）
2) 依赖安装：pnpm install --frozen-lockfile
3) 构建打包：pnpm build（vite build -> <layout.webuiRoot>/dist）
```

- 等价 bash 脚本 `webui/scripts/build-webui.sh`（Linux），使用 `corepack pnpm` 与 `project-layout.mjs` 解析路径；两脚本不复制路径字面量。
- 脚本执行失败（任意步骤非零）即整体失败，退出码向上导出。

### 5.2 执行器（`internal/webuihost`）

- `RunBuild(ctx, runtime, scriptPath string, timeout time.Duration, out io.Writer) error`：
  - `exec.Command(runtime, scriptPath)`，**不使用 shell**；cwd = 进程工作目录（与仓库相对路径配置语义一致）。
  - 有界 `buildTimeout`；ctx 取消/超时杀死子进程并向上导出。
  - 输出通过注入 Logger 记录（Debug 级），不把 stdout 全文写入日志（防污点），仅截断摘要；错误保留退出码/信号/超时原因。
- 运行时解析：`exec.LookPath(runtime)`；`bash` 在 Windows 缺失时失败并提示（默认 node 不触发）。

### 5.3 CLI：`webui build`

- `cmd/app/main.go` 沿用 `webui generate` 的特判入口模式：`webui build`。
- 逻辑：加载 application 配置（`internal/kernel/config` 同套 loader）；配置缺失/无该节时使用 `webuihost.Default()`；调用 `RunBuild`；非零退出码 `ExitError`，保留原因。
- 不修改生成物之外的文件；不启动 Service。

### 5.4 启动期自动构建（仅 development，缺产物时）

- 触发条件（全部满足才执行）：模式 B（`enabled: true`）、`ValidateDir(dir)` 失败、`logger.environment == development`。
- 时机：首次 generation `Prepare` 之前（factory 上 `sync.Once`/原子标志，**每进程至多一次**）；构建失败则候选 generation 失败，进程退出并给出指引。
- production：缺产物直接快速失败（不执行脚本），错误提示使用 `webui build` 或在镜像构建期装配产物。
- reload 不触发构建（标志已置位）；需要重建产物一律 `webui build` 后重启或等待 reload 重新校验目录。

## 6. generation 与 reload 语义

- `webuihost.Config` 参与 generation 快照；`enabled`/`dir` 变化 → 新代 Prepare 重新执行 §3.2 目录校验与路由组装；切换 A/B 模式随整代切换原子生效。
- 静态处理器无共享可变状态，磁盘即事实；旧代排空后新代按新目录服务。
- `buildTimeout`/`buildScript` 只影响 CLI 与启动期构建，不强绑定单代生命周期。

## 7. layout 一致性门禁

- 扩展 `internal/tools/project-layout`：新增 `--check-webui`（或扩展现有检查），断言：
  - `webuihost.Default().Hosting.Dir` 规范化后 == `<layout.Roots.WebUI>/dist`；
  - `webuihost.Default().Hosting.BuildScript` == `<layout.Roots.WebUI>/scripts/build-webui.mjs`；
  - 默认脚本文件（node 与 bash）存在于仓库内；
- 接入 `scripts/Verify-Quality.ps1` 与 `scripts/verify-quality.sh`（紧随 `--check-identity`）；漂移即质量失败。
- 说明：运行时值（部署覆盖的 `dir`）不受门禁约束，门禁只守护默认值声明与布局的一致性。

## 8. 交付链集成

- `Dockerfile`：
  - 新增 `webui-build` stage：固定 digest 的 node 镜像 + `corepack` pnpm@10.22.0；`pnpm install --frozen-lockfile`、`pnpm generate`、`pnpm build`。
  - runtime stage：`COPY --chown=nonroot:nonroot --from=webui-build /src/webui/dist /app/webui/dist`。
  - 容器配置继承 `config.example.yaml` 的 `webui.hosting`（`enabled: true`、`dir: ./webui/dist`）；runtime 无 node、无 shell，启动期不构建。
- `.goreleaser.yaml`：`archives.files` 增加 `webui/dist/**`；release job 已在 goreleaser 前运行 `verify-webui.sh`（产物存在），无需改 workflow。
- `scripts/container-smoke.sh`：增加模式 B 断言（`GET http://<addr>:8080/` 返回应用 HTML 且命中应用挂载点）；断言失败非零退出。
- `.dockerignore` 保持忽略 `dist`（构建期在镜像内重新生成，不依赖本地产物）。

## 9. 文件影响

| 范围 | 文件 |
| --- | --- |
| 新包 | `internal/webuihost/*.go`（config binding/decode/default/validate、SPA handler、dir 校验、build runner）+ 测试 |
| Composition | `internal/composition/configuration.go`（注册 binding）、`service.go`（AcceptJSON 收窄与静态挂载）、`generation.go`（托管目录校验、启动期构建钩子）、`application.go`/`main.go` 相关 CLI 入口 |
| 工具 | `internal/tools/project-layout/main.go`（一致性检查）、`scripts/Verify-Quality.ps1`、`scripts/verify-quality.sh` |
| WebUI 脚本 | `webui/scripts/build-webui.mjs`（新）、`webui/scripts/build-webui.sh`（新）、相关 package.json 脚本/测试 |
| 交付 | `Dockerfile`、`.goreleaser.yaml`、`scripts/container-smoke.sh` |
| 配置与文档 | `config.example.yaml`、根 `README.md`、`docs/getting-started/webui.md`、`docs/getting-started/first-use.md`、`docs/configuration/README.md`、`docs/development/webui.md`、`docs/operations/build-and-container.md`、`docs/operations/release.md`、`docs/operations/runtime-capabilities.md`、`docs/repository-scope.md`、`webui/README.md`（如涉及） |
| 质量 | `scripts/Verify-WebUI.ps1`、`scripts/verify-webui.sh`（脚本语法检查） |

## 10. 失败语义与原子性

- 配置非法：binder 与 generation 校验双保险，资源创建前失败。
- 目录非法：候选 generation 失败，旧代保持服务；不静默降级 API-only。
- 构建失败：CLI 非零退出；启动期构建失败 = 进程启动失败；均保留退出码/原因。
- 脚本执行中 ctx 取消：杀进程、向上导出，不残留孤儿进程。
- 一致性门禁漂移：质量/CI 失败，不覆盖 layout 或默认值。
- 多文件生成不做（本任务无多生成物写入）；CLI 只读配置、不写仓库。

## 11. 迁移与单轨删除

- 无旧实现可迁移：Go Service 当前无静态能力；新能力单轨落地。
- 模式 A 行为（Vite 联调）必须是 `enabled: false` 下的完整回归，不保留任何“兼容分支”之外的旧路径；`AcceptJSON` 收窄以测试证明 API 契约不回归。
- 文档中“Docker/release 尚未托管 webui/dist”等过期表述在实施完成后删除并更新 authority；旧表述只保留在历史变更记录。

## 12. 验证

- Go 单元：config（默认值/枚举/超时/跨节校验）、SPA handler（文件/fallback/前缀排除/方法/穿越/缓存头）、dir 校验、build runner（fixture 脚本：成功、失败退出码、超时、bash 缺失）、一致性检查。
- Composition：generation 开启/关闭托管、reload 切换 A/B、缺产物 development 自动构建一次 / production 快速失败。
- CLI：`webui build` 成功与失败路径（fixture 脚本，不真正跑 pnpm）。
- WebUI：`node --check webui/scripts/build-webui.mjs`、`bash -n webui/scripts/build-webui.sh` 进 Verify-WebUI；`pnpm generate:check` 等常规链不变。
- 端到端（本机可执行项）：`pnpm build` 后 `go run ./cmd/app` 访问 `http://127.0.0.1:8080` 完成 setup/login、深链刷新回退、`/api`/`/management` JSON 404；模式 A 回归 5173。
- Playwright：新增托管模式 project（webServer 启动本地构建的 Go 二进制 + 临时配置/DB + setup token，baseURL 8080）跑 setup/login/深链；若本机执行受限，明确记录为 CI/后续验证项。
- 质量链：`Verify-Quality`、`Verify-WebUI`、`Verify-Docs`（Windows/Linux）、`git diff --check`、遗留表述搜索。

## 13. 待确认决策（提交用户）

1. 默认 `enabled: true`（采纳用户“默认由 Go 服务托管”）——影响根 README 启动章节与所有 authority 文档默认流程。
2. 缺产物启动语义：采纳“development 自动构建一次 / production 快速失败”（REQ-060-005），还是更保守的“一律快速失败 + 显式 `webui build`”？
3. 托管目录默认值 `webui/dist`（布局根 + `dist`）与脚本默认值 `webui/scripts/build-webui.mjs`（node）是否确认。
4. `go:embed` 列入后续 ADR 候选、本任务不实施，是否认可。