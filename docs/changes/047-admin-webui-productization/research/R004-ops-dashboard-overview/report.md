# R004 Ops Dashboard 概览层与 Soybean 工作台对照

## 研究问题

Soybean `/home` 当前工作台先呈现欢迎/摘要/统计，再进入项目动态和其他详情。当前项目 Ops Dashboard 已经读取真实 management 能力，但概览层仍以查询数量和原始 JSON 为主。需要确认哪些真实字段可以承担相同的信息层级，且不虚构不存在的业务数据。

## 参考站观察

2026-08-21 通过浏览器读取 [Soybean 工作台](https://soybeanjs.cn/home) DOM，当前可复核顺序为：欢迎标题与天气文案、项目/待办/消息摘要、访问量/成交额/下载量/成交量统计卡、项目动态列表和 Footer。后四类属于参考站示例业务内容，不是当前项目事实。

## 当前代码事实

- `internal/module/ops/binding/webui/web/api.ts` 已通过既有 management listener 读取 build、startup、liveness、readiness、diagnostics 和 metrics。
- `internal/module/ops/model/model.go` 的 `BuildInfo` 有 version、commit、buildTime、goVersion、dirty；`RuntimeSnapshot` 有 process/generation/traffic、Auth/Database readiness、Scheduler/Messaging health 等脱敏字段。
- Ops 页面已具备四态、刷新、重试和原始结果卡片，新增概览不需要后端 wire contract 或新的查询。

## 结论

采用“真实构建 → 运行快照 → 依赖健康 → 原始诊断详情”的项目化概览。通过窄投影函数读取已知字段；缺失字段保持 `Unavailable`/`—`，不在浏览器推算，不添加天气、待办、消息、活动或示例统计。

## 实施与验证影响

- WebUI：新增 `dashboard-data.ts` 投影、构建/运行/健康 Surface、中英文 locale 和单元测试。
- 后端：不新增接口、字段、数据库或运行时能力；既有 Ops service/HTTP contract 原样复用。
- 视觉：采用参考站“先总览、后详情”的产品组织，但保留项目真实能力与状态语义。
- 验证：覆盖 projection、四态、i18n scan、typecheck、build、registry 和模块门禁。

本地视觉截图仍因 Vite 自签名 HTTPS 证书不可在当前浏览器会话中完成，不能将本地截图门禁描述为通过。
