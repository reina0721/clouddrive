# R003 L1 缓存必要性、一致性与成熟候选适配复核

## 研究问题与方法

R001/R002 原计划用 Otter v2 与 ttlcache v3 PoC 后替换 `patrickmn/go-cache`。本报告在实施确认前重新追踪 `pkg/cache` 的定义、配置、composition、资源 owner、全部非测试调用方和多实例语义，并刷新候选 release、Go 版本、许可证和公开安全记录。目标不是挑选性能排名最高的库，而是先回答当前是否应该存在默认 L1。

代码快照为 `32a4987c00d19aac66ce28de8c2ee96e47461488`；`old-backend/` 继续排除。

## 当前代码事实

### 调用与资源边界

- `pkg/cache.New[T]` 构造 `patrickmn/go-cache` L1、项目自管 `tagKeys` 和清理 goroutine，再通过 `RemoteStore` 使用 Redis L2。每个 typed Client 各自拥有 L1、tag map 和 goroutine，Kernel 只拥有共享 Redis client。
- `internal/kernel/composition` 暴露稳定 `cacheapp.Access`；`cacheapp.NewClient[T]` 只在测试和 composition integration test 出现。排除 `_test.go` 后，IAM、Organization、Navigation、Todo、Auth、HTTP、Scheduler 等 production 代码均没有 typed cache 消费者。
- Scheduler 使用的是同一 Redis 资源上的专用 `coordination.Manager`，不是 `pkg/cache.Client[T]`，退役 typed L1 不影响分布式执行权。
- 应用级 `cache` 配置只描述 Redis backend、连接池和 tag namespace。typed L1 的 TTL/cleanup 来自调用方私有 `pkg/cache.Config`，没有进程级容量、权重、内存 budget 或命中率配置。

### 一致性与失败语义

1. L1 没有最大条目数或权重，进程内内存上界不可证明。
2. `Set` 先写 L1 再写 L2。Redis 写失败前，同进程并发读取可能短暂观察到未提交值；失败后才回删 L1。
3. `Delete` 先删本地再删 Redis。Redis 删除失败后，下一次 miss 可以从仍存在的 L2 回填旧值。
4. tag invalidation 只删除发起进程自己的 L1。其他实例没有 pub/sub、版本号或失效日志，会继续返回旧值直到 TTL 到期。替换本地容器不能修复该问题。
5. L1 entry 自然过期时，项目自管 `tagKeys` 不同步移除 key；tag 索引可累积已失效引用。
6. `GetOrLoad` 把 `ErrNotFound`、Redis 故障、取消和其它读取错误全部当作 miss，可能在 backend 故障时调用 loader 并写缓存；`GetMany` 则吞掉所有单项错误并始终返回 nil error。两者是项目契约问题，不是 L1 库问题。

因此，当前“二级一致性”只在单进程、容忍 TTL 内陈旧且远端成功的窄场景成立，不能作为一般多实例缓存语义。

## 外部候选刷新

2026-08-22 通过官方仓库/release、模块版本和 OSV package query 复核：

| 方案 | 当前维护事实 | 适配判断 |
| --- | --- | --- |
| `patrickmn/go-cache v2.1.0+incompatible` | MIT；仓库未 archived，但最新 release 为 2017-10-24，module 没有现代 major path | 不再作为首发默认依赖；缺少容量/权重门禁，继续维护项目 janitor/tag 补丁没有收益 |
| `maypok86/otter/v2 v2.3.0` | Apache-2.0；最新 release 2025-12-22，仓库 2026-06 仍有提交；Go 1.24+；提供 size/weight、写入/访问 TTL、统计和显式停止 | 若未来有高并发、命中率与重量上界需求，是首选 PoC；只应在项目 Adapter 内使用，并避免默认 logger/refresh 语义越过项目诊断与取消边界 |
| `jellydator/ttlcache/v3 v3.4.1` | MIT；最新 release 2026-06-22，仓库 2026-08 仍有提交；Go 1.25+；提供 TTL、capacity/max cost、事件与 Start/Stop | 若需求只是确定 TTL 和简单容量，是较小候选；默认 Get 会延长 TTL，接入时必须显式禁用 touch 才能保持当前 write-TTL 语义 |
| `dgraph-io/ristretto/v2 v2.4.2` | Apache-2.0；最新 release 2026-07-07；Go 1.24+；提供 cost-based eviction 与 TinyLFU | 当前不优先。官方说明新 entry 的 Set 可能因 buffer/admission 被丢弃且采用 eventual consistency，与项目当前同步 Set/Get 预期不匹配 |

