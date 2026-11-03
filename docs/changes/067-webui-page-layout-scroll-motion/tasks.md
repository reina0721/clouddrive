# 067 WebUI 业务页面布局骨架与滚动/动效体验 — 任务清单

> 依赖：研究门禁通过（R067-001/R067-002）；计划按 design.md 第 11 节推荐项实施（用户「新增修复方案」直连需求 + 审批策略 never，本任务在计划报告后不再单独等待确认消息，按已确认状态执行）。

## 任务总览

| ID | 任务 | 依赖 | 完成条件 |
| --- | --- | --- | --- |
| LAY-067-A | 组织模块报错修复 | — | REQ-A1..A3 |
| LAY-067-B | 平台布局骨架原语与样式 | A | REQ-B1、B3 |
| LAY-067-C | 业务模块页面迁移 | B | REQ-B2、B4 |
| LAY-067-D | 滚动体验运行时（Lenis/边缘/劫持/磁吸） | — | REQ-C1..C5 |
| LAY-067-E | 弹入响应 Reveal | D（token 共享） | REQ-E1..E3 |
| LAY-067-F | 派生配置（theme/抽屉/迁移） | D、E | REQ-D1..D4 |
| LAY-067-G | Shell 集成 | D、F | REQ-C1、D4 |
| LAY-067-H | 测试与验证（单测/e2e/构建） | A..G | 第 10 节验证矩阵 |
| LAY-067-I | 文档同步与提交 | H | documentation-impact + authority 更新 + commit |

## 任务明细

### LAY-067-A 组织模块报错修复

- [x] 研究：确认根因（R067-001）
- [x] A1：org locale en-US/zh-CN 键重命名（assignments.*）+ 新增 `webui.organization.error`
- [x] A2：Departments/Positions/Assignments 操作失败反馈（catch → page 呈现）
- [x] A3：组织 locale 键一致性用例 + 检查无缺失键占位（e2e 新增占位断言）

### LAY-067-B 平台布局骨架原语与样式

- [x] B1：`webui/src/ui/index.tsx` 新增 PageSection/StatCard/StatGrid/DataCard 并导出（sdk/ui 透传）
- [x] B2：`styles.css` token（--reveal-*/--edge-band-*/--scrollbar-slot 等）与 public UI 布局原语样式
- [x] B3：平台布局样式 lint 复核（lint-architecture 通过）

### LAY-067-C 业务模块页面迁移

- [x] C1：iam Accounts/Roles/Permissions/Sessions/Security
- [x] C2：organization Departments/Positions/Assignments
- [x] C3：auth Audit、navigation Menus
- [x] C4：ops Dashboard/Capabilities
- [x] C5：模块 CSS 收口（删除被平台替代的 selector，braces 校验通过）

### LAY-067-D 滚动体验运行时

- [x] D1：`pnpm add lenis` + 更新 package.json/pnpm-lock.yaml
- [x] D2：`webui/src/scroll/smooth-scroll.ts`（SmoothScrollController，工厂注入）
- [x] D3：`webui/src/scroll/edge-band.ts`（computeEdgeBand + EdgeBand）
- [x] D4：`webui/src/scroll/scroll-hijack.ts`、`snap.ts`
- [x] D5：`ScrollExperience.tsx` Provider 装配

### LAY-067-E 弹入响应

- [x] E1：`webui/src/motion/use-in-view.ts`（IO + 回退）
- [x] E2：`webui/src/motion/reveal.tsx`（Reveal/RevealList，节奏预设）
- [x] E3：Reveal 样式与 reduced-motion 降级

### LAY-067-F 派生配置

- [x] F1：`theme.ts` experience 类型/默认/迁移/applyTheme
- [x] F2：ThemeDrawer 体验面板 + host locale 文案
- [x] F3：experience/theme 单测

### LAY-067-G Shell 集成

- [x] G1：AppShell `.page-flow` + ScrollExperience 挂载
- [x] G2：BlankLayout 窗口模式挂载；app-shell 测试同步（renderToStaticMarkup 兼容）

### LAY-067-H 测试与验证

- [x] H1：scroll/edge-band/snap/hijack/reveal/theme/ui 单测（Vitest 109 项全绿）
- [x] H2：更新 e2e（webui.spec.ts 语义等价调整 + 新增 3 条 067 用例）
- [x] H3：新增 e2e 体验/布局/占位断言 + 截图（test-results/067-*.png）
- [x] H4：全量静态门禁（typecheck/lint/lint:modules/test/build/generate:check/e2e）
- [x] H5：Go 侧回归哨兵（go build ./...）

### LAY-067-I 文档同步与提交

- [x] I1：`docs/development/webui.md`、`webui/README.md`、`docs/architecture/technology-selection.md`、`docs/changes/README.md` 更新
- [x] I2：`documentation-impact.yaml` 提交
- [x] I3：按 git-conventional-commit 审阅工作区并提交

## 验证矩阵（H 任务的证据）

| 检查 | 命令 | 期望 |
| --- | --- | --- |
| 类型 | `pnpm typecheck` | 0 错误 |
| lint | `pnpm lint` | 0 error（允许既有 warning 修复） |
| 模块 lint | `pnpm lint:modules` | 0 问题 |
| 单测 | `pnpm test` | 全绿（新增 scroll/motion/theme/ui/e2e 用例） |
| 构建 | `pnpm build` | 成功 |
| 生成 | `pnpm generate:check` | 一致 |
| e2e | `pnpm e2e -- --workers=1` | dev+mock 全绿，截图人工复核 |
| Go 回归 | `go build ./...` | 成功 |

## 状态记录（逐轮更新）

- 2026-08-25：研究门禁通过；计划建立，按「用户直连需求 + 审批 never」以已确认状态执行。