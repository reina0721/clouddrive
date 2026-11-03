# 基础组件规格

## 1. Surface 与 Card

Surface 层级固定为：

| 层级 | 语义 | 典型用途 |
| --- | --- | --- |
| canvas | 页面背景 | App 主内容背景 |
| surface | 默认内容面 | Table、Form 主区域 |
| subtle | 弱分组 | 筛选区、只读摘要、code header |
| raised | 浮起内容 | Popover、悬浮工具条 |
| overlay | 遮罩上表面 | Dialog、Drawer |

Card 只提供四种语义：

- `section`：需要明确边界的独立功能块；
- `interactive`：整体可进入详情的对象摘要；
- `metric`：Statistic 的有限容器；
- `attention`：需要处理的异常或待办。

默认 padding 为 20px，宽屏复杂 Section 可使用 24px；紧凑列表容器允许 16px，但由组件 variant 决定。Card 不嵌套同等级 Card；无独立边界的章节使用 Section + divider。普通 Card 不使用阴影，interactive 只在 hover/focus 改变 border/surface。

## 2. PageHeader、Breadcrumb 与 Tabs

`PageHeader` 结构为 breadcrumb（可选）、H1 + description/status、primary/secondary actions。H1 与内容起始线对齐；description 最大阅读宽度受控，不横跨整个大屏。

- 一级列表默认不显示只有一个节点的 breadcrumb。
- Breadcrumb 只表达可返回的层级，不包含当前页重复长标题时可省略末项视觉文本，但保留可访问上下文。
- 页面 Tabs 用于同一实体/页面的平级视图；Workspace Tab 用于多个已打开上下文，二者高度、关闭行为和持久化完全不同。
- Tabs 目标高度 36px，使用底部 indicator 或 subtle selected surface 中的一种，不同时叠加高饱和背景、粗边框和阴影。

## 3. Button 与 IconButton

| variant | 用途 | 限制 |
| --- | --- | --- |
| primary | 当前上下文唯一主要动作 | 每个 Header/ActionBar 最多一个 |
| secondary | 并列普通动作 | 不与 primary 同色 |
| ghost | Toolbar、低频动作 | 必须有清晰 hover/focus |
| danger | 明确破坏性动作 | 不能代替确认和影响说明 |
| link | 文本中的导航 | 不用于提交命令 |

- normal 36px、compact 32px、touch 44px；字号和图标由 size token 同步变化。
- IconButton 必须有可访问名称和 Tooltip；只有行业通用且当前上下文无歧义的图标可单独出现。
- loading 保留原宽度并将 label 变为具体进行态；不可重复提交。
- disabled 表达不可用且需要旁边原因；仅为阻止重复提交的 pending 使用 busy 语义。

## 4. Form controls

统一 `Field` anatomy：label + required/optional marker、control、description、validation message。label 不以 placeholder 代替。

- 默认纵向表单；只有短标签、稳定宽度和足够横向空间时使用横向排列。
- 一个 Section 的字段列数由内容决定：文本/权限通常单列，短数值和日期可双列；手机一律单列。
- control normal 36px、touch 44px；Textarea 高度由内容和用途决定，不套单行高度。
- description 与 error 占同一反馈区域，错误出现时不造成大幅布局跳动；服务端字段错误映射到字段，表单级错误单独显示。
- Select/Combobox 用于有限集合或可搜索引用；二元状态使用 Switch/Checkbox，不能用任意字符串下拉替代 typed 状态。
- 日期、时间、时区、持续时间和容量必须在 label/单位中明确。

## 5. Search、Filter 与 Toolbar

- SearchInput 使用 search 语义、统一图标、清除按钮和范围说明；输入值实时更新，提交值独立 debounce。
- 常用 Filter 使用 Select/Combobox/DateRange，更多条件进入 FilterPopover；手机进入 FilterDrawer。
- Filter trigger 显示活动数量；ActiveFilters 按字段显示可移除 chip。
- Toolbar normal 高度 44px，可换行但保持 search、filter、view 和 action 四组内部关系；不得让“清除”和结果数量漂浮到第二行无归属位置。

## 6. Status、Badge 与 Progress

- `StatusBadge` 结构为可选 icon/dot + 文本，使用 neutral/info/success/warning/danger；同一领域状态只有一个映射表。
- Badge 不承担按钮行为；可点击筛选使用 FilterChip 并提供按压状态。
- Progress 只用于可量化进度；未知时长使用 indeterminate，不伪造百分比。
- 状态文字采用业务语言（如“等待签名”“已吊销”），不直接暴露内部枚举。

## 7. Table 与 Pagination 外观契约

- Header 目标高度 36px，正文 normal 44px、compact 36px；多行身份信息可提升到 52px，但整表一致。
- Cell 横向 padding normal 12px、compact 8px；第一/末列由容器补足外边界。
- Header 与 row 使用 subtle divider，不给每个 cell 画完整网格线。
- hover、selected、focus、disabled/archived 使用不同语义，不能只通过背景深浅猜测。
- Pagination 与结果范围位于同一 Footer；页大小属于 view control。无下一页时禁用并提供正确可访问状态。
- 行操作列宽固定且 sticky 时必须有滚动阴影/边界提示；窄屏转 RecordList，不压缩成不可读表格。

## 8. Modal/Dialog

- 尺寸只允许 `sm`（确认）、`md`（短表单）、`lg`（有限复杂内容）；超过 lg 或多章节进入 Page。
- Header 提供 title/description，Body 独立滚动，Footer 固定 actions；关闭按钮位置一致。
- 危险确认默认焦点放在安全取消或第一个中性控件，不自动聚焦 danger action。
- pending 时阻止意外关闭并说明原因；关闭后恢复触发点焦点。

## 9. Drawer

- 桌面从右侧进入，宽度使用受控 `sm/md/lg`；移动端占满可用宽度并处理 safe area。
- Drawer 用于上下文，不重复 PageHeader；内部使用 EntitySummary/FilterForm 等明确 Pattern。
- 深链接详情只在 Drawer 状态可恢复且有分享价值时进入 URL；否则关闭返回原列表状态。
- Drawer 不再打开第二层同侧 Drawer；复杂子任务导航到页面或替换当前内容。

## 10. Toast、Banner 与 Result

- Toast：短成功、低风险通知；默认自动关闭，错误和需要行动的信息不得只放 Toast。
- Inline/Banner：页面级降级、权限、冲突、离线和可恢复错误。
- ResultDrawer/Page：批量结果、导出 Job、长错误列表和审计关联。
- 同一操作只在决定用户下一步的最高层记录一次主要反馈，避免 Toast + Banner + 行内错误重复。

## 11. Empty、Loading 与 Error

`EmptyState` 变体：first-use、no-data、no-results、not-available、no-permission。它们的标题、说明和 action 不可混用。

Skeleton 与目标结构一致：Table 显示 header/row 骨架，详情显示摘要和 Section，不用全页 Spinner。ErrorState 区分网络、服务、权限、not-found、冲突和部分数据；重试只在可能恢复时出现。

## 12. Motion

- 控件反馈 100—160ms，Overlay 160—240ms；运动只解释状态变化，不作为装饰。
- reduced motion 下取消位移/缩放，保留必要 opacity/state feedback。
- loading skeleton 动画低对比，不在大量表格上造成视觉闪烁。

这些时长和尺寸进入 Token/variant，业务页面不得自行覆盖。
