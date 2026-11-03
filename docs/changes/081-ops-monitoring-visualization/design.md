# 081 设计方案：运维监控可视化

## 1. 背景与目标形态

081 在既有 management 端点（probe/diagnostics/metrics）与 Ops Dashboard 上补齐：进程级监控（runtime 指标）与运行状态可视化报表图（时序曲线 + 组件状态）。数据源全部复用既有边界（零新后端存储、零第三方指标库/图表库）。

## 2. 方案对比

| 项 | 方案 | 结论 |
| --- | --- | --- |
| 进程指标 | A（采纳）：标准库 `runtime`（ReadMemStats/NumGoroutine/uptime）注入 Diagnostics 与 /metrics Gauge | 跨平台零依赖、闭环快 |
| 进程指标 | B（不采纳）：gopsutil | 本次无法复核维护状态；跨平台磁盘/网络语义重 |
| OS 级指标 | A（采纳）：node-exporter 标准路径（文档指引） | 与既有 /metrics 文本兼容、成熟通用 |
| OS 级指标 | B（不采纳）：进程内跨平台采集 | 成本高、无复核依据 |
| 时序数据 | A（采纳）：前端滚动窗口轮询累积（5s×60 点） | 零后端存储、闭环快；重启即空（文档化） |
| 时序数据 | B（不采纳）：后端持久采样端点 | 引入存储与生命周期；当前无需求 |
| 图表 | A（采纳）：自研 SVG `Sparkline`/`LineChart` 入 webui/src/ui | 零依赖、可测、可复用（延续自研 UI 原语方向） |
| 图表 | B（不采纳）：echarts/recharts | 包体/主题桥接成本 vs 基础曲线需求；复杂交互出现再评估 |
| 组件明细 | A（采纳）：RuntimeSnapshot 扩展（participants/schedules/consumers/execution 摘要） | 来源 supervisor/schedule/messaging/execution 既有接口 |

## 3. 数据流与实现位置

### 3.1 后端（ops service + observability metrics）

```
ops/service.snapshot：调用一个进程采样 helper（internal/module/ops/service 或 pkg/observability 提供）：
  runtime.ReadMemStats -> HeapAlloc/HeapSys/NumGC；runtime.NumGoroutine()；uptime（startedAt 记录）
  -> model.RuntimeSnapshot 扩展字段：process.allocBytes/heapBytes/sysBytes/goroutines/gcCount/uptimeSeconds
     + components：participants []{name, state}、schedules、messaging {pending, acked}、execution {attempts}
observability metrics（已暴露 registry）：新增 Gauge：
  go_memstats_alloc_bytes / go_memstats_heap_alloc_bytes / go_goroutines / process_uptime_seconds / process_gc_count
  （在 telemetry/metrics 构建侧注册；低敏：不记录队列内容/路径）
```

- 来源确认：supervisor（participant Name/状态）、pkg/schedule（binding health）、pkg/messaging（consumer pending/ack 计数——若无则省略并文档标注）、execution（attempts 计数）。实现时以既有公开接口为准，缺字段不造假。

### 3.2 前端图表原语（webui/src/ui）

```
charts.tsx（或 ui/index.tsx 扩展）：
  export function Sparkline({ values, width?, height?, ariaLabel, stroke? })   // 简单折线
  export function LineChart({ series: {label, values}[], width?, height?, ariaLabel, timeLabels? })
  纯 SVG path 计算（points -> polyline），空数据渲染 Empty 态，aria-label 供测试/e2e 断言
测试：charts.test.tsx（空数据/单系列/多系列/路径断言/aria-label）
```

### 3.3 Dashboard「监控」分区（面向用户呈现，R081-003 返工）

```
monitoring-section（重构）：
  1) 健康横幅：CapabilityBanner —— 语义态（available=全部系统正常 / degraded=N 项降级 / unavailable=N 项故障），
     计数来自 units 状态语义映射（running/ready/pending -> available；stopped/forced/failed -> 异常；failed -> unavailable）
  2) 指标卡行（升级 StatGrid/StatCard 或专用 metric card）：内存（GiB+趋势）、请求速率（/s+趋势）、
     Goroutine（趋势）、进程 CPU%（process_cpu_seconds_total 差分 -> %、趋势）；大数字+单位+迷你趋势+阈值色
  3) 坐标轴时序图：chaart 原语演化 AxisLineChart（y 刻度 + x 时间标签 + 网格 + 图例 + 归一化多系列）
  4) 组件状态表：每行=状态圆点/StatusPill（语义词 Operational/Degraded/Unavailable，不显示内部枚举裸值）
     + 组件名称 + 一句话说明 + 最近采样时间；degraded/failed 行高亮
  5) 实时感：显示"最近采样 N 秒前"；滚动窗口轮询沿用（5s×60，上限/清理）
轮询与数据源：与首版一致（/metrics + /diagnostics）
```

### 3.4 文档

```
docs/operations/（runtime-capabilities 行、security 低敏说明）、运维/监控说明：
  node-exporter 部署指引（宿主机 /metrics 文本兼容，同源只读聚合或直链外部面板）
  监控数据语义：进程指标=进程内采样；OS 指标=node-exporter；时序=前端滚动窗口（重启即空）
```

## 4. 失败语义、并发与审计

- 监控轮询失败不阻断页面（catch 置 inexact 状态，保留已有数据）；窗口上限约束内存。
- /diagnostics、/metrics 鉴权沿用（protected）；新指标低敏。
- 进程采样为同步只读（runtime.ReadMemStats 无锁安全）。

## 5. 已确认决策

（待用户确认后填写；当前为推荐项。）

## 6. 验证方案

1. Go：RuntimeSnapshot 新字段测试（内存/goroutine/uptime 单调非负、组件摘要来源正确）；/metrics 新 Gauge 断言。
2. WebUI：charts 原语 Vitest；Dashboard 监控分区（投影/窗口/轮询清理）Vitest；mock 渲染 e2e。
3. 文档：ops 能力矩阵与 node-exporter 指引；docs-guard。
4. 全量：`go test ./...`、`go vet ./...`、generate:check、typecheck/lint/Vitest/Playwright。