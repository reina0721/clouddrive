# 060 WebUI 托管模式与构建产物配置管理

状态：已确认并实施，验证完成并提交（commit `86c2ca8`）。

## 目标

为当前 Admin WebUI 提供两种可切换运行模式：

- **模式 A（前后端分离）**：Vite dev server + Go Service，维持现状，`webui.hosting.enabled: false`；
- **模式 B（Go 服务单进程托管，默认）**：Go Service 在业务 listener 托管 WebUI 构建产物，`webui.hosting.enabled: true`（默认），API 与页面同源。

配套两处配置管理：**WebUI 构建产物托管路径**（`webui.hosting.dir`，默认 `webui/dist`，即布局声明的 WebUI 根 + `dist`）与**托管前构建脚本启动路径**（`webui.hosting.buildScript` + `buildRuntime`，默认 node 脚本：业务模块 WebUI 产物生成 -> 依赖安装 -> 构建打包）。

## 关键结论

- 生产 Service 不读取 `.scaffold/layout.json`（052 决策），托管目录/脚本默认值与 layout 的一致性由 `internal/tools/project-layout` 新检查守护。
- 静态托管采用运行期目录策略（`http.FileServer` + SPA fallback），`go:embed` 列为后续 ADR 候选，不在本任务实施。
- `AcceptJSON` 中间件必须收窄到 API 分组，否则浏览器 HTML/JS 请求存在 406 误伤；API 404/406 语义以回归测试确保不变。
- 前置构建脚本由 `os/exec` 直启（不拼接 shell）；`webui build` CLI 显式装配；development 缺产物可在启动前自动构建一次，production 缺产物快速失败。
- Docker 新增 webui 构建 stage（distroless runtime 不运行 node），goreleaser 归档纳入 `webui/dist`。
- Session Cookie `Secure` 语义不变：同源模式不依赖 CORS 白名单；纯 HTTP 仅限 loopback，生产需 TLS 终结。

## 阅读顺序

1. [研究索引](research/README.md)
2. [需求规格](requirements.md)
3. [整体设计](design.md)
4. [实施任务与确认边界](tasks.md)

## 待确认决策

1. 默认 `enabled: true`（采纳“默认由 Go 服务托管”）。
2. 缺产物启动语义：development 自动构建一次 / production 快速失败。
3. 默认值字面量：`dir: webui/dist`、`buildScript: webui/scripts/build-webui.mjs`、`buildRuntime: node`。
4. `go:embed` 不纳入本任务，仅记录为后续 ADR 候选。