# 112 接口调试工作台（API Workbench）

遵从用户需求，在当前纯前端后台系统的「开发中心」导航分组下新增接口调试与测试工作台（挂载路径 `/api-workbench`），全面复刻并对齐 ToAPI 类似系统的接口调试、参数配置、脚本断言、集合批跑与自动化任务等核心能力。

## 1. 架构设计与契约边界

遵循三层架构规范（Universal Foundation → Product Surface → Runtime Host）：

1. **契约与模型层 (`@clouddrive/surface/api-workbench`)**：
   - 在 `surfaces/src/api-workbench/model.ts` 中定义完备的 TypeScript 实体契约（`WorkspaceSnapshot`, `ApiProject`, `ApiCollection`, `ApiRequestDefinition`, `ApiEnvironment`, `KeyValueEntry`, `RequestHistoryItem`, `TaskDefinition` 等），严格对齐 `exactOptionalPropertyTypes: true`。
   - 定义产品 Port 接口 `ApiWorkbenchPort`（包含 `capabilities`, `workspace`, `transport`, `tasks` 四大核心维度），实现业务 UI 与运行时具体宿主的解耦。
   - 在 `surfaces/src/api-workbench/schema.ts` 中实现零依赖的纯 TypeScript JSON 快照解析校验器，提供安全的数据导入与反序列化保护，避免引入 Zod 带来的 85KB 产物膨胀。
   - 在 `surfaces/src/api-workbench/mock-routes.ts` 中内置 `mock://` 模拟路由引擎，原生提供 `mock://users`, `mock://auth/login`, `mock://system/stats` 等即席调试服务。

2. **插件实现层 (`surfaces/plugins/api-workbench`)**：
   - 导航元数据注册为开发中心分组（`groupAlias: 'development'`），分配专属 `api` 标识图标。
   - 全面支持中英双语国际化 (`i18n.ts`)，无页面内硬编码文案。
   - 请求插值引擎 (`interpolate.ts`) 支持在 URL、Headers、Body 中使用 `{{variable}}` 动态注入环境或全局变量。
   - 安全脚本沙箱 (`sandbox.ts`) 导出 `toapi` API，支持前置改写请求与后置 `toapi.test(...)` / `toapi.expect(...)` 单元级断言。
   - 批量 Runner (`runner.ts`) 支持集合顺序批跑、环境透传、进度通知与断言汇总。
   - cURL 解析引擎 (`curl.ts`) 支持在 URL 栏直接粘贴原生 cURL 命令并自动还原请求方法、Headers、数据体。

3. **宿主层装配 (`apps/web/src/api-workbench`)**：
   - 提供 `createMockApiWorkbenchService()`：基于 IndexedDB（LocalStorage / Memory 优雅降级）持久化存储，内置 Mock 路由器与浏览器原生 fetch 双模式传输。
   - 提供 `createBackendApiWorkbenchService()`：为未来接入后端 Relay 转发代理提供零改造成熟通道。
   - 在 `runtime.tsx` 中实现按需动态加载，避免 Mock 服务与重量级逻辑渗入其他页面的主打包块。

## 2. 界面与功能矩阵

- **左侧工作区树形导航**：支持项目、集合、接口三层层级管理，支持即时过滤搜索、导出工作区快照与导入恢复。
- **请求配置主面板**：
  - HTTP 常用方法选择（GET / POST / PUT / PATCH / DELETE / HEAD / OPTIONS）与语义着色高亮。
  - URL 输入框支持即时变量插值感知与 cURL 命令智能识别解析。
  - **Params**：查询参数键值对编辑器，支持启停勾选与说明备注。
  - **Headers**：请求头键值对编辑器，内置常见 Header 预设。
  - **Auth**：支持 None、Bearer Token、Basic Auth、API Key (Header / Query) 四类主流认证方式。
  - **伪装 (Disguise)**：支持 User-Agent 预设伪装、自定义代理与超时配置。
  - **Body**：支持 None、JSON、Form-Data、x-www-form-urlencoded、Raw Text、XML 等多格式输入。
  - **提取器 (Extractors)**：支持根据 JSONPath 提取响应体字段或提取响应头，自动写入环境或全局变量。
  - **前后置脚本 (Scripts)**：配备代码等宽编辑器，支持发送前变量构造与收到响应后的自动化断言。
- **右侧响应查看区**：
  - 响应状态条展示 HTTP 状态码、耗时与传输大小，并汇总脚本断言通过/失败项数。
  - Subtabs 支持 Pretty（格式化并带高亮与一键复制）、Raw、Headers 与历史记录（最近发送列表与重载）。
  - CORS 跨域错误友好告警提示与规避指引。
- **集合批量 Runner**：
  - 支持按集合运行批量测试，提供进度条、测试汇总统计（总数、成功数、失败数、总耗时）及明细列表。
- **自动化任务与环境管理**：
  - 任务面板支持针对目标集合配置定时 Cron / 间隔调度任务。
  - 侧边抽屉支持切换与编辑多套环境的环境变量及全局变量。

## 3. 产物与性能预算优化

- **代码拆分 (Code Splitting)**：在路由入口 `routes/page.tsx` 中采用 `React.lazy` 与 `Suspense` 隔离 `Workbench` 界面，使 `/api-workbench` 页面静态构建体积从 531KB 压缩至 374KB（低于系统首页 375KB）。
- **零依赖校验器**：移除第三方 Zod 解析器，手写严格契约校验器，节约 84.6KB 静态体积。
- **Tailwind CSS v4 语义规范**：严格使用 Design System 语义 Token，避免任意值 class，全局 CSS gzip 保持在 48KB 门禁之内。

## 4. 验证与门禁通过

1. **单元测试与 E2E 验证**：
   - `surfaces/plugins/api-workbench/src/model/workbench.test.ts`：10 项单元测试覆盖插值、提取、断言、沙箱、cURL 解析、快照校验与 Mock 路由器。
   - `apps/web/e2e/api-workbench.spec.ts`：Playwright E2E 测试覆盖首屏进入、Mock 接口发送、200 OK 渲染、断言通过检查、历史记录回溯与集合批量 Runner 完整执行。
2. **全套门禁通过**：
   - `pnpm foundation:check`：0 违规通过。
   - `pnpm architecture:check`：721 个源码文件 0 违规通过。
   - `pnpm dependency:check`：27 个受管控依赖检查通过。
   - `pnpm codegen:plugins:check` & `pnpm codegen:design:check`：全部 fresh。
   - `pnpm lint`：ESLint 全项目 0 错误 0 警告通过。
   - `pnpm typecheck`：13 个 Workspace TypeScript 严格类型检查通过。
   - `pnpm test`：全套 32 个 Web 测试套件与 9 个 Surface 测试套件全部通过。
   - `pnpm build`：Next.js 静态预渲染 61 个路由成功导出。
   - `pnpm performance:check`：产物预算全部达标通过。
   - `pnpm test:browser`：Playwright 浏览器测试通过。
   - `pnpm format:check`：全项目 Prettier 格式规范通过。
   - `pnpm docs:check`：文档结构完整性检查通过。