OSV query 在该快照未返回这四个 module path 的已登记记录；这只是“当前查询未命中”，不能证明没有漏洞。release、Go 版本和安全状态均需在真正引入前刷新。

## 决策

### 当前采用路径

`CACHE-057-001` 不再以“先选另一个 L1 库”为目标，而改为：

1. 单轨移除默认 L1、`patrickmn/go-cache`、本地 tag map、cleanup goroutine 及其配置；
2. 保留项目 typed cache 契约、msgpack 边界、Redis `RemoteStore`/tag 语义和 Kernel 共享资源 owner；
3. 让 Set/Delete/Get/InvalidateTags 只有一个 Redis authority，避免本地未提交可见和跨实例 L1 陈旧；
4. 收紧 `GetOrLoad`/`GetMany`：只有 `ErrNotFound` 是 miss，取消、disabled、backend 和 codec 错误必须保留错误链向上返回；
5. 不引入新的本地缓存依赖，也不为尚不存在的消费者做 benchmark 数字表演。

这不是否定成熟第三方，而是基于当前收益为零、风险真实存在的退役决策。Redis 与项目特有 key/tag/错误边界继续有现实职责；本地 eviction 算法不再自研。

### 未来重新引入 L1 的门禁

只有真实业务消费者同时给出以下证据，才建立独立任务：

- Redis 延迟/吞吐或成本基线，以及目标命中率；
- 最大条目数或权重、进程内存 budget 和观测指标；
- 数据可接受的陈旧时间，Set/Delete/tag invalidation 的多实例一致性模型；
- 写穿、旁路、negative cache、stampede 和 backend failure 的明确语义；
- owner、停止方式、配置变化是否 `RestartRequired`；
- 基于真实 value size/key distribution 的 Otter/ttlcache 对照测试。

满足高并发/命中率/weight 需求时先验证 Otter v2；只需简单 TTL/容量时验证 ttlcache v3。不得仅因为项目曾有 L1 而恢复 L1。

## 架构影响

该结论同时回答了承载基础问题：typed cache 目前不是 Application Generation 中需要独立换代的资源；真正共享且有生命周期的 Redis client 已由 Kernel 管理并标记 `RestartRequired`。去掉每个 typed Client 的 goroutine 和本地状态，可以让调用方只依赖项目 cache 契约，而不必为无收益的 L1 建立额外 generation finalizer 或兼容层。

## 2026-08-22 实施刷新

用户确认修订后的 `CACHE-057-001` 后，项目已按上述路径单轨实施：删除默认 L1、`patrickmn/go-cache`、本地 tag map、cleanup goroutine/配置与 typed Client `Close`；Redis 成为 Get/Set/Delete/tag invalidation 的唯一 authority。`RemoteStore.Get` 不再执行仅服务于 L1 回填的 TTL 查询，`InvalidateTags` 不再返回仅服务于本地失效的 key 列表；`GetOrLoad`/`GetMany` 只把 `ErrNotFound` 作为 miss。Kernel 继续拥有并关闭共享 Redis client。

## 局限与刷新条件

- 本轮没有运行 cache benchmark，因为没有 production consumer、value distribution 或 SLO；benchmark 不能替代缺失需求。
- 本轮没有连接外部真实 Redis；Redis Adapter 行为通过可控测试后端验证，完整验证结果记录在 057 `tasks.md`。
- 若发现仓库外已承诺的 `pkg/cache.Client` 消费者或首个正式 release，删除 `Close`/配置字段等公共变化必须重新评估兼容策略。
- 新增真实 typed cache 消费者、多实例失效机制、候选 release/安全变化或量化性能目标时，本报告必须刷新。

## 对计划的影响

R001/R002 的“默认 L1 应直接换库”推断被更细证据修订。用户已明确确认并完成修订后的 `CACHE-057-001`；后续若重新引入 L1，仍必须按本报告门禁建立新研究与任务，不能恢复历史实现或兼容层。
