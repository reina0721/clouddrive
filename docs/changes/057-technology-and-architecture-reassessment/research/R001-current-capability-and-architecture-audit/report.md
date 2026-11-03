# R001 当前通用能力、业务边界与承载架构审计

## 研究问题与范围

本报告回答当前实现“是什么”，不先以现有设计文档证明其合理性。审计覆盖根 `go.mod`、`pkg`、`internal/kernel`、`internal/composition`、当前 IAM/Organization/Navigation/Todo/Auth/Ops/Migration 模块和既有研究；`old-backend/` 按项目范围 authority 排除。

## 方法与证据

- 以 Commit `ae26ace97a7d4e0478a8238a787bc03513c387bf` 为快照，追踪定义、composition root、实际调用方、配置、资源 owner、停止语义和测试。
- 用 `go mod why -m` 区分直接运行依赖与工具链间接依赖；例如 Viper 不是当前 runtime 配置实现。
- 复核 `docs/research/001`、`002` 与 030、037、038 的历史结论，但以当前代码覆盖历史描述。

## 当前事实

### 能力与依赖分类

| 分类 | 当前代表 | 事实 |
| --- | --- | --- |
| 标准库核心 | `net/http`、`encoding/json`、`context`、`sync` | HTTP transport、JSON 和并发基础主要复用标准库 |
| 成熟第三方 | `zap`、`chi`、GORM、`golang-migrate`、`go-redis`、`jwx/v3`、`gocron/v2`、`amqp091-go`、OpenTelemetry、Prometheus | 均被项目边界或内部 Adapter 接入；是否升级仍需逐项复核 |
| 项目特有逻辑 | 模块 Repository port、permission catalog、migration set、HTTP operation 语义、schedule/message binding、低敏日志与诊断策略 | 这些语义不能由通用库替项目决定，保留项目 ownership 有边界价值 |
| 自研通用机制 | `pkg/cache` 二级一致性/tag、`pkg/resilience` retry/breaker、`pkg/httpx` client policy/限流/安全头/CORS、`pkg/database` Schema/Query/BaseRepository、`pkg/httpx/contract` typed DSL、`internal/kernel/config` strict binding/watch | 已有代码量不是保留理由；分别需要成熟候选比较和真实用例 PoC |

### 关键实现事实

1. `pkg/cache` 用 `patrickmn/go-cache` 做 L1、`go-redis/v9` 做 L2，自管 tag index、同步和 cleanup goroutine；默认 L1 没有容量上界。
2. `pkg/resilience` 的 breaker 以连续失败计数打开，只有手工 `Reset`，没有 half-open、时间窗口或标准指标；retry 是自研指数退避。
3. `pkg/httpx` 以 `net/http` 为核心，但通用 Client 内含 retry 决策；当前 retry 可覆盖网络错误、429 和 5xx，接口没有把非幂等操作策略变为必选显式配置。
4. production HTTP limiter 是 composition 创建的单一进程级 token bucket，作用是整体 load shedding，不是按用户、租户或路由的业务 quota。
5. `pkg/database` 在 GORM 之上又拥有反射式 Schema、Query 和 BaseRepository；IAM、Organization、Navigation 已有真实消费者，不能靠 API 表面比较决定迁移。
6. `internal/kernel/config` 自研 strict binding、defaults、watch、候选校验和 atomic file；Viper 仅经工具依赖间接出现，不是 runtime 事实。
7. IAM Argon2id 参数当前为 64 MiB、3 次、并行度 2，安全强度不低于当前 OWASP 最低建议；但校验逻辑没有按已编码的 `m/t/p` 参数计算，也没有 `NeedsRehash` 演进语义。
8. `internal/transport/http/routes.go` 直接使用 `kin-openapi/openapi3filter.ValidateRequest`，没有走安全公告所述 `ValidationHandler.Load()` 路径；这只能排除一个已知触发路径，不能把受影响旧版本视为可继续保留。

### 承载架构事实

既有 `docs/research/001-go-capability-composition` 建议只把确需运行期安全替换的底层资源放入动态 Capability 平面，业务对象图使用显式普通构造。当前 Application Generation 已共同重建配置、底层资源、业务模块、HTTP routes、Scheduler、Messaging 和 management 状态，动态边界明显扩大。

这意味着某些候选接入困难不一定来自库本身：若每个普通库都被要求适配 Generation、Lease、Replacement 与 reload，就会人为增加 Adapter 和状态机。反过来，共享连接、listener、Consumer 和 exporter 仍需要统一资源 owner，不能简单移除生命周期治理。

## 推断与比较

- **推断：** 应恢复“启动期静态对象图 + 经证明可安全换代的动态资源平面”分工，但必须先做 owner/reload 矩阵与最小切片；当前证据不支持一次性重写 Kernel，也不支持引入反射 DI。
- **推断：** HTTP retry、breaker、rate limit、cache loading 和 execution recovery 应由场景 profile/策略边界决定，不能继续散落在通用 Client 中。
- **推断：** 通用 Repository/HTTP DSL 是否替换必须用当前模块的复杂 join、分页、乐观锁、错误映射和生成链做 PoC，单看 API 简洁度不足以决策。

## 适用与不适用

适用于 057 的技术矩阵、实施分批以及以后新增模块/能力的研究门禁。不适用于宣称任何候选已经通过性能、兼容性或生产验证，也不授权修改源码、依赖或运行状态。

## 局限与剩余未知

- 未执行性能/内存 benchmark，也未完成 Huma、sqlc/GORM Gen、Otter/ttlcache 或 failsafe-go 原型。
- 研究阶段的 `govulncheck` 二进制由 Go 1.25 构建，无法加载 Go 1.26.6 项目；该限制已由 `SEC-057-001` 用 Go 1.26.6 重建 Scanner v1.3.0 并完成全仓扫描关闭，研究时失败仍只作为历史证据保留。
- 尚未建立每个 Capability 的 reload 收益、配置变化频率和并存安全矩阵。

## 对当前任务的影响

研究足以形成“安全止血、低耦合升级、策略重构、高耦合 PoC、架构切片”的分批计划。每批必须在非文档实施前获得明确确认；PoC 推翻候选或改变公共边界时退回研究与计划。
