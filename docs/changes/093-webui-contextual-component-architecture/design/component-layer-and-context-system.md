# 组件分层与上下文系统

## 1. 分层与依赖

```text
HeroUI v3 / React Aria
  ↓
Behavior Primitive（交互、状态、焦点、键盘）
  ↓
Generic Component（稳定 anatomy、通用状态槽）
  ↓
Context Adapter / Variant / Pattern（场景密度、层级、组合）
  ↓
Business Composite（业务数据与动作结构）
  ↓
Page（编排、查询与路由）
```

- Primitive 不提供外部 margin、固定父宽度、页面 padding、Card 或业务文案。
- Generic Component 可以提供稳定 parts/slots，但不假设自己位于 Card、FilterBar 或 Table。
- Context Adapter 只能从封闭语义集合选择，不接受任意字符串和任意内部 selector。
- Business Composite 归模块所有，但只消费 SDK 的 Component/Pattern，不直连第三方。
- Page 不通过 CSS 改公共组件内部结构。

## 2. 公共契约方向

### 2.1 行为 Primitive

保留 Check、Switch、Toggle、Tabs、Disclosure、Menu、ListBox、SearchField 等 RAC/HeroUI
行为底座。必要时使用 compound slots 或 RAC component，不为视觉自由重新手写键盘行为。

### 2.2 通用 Component

通用层提供 TextControl、SearchControl、SelectControl、DateControl、Button、IconButton、
FieldFrame、Surface 等稳定 anatomy。控件只接收值、状态、事件和可访问名称；Label、Help、
Error 由 FieldFrame/完整字段组合负责。

现有 `Field`、`SelectField`、`DateField` 等应拆分为“无外部字段壳的 Control”与“完整
Form Field”，而不是让 FilterBar 给 `.form-field` 增加第二身份。现有公共名称是否保留由
迁移调用方和编译影响决定，但最终只保留一条契约，不提供兼容转发。

### 2.3 Context Adapter

采用有限场景，不导出万能 `context: string`：

| 场景 | 主要特征 | 典型入口 |
|---|---|---|
| form | 完整 Label/Description/Error，纵向节奏 | FormTextField、FormSelectField |
| filter | 紧凑、可扫描、与结果集合绑定 | FilterText、FilterPicker、DateRangeFilter |
| toolbar | 低外壳、动作层级明确 | ToolbarAction、ToolbarToggle |
| inline | 与句子/分页/表格行同高，不占完整字段宽度 | InlinePicker、RowAction |
| table | 低干扰、支持 selection/row state | TableSelection、TableAction |
| dialog | 受对话框宽度和 footer 约束 | DialogField、DialogActionGroup |
| workbench | 高密度、可伸缩、不浪费垂直空间 | WorkbenchSearch、WorkbenchTabs、WorkbenchField |

当两个场景只是视觉 variant 时使用判别联合；当 anatomy 或组合责任不同，使用窄 Adapter
或 Pattern，避免 `variant + size + density + surface + embedded` 的笛卡尔积 API。

## 3. 动作层级

Button 不再固定所有场景为 `size="md"`。公共语义至少区分：

- page primary：页面唯一主要动作；
- section primary：当前区块主要动作；
- secondary：普通次要动作；
- toolbar/inline/row：紧凑、低强调；
- icon：固定 hit target 与可访问名，图标尺寸由场景决定；
- toggle/selected：使用选择态语义，不伪装普通 Button；
- danger：只表达真实破坏动作，并保持确认流程。

业务页面不直接选择第三方 variant；SDK Adapter 将项目语义映射到 HeroUI/RAC。

## 4. 选择控件决策

| 任务 | 默认组件 |
|---|---|
| 2-4 个稳定、需要直接比较的互斥选项 | RadioGroup 或 SegmentedControl |
| 紧凑工具栏/分页的短选项 | InlinePicker/Menu Select |
| 多选项、需要弹层浏览 | Select/ComboBox |
| 需要搜索的大集合 | ComboBox |
| 完整表单，需 Label/Help/Error | FormSelectField |
| 二元启停 | Switch/Toggle，按是否立即生效决定 |

语言、主题、密度和 page-size 按此矩阵重新评估，不把“已使用 HeroUI Select”视为选型完成。

## 5. Token 模型

Token 分四层：

1. primitive：色值、space、radius、font、motion、size；
2. semantic：surface、border、focus、danger、disabled、selected；
3. context：form/filter/toolbar/inline/table/dialog/workbench 的 control height、gap、padding、
   emphasis 和 surface policy；
4. component-state：具体 anatomy 消费 context + semantic 后得到的 hover/focus/error/selected。

不允许页面直接使用 context token 拼成另一套组件。density factor 只改变声明支持的尺寸，
不能把所有场景同时乘成相同外观。圆角也按层级表达：page/container/control/overlay 可以不同，
但同一场景与状态必须稳定。

## 6. 样式与 API 边界

- 公共组件的 `className` 只允许作用于根布局钩子；内部 slot 使用受控 part API 或 Adapter。
- 模块 CSS 只能负责业务布局和内容特有表达，不覆盖 `.button/.input/.select/.card/.table` 等
  第三方或平台全局 anatomy。
- 禁止依赖 CSS 文件顺序修正早期规则；每个公共 selector 只有一个当前 authority。
- 禁止负 margin、`border: 0`、`box-shadow: none`、强权重选择器作为公共组件去壳协议。
  真正嵌入场景由组件结构决定，而不是渲染完整外壳后抵消。
