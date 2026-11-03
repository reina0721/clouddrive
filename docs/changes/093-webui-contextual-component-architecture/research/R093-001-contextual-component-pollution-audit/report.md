# R093-001 上下文化组件污染与视觉责任审计

## 1. 研究问题

092 已把通用交互收敛到 HeroUI v3 / React Aria 和 `@webui/sdk/ui`，为什么用户提供的
部门、审计、API Token、角色、账户、语言和 OpenAPI 页面仍呈现双边框、重复圆角、
过重 Surface、控件比例失衡与工作台层级退化？下一步应继续统一默认外观、回退页面
自定义，还是在单轨实现之上建立受控场景层？

## 2. 方法、范围与证据限制

本次完成了以下只读核对：

1. 逐张检查用户提供的七张截图，不把任一截图当成唯一问题页。
2. 复用并刷新 090 至 092 的研究结论，核对当前 HEAD、提交历史和脏工作区。
3. 追踪 `forms.tsx`、`layout.tsx`、`patterns.tsx`、`primitives.tsx`、`data.tsx`、
   `index.tsx`、`styles.css` 到 IAM、Organization、Settings、Auth 和 OpenAPI 页面。
4. 核对已安装的 HeroUI 组件 CSS、RAC 组合能力，以及当前 E2E 路由和视觉矩阵。
5. 复核 HeroUI、React Aria 和 TailAdmin 官方主源。
6. 只读访问当前监听在 `127.0.0.1:8080` 的服务；服务跳转到 `/login`，未登录状态
   无法进入目标业务页。本轮未启动新服务、未写入登录信息，也未把该服务状态冒充为
   目标页面验收。运行态问题证据以用户七张截图为准。

当前工作区已有 `docs/changes/README.md` 修改和两个文档删除，均属于用户变更；本研究
不修改、不暂存这些路径。

## 3. 当前事实

### 3.1 092 已解决的是交互来源，不是视觉所有权

- 当前业务模块没有直接导入 HeroUI/RAC；第三方交互集中在 `webui/src/ui`。
- `Field`、`SearchInput`、`FilterSelect`、`DataTable`、`RadioGroup`、`Tabs`、
  `Disclosure` 等已经使用 HeroUI/RAC 底座。
- architecture lint 和 fixture 已阻止页面重新引入原生交互标签、手写复合 role 和
  第三方直连。

这些结论有效，不能因为视觉问题而恢复页面自研输入框、按钮或键盘状态机。

### 3.2 公共组件同时承担过多层职责

源码显示多个公共组件同时持有行为、anatomy、视觉外壳和父布局：

- `Field`、`NumberField`、`DateField`、`TextAreaField`、`SelectField` 都自行创建
  `.form-field`、Label 和完整控件；`FilterBar` 又把它们嵌入 `.filter-field`。
- `DateField`/`DateTimeField` 接收 `className="filter-field"` 时形成
  `.form-field.filter-field`，两个场景职责落在同一 DOM 节点。
- `SearchInput` 外层自行绘制搜索图标和边框类，内部又渲染完整 HeroUI
  `SearchField.Group/Input/ClearButton`，存在两套 anatomy 同时参与视觉的条件。
- `Button` 固定映射为 HeroUI `size="md"`；`IconButton` 固定 `size="sm"`；页面只能用
  任意 `className` 再改尺寸、边框和 padding，导致上下文规则散落。
- `PageSection` 无条件渲染 HeroUI `Card`，`DataCard` 也渲染完整 Card；它们内部再接收
  `ResourceIndex`、`DataTable`、筛选区、分页和业务 Pane，而这些子组件也拥有边框或
  Surface。

因此“用同一个组件”在当前实现中常常等于“把同一个完整外壳嵌入不同父级”，而不是
复用行为能力。

### 3.3 CSS 正在充当隐式适配器

`webui/src/styles.css` 同时保留早期规则和 090 后置覆盖：

- `.filter-bar` 有三处顶级定义，`.form-field`、`.surface`、`.data-table-wrap`、
  `.data-toolbar` 等存在重复定义。
- 早期 `.surface` 提供 shadow/large radius，后置规则又统一改为无阴影和中圆角。
- `.data-table-wrap` 自己有边框/圆角；当它位于 `.data-card` 内时，再用负 margin、
  `border-inline: 0`、`border-radius: 0` 抵消父子重复外壳。
- `.pagination-size` 先被写成完整 bordered field，又作为 HeroUI `FilterSelect` 的
  `className` 传入，页面尺寸和组件形态耦合。
- OpenAPI 模块对统一 Button、Tabs、Field 继续声明 padding、border、background、
  radius 和 width；Organization 模块的 `selectPane`、`detailPane`、`editPane` 又各自
  创建完整 Surface。
- Settings CSS 仍保留旧 `.setting-option`/`aria-checked` 视觉规则，而当前页面已经
  改用 `.rac-radio-group/.rac-radio`，说明迁移后存在失效选择器和视觉契约漂移。

这些规则不是单个 CSS bug，而是缺少正式场景层后，用后置选择器承担适配职责的结果。

### 3.4 七张截图呈现的是同一类系统问题

