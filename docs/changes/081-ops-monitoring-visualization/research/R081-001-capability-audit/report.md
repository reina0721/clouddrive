# 081 研究档案：运维监控可视化（运行状态报表 + 服务器/进程监控）

## 研究范围

回答用户两项需求：① 对运行中持久监听/输出服务（HTTP、management、scheduler、messaging consumer、execution、supervisor participants 等）实现可视化报表图状态；② 实现服务器状态监控模块并在运行状态中可视化报表图。本档案盘点现有能力并确定：时序报表数据来源、宿主/进程指标采集路径（runtime vs 第三方 vs node-exporter）、前端图表实现取向（自研 SVG vs 图表库）、组件生命周期状态来源。

## 检索方式

- 变更序号 `081`；worktree clean（`4532445`，080 完成）。
- 代码证据（`4532445`）：`internal/module/ops/{binding/http/handler.go,service/service.go,model/model.go,binding/webui/web/{DashboardPage.tsx,CapabilitiesPage.tsx,dashboard-data.ts,metrics-data.ts}}`；`internal/kernel/app/observability`；`pkg/supervisor`、`pkg/schedule`、`pkg/messaging` 状态；`webui/src/ui/index.tsx`（UI 原语集）。
- 外部事实：跨平台 OS 级指标（CPU/磁盘/网络）需第三方（gopsutil 等）或宿主侧 exporter（Prometheus node-exporter）；本次 web 复核通道不可用（与前序候选判定一致，不作为默认引入依据）。

## 现状盘点（代码）

- **已有**：management 端点 `/startupz,/livez,/readyz,/build,/diagnostics,/metrics`（Prometheus text）；`RuntimeSnapshot`（process/generation 状态、activeRequests/Connections、auth/database ready、scheduler/messaging health）；WebUI Ops Dashboard/Capabilities 页（快照卡片 + `metrics-data.ts` 解析 Prometheus text 的数值快照，无时序）。
- **缺口（对照两项需求）**：
  1. 无**时序报表图**：当前只有瞬时数值（请求数/在途/span），无历史趋势（请求速率、错误、内存、goroutine、调度执行、消息成败）的可视化曲线；
  2. 无**进程/宿主监控**：RuntimeSnapshot 无内存/goroutine/GC/uptime；/metrics 缺 runtime/process 指标；无服务器 OS 级（CPU/磁盘/网络）呈现；
  3. 组件生命周期状态仅 scheduler/messaging health 两字段，缺 participants/schedules/consumers/execution 明细。

## 设计方向（推荐）

### 时序报表数据（需求 1）

- **前端时序累积**（零后端存储）：Dashboard 按固定间隔（如 5s）轮询 `/diagnostics` 与 `/metrics`，客户端保留滚动窗口（如 60 个采样点）绘制曲线；数据形状 = Prometheus text 解析（复用 `metrics-data.ts`）+ 快照字段。成本低、闭环快、无持久化任务；重启即空（文档化，滚动窗口语义）。
- 可选后续：后端采样端点（内存环形缓冲）持久化报表——列为候选（当前非必须）。

### 进程/服务器指标采集（需求 2）

- **进程内（首版，零第三方）**：`runtime.ReadMemStats` + `runtime.NumGoroutine`/GC/uptime 注入 `RuntimeSnapshot` 与 `/metrics`（Gauge：heap/alloc、sys、num_goroutine、gc_count、uptime 等）；这是跨平台、标准库可得的进程级"服务器状态"最小闭环。
- **OS 级（CPU/磁盘/网络）**：不进程内采集（gopsutil 无法复核维护状态、跨平台成本高）；采用**成熟标准路径——Prometheus node-exporter**（与既有 /metrics 反向兼容：宿主机部署 node-exporter，WebUI 同源聚合只读展示或直接链接其端点，文档化接入说明）。研究结论：首版以「进程级 runtime 指标 + node-exporter 指引」闭环，"服务器状态"向成熟通用方向对齐。
- 采数边界：低敏（不含路径/凭据；磁盘仅用可用字节摘要，不扫文件）。

### 前端图表（需求 1/2 的可视化）

- **自研轻量 SVG 图表原语**（`webui/src/ui`）：`Sparkline`/`LineChart`（纯 SVG、多系列、空数据态、时间标签、可测），加入既有平台 UI 原语集，Ops 与后续任何模块可复用。
- 候选对比：ECharts/Recharts（成熟但包体/主题/许可与"轻量自研原语"的项目方向冲突；本项目图表需求=基础曲线/状态图，自研可控可测可复用，符合 059 自研 UI 原语先例）。触发条件：出现复杂交互图表（缩放/多轴/大数据量）时再评估引入。

### 组件生命周期状态（需求 1 覆盖范围）

- `RuntimeSnapshot` 扩展：进程（memstats/goroutine/GC/uptime）+ 组件明细（supervisor participants 列表与状态、schedule bindings 健康、messaging consumers pending/ack、execution attempts）——来源为 `supervisor`/`pkg/schedule`/`pkg/messaging` 既有状态接口；前端渲染组件状态卡 + 时序图（调度执行次数、消息成败可经 metrics 解析）。

## 适用 / 不适用

- 适用：单进程自托管运行状态可视化、进程级监控闭环、基础时序报表；node-exporter 补齐 OS 级。
- 不适用：多实例聚合监控、Prometheus+Alertmanager 全链路（属外部部署，文档指引）、复杂 BI 报表（触发图表库评估）、require durable metrics 存储（后续候选）。

## 对本任务的影响

两项需求可在同一 081 闭环：后端（RuntimeSnapshot 扩展 + /metrics runtime 指标）、前端（自研 chart 原语 + Dashboard「监控」分区：组件/进程状态卡 + 时序图）、文档（node-exporter 指引、监控数据语义）。工作量 M+。