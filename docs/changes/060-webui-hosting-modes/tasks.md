# 060 任务清单

## 1. 门禁状态

- 研究门禁：已通过（R001、R002）。
- 计划状态：已确认（用户已确认 4 项决策：默认 `enabled: true`；缺产物 development 自动构建一次 / production 快速失败；默认字面量 `webui/dist` 与 node 脚本；`go:embed` 仅记录为后续 ADR 候选）。
- 实施授权：已获得；可开始下列非文档任务。
- 相关前置：052 已固化 layout/dev config 与一致性门禁模式；059 已提交（`b36dcc6`），工作区应保持干净（`git status` 目前为空）。
- 范围边界：只处理 060 自身文件；`frontend/`、`old-backend/`、业务模块 owner、Manifest/Binding 契约与 CORS/安全语义不得顺手修改。

## 2. 研究与计划

| ID | 任务 | 完成条件 | 状态 |
| --- | --- | --- | --- |
| `RES-060-001` | 复核当前 WebUI 交付链与 Go 服务托管缺口 | R001 区分已实现事实、推断与局限；覆盖构建产物、Docker/release、HTTP 组成、AcceptJSON、Session/Origin、配置 ownership | 已完成 |
| `RES-060-002` | 托管模式与构建脚本候选设计 | R002 给出模式模型、目录 vs embed 取舍、SPA/中间件边界、脚本执行器、配置与门禁、交付集成结论 | 已完成 |
| `PLAN-060-001` | 形成需求、设计、文件影响、验证与任务计划 | requirements/design/tasks/documentation-impact 齐全，提交待确认报告 | 已完成 |

## 3. 实施任务（已确认）

| ID | 依赖 | 任务 | 完成条件 | 状态 |
| --- | --- | --- | --- | --- |
| `CFG-060-001` | 用户确认 | 新建 `internal/webuihost` 配置 Binding/Decode/Default/Validate（`webui.hosting` 节），注册进 `applicationOwnedConfigurationBindings()` | `config init` 生成默认节；旧配置缺节按默认值工作；非法枚举/超时/路径在资源创建前失败 | 已完成；`internal/webuihost/config.go` + 测试；`configuration.go` 注册；`config.example.yaml` 同步；生成的配置含 `enabled: true/dir: webui/dist/buildScript: ...mjs/buildRuntime: node` |
| `HOST-060-001` | CFG-060-001 | 实现静态托管 SPA 处理器与目录校验（fallback、前缀排除、方法/穿越/缓存头） | 对应单元测试覆盖行为矩阵（REQ-060-007/008）；`/api`、`/management` 未命中保持 JSON 404 | 已完成；`internal/webuihost/spa.go` + 行为矩阵测试（文件/fallback/排除前缀/方法/穿越/HEAD/缓存头/ValidateDir） |
| `MID-060-001` | HOST-060-001 | 收窄 `AcceptJSON` 到 API 分组并挂载静态处理器（模式 B）/维持现状（模式 A） | 既有 `not_acceptable` 与 API 404 回归不失败；浏览器 Accept 加载 HTML/JS fixture 通过 | 已完成；`pkg/httpx.AcceptJSONHandler()` 替换 `AcceptJSON()`，`NewRouteBinding` 内置门禁，`applicationRouter` 挂载 dispatch；`service_test.go` 新增托管模式路由测试 |
| `GEN-060-001` | HOST-060-001, MID-060-001 | generation 集成：目录校验 fail closed、A/B 切换与 reload 语义、缺产物 development 自动构建一次 / production 快速失败 | 单元与 composition 测试覆盖；错误信息可执行 | 已完成；`generation.go` 早期 fail-fast（参与者启动前）+ `ensureWebUIHostAssets`（每进程一次）+ 静态 handler 挂载；`TestGenerationHostingModeServesWebUIAssets`、`TestGenerationHostingProductionFailsFastOnMissingAssets` |
| `RUN-060-001` | CFG-060-001 | 实现构建执行器 `RunBuild`（os/exec 直启、超时、Logger 注入、退出码/信号导出）与 `webui build` CLI | fixture 脚本成功/失败/超时/运行时缺失均有测试；CLI 非零退出保留原因 | 已完成；`internal/webuihost/build.go`（SnippetBuffer 有界输出）+ `RunWebUIBuild`（`composition/webui_build.go`）+ `cmd/app webui build`；composition 测试覆盖配置/回退/失败路径；真实 `webui build` 全链执行通过 |
| `SCRIPT-060-001` | RUN-060-001 | 新增 `webui/scripts/build-webui.mjs` 与 `build-webui.sh`（generate -> install -> build），从 layout 解析路径 | node/bash 语义等价；`node --check`/`bash -n` 通过；进入 Verify-WebUI | 已完成；两脚本从 `project-layout.mjs` 解析路径；Verify-WebUI/verify-webui.sh 增加语法检查；真实 CLI 运行验证（registry 生成 -> 冻结安装 -> vite build 3.5s） |
| `GATE-060-001` | CFG-060-001, SCRIPT-060-001 | 扩展 `internal/tools/project-layout` 一致性检查并接入 Verify-Quality | `--check-webui` 断言默认 dir/脚本与 layout 一致、脚本存在；漂移 fixture 失败 | 已完成；`validateWebUI`（dir=layout roots.webui+/dist、buildScript=root 脚本、两脚本存在）；接入 `Verify-Quality.ps1` 与 `verify-quality.sh`；本机运行通过 |
| `DELIVERY-060-001` | SCRIPT-060-001, GATE-060-001 | Dockerfile webui 构建 stage + runtime 复制 dist；goreleaser 归档含 `webui/dist/**`；container-smoke 增加模式 B 断言 | 镜像构建含 dist；归档含 dist；smoke 断言非零失败时暴露 | 已完成；Dockerfile `webui-build` stage（node:24-bookworm@sha256 固定，官方 API 复核 2026-08-22）+ runtime COPY；goreleaser files 增加 `webui/dist/**`；container-smoke 断言 home 含 `<div id="root">` 且 `/api/v1` 不回退 HTML（容器 runtime 验证仍属远端 CI 边界） |
| `E2E-060-001` | GEN-060-001, DELIVERY-060-001 | 模式 B 端到端：本机 8080 setup/login/深链刷新/`/api` 与 `/management` JSON 404；模式 A 5173 回归 | 验收标准 4/5/6 证据；Playwright 受限时记录为 CI/后续项 | 模式 B 已完成：临时 cwd 生成干净配置 + 绝对 `APP_WEBUI__HOSTING__DIR` 指向真实 dist，实测 `rootSpa=True assetImmutable=True sessionStatus=401 setupStatus=201 sessionCookie=True deepLinkFallback/loginFallback=True managementStatus=404 managementJson=True`；模式 A 由全量 Go 套件（hosting disabled 路径）回归；Playwright 托管 project 记录为 CI/后续项（本机无干净全配置环境，且本地 config.yaml 为陈旧用户数据不可改动） |
| `DOC-060-001` | 上述全部 | 同步 authority 文档与 `config.example.yaml`，删除过期“未托管 dist”表述 | 验收标准 10；`Verify-Docs` 通过 | 已完成；README 双模式章节、webui 启动指南、first-use、配置说明（webui 节 + ownership 表）、WebUI 开发指南（托管与产物装配）、运维 build-and-container（webui stage）、release（归档含 dist）、runtime-capabilities、repository-scope、webui/README、config.example.yaml 全部同步；旧表述残留搜索为零（仅变更记录保留验收文本） |
| `GIT-060-001` | DOC-060-001 | 审查 diff、运行全量验证并提交 | 只 stage 060 文件；Conventional Commit；不 push | 已完成；commit `86c2ca8`，只含 060 文件（51 个），未 push（working tree clean） |

