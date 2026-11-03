# R006 认证库与凭据校验边界复核

## 研究问题与成熟度门槛

本记录依据当前代码与官方主源，判断 JWT/JWK 和 Argon2id 是否应该换库。候选必须同时满足维护活跃、采用与生产实践充分、API/Go 版本适配、安全记录可核验，并且不会把实验性工具链开关或无界资源消耗带入认证路径。仅仅“是第三方库”不构成采用理由。

本研究不引入 OIDC、MFA、API key 或授权引擎。仓库没有 OIDC discovery、callback、nonce、浏览器登录或外部 IdP 消费者；为未来假设提前增加依赖不符合当前范围。

## 当前代码事实

### JWT/JWK 已使用成熟库并保持项目边界

`internal/module/auth/adapter/jwt` 使用当前 direct dependency `github.com/lestrrat-go/jwx/v3 v3.2.0`，第三方类型没有进入 Auth Service 或业务 Model。项目自有 `CredentialVerifier` 接收凭据并返回 `Principal`，composition 显式构造 Adapter。

当前 Adapter 已拥有项目真正需要的安全和生命周期策略：

- 限制 token 为 16 KiB，只接受 Bearer、单签名、显式 `kid` 和允许的 `alg`；
- 校验 JWK 的算法匹配，以及 issuer、audience、subject、`exp`、`nbf`、`iat` 和时钟偏差；
- 远程 JWKS 使用专用超时和响应体上限、同源 redirect、TLS 1.2、私网地址防护及 issuer/JWKS 白名单；
- JWK cache 由 lifecycle participant 拥有，Ready 前完成首次抓取，Start/Stop 明确，未知 `kid` 触发受控刷新。

这不是自研 JOSE/JWT 实现，而是成熟库上的安全策略 Adapter，边界应保留。现有负向测试仍缺少 missing claim、未来时间、畸形/多签名、重复 key、未知 `kid` 并发刷新和运行中取消等场景。

`Verifier.Verify` 只在入口预检 `context.Context`。JWK lookup/refresh 期间发生的 `context.Canceled` 或 `context.DeadlineExceeded` 会被收敛成 unauthenticated，Auth Service 又把全部 verifier error 映射为无效凭据。该行为会丢失取消/超时原因，必须在项目契约边界修正；外部 HTTP 仍保持 fail-closed 且不暴露内部诊断。

### 当前密码校验没有使用存量 PHC 参数

`internal/module/iam/adapter/password` 基于 Go 官方 `golang.org/x/crypto/argon2` 生成 Argon2id PHC 字符串，当前目标参数为 64 MiB、3 次、并行度 2、16-byte salt、32-byte key。算法本身不是项目自研。

但 `Compare` 只解析字符串结构、salt 和 digest，忽略编码中的 version、memory、iterations 与 parallelism，始终按当前常量重新计算。因此非当前参数生成的合法存量 hash 无法验证，也没有 `NeedsRehash`。当前 `PasswordHasher.Compare(string, string) bool` 还把密码不匹配、损坏的存量记录和验证失败混成一个布尔值，Service 无法安全演进凭据或保留错误原因。

## 成熟候选核验

### JWT/JWK：保留 `jwx/v3`，暂不迁移 v4

截至 2026-08-22，`jwx/v4` 已是 current release，但上游 support policy 明确说明：在 `encoding/json/v2` 脱离实验状态前，不把 v4 标记为适合新代码；v3 在此期间继续获得常规修复。v4 的 README 和发布公告还要求每次 build、test、run 都设置 `GOEXPERIMENT=jsonv2`。

当前项目 Go 1.26.6 的 `GOEXPERIMENT` 为空，CI、脚本、Docker 和 `go.mod` 都没有 jsonv2 构建约束。为一个内部 JWT Adapter 把实验开关扩展成全项目工具链契约，收益不足且扩大失败面。v4 还把原 core JWK HTTP cache 移到独立 `jwx-go/jwkfetch`，迁移会同时重写已验证的生命周期和网络安全边界。

