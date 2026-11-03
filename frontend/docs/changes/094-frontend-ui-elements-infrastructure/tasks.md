# 094 线性任务与证据

本清单是唯一完成清单。确认后按依赖顺序连续执行，阶段之间不增加人为确认；只有研究触发器命中或目标/公共接口/依赖/边界/外部副作用发生实质变化时才退回研究和待确认。

## 研究与计划

- [x] `RES-094-001` 实际访问 TailAdmin 当前 UI Elements 22 页并记录结构、状态、组合与局限；依赖：无；完成条件：全部页面有裁决输入，不复制 Demo；证据：R094-001、`frontend/docs/ui-visual-calibration.md`。
- [x] `RES-094-002` 审计当前 frontend 代码、依赖、调用、页面、门禁、Git 和质量基线；依赖：无；完成条件：已实现/缺口/推断/候选分离；证据：R094-002，HEAD `22bf5d7`，`pnpm check` 基线。
- [x] `RES-094-003` 复核 HeroUI v3 与 Tailwind CSS v4 当前官方组合、styling、theme variables 与 variants；依赖：RES-094-002；完成条件：官方事实、项目推断、版本边界和刷新条件明确；证据：R094-003、当前 package/lockfile。
- [x] `PLAN-094-001` 形成覆盖全部目标的需求、详细设计、页面迁移和验证路线；依赖：三项研究；完成条件：固定产物齐全、原目标 14 条有证据映射、条件性候选有明确裁决、单轨顺序明确且非 MVP；证据：`requirements/`、`design/completion-traceability.md`、本文件。
- [x] `PLAN-094-002` 将 HeroUI v3 与 Tailwind CSS v4 官方互补模型固化为当前前端长期规则；依赖：RES-094-003；完成条件：`frontend/AGENTS.md` 明确官方结合面、职责边界、`tv` 使用条件、门禁证据和刷新触发器，项目 README 可发现变更入口与长期规则；证据：`frontend/AGENTS.md` 4.1、9 节，`frontend/README.md`。
- [x] `CONFIRM-094-001` 用户在 094 计划报告后的后续消息明确确认当前计划；依赖：PLAN-094-001；完成条件：记录确认消息；证据：2026-08-30 用户回复“确认，实施”。
- [x] `BASELINE-094-001` 实施入口增量基线检查；依赖：CONFIRM-094-001；完成条件：记录 revision、Git 状态、相关漂移与 refresh trigger 判定，保护用户改动；证据：HEAD `22bf5d786ece18cd9ad5913deca4d4706f3e6508` 与研究快照一致，`frontend/` 除用户标题和本任务文档外无漂移，README 实施入口基线。
- [x] `BASELINE-094-002` 修复并复验 Reference full-page screenshot 高度抖动；依赖：BASELINE-094-001；完成条件：根因明确，连续定向运行稳定，不扩大阈值掩盖；证据：`visual.spec.ts` 等待 Reference heading 与 49 行 DataTable 确定性就绪；Lint/typecheck 通过，5-worker 全套 18/18 通过，8-worker `--repeat-each=3` 54/54 通过，截图阈值未变。

## Foundations 与核心契约

