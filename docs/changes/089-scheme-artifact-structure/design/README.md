# 089 详细设计

支撑研究：[R089-001](../research/R089-001-current-scheme-artifact-gap/report.md)；客户需求见[需求入口](../requirements/README.md)。

## 设计摘要

新方案把需求和设计定义为一级目录产物，而不是单一 Markdown 文件。两个目录分别提供受众明确的 `README.md` 入口和至少一份语义分篇；`tasks.md` 保持单一账本，并用 checkbox 作为唯一完成状态。

## 关键决策

- `DEC-089-001`：新方案结构统一为 `requirements/`、`design/`、`tasks.md`。
- `DEC-089-002`：目录入口只做摘要、边界和导航，实质内容进入语义分篇。
- `DEC-089-003`：需求与设计按受众隔离，任务清单不复制正文。
- `DEC-089-004`：历史记录不迁移，新的实质方案用新序号单轨记录。

## 文档索引

- [目录、内容与状态契约](artifact-directory-contract.md)：目录布局、职责、详细设计深度、链接和验证规则。
