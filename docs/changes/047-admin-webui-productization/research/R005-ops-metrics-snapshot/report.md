# R005 Ops Metrics 快照与参考指标卡对照

## 研究问题

Soybean `/home` 用四张高对比指标卡把总体数值放在图表和活动详情之前。当前 Ops 已读取 `/management/metrics`，但仅把 Prometheus 原文放在诊断卡片中。需要确认可直接投影的真实字段，并明确不能实现的历史趋势边界。

## 参考站观察

2026-08-21 通过浏览器重新观察 [Soybean 工作台](https://soybeanjs.cn/home) 的 DOM 与截图：访问量、成交额、下载量、成交量四张彩色指标卡位于欢迎摘要之后、图表与项目动态之前。它们属于参考站示例业务数据，不能直接复制到当前项目。

## 当前代码事实

- `internal/module/ops/binding/webui/web/api.ts` 已读取 `/management/metrics` 文本响应，查询属于现有 Ops 六项能力之一。
- `internal/kernel/app/observability/metrics.go` 注册了 HTTP request counter、in-flight gauge、exported spans counter 和 dropped spans counter；HTTP request counter 带 operation/method/status/error 标签。
- 当前契约是单次 Prometheus exposition，没有历史采样 API；因此浏览器不能合法推断趋势、增长率或业务收入。

## 结论

在已有 Ops 概览中增加四张真实 Metrics 快照卡：HTTP 请求总数、活动请求、已导出 Span、丢弃 Span。投影函数只接受有限数值并汇总带标签请求序列；字段缺失显示 `Unavailable`/`—`。原始 metrics 文本保留在下方诊断详情，不新增后端接口，也不绘制伪造历史图表。

## 实施与验证影响

- WebUI：新增 `metrics-data.ts` 投影、四卡 Surface、中英文 locale 和解析测试。
- 后端：不修改 metrics collector、HTTP handler 或 wire contract。
- 视觉：复用参考站指标卡的高对比分组和信息顺序，但指标名称、状态和数据均来自当前服务。
- 验证：覆盖 Prometheus 文本投影、非有限值拒绝、i18n scan、typecheck、build、registry 和模块门禁。

本地项目截图仍受 Vite 自签名 HTTPS 证书限制，不能把本地截图验收描述为通过。
