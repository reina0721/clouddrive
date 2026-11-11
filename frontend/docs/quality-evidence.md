# 前端质量与验证证据

验证策略统一见[开发验证](../../docs/development/validation.md)。普通页面按所属工作区与使用方验证；共享能力、契约、依赖和配置变化扩大范围。完整 `pnpm check` 保留治理、类型、单元、构建、产物预算、浏览器、格式和文档检查。

## 证据范围

- Foundation/Architecture/Dependency 与 Codegen freshness 证明机器可检查的结构及生成一致性。
- 类型与单元测试证明所选范围；不能替代真实浏览器、文件、权限与后端验收。
- Playwright 的 mock、拦截式 backend-contract、真实文件预览分别报告，不混称真实后端全量通过。
- 视觉基线仍须人工审阅，保持原有阈值；真实设备、外部服务和未执行平台独立列明。

## 输出和追溯

截图通过 `testInfo.outputPath()` 写入每用例产物目录，trace 与测试输出位于忽略的 test-results/playwright-report，调度耗时报告位于根 `.data/validation/`。不把结果写入文档任务目录，不凭旧成功自动跳过新检查。

交付记录实际命令、revision、环境、覆盖范围、退出码与限制。同一相关输入和环境未变且无覆盖缺口时复用结果，提交前不重复全量。历史验收材料通过 Git 查阅；本页不维护会随功能变化失效的通过数量或预算快照。
