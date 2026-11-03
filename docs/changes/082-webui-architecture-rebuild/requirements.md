# 082 需求规格：WebUI 产品架构与 UI 体系重构

引用研究：[R001](research/R001-webui-current-state/report.md)（WebUI 前端现状审计）、[R002](research/R002-backend-capability-map/report.md)（后端真实能力清单）、[R003](research/R003-proposal-gap-analysis/report.md)（方案与现状差异分析）。方案输入为 `docs/changes/temp-new-changes.md`（81 章「前端产品能力系统性重构」纲领，commit `3b758bd`，下称「方案」；旧 80 节编号与新版章节的映射见 [R003 §4.11](research/R003-proposal-gap-analysis/report.md)）。

## 1. 目标

按方案把当前 WebUI 从「后端能力可视化 + UI 组件呈现」演进为「完整 Administration Control Plane」，**以 R003 差异矩阵为范围裁剪依据**：已满足项不重做、部分满足项补齐、未满足项新增、与已验证边界冲突项否决、纯愿望项作为验收输入。后端 55 operation/23 权限键（R002）是页面↔operation 映射的唯一事实来源；禁止为后端不存在的能力或数据伪造 UI（方案「六十五、但禁止虚构业务数据」= AGENTS 红线）。方案原则 A（兼容现有 Backend Capability、不破坏 Backend Contract）与原则 B（前端不被后端页面形态限制、承担理解/组织/搜索/导航/反馈等产品责任）是全部需求的顶层约束。

## 2. 功能要求

### 2.1 平台底座（PHASE 4–6，一次性投入长期复用）

| ID | 要求 | 来源（新章节） |
| --- | --- | --- |
| `REQ-082-001` | **DataTable 增强**：列可见性、密度档、Sticky 表头、Row menu；批量操作仅对真实后端批量语义实现（会话按 IDHash 批量吊销，R002 §5.2），无批量后端对象不提供假批量 UI。 | 十七 建立 Production DataTable |
| `REQ-082-002` | **统一列表 Toolbar 模型**：新增 `FilterBar`/`SearchInput` 语义组件（Search→Primary filters→Clear→Result count），列表页过滤/分页/排序状态同步 URL query（refresh/back/share 稳定），并区分 Empty Data 与 No Search Results。 | 十八 Search 必须是真实能力、十九 Filter、二十 URL 也是 Frontend State、三十二 No Results |
| `REQ-082-003` | **表单架构规范化**：统一 `FormField`（Label/Description/Control/Helper/Error）结构与按数据定义字段宽度；在「正式启用 react-hook-form/zod」与「移除声明依赖」之间做出单一决策（禁止悬置双轨，3.8）。 | 二十三 Form System |
| `REQ-082-004` | **状态与反馈语义体系**：`EmptyState` 结构化（发生了什么/为什么/能做什么/动作）、`ErrorState` 分级（Page/Section/Inline/Action/Permission/Connectivity）、`StatusBadge` 全状态集（对照 080 Token/会话/账号状态机）、`DangerZone` 统一危险操作流程（后果说明+确认）、Feedback 分层规范（Toast/Inline/Banner/Dialog）。 | 二十九 状态系统、三十 Loading System、三十一 Empty State、三十三 Error Architecture、三十五 Feedback System、三十六 Destructive Action |
| `REQ-082-005` | **语义组件补齐**：`CodeText`/`CodeViewer`（monospace 技术标识符与 JSON 展示）、`TreeView`+`InspectorPanel`、`DetailDrawer` 规格化（Header/Metadata/Actions/Tabs/Sections/Content）、`LogTable`、`PermissionMatrix`（按真实 taxonomy 分组呈现，非硬套 CRUD）。 | 二十一 Master–Detail、二十二 Detail Drawer、二十七 Permission UX、二十八 Permission Matrix、四十四 Organization Management、四十五 Audit Log、五十一 Typography（monospace）、五十九 核心组件层、六十 组件必须是 Semantic Component |
| `REQ-082-006` | **Token 补齐**：`font.*`（字号 scale/字重/中英文与等宽字体栈）、`control.*`（控件尺寸档）、`info`/`success` 语义色（与 081 监控语义对齐）。 | 四十七 Design System、五十 Color、五十一 Typography、五十二 Density |
| `REQ-082-007` | **Command Search 入口常驻化**：Command Palette 输入框在 Topbar 常驻呈现（Ctrl/Cmd+K 已有）；实体检索（Users/Roles 等跨模块）列为候选不立项。 | 十三 Top Bar、五十七 Command Search |
| `REQ-082-008` | **Skeleton 分级**：Page/Table/Panel/Inline 分级骨架原语，替代全屏 Spinner 兜底。 | 三十 Loading System |
| `REQ-082-009` | **Query / Mutation 体系统一（新增自新版方案）**：把 react-query 从 Ops 推广为全模块统一查询层（单一 `useWebUIQuery` 语义：Query/Cache/Mutation/Invalidation/Error/Loading），约束「每个组件自己 fetch」；列表请求含取消/防抖/缓存；写操作统一 Mutation + 失效 + 错误链路。 | 七十 性能、七十一 Query / Mutation 体系 |
| `REQ-082-010` | **Backend 错误分类呈现（新增自新版方案）**：普通用户不直接看到 500/SQL/JSON 错误；稳定错误码 → message ID → 当前语言文案；技术详情（错误详情/Request ID/Trace ID）放入可展开区。 | 三十四 Backend 错误不能原样倾倒到用户界面、三十五 Feedback System |
| `REQ-082-011` | **前端 Adapter / View Model 层（新增自新版方案）**：对后端化数据建 `api.ts` 的 adapter/mapper 层（API→Frontend View Model→UI），保留原始 Permission Code 用于实际授权；允许前端提供分组/排序/派生标签/格式化/组合/渐进披露等 Frontend Product Capability，不要求 Backend 为每个 UI 行为新增接口。 | 六十三 允许 Frontend Adapter Layer、六十四 Frontend 可以比 Backend 更聪明、六十六 Progressive Disclosure |

