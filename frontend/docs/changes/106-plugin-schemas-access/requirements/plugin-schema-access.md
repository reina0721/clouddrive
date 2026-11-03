# Plugin 经公开入口消费 schemas 能力

## 客户目标

作为 Plugin 开发者或 Runtime 装配方，我希望通过 Plugin 架构的公开入口直接使用
`@clouddrive/schemas` 的既有能力（结构化 issue 提取、Schema 类型契约、Runtime
工厂/错误类型），而不是访问 schemas 内部文件或自行封装第二套 API。

## 使用场景

- Plugin 页面（浏览器）在表单/数据校验失败时提取结构化 issue：
  `schemas.getSchemaIssues(error)` → `SchemaIssue[]`。
- Plugin 代码声明类型化表单 Schema：`FoundationSchema<Output>`、`SchemaIssue`。
- Node 装配方创建并关闭 Schema Runtime（`createSchemaRuntime` + `close()`），消费
  Runtime 的公开方法（listSources/readSource/validate/applyPatch/generate/
  checkFreshness/watch）。

## 范围

- 新增浏览器安全 `./schemas` 入口与 Node `./schemas/runtime` 入口；`./plugin`
  暴露 `schemas` 能力命名空间。
- 依赖策略与公共导出登记同步；Plugin 使用文档更新。

## 非目标

- 不新增 Provider/Hook、开发服务或调用协议。
- 不打通浏览器到 Node 的 Runtime 调用链（保持 schemas API 原有运行环境要求）。
- 不修改 schemas 实现；不新增页面；不迁移现有 Plugin 的 schema 定义。
- 不暴露内部用途 `SOURCE_PATHS` 与 schemas 内部文件。

## 可验收行为

1. `@clouddrive/plugin-framework/schemas` 转出 `FoundationSchema`、`SchemaIssue`、
   `getSchemaIssues`；函数引用与 schemas 根入口一致（identity）。
2. `@clouddrive/plugin-framework/schemas/runtime` 转出
   `createSchemaRuntime`/`SchemaRuntime`/`SchemaRuntimeOptions`/
   `SchemaSourceDescriptor`/`SchemaRuntimeError`/`SourceNotFoundError`；不导出
   `SOURCE_PATHS`；错误语义（继承链）原样。
3. `@clouddrive/plugin-framework/plugin` 暴露 `schemas` 值命名空间与
   `FoundationSchema`/`SchemaIssue` 类型，示例调用可编译运行。
4. 浏览器入口源码不含 Node Runtime import 与 schemas 内部路径；接入代码无
   `packages/schemas/src/**` 引用。
5. `packages/schemas/**` 零修改。
6. 全仓门禁（foundation/architecture/dependency/lint/typecheck/test/format/docs/
   build 与 `pnpm check`）通过。
