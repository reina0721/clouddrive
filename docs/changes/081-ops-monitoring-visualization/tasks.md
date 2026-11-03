# 081 任务清单：运维监控可视化（运行状态报表 + 服务器/进程监控）

## 状态

研究门禁已通过（[R081-001](research/R081-001-capability-audit/report.md)、[R081-002](research/R081-002-charting-approach/report.md)）；计划已确认（用户确认实施，含自研 SVG 图表与 node-exporter 指引取向）；**实施完成并验证**（2026-09）。

## 任务

| ID | 工作量 | 依赖 | 内容 | 完成条件 | 状态 |
| --- | --- | --- | --- | --- | --- |
| `RES-081-001` | M | — | 监控能力盘点 + 时序/指标/图表取向研究 | metadata/report 齐全；门禁通过 | 完成 |
| `RES-081-002` | M | — | 可视化与宿主指标取向 | metadata/report 齐全 | 完成 |
| `PLAN-081-001` | M | RES | 计划并提交确认 | 文档齐全；用户确认 | 完成 |
| `MON-081-001` | M | 确认 | 进程指标：RuntimeSnapshot。Process + /metrics Go/Process collector | 字段与 Gauge 断言通过 | 完成 |
| `MON-081-002` | M | 确认 | 组件明细：supervisor units 进 RuntimeSnapshot（低敏） | 来源核实；诊断响应扩展 | 完成 |
| `MON-081-003` | M | 确认 | 图表原语 Sparkline/LineChart 入 webui/src/ui + Vitest | 原语测试通过；ui 入口导出 | 完成 |
| `MON-081-004` | M | 前三 | Dashboard「监控」分区（进程/组件状态卡 + 滚动窗口时序图，available-only 挂载） | 窗口/差分/上限测试；e2e 能力边界保持 | 完成 |
| `MON-081-006` | M | MON-004（返工） | 监控分区面向用户重构：健康横幅 + 大数值指标卡（CPU%/内存/磁盘/网络未接入态）+ AxisLineChart（坐标轴/时间标签/图例）+ 组件状态表（语义词/状态圆点/异常高亮/最近采样时间） | 渲染验收（降级态、空态）、窗口测试保持全绿、e2e 能力边界不变 | 完成 |
| `MON-081-005` | S | MON-004 | locale/mock/投影扩展 + 遗留 unused 清理 | lint 全绿 | 完成 |
| `DOC-081-001` | M | 上述 | 文档（runtime-capabilities/security/webui + node-exporter 指引） | docs-guard 通过 | 完成 |
| `VER-081-001` | M | 全部 | 全量验证与提交 | 无失败；受限项如实标注 | 完成 |

## 验证矩阵（实测结果）

| 门禁 | 命令/入口 | 结果 |
| --- | --- | --- |
| Go 单元/集成 | `go test ./...` | 全绿（ops/observability/composition） |
| Go 静态 | `go vet ./...` | 通过 |
| WebUI | typecheck/lint:modules/lint:i18n/lint:architecture/generate:check/Vitest 151/Playwright 22 | 通过 |
| 文档 | docs-guard | 通过 |

## 未执行/受限项

- OS 级（CPU/磁盘/网络）不进程内采集：node-exporter 文档指引；gopsutil 因无法复核不作为默认。
- 不引入 echarts/recharts（复杂交互再评估）；后端持久时序采样、多实例聚合大盘、Alertmanager 全链路：候选。
- 滚动窗口时序为前端内存态（重启即空，文档化）；监控分区仅在 available 状态挂载（degraded 路由能力边界不变）。