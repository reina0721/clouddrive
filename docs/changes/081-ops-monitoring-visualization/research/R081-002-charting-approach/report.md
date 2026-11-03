# R081-002 研究：可视化与宿主指标实现取向

## 1. 研究问题

覆盖两项可视化需求应采取的图表实现取向（自研 SVG vs 引入图表库）与服务器指标采集取向（标准库 runtime vs 第三方 gopsutil vs 生态 node-exporter）。

## 2. 事实与对比

### 2.1 图表

- 现状：WebUI 已有自研平台 UI 原语（`webui/src/ui/index.tsx`：Card/DataTable/StatCard/InlineAlert 等，059/062 先例），Ops Dashboard 已用这些原语呈现卡片。
- 需求形态：基础时序曲线（请求速率/错误/内存/goroutine/调度/消息）+ 状态图；无缩放/多轴/大数据量要求。
- 候选：
  - A（推荐）**自研轻量 SVG chart 原语**（Sparkline/LineChart 入 `webui/src/ui`）：标准 SVG 路径、零依赖、可控可测、可复用（其它模块通用），延续项目"自研 UI 原语"方向；测试用 Vitest + aria-label 门禁对齐既有组件。
  - B ECharts：功能全但包体大、主题/样式需要桥接平台设计语言、许可/更新策略需复核——与项目轻量自研方向冲突；无强需求。
  - C Recharts：React 生态图表，仍需引入依赖与样式桥接，收益不显著。
- 触发条件：复杂交互（缩放/联动/大数据集）出现时再评估 B/C。

### 2.2 服务器（宿主）指标

- 需求 2"服务器状态"拆解：进程级（内存/goroutine/GC/uptime）与 OS 级（CPU/磁盘/网络）。
- 候选：
  - A（推荐）**进程内标准库**：`runtime.ReadMemStats`/`NumGoroutine`/uptime → `RuntimeSnapshot` + `/metrics` Gauge；跨平台、零依赖、闭环快。
  - B gopsutil（第三方，跨平台 CPU/磁盘/网络）：成熟但**本次无法在线复核其维护状态与安全记录**（与前序 MFA 候选判定一致，AGENTS 3.2 不作为默认引入依据），且跨平台磁盘/网络采集语义复杂。
  - C **node-exporter（宿主标准路径）**：既有 `/metrics` 已 Prometheus 文本兼容；宿主部署 node-exporter 即得 OS 级指标，WebUI 可文档化接入（同源聚合只读或直链external dashboard）；向成熟通用方向对齐、零进程内跨平台成本。
- 结论：首版 A（进程级闭环）+ C（OS 级接入指引）；B 留作真实跨平台采集需求出现时的研究候选。

## 3. 结论

081 采用：后端 `RuntimeSnapshot` 扩展（runtime 进程指标 + 组件明细）+ `/metrics` runtime Gauge；前端自研 SVG chart 原语 + Dashboard「监控」分区（状态卡 + 滚动窗口时序图，轮询累积零存储）；文档提供 node-exporter OS 级接入指引。