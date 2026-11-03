# R013 HTTP OpenTelemetry 标准 instrumentation 复核

## 决策

采用 OpenTelemetry 官方 `go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.70.0` 替换当前手工 HTTP TraceContext extraction、server span、HTTP semantic attributes 与 status recording；同时把 OTel core/sdk/trace/OTLP HTTP exporter 从 v1.44.0 对齐到 v1.45.0。

项目继续拥有 Telemetry capability、Generation resource lease、operation inventory、低基数 operation ID、项目 Prometheus metrics、trace ID context bridge、bounded processor diagnostics 和 exporter start/flush/shutdown。`otelhttp` 不进入业务模块或公开 capability 类型。

## 当前实现事实

- `telemetryResource.serveHTTP` 手工使用 `propagation.TraceContext.Extract`、`tracer.Start`、HTTP method/route/status attributes 和 span status。
- 当前实现已正确把 resource lease 持有到完整请求结束，并用 operation inventory 把实际 URL 映射为稳定 operation ID，防止 path parameter 泄漏和高基数指标。
- 项目 Prometheus registry、in-flight、duration/status 和 bounded exporter diagnostics 都是项目运行治理，不应改由 otelhttp 默认 meter 接管。
- `otelhttp v0.61.0` 只残留在 `go.sum`，没有 direct import 或 `go.mod` requirement；当前 production instrumentation 仍是自研。

手工代码不是业务特有能力。HTTP semantic conventions、propagation、span kind/status 与 ResponseWriter 行为是官方 instrumentation 应负责的通用机制，继续自研会承担当代 OTel 规范漂移和边缘协议维护成本。

## 外部核验

`otelhttp v0.70.0` 于 2026-08-04 发布，要求 Go 1.25，Apache-2.0；官方 contrib 仓库活跃。它支持显式 `TracerProvider`、`Propagators`、span name formatter、server name 和 filter，能在不使用全局 provider 的情况下接入当前 generation resource。

其 module 与 OTel `v1.45.0` 对齐；core/sdk/exporter v1.45.0 于 2026-08-03 发布，兼容当前 Go 1.26.6。版本特定 OSV 查询对 otelhttp v0.70.0 和 OTel v1.45.0 core/sdk/exporter 均返回 0 条影响当前版本的记录；module 名称层面的历史公告仍要求实施时运行 `govulncheck`。

## 接入设计

1. 在 `telemetryResource` 构造期用当代 provider、`TraceContext` propagator 和稳定 span-name formatter 建立 instrumentation factory；不读取全局 OTel provider。
2. `telemetryAccess.HTTP` 继续先取得 resource lease，并保证 otelhttp handler 完整执行后才释放；candidate/retired provider 不跨代混用。
3. Huma 全量迁移后，以已冻结的 operation registration/inventory 解析稳定 operation ID；404/405 使用固定低基数名称，不把原始 path/query 写入 span name 或项目 metrics。
4. otelhttp 负责 extraction、server span、standard HTTP semantic attributes、status 和 panic-safe ResponseWriter instrumentation；删除对应手工逻辑。
5. 项目 wrapper 继续记录 Prometheus in-flight/duration/status，并把 span TraceID 写入 `httpx`/`pkgobservability` context；不重复创建第二个 server span或第二套 OTel metrics。
6. Bounded processor、OTLP exporter、sampling、diagnostics 与 lifecycle 保持项目 owner。

## 实施与验证

`OBS-057-001` 默认在 `HTTP-057-002` 后执行，以免先适配旧 contract inventory 再迁移 Huma。验收至少覆盖：

- incoming valid/invalid/absent traceparent；
- operation ID、404/405、secret path/query 的低基数与不泄漏；
- 2xx/4xx/5xx、panic/recovery、streaming/optional interfaces、request cancellation；
- Telemetry lease 在 handler 完成前持续有效，reload 后新旧请求使用各自 provider；
- 项目 Prometheus 指标不重复，span 只有一个 server root；
- OTel modules 单一版本线、go mod tidy clean、test/race、govulncheck 和 docs guard。

如果 otelhttp 无法维持 resource lease、项目 stable operation 或 ResponseWriter 行为，停止并回到研究；不得用两层 server span 或兼容 Wrapper 冒充采用成功。

## 局限

本研究未运行 otel collector 或 streaming handler E2E；这些属于已明确的实施验收。Messaging/Scheduler 的项目 trace propagation 不在本任务范围，不能因 HTTP 采用 otelhttp 而机械改写。
