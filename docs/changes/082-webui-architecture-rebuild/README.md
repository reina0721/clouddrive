# 082 WebUI 产品架构与 UI 体系重构

## 状态

**已确认，实施完成**（2026-08-27 用户确认「确认 082 方案，实施」；dev e2e 待真实后端联调）。方案输入 `docs/changes/temp-new-changes.md`（81 章「前端产品能力系统性重构」纲领，commit `3b758bd`）；三份研究档案完成现状审计与差异分析（R003 §4.11 含方案新旧编号映射）；requirements/design/tasks 已按新版方案对齐并展开详细设计（逐 REQ 实现契约）；决策点已确认并执行（DEC-082-001..006，DEC-004 IA 归位 governance/developer 组落地）。实施覆盖平台底座（DataTable/FilterBar/FormField/状态反馈/语义组件/token/Query 契约）与全部页面迁移（IAM/Auth/Ops/Org/Navigation/Token/UserDetail/Sessions/Menu 归位）+ 三层 QA e2e 基线。验证：`go test ./...`、`go vet ./...`、Vitest 192、mock E2E 3、lint（modules/i18n/architecture）、build 全绿；Playwright dev 20 用例待真实后端联调（受限环境，见 tasks.md）。

## 目标

按方案把当前 WebUI 从「后端能力可视化 + UI 组件呈现」演进为完整 Administration Control Plane。以 R003 差异矩阵为范围裁剪依据：已满足 28 节不重做、部分满足 42 节补齐、未满足 4 节新增、候选 6 节作为验收输入（编号对应新版章节见 R003 §4.11）；后端 55 operation/23 权限键是页面↔operation 映射唯一事实来源，禁止 fake 后端不存在能力（方案「六十五」红线）。新版方案新增的要求（Query/Mutation 统一层、Backend 错误分类、Frontend Adapter 层、Session 管理、Token 成熟管控、三层 QA、复杂度匹配）已作为 REQ-082-009..011/021/022/024 纳入计划。

## 阅读顺序

1. [研究档案](research/README.md)：R001（WebUI 现状审计）、R002（后端能力清单）、R003（方案差异分析 + 新旧编号映射）
2. [需求](requirements.md)：REQ-082-001..025、决策点 DEC-082-001..006、非目标与验收标准
3. [设计](design.md)：平台底座/页面迁移/打磨三段交付、数据流、验证方案
4. [任务清单](tasks.md)：任务与验证矩阵（待确认）