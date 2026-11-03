# R009 HTTP 契约框架与 Huma 适配性复核

## 决策

HTTP 契约与 binding 目标选择 `github.com/danielgtaylor/huma/v2 v2.39.1`。采用范围是 typed input/output、OpenAPI/JSON Schema 生成、参数/body 校验和 chi route registration；不采用 Huma CLI、server 生命周期、鉴权模型或业务错误模型。

项目继续拥有：

- 模块 operation ID、security profile、permission/policy 引用和 handler-to-use-case 映射；
- `OperationGate` 的真实认证与 fail-closed 授权；
- `pkg/httpx.Problem`、安全错误映射、request metadata、超时/限流/过载和 server/listener 生命周期；
- 静态契约生成、inventory 与 WebUI/permission 完整性门禁。

这是一项边界重构，不是给当前 DSL 再包一层 Huma Adapter。完成迁移后删除 `pkg/httpx/contract`、手工 OpenAPI renderer/codec、`contractDispatcher` 和基于 kin-openapi 的重复 request validation；若 `kin-openapi` 无剩余直接消费者，则同时删除 direct dependency。

## 当前实现与维护成本

- `pkg/httpx/contract` 约 1,069 行 production Go，自研 Schema/Operation DSL、renderer、inventory、JSON codec 与 handler 适配。
- 运行期又把该 DSL 渲染成 OpenAPI YAML、重新由 kin-openapi 载入，再由 `openapi3filter.ValidateRequest` 校验；模块 handler 另外做 JSON/path/query decode。
- `contractDispatcher` 维护“纯声明”和“运行 handler map”两套集合，并在 composition 手工检查 missing/extra/duplicate。
- 这些机制很认真地守住了 OperationGate 与模块 ownership，但 OpenAPI/JSON Schema、typed binding、validation 和声明/handler 一致性本身是成熟框架能力，不再值得项目长期自研。

## 候选核验

### Huma v2

`v2.39.1` 于 2026-07-29 发布，要求 Go 1.25，MIT，仓库未归档且近期持续维护。官方源码支持：

- 自带 router，包括 chi adapter；不接管 `http.Server`；
- `Register[I,O]` 把 typed input/output、operation 与 handler 绑定；
- OpenAPI 3.1/JSON Schema、请求参数/body 校验、operation middleware；
- `Operation.Metadata` 可保存项目 security/policy metadata；
- 自定义 error factory/response path，可接回项目 Problem；
- OpenAPI 3.1 可降级输出 3.0.3，支持现有工具链迁移窗口。

Huma module 的 `go.mod` 列出多个可选 adapter/format 依赖，因此实施时必须以 `go mod graph`、最终 binary/import graph 和漏洞扫描验证真实引入面，不能只看示例的轻量感。OSV 对 `github.com/danielgtaylor/huma/v2` 的当前查询为 0 条记录。

### ogen

`ogen v1.24.0` 于 2026-08-07 发布，Go 1.25，Apache-2.0，维护活跃，适合 OpenAPI spec-first、静态 client/server 生成。当前 authority 是模块 code-first operation 语义；切换 ogen 会先制造新的中心 spec 与生成物 owner，再迫使模块适配生成 server interface。没有产品需求要求 spec-first，因此拒绝本轮采用。

## 接入设计约束

1. 模块 `binding/http` 定义 typed transport input/output 与注册函数；Service/Model 不导入 Huma。
2. 每项 operation 在同一个注册点绑定 metadata 与 typed handler，消除声明/handler map 双轨。
3. composition 创建 chi router + Huma API，注入项目 middleware。OperationGate 从 Huma operation metadata 读取 security/operation ID，认证或授权失败时不得调用 handler。
4. Huma validation/error 必须转换为项目稳定 Problem code/status，不回显原始 body、query、凭据或内部错误链。
5. 生成器使用相同注册函数与无业务副作用的 contract build mode，输出 inventory/OpenAPI；不得维护第二套 schema 声明。
6. 先验证并迁移代表性 operation：公开 JSON body、Bearer 或 WebUI session 的 path/query list、带乐观锁的 mutation、统一 Problem。PoC 代码必须成为最终迁移的第一片，不建立长期双轨。

## 实施判定门禁

第一片只有同时满足以下条件才继续全量迁移：

- OpenAPI/inventory 稳定字段与现有 operation ID、security、permission 引用一致；
- 尾随 JSON、未知/错误参数、content type、body limit、取消、认证、授权和 handler error 的协议结果不退化；
- contract generation 不需要启动数据库、网络资源或完整 Application Generation；
- 项目 Problem 与低敏日志保持 authority；
- 新增依赖后 `govulncheck`、race、生成 clean diff 与 docs guard 通过；
- 可删除的自研代码和双重验证路径大于新增 glue，不产生 framework context 向 Service/Model 扩散。

若任一核心门禁无法满足，则撤回 Huma 第一片、记录拒绝，不保留 compatibility layer，并重新采用当前 DSL 作为单轨 authority。

## 局限

本研究基于当前源码和 Huma 官方源码形成采用决策，尚未执行仓库内 runtime slice；协议细节仍必须由 `HTTP-057-001` 的第一片验证。Huma 的可选依赖面和未来 API 稳定性是实施风险，已经进入任务停止条件。
