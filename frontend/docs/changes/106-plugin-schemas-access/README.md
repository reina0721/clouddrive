# 106 Plugin 架构中装配 schemas 公共 API（plugin-schemas-access）

## 范围与状态

在 `@clouddrive/plugin-framework` 暴露 `@clouddrive/schemas` 的公共能力：
浏览器安全 `./schemas` 入口（`FoundationSchema`/`SchemaIssue`/`getSchemaIssues`）、
Node 装配方 `./schemas/runtime` 入口（Runtime 工厂/契约/错误类，不转出内部用途
`SOURCE_PATHS`），并在 `./plugin` 暴露 `schemas` 能力命名空间。**仅完成公共能力的
装配与暴露**：不新增 Provider/Hook/服务/调用协议，不打通浏览器到 Node 的调用，
不改 schemas 任何文件，schemas API 原有运行环境要求（Runtime 属 Node）保留。

状态：**已完成**（计划经用户确认后实施，验证全部通过）。

## 阅读顺序

1. [需求](requirements/README.md)：Plugin 消费 schemas 能力的可验收行为。
2. [设计](design/README.md)：入口边界、模块依赖图与禁止项。
3. [tasks.md](tasks.md)：唯一完成清单。

## 关键决策

- 两个独立入口且互不 import：`./schemas`（浏览器安全，链上无 Node）与
  `./schemas/runtime`（Node 装配方，依赖 schemas/runtime 自身 Node 环境）。
- 只 re-export schemas 公共入口的命名符号（同一模块引用，语义原样）；不复制、
  不深 import 内部类型；`SOURCE_PATHS` 明确不公开。
- `./plugin` 以值命名空间 `schemas` 暴露 `getSchemaIssues`，类型
  `FoundationSchema`/`SchemaIssue` 顶层命名导出（TS const 对象不能与 namespace
  合并，故类型走命名导出）。
- Runtime 实例创建/关闭由装配方负责；本轮不实现装配调用方。

## 终态同步

- `docs/plugin-framework.md`：新增「Plugin Schema 能力接入」节。
- `tooling/foundation-contracts.json` / `tooling/dependency-policy.json`：登记
  `./schemas`、`./schemas/runtime` 与 plugin-framework → schemas 依赖边界。
