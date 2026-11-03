# 075 设计：API 文档与在线调试（工作台式骨架，第八轮）

支撑研究：R075-002（快照链，不变）、R075-004（执行语义与纯函数层，复用）、R075-005（Apifox 业务能力清单，功能参考）、R075-006（设计语言回归，视觉基线）、R075-008（访问门槛，单路由仍绑定）、R075-009（工作台式骨架，当前有效）。

## 设计前提（R075-009）

- **项目组件基座是 HeroUI v3（RAC 底座）+ `@webui/sdk/ui` 平台组件，不是 Element Plus/AntD**；用户「如 Element Plus 或 Ant Design 的 Menu, Tabs, Splitter」按『成熟组件库等价交互』落在现有 HeroUI + 平台组件上实现。
- HeroUI 提供：`Tabs`（受控 `selectedKey`/`onSelectionChange`，Tab children 可自定义）、`Disclosure`（受控 `isExpanded`，递归无限树）、`Menu`、`Separator`、`ListBox`；**无 Tree、无 Splitter** → 树用 Disclosure 递归，分割线用模块内自研窄 Resizer。
- 平台宿主已有 `.workspace-tabs/.workspace-tab/.tab-dot/.tab-close` 标签视觉与 `--shell-tabs-height`，模块顶部标签直接复用同套语义类。
- 数据/执行层不重写：`openapi-data`（解析/请求构建/form/bodyType/executionParameters）、`run-store`、`highlight`、`api.ts`、`mock.ts`、快照链、MethodBadge、CommandPalette。

## 路由与模块结构

```text
模块声明（binding.go，收敛回单路由）
Routes：
  openapi.overview   /openapi   （EntryID openapi.workspace，ViewOperationID "iam.session.read"）
Entries：
  openapi.workspace  OpenAPIPage.tsx（工作台壳：ApiTree + WorkspaceTabs + RequestPane/ResponsePane/Resizer）
Navigation：openapi.docs（icon book，Order 130，落地 /openapi）
```

- 删除多路由（overview/tags/operation/models）与 OpenAPILayout；工作台为单路由模块内状态：树展开集合、标签集合、当前激活标签、请求 Tab、上下比例、各标签编辑状态。
- 深链：`?op=<id>&mode=<docs|debug>` 定位当前激活标签（replaceState 同步，刷新恢复）；其余标签为会话内状态（不序列化）。

## 工作台布局与组件映射

```text
OpenAPIPage（工作台壳，全高 flex 列）
├─ 工作台行（flex row）
│  ├─ ApiTree（左资源区，可折叠）
│  │  ├─ 顶部：折叠按钮 + 搜索 Field
│  │  └─ 树：Disclosure 递归（分组 = tag/模块，叶子 = 操作行 MethodBadge + method + path + id）
│  └─ 主区（flex column，min-width 0）
│     ├─ WorkspaceTabs（HeroUI Tabs 受控 selectedKey；Tab = 关闭按钮 + MethodBadge + GET /path；横滑）
│     └─ 激活标签内容（flex column，上下分割）
│        ├─ RequestPane（flex 1，overflow auto）
│        │  ├─ URL 行：方法 Chip + 完整 URL（拼接 path + query）+ 「发送」Button（pending）
│        │  └─ 请求 Tabs（Params / Body / Headers / Cookies / Auth）
│        │     ├─ Params：动态表单行（参数名/值/类型/说明 + 添加行 + 删除行；query/path 分离标记；复用 executionParameters）
│        │     ├─ Body：类型选择（JSON/form-data/urlencoded 按契约）+ JSON Textarea（样例+校验）/ form 行（Text/文件）/ urlencoded 行
│        │     ├─ Headers：动态行（名称/值 + 增删）
│        │     ├─ Cookies：动态行（名称/值 + 增删；浏览器自动携带说明）
│        │     └─ Auth：bearer password Field / session 说明
│        └─ Resizer（自研窄分割线：pointer events + flex-basis 比例 + aria-orientation + 键盘上下调整 + 最小高度）
│        └─ ResponsePane（flex 1，overflow auto）
│           ├─ 默认占位「点击发送按钮获取返回结果」
│           └─ 响应：状态 Chip（2xx/3xx/4xx 色）+ 耗时 + 大小 + 高亮/原始切换 + 响应头折叠 + 错误如实呈现
```

## 状态模型（模块内）

```text
ApiTree：expandedGroupIDs（Set），query（string）
WorkspaceTabs：tabs（{id: opRow.id, row}[]），activeId（?op= 或首个）
RequestPane（每标签一份，key=row.id 重置）：mode docs|debug、parameters、bodyType/bodyText/formRows/files、headersRows、cookiesRows、bearerToken、runState
Resizer：ratio（0..1，flex-basis %）
```

- 标签编辑状态挂在标签内容组件上（`key=row.id`），切换标签不丢失；关闭标签后激活相邻标签。
- Cmd+K（CommandPalette 保留）：选择后 `?op=` 打开/激活标签。

## 文件影响

| 区域 | 文件 |
| --- | --- |
| Go 声明 | `internal/module/openapi/binding/webui/binding.go`（收敛单路由 + ViewOperationID 保留） |
| 新增 | `ApiTree.tsx`、`WorkspaceTabs.tsx`（模块内标签）、`RequestPane.tsx`（请求区 + 请求 Tabs + 动态表单行）、`ResponsePane.tsx`、`Resizer.tsx`、`OpenAPIPage.tsx`（工作台壳，取代旧总览页） |
| 重构/复用 | `OpenAPIOperationPage.tsx` 内容并入 `RequestPane`/`ResponsePane`（执行逻辑复用）；`ModelPane` 并入树或保留入口；`CommandPalette` 适配导航到工作台标签 |
| 删除 | `OpenAPILayout.tsx`、`OpenAPIOverviewPage.tsx`、`OpenAPITagPage.tsx`、`OpenAPIOperationPage.tsx`、`OpenAPIModelsPage.tsx`（多路由页面） |
| 保留 | `openapi-data.ts`(+test)、`run-store.ts`(+test)、`highlight.ts`(+test)、`api.ts`、`mock.ts`、`MethodBadge.tsx`、locales（增补树/标签/请求区/响应区 key）、`@webui/generated` alias 等 |
| 测试 | vitest（树/标签/请求表单/发送/响应/mock 禁用/深链/分割线）、Playwright dev/mock（工作台流转 + 截图 075-workspace-*） |
| 文档 | webui/README、docs/development/webui.md、api/README、module README、075 记录、documentation-impact.yaml |

## 失败语义与降级

- 快照不可用 → 工作台 EmptyState/InlineAlert 兜底；`?op=` 非法 → 空标签 + 提示；
- Body JSON 非法 → 阻止发送并提示；网络/HTTP 错误 → 响应区如实呈现（Problem JSON 优先）；
- CSRF 会话过期 → 会话快照失败如实提示；mock → 发送禁用 + InlineAlert；
- 分割线拖动越界 → 最小/最大比例约束；高亮失败 → 纯文本 pre。

## 验证与验收

- Playwright dev/mock 双 project：树渲染/搜索/折叠；点击生成标签（GET /path 标题）→ 关闭/切换；请求区 Params 增删行、Body JSON 校验、form 文件、Headers/Cookies；发送（拦截 GET 会话 → 响应 200 + csrf-token；POST bearer 头断言）；响应区状态/耗时/大小/高亮；mock 禁用；深链（?op=&mode=）；分割线拖动；截图（075-workspace-*）。
- 视觉对照：宿主标签样式复用 `.workspace-tab` 语义类；树/表单/响应卡片全部平台 token（无自定义主题）。