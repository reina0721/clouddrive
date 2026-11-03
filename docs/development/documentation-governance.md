# 文档治理规范

本文是“实现变化必须同步评估文档”的当前 authority。它补充开发规范，不复制架构、配置或业务实现说明。

## 当前 authority 规则

入口固定为：根 `README.md` → `docs/README.md` → 当前主题文档 → 局部 README。`docs/changes/` 保存任务证据，`docs/research/` 保存快照研究，二者不能成为当前行为的唯一说明。

一个主题只能有一个当前 authority。局部 README 说明目录职责、契约、资源所有权、命令和验证，并回链主题 authority；不得复制另一篇文档的完整正文。

`old-backend/` 是仓库范围外的排除目录：docs guard 不扫描其内部，不要求其 README 或索引，也禁止当前 authority 把它作为实现入口。

## 变更触发矩阵

| 变化类型 | 必须评估的文档 | 最低证据 |
| --- | --- | --- |
| 新技术、依赖或 Adapter | 架构、能力、开发、配置、运维 | 选择理由、边界、错误/资源语义和验证 |
| 新业务模块或 binding | 模块索引、局部 README、模块开发、API/CLI/WebUI/配置 | owner、真实用例、契约和入口 |
| 新功能或用户路径 | 根 README、getting-started、first-use、API/WebUI | 用户如何启动、使用和验收 |
| 新 CLI 或启动方式 | 根 README、getting-started、运维 | 命令、前置、失败语义和停止方式 |
| 新配置键、默认值或 reload | configuration、示例、运行能力矩阵、相关主题 | owner、默认、校验、敏感性和 reload 行为 |
| API、协议或生成物 | API authority、调用示例、模块 binding、变更决策 | code-first 来源、兼容性和生成验证 |
| 生命周期、外部资源或后台任务 | architecture、operations、诊断、日志/错误文档 | owner、取消、超时、关闭、重试和外部验证 |
| 构建、CI、容器或 release | development/build、operations、质量入口、项目范围 | 实际命令、平台、产物和未执行门禁 |
| 纯文档或研究 | 对应 authority、research/change 记录 | 当前事实与历史证据边界 |

## 文档影响记录

从变更 051 起，包含非文档实现的 change 目录必须有 `documentation-impact.yaml`。每个被路径映射命中的主题写一项：

```yaml
schema_version: 1
change: 051-documentation-system-governance-closure
areas:
  - id: webui
    decision: updated
    documents:
      - docs/getting-started/webui.md
    reason: 启动或 WebUI 质量路径发生变化
```

`updated` 必须列出允许的当前 authority，且该文件必须出现在同一 diff；`reviewed-no-change` 必须写出具体、不为空的理由。不能用“以后补文档”、`TODO` 或泛化的“已检查”替代证据。

## 完成前自检

1. 运行对应的 Go、WebUI、文档或外部协议验证。
2. 检查根入口、当前 authority、局部 README 和生成物是否同步。
3. 更新 `documentation-impact.yaml`，确认每个命中主题都有 decision。
4. 运行 `scripts/Verify-Docs.ps1` 或 `scripts/verify-docs.sh`。
5. 如新事实改变目标、公共接口、依赖、模块边界、迁移或外部副作用，退回研究/计划并重新确认。
