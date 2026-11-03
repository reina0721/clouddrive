# 106 装配 schemas 公共 API —— 完成清单

研究基线：schemas 公共面事实以 `packages/schemas/package.json` exports 与实际
命名导出为准（根入口 `FoundationSchema`/`SchemaIssue`/`getSchemaIssues`；
`./runtime` 命名导出工厂/契约/错误类 + 内部用途 `SOURCE_PATHS`）。
计划状态：已确认并完成实施与验证。

## 研究与计划

- [x] `RES-106-001` 确认 schemas 公共入口与命名导出、plugin-framework exports/
      Provider 模式、Host 装配、dev 编排、依赖/登记门禁；证据：代码阅读 + 会话研究结论
      （本任务为纯装配，无新选型，不建 research 目录）。
- [x] `PLN-106-001` 产出需求/设计/任务并提交确认；证据：`requirements/`、
      `design/`、本文件；状态：已确认。

## 实施

- [x] `T1-106-001` `packages/plugin-framework/package.json`：exports += `./schemas`、
      `./schemas/runtime`；dependencies += `@clouddrive/schemas`；devDependencies +=
      `zod`；tsconfig types += node + `allowImportingTsExtensions`。
- [x] `T1-106-002` `src/schemas.ts`（浏览器安全：FoundationSchema/SchemaIssue/
      getSchemaIssues）+ `src/schemas-runtime.ts`（Node：createSchemaRuntime/
      SchemaRuntime/SchemaRuntimeOptions/SchemaSourceDescriptor/SchemaRuntimeError/
      SourceNotFoundError；不导出 SOURCE_PATHS）。
- [x] `T2-106-001` `src/plugin.tsx` 暴露 `schemas` 值命名空间 + FoundationSchema/
      SchemaIssue 类型命名导出。
- [x] `T3-106-001` `tooling/dependency-policy.json`（schemas allowed +=
      plugin-framework）+ `tooling/foundation-contracts.json`（plugin-framework exports
      += ./schemas、./schemas/runtime；evidence += 新测试）。

## 测试

- [x] `T4-106-001` `src/schemas.test.ts`（jsdom）：identity、类型可消费、真实
      ZodError issue 语义、浏览器入口无 node:/schemas 内部路径/SOURCE_PATHS。
- [x] `T4-106-002` `src/schemas-runtime.test.ts`（node）：identity、错误继承链、
      SchemaRuntime 方法签名、不导出 SOURCE_PATHS、Node 入口无内部路径。
- [x] `T4-106-003` `src/plugin.test.tsx` 扩展：`schemas.getSchemaIssues` 示例调用；
      30 tests passed（plugin-framework）。

## 文档与记录

- [x] `T5-106-001` `docs/plugin-framework.md` 新增「Plugin Schema 能力接入」节。
- [x] `T5-106-002` 本变更目录（README/requirements/design/tasks）+ 后续更新
      `docs/changes/README.md` 索引（106）。

## 验证

- [x] `T6-106-001` `git diff -- packages/schemas` 为空（schemas 零修改）。
- [x] `T6-106-002` foundation/architecture/dependency gates、lint、typecheck（全仓）、
      format:check、docs:check。
- [x] `T6-106-003` `pnpm test`（schemas 50 + plugin-framework 30 + 全仓）、
      `pnpm build`；最终 pnpm 10.22 + `WEB_DEPLOYMENT_MODE=static` 下完整 `pnpm check`。
