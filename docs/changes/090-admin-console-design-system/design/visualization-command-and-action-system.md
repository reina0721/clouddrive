# 数据可视化、搜索与动作系统

## 1. 目的

成熟控制台不能把 Statistic、Chart、全局搜索和 Command 当作装饰性组件。它们必须分别回答：当前发生了什么、变化是否重要、对象在哪里、用户下一步能做什么，并与权限、查询上下文和后端口径保持一致。

## 2. Statistic 结构

`Statistic` 不是只显示一个大数字，其稳定结构为：

```text
label
value + unit
time window / as-of
comparison value + comparison basis
state or confidence
optional drill-down
```

- 单位不藏在 tooltip 中；百分比、数量、时长和容量使用各自格式。
- “增长 8%”必须说明相较上个周期、基准值或目标；没有可比数据时省略 trend。
- 近实时指标显示 `asOf` 和数据延迟；快照指标不使用脉冲动画制造实时感。
- 警告/危险只由阈值或领域状态触发，普通正增长不自动涂成绿色。
- Dashboard 同屏最多突出 4 个一级 Statistic，其余进入分组或详情，避免每个数字都竞争注意力。

## 3. Chart 选择

| 问题 | 首选 | 禁止的替代 |
| --- | --- | --- |
| 随时间变化 | line/area，明确缺失区间 | 用多个孤立 KPI 冒充趋势 |
| 类别比较 | horizontal/vertical bar | 3D 柱、无基线图形 |
| 构成且类别少 | stacked bar；必要时 donut | 多于约 5—6 类的细碎饼图 |
| 分布 | histogram/box plot，按真实需求 | 用平均值隐藏离散程度 |
| 状态进度 | progress，仅在有明确上下限时 | 无上限运维指标使用 gauge |
| 精确查找 | Table/Statistic | 为了视觉效果强行画图 |

图表类型由问题决定，不由页面设计师自由选择。P0 没有可靠时间序列时，Dashboard 使用真实健康快照、任务队列和活动列表，不绘制模拟趋势。

## 4. 图表语义与交互

- categorical palette 与 success/warning/danger 分离，避免用户误读类别为状态。
- 单图默认不超过 6 个同时可见系列；更多系列使用筛选或 small multiples。
- legend、series、tooltip 与下钻链接使用同一名称和格式化函数。
- hover 不是唯一入口：键盘焦点可访问数据点/系列，并提供“查看数据表”。
- tooltip 展示时间、系列、值、单位和必要基准；不重复无意义标题。
- 用户切换时间范围、环境或筛选后，Statistic、Chart 和 activity 使用同一 query context。
- loading 保留图表几何；empty 解释没有采集、没有事件或无匹配的区别；partial 标明缺失区间；error 提供重试和关联 ID。

## 5. 响应式数据可视化

- wide 展示完整坐标轴、legend 和 drill-down；medium 可把 legend 移至下方并减少刻度；compact 优先显示指标摘要和关键趋势，次要系列进入可选列表。
- 不通过将字号缩到不可读来保留所有系列。
- 图表容器使用 ResizeObserver/container query 决定布局，不能只按全局 viewport 猜测可用宽度。
- 触摸设备扩大命中区域并支持点击固定 tooltip；滚动手势不被图表无条件拦截。

## 6. Search 分层

| 类型 | 范围 | 状态与 URL | 典型入口 |
| --- | --- | --- | --- |
| Global Search | 可访问页面与跨域资源 | 独立 overlay，不改变当前页查询 | Header / `Ctrl|Cmd+K` |
| Resource Search | 当前列表资源 | debounce 后进入 URL query | ResourceIndex Toolbar |
| In-context Find | 当前树、文档或响应 | 局部瞬时状态 | Org Tree / OpenAPI panel |

三类 Search 使用范围标签、placeholder 和结果分组明确区别。敏感资源结果只返回允许的安全摘要；服务端执行权限过滤，前端不能先获取再隐藏。

## 7. Command 模型

Command 分为：

- `navigate`：打开页面、实体或工作区；
- `create`：进入创建流程；
- `contextual`：对当前实体执行可恢复的普通动作；
- `dangerous`：只导航到预览/确认，不在面板内直接执行；
- `preference`：切换密度、主题等低风险用户偏好。

每个 Command 包含稳定 ID、可见名称、keywords、scope、required capability、target、availability 和 invocation mode。模块通过窄 registry 贡献命令，宿主负责检索、分组、键盘与权限投影；模块不得向全局面板注入任意 JSX。

命令历史只保存低敏 ID 和使用时间，不持久化搜索词、实体名称、Token 或响应内容。

## 8. Action 层级

| 层级 | 位置 | 规则 |
| --- | --- | --- |
| Primary | PageHeader/StickyActionBar | 每个上下文最多一个，表示最可能的下一步 |
| Secondary | Header/Toolbar | 少量并列普通动作 |
| Tertiary | Menu/inline | 低频、不改变主要流程 |
| Destructive | DangerZone/Confirm | 不与 Primary 混色混位，必须说明影响 |
| Batch | SelectionBar | 仅在选择后出现，说明范围和部分失败 |

行内不同时出现多个文字按钮和同义 more menu。身份列进入详情，最常用安全动作可显式显示，其余进入有标签的菜单。

## 9. 权限与 availability

- `hidden`：用户不应知道或上下文不适用的能力。
- `disabled with reason`：用户知道能力存在，但当前状态、依赖或策略暂不允许。
- `allowed`：可触发，但服务端仍在执行时重新授权。
- `degraded`：保留受影响内容并解释缺失能力，不把所有异常都伪装成 disabled。

前端 `allowedActions` 只用于表达，不能作为安全边界。权限或 availability 在页面加载后变化时，正在编辑的内容进入受控冲突状态，不静默提交或丢弃。

## 10. 动作反馈链

```text
intent -> permission/availability -> optional preview -> confirm
  -> pending -> success | partial | conflict | failed
  -> refresh/invalidate -> audit/correlation
```

- Action label 在 pending 时仍说明正在做什么，不统一变成“处理中”。
- 成功后只失效受影响 query，并保持列表位置/筛选。
- partial 进入 ResultDrawer/Job detail；Toast 只提示结果可查看。
- conflict 提供重新加载、比较或重新预览。
- 高影响操作结果展示 correlation ID，并允许进入相关审计事件。

## 11. 实现边界

- 复用 HeroUI/React Aria 的 Command/Dialog/Menu/ListBox/focus 原语；项目拥有 command registry、权限语义和业务动作状态机。
- 图表库选择在实施前以真实指标、SSR/Canvas/SVG、可访问性、bundle 和维护状态做独立 spike；没有证据时不扩建当前自研图表。
- 指标格式、query context 和时间范围由项目契约统一；具体 Chart renderer 可替换，不把第三方 series option 泄漏到业务页面。
