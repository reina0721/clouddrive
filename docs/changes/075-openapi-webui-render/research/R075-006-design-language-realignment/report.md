# R075-006 设计语言回归：提取业务能力，融入后台视觉

## 研究问题

用户明确拒绝 9536334 的 Apifox 外壳：openapi 模块当前的浅色自定义工作台（自定义资源树/标签条/命令面板/afx token 灰阶与主色）与 Community Go 后台（深色左侧导航、蓝色主调、圆角卡片、标准中后台表单/表格控件）严重脱节。要求：**提取 Apifox 的业务能力**（API 文档查看、在线调试 Try it out），用系统既有组件与流程呈现，**微改造**去除偏离主题的设计。

## 方法与范围

- 平台事实（代码）：`webui/src/ui/index.tsx`（PageHeader/PageSection/Surface/DataTable/Field/Button/InlineAlert/EmptyState/ConfirmDialog/Drawer/SelectField/SectionNav 等）、`webui/src/styles.css`（Shell/页面布局/form-panel/toolbar/card-grid/page-section 等平台类）；现有模块范式：IAM/Navigation 列表+DataTable+Drawer/ConfirmDialog、settings SectionNav、ops 页面模板。
- 9536334 现状：业务层（`openapi-data` 解析/请求构建、`run-store` 状态机、`highlight`、执行语义、深链）与 Apifox 外观层（afx token css、ApiTree/WorkspaceTabs/CommandPalette 自定义壳、OperationPane/ResponsePanel 的自定义样式）耦合在同一批组件。
- 用户要求是产品决策：后台一致性优先于工具类软件布局。

## 事实与推断

- 平台组件足以承载全部业务能力：接口列表（DataTable + 搜索 Field + tag SelectField）、详情（Drawer 弹层或页内折叠分区）、参数编辑（Field 行 + Switch 启停）、Body 编辑（平台 Textarea/Field）、发送（Button + pending）、响应展示（响应卡片：Chip 状态 + 文本/高亮 pre + 响应头折叠）、mock 禁用提示（InlineAlert）。
- 后台流程范式：**列表 → 详情/弹窗 → 表单 → 提交 → 反馈**。按此组织：单路由页面（静态路由契约限制不变，动态详情在页内状态/弹层），列表行操作「文档 / 调试」。
- 深链与 mock 与呈现无关，保留。
- “不要引入突兀第三方样式/主题”：删除 afx token 自定义系统与自定义壳层外观；模块 css 只保留各模块通用的业务 selector（与 iam/organization 模块 css 同类）；控件全部来自平台（HeroUI 底座经 SDK 透传，符合 068 的组件基座约定——上一轮「UI 组件依旧使用 HeroUI」延续成立，只是风格回归平台 token）。

## 结论

- 【重塑（平台组件呈现，业务能力保留）】openapi 模块从「Apifox 外壳工作台」改为「平台设计语言的标准后台模块」：
  - 页面：PageHeader + 说明 PageSection + 接口列表区（搜索 + tag 筛选 + DataTable：方法 Chip/路径/操作 ID/标签/操作），遵循现有模块模板；
  - 详情与调试：平台 Drawer（或页内展开）承载「文档 / 调试」两个分区（平台 Tabs 语义用 Button 分段或页内分区），参数 Field 行 + Switch、Body（JSON Textarea 样例+校验 / form-data 文件 / urlencoded）、Headers Field 行、Auth Field、发送 Button（pending）、响应卡片（状态、耗时、大小、JSON 高亮/原始、响应头折叠）；
  - 移除：afx token 灰阶/主色自定义体系、ApiTree/WorkspaceTabs/CommandPalette 的自定义外观、右侧响应栏布局（响应回归页面流/弹层内）；Cmd+K 全局搜索保留为平台 Modal 内的列表选择或去除（候选：保留为 Toolbar 内的标准按钮 + Modal）。
  - 保留并复用：`openapi-data`（解析/请求构建/form/bodyType）、`run-store`、`highlight`、执行语义（bearer 内存 token / session Cookie+CSRF / mock 禁用 / 20s 超时）、深链（`?op=&mode=`/`?model=`，弹层内同步）、快照链。
- 【微改造】组件级重构而非重写业务层：主要改动为新页面壳 + 平台组件替换 + css 清理；`openapi-data`/`run-store`/`highlight`/`api.ts` 只做必要适配。

## 适用与不适用场景

- 适用：Admin 内以标准后台语言呈现 API 文档与调试；复用现有模块流程与组件。
- 不适用：Apifox 工具类布局；自定义主题/第三方组件观感。

## 局限与剩余未知

- “完美融入”最终以用户对系统视觉对照为准（本会话无可视化对照能力，交付 Playwright 截图供比对）；Cmd+K 全局搜索是否保留为产品取舍（计划列出推荐：保留为平台 Modal，工作量小、能力完整）。

## 对当前任务的影响

- requirements/design/tasks 重写：R075-005 的 UI 结论被本记录取代（业务能力清单继续有效）；清理 9536334 的外观层，重构页面为平台组件呈现；保留业务层与能力清单。