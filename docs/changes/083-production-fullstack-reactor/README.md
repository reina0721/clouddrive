# 083 Production-grade 全栈产品重构（WebUI 产品化二期）

## 状态

**已确认，实施完成（2026-08-28；视觉终审通过，dev e2e 与移动视口真机待真实环境）**。样式权威重建（lint CSS 规则 + 反向 fixture + `:global` 平台类清零）、布局骨架重写（`100dvh`/独立滚动/宽度档接线/移除 Tab Bar 与 Footer/Settings 单入口）、页面产品化（Audit 分页+时间戳、FilterBar typed filters、后端 account sorting 白名单、操作列折叠、危险操作确认、状态组件统一）全部落地；**codex 多模态视觉验证闭环**——P0（插值泄漏/相对时间缺键）与 P1（圆角 10px/行菜单折叠/Settings 宽度/统计卡圆角）全部修复并经 codex 复核，5 页系统性终审无新缺陷。验证：`go test ./...`、`go vet ./...`、contract-gen 匹配、Vitest 199、lint（modules/i18n/architecture）、mock E2E 4 用例、build 全绿；Playwright dev 20 用例待真实后端（受限环境，见 tasks.md）。

## 背景

082 已完成 WebUI 平台底座（DataTable 增强/FilterBar/FormField/状态反馈/语义组件/token/Query 契约）与全部主页面迁移（IAM/Auth/Ops/Org/Navigation/Token/UserDetail/Sessions/Menu 归位），Vitest 192 / mock E2E 3 / lint / build 全绿（2026-08-27 记录）。随后用户重写方案为「Production-grade 全栈产品重构」，并补充声明：**不替换当前组件栈（HeroUI/RAC/Tailwind），缺口用成熟技术补齐、优先成熟第三方而非自研**；同时指出**样式污染（122 处 `:global` 泄漏）与布局骨架缺陷（`100vh`/居中 `max-width`）**是真实存在、导致新增需求后交互出问题的架构缺陷。

## 研究问题（R083-001..003）

1. **新方案 vs 082 现状差异**：每节（1-12、11b/11c/11d）在当前已实现下是已满足/部分满足/未满足/冲突，可落地范围与决策点（R083-001：四裁决点 A 推倒 App Shell 分治 / B 移除 Tab Bar / C Backend 补足（sorting 必补）/ D 组件栈确认无冲突；三档落地）。
2. **样式权威与布局骨架事实基线**：**实测 7 模块 CSS 共 137 处 `:global(`**（auth 9/iam 25/navigation 15/openapi 0/ops 75/organization 5/settings 8；与早期表述 122 不符，已更正）；其中 21 处死代码、1 处真全局泄漏（ops header-zone-action）、`.toolbar` 私有覆盖、camelCase 命名分裂均有证据；`100vh` 全仓 11 处、零 `dvh`，`.page-viewport` 居中 max-width:1600，滚动发生在内容容器内（R083-002）。
3. **设计基线落地缺口**：082 各页面逐页对照 admin-design-baseline，判定达标/需重做（R083-003，建设中）。

## 阅读顺序

1. [研究档案](research/)（R083-001 差异分析 / R083-002 样式布局基线 / R083-003 页面对照）
2. [需求](requirements.md)（计划中）、[设计](design.md)、[任务](tasks.md)