### 2.2 页面模式迁移（PHASE 7–8，逐模块）

| ID | 要求 | 来源（新章节） |
| --- | --- | --- |
| `REQ-082-012` | **IAM 账号 Directory**：AccountsPage 收敛为 DataTable + 创建流程（Drawer/Dedicated 依复杂度，不默认巨大 Form）（数据/过滤全真实，iam.accounts.list typed filters）。 | 四十 User Management 成熟化、二十四 Create Flow |
| `REQ-082-013` | **User Detail**：按真实能力组织（Overview/Roles/Sessions/Security）；**不实现 Activity timeline**（后端无用户活动明细，R003 否决项，重述为省略或不可用态）。 | 四十 User Management 成熟化、四十二 Session Management |
| `REQ-082-014` | **Role List/Detail**：List + Detail（Overview/Members/Permissions 数据全真实）。 | 四十一 Role Management |
| `REQ-082-015` | **Permission Catalog**：DataTable + CodeText 呈现；启用 permissions.roles.list 影响分析引用（Used by Roles）；权限码作 developer metadata 展示（语义名 + 技术码）。 | 二十七 Permission UX |
| `REQ-082-016` | **Audit Log Explorer + Audit Detail Drawer**：LogTable 形态（Search/Filters/Date/Actor/Action/Resource/Result/Pagination）；Detail 只展示返回摘要字段（事件 ID/时间/操作/结果/摘要 + CodeViewer）；**不实现 Request metadata/Related metadata**（低敏审计不存，R003 否决项）。 | 四十五 Audit Log |
| `REQ-082-017` | **Ops Dashboard 顶栏 Context**：Environment/Health/Version/Uptime/Last Refresh/Refresh（数据来自 /management/build+diagnostics，真实）；无数据层级（Dependencies/Instances/Host Resources）呈现「未配置/不可用」态，不 fake。 | 三十七 Runtime / Operations 前端能力、三十八 不要伪造监控能力、三十九 区分状态语义 |
| `REQ-082-018` | **Organization Tree+Detail**：TreeView + 详情（名称/父级/成员/岗位）；无后端 Move/Reorder/Archive → 不提供 DnD/Archive UI。 | 四十四 Organization Management |
| `REQ-082-019` | **Navigation 管理核查**：/admin/menus 按 Tree + Inspector 形态复核（Label/Route/Icon/Permission/Visibility/Parent/Order 以 navigation 模块真实策略字段为准）；DnD 仅当真实 reorder 承载允许。 | 八 重新建立 Information Architecture、九 导航不应该暴露后端模块结构 |
| `REQ-082-020` | **Menu 归位与 Sidebar 细化**：audit 归位 Governance 组、openapi 归位 Developer 组（仅 manifest 菜单声明调整，不新增能力）；Sidebar 宽度与 Group Label 收敛（232–248/64–72px 或现状复核结论）。 | 八 重新建立 Information Architecture、十一 Sidebar |
| `REQ-082-021` | **Session Management 完善（新增自新版方案）**：/admin/sessions 按真实后端字段设计与呈现（User/Session/Client/IP/Created/Last active/Expires/Status）；**Backend 没有 Device 则不生成 Device 字段**（禁止 fake）。 | 四十二 Session Management |
| `REQ-082-022` | **API Token 成熟管控**：Token List 字段（Name/Status/Scope/Created/Expires/Last used）与 Actions 全部来自真实 API；创建流程（Identity→Expiration→Scopes→Review→Create→Reveal）保持 scopes⊆创建者权限硬约束；Secret 只显示真实 Backend 返回、不假装可再读。 | 四十三 API Token Management |