## 4. 实施顺序

```text
CFG-060-001
  -> HOST-060-001 + RUN-060-001
  -> MID-060-001 + SCRIPT-060-001
  -> GEN-060-001 + GATE-060-001
  -> DELIVERY-060-001
  -> E2E-060-001
  -> DOC-060-001
  -> GIT-060-001
```

实施中若发现必须改变公共配置边界、HTTP 路由/operation、业务模块 owner、CORS/安全语义或引入新第三方依赖，退回研究/待确认并更新计划。

## 5. 验证矩阵

| 范围 | 命令/证据 |
| --- | --- |
| Go | `go test ./... -count=1`、`go test -race ./... -count=1`、`go vet ./...`、CGO-free build |
| 配置 | `config init` 生成节核对；旧配置缺节启动；非法值 fixture |
| WebUI | `pnpm generate:check`、`pnpm lint`、`pnpm lint:modules`、`pnpm typecheck`、`pnpm test`、`pnpm build`；`node --check`/`bash -n` |
| Static | SPA handler 行为矩阵单测；`/api`、`/management` JSON 404 回归；缓存头/穿越 fixture |
| CLI | `go run ./cmd/app webui build` 成功与失败路径（fixture 脚本） |
| E2E | 本机 8080 setup/login/深链；模式 A 5173 回归；Playwright 托管 project（受限记录） |
| 交付 | Docker 构建含 `/app/webui/dist`；goreleaser 归档含 `webui/dist`；container-smoke 模式 B 断言 |
| 门禁 | Verify-Quality、Verify-WebUI、Verify-Docs（Windows/Linux）、layout `--check-webui`、`git diff --check` |
| 范围 | 旧“未托管 dist”表述搜索为零；`frontend/`、`old-backend/`、模块 owner、CORS 取值未变 |

## 6. 重新确认触发器

- 默认值或托管语义与用户确认不一致（`enabled` 默认、缺产物自动构建 vs 快速失败、`dir`/`buildScript` 默认字面量）；
- 需要实施 `go:embed`、子路径部署、CDN 或运行期热更新；
- 需要修改 HTTP 路由/operation、Manifest/Binding、业务模块 owner、CORS/Origin/Session 安全语义或新增前端依赖；
- 需要在生产容器内运行 node 构建或引入 shell。