# 049 设计说明

## 1. 设计依据

本设计引用 R001，只修改当前项目规范的触发语境、证据边界和状态表述。

## 2. 规范命中模型

```text
变更语义
  -> 选择项目 authority
  -> 列出必须遵守的约束
  -> 确认门禁发现目标对象
  -> 执行对应验证
  -> 分别报告已通过 / 部分命中 / 未命中 / 未验证
```

命令结果与发现范围是两个独立条件。只有“目标已被发现”且“验证通过”同时成立，才能说该规范已命中。

## 3. 文档修改设计

### 3.1 应用模块开发

增加语义触发列表，覆盖既有模块新增 SDK/资源/入口、Capability 升级、配置与生命周期变化；明确硬编码清单不能证明未来对象。

### 3.2 WebUI

用矩阵区分：

- Go Catalog/生成器的通用 fixture；
- Auth/Ops Node lint 的当前硬编码范围；
- Vitest/Playwright 能证明的运行状态；
- 未执行或未覆盖对象不能推断为通过。

### 3.3 构建与发布

把 `Verify-Quality` 命名为 Go 后端与仓库产物门禁；WebUI 变更另用 WebUI 指南。release job 只证明自身实际步骤，独立 workflow 必须绑定同 commit 核对。

### 3.4 License

以当前仓库事实为准：源码 Apache-2.0 已声明，OCI label 仍为 `NOASSERTION`。文档将其标为正式容器发布阻塞项，不修改 Dockerfile。

## 4. 文件影响

- `docs/development/application-module-development.md`
- `docs/development/webui.md`
- `docs/operations/build-and-container.md`
- `docs/operations/release.md`
- `docs/changes/049-project-rule-gate-context/**`
- `docs/changes/README.md`

## 5. 验证

- 复核文档陈述与脚本/workflow/source 一致。
- 运行 Markdown 链接与固定目录检查。
- 运行 `git diff --check` 并审阅完整 Diff。
- 引用本轮已完成的 Go/WebUI 无副作用检查；不新增构建、E2E 或外部验证声明。
