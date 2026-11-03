# 090 成熟后台控制台重设计

## 状态

- 任务性质：包含前端与后端非文档变更的产品级重设计。
- 研究门禁：已通过；当前事实、外部参照与能力缺口已形成可复核档案。
- 计划状态：已确认（用户消息“确认 090 计划”）。
- 实施状态：090 的 P0 后端契约、统一设计系统、页面骨架、功能组件和全量页面矩阵均已实施完成。收尾已补齐批量选择/确认/pending/逐项失败/失败项重试闭环，以及 1440/1280/1024/768/390、亮暗、normal/compact、长文本和高密度场景的视觉与可访问性审阅；证据见 `tasks.md` 与 `verification/README.md`。剩余未勾选项仅为不阻断 090 完成的 P1/P2 候选（组织成员反向查询、账户活动投影、异步 Job、真实历史指标），必须在出现真实业务规模或独立确认后另行研究。

## 目标

把现有 Web UI 从“页面和组件数量已初具规模、但整体仍像开发中 Demo”的状态，演进为具备统一布局、稳定设计语言、业务语义组件、高效管理流程和长期扩展能力的正式后台控制台。

这不是一次换色或局部样式优化。方案覆盖：

- 全局信息架构、导航和页面骨架；
- Design Token、基础组件、功能模式组件与页面模板；
- 列表、详情、表单、设置、工作台和仪表盘等主要后台场景；
- 搜索、筛选、批量操作、加载、空状态、错误和部分失败等完整交互；
- 当前后端能力与成熟管理台所需查询、详情、审计、统计和批处理契约之间的差距；
- 单轨迁移、视觉回归、响应式、可访问性和工程验证。

## 核心结论

当前 UI 的主要问题不是“颜色不够好看”，而是视觉层级、空间分配、容器策略和业务表达没有形成一致的系统：全局栏层数偏多、侧栏与设置局部导航占宽过大、页面标题重复、卡片成为默认容器、列表工具区缺少模式化、移动工作台溢出，且共享 UI 虽多却集中在一个巨型文件中。前端同时混用 HeroUI v2 与 v3 依赖，Design Token 仍被大量页面级像素值和任意 Tailwind 值绕过。

推荐单轨收敛到 HeroUI v3 + React Aria 的可访问基础、项目自有语义 Token 和后台模式组件；不复制 TailAdmin 的外观，而是吸收其“稳定外壳、轻量层级、内容优先、桌面与移动明确分治”的布局原则。

## 范围边界

本方案会设计并在确认后分阶段实施 Web UI 与必要后端契约。不会：

- 复制参考图或 TailAdmin 的品牌、页面和源码；
- 以假数据、静态占位或隐藏旧实现宣称完成；
- 本批次不伪造后端数据、统计口径或详情能力；缺口继续由 `BE-090-*` 任务跟踪；
- 回退或绕过已完成的 087 显式工作区资格模型。

## 本批次实现证据

