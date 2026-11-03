# 入口表面与模块边界

## 1. 目标

在 `@clouddrive/plugin-framework` 暴露 `@clouddrive/schemas` 公共能力，让
Plugin/装配方经公开入口消费，不访问 schemas 内部实现，schemas 零修改。

## 2. 公共面映射

以 `packages/schemas/package.json` 声明的公共入口为准：
`@clouddrive/schemas`（根）与 `@clouddrive/schemas/runtime`。

| plugin-framework 入口                          | 转出符号                                                                                                                              | 环境        | 说明                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------- |
| `./schemas` → `src/schemas.ts`                 | `FoundationSchema`、`SchemaIssue`（type）；`getSchemaIssues`（值）                                                                    | 浏览器安全  | 只 import schemas 根入口；无 node:                                         |
| `./schemas/runtime` → `src/schemas-runtime.ts` | `createSchemaRuntime`、`SchemaRuntime`、`SchemaRuntimeOptions`、`SchemaSourceDescriptor`、`SchemaRuntimeError`、`SourceNotFoundError` | Node 装配方 | 只 re-export `@clouddrive/schemas/runtime` 命名导出；不导出 `SOURCE_PATHS` |
| `./plugin` → `src/plugin.tsx`                  | `schemas` 值命名空间（`getSchemaIssues`）+ `FoundationSchema`/`SchemaIssue` 类型命名导出                                              | 浏览器安全  | 值 import 仅来自 schemas 根入口                                            |

## 3. 模块依赖图

```text
src/schemas.ts            ──import──▶ @clouddrive/schemas（根）
src/schemas-runtime.ts    ──import──▶ @clouddrive/schemas/runtime（Node）
src/plugin.tsx            ──import──▶ @clouddrive/schemas（根；浏览器安全）
（禁止：schemas.ts / plugin.tsx ──import──▶ schemas-runtime.ts 或任何 node: / schemas 内部文件）
```

- 结果类型（`SchemaSourceSummary` 等）与 `UnwatchFn` 在 schemas/runtime 中未命名
  导出，只能经 `SchemaRuntime` 方法签名可达；本变更**不复制、不深 import** 这些
  内部类型（方案以 `Pick`/`Parameters`/`ReturnType` 派生契约为准则，本轮接入
  只 re-export 命名符号，未命名类型不进入公共面）。
- Runtime 实例创建（`createSchemaRuntime`）与关闭（`close()`）由装配方在 Node
  环境负责；schemas/runtime 自身依赖 `node:fs` 等，属其既有运行环境要求，接入层
  不冒充实现、不解除该要求。

## 4. 禁止项

- 禁止 import `@clouddrive/schemas/src/**`、`packages/schemas/src/**`、相对路径
  穿透 schemas 内部文件。
- 禁止浏览器入口链（`./schemas`、`./plugin`）引入 Node Runtime。
- 禁止转出内部用途 `SOURCE_PATHS`。
- 禁止新增 Provider/Hook/服务/协议；禁止把 Node 入口 import 进浏览器入口。
- 禁止修改 schemas（源码/package.json/tsconfig/测试）。

## 5. 依赖与登记

- `@clouddrive/plugin-framework` dependencies += `@clouddrive/schemas`；
  devDependencies += `zod`（测试构造 ZodError）。
- `tooling/dependency-policy.json`：`@clouddrive/schemas` allowed +=
  `packages/plugin-framework`。
- `tooling/foundation-contracts.json`：plugin-framework exports += `./schemas`、
  `./schemas/runtime`；evidence += `schemas.test.ts`、`schemas-runtime.test.ts`
  （与 package.json exports 逐字节一致，由 check-foundation-governance 强制）。
- plugin-framework tsconfig：`types` += `node`、`allowImportingTsExtensions: true`
  （消费 schemas/runtime 源码的 node:/.ts 扩展 import 所需）。

## 6. 验证方案

- identity 测试：`getSchemaIssues`/工厂/错误类与 schemas 公共导出同一引用。
- 浏览器安全静态断言：`schemas.ts`、`plugin.tsx` 无 `node:`、无
  `@clouddrive/schemas/runtime`、无 schemas 内部路径、无 `SOURCE_PATHS`。
- Node 入口不导出 `SOURCE_PATHS`；错误继承链原样。
- `git diff -- packages/schemas` 为空；全仓门禁通过。
