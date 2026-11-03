# R075-002 WebUI 渲染 API 契约的数据源与模块接入机制

## 研究问题

1. 当前公开契约的事实链是什么？（权威、生成、运行期暴露）
2. WebUI 新模块如何声明并接入（Binding/registry/mock/locale/菜单/图标）？
3. 契约数据进入浏览器的候选路径有哪些，各自的三态环境（server-hosted/separated/mock）成本与漂移风险如何？

## 方法与范围

- 只读检索仓库事实：`api/README.md`、`internal/transport/http/huma.go`、`internal/tools/contract-gen`、`internal/composition/{webui_registry.go,http_contracts.go,webui_http.go}`、`internal/webui/contract.go`、`internal/composition/webui_cli.go`、`cmd/app/main.go`、`.scaffold/layout.json`、`webui/{scripts/*,src/generated/webui-registry.ts,src/contracts,src/sdk/mock,src/api.ts,vite.config.ts,tsconfig.base.json}` 及 settings/ops 模块样例。
- 对照应用模块开发指南与 AGENTS.md 3.2/3.8 的选型与单轨要求做能力评估。

## 证据与事实

### 契约事实链（唯一权威）

- `api/openapi.yaml` 是产物而非权威：`go generate ./...` 运行 `internal/tools/contract-gen`，从各模块 `binding/http` 的 Huma 无资源 registration 渲染 OpenAPI 3.0.3（`DowngradeYAML`）与 operation inventory（api/README.md、contract-gen/main.go）。注册表 authority：`internal/composition/http_contracts.go` 的 `applicationHTTPRegistrations()`。
- 运行期不暴露文档：`internal/transport/http/huma.go` 中 `config.OpenAPIPath = ""`、`config.DocsPath = ""`、`SchemasPath = ""`；二进制不 embed `api/openapi.yaml`（grep 无 embed/读文件路径）。
- 契约变更门禁：CI 以 oasdiff 对照上一个已提交 `api/openapi.yaml` 基线；`go generate` 后要求 `git diff --exit-code -- api internal/transport/http/api`。

### WebUI 模块机制（事实）

- 模块声明：`internal/module/<id>/binding/webui/binding.go` 返回 `webuicontract.Binding`（Entries/Routes/Navigation/Locales/MockSource/Requires 等）；settings 模块即“无 module.go、纯 WebUI binding”的现行先例（073/074）。
- composition 汇总：`applicationWebUIModules()` 显式列出已激活 Binding；`catalog.ValidateOperationReferences(operations)` 要求 ViewOperationID/ActionPermissions 必须存在于 operation inventory（`ops.diagnostics` 被特殊并入）。
- 生成链：`cmd/app webui generate [--check]` → `WriteWebUIRegistryFromCurrentDirectory(check)` 写 `webui/src/generated/webui-registry.ts`（webuiRevision = catalog JSON 的 SHA-256，只覆盖 Binding 声明，不含契约内容）；`webui/scripts/generate.mjs` → `go run ./cmd/app webui generate`；`build-webui.mjs` 在托管构建时执行 generate 步骤；`pnpm generate:check` 用于 CI。
- 契约约束：声明 Entry 的模块必须同时给 Locales 与 MockSource（`validateBindings` + 生成器双重校验）；locale 必须覆盖 Routes/Navigation/Zone 的 TitleMessageID；mock manifest（`webuiMockManifest`）由 catalog 投影，`catalogRevision` 与 `webuiRevision` 一致。
- mock 传输层：`webui/src/contracts` 的 requestJSON/requestText 在 mock 声明时切换到本地 mock router（`webui/src/mock/router.ts` + `host.ts` + 模块 `mock.ts` 路由表），零真实请求；页面若不做任何请求则 mock 下天然可浏览（settings 模块 mock.ts 为空数组的先例）。
- 宿主零改动：App.tsx 的 `renderAppRoutes`/菜单从 manifest 投影，新增模块路由/菜单不需要改宿主源码（064 先例）。
- 图标目录受控：`internal/webui/icons.go` 与 `webui/src/icon-catalog.ts` 双 authority，一致性测试守护；新增图标必须双侧同步。
- 布局清单：`.scaffold/layout.json` 声明 `webui.registryOutput` 等路径；`projectlayout` 校验路径归属（`isWithin roots.webui`）。

