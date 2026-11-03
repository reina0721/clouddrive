# 088 设计

支撑研究：[R088-001](research/R088-001-implementation-research-duplication/report.md)；需求见 [requirements.md](requirements.md)。

## 决策

### `DEC-088-001` 研究门禁冻结实施基线

研究记录的 revision/日期快照、适用边界、局限和 `refresh_triggers` 在门禁通过后成为实施输入。确认不会自动作废这些证据。

### `DEC-088-002` 实施入口使用增量漂移检查

检查输入只有研究快照、当前 revision/Git 状态、快照后变更路径、计划文件和 `refresh_triggers`。输出为以下三种之一：

- 基线未漂移：直接实施。
- 相关变更但未影响前提：保护变更并继续实施。
- 触发器命中或前提可能失效：定向复核，必要时返回研究。

实施任务不得再包含无对象、无触发条件的“核对当前代码事实”。

### `DEC-088-003` 将研究与实施验证分开

失败用例、运行态复现、红绿测试和修改后回归都属于已确认计划的实施证据。它们验证问题与修改，不重做候选比较、全仓调用链审计或技术选型。

## 文件影响与验证

- `AGENTS.md`：增加强制实施基线复用和增量判定。
- `docs/research/README.md`：增加可执行的四步判定方法。
- `docs/changes/088-research-baseline-reuse/`：保存研究、需求、设计与执行证据。

本任务只修改 Markdown/YAML；验证相对链接、metadata 字段、文档门禁、范围 Diff 和 `git diff --check`，不运行或声称 Go/WebUI 测试通过。
