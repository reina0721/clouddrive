# 原始目标覆盖矩阵

本矩阵用于防止实施过程把“完整重设计”缩减成 Shell 换色或少数页面改版。状态列仅表示计划是否覆盖，不表示实现已经完成。

| 原始目标维度 | 当前证据/问题 | 目标设计 | 实施与验证任务 | 计划状态 |
| --- | --- | --- | --- | --- |
| 参考图与 TailAdmin 原理 | R090-002 | Layout、列表与表单原则，明确不复制 | SHELL、PATTERN、PAGE | 已覆盖，待实施 |
| 运行截图与当前视觉 | R090-001；本地服务未运行 | 现有截图审计 + 实施期运行态矩阵 | VERIFY-090-002 | 已覆盖，运行态待实施 |
| Shell/Sidebar/Header | 比例、工具过载、移动拥挤 | `layout-system.md` | SHELL-090-001/002 | 基础骨架已实施，持续验收 |
| Workspace/Tab | singleton 仍占独立栏、页面 Tab 语义混杂 | 条件 WorkspaceRail、Tab 分层 | SHELL-090-001、PAGE-090-007 | 已覆盖，待实施 |
| Content width/留白/节奏 | 多层容器与标题推低内容 | PageFrame 六变体、统一 gutter/rhythm | SHELL-090-002 | 基础骨架已实施，持续验收 |
| 配色/Surface/Border/Shadow | 装饰色与容器层级过多 | semantic color、五层 Surface、受控 elevation | FE-090-002 | Token 基线已实施，持续验收 |
| Typography/Control/Density | 任意值、表格和页面密度不一 | typography scale、normal/compact/touch | FE-090-002、PATTERN-090-001 | 基线已实施，持续验收 |
| Card | 默认套 Card、嵌套层级 | 四类 Card、Section 优先 | FE-090-003、页面迁移 | 已覆盖，待实施 |
| Table/Pagination | 工具分散、列/行密度与响应式不足 | ResourceIndex/DataGrid/RecordList | PATTERN-090-001 | 高频列表已实施，持续验收 |
| Form/Settings | 手工状态、局部导航过宽 | FormPage/SettingsForm/StickyActionBar | PATTERN-090-002、PAGE-090-005 | IAM/Settings/组织关键编辑表单已接入 StickyActionBar，完整 dirty/conflict 表单流待实施 |
| Search/Filter | 全局与局部范围、debounce 耦合 | 三层 Search、QueryToolbar、ActiveFilters | PATTERN-090-001/004 | 已覆盖，待实施 |
| Detail/Related/Danger | Drawer 字段列表，关系与影响弱 | EntityDetail、Relations、Activity、DangerZone | PATTERN-090-002、BE-090-002 | 账户/角色 EntityDetail 头已实施，关系投影待实施 |
| Dashboard/Statistic/Chart | 装饰性彩色指标、统计契约不足 | attention-first、Statistic anatomy、Chart rules | PAGE-090-006、PATTERN-090-005 | 已覆盖，待实施 |
| Empty/Loading/Error | 页面表达不统一 | Feedback matrix + 基础状态规格 | PATTERN-090-003 | 已覆盖，待实施 |
| Modal/Drawer/Toast | 容器选择与反馈层级混杂 | Overlay 决策表和组件契约 | FE-090-003、PATTERN-090-002/003 | 已覆盖，待实施 |
| Batch Action | 部分页面具备但结果模式不统一 | BatchOperation 状态机与 Result | PATTERN-090-003、BE-090-004 | 同步结果与幂等 P0 已实施，完整交互状态机待实施 |
| Command/Action | Header 工具多，动作层级分散 | Command registry、Action taxonomy | PATTERN-090-004 | 已覆盖，待实施 |
| Design Token | 已有方向但可被 magic value 绕过 | 四层 Token 与静态门禁 | FE-090-002 | 已覆盖，待实施 |
| 组件复用 | 巨型 UI 文件、控件复用而非工作流复用 | primitives/semantic/pattern/module 四层 | FE-090-003、PATTERN 全部 | 已覆盖，待实施 |
| 信息架构 | 模块名、父子 active、位置重复 | 任务导向导航与页面蓝图 | SHELL/PAGE | 已覆盖，待实施 |
| 响应式 | OpenAPI 裁切、桌面工具硬压缩 | compact/medium/wide 结构转换 | SHELL-090-001、PAGE-090-007 | 已覆盖，待实施 |
| 可访问性 | Tree/Grid 自研行为证据不足 | React Aria 原语 + 键盘/读屏矩阵 | VERIFY-090-003 | 已覆盖，待实施 |
| 后端查询/详情/关系 | CRUD 可用但产品投影不足 | P0 查询、详情、影响、审计、偏好 | BE-090-001—005 | 账户/角色详情、批量幂等与 eventId 已实施，其余 P0 待实施 |
| 统计/运维/异步任务 | typed history 与 Job 不足 | P1/P2 契约，不以假数据填充 | 后续价值门禁；P0 留出 adapter | 已覆盖，不提前实施 |
| 迁移与清理 | 旧骨架继续叠补丁风险 | 单轨分页面族迁移、零旧引用 | CLEANUP-090-001 | 已覆盖，待实施 |
| 多模态验收 | 现有截图不覆盖真实完整状态 | 5 断点 × 主题 × 密度 × 状态矩阵 | VERIFY-090-002 | 已覆盖，待实施 |

## 门禁结论

原始目标的设计和任务落点已经完整；当前缺口均属于需要用户确认后才能执行的源码、后端、运行态与视觉验收。若实施中发现真实数据、组件能力或 087 工作区前提推翻当前设计，应按 refresh trigger 返回研究，不以兼容层缩减目标。
