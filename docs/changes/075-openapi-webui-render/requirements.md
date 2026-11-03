# 075 需求：API 文档与在线调试（工作台式骨架，第八轮）

> 第八轮（R075-009）：把模块重构为 **Apifox 核心骨架**（左资源树 + 顶部多标签 + 请求/响应上下分割工作台），**保留现有主题、后台布局、字体与系统自带组件**，不照搬 Apifox 颜色/外包装。前几轮的业务能力、执行语义、数据层、快照链、访问门槛结论继续有效；多路由页面结构（R075-007）被本轮工作台取代。

## 产品目标

`openapi` 模块呈现为**工作台式 API 调试台**（骨架对齐 Apifox，视觉 100% 平台设计语言）：左侧可折叠资源区（接口树 + 搜索）、顶部多标签（每个接口一个标签，可关闭/横滑/高亮）、主工作台强制上下分割（上半请求区：URL+方法+发送 + Params/Body/Headers/Cookies/Auth 动态表单；下半响应区：状态/耗时/大小/格式化 JSON），交互组件全部来自现有 HeroUI v3 + `@webui/sdk/ui` 平台组件。

## 范围（骨架重构层）

1. **左资源区（ApiTree）**：
   - 可折叠侧栏（模块内展开/收起按钮 + 宽度收缩）；
   - 顶部搜索 Field（过滤接口与分组）；
   - 接口树：分组节点（tag/模块）+ 叶子（方法徽标 + 方法 + 路径 + 操作 ID），**无限层级**（Disclosure 递归渲染），分组可展开/收起。
2. **顶部多标签（WorkspaceTabs 模块内）**：
   - 点击接口树叶子生成/激活标签（标题如 `GET /api/...`）；
   - 标签支持关闭、横向滑动、当前激活高亮（复用宿主 `.workspace-tab` 语义类与 HeroUI Tabs 受控 selectedKey）。
3. **主工作台（标签内上下分割）**：
   - **请求区**：URL 拼接行（方法 Chip + 完整 URL + 「发送」Button）→ 下方 Tabs（**Params / Body / Headers / Cookies / Auth**）：Params 动态表单行（参数名/值/类型/说明，可增删行）、Body（JSON Textarea 样例+校验 / form-data 含文件 / urlencoded）、Headers 行、Cookies 行、Auth（bearer 内存 token / session 说明）；
   - **响应区**：默认「点击发送按钮获取返回结果」；发送后状态 Chip + 耗时 + 大小 + 格式化 JSON（高亮/原始切换）+ 响应头折叠；
   - **上下分割线**：模块内自研窄 `Resizer`（可拖动，pointer events + flex-basis，平台 token 样式；键盘可操作）。
4. **业务能力与语义（全部保留）**：文档查看、Try it out 执行（bearer 内存 / webuiSession Cookie+CSRF / 20s 超时 / mock 禁用）、`?op=&mode=` 深链、Cmd+K、模型浏览（并入树或保留入口）。
5. **复用不重做**：`openapi-data`（解析/请求构建/form/bodyType/executionParameters）、`run-store`（状态机/响应组装）、`highlight`、`api.ts`、`mock.ts` 空表、快照链、图标 `book`、`@webui/generated` alias、`MethodBadge`、`CommandPalette`。

## 非目标（明确不做）

- 引入 Element Plus / Ant Design / 第三方 tree / splitter 库（项目基座是 HeroUI RAC，068 契约；R075-009 已确认等价交互可用现有件承载）；
- Apifox 颜色/外包装/自定义 token（R075-006 持续有效）；
- 路径参数路由、每动态项一个路由；
- 多路由页面结构（R075-007 被取代，回归单路由 /openapi 工作台）；
- 团队协作/Mock 服务/导入导出/代码生成；不引入新依赖。

## 验收标准

1. 左树：渲染分组与接口（方法徽标/路径/操作 ID）；搜索过滤；分组展开收起；侧栏可折叠。
2. 顶部标签：点击接口生成/激活标签（标题 `GET /path`）；关闭、横向滑动、激活高亮；刷新/深链恢复当前标签。
3. 请求区：URL 拼接正确（方法 + path + query 参数）；Params/Body/Headers/Cookies/Auth 五个 Tab 可用；Params 动态增删行；Body JSON 校验、form 文件、urlencoded；Headers/Cookies 行增删。
4. 响应区：默认占位；发送后状态/耗时/大小/高亮 body/响应头正确；错误如实呈现；mock 环境发送禁用并提示。
5. 上下分割：可拖动调整上下比例；键盘可操作；最小高度约束。
6. 深链：`?op=&mode=` 打开对应标签与模式；刷新恢复。
7. 门禁：Go `go test ./...`/`go vet`、`webui generate --check`、WebUI `generate:check/typecheck/lint/lint:modules/test/build`、`pnpm e2e -- --workers=1` 全绿；`git grep -i swagger` 无残留；`git grep -E "afx-|apifox"` 仅文档/记录命中。
8. 访问门槛（R075-008）：单路由仍绑定 `iam.session.read`（未登录跳 /login，mock 恒可浏览）。
9. 文档与 documentation-impact.yaml 覆盖本轮；多路由实现单轨替换（业务层与能力保留）。