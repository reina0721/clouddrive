# R075-009 工作台式骨架回归：树 + 多标签 + 上下分割

## 研究问题

用户第八轮要求把 openapi 模块重构为 **Apifox 核心骨架**（左资源树、顶部多标签、请求/响应上下分割工作台），并强调：**保留现有主题/后台布局/字体/系统自带组件**，**不照搬 Apifox 颜色与外观**，交互必须用「当前 Community Go 项目已有的 UI 组件（如 Element Plus 或 Ant Design 的 Menu, Tabs, Splitter 等）」实现。

需要回答：项目组件基座到底是什么？HeroUI 能提供哪些等价件？Tree 与可拖动 Splitter 是否有成熟件可复用？工作台骨架如何与静态路由契约、深链、mock、执行语义共存？

## 方法与范围

- 读取 `webui/node_modules/@heroui/react/dist/components/*/index.d.ts`：枚举 HeroUI v3 组件目录，逐个确认 Tabs/Disclosure/Menu/Separator/ListBox 的 API（受控态、children、变体）。
- 读取 `webui/src/ui/index.tsx`（@webui/sdk/ui 平台组件清单）与 `webui/src/styles.css`（宿主标签视觉 `.workspace-tabs/.workspace-tab/.tab-close`、`--shell-tabs-height`）。
- 读取 openapi 现状（binding.go、OpenAPILayout 与四个页面、openapi-data/run-store/highlight/api）确认可复用层。
- 检索仓库内是否存在 Splitter/拖拽分割线先例（grep resiz/splitter/pointer 无命中 → 无现成件）。

## 事实

- **组件基座**：项目 WebUI 基座是 **HeroUI v3（react-aria-components 底座）**，经 `@webui/sdk/ui` 透传平台组件；**没有 Element Plus / Ant Design**。用户「如 Element Plus 或 Ant Design 的 Menu, Tabs, Splitter」应解读为『成熟组件库的等价交互』，实现必须落在现有 HeroUI + 平台组件上（068 基座契约）。
- **HeroUI 可用件**：
  - `Tabs`：`Root/ListContainer/List/Tab/Panel/Indicator/Separator`，RAC 底座（`TabsRootProps extends ComponentPropsWithRef<typeof TabsPrimitive>`）→ **受控 `selectedKey`/`onSelectionChange` 原生支持**；`Tab` children 可自定义（可内嵌关闭按钮）；`TabListContainer` 可横向滚动。
  - `Disclosure`：`Root/Heading/Trigger/Content/Body/Indicator`，RAC 底座 → 受控 `isExpanded`/`onExpandedChange`；**递归渲染天然支持无限层级折叠树**。
  - `Menu`（含 Section/Item）、`Separator`（orientation/variant）、`ListBox`（含 Section/Item）。
  - **无 Tree、无 Splitter**。
- **平台视觉**：宿主工作台标签样式已在 styles.css（`.workspace-tabs` 44px、`.workspace-tab`、`.tab-dot`、`.tab-close`、横向滚动容器 `.workspace-tab-scroll`），模块顶部标签可直接复用同套语义类；平台 token（`--primary-soft`、`--border`、`--surface` 等）用于树选中/分割线。
- **现状（32d3477）**：多路由页面（总览/分类/接口/模型）共享 OpenAPILayout；数据层（openapi-data 解析与请求构建、run-store 状态机、highlight、api.ts CSRF、mock 空表、快照链、MethodBadge、CommandPalette）齐备；执行语义（fetch credentials、bearer 内存、webuiSession CSRF、20s 超时、mock 禁用）在 OpenAPIOperationPage。
- **路由契约**：`validPath` 静态路径、无 query 进 Path；动态选择走 URL query（`?op=&mode=` 已具备）。

## 推断

