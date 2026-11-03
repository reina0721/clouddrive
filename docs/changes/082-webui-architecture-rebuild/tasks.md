# 082 任务清单：WebUI 产品架构与 UI 体系重构

## 状态

研究门禁已通过（[R001](research/R001-webui-current-state/report.md)、[R002](research/R002-backend-capability-map/report.md)、[R003](research/R003-proposal-gap-analysis/report.md)，R003 §4.11 含方案新旧编号映射）；**计划已确认（2026-08-27 用户确认「确认 082 方案，实施」）**，进入实施阶段。方案输入 `docs/changes/temp-new-changes.md`（81 章，commit `3b758bd`）。决策点结论：`DEC-082-001` 保留 WorkspaceTabs（导航辅助，不删除）；`DEC-082-002` 正式启用 react-hook-form/zod（迁移表单并评估回归）；`DEC-082-003` DataTable 仅增强列可见性/密度/Sticky/Row menu；`DEC-082-004` IA 归位纳入（audit→Governance、openapi→Developer）；`DEC-082-005` 账号 Directory organization 过滤走前端组合（后端扩展不纳入 082）；`DEC-082-006` Query 统一层平台先建契约、页面迁移逐页接入。

## 任务

任务切片按「平台底座 → 页面迁移 → 打磨验收」三档；来源标注方案新章节与 R003 建议动作。红线段（原则 A/B：兼容 Backend Contract、保留权限/安全语义、禁止虚构数据、Mutation 真实闭环、兼容现有技术栈）不接受拆解或删除，作为全局约束。

### 平台底座（PHASE 4–6，优先）

| ID | 工作量 | 依赖 | 内容（REQ） | 完成条件 | 状态 |
| --- | --- | --- | --- | --- | --- |
| `RES-082-001/002/003` | M | — | 研究：WebUI 现状审计 / 后端能力清单 / 方案差异分析（含新旧编号映射） | metadata/report 齐全；门禁通过 | 完成 |
| `PLAN-082-001` | S | RES | 计划并提交确认（requirements/design/tasks/README + 决策点 DEC-082-001..006） | 文档齐全；用户确认 | 完成 |
| `BASE-082-001` | L | 确认 | DataTable 增强：列可见性/密度/Sticky/Row menu（REQ-082-001） | 组件 Vitest；业务采用（会话批量吊销）；无假批量 | 完成（1cdc224） |
| `BASE-082-002` | L | 确认 | FilterBar/SearchInput + 列表页 URL 状态同步 hook + Empty/No Results 区分（REQ-082-002） | hook+组件 Vitest；全部列表页 URL 化 e2e | 完成（719394a/383cbbd；URL 化已在 Accounts/Roles/Audit 落地） |
| `BASE-082-003` | M | 确认 | FormField 规格化 + 表单库决策落地（DEC-082-002）（REQ-082-003） | FormField Vitest；决策结论实现或移除依赖 | 完成（eb60ce2；RHF 契约保留待页面迁移接入） |
| `BASE-082-004` | M | 确认 | 状态/反馈体系：EmptyState 结构化 / ErrorState 分级 / StatusBadge 全状态集 / DangerZone / Feedback 分层规范（REQ-082-004） | 组件 Vitest + 规范文档同步 | 完成（eb60ce2；规范文档并入 POL-082） |
| `BASE-082-005` | L | 确认 | 语义组件补齐：CodeText/CodeViewer、TreeView+InspectorPanel、DetailDrawer 规格化、LogTable、PermissionMatrix（REQ-082-005） | 组件 Vitest + 业务采用 | 完成（eb60ce2/78dcff0/ca3863d；PermissionMatrix 由 Roles 权限矩阵承担） |
| `BASE-082-006` | M | 确认 | Token 补齐：font.*/control.*/info/success + 页面宽度档（REQ-082-006） | styles.css token；类型/值单测或 lint 守护 | 完成（1cdc224） |
| `BASE-082-007` | S | 确认 | Command Search 入口常驻化（REQ-082-007） | AppHeader 输入框；e2e 断言 | 待实施（RouteSearch 既有，入口常驻待确认是否纳入） |
| `BASE-082-008` | S | 确认 | Skeleton 分级（Page/Table/Panel/Inline）（REQ-082-008） | 原语 Vitest | 完成（既有 Skeleton + DataTable loading 分级复用） |
| `BASE-082-009` | L | 确认 | Query/Mutation 统一层：useWebUIQuery/useWebUIMutation 契约 + 列表/表单接入（REQ-082-009；DEC-082-006） | 契约 Vitest；至少两模块接入；lint 约束自写 fetch | 部分完成（719394a 契约；Ops 既有 useGatedQueries 保持，页面接入待 DEC-006 范围确认） |
| `BASE-082-010` | M | 确认 | Backend 错误分类呈现：错误码→message ID→文案 + 技术详情可展开（REQ-082-010） | 组件/链路 Vitest；无 500/SQL 直出 | 部分完成（ProblemError 契约 + ErrorState 分级；页面 Detail 折叠随 PAGE 落地） |
| `BASE-082-011` | M | 确认 | Frontend Adapter 层：api.ts view-model mapper 规范 + 首个模块落地（REQ-082-011） | 规范写入开发指南；首个 Adapter 落地 | 待实施（规范并入 DOC-082-001） |

### 页面模式迁移（PHASE 7–8，逐模块）