- [x] `FND-094-001` 补齐 Control/Icon Size、Focus、Motion、Layer 和 Surface 语义 Token；依赖：BASELINE；完成条件：公共几何/状态由 Token 单源控制，Light/Dark 一致，Tailwind CSS v4 负责布局、响应式、主题、密度与视觉组合；证据：`tokens.css`、`motion.ts`、最终 Light/Dark/density/viewport 快照。
- [x] `FND-094-002` 扩展样式与依赖门禁；依赖：FND-094-001；完成条件：非法 HeroUI import、vendor props/slot 泄漏、内部 DOM selector、原生控件、页面视觉补偿、硬编码稳定几何和无行为控件有正反 fixture；证据：`boundary-policy.mjs`、10/10 fixture、78 个源码通过。
- [x] `FND-094-003` 建立 HeroUI v3 与 Tailwind CSS v4 官方互补验证矩阵；依赖：FND-094-002；完成条件：每个新增/修改 Element 均记录官方 primitive/compound anatomy、documented state/slot 与 accessible state；多维 Variant/compound slots 在 Adapter 内复用 `@heroui/styles` `tv`/官方 variant 基线，Semantic Token/Tailwind 承担项目视觉，没有重复状态机或 vendor DOM 穿透；证据：R094-003、组件契约设计、Adapter contract/DOM/Axe/Visual 证据。
- [x] `ACT-094-001` 完整化 Action/IconAction；依赖：FND；完成条件：左右 Icon、size、disabled、loading、danger、focus 和防重复完整，旧 API 单轨迁移；证据：`ui-element-actions.test.tsx`、Showcase、Playwright Action 场景。
- [x] `ACT-094-002` 建立真实 Toggle/Action Group 语义；依赖：ACT-094-001；完成条件：互斥/组合行为接入真实设置或集合场景，不存在静态按钮组；证据：HeroUI `ToggleButtonGroup` Adapter、Preferences density、unit/page e2e。
- [x] `IDN-094-001` 建立 Avatar 与 UserIdentity；依赖：FND；完成条件：image/fallback/size/presence 与 label/description 组合完整，接入 Shell 和数据 Cell；证据：`identity.tsx`、foundation unit、Shell/Reference/Showcase 调用与视觉。
- [x] `NAV-094-001` 建立 BreadcrumbTrail 并迁移 PageHeader；依赖：FND；完成条件：current/href/disabled/aria-current 正确，删除 Web 私有实现；证据：`navigation.tsx`、PageLayout 迁移、旧私有 PageHeading/Breadcrumb 删除。
- [x] `NAV-094-002` 建立 TextLink/Host Router Link 边界并迁移命令式导航；依赖：ACT、NAV；完成条件：导航不伪装 Action，UI Adapter 不依赖 React Router；证据：`TextLink`、`router-text-link.tsx`、Overview/Shell 迁移、架构门禁。
- [x] `NAV-094-003` 建立 PaginationControl 与集合 Pagination Pattern；依赖：FND；完成条件：current/disabled/ellipsis/keyboard/long total 完整并连接真实集合；证据：Showcase 长页数、Reference 48 条集合按 12 条分页、unit/e2e/visual。
- [x] `ASYNC-094-001` 建立 BusyIndicator 与 Loading Composition；依赖：FND；完成条件：局部/内容/页面等待分轨，迁移直接 Loader，实现 reduced-motion/a11y；证据：`BusyIndicator`、`AppLoadingSurface`、States/Error/Router 迁移与状态测试。

## Feedback、Surface、Overlay 与 Form

- [x] `FBK-094-001` 建立显式 FeedbackProvider/Toast 契约；依赖：FND、ACT；完成条件：tone/title/description/action/close/loading 可用，Feature 不直接消费 vendor queue；证据：`feedback-context/provider.tsx`、provider unit、Preferences/Reference/Showcase e2e 与 Axe。
- [x] `FBK-094-002` 复核 Alert/Notification/Badge/Status 边界并补 dismiss/announcement 组合；依赖：FBK-094-001；完成条件：静态/动态播报与作用域明确，无重复反馈 API；证据：feedback/status unit、Notification dismiss/restore、Toast direct URL。
- [x] `SURF-094-001` 建立 Card Anatomy 并收窄 Panel；依赖：FND；完成条件：Card Header/Content/Footer 与 Section Surface 分离，嵌套只有一个视觉 owner；证据：`card.tsx`、foundation unit、Overview/Foundation/Showcase/Error/Loading 迁移和视觉。
- [x] `DSP-094-001` 建立 DescriptionList；依赖：FND；完成条件：term/description、缺失值、长文本、窄屏可用并迁移详情；证据：`description-list.tsx`、foundation unit、Reference detail/Showcase visual。
- [x] `OVR-094-001` 收紧 Menu/Popover/Tooltip Trigger 与 action 完整性；依赖：ACT；完成条件：可见 item 必有 handler，disabled/danger/focus/escape 完整，Showcase 无空动作；证据：必填 handler 类型、Shell/Showcase 真实 action、10 项 Overlay e2e/Axe。
- [x] `OVR-094-002` 完整化 Dialog 并新增 Confirm/Destructive Confirm；依赖：ACT、FBK；完成条件：普通/危险确认、pending/disabled、focus trap/restore、nested overlay 可验证；证据：Confirm unit、取消/确认/focus restore e2e、Dialog/Confirm visual。
- [x] `OVR-094-003` 复核 Drawer/Command 与 Overlay Surface owner；依赖：OVR-094-001；完成条件：Header/Body/Footer/Scroll/Close 单 owner，无页面 selector 修补；证据：Adapter anatomy、打开态 DOM/Axe/visual，页面 selector 扫描零违规。
- [x] `FORM-094-001` 新增 RadioGroupField 并收口 SearchField/Field Frame；依赖：FND；完成条件：Radio/Checkbox/Switch/Select/Search 边界清晰，旧 Search 导出单轨删除；证据：HeroUI RadioGroup、Reference Form/Showcase、unit/e2e。
- [x] `FORM-094-002` 验证完整 Form Control 状态矩阵；依赖：FORM-094-001；完成条件：default/focus/invalid/disabled/selected/long/locale/narrow 与 Overlay scroll 全覆盖；证据：Showcase matrix、Form e2e、Select/Combobox/DatePicker 打开态与 mobile dark English visual。