- `webui/src/styles.css` 建立中性色后台 Token、壳层尺寸、内容宽度、卡片/表格/筛选器/状态反馈语义，并保留亮暗与密度扩展点；侧栏补齐真实 principal 账号锚点，折叠态保留头像。
- `webui/src/ui/layout.tsx`、`patterns.tsx`、`feedback.tsx`、`forms.tsx`、`data.tsx` 将原巨型 UI 文件拆为页面骨架、业务模式、反馈、表单和数据职责；`layout-pattern.test.tsx` 覆盖骨架结构，账号角色与角色权限编辑均使用带状态的 `StickyActionBar`。
- IAM、Ops、组织、设置、审计、OpenAPI 与导航页面已接入 `PageFrame`；设置组沿用宿主的组级 frame 与子页面 form frame，保证内容宽度和视觉基线一致。账户、角色、权限、会话、API Token、审计和岗位列表统一使用 `ResourceIndex` 的 toolbar/content 顺序，筛选器会以 `ActiveFilters` 展示已应用条件并支持逐项清除，账户/角色管理区使用 `EntityDetail` 身份状态头，设置与组织关键编辑使用 `StickyActionBar`，审计筛选支持 RFC3339 时间范围，审计详情字段按当前语言显示可读标签并保留稳定 JSON 字段名。
- 审计现将已有持久化自增键只读投影为 `eventId`，并把 HTTP request-id 贯通到低敏持久化 `correlationId`，支持服务端筛选、OpenAPI/WebUI 投影、列表列与详情复制；独立 `auth.audit.read` 详情投影已替代列表行快照，保留窗口外事件返回稳定 404，详情抽屉具备加载、失败与重试状态。分页已迁移到服务端稳定游标：按 `(occurredAt,eventId)` 倒序 keyset 翻页（limit+1 探测 `hasMore`），游标为低敏不透明字符串，非法游标返回稳定 `invalid_cursor` 400；HTTP 契约与 OpenAPI 用 `cursor` 替换 `offset`，WebUI 审计页提供会话内上一页/下一页导航。
- 账户批量启停/归档现在要求 `Idempotency-Key`，持久化请求摘要与完整结果并支持安全重放；响应统一返回请求数、处理数、成功资源、逐项稳定失败、可重试标记和 correlation ID，部分成功不再只显示汇总数字。异步 Job 属于 P1/P2，仍按真实规模需求独立研究。
- 跨设备用户偏好已落地（BE-090-005）：新增 `iam_user_preferences` 表与 `iam:account:self:preferences:read/write` 权限，`GET/PATCH /api/v1/iam/self/preferences` 自服务契约按「默认 < 用户覆盖」返回有效偏好（语言/时区/主题/密度/动效/通知），PATCH 部分字段合并且显式区分「未提交」与「关闭」；设置中心 Appearance/Language 页改由服务端持久化，本地投影同步并保留离线降级提示。
- 一致查询语义已收敛（BE-090-001）：IAM 账户/角色/会话/API Token 列表排序经服务层白名单校验，非法排序返回稳定 `invalid_request`（账户列表不再静默忽略、其余资源不再落 500）；过大分页在 HTTP 边界稳定拒绝；审计使用服务端游标分页。
- OpenAPI 工作台完成紧凑化（PAGE-090-007）：wide 保持可调资源栏与编辑/响应分栏，compact（<768px）切换为「资源/请求/响应」三段式单面板导航（`useCompactWorkspace` 容器级断点），长 revision/path/JSON 走自身换行/滚动且不扩大页面宽度，390px 单面板切换 E2E 断言无横向溢出；发送/响应与 mock 禁执行语义保持既有覆盖。
- Dashboard 指标数据源收敛为 typed 投影（PAGE-090-006 / design §8）：新增 `/management/metrics-summary` 返回稳定 key/value/unit/asOf（`pkgobservability.Metrics.Summary` 从进程 registry gather，按 key 排序、失败即错不返回部分数据），WebUI 运维卡片与 Monitoring 改消费 typed 投影，删除 Prometheus 文本解析，不再从前端推断业务语义；raw text 仍服务监控系统。
- HeroUI v3 依赖与 Toast API 已单轨收敛；收尾全量验证：`pnpm typecheck`、`pnpm lint`（eslint 0 errors，仅 4 条既有测试文件 warning）、`pnpm test`（51 files / 251 tests）、`pnpm build`（仅提示大 bundle）、mock Playwright E2E 19/19、Go build/vet/test 全绿、`webui generate --check` 通过。

## 阅读顺序

1. [研究索引](research/README.md)
2. [体验需求](requirements/console-experience.md)
3. [管理工作流需求](requirements/admin-workflows.md)
4. [后端支撑需求](requirements/backend-enablement.md)
5. [设计摘要](design/README.md)
6. [布局系统](design/layout-system.md)
7. [Token 系统](design/design-token-system.md)
8. [组件与交互模式](design/component-and-pattern-system.md)
9. [基础组件规格](design/foundation-component-specifications.md)
10. [数据可视化、搜索与动作系统](design/visualization-command-and-action-system.md)
11. [信息架构与页面蓝图](design/information-architecture-and-page-blueprints.md)
12. [后端契约演进](design/backend-contract-evolution.md)
13. [迁移与验证](design/migration-and-validation.md)
14. [目标覆盖矩阵](design/objective-coverage-matrix.md)
15. [任务清单](tasks.md)
