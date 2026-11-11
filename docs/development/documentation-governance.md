# 文档治理规范

当前说明从根 README → docs/README → 主题 authority → 局部 README 进入。一个主题保留一个当前 authority，其他位置用链接引用。根工程规则见[Agent 日常流程](agent-workflow.md)，验证见[开发验证策略](validation.md)。

## 随行为同步

- 功能与用户路径变化：更新相关使用说明、限制和必要示例。
- API、CLI、配置与启动变化：更新实际契约、前置条件、错误和命令。
- 依赖、生命周期、权限或交付边界变化：更新架构、运维、安全约束或重要 ADR。
- 局部实现细节没有改变文档语义：交付中说明即可，不为记录而改 README。

不要求每个功能创建变更目录、research/requirements/design/tasks 或 documentation-impact.yaml。研究只在事实缺口或重要选型需要时记录；难以逆转的决定进入 [ADR](../architecture/adr/README.md)。Git 和提交说明保存变更历史。

## 文档检查

根 `scripts/verify-docs.sh` / `Verify-Docs.ps1` 检查当前文档、链接、锚点、模块/能力索引及入口可达性；前端 `pnpm docs:check` 检查当前主题与链接。检查器不要求历史任务目录，也不要求每次源码修改提供影响账本。

历史研究材料独立于当前规范。引用已移出工作树的材料使用明确 revision 的 Git 历史定位；当前使用说明不得依赖已删除的本地文件。`old-backend/` 仍在范围外，不扫描其内部，不以它作为当前实现入口。