`jwx/v3 v3.2.0` 仍是当前 v3 最新版本，仓库活跃、MIT 许可，OSV 对该精确版本查询无命中。定向 `govulncheck` 没有发现 auth/IAM 可达或 imported-package 漏洞。替代候选 `golang-jwt/jwt/v5 + keyfunc/v3` 与 `go-jose/v4` 都是成熟选择，但会重新拼接 JWKS 抓取、缓存和生命周期，当前没有可验证收益，因此不迁移。

### Password：保留官方 `x/crypto/argon2`，不引入小众 Wrapper

`golang.org/x/crypto/argon2` 是 Go 官方扩展仓库维护的 Argon2 实现，文档明确推荐密码存储使用 Argon2id。OWASP 与 RFC 9106 支持当前 64 MiB、3 次这一量级；具体性能仍须在项目目标环境用 benchmark 校准，不能把文档参数视为容量证明。

高层候选复核结果：

| 候选 | 维护与采用 | 安全/边界结论 |
| --- | --- | --- |
| `alexedwards/argon2id v1.0.0` | MIT、约 685 stars、未归档；唯一 release 为 2023-10-21，2025-10 仍有仓库活动 | 正确读取 PHC 参数并恒时比较，但在按外部参数调用 `argon2.IDKey` 前没有 memory/iterations 上限；仍需项目预解析与资源预算，新增依赖不能消除关键边界代码 |
| `matthewhartstonge/argon2 v1.5.7` | Apache-2.0、约 150 stars、2026-08 持续发布 | API 更完整且活跃，但 README 自述 Go 端错误仍待完善；`Decode` 后直接按编码参数验证，没有项目所需的敌对 PHC 资源上限 |
| `goloop/argon2id v1.0.0` | 2026-07 新建、0 stars | 虽宣称提供 bounds 与 `NeedsRehash`，但缺少成熟度与采用证据并自行实现 Argon2/BLAKE2，不满足本任务硬门槛 |

三个 Wrapper 的精确版本 OSV 查询均无命中，但“没有已知公告”不能补足成熟度、维护深度或资源边界。采用其中任何一个仍要编写严格预检，或会把新且低采用率的密码学实现带入项目。因此选择成熟主流的 `x/crypto/argon2` 作为唯一密码学实现；项目只编写可审计的 PHC 格式/策略边界，不实现 Argon2、随机数或恒时比较算法。

当前 `x/crypto v0.54.0` 的 OSV module 查询命中 `GO-2026-5932`，项目全仓 `govulncheck` 已确认它只涉及当前不可达的 OpenPGP 路径，auth/IAM 没有可达或 imported-package 漏洞。实施时应刷新到兼容的当前维护版本并重跑全仓扫描，但不把无可达路径的记录误报为 Argon2 漏洞。

## 决策与项目职责边界

| 能力 | 决策 | 项目拥有 | 成熟库拥有 |
| --- | --- | --- | --- |
| JOSE/JWT/JWK | 保留 `jwx/v3`，v4 进入刷新触发器而非迁移任务 | issuer/JWKS 白名单、claim/algorithm policy、低敏错误、远程抓取约束、cache lifecycle、项目 Principal | JWT/JWS/JWK 解析、签名验证、claim 基础校验与 cache 通用机制 |
| OIDC | 当前不引入 | 真实登录用例出现后拥有 callback/session/account-linking | 届时优先比较 `coreos/go-oidc/v3 + x/oauth2` 的 discovery、nonce 与 token 验证 |
| Argon2id | 保留 `x/crypto/argon2`，不引入小众高层 Wrapper | 受限 PHC 格式、目标参数、最大资源预算、错误分类、`NeedsRehash` 与成功登录后的迁移策略 | Argon2id、`crypto/rand` 和 `crypto/subtle` 等标准密码学原语 |
| IAM Service port | 材料性修订 | 以 project-owned verification result 表达 match/needs-rehash，以 error 表达损坏或执行失败；第三方类型不泄漏 | 无 |

