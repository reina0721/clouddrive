# 页面模式与视觉所有权

## 1. 单一视觉所有者规则

每个可见区域在 DOM 上标记 pattern、layer 和 surface owner。一个区域只能由一个组件负责
背景、边框、圆角、阴影和 outer padding；子组件只负责内容 anatomy 和必要分隔线。

允许的嵌套必须有不同语义，例如 page background 中的 list surface、list surface 中的
selected row；不允许 PageSection Card 中再放 DataCard Card 或给 Table 另加同级完整 Card。

## 2. 页面骨架

### 2.1 PageFrame 与 PageHeader

PageFrame 只拥有内容宽度和页面流；PageHeader 只拥有标题、说明和 page actions，不创建
业务 Card。workbench 可以选择无最大宽度并压缩标题区，但仍使用同一页面层级语义。

### 2.2 PageSection

PageSection 不再无条件等于 Card。它应有至少两种明确 anatomy：

- section：页面文档分区，只提供标题和节奏，不创建 Surface；
- panel：确需独立围合时拥有一个 Surface。

调用方必须按内容关系选择，默认不再把所有区块包成 Card。旧 `appearance="bare"` 一类
兼容开关不长期保留；迁移后由明确组件或判别联合表达。

## 3. ResourceIndex / DataTable / Pagination

ResourceIndex 升级为列表模式 owner：

```text
ListSurface
  ├─ ListHeader / summary（可选）
  ├─ FilterRegion
  ├─ ActiveFilters（可选）
  ├─ BulkRegion（按 selection 出现）
  ├─ DataRegion（Table/List/Empty/Error）
  └─ ListFooter（Pagination + inline page size）
```

- ListSurface 有且只有一层边框/圆角。
- DataTable 嵌入 ListSurface 时不再自带第二外壳；独立使用时由明确 standalone adapter 提供。
- EmptyState 位于 DataRegion，不再渲染成 Card-in-Card。
- Pagination 和 page-size 作为 footer anatomy；分隔线可以存在，但不是另一张卡。
- BulkActionBar 是状态区域，不通过独立重 Surface 抢夺列表层级。

账户、角色、权限、会话、API Token、审计和能力列表同批迁移，避免继续存在 PageSection、
DataCard 和 ResourceIndex 三套列表壳。

## 4. FilterBar 与 Form

FilterBar 只消费 filter adapter。文本、日期、日期时间、Select 都共享 filter label layout、
高度档和状态语义，但不共享完整 form wrapper。复杂筛选超过单行承载能力时使用
FilterPanel/advanced filter pattern，不把九个完整 FormField 横向排列。

Form 使用 FieldFrame 统一 Label/Description/Helper/Error；Control 不重复标签。表单网格、
宽度和 actions 由 Form pattern 决定，不通过 Control className 设置 flex 或 max-width。

## 5. Organization split workspace

部门和分配页面使用业务 `DirectoryWorkspace` Composite：目录栏拥有自己的 Pane anatomy，
搜索使用 embedded directory search，详情 Inspector 和编辑区按信息层级分区。外层
PageSection 使用 section 形态，不再与三栏 Pane 重复围合。空态只占目标 Pane 内容区。

## 6. Settings

SettingsLayout 负责页内导航与内容宽度。单个设置页优先使用 setting rows/choice groups，
不为每一组选项新增完整 Card。语言等少量稳定选项使用直接可见 Radio/Segmented 模式；
Appearance 的颜色预设、密度、动效按任务分别使用 choice、segmented 或 picker，不统一成
重型 Select。迁移时删除旧 `.setting-option` 与新 RAC 结构之间的失效双轨。

## 7. OpenAPI workbench

OpenAPI 使用专用 `WorkbenchShell` Pattern，而不是通用 PageSection/DataCard：

- WorkbenchShell 是唯一外壳；ResourcePane、TabStrip、RequestPane、ResponsePane 只提供
  pane 背景/分隔和内部滚动。
- tree search 使用 WorkbenchSearch；operation tabs 使用 WorkbenchTabs；请求字段使用
  compact workbench field，但行为仍来自统一 Primitive。
- 桌面资源树和请求/响应分区不被通用 form/card padding 吞噬；390px 保持现有三段单面板。
- CommandPalette 使用 Dialog + Search + ListBox 的组合，但视觉由 command pattern 拥有，
  不是把完整 FormField 放进 Modal。

## 8. TailAdmin 参考边界

只吸收稳定 shell、有限组件变体、表单/表格/卡片分工和页面任务优先的规律。不得复制其
源码、品牌、颜色或为追求模板相似而改变本项目模块边界、交互底座和业务工作流。
