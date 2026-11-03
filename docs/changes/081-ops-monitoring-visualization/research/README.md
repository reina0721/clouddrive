# 081 研究档案：运维监控可视化

## 研究范围

回答两项需求：① 对运行中持久监听/输出服务（HTTP、management、scheduler、messaging consumer、execution、supervisor participants）实现可视化报表图状态；② 服务器状态监控模块并在运行状态可视化报表图。确定时序报表数据来源、进程/宿主指标采集路径、前端图表取向与组件状态来源。

## 检索方式

- 变更序号 `081`；worktree clean（`4532445`）。
- 代码证据：`internal/module/ops/**`（management handler/diagnostics/RuntimeSnapshot/Dashboard/Capabilities/metrics-data）、`internal/kernel/app/observability`、`webui/src/ui/index.tsx`。
- 外部判定：OS 级指标第三方（gopsutil）本次无法在线复核维护状态（与前序候选判定一致）；Prometheus node-exporter 为宿主指标标准路径。

## 现状盘点

- 已有：management `/startupz,/livez,/readyz,/build,/diagnostics,/metrics`（Prometheus text）；`RuntimeSnapshot`（process/generation、activeRequests/Connections、auth/database ready、scheduler/messaging health）；WebUI Ops Dashboard/Capabilities（快照卡片 + Prometheus text 解析的数值快照）。
- 缺口：无时序报表图（仅瞬时数值）；无进程/宿主监控（RuntimeSnapshot 缺内存/goroutine/GC/uptime，metrics 缺 runtime Gauge）；无 OS 级（CPU/磁盘/网络）呈现；组件明细仅两字段 health。

## 设计方向（与 R081-001/002 一致）

- 时序数据：前端滚动窗口轮询累积（约 5s×60 点，零后端存储），Dashboard「监控」分区绘制曲线。
- 进程指标：标准库 `runtime`（ReadMemStats/NumGoroutine/GC/uptime）注入 RuntimeSnapshot 与 /metrics Gauge（跨平台零依赖）。
- OS 级：Prometheus node-exporter 标准路径（文档指引，与既有 /metrics 文本兼容），不做进程内跨平台采集。
- 图表：自研轻量 SVG chart 原语入 `webui/src/ui`（Sparkline/LineChart；可测可复用；复杂交互再评估 echarts）。
- 组件明细：RuntimeSnapshot 扩展 participants/schedules/consumers/execution 状态（来源 supervisor/schedule/messaging/execution 既有接口）。

## 记录索引

| ID | 标题 | 状态 |
| --- | --- | --- |
| [R081-001](R081-001-capability-audit/report.md) | 运维监控可视化能力盘点：运行时仪表盘/时序报表图、进程与宿主监控路径 | active |
| [R081-002](R081-002-charting-approach/report.md) | 可视化与宿主指标实现取向：自研 SVG vs 图表库、runtime vs gopsutil vs node-exporter | active |
| [R081-003](R081-003-humane-monitoring-ux/report.md) | 监控可视化的人因形态：主流产品的服务器状态呈现与本地落地（健康横幅、指标卡、带轴时序图、组件状态表） | active（首版 UI 返工依据） |