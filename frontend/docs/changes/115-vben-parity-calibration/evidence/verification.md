# 文档校准验证

本次修改限于导入文档包、115 校准账本与 docs/changes 索引，未修改产品源码、依赖、门禁、视觉基线或配置。

## 证据范围

- 源码核对基点：59b5581；六项入口与结论见 research/findings.md。
- 未访问线上/Vben，不报告演示站故障根因或当前 Vben 实现事实。
- 没有运行产品交互来证明新功能；全部 VP 产品 DoD 保持未完成。
- 下表记录实际执行结果；定向 format/docs 独立通过不代表完整 pnpm check 通过。

## 检查结果

| 检查                                | 结果                       | 证据与边界                                                                                                                                                                                                   |
| ----------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| pnpm docs:check                     | 退出码 0                   | [日志](docs-check.log)：入口、8 个 authority、21 个变更账本索引通过；不代表递归链接或功能验收                                                                                                                |
| 定向 Prettier --check               | 退出码 0                   | [日志](format-check.log)：115 账本、导入包和变更索引通过                                                                                                                                                     |
| 全部本次 Markdown 相对链接/源码入口 | 通过                       | Python 逐个解析文件链接并检查目标存在，检查六份 VP 规格与 UTF-8；覆盖 21 个 Markdown。未验证外部网页、运行时或代码语义                                                                                       |
| git diff --check                    | 退出码 0                   | 已跟踪索引无空白错误；新增文件格式由定向 Prettier 验证                                                                                                                                                       |
| 修改范围核对                        | 通过                       | git diff 与 git ls-files 使用 -z 读取中文路径；变动仅 docs/changes 索引、115 账本与导入包，无产品源码                                                                                                        |
| pnpm check                          | 退出码 1；测试启动环境失败 | [完整尝试日志](pnpm-check.log)：Foundation/Architecture/Dependency/两类 Codegen/Lint/全部 TypeScript 检查通过；Vitest 启动失败，未进入测试断言；build/performance/test:browser 及后续全仓 format/docs 未执行 |

## 环境与限制

全部开发检查在 WSL 运行，使用临时目录中的 Linux Node 22.18.0 与项目指定 pnpm 10.22.0；未修改仓库运行时配置或依赖。格式化只覆盖本次文件，没有执行全仓 pnpm format。

本次记录的是文档交付验证，不能作为任一 VP 产品 DoD、公共能力 stable、人工视觉确认或真实 Backend 联调通过的证据。

## 完整门禁失败定位

Vitest 4.1.11 启动 Rolldown 1.2.6 时报告 `Cannot find native binding`，随后 WASI fallback 也缺少 `@rolldown/binding-wasm32-wasi`。检查实际安装：`.pnpm` 中只有 `@rolldown+binding-win32-x64-msvc@1.2.6` 的平台包目录，Rolldown 依赖目录虽列出 Linux 包链接，其目标未安装。这是当前依赖安装与 WSL 平台不匹配，日志没有证明任何测试断言失败。

本次不通过删除 node_modules、改 lockfile、改依赖或排除测试来处理文档交付。完整门禁保持失败记录；未来需在 WSL 补齐与 lockfile 匹配的 Linux 可选依赖后重跑，仍须执行 build/performance/browser 等后续阶段。本次未验证这些阶段，也未更新任何视觉基线。

完整 typecheck 的 Next typegen 临时将 next-env.d.ts 的类型导入从 .next/dev 改到 dist；确认差异仅为生成路径后已恢复原文件。最终修改范围复核确保无产品源码残留改动。