## Data、Pattern 与全页面迁移

- [x] `DATA-094-001` 扩展 DataTable 排序与多选项目契约；依赖：FND、ACT；完成条件：sort/single/multiple/row header/empty/keyboard/overflow/density 完整且不泄露 HeroUI 类型；证据：项目 selection/sort union、3 项 data unit、DataTable e2e/Axe。
- [x] `DATA-094-002` 建立 Collection Toolbar/Filter/Pagination/Bulk Action Pattern；依赖：DATA-094-001、NAV-094-003；完成条件：真实集合状态联动，filter/sort 后页码归一，bulk action 可执行；证据：Reference 48 条集合、12/页、筛选/排序/多选/导出 e2e 与视觉。
- [x] `PAT-094-001` 收口 PageHeader/Toolbar/FilterBar/Section/SplitView/FooterActions 的单 Surface owner；依赖：SURF、FORM、DATA；完成条件：无成形组件套成形组件和页面补偿；证据：PageLayout contract、Card/Panel 分轨、1440/1920/390 visual 与边界门禁。
- [x] `MIG-094-001` 迁移 App Shell 与 Host 边界；依赖：ACT、IDN、NAV、OVR、FBK；完成条件：原生/无行为 header controls 清零，账号/通知/导航均有真实语义；证据：IconAction/MenuButton/UserIdentity/Command 接入、原生控件扫描零、mobile overlay visual。
- [x] `MIG-094-002` 迁移 Overview 与 Foundations；依赖：SURF、DSP、NAV；完成条件：Dashboard/Card/Metric/Navigation 使用新契约；证据：Card/RouterTextLink 调用、Overview/Foundation unit/visual。
- [x] `MIG-094-003` 迁移 States、Error Boundary 与 Hydrate Loading；依赖：ASYNC、FBK、SURF；完成条件：Loading/异常/恢复无重复视觉实现；证据：Busy/Card/StateSurface 单轨、States/Router/Error tests 与 visual。
- [x] `MIG-094-004` 迁移 Preferences；依赖：FORM、FBK、ACT Group；完成条件：选择、submit、dirty/saved/toast/reduced motion 完整；证据：ToggleGroup/FeedbackProvider、Preferences e2e/visual。
- [x] `MIG-094-005` 迁移 Reference Workspace 列表/详情/Toolbar；依赖：DATA、DSP、IDN、OVR、FBK；完成条件：sort/pagination/multi-select/bulk/confirm/toast/detail 全部连接确定性真实状态；证据：Reference e2e、桌面/超宽/多选 visual、48 条确定性数据。
- [x] `MIG-094-006` 迁移 Reference Form；依赖：FORM、SURF、ASYNC、FBK；完成条件：Radio/Section/Card/Pending/Error/Success/sticky actions 完整；证据：Reference Form e2e/visual 与 Toast feedback。
- [x] `SHOW-094-001` 重组并补齐 Showcase 全 Family；依赖：全部 Element；完成条件：每个公开 Element 的 variants/states/edge cases 可见，22 个 TailAdmin 样本均有最终裁决；证据：Showcase Family matrix、R094-001 22 页裁决、desktop/mobile visual。
- [x] `SHOW-094-002` 为全部关键 Overlay/Toast/Confirm/Data 状态提供直接 URL 或确定性开关；依赖：SHOW-094-001；完成条件：视觉测试不依赖脆弱点击时序；证据：`overlay=...|confirm|toast`、`data=empty`、`density=compact` e2e/visual。

