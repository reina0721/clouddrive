# OpenAPI WebUI 模块

本模块承载 WebUI「API 文档」模块（`/openapi`）：**工作台式骨架的 API 文档与在线调试（R075-009）**，控件基座 HeroUI，呈现融入后台设计语言。

- 数据源：`webui/src/generated/openapi-spec.ts`（`webui generate` 从 `api/openapi.yaml` 生成的 JSON 快照，见 [075 变更记录](../../../../../docs/changes/075-openapi-webui-render/README.md)）；页面直接 import，mock 浏览零请求，`mock.ts` 为空路由表。
- 页面与路由：**单路由 `/openapi` 工作台**（`OpenAPIPage` 工作台壳）：
  - `ApiTree` 左资源区（Disclosure 递归接口树：分组/方法徽标叶子、顶部搜索、可折叠）；
  - `WorkspaceTabs` 顶部多标签（HeroUI Tabs 受控、关闭/横滑/激活高亮）；
  - `OperationWorkspace` + `RequestPane`（URL+发送 + Params/Body/Headers/Cookies/Auth 动态表单）+ `Resizer`（模块内窄可拖动分割线）+ `ResponsePane`（状态/耗时/大小/高亮 JSON）；
  - `CommandPalette`（Cmd+K 平台 Modal，选择后打开/激活标签）；`?op=&mode=` 深链。
- 逻辑：`openapi-data.ts` 解析与请求构建纯函数（`buildRequest`/`bodyTypeOptions`/`formFieldRows`/`executionParameters`/`buildApiTree`/`filterApiTree`）、`run-store.ts` 执行状态机、`highlight.ts` JSON 高亮（highlight.js）、`api.ts` 会话 CSRF 快照。
- 访问门槛：单路由绑定 `iam.session.read`（未登录跳 /login、菜单隐藏，mock 恒 allowed）。
- 页面候选键与 locale 覆盖由生成器校验；菜单/路由声明见 `binding.go`。