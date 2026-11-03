# OpenAPI 模块

本模块承载 WebUI「API 文档」模块（`/openapi`）：**API 文档查看 + 在线调试（Try it out）**，基于公开 HTTP 契约 `api/openapi.yaml`，呈现完全融入 Community Go 后台设计语言（R075-006/009）。

- 纯 WebUI 模块：无后端 service/repo/migration/operation；契约快照是构建期生成物（`webui generate` 输出 `webui/src/generated/openapi-spec.ts`），三态数据源环境（server-hosted / separated / mock）下浏览一致、mock 零请求。
- 呈现（工作台式骨架，R075-009）：单路由 `/openapi` 承载工作台——**左资源树**（`ApiTree`，Disclosure 递归接口树，分组/方法徽标叶子，顶部搜索，可折叠）+ **顶部多标签**（`WorkspaceTabs`，HeroUI Tabs 受控，关闭/横滑/激活高亮）+ **主工作台上下分割**（`RequestPane`：URL+发送+ Params/Body/Headers/Cookies/Auth 动态表单；`Resizer`：模块内窄可拖动分割线；`ResponsePane`：状态/耗时/大小/高亮 JSON）。对齐 Apifox 核心骨架，视觉/组件 100% 平台（HeroUI v3 + `@webui/sdk/ui`）。
- 能力（提取自 Apifox）：文档查看（说明/参数表/请求体与返回示例 JSON 高亮/响应表）；在线调试（参数 Field 行、Body JSON/form-文件/urlencoded、Headers、Cookies、Auth、发送）；执行语义同源 fetch（bearer 内存 token、webuiSession Cookie + CSRF、mock 禁用）；深链 `?op=&mode=`；Cmd+K 快速跳转（CommandPalette）。
- 路由与菜单：单路由 `/openapi` + `openapi.docs` 顶级菜单项；**访问门槛**绑定 `iam.session.read`（未登录跳 /login、菜单隐藏，mock 恒 allowed，R075-008）；接入步骤遵循模块 WebUI 四步（Binding/locale/mock/CSS + 生成链），详见 [WebUI 开发指南](../../../docs/development/webui.md)。