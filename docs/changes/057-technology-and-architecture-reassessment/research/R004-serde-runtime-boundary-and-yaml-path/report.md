# R004 序列化真实边界与 YAML 稳定迁移路径复核

## 研究问题与方法

R002 把 YAML v4 列为低耦合迁移项。本报告在实施确认前从 Commit `4e0408edbe229759925a7fcba6ba75007e65aa2a` 重新追踪直接 import、编译依赖、真实消费者、fixture、错误和安全边界，并刷新官方 YAML 组织的当前稳定版本。`old-backend/` 继续排除。

既有 012-R019 能证明项目需要严格配置语义，030-R002 能证明当时的 OpenAPI 生成路径；两者都不能证明 2026-08-22 的 YAML major 选择仍然合理。

## 当前项目事实

### 定义与消费者

| 边界 | 当前实现 | 真实作用 |
| --- | --- | --- |
| JSON | 标准库 `encoding/json` 由 HTTP、CLI、layout、WebUI manifest 和配置 JSON source 直接使用 | 协议/文件边界清楚，错误与限制由各 owner 处理；无需统一换库或机械包装 |
| YAML config | `internal/kernel/config` 直接使用 `gopkg.in/yaml.v3` 解码 map，并用 `yaml.Node`/Encoder 生成有序默认配置 | YAML 只负责语法树与编码；unknown/type/default/reload 语义仍由项目 config owner 负责 |
| YAML i18n | `pkg/i18n` 把 `yaml.Unmarshal` 注册给 `go-i18n` | 第三方只在 i18n Adapter 内，业务依赖项目 `Translator` |
| OpenAPI YAML | `pkg/httpx/contract` 用 `kin-openapi` 构建文档，再用 YAML 编码生成 artifact | 模块不接触 YAML 类型；`contract-gen` golden 对比完整 `api/openapi.yaml` |
| docs tooling | `internal/tools/docs-guard` 解码仓库自有治理 YAML | build-time 工具边界，不进入业务运行契约 |
| MessagePack | `pkg/cache` 直接使用 `vmihailenco/msgpack/v5` 编码 Redis typed cache value | 当前唯一消费者；是否改变 wire format 属于 CACHE 任务，不应由通用 Codec 包替决定 |
| `pkg/codec` | 自研 `Codec` 接口统一 JSON/YAML/msgpack 的 `Marshal/Unmarshal`，另有可选 `DecodeLimited` | 排除自身测试后全仓零消费者；没有替换、共享策略或业务 port 价值 |

所有 production YAML import 都位于项目基础设施、Adapter 或 tooling 内，没有 YAML `Node`/Decoder 类型泄漏到业务 Service/Model。当前边界问题不是“缺一个更厚 Wrapper”，而是直接依赖了已归档 import path，并保留了一个无消费者的通用 Wrapper。

### 当前验证覆盖

- config 测试覆盖 YAML/JSON load、重复 key 拒绝、unknown/type 严格绑定、默认配置顺序/缩进/末尾换行和生成文件安全写入；当前 `config.example.yaml` 约 9.4 KiB。
- i18n 测试覆盖 YAML 文件加载、缺失文件和可定制配置。
- contract generator golden 对完整 `api/openapi.yaml` 做字节/语义门禁；当前 artifact 约 145 KiB。
- `pkg/codec` 只有 JSON round-trip 和超限 JSON 测试，没有 YAML/msgpack compatibility 或真实消费者验收；它不能证明一个通用序列化能力已经成熟。

## 外部维护、版本与安全事实

### YAML

- 原 `go-yaml/yaml` 仓库已于 2025-04-01 archived，`gopkg.in/yaml.v3` 最新稳定线停在 `v3.0.1`。
- 官方 YAML 组织接管维护后的 `yaml/go-yaml` 仓库保持活跃，明确把 v1-v3 定位为冻结、只接收安全修复的稳定线，把日常开发放在 v4。
- `go.yaml.in/yaml/v3 v3.0.5` 于 2026-07-26 发布，module 要求 Go 1.16，API 与当前 `gopkg.in/yaml.v3` 兼容，满足本项目 Go 1.26.6。
- 截至本次复核，v4 最高只有 `v4.0.0-rc.6`，没有稳定 `v4.0.0`。官方迁移指南还明确 v4 默认缩进、sequence style、新 `Load/Dump`/options、`TypeError` 等存在迁移面；公开 issue 中仍有 v4 release-required 项。不能把“主线活跃”误写成“稳定版已可直接采用”。
- GO-2022-0603 描述旧版 `gopkg.in/yaml.v3.Unmarshal` 对恶意输入可能 panic，但受影响范围早于 2022-05 的修复 commit；当前 `v3.0.1` 已包含修复。OSV 对官方 `go.yaml.in/yaml/v3`/v4 module path 的本次查询未返回登记项。迁移理由是维护 owner 和后续安全修复路径，而不是虚构当前版本仍受该漏洞影响。

