# R008 配置流水线与 koanf 适配性复核

## 结论

`CONFIG-057-001` 不应引入 koanf 或 Viper，也不需要生产源码 PoC。当前配置能力不是在重复实现一个普通 key/value loader，而是在承载项目明确需要的严格候选事务。成熟库已经位于有净收益的接缝：YAML 解析、`mapstructure/v2` 严格绑定和 `fsnotify` 文件通知。继续保留项目 `Loader`、`Snapshot`、binding/default、稳定文件读取和 reload owner，是有证据的合理自研。

这不是“兼容现有代码优先”的结论。若把 koanf 接入当前边界，项目仍须保留或重新实现绝大多数关键语义，依赖和适配层反而增加；当前没有可验证的净删除或可靠性收益。

## 当前实现事实

- `Loader` 按显式 `Source` 顺序合并，并记录来源、生成不可变深拷贝 `Snapshot`、SHA-256 digest 和脱敏视图。
- JSON source 拒绝同一 object 的重复 key 与多个根值；Env source 拒绝重复逻辑路径、大小写碰撞、空 segment 和 object/scalar 形状冲突。
- 合并允许后来源覆盖同类型值，但拒绝 object/scalar 形状变化，并按大小写不敏感语义阻止同级冲突。
- `Snapshot.Decode` 已使用 `github.com/go-viper/mapstructure/v2 v2.5.0`，明确设置 `ErrorUnused=true`、`WeaklyTypedInput=false`，并由项目 hook 处理 duration 与严格 scalar。
- `stableFileReader` 对编辑器 rename-save、短暂部分写入和不稳定样本执行有界重读；Watcher 使用 `fsnotify v1.10.1`，项目拥有 debounce、ready/change 回调和关闭错误。
- `DefaultManager` 与 binding registry 负责 capability owner、默认文档生成、未知 section 拒绝和全应用候选校验；Kernel/Generation coordinator 负责 candidate/commit、失败保留旧代、cleanup debt 与低敏诊断。

因此，文件/环境读取只是整个配置事务的一小部分。

## 外部候选核验

| 候选 | 2026-08-22 当前事实 | 与项目的差距 |
| --- | --- | --- |
| `koanf/v2 v2.3.6` | 2026-08-04 发布，Go 1.23，MIT，仓库未归档且近期持续提交；Provider/Parser 可组合 | `StrictMerge` 只拒绝跨 source 类型变化，正常设计仍允许覆盖；watch 文档要求调用方治理并发；默认 unmarshal 为 weak input。来源、大小写/重复路径、稳定读取、provenance、digest、redaction、binding owner 和候选事务仍需项目实现 |
| `Viper v1.21.0` | 活跃成熟，但范围更大，当前只因工具链间接出现 | 默认优先级、环境变量和 weak decode 模型与当前 strict candidate 不匹配；引入面比 koanf 更大，没有净收益 |
| 当前成熟接缝 | `mapstructure/v2 v2.5.0`、`fsnotify v1.10.1` 均是当前最新稳定线；YAML 按 R004 迁移官方稳定 v3 | 已覆盖真正通用的解码、通知和语法解析，不需要再加一个 orchestration framework |

对 `github.com/knadh/koanf/v2` 的 OSV Go package 查询在该快照返回 0 条记录。该结果只表示 OSV 当前无命中，不等于安全保证；版本或依赖图变化仍须重新扫描。

## 为什么不做生产 PoC

要使 koanf 满足现有验收，PoC 至少必须自定义 merge、decode config、file provider、env provider、stable read、provenance/digest/redaction，并继续调用现有 binding/coordinator。此时能删除的只剩少量 map flatten/merge plumbing，却新增 koanf core、provider、parser 与适配测试，不能回答“成熟方案是否显著降低维护成本”的肯定结论。

若未来新增 Consul、Vault、S3 或远程 watcher，应针对该来源重新比较 koanf provider 生态；不得因此把当前完整配置事务交给框架。

## 对方案的影响

- `CONFIG-057-001` 作为研究决策完成，不产生非文档实施任务。
- 保留项目 `Loader`、`Snapshot`、binding/default、stable-file 与 coordinator。
- R004 的 YAML import 单轨迁移继续独立实施；不得借机改变 merge 或 decode 语义。
- 只有新增来源能删除足够代码且保持 strict semantics 时，才建立新的配置 Adapter 任务。

## 局限

本研究没有运行远程 provider，也没有真实远程配置需求；因此不评价 koanf 在 Consul/Vault 场景的表现。GitHub 活跃度与 OSV 查询是时间敏感证据，应按 metadata 触发器刷新。
