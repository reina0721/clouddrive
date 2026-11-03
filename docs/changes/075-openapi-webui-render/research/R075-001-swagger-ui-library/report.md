# R075-001 成熟第三方 Swagger UI 库选型

## 研究问题

Admin WebUI（React 19.1.1 + Vite 7 + StrictMode，Tailwind v4/HeroUI 呈现层）需要一个成熟第三方 Swagger UI 库渲染公开契约。需要回答：选哪个库、固定什么版本、以何种边界接入、有哪些已知兼容风险。

## 方法与范围

- 数据来源：npm registry 元数据（`corepack pnpm view`，2026-08-25 快照）、swagger-api/swagger-ui 官方仓库与 GitHub issues（curl 查询 GitHub issues API，2026-08-25）。
- 候选：`swagger-ui-react`（官方 React 封装）、`swagger-ui-dist`（静态资源独立部署）、`@scalar/api-reference`、`redoc`。
- 判据：功能覆盖（是否官方/标准 Swagger UI 形态）、维护活跃度、版本演进、许可证、React 19 兼容、Vite/构建链兼容、体积与接入成本、与既有 WebUI 体系（懒加载、mock 三态、模块边界）的契合。

## 证据

### 事实（registry metadata）

- `swagger-ui-react@5.32.14`（latest，2026-08-25）：peerDependencies `react >=16.8.0 <20`、`react-dom >=16.8.0 <20` —— 与项目 React 19.1.1 兼容；license Apache-2.0；homepage/repository = swagger-api/swagger-ui（官方主仓库）。
- 依赖内含 `buffer@^6.0.3`、`base64-js`、`ieee754`、`js-yaml@=4.3.1`、`react-redux@^9`、`redux@^5`、`swagger-client@^3.38`、`dompurify`、`lodash`、`immutable` 等——是完整自足的开源 Swagger UI 浏览器实现（体积显著，见局限）。
- 版本演进：4.x → 5.x 系列持续发布（5.30/5.31/5.32 均在 2026 年有版本），维护活跃。
- 候选对比：`@scalar/api-reference@1.66.1`（MIT，dist.unpackedSize ≈ 41 MB，2026-08-20 活跃）；`redoc@2.5.3`（MIT，2026-05-29 活跃）。两者都更重或非官方 Swagger UI 形态；用户诉求明确指定“Swagger UI 库”。

### 事实（上游 issue）

- **#10553（closed 2025-09-03）**：swagger-ui-react 5.28.0 在 Vite 下报 `Module "buffer" has been externalized for browser compatibility` → `Cannot read properties of undefined (reading 'from')`；降级 5.27.1 可绕过。随后版本通过把 `buffer` 等 polyfill 包内建为直接依赖（5.32.14 的 dependencies 可见）规避该问题。
- **#10883（open 2026-05-14）**：swagger-ui-react 5.17.14 起 hash deep-linking（`#/operationId`）失效。影响范围：依赖 hash 深链展开的用法。

### 推断

- 发布渠道与依赖形态表明 #10553 的根因（safe-buffer 解析 `buffer` 内置模块）在 5.32.14 已由内建 `buffer` npm 包依赖消除，但**必须在本仓库真实 Vite 7 构建中复验**（issue 报告环境为 Vite 5.x/6.x，存在间接性）。
- #10883 与本页无关：宿主是 react-router SPA，Swagger UI 的 hash deep-linking 与路由器会互相干扰，页面应显式关闭（`deepLinking` 不启用），因此该回归不构成阻塞。
- StrictMode（`main.tsx` 已启用）会否触发 swagger-ui-react（内部 redux store）双挂载异常，issue 检索未获决定性结论；列为实施期首个验证点，带降级方案（模块内 mount-once 守卫）与退出条件。

## 结论

- 【采用】`swagger-ui-react`，实施时固定精确版本（当前 5.32.14；以 `pnpm-lock.yaml` 冻结核验后的实际安装版本为准并回填本记录）。
- 接入边界（对应计划 design.md）：第三方的使用是 pure-local 呈现细节，**在 openapi 模块内做窄封装**（`OpenAPISpecView` 收敛 props 与 CSS import），不新增平台 SDK capability、不进入 `@webui/sdk`、不建立万用 Wrapper；CSS 随懒加载 chunk 进入。
- 风险与退出条件：① StrictMode 双挂载实测异常 → 模块内 mount-once 守卫；② Vite 构建重现 buffer 警告/运行时错误 → 回退到最近的无问题版本并在记录中更新（supersede 本结论）；③ 体积 → 独立懒加载 chunk，不影响首屏（记录新 bundle 基线，参照 068 基线做法）。

## 适用与不适用场景

- 适用：React 19 SPA 内嵌、懒加载文档页、契约为 OpenAPI 3.0 对象（直接以 `spec` prop 传入，不用 YAML 解析）。
- 不适用：独立部署的完整文档站点（改用 swagger-ui-dist 静态托管）；需要深度换肤/重排版的用例（scalar/redoc 组件模型更开放，但当前无此需求且成本更高）。

## 局限与剩余未知

- 本记录未对 5.32.14 做真实浏览器运行验证（研究阶段不装依赖）；CSP/内联样式（Swagger UI 会注入 style）、HeroUI/Tailwind 全局样式的具体冲突程度需要实施期以 e2e 截图与手动目测确认。
- web_search 工具在本次会话不可用（API key 鉴权失败），外部证据全部来自可直连的 registry/GitHub 主源；已标注为 snapshot 并设置刷新触发器。

## 对当前任务的影响

- 依赖：`webui/package.json` + `pnpm-lock.yaml` 增加 `swagger-ui-react`（固定版本）。
- 模块页面：`OpenAPIPage.tsx` 内窄封装 + `import "swagger-ui-react/swagger-ui.css"`。
- 测试：vitest 对 swagger-ui-react 做模块级 mock（jsdom 不跑真实渲染），真实渲染由 Playwright 覆盖。