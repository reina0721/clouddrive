# 049 需求规格

## 1. 目标

核验项目主题文档中的必要规范是否由当前实现真实命中，并修复会导致“命令通过但目标未被扫描”或“局部门禁冒充全部门禁”的语境表述。

## 2. 依据

- R001：Go 架构、配置、日志和 WebUI Go 契约当前有可执行通过证据。
- R001：WebUI Node 扫描器只枚举 Auth/Ops，不能自动覆盖第三个模块。
- R001：统一 quality/release workflow 不运行 WebUI。
- R001：Apache-2.0 源码声明与 OCI `NOASSERTION` 未对齐。

## 3. 必须满足

- REQ-001：项目规范按业务、资源、入口和运行边界变化触发，不依赖用户使用精确术语。
- REQ-002：任何门禁通过结论必须同时证明目标对象处于门禁发现范围。
- REQ-003：WebUI 指南必须区分通用 Go Catalog 门禁、Auth/Ops Node 扫描和未执行 E2E/视觉证据。
- REQ-004：构建与发布文档不得把 Go quality script 写成全部项目质量门禁。
- REQ-005：发布文档必须反映 Apache-2.0 源码许可证与 OCI label 未对齐的当前事实。
- REQ-006：已通过、部分命中、未命中和未验证必须分别表达。
- REQ-007：不修改 `AGENTS.md`，不实施 Node 脚本、CI、Dockerfile 或其他非文档修复。

## 4. 非目标

- 不让前端扫描器自动发现未来模块。
- 不把 WebUI job 接入 quality/release workflow。
- 不修改 OCI license label。
- 不执行服务启动、E2E、视觉、Docker、外部数据库、RabbitMQ 或正式发布。
- 不全面审计每个业务功能和运行协议。

## 5. 验收标准

1. 四份项目 authority 明确适用语境、实际覆盖和不能推断的范围。
2. 049 研究报告提供代码、测试、脚本和 workflow 证据矩阵。
3. 本轮实际运行命令和未执行检查均如实记录。
4. 文档链接、metadata、任务目录和 `git diff --check` 通过。