## 清理、文档、验证与提交

- [x] `CLEAN-094-001` 删除旧私有组件、旧导出、空 action、重复样式与失效文档；依赖：全部迁移；完成条件：旧符号/原生基础控件/无行为控件/直接 HeroUI/页面硬编码扫描零违规；证据：删除 PageHeading、迁移 Loader/私有 Breadcrumb，源码扫描与 architecture gate 通过。
- [x] `DOC-094-001` 同步当前项目 UI Element、视觉校准、README 与 094 变更状态；依赖：迁移完成；完成条件：`frontend/docs` authority 只描述真实终态，不修改父目录文档；证据：`docs/ui-element-system.md`、`docs/ui-visual-calibration.md`、README、AGENTS、094 diff/format。
- [x] `VERIFY-094-001` 运行静态、类型、单元、构建与性能验证；依赖：CLEAN、DOC；完成条件：architecture/dependency/lint/typecheck/test/build/performance/format 全绿；证据：2026-08-31 `pnpm check` 全绿，26/26 unit，initial=382161、total=431494、CSS=43818、largest=167588 bytes。
- [x] `VERIFY-094-002` 运行浏览器交互与 Axe 全矩阵；依赖：VERIFY-094-001；完成条件：Shell、Showcase、Reference、Form、States、Preferences 的键盘/焦点/状态全绿；证据：Playwright 24/24，关键打开态均执行 Axe WCAG AA。
- [x] `VERIFY-094-003` 生成并逐图复核视觉矩阵；依赖：VERIFY-094-002；完成条件：1440/1920/390、Light/Dark、zh/en、density、Overlay 打开态无 P0/P1；证据：22 张 PNG 人工复核，修复 close action、Layer token、1440 SplitView 和 fixed overlay 基线；`--repeat-each=3` 72/72。
- [x] `VERIFY-094-004` 按原目标 14 条、REQ-094-001..012 和本清单做逐项完成审计；依赖：全部验证；完成条件：填写 `design/completion-traceability.md` 每行的实际强证据，条件性候选裁决仍有效，无缺失/弱证据/未决 required work；证据：README 完成记录、完成追踪表与条件性候选裁决。
- [x] `GIT-094-001` 精确暂存并创建 Conventional Commit，不推送、不混入用户改动；依赖：全部任务完成；完成条件：diff/check/status/log 复核通过；证据：本清单随最终 Conventional Commit 入库，commit hash 在交付报告记录。

## 验收纠正

- [x] `AUDIT-094-002` 接受用户验收对初次完成声明的反证并重新打开 Showcase 完整度审计；依赖：GIT-094-001；完成条件：以公共可见导出、运行时 DOM、状态矩阵和视觉证据逐项比对，不把“已导出”或混合 Demo 等同于“已完整实现”；证据：确认旧 Showcase 未独立呈现 IconAction、ToggleGroup、TextLink、Skeleton、ConfirmDialog 等契约，形成 39 个公开可见 Element 清单。
- [x] `SHOW-094-003` 把 Showcase 改造成可直接审计的完整目录；依赖：AUDIT-094-002；完成条件：39/39 每项只有一个独立三级标题、状态清单与真实预览，9 个 Family 可锚点导航，普通/危险 Confirm 分轨，条件性候选不创建空壳；证据：`component-preview.tsx`、`showcase-screen.tsx`、中英文资源和本地 Avatar 资产。
- [x] `VERIFY-094-005` 扩展交互、Axe 与视觉验收并重新运行完整门禁；依赖：SHOW-094-003；完成条件：自动化逐项证明 39/39、9 个 Family 均有独立视觉基线、关键交互和 Axe 全绿、全部 31 张 PNG 人工复核无 P0/P1；证据：`overlays.spec.ts` 13/13、`visual.spec.ts` 9/9、完整 `pnpm check` 28/28 浏览器用例，performance initial=386201、total=440225、CSS=43858、largest=171600 bytes 及完成追踪表。
- [x] `GIT-094-002` 精确暂存并创建验收纠正 Conventional Commit，不推送、不混入 `AGENTS.md` 用户标题和父目录改动；依赖：VERIFY-094-005；完成条件：diff/check/status/log 复核通过；证据：本清单随纠正提交入库，commit hash 在交付报告记录。