项目的 YAML 输入均为本地 operator 配置、仓库内语言/治理文件或生成输出，不提供外部 YAML HTTP API。v4 的 depth/alias limit plugin 有后续价值，但不足以证明应把 RC 引入 production；若未来增加不可信 YAML 输入，必须单独建立字节、depth、alias、document 数与取消策略，不得只换 import path。

### MessagePack 与替代候选

`vmihailenco/msgpack/v5 v5.4.1` 为 BSD-2-Clause，最新 release 是 2023-10-26，仓库未 archived，但最后 push 为 2024-06；本次 OSV query 未命中。它仍可作为既有 cache 私有 wire codec，但维护节奏和当前零 production cache 消费者都不足以支持把它提升为全项目通用序列化标准。

`fxamacker/cbor/v2` 是更活跃、带显式解码限制并按 RFC 8949 实现的成熟候选，当前最新 `v2.9.3` 发布于 2026-08-18；但项目没有 CBOR 协议、互操作或不可信二进制输入需求。为“更新”而把 MessagePack 换成 CBOR 只会制造 wire migration，因此本任务不引入它。若 CACHE 任务最终保留 typed Redis cache，应在该任务中明确采用标准 JSON、保留 MessagePack 或迁移 CBOR 的真实收益与兼容语义。

## 决策

### SERDE-057-001 修订目标

1. 将项目全部直接 `gopkg.in/yaml.v3` import 单轨迁移到官方稳定 `go.yaml.in/yaml/v3 v3.0.5`，提升为 direct dependency；不直接采用 pre-release v4。
2. 保持调用边界：config/i18n/contract/tooling 各自直接使用 YAML 库，不新建全局 YAML Adapter。配置 strict binding、i18n Translator 和 HTTP contract 仍是项目契约。
3. 删除无消费者的 `pkg/codec` 及其测试，不保留 alias、deprecated package 或空 Wrapper。标准 JSON 继续在协议 owner 内直接使用；MessagePack 继续只属于 cache 私有实现，是否保留由修订后的 CACHE 计划另行决定。
4. 以现有 config duplicate/strict/default golden、i18n fixture、OpenAPI generation golden、docs guard、全仓 test/race/vet 和旧 direct import 搜索作为迁移门禁。
5. `go.yaml.in/yaml/v4` 当前仍可因 oasdiff/jsonschema/ordered-map 出现在间接 module graph；验收只要求 production/tooling 源码不直接导入 RC、`go.mod` 不把 v4 提升为 direct dependency，不能错误承诺整个 `go.sum` 不再出现 v4。

### v4 后续门禁

只有官方稳定 `v4.0.0+` 发布后才刷新本报告，并比较：

- `Load/Dump` 与 v3 compatibility API 的选择；
- 默认缩进、sequence、quote、empty stream、`TypeError` 和 Node 输出差异；
- unique keys、single document、known fields 与 depth/alias limits 在各输入边界的收益；
- config、i18n、OpenAPI 和 docs metadata 的完整 fixture；
- transitive module 版本收敛和退出成本。

稳定版存在也不自动授权迁移；只有安全、维护或可删除自研校验的收益足以覆盖行为变化时才实施。

## 架构判断

当前 YAML 接入位置是合理的：第三方类型没有穿透业务，且 config/i18n/contract/tooling 的失败语义不同，不应被一个万能 Codec 抹平。需要调整的是依赖 owner 和删除无使用价值的抽象，不是为 YAML 建立新的 Kernel Capability、生命周期组件或全局 serializer registry。

这也说明“第三方必须封装”不能机械化：标准 `encoding/json` 和局部 YAML 调用不需要二次包装；只有 cache wire format 这类跨进程持久语义才需要由项目契约明确拥有版本与迁移边界。

## 局限与刷新条件

- 本轮没有修改 import、依赖或 fixture，也没有运行 v3.0.5 compatibility tests；这些属于确认后的非文档实施。
- OSV 未命中不能证明绝对安全；实施前仍需用当前 Go 工具链运行全仓 `govulncheck`。
- 没有仓库外消费者证据；若首个正式 release 或外部 `pkg/codec` 消费者出现，删除公共 package 必须重新评估。
- v4 stable、安全公告、新外部 YAML 入口或 cache wire format 变化会触发刷新。

## 对计划的影响

原 `SERDE-057-001` 的依赖选择和文件删除范围发生材料变化，因此继续保持“待确认”。此前 Batch A 确认不覆盖本任务；只有用户确认修订后的任务后才能修改 `pkg/codec`、源码 import、`go.mod/go.sum` 或测试。
