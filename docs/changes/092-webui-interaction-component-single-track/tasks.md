# 092 任务与证据

## 研究与计划

- [x] R092-001 刷新 091 后组件来源事实；证据：`research/R092-001-interaction-source-refresh/`。
- [x] PLAN-092-001 完成需求、设计与任务清单；证据：`requirements/`、`design/`、本文件。
- [x] CONFIRM-092-001 用户在计划报告后明确要求实施；证据：用户消息“PLEASE IMPLEMENT THIS PLAN”。
- [x] BASELINE-092-001 记录 revision 与工作区；证据：`6f6396f`，9 个既有改动路径均保留，重叠文件增量处理。

## 实施

- [x] UI-092-001 统一文本、搜索、数字、日期、日期时间和文件选择；完成条件：页面零直接 input/select/textarea；证据：`webui/src/ui/forms.tsx` 与 architecture scan。
- [x] UI-092-002 统一 Button、Toggle、Radio、Tabs、Disclosure、ComboBox 与 Tree；完成条件：页面零直接 button 和手写复合 role；证据：宿主/模块源码扫描通过。
- [x] UI-092-003 迁移 DataTable selection、宿主、业务模块和 OpenAPI 工作台；完成条件：通用交互全部经 SDK UI；证据：WebUI 全量测试 51 files/252 tests。
- [x] UI-092-004 删除旧实现、旧样式和失效键盘状态机；完成条件：旧符号和选择器零引用；证据：`rg` 交互来源扫描。
- [x] GATE-092-001 增加组件来源 architecture lint 与正反 fixture；完成条件：违规样本失败、合规样本通过；证据：`node --test scripts/interaction-rules.test.mjs`。

## 验证与交付

- [x] VERIFY-092-001 组件与页面测试覆盖计划场景；证据：`corepack pnpm test -- --run`，51 files/252 tests passed。
- [ ] VERIFY-092-002 完整 Playwright 与视觉复核；证据：记录 41 场景结果和截图审阅。
- [x] VERIFY-092-003 WebUI/Go/diff 全量门禁；证据：Verify-WebUI、`go build ./...`、`go test ./...`、`git diff --check` 均通过。
- [x] DOC-092-001 同步当前 WebUI authority 与变更导航；证据：`docs/development/webui.md` 与本变更目录。
- [x] GIT-092-001 精确暂存并创建 Conventional Commit；不推送、不包含无关用户改动；证据：提交 `feat(webui): unify interaction components`，未暂存既有文档删除、E2E 与 filter-bar 用户改动。
