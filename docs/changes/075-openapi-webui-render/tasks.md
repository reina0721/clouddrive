# 075 openapi 模块：API 文档与在线调试（工作台式骨架）— 任务清单

> 依赖：研究门禁通过（R075-009 当前有效，取代 R075-007 多路由 UI 结论；R075-006/008 结论不变）。状态：**第八轮待确认**（用户要求工作台式骨架：左树 + 多标签 + 请求/响应上下分割，保留系统主题与组件）。

## 任务（第八轮，OAP-075-M 系列）

| ID | 任务 | 完成条件 |
| --- | --- | --- |
| OAP-075-M1 | binding.go 收敛单路由 `/openapi`（EntryID openapi.workspace + ViewOperationID "iam.session.read"）；删除多路由与 OpenAPILayout | `go vet`/`webui generate --check` 通过；registry 单路由 |
| OAP-075-M2 | `ApiTree.tsx`：Disclosure 递归接口树（分组/叶子 + MethodBadge + 搜索 Field + 折叠） | 渲染/搜索/展开收起断言 |
| OAP-075-M3 | `WorkspaceTabs.tsx`（模块内）：HeroUI Tabs 受控 + 关闭按钮 + 横滑 + 激活高亮（复用 .workspace-tab 语义类） | 生成/切换/关闭/深链恢复断言 |
| OAP-075-M4 | `RequestPane.tsx`：URL 行（方法 + 拼接 URL + 发送）+ 请求 Tabs（Params/Body/Headers/Cookies/Auth）动态表单 | 参数增删、Body JSON 校验/form 文件/urlencoded、Headers/Cookies 行断言 |
| OAP-075-M5 | `ResponsePane.tsx` + `Resizer.tsx`：占位 → 状态/耗时/大小/高亮/响应头；上下分割可拖动 + 键盘 | 发送断言（GET 会话/POST bearer）、mock 禁用、分割线操作断言 |
| OAP-075-M6 | `OpenAPIPage.tsx` 工作台壳 + 状态模型（树/标签/请求/分割）；`?op=&mode=` 深链；Cmd+K 适配 | 工作台流转/深链/mock 断言 |
| OAP-075-M7 | 清理与收敛：删除多路由页面（OpenAPIOverview/Tag/Operation/Models + OpenAPILayout），OpenAPIOperationPage 内容并入 RequestPane/ResponsePane；css 仅业务 selector；locales 增补 | `git grep -E "afx-|apifox"` 仅文档/记录命中；`rg -i swagger` 无残留 |
| OAP-075-M8 | 测试与文档：vitest（树/标签/请求/响应/分割线/深链/mock）、Playwright dev/mock 工作台流转 + 截图（075-workspace-*）、权威文档与 impact 更新 | 门禁全绿 + 文档提交 |
| OAP-075-M9 | 全量门禁与提交（单轨替换 32d3477 多路由结构，业务层保留） | 提交完成 |

## 任务（前六轮已完成，保留为历史证据）