PHC parser 必须严格限制输入总长、variant、version、字段数量、十进制溢出、base64、salt/key 长度，以及 memory/iterations/parallelism 的上下界，并在调用 `argon2.IDKey` 前完成检查。它是存储格式和资源政策，不是密码学自研。

成功校验且参数不等于当前目标 policy 时，IAM Service 在创建 session 前生成新 hash 并通过现有 credential Repository 在同一事务更新；重哈希失败则不创建 session。损坏的存量 hash 保留原始错误链供决定呈现策略的边界诊断，但 HTTP 仍按无效凭据 fail-closed，不记录 hash、password 或原始凭据。

## 修订后的 AUTHN-057-001

任务不再“迁移 JWX v4”，改为：

1. 保留 `jwx/v3` 当前稳定线，修正 JWK lookup/refresh 的取消与超时传递；
2. 补齐 JWT missing claim、时间边界、算法/key、畸形/多签名、重复/未知 `kid`、并发刷新及 lifecycle 负向矩阵；
3. 把 password port 从布尔比较修订为 project-owned verification result + error；
4. 以 `x/crypto/argon2` 实现参数感知的受限 PHC 验证、恒时比较与 `NeedsRehash`，不引入另一个 Argon2 Wrapper；
5. 在成功登录事务内完成渐进重哈希，保持 dummy-hash 防用户名时序差异、lockout 与通用外部错误语义；
6. 实施时刷新 `jwx/v3`、`x/crypto`、OSV 与 `govulncheck`，仅在兼容且门禁通过时做维护升级；
7. 运行定向、全量、race、vet、生成、文档和漏洞门禁。

任务不允许引入 JWX v4/jsonv2、OIDC、外部 IdP、MFA、授权引擎、新密码学实现或双轨 password verifier。

## 局限与刷新条件

- 没有目标部署硬件 benchmark，当前参数只能作为安全起点；实施应增加可重复 benchmark/容量记录，但不能在无证据时降低参数。
- GitHub stars 只用于评估采用线索，不是安全证明；最终拒绝 Wrapper 的关键原因是它们不能消除项目所需的受限资源边界。
- 若 `encoding/json/v2` 脱离 experiment、jwx 停止 v3 常规修复或 v3 出现安全公告，应重新比较 v4 与 `jwkfetch` 的完整迁移成本。
- 若出现真实 OIDC 流程或跨服务身份协议，应新建研究，不把当前 JWT resource-server Adapter 扩展成万能认证框架。

## 实施结果

用户于 2026-08-22 确认修订后的 `AUTHN-057-001`，随后完成单轨实施：

- 保留 `jwx/v3 v3.2.0`；未知 `kid` 的并发刷新按整个 JWKS resource 合并，而不是按攻击者可控的 `kid` 分组。共享刷新由 Verifier lifecycle 与既有 timeout 约束，每个调用方可独立取消等待；取消和 deadline 经 Auth Service 保持可识别，普通签名/claim 拒绝仍统一为 unauthenticated。
- `PasswordHasher` 改为项目自有 `PasswordVerification{Match, NeedsRehash}` + error；IAM Adapter 在调用 `x/crypto/argon2` 前严格验证 canonical PHC、version、19–64 MiB memory、2–3 iterations、1–4 parallelism、salt/digest 长度和总输入上限。成功匹配的历史参数在创建 Session 前于同一事务重哈希，损坏或超预算记录保留错误链但对外仍 fail-closed。
- 当前依赖刷新确认 `jwx/v3 v3.2.0` 仍为 v3 最新。`x/crypto v0.55.0` 虽为最新，但其 OpenPGP module 记录与 Argon2 无关且没有 fixed version；升级还会连带项目直接使用的 `x/text`，因此本任务保留已无可达漏洞的 `x/crypto v0.54.0`，不把无认证收益的 i18n 依赖升级混入 AUTHN。
- 定向与全仓测试、race、vet、生成、CGO-free build、文档和漏洞扫描均通过；完整质量脚本最终仍只命中范围外、既有且未修改的 `old-backend/` 两个 tracked `app.db`。
