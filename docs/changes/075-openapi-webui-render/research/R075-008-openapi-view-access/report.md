# R075-008 openapi 页面未登录可访问的原因与修复

## 研究问题

用户发现 openapi 模块的四个页面（总览/分类/接口/模型）**未登录也能访问**。需要回答：为什么？平台有没有既有的「必须登录」机制？修复是否要为 WebUI-only 模块新增后端 operation？

## 方法与范围

- 读 `internal/webui/contract.go` 的 manifest 投影：路由 access 如何由 `ViewOperationID` 决定。
- 读 `internal/composition/webui_http.go` 的宿主 manifest handler：operation 判定与未认证分支。
- 读 `webui/src/App.tsx`：路由 access=authentication-required 时宿主行为（跳登录/隐藏菜单）。
- 读 IAM 的 `iam.session.read` 定义（policy/scope）与 permission 常量，评估作为绑定候选的语义。
- 读 `internal/composition/http_contracts.go`：operation inventory 来源与 webui route 权限引用登记，确认绑定既有 operation 不新增 HTTP 端点。

## 事实

- **投影规则（contract.go）**：`ManifestForWithNavigation` 对每个 route：`access := AccessAllowed; if route.ViewOperationID != "" { access = accessLookup(route.ViewOperationID) }`。即：**未声明 ViewOperationID 的路由无条件 allowed**。
- **宿主判定（webui_http.go）**：`accessLookup(operation)` —— `operation == ""` 直接 `AccessAllowed`；operation 非空且未认证 → `AccessAuthenticationRequired`；已认证 → `authorizer.EnforceOperation`（public policy 恒放行；protected 需 scope/RBAC）。
- **宿主呈现（App.tsx）**：`ManifestPage` 对 `route.access === "authentication-required"` 的路由 `<Navigate>` 到 `unauthenticatedDefault`（`/login`）；菜单只投影 `loadableRoutes`（仅 access==allowed 的路由），因此未登录时菜单不显示该模块、直达 URL 跳登录。
- **openapi 现状**：四个路由均**未声明 ViewOperationID**（binding.go 注释「契约是公开仓库产物，页面不绑定服务端 operation」）。
- **候选 `iam.session.read`**：`protected` policy，scope `iam:account:self:read`（SelfRead）；该操作是「读取当前会话」——所有已登录用户天然持有 self scope，等价于「已认证即可访问」。
- **mock 构建**：`projectWebUIMockManifest` 的 accessLookup 恒返回 allowed，mock 演示构建不受影响（不要求登录是 mock 环境的既有语义）。
- **operation inventory**：operations 集合来自 HTTP definitions（app HTTP 模块 registration）；`iam.session.read` 已存在；路由 ViewOperationID 为 protected 时会在 permission catalog 登记 `webui route` consumer 引用（绑定既有操作即自动生效，无需新增 HTTP operation）。

## 推断

1. 根因是投影规则的默认分支：无 ViewOperationID → allowed，与「页面是否发请求」无关（settings 同语义）。
2. 修复只需在 openapi 四个路由声明 `ViewOperationID: "iam.session.read"`：
   - 未登录 → manifest 返回 authentication-required → 宿主跳 `/login`、菜单隐藏；
   - 已登录任意用户 → EnforceOperation(self read) 通过 → 正常访问；
   - 不新增 HTTP operation、不改宿主 URL 特判、不引入新依赖；
   - mock 演示构建仍全可用（mock manifest 恒 allowed）。
3. 语义合理性：文档浏览本身无后端请求，门槛只是「已登录用户」；绑定 iam.session.read 是复用已有「会话存在即通过」的窄契约，避免为 WebUI-only 模块虚构操作。

## 结论

- 【采用】openapi 四个路由绑定 `ViewOperationID: "iam.session.read"`（Go binding 一处改动 + 重新生成 registry/mock manifest 校验）；前端无需改动（manifest 语义驱动），vitest/Playwright 中 mock 模式断言不变，dev 模式登录流不变。
- 【不采用】为 openapi 新增 HTTP operation（会污染公开契约，且无真实 handler）；宿主按 URL 特判（违反 transport 不硬编码 URL 的原则）。

## 适用与不适用场景

- 适用：WebUI-only 模块需「必须登录浏览」；复用已认证即放行的既有操作。
- 不适用：需要细分角色权限的页面门槛（如审计日志页要 auth:audit:read，走各自 ViewOperationID）；mock 环境要求登录（违反 mock 零后端演示语义）。

## 局限与剩余未知

- `iam.session.read` 的 scope 若未来收紧（如单独吊销某账号 self 读），openapi 门槛会同步收紧；当前任何正常登录用户都持有 self scope，等价「已认证即可访问」。
- settings 模块同语义未声明 ViewOperationID，本轮不扩大范围（用户只问 openapi）。

## 对当前任务的影响

- design/tasks 增加第七轮任务：绑定 ViewOperationID（OAP-075-L 系列）、门禁验证（go test / webui generate --check / vitest / Playwright dev+mock）、文档同步（模块 README、075 记录、impact）。