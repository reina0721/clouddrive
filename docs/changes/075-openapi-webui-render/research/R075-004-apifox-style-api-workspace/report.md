# R075-004 Apifox 风格可测试 API 文档工作台

## 研究问题

用户要求在 075 的基础上继续调整：页面要「如 Apifox 这样、可测试、完整」，而不是「全都放到一个页面、没有完整功能的 Swagger UI」。需要回答：

1. 视图结构如何组织（不再单页堆叠）？
2. 请求执行能力如何落地（认证、CSRF、mock、CORS 语义）？
3. 是否有可嵌入的成熟第三方满足「平台组件 + 可测试 + 完整」？

## 方法与范围

- 内部事实：读取 webui 路由契约（`internal/webui/contract.go`）、会话/CSRF 链路（`webui/src/api.ts`、`webui/src/contracts/index.tsx`）、模块页面先例（settings GroupLayout/SectionNav、iam 会话页）、`openapi-data.ts`（既有解析层）。
- 外部候选：hoppscotch（开源 API 测试 Web 应用）、Postman/Bruno（独立桌面形态）——均为独立应用，非可嵌入 React 组件库；无「组件开放可注入平台组件」的成熟工作台库。用户要求页内组件使用当前 WebUI 组件（前两轮已确认），第三方控件方案与本要求互斥。

## 证据与事实

### 路由契约约束（内部）

- `webui.Route.Path` 只接受静态路径（`validPath` 拒绝参数模板/query/fragment）；manifest 投影后宿主 `App.tsx` 按 `path` 静态渲染。**动态操作详情无法表达为独立 manifest 路由**。
- 先例：settings 用固定路径分组（`Route.GroupLayoutID` + SectionNav）；详情级动态选择（如会话/账号 id）都在单路由内以模块内部状态实现。

### 会话与执行语义（内部）

- `loadSession()`（`/api/v1/iam/session`，webuiSession 认证）返回 `WebUISession`，含 `csrfToken`；登录态用户可直接获得。
- `requestJSON`/`fetch` 同源 `credentials: include`；IAM 的 mutation 中间件要求 `Origin` + `X-CSRF-Token`。
- 数据源环境：`readWebUIDataSource()` 公开；`mock` 声明时 `requestJSON`/`requestText` 走本地 mock router，模块 mock 表为空（无后端，执行不可用）。

### 外部候选（事实）

- hoppscotch：MIT，独立 SPA（大量自带栈/路由/状态），非组件库，嵌入 Admin 壳成本高且与「页内用当前 WebUI 组件」互斥；Postman/Bruno 为桌面应用；无其它成熟的「可嵌入 + 组件可注入」OpenAPI 工作台。

### 推断

- 在线路由契约下，Apifox 形态在本 Admin 内以「**单 manifest 路由 + 模块内视图状态**」实现：工作台布局（左栏操作树 + 主区详情）、接口列表/操作详情/模型三种视图通过 `?view=&op=` search 参数深链（阅读 `window.location.search`，无路由契约改动）。
- 执行器语义（与既有安全边界一致）：
  - 同源 `fetch`（mode B 同源；mode A 经 Vite 代理 `/api/v1` 转发；`credentials: include` 自动携带 webuiSession Cookie）；
  - `bearerAuth` 操作：页面提供 token 输入（**仅内存，不持久化**），执行时注入 `Authorization: Bearer <token>`；
  - `webuiSession` 操作：执行改走浏览器会话（Cookie 自动）；mutation 由执行器自动附加 `Origin` 与 `X-CSRF-Token`（复用 `loadSession` 的 csrfToken），与真实 WebUI 同语义；
  - `none` 操作：直接执行；
  - mock 声明：`readWebUIDataSource() === "mock"` 时执行面板呈现「mock 演示构建无后端，执行不可用」，数据浏览不受影响。
- 响应面板：状态码/耗时/响应头/格式化 JSON body；请求体用 textarea + JSON.parse 校验（平台组件，不引入代码编辑器库）。
- 执行是用户主动行为，权限即当前 WebUI 用户权限（文档页不放大权限）。

## 结论

- 【架构重构（模块内）】`openapi` 页从「只读单页参考」升级为「Apifox 风格工作台」：`/openapi` 单路由承载工作台（左栏过滤/搜索操作树 + 主区：接口详情可执行面板 / 模型视图），视图间通过模块内状态 + search 参数切换；页面组件仍全部来自 `@webui/sdk/ui`（含可编辑输入、DataTable、Button、StatusPill 等），API 树/详情/执行为模块自有逻辑。
- 【自研执行器】(证据见上)：无成熟可嵌入候选满足平台组件与完整性要求；执行器是模块自有窄实现（同源 fetch + 认证注入 + CSRF 复用），不新增平台 SDK capability。
- 【保留】`openapi-data.ts` 解析层扩展出请求构建数据（参数默认值/路径展开/请求体模板）；生成快照链（R075-002）不变；`bearerAuth` 在内存态；mock 边界如实呈现。
- 【非目标】多环境/环境变量/断言脚本/导入导出（Apifox 高级功能，无真实用例）；请求体富编辑器（text/JSON 文本足够）。

## 适用与不适用场景

- 适用：Admin 内文档+测试一体工作台、会话语义复用、静态路由约束下的模块内多视图。
- 不适用：独立部署的完整测试应用；需要复杂脚本断言/环境管理的高级工作流。

## 局限与剩余未知

- 执行时真实后端行为（CSRF 拒绝格式、分页参数默认值等）以实施期联调为准；`webuiSession` mutation 经执行器成功后与真实 WebUI 写入无差别（用户知情）。
- `Content-Type`/请求体形态按 operation 的 `requestBody.content` 自动选择 JSON；非 JSON media type 不在首页范围（Huma 产物全为 JSON/Problem JSON，性能够）。

## 对当前任务的影响

- 重做 `OpenAPIPage`（工作台：树 + 详情 + 执行面板 + 响应 + 模型视图），扩展 `openapi-data.ts`（请求构建/树结构），更新 locales/e2e/单测与权威文档；`R075-003`（只读单页）结论被本记录取代，历史证据保留。