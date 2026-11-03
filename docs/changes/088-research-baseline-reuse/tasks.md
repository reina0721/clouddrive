# 088 任务与证据

## 当前门禁

本任务是纯文档治理变更。R088-001 研究门禁已通过，按纯文档例外完成计划和实施，不修改任何 087 实施文件。

## 任务清单

| ID | 任务 | 完成条件 | 状态 |
| --- | --- | --- | --- |
| `RES-088-001` | 审计 013 门禁、087 案例和当前规则缺口 | 事实、推断、边界和刷新条件可复核 | 完成 |
| `PLAN-088-001` | 形成基线复用和增量漂移判定设计 | REQ/DEC/文件影响/验证齐全 | 完成 |
| `GOV-088-001` | 更新 `AGENTS.md` 强制规则 | 禁止无触发条件的全量复研 | 完成 |
| `DOC-088-001` | 更新研究方法 authority | 四步增量判定和验证分类清晰 | 完成 |
| `VER-088-001` | 验证文档和提交范围 | docs guard、链接、metadata、Diff 和空白检查通过 | 完成 |

## 实施边界

- 不触碰当前正在变更的 087 源码、生成物和计划文档。
- 只暂存并提交 088 自身与两个流程 authority 文件。
- 本任务没有 Go/WebUI 行为变化，不运行全量代码测试。

## 验证证据

- `./scripts/Verify-Docs.ps1 -BaseRef HEAD`：通过，全局文档拓扑、相对链接和 metadata 结构有效。
- `git diff --check -- AGENTS.md docs/research/README.md docs/changes/088-research-baseline-reuse`：通过。
- 088 固定文件和 metadata 必填字段检查：通过。
- 不带 `BaseRef` 的全工作树 docs guard 受并行 087 非文档修改且尚未完成 `documentation-impact.yaml` 阻断；该失败不来自 088，本任务不修改或代替 087 的文档影响记录。