| ID | 任务 | 完成条件 |
| --- | --- | --- |
| OAP-075-J1 | binding.go 改为 GroupLayout 多路由：4 个静态路由（overview/tags/operation/models）+ `openapi.layout` entry；菜单不变（book /openapi） | `go vet`/`webui generate --check` 通过；registry 含 4 路由 + 布局 entry |
| OAP-075-J2 | `OpenAPILayout.tsx`（布局 entry）：SectionNav 动态条目（总览/各 tag/模型）+ 内容区 children；active 由 pathname+query 推断 | 4 个路由共享布局，切换路由布局不卸载（vitest/Playwright） |
| OAP-075-J3 | `OpenAPIOverviewPage.tsx` 总览页：PageHeader + 契约信息 + 分类卡片（tag：名称/操作数/方法徽标）+ 模型入口卡片 + 空态 | 渲染/跳转断言；快照不可用兜底 |
| OAP-075-J4 | `OpenAPITagPage.tsx` 分类接口列表页：`?tag=` 定位；DataTable（方法/路径/操作 ID/操作 文档·调试）+ 页内搜索 + 空态/非法 tag | 过滤/跳转/空态断言 |
| OAP-075-J5 | `OpenAPIOperationPage.tsx` 接口文档/调试页：`?op=&mode=` 定位；文档分区（参数/身体示例/响应）+ 调试分区（参数行/Body JSON·form·urlencoded/Headers/Auth/发送/响应卡片），复用 OperationDrawer 内容区 | 文档渲染、参数编辑、JSON 校验、form 控件、发送（GET 会话 / POST bearer）断言 |
| OAP-075-J6 | `OpenAPIModelsPage.tsx` 模型页：`?model=` 定位；模型列表 + 选中模型属性表（复用 ModelPane） | 列表/定位/属性表断言 |
| OAP-075-J7 | 清理与收敛：删除 `OpenAPIPage.tsx` 单页壳；`OperationDrawer`/`ModelDrawer` 撤壳、内容并入页面；`CommandPalette` 选择后 navigate 到页面；css 仅业务 selector；locales 增补 | `git grep -E "afx-|apifox"` 仅文档/记录命中；`rg -i swagger` 无残留 |
| OAP-075-J8 | 测试与文档：vitest 按新页面重写（总览/分类/接口/模型/导航/深链/发送/mock）、Playwright dev/mock 层级流转 + 截图（075-hierarchy-*）、权威文档与 impact 更新 | 门禁全绿 + 文档提交 |
| OAP-075-J9 | 全量门禁与提交（单轨替换 72ba96f 单页堆叠结构，业务层保留） | 提交完成 |

## 状态记录

- 2026-08-25（第八轮）：用户要求重构为 Apifox 核心骨架（左资源树 + 顶部多标签 + 请求/响应上下分割），保留系统主题/布局/组件，不照搬 Apifox 外观；项目基座确认为 HeroUI v3（非 Element Plus/AntD）。研究 R075-009 完成（Tabs 受控/Disclosure 递归树/自研窄 Resizer；单路由工作台）。**已实施完成待提交**：M1 binding 单路由 + ViewOperationID 保留；M2 ApiTree（Disclosure 递归 + 搜索 + 折叠 + buildApiTree/filterApiTree 纯函数）；M3 WorkspaceTabs（HeroUI Tabs 受控 + 关闭/横滑/高亮）；M4 RequestPane（URL+发送 + Params/Body/Headers/Cookies/Auth 动态表单）；M5 ResponsePane + Resizer（可拖动分割 + 键盘）；M6 OpenAPIPage 工作台壳 + ?op=&mode= 深链 + Cmd+K；M7 清理（删 OpenAPILayout/Overview/Tag/Operation/Models/ModelPane/command-context，css 收敛，locales 增补 20 keys）；M8 测试与文档（vitest 144/144 含树/工作台 27 用例、Playwright dev/mock 22/22 含 075-workspace-* 截图、权威文档与 impact 更新）；M9 门禁（go test/vet、webui generate --check、typecheck/eslint/i18n/architecture/modules/build）。**提交 32d3477→待提交**。
- 2026-08-25（第七轮）：用户提出「openapi 页面不登录也能访问」。研究 R075-008 完成；**路由绑定 iam.session.read 已并入第八轮单路由实现**（未单独提交，避免中间态）。
- 2026-08-25（第六轮）：用户要求「请做层级分类，不要放到一个页面上」。研究 R075-007 完成，多路由实现 32d3477 提交（UI 结论被第八轮 R075-009 取代，业务能力继续有效）。
- 前五轮已提交：55ee70f（Swagger UI）→ 9ea2f13（平台组件）→ e4865ca（可测试工作台）→ 9536334（Apifox 外壳）→ 72ba96f（设计语言回归）。
- 范围外既有事实：`internal/module/settings/README.md` 缺失导致 docs-guard 报错（070–074 遗留）。