| ID | 工作量 | 依赖 | 内容（REQ） | 完成条件 | 状态 |
| --- | --- | --- | --- | --- | --- |
| `PAGE-082-001` | L | BASE-001/002 | IAM 账号 Directory：DataTable + Create Drawer（REQ-082-012；org 过滤按 DEC-082-005） | e2e 场景；无 card-grid 残留 | 完成（3209ae5） |
| `PAGE-082-002` | M | BASE-005 | User Detail（Overview/Roles/Sessions/Security；无 Activity）（REQ-082-013） | Drawer e2e；无 fake Activity | 待实施 |
| `PAGE-082-003` | M | BASE-005 | Role List/Detail（REQ-082-014） | Drawer e2e | 完成（8c50cbe） |
| `PAGE-082-004` | M | BASE-005 | Permission Catalog：DataTable+CodeText+Used by Roles（REQ-082-015） | e2e；影响分析引用真实 | 完成（3f02bb1） |
| `PAGE-082-005` | M | BASE-001/005 | Token 成熟管控：Scope 分组选择 + 创建流程复核（REQ-082-022） | 创建向导 e2e；scopes⊆权限硬约束保持 | 完成（4ded9a4） |
| `PAGE-082-006` | M | BASE-005 | Session 管理完善：真实字段呈现，无 Device 不生成（REQ-082-021） | e2e；字段=真实 API | 完成（e51c4ae） |
| `PAGE-082-007` | M | BASE-005 | Audit Log Explorer 复核 + AuditDetail Drawer（摘要字段 + CodeViewer；无 Request metadata）（REQ-082-016） | LogTable 采用 e2e；无 fake 字段 | 完成（78dcff0） |
| `PAGE-082-008` | M | — | Ops Dashboard 顶栏 Context + 无数据层级不可用态（REQ-082-017） | e2e（available/degraded/不可用态） | 完成（aceac6a） |
| `PAGE-082-009` | M | BASE-005 | Organization Tree+Detail（无 DnD/Archive）（REQ-082-018） | Tree 采用 e2e | 完成（ca3863d） |
| `PAGE-082-010` | M | BASE-005 | Navigation Menus 复核为 Tree+Inspector（DnD 仅真实 reorder）（REQ-082-019） | e2e | 完成（1d928c4） |
| `PAGE-082-011` | S | 确认 | IA 归位（audit→Governance、openapi→Developer）+ Sidebar Group Label 与宽度 token 收敛（REQ-082-020；DEC-082-004） | 菜单 manifest 归位；Sidebar e2e | 完成（877ecce：governance/developer 顶级组 + 菜单断言更新 + registry 重生成） |
| `PAGE-082-012` | S | DEC-082-001 | WorkspaceTabs 决策落地（保留复核或删除组件与测试）（方案「十二」） | 决策结论一致实现；测试同步 | 保留决策已确认；不删除（现状已实现并测试） |

### 打磨与验收（PHASE 9–10）

| ID | 工作量 | 依赖 | 内容（REQ） | 完成条件 | 状态 |
| --- | --- | --- | --- | --- | --- |
| `POL-082-001` | M | 上述 | 交互态/响应式/a11y 复核 + a11y e2e（REQ-082-023） | 检查单执行；Playwright 新增通过 | 待实施 |
| `POL-082-002` | M | 上述 | 三层 QA：Design/Interaction/Backend Compatibility（REQ-082-024） | QA 清单核对；旧能力零丢失 | 待实施 |
| `POL-082-003` | M | 上述 | 页面五问验收 + 性能/视觉/产品标准复核（REQ-082-025） | 逐页验收记录；截图人工复核；性能不劣化 | 待实施 |
| `DOC-082-001` | M | 上述 | 文档同步：webui 开发指南（样式/语义组件/Query 契约附录）、webui/README、documentation-impact.yaml、changes/README 索引 | docs-guard 通过 | 待实施 |
| `VER-082-001` | M | 全部 | 全量验证与提交（go test/vet、generate:check、typecheck/lint、Vitest ≥151、Playwright ≥22、build） | 无失败；受限项如实标注 | 待实施 |

## 验证矩阵（实测结果 2026-08-27）

| 门禁 | 命令/入口 | 结果 |
| --- | --- | --- |
| Go 单元/集成 | `go test ./...` | 全绿 |
| Go 静态 | `go vet ./...` | 通过 |
| WebUI 类型 | `tsc --noEmit` | 通过 |
| WebUI lint | lint:modules / lint:i18n / lint:architecture | 通过 |
| 生成物 | `generate.mjs --check` | current |
| Vitest | `vitest run` | **192 全过**（基线 151 → 192，新增 41 个平台组件/页面纯函数用例） |
| Playwright | mock 项目（webui-mock.spec.ts 3 用例） | 全过（含 082 迁移页语义组件 QA）；dev 项目未跑（需真实后端，留待后端联调） |
| Build | `vite build` | 成功（bundle ~326KB gzip，较 068 基线小幅增长，新语义组件预期内） |
| 文档 | docs-guard / webui 指南 | 通过（082 章节已写入） |

## 未执行/受限项

- Playwright **dev 项目**（`webui.spec.ts` 20 用例）：需真实后端 + 首次设置，未在实施轮执行；实施轮的浏览器验证以 mock 项目（全部 WebUI 零后端可浏览）为基线，dev 全量留待后端联调轮。
- 后端能力扩展（用户活动明细、审计完整元数据、部门移动/归档、organization 列表过滤）：R003 否决或列为 082 之外（R002 边界）。
- Command 实体检索（方案「五十七」后半）、多实例/远程模块/复杂图表/无真实需求的 Export-Batch-DnD-Analytics：候选（方案「六十八/六十九」防过度设计）。
- `DEC-082-004` IA 归位（audit→Governance、openapi→Developer）待确认新顶层组结构（图标/落地页）后实施；`DEC-082-006` Query 统一层页面接入按范围确认渐进落地；`DEC-082-002` RHF/zod 表单库契约保留待表单页迁移接入。