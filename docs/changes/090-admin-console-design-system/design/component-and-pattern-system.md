# Component System 与 Interaction Patterns

## 1. 组件分层

### Foundation primitives

由 HeroUI v3/React Aria 提供可访问行为，项目只添加稳定 variant、Token 映射和测试入口：Button、IconButton、Input、Select、Checkbox、Switch、Tabs、Menu、Tooltip、Dialog、Drawer、Toast、Table、Pagination、Skeleton。

### Semantic components

跨业务但含项目语义：StatusBadge、RiskIndicator、EntityIdentity、Timestamp、MetricValue、PermissionGate、InlineError、EmptyState、QueryState、DestructiveConfirm、PartialFailureSummary。

### Functional patterns

包含状态与交互编排，是主要复用层：ResourceIndex、EntityDetail、SettingsForm、BatchOperation、DashboardSection、WorkbenchPanel。

### Module adapters

模块只提供列、字段、查询 schema、权限、状态映射和动作定义，例如 AccountResourceDefinition。它不能重新定义 Toolbar、Table loading、Dialog 或页面宽度。

## 2. ResourceIndex

```text
ResourceHeader: title + count/health + primary action
QueryToolbar: search + primary filters + more filters + view controls
ActiveFilters: removable chips + clear all
DataView: DataGrid or RecordList
SelectionBar: selected count + allowed batch actions
Footer: pagination/cursor + density/result range
Detail route/drawer: selected entity context
```

核心契约：

- 查询状态经 schema 序列化到 URL；输入状态与提交查询状态分离。
- 初次 loading 使用结构匹配 Skeleton；后台 fetching 保留数据并显示轻提示。
- Table 列定义包含 priority、alignment、sort、responsive、sensitive、cell renderer。
- 选中跨页是否保留必须由模式显式配置；默认翻页清除，避免误操作。
- 行点击只在整行确实代表单一主动作时启用；交互控件不嵌套冲突。
- 数据量达到测量阈值后才开启虚拟化；开启时保持键盘和读屏语义。

## 3. QueryToolbar 与筛选器

- 单一全文搜索在左，最常用 1—3 个筛选紧随；低频条件进入 FilterPopover/Drawer。
- 主操作在右；Export 属于次要动作，不与 Create 同权重。
- 活动筛选以 chips 显示在工具条下方；结果数量靠近数据而非散落标题区。
- 搜索提交 debounce 目标 250—350ms，但输入本身实时响应；Enter 可立即提交。
- 筛选变化使页码回到首项，排序/过滤的 URL 更新应避免污染浏览历史。

## 4. DataGrid

### 基础行为

支持服务端排序、选择、分页/游标、loading/empty/error、列优先级和行操作。数字右对齐，时间采用一致时区/相对时间策略，身份列可进入详情。

### 响应式

- wide：完整列，可选 sticky identity/action；
- medium：隐藏低优先级列并提供行展开；
- compact：转成 RecordList，保留身份、状态、关键元数据和主操作；
- 只有专业 workbench 的宽数据才允许内部横向滚动，并提供固定上下文列。

### 键盘

普通语义表格保持浏览模式；只有真正需要单元格导航/编辑时采用 ARIA Grid，并实现完整方向键、Home/End、焦点与选择公告。不得为了样式统一把所有 Table 声明为 Grid。

## 5. EntityDetail

详情页由以下区域组成：

- EntityHeader：名称/标识、状态、风险、最近更新、主/次操作；
- SummaryFacts：少量高价值事实，不列出所有字段；
- Tabs：Overview、Access/Relations、Activity、Configuration，按实体适用性出现；
- RelatedPanels：关联资源摘要与跳转；
- DangerZone：归档、吊销、重置等不可逆或高影响动作。

Drawer 版本只提供摘要和快捷操作，并始终有“打开完整详情”入口。复杂编辑不塞入详情 Drawer。

## 6. Forms 与 Settings

`FormPage` 负责标题、说明、提交状态和返回；`FormSection` 按业务语义组织字段；`StickyActionBar` 显示 dirty、保存、取消和冲突状态。

- 服务端字段错误映射到具体控件，表单级错误置于 ActionBar 上方；
- dependent fields 在禁用时说明原因，不静默消失；
- destructive setting 独立分区；
- 保存中保持页面内容，避免全页 Skeleton；
- 成功后根据任务语义返回详情、保持页面或创建下一项，不统一强制跳转。

## 7. Feedback matrix

| 场景 | 表达 |
| --- | --- |
| 初次加载 | 与目标结构匹配的 Skeleton |
| 后台刷新 | 保留内容，工具条局部 progress |
| 真空数据 | 解释此资源用途和首个允许动作 |
| 无匹配 | 显示查询摘要和清除筛选 |
| 无权限 | 说明缺少能力，不显示无意义重试 |
| 网络/服务失败 | 保留安全上下文，提供重试与关联 ID |
| mutation pending | 禁用冲突动作，显示具体正在执行的命令 |
| 部分失败 | 汇总成功/失败，列出逐项原因与重试/导出 |
| 冲突 | 提示数据版本已变，允许刷新/比较 |

Toast 只承载短暂、低复杂度结果；需要用户决策或复核的结果进入 Banner、Dialog、ResultDrawer 或 Job detail。

## 8. Overlay 选择

| 容器 | 适用 | 不适用 |
| --- | --- | --- |
| Popover/Menu | 短选项、列设置、低频筛选 | 长表单、复杂解释 |
| Dialog | 短决策、危险确认、少量字段 | 多章节编辑、可分享详情 |
| Drawer | 上下文摘要、筛选、轻编辑 | 多步骤任务、深层关系 |
| Page | 完整详情、复杂表单、调查工作流 | 一次性短确认 |

所有 Overlay 使用同一 focus trap、关闭策略、标题/描述和 pending 保护。

## 9. BatchOperation

状态为 `selecting → previewing → confirming → running → completed/partial/failed`。高影响批处理必须先获取或计算影响摘要；运行中禁止重复提交；结果保留成功与失败集合。长任务切换为 Job 并允许关闭页面后继续执行。