| 截图 | 可见症状 | 结构性原因 |
|---|---|---|
| OpenAPI | 左树、标签、主工作区层级退化，大面积空白，控件比例失衡 | 专用工作台被通用完整控件和模块 CSS 双重塑形，缺少 workbench adapter |
| 部门 | 搜索框双层边界；目录 Pane、PageSection、详情/编辑卡重复围合 | PageSection Card + split Pane Surface + 成品 SearchField 叠加 |
| 审计 | 文本、Select、datetime 高度和标签节奏不一致，筛选行过重 | FilterBar 将完整 form field 当作 compact filter 使用 |
| API Token | PageSection、DataTable、批量条、分页和 page-size 形成多层框 | 列表模式没有唯一 Surface owner，分页 Select 选错视觉上下文 |
| 角色 | 全宽搜索、Table 和分页分别形成完整外壳 | ResourceIndex 只有顺序，没有统一列表 Surface anatomy |
| 账户 | 搜索图标/输入双边界，筛选控件和表格/分页层层成框 | SearchInput 双 anatomy + FilterBar/DataTable/PageSection 多 owner |
| 语言 | 两项简单选择被渲染成重型弹出 Select | 交互来源虽统一，但组件选择与任务频率、选项规模不匹配 |

这些截图来自不同模块，证明问题不能以“修部门页 CSS”或“调一个 Select 的圆角”处理。

### 3.5 当前 Token 表达“统一尺寸”，不能完整表达“上下文层级”

当前已有 `control-height-sm/md/lg`、统一 `control-radius`、`field-min-height`、
`card-padding-*`、`filter-select-width` 和 density factor。这些 token 能控制尺度，却没有
显式表达：

- 控件处于 form、filter、toolbar、inline、table、dialog 还是 workbench；
- 当前节点是否拥有 Surface，或只是嵌入既有 Surface；
- strong/quiet/subtle 的视觉层级；
- row action、page primary action、destructive action 的强调关系；
- compact 是页面密度还是特定模式的局部密度。

结果是所有场景共享一个成品默认值，再靠选择器覆盖。

## 4. 外部主源复核

### 4.1 HeroUI v3

HeroUI v3 官方明确把“行为实现”和 `@heroui/styles` 分开，compound component 的每个
slot 可以移动、替换或移除，也支持 headless 使用。这证明保留 HeroUI/RAC 行为单轨并不
要求所有场景使用 HeroUI 的完整默认 anatomy 或同一视觉外壳。当前项目已经安装的样式
源码也分别提供 Button、Input、Select、Card、Table 和 Pagination 的多种 variant。

### 4.2 React Aria Components

RAC 官方将自身定义为无样式、可组合的可访问组件，状态通过 data attribute 暴露；需要
更强控制时可以下沉到 hooks。它适合承担 Primitive 和通用 anatomy 的交互层，而不应被
误解为要求全站共享一个视觉成品。

### 4.3 TailAdmin

TailAdmin 官方仓库和文档提供 Card、Form、Table、Button、Dropdown 等独立组件与页面
组合。可借鉴的是：稳定页面骨架、明确组件目录、有限变体和按页面任务组合；不能把它
简化成“所有输入、下拉和表格必须长得完全一样”。本项目需保留自己的 HeroUI/RAC、
模块边界和可访问性契约，不复制 TailAdmin 代码或品牌视觉。

## 5. 推断与方案比较

### 5.1 继续统一全局默认外观

优点是短期改动少；缺点是每次全局修改都会跨 Form、Filter、Table、Dialog、Workspace
扩散，并继续增加后置覆盖。七张截图已经证明该路径不可持续，结论为退役。

### 5.2 允许页面自由 className/CSS 覆盖

可以快速修复单页，却会恢复 091 前“每个模块各做各的”，无法保证行为、焦点、状态和
主题一致。结论为拒绝。

### 5.3 保留行为单轨，新增受控场景层

Primitive 只负责交互和状态，通用 Component 只负责稳定 anatomy，场景 Adapter/Pattern
负责视觉层级、局部密度和组合，业务 Composite 负责业务结构。每个可见外壳只有一个
owner，页面只选语义场景。该路径同时满足 092 的单轨约束和本次上下文化目标，结论为
采用。

## 6. 研究结论

1. 保留 HeroUI/RAC 依赖、可访问交互、统一 UI 导出和页面禁止直连的单轨架构。
2. 退役“同类控件在所有上下文必须同高、同圆角、同外观”的视觉规则；一致性改为
   “同一场景内一致、跨场景有受控差异、状态语义一致”。
3. 新增正式场景层，至少覆盖 page/form/filter/toolbar/inline/table/dialog/workbench；
   不允许页面传任意 context 字符串或通过 className 改内部 anatomy。
4. FormField 拥有 Label/Help/Error 和字段布局；Control 不拥有外部 margin、父宽度或
   页面网格。Filter 控件不能复用完整 FormField 外壳。
5. Card、Table、Filter、Pagination、Workspace 必须通过页面模式确定唯一 Surface owner；
   “子组件负 margin 去壳”不是长期契约。
6. 组件选择先按任务决定：少量互斥项使用 Radio/Segmented，紧凑行内选择使用 compact
   picker/menu，完整 Select 留给需要标签、帮助、错误的表单。
7. 093 是架构和迁移任务，不是一次全局换肤；必须按模式垂直迁移、删除旧选择器并用
   DOM 结构与视觉矩阵证明没有新旧双轨。

## 7. 适用、不适用与剩余未知

适用于宿主、业务模块、设置和 OpenAPI 的通用交互与页面模式。后端协议、业务权限、数据
语义和独立 frontend 不在范围内。

实施前无需重新做全仓研究；只需按 metadata 的刷新触发器做增量漂移检查。由于当前
运行服务需要登录，本研究没有把最新 HEAD 的目标页面重新截图；实施验证必须使用受控
mock E2E 生成新的全页面基线，并由人工逐图复核，而不能只依赖几何断言或单测。