1. **骨架 = 单路由 /openapi 工作台**：树 + 多标签 + 上下分割都是模块内状态（不是多路由），替代 R075-007 的多路由页面；`?op=` 深链定位当前激活标签（现有深链语义延续）。
2. **左资源树**：`ApiTree` 用 HeroUI `Disclosure` 递归组装——分组节点 = 折叠 Disclosure（tag/模块分组），叶子 = 操作行（MethodBadge + 方法 + 路径 + 操作 ID）；顶部搜索 Field 过滤节点；分组支持无限层级（递归渲染任意嵌套）。
3. **顶部多标签**：HeroUI `Tabs` 受控 `selectedKey`；每个标签 = MethodBadge + `GET /path` 文本 + 关闭按钮（Tab children 自定义）；`TabListContainer` 横向滑动；复用 `.workspace-tab` 语义类保证与宿主标签视觉一致。
4. **主工作台（标签内上下分割）**：
   - 请求区：URL 拼接行（方法 Select/Chip + 完整 URL + 「发送」Button）；下方 `Tabs`（Params / Body / Headers / Cookies / Auth）——Params 动态表单行（参数名/值/类型/说明，可增删行，复用 executionParameters），Body（JSON Textarea 样例+校验 / form-data 文件 / urlencoded，复用 bodyTypeOptions/formFieldRows），Headers 行，Auth（bearer/session）；
   - 响应区：默认「点击发送按钮获取返回结果」占位；发送后状态 Chip + 耗时 + 大小 + 格式化 JSON（复用 run-store/assembleRunResult/highlight/formatBytes）;
   - 上下分割：模块内自研窄 `Resizer`（pointer events + flex-basis 百分比状态 + 平台 token 样式）——纯局部交互、无第三方可替代，符合 AGENTS.md 3.2 自研例外（成熟方案不存在；平台无 Splitter 组件）。
5. **复用不重做**：openapi-data / run-store / highlight / api.ts / mock / 快照链 / MethodBadge / CommandPalette（保留）全部沿用；仅重组呈现层与 binding 声明。

## 结论

- 【采用】单路由 `/openapi` 工作台：`ApiTree`（Disclosure 递归树 + 搜索）→ 点击生成/激活 `WorkspaceTabs`（HeroUI Tabs 受控，关闭+横滑+高亮）→ 标签内 `RequestPane`（URL+发送 + Params/Body/Headers/Cookies/Auth 动态表单）+ `Resizer`（自研窄分割）+ `ResponsePane`（状态/耗时/大小/高亮 JSON）。
- 【不采用】引入 Element Plus / AntD / 第三方 tree / splitter 库（违反 068 基座与依赖纪律；HeroUI + 平台组件足以承载）。
- 路由从 4 个静态页面收敛回 `/openapi` 单路由（工作台模块内状态）；`?op=&mode=` 深链延续；mock 浏览/执行禁用语义不变。

## 适用与不适用场景

- 适用：工作台式 API 调试（树导航 + 多操作标签 + 请求/响应分区），视觉沿用系统主题；大量操作的浏览与调试。
- 不适用：多页面层级浏览（R075-007 被取代）；在 mock 环境执行；无后端时的真实发送。

## 局限与剩余未知

- Disclosure 递归树在节点极多（数千操作）时需评估折叠/懒渲染；当前契约操作数十个，无压力。
- Resizer 为自研窄实现：需要可访问性（键盘 + aria-orientation）与最小高度约束；计划中包含基础键盘操作。
- 用户对「Element Plus / AntD」的表述与项目实际基座（HeroUI）存在差异：按 068 契约以 HeroUI + 平台组件实现等价交互，计划中明确说明。

## 对当前任务的影响

- requirements/design/tasks 第八轮重写：单路由工作台替代多路由页面；复用数据/执行层；新增 ApiTree/WorkspaceTabs(模块内)/RequestPane/ResponsePane/Resizer；`?op=` 深链延续；测试（vitest/Playwright）按工作台流转重写；binding 收敛回单路由。