### 契约浏览器化候选路径（比较）

| 候选 | server-hosted / separated | mock 模式 | 漂移风险 | 结论 |
| --- | --- | --- | --- | --- |
| A. 运行期 fetch 服务端挂载的 openapi.yaml（go:embed + 静态路由） | 需 Go embed（go:embed 模式禁止 `..`，需在 api/ 下建包）+ 路由挂载 + Vite 代理扩展 | mock 需在模块 mock.ts 复制/引用契约 → 复制或第三份生成物 | 中（嵌包/路由/代理多处装配，mock 数据复制破坏单权威） | 否决 |
| B. webui build 时把 openapi.yaml 复制进 dist 静态目录 | 同源 fetch 可行 | 复制体必须同时进 mock 快照 | 中（复制 + 环境分叉） | 否决 |
| C. 扩展 webui generate 生成 `webui/src/generated/openapi-spec.ts`（JSON 对象） | 页面直接 import，三态一致 | 天然一致（同一 import，零请求） | 低（同一生成命令 + --check 整文件严格比对；契约变更必须随 webui build 链再生成，与 registry 同纪律） | **采用** |

否决 A/B 的关键事实：mock 模式要求“整个 WebUI 所有页面零请求可浏览”（webui/README.md），任何运行期 fetch 路径都必须给 mock 提供契约副本，必然引入复制或第三份生成物；而把生成物放在既有 `webui generate` 链内，与 webui-registry.ts 同目录、同命令、同 --check 纪律，契约 `api/openapi.yaml` 仍是唯一物理权威文件。

## 结论

- 【采用】扩展 `cmd/app webui generate [--check]`：在 registry 生成之外，读取 layout 指定的 `api/openapi.yaml`，用 `go.yaml.in/yaml/v3`（go.mod 已有）解析为 JSON 并写出 `webui/src/generated/openapi-spec.ts`（`export const webuiOpenAPISpec = {...}`，JSON 对象字面量、不定宽类型标注，避免 tsc 大字面量类型；文件头含源文件 sha256 供诊断）；`--check` 做整文件严格比对。
- 生成物与运行：页面经新 alias `@webui/generated/openapi-spec`（tsconfig.base.json + vite.config.ts 各加一项）import；路由注册进 `applicationWebUIModules()`；openapi 模块 `mock.ts` 为空路由表（settings 先例）。
- 承载架构评估：模块化宿主 + 生成 registry + mock 投影机制完全能够表达本需求，无兼容层必要；不新增 Kernel capability、不新增平台 SDK、不新增 Go 运行期资源/配置/生命周期（生成物是构建期静态资产），Reload 分类：无（不在运行期重读）。
- 【保留】既有 `webui generate` 生成链（演进而非替换）；【退役】无旧实现需要清理。

## 适用与不适用场景

- 适用：构建期契约快照进入浏览器、三态一致、零请求 mock。
- 不适用：运行期契约热更新（当前契约设计本身是构建期产物，超范围）。

## 局限与剩余未知

- `openapi-spec.ts` 的体积/typecheck 开销未实测（~60KB YAML → JSON 对象字面量）；设计上采用“无 as const 的宽对象”避免字面量类型爆炸，实施时以 `pnpm typecheck` 复验。
- `api/openapi.yaml` 不存在或不可解析时的生成失败语义要明确定义（见 design.md 失败语义）。
- catalog revision 不包含契约内容：spec 文件漂移由 --check 整文件比对兜底，不依赖 revision。

## 对当前任务的影响

- 生成器改动（composition + cmd/app + layout 清单新增 specOutput 键）、新模块目录/页面/locale/mock/binding、tsconfig/vite alias、图标目录双侧新增 `book`、composition 菜单测试与 e2e fixture 更新、文档 authority 更新与 documentation-impact.yaml。