### 2.3 打磨与验收（PHASE 9–10）

| ID | 要求 | 来源（新章节） |
| --- | --- | --- |
| `REQ-082-023` | 交互态/响应式/a11y 复核：Focus/Contrast/Semantic HTML 检查单（Playwright 补测）、Tablet 断点与桌面流体栅格复核、密度档与页面宽度档复核、reduced-motion 对齐。 | 五十三 Radius、五十四 Shadow、五十五 Responsive、五十六 Accessibility、五十二 Density |
| `REQ-082-024` | 三层 QA 门禁（新增自新版方案）：Design QA（同 header/table/filter/button hierarchy/drawer/form/status/feedback/spacing/typography 一致性）、Interaction QA（hover/focus/keyboard/loading/disabled/success/failure/back/refresh/deep link/permission denied）、Backend Compatibility QA（旧能力 read/create/update/delete/authorize/revoke/configure/diagnose 全部保活）。 | 七十二 Design QA、七十三 Interaction QA、七十四 Backend Compatibility QA |
| `REQ-082-025` | 页面五问完成标准作为验收准则：位置/数据/状态/动作/结果；最终视觉与产品标准（性能不劣化）作为叙事目标。 | 七十 性能、七十八 最终验收标准、七十九 视觉验收、八十 最终产品模型 |

## 3. 需在计划确认阶段明确的决策点

| ID | 决策 | 选项 | R003 建议 |
| --- | --- | --- | --- |
| `DEC-082-001` | WorkspaceTabs（历史页签）去留（方案「十二、不要继续使用全局页面 Tabs」） | 保留为导航辅助 / 降级删除（删除组件与测试，单轨 3.8） | 二选一，禁止「保留+宣称符合」双轨 |
| `DEC-082-002` | react-hook-form/zod 是否正式启用（方案「二十三、Form System」） | 启用并迁移全部表单 / 移除声明依赖 | 二选一；启用需评估 Vitest 151+Playwright 22 回归成本 |
| `DEC-082-003` | DataTable 增强边界（方案「十七、建立 Production DataTable」） | 仅列可见性/密度/Sticky/Row menu / 含列排序持久化等扩展 | 按真实列表 API 排序能力裁定 |
| `DEC-082-004` | IA 归位范围（方案「八、重新建立 Information Architecture」） | audit→Governance、openapi→Developer / 保持平铺 | 可实施（仅 manifest 声明调整），是否纳入 082 由确认决定 |
| `DEC-082-005` | 账号 Directory 是否增加 organization 维度过滤 | 前端组合过滤（当前 list API 无 organization 参数）/ 后端扩展 | 前端组合为默认，后端扩展不纳入 082（R002 §12） |
| `DEC-082-006` | Query/Mutation 统一层推行范围（方案「七十一、Query / Mutation 体系」） | Ops 已有 react-query 为范本推广到全部列表/表单页 / 仅新组件采用、旧页渐进迁移 | 平台底座批次先建统一 hook 契约，页面迁移逐页接入（避免一次性大重写） |

