# 082 研究档案：WebUI 产品架构与 UI 体系重构

## 研究范围

回答三项问题：① 当前 WebUI 的真实前端架构现状（路由/Shell/SDK/UI 原语/数据获取/样式/权限/表单/测试/边界）；② 当前后端为管理控制台提供的真实能力（operation/权限键/数据模型/管理端点）；③ 方案文档 `docs/changes/temp-new-changes.md` 在当前现状下的逐项差距与可落地范围。研究以真实代码、生成物与已提交文档为证据，不把目标设计写成已实现事实。方案文档于研究后由 80 节重构为 81 章中文编号（commit `3b758bd`），新旧编号映射见 [R003 §4.11](R003-proposal-gap-analysis/report.md)。

## 检索方式

- 变更序号 `082`；研究快照 commit `c3a23c0`（2026-08-27），方案重构版快照 `3b758bd`。
- 代码证据：`webui/src/**`（宿主/SDK/ui/zone/样式/主题/mock）、`internal/module/*/binding/webui/*`（业务 facet）、`internal/webui`（契约）、`internal/composition`（注册/生成）、`api/openapi.yaml` 与 `internal/transport/http/api/operation_inventory.gen.go`（operation 权威映射）、`internal/module/*/binding/http`（后端能力）。
- 外部判定：方案要求与已验证边界（062 静态插拔、068 HeroUI 单轨、069 遮罩自绘边界、059/067 样式/动效 authority、AGENTS 3.8 单轨与禁 Fake）对照，全部可引用既有研究档案（062/068/069 等），不重复检索。

## 现状盘点

- 已有：React 19 + Vite 7 + TS + HeroUI v3 + Tailwind v4 声明式托管 Admin Shell；24 路由/25 菜单节点/7 模块 facet（R001）；55 operation/23 权限键/9 模块（R002）；059–081 已实现 Token 体系、动作级权限投影、zone 注入点、滚动/动效运行时、设置中心 8 分区、OpenAPI 调试工作台、Ops 监控分区等。
- 缺口（R003 判定）：平台底座（DataTable 增强、统一 FilterBar+URL 状态、FormField 规范化、状态/反馈语义体系、CodeText/ErrorState/DangerZone/LogTable 等语义组件、font/control token、Query/Mutation 统一层）；页面模式迁移（Master–Detail Drawer、User/Role Detail、Permission Catalog、Audit Detail、Org Tree、Ops Top Context、IA 菜单归位、Session 管理完善）；视觉与响应式补齐。

## 设计方向（与 R003 一致）

- 平台底座（PHASE 4–6）优先：语义组件、Query/Mutation 契约与 token 补齐，一次投入长期复用；页面迁移（PHASE 7–8）逐模块采用；打磨（PHASE 9–10）收尾。
- 红线不变：单轨 3.8、静态插拔（062）、HeroUI 单轨（068）、禁 Fake（方案「六十五、但禁止虚构业务数据」= AGENTS）、强 i18n、模块页面 owner、样式 authority styles.css、Backend Contract 不动（方案「六十二」= 原则 A）。
- 否决项（无真实数据，不实现）：User Activity timeline、Audit request metadata、Ops Dependencies/Instances、Host Resources 实时图、Org Move/Archive DnD、无后端批量操作；不为「成熟」过度设计（方案「六十八/六十九」）。

## 记录索引

| ID | 标题 | 状态 |
| --- | --- | --- |
| [R001](R001-webui-current-state/report.md) | WebUI 前端现状审计（路由/Shell/SDK/UI 原语/数据/样式/权限/表单/测试/边界） | active |
| [R002](R002-backend-capability-map/report.md) | 后端真实能力清单（55 operation/23 权限键/9 模块/管理端点/错误契约） | active |
| [R003](R003-proposal-gap-analysis/report.md) | 方案与现状差异分析（差异矩阵/否决项/可落地范围/新旧编号映射 §4.11） | active |

## 附录：方案 81 章覆盖登记（2026-08-27 核对）

**目的**：证明方案（temp-new-changes.md，81 章）每一章在 082 产物中都有落点，防止「方案大、产物小」被误读为缩水。核对方式：对每章标题核心词在 082 全部产物（计划文档 + 研究档案，UTF-8）中做包含匹配，未命中章节再按语义关键词人工复核。

**结论**：81 章全部有落点——计划文档（requirements/design/tasks/README）直接引用 57 章；仅研究档案（R003 差异矩阵/§4.11 映射）覆盖 18 章；语义覆盖 6 章（标题措辞与产物表述不同，关键词已人工核对命中：成熟项目标准、Design System、过度设计、复杂度/Wizard、Administration Product、Capability Review）。

**为何产物看起来更小**：① 方案是纲领（每章铺陈原则/示例/ASCII 图），约 32 KB；② 082 研究档案 R001+R002+R003 合计约 127 KB（方案的近 4 倍），是逐章消化物；③ 计划文档（requirements/design/tasks/README）合计约 37 KB，是差异矩阵的「执行投影」——把 81 章约束收敛为 25 条 REQ、6 个决策点与按 Phase 切片的任务，天然比纲领紧凑。三者相加 164 KB+ 是「研究 + 计划」的完整产物，不存在缩水。

| 章节范围 | 落点 | 数量 |
| --- | --- | --- |
| 一~八十一 中直接进入计划文档 | requirements REQ/决策点、design 策略、tasks 任务、README 叙述 | 57 |
| 仅由 R003 差异矩阵/§4.11 映射登记 | 研究层面的逐章判定与新旧编号对照 | 18 |
| 语义覆盖（关键词人工复核） | 非目标红线/验收标准/叙事（成熟标准、Design System、过度设计、复杂度、产品思维、Capability Review） | 6 |