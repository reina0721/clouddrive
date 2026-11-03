# 081 需求规格：运维监控可视化（运行状态报表 + 服务器/进程监控）

引用研究：[R081-001](research/R081-001-capability-audit/report.md)、[R081-002](research/R081-002-charting-approach/report.md)。

## 1. 目标

在既有 Ops/observability 能力上补齐两项需求：① 对运行中持久监听/输出服务（HTTP、management、scheduler、messaging consumer、execution、supervisor participants）实现**可视化报表图状态**；② 实现**服务器（进程级）状态监控**并在运行状态中可视化。采用：进程指标=标准库 runtime；OS 级（CPU/磁盘/网络）=node-exporter 标准路径（文档指引）；时序报表=前端滚动窗口；图表=自研 SVG chart 原语。

## 2. 功能要求

| ID | 要求 |
| --- | --- |
| `REQ-081-001` | **进程指标采集（运行时）**：`RuntimeSnapshot` 增加进程字段（alloc/heap/sys 内存、num_goroutine、gc_count、uptime、goroutine 概况），来源 `runtime.ReadMemStats`/`NumGoroutine`（跨平台、零第三方）；`/metrics` 增加对应 Gauge（如 `go_memstats_alloc_bytes`、`go_goroutines`、`process_uptime_seconds` 等，Prometheus 命名风格）。 |
| `REQ-081-002` | **组件生命周期明细**：`RuntimeSnapshot` 增加组件状态（supervisor participants 名称与状态、scheduler 健康、messaging consumers 待处理/ack 摘要、execution attempts）——来源 supervisor/schedule/messaging/execution 既有接口，低敏（无队列内数据）。 |
| `REQ-081-003` | **图表原语（自研）**：`webui/src/ui` 新增 `Sparkline`/`LineChart`（纯 SVG：多系列、空数据态、时间标签、aria-label 可测），面向全部模块可复用；不引入 echarts/recharts。 |
| `REQ-081-004` | **Dashboard 监控分区（面向用户的呈现形态，R081-003 返工）**：健康横幅（全部正常 / N 项降级 / N 项故障，语义态）+ 大数值指标卡行（内存、请求速率、goroutine、进程 CPU；数字+单位+迷你趋势+状态色）+ 坐标轴时序图（y 刻度、x 时间标签、图例）+ 组件状态表（名称+状态圆点+状态词+一句话说明，异常行高亮）+ 最近采样时间（实时感）；移除首版文本卡堆叠与无轴迷你线；前端滚动窗口轮询（上限约束、卸载清理）。 |
| `REQ-081-005` | **node-exporter 接入指引（OS 级）**：文档说明宿主机部署 Prometheus node-exporter 后与既有 `/metrics` 文本兼容的接入/展示方式；进程内不做跨平台 OS 采集（gopsutil 候选）。 |
| `REQ-081-006` | 低敏与边界：监控数据不含凭据/路径/队列内容；management 鉴权沿用（diagnostics/metrics protected 语义不变）；不引入第三方指标库；不新增权限键。 |
| `REQ-081-007` | 契约与文档同步：`/diagnostics` 响应扩展（后端类型 + 前端 dashboard-data 投影同步）、`/metrics` 新增指标、WebUI locale/mock 与 Vitest/e2e 覆盖；docs（runtime-capabilities/security/运维 README）同步。 |

## 3. 候选方向（仅记录）

- 后端持久采样端点（内存环形缓冲存储时序）与 Prometheus 原生抓取：后续候选。
- 复杂图表（缩放/联动/大数据集）触发重新评估 echarts/recharts。
- gopsutil 进程内跨平台 OS 采集：真实需求出现且可复核维护状态时再评估（node-exporter 为当前标准路径）。
- 多实例聚合监控大盘：候选。

## 4. 验收标准

1. `/diagnostics` 返回进程（内存/goroutine/GC/uptime）与组件明细字段；`/metrics` 出现新 runtime Gauge（Go 测试断言）。
2. 前端 `Sparkline`/`LineChart` 原语测试与渲染正确（空数据/多系列/标签），可被任意模块复用。
3. Dashboard「监控」分区：状态卡数据正确；时序图随轮询累积更新（Vitest 断言窗口语义）；滚动窗口上限约束（防无限增长）。
4. locale/mock/生成物同步；mock 模式虚拟数据渲染正常。
5. 文档（运维/运行能力/安全）含 node-exporter 接入指引与监控数据语义；`go test ./...`、`go vet ./...`、WebUI gate（typecheck/lint/Vitest/Playwright）、docs-guard 全绿。

## 5. 非目标

- 不进程内采集磁盘/网络等 OS 指标（走 node-exporter）；不引入 echarts/recharts/gopsutil。
- 不做多实例聚合、Prometheus+Alertmanager 全链路部署实施（文档指引）。
- 不做持久化时序存储/告警规则（候选）。