## 4. 候选方向（仅记录）

- Command Search 实体检索（Users/Roles/Settings/Resources）：需跨模块统一检索架构，列为后续候选（方案「五十七、Command Search」后半）。
- 多实例/多控制台 Workspace Tabs、远程模块：无真实数据/用例（方案「十二」条件），不立项。
- 复杂图表（缩放/联动/大数据集）：真实需求出现时再评估（与 081 结论一致）。
- Audit/User/Org 的相关后端能力扩展（用户活动明细、审计完整元数据、部门移动/归档）：属后端新能力，不在 082（R002 边界）。

## 5. 非目标

- 不重做「已满足」项（见 R003 §5 清单，编号映射见 R003 §4.11）：扫描与 Capability Map（一/三/四/五）、后端能力≠页面（原则 B/六十四）、App Shell（十）、主导航唯一/不暴露后端模块结构（九）、Settings 收敛（四十六）、Token Secret/状态（四十三）、不伪造监控（三十八）、Mutation 闭环（二十五）、权限感知 UI（二十六）、保留 Backend Contract（六十二）、禁虚构数据（六十五）、兼容现有技术栈（六十一）等。
- 不改变 Backend Contract、权限语义、安全语义、业务语义（方案「六十二、保留真实 Backend Contract」= AGENTS 红线；R002 §13）。
- 不引入微前端运行时、不改变静态插拔主线（062）、不引入第二套 UI 栈（068 单轨）、不引入动画库/图表库（059/081）。
- 不实现后端不存在能力的数据视图（R003 §8 拒绝项清单）。
- 不为「成熟」而过度设计（方案「六十八、不要为了成熟过度设计」）：Export/Batch/Advanced filters/DnD/Analytics/Charts/Realtime 等仅当有真实需求或基于现有数据能合理实现时进入；复杂度与业务匹配（六十九：简单 Profile 不做 5 步 Wizard，复杂 Token Permission 不做一页几十 checkbox）。
- 不处理 `frontend/`（Nuxt，未接入）与 `old-backend/`（排除目录，repository-scope）。

## 6. 验收标准

1. 平台底座语义组件与 token 落地且被业务页面采用（组件有 Vitest，lint-architecture/i18n/modules 全绿）。
2. 全部列表页过滤/分页状态 URL 化，refresh/back/share 稳定（e2e 断言）；Empty 与 No Results 区分呈现。
3. 页面模式迁移完成：Accounts/User/Role/Permission/Audit/Org/Navigation/Ops/Sessions/Tokens 按各 REQ 收敛，无 fake 数据视图，Backend Compatibility QA 通过（旧能力零丢失）。
4. 决策点 `DEC-082-001..006` 有明确结论并有对应实现或文档说明。
5. 测试回归基线不劣化：Vitest ≥151、Playwright ≥22（dev 20+mock 2）、typecheck/lint/generate:check/build/go 全绿；`go test ./...`、`go vet ./...` 通过。
6. 文档同步：`docs/development/webui.md`（样式 authority 附录、语义组件规范、Query/Mutation 使用契约）、`webui/README.md`、`documentation-impact.yaml`、`docs/changes/README.md` 更新；文档描述与实现一致（无「文档声称能力代码不存在」）。