# 075 新增 openapi 模块：API 文档与在线调试（工作台式骨架）

状态：研究门禁通过（R075-001 … R075-009）。前六轮已提交（55ee70f → 9ea2f13 → e4865ca → 9536334 → 72ba96f → 32d3477）。**第八轮已确认并实施完成（待提交）**：工作台式骨架（左资源树 + 顶部多标签 + 请求/响应上下分割），对齐 Apifox 核心骨架、系统组件呈现。

## 背景

`api/openapi.yaml` 是当前公开 HTTP 契约产物（模块 Huma 代码声明唯一生成）。用户需要 Admin WebUI 内补齐 **API 文档查看与在线调试（Try it out）** 能力，并在第八轮明确要求：**百分之百复刻 Apifox 核心骨架与交互布局**（左资源树、顶部多标签、请求/响应上下分割工作台），但**保留现有主题/后台布局/字体/系统自带组件、不照搬 Apifox 颜色与外观**。

## 方案（摘要，R075-009）

- **工作台式骨架**：单路由 `/openapi` 工作台——`ApiTree`（Disclosure 递归接口树：分组/方法徽标叶子、顶部搜索、可折叠）→ `WorkspaceTabs`（HeroUI Tabs 受控多标签：关闭/横滑/激活高亮）→ `OperationWorkspace`（`RequestPane`：URL+发送 + Params/Body/Headers/Cookies/Auth 动态表单；`Resizer`：模块内窄可拖动分割线；`ResponsePane`：状态/耗时/大小/高亮 JSON）；
- **项目组件基座是 HeroUI v3（非 Element Plus/AntD）**：Tabs/Disclosure/Menu/Separator 复用；Tree 用 Disclosure 递归、Splitter 用模块内自研窄 Resizer（无成熟第三方引入）；宿主 `.workspace-tab` 视觉语义复用；
- **业务能力全部保留**：文档查看、Try it out（真实执行：bearer 内存 token、webuiSession Cookie+CSRF、mock 禁用）、深链 `?op=&mode=`、Cmd+K；访问门槛绑定 `iam.session.read`（未登录跳 /login）；
- **复用不重做**：`openapi-data`（含新增 `buildApiTree`/`filterApiTree` 树纯函数）/`run-store`/`highlight`/`api.ts`/快照链/图标 `book`/alias 全保留；
- 删除多路由页面（Overview/Tag/Operation/Models + OpenAPILayout），回归单路由工作台。

## 阅读顺序

1. [研究档案](research/README.md)：R075-001/003/004/005（已归档或 UI 结论被取代）、R075-002（快照链，有效）、R075-006（设计语言回归，有效）、R075-008（访问门槛，有效）、R075-009（工作台式骨架，当前有效）
2. [需求](requirements.md)、[设计](design.md)、[任务清单](tasks.md)：OAP-075-M1..M9（第八轮，已确认实施完成）

## 背景

`api/openapi.yaml` 是当前公开 HTTP 契约产物（模块 Huma 代码声明唯一生成）。用户要求 Admin WebUI 内提供**与 Apifox 完全一致**的 API 管理可视化平台（文档查看、在线调试等），像素级视觉还原、商业级 SaaS 前端：左侧资源树、顶部全局搜索/工具栏、多标签页（文档/调试）、右侧响应面板、参数表单自动构建（JSON/文件上传/Query）、JSON 响应高亮、加载动画/面包屑/状态码/响应时间可视化、深链路由。

## 方案（摘要，R075-005）

- `openapi` 模块呈现层重做为 **Apifox 复刻工作台**（正式取代 R075-004 的平台组件工作台约束，仅本模块）：模块内自绘设计 token（灰阶/主色/间距/方法色/状态色）+ 五区布局（顶部工具栏 + 左资源树 + 多标签工作台 + 接口详情（URL 栏 + 文档/调试双模式）+ 响应面板）；
- 参数表单由 OpenAPI schema 自动构建（Query/Path 动态表格、JSON 请求体、form-data 文件上传、urlencoded、Auth）；在线调试交互反馈（loading → 状态徽标/耗时/大小/JSON 高亮/响应头）；Cmd+K 搜索、面包屑、加载骨架、深链 `?op=&mode=`；
- **复用不重做**：契约快照链（R075-002）、openapi-data 解析/请求构建、执行器语义（bearer 内存 token / session Cookie+CSRF / mock 禁用）；JSON 高亮用成熟轻量库（候选 highlight.js，实施期核验）；
- 像素级一致以公开物料 + 作者产品知识还原第一版，以 Playwright 截图逐轮人工校准为验收路径（本会话无 Apifox 体验版可视化对照，如实记录）。

## 阅读顺序

1. [研究档案](research/README.md)：R075-001/003/004（已归档）、R075-002（快照链，有效）、R075-005（Apifox 形态拆解，当前有效）
2. [需求](requirements.md)、[设计](design.md)、[任务清单](tasks.md)：OAP-075-A1..A12

## 背景

`api/openapi.yaml` 是当前公开 HTTP 契约的产物，由 `go generate ./...` 从各模块 `binding/http` 的 Huma 代码声明（code-first）唯一生成，运行时未暴露可视化文档入口。用户要求 Admin WebUI 内提供 **Apifox 风格**：操作树导航 + 操作详情 + **真实请求执行** + 响应展示 + 模型浏览，视图组织清晰（不单页堆叠），页内组件全部使用当前 WebUI 组件体系。

## 方案（摘要）

- `openapi` 模块单路由 `/openapi` 承载工作台：左栏可搜索操作树（按 tag 分组）+ 主区（接口详情与执行面板 / 模型视图），`?view=&op=` search 参数深链；全部组件来自 `@webui/sdk/ui`；
- **可测试**：同源 fetch 执行器（`credentials: include`）——`bearerAuth` 注入内存 token、`webuiSession` 自动携带会话 Cookie 并对 mutation 附加 `Origin`+`X-CSRF-Token`（复用 `loadSession` 的 csrfToken）；响应呈现状态/耗时/头/JSON body；`mock` 演示构建仅浏览、执行禁用并有明确提示；
- 契约快照生成链（`webui generate` → `openapi-spec.ts` + `--check`）、模块声明、图标 `book`、`@webui/generated` alias、mock 空表保持不变；无成熟可嵌入第三方（hoppscotch 等为独立应用），执行器为模块内自建窄实现（R075-004）。

## 阅读顺序

1. [研究档案](research/README.md)：R075-001/R075-003（已归档）、R075-002（快照链，有效）、R075-004（工作台与执行语义，当前有效）
2. [需求](requirements.md)、[设计](design.md)、[任务清单](tasks.md)：OAP-075-A..E（已完成）+ OAP-075-W1..W7