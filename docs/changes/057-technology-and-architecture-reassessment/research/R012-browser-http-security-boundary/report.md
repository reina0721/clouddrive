# R012 浏览器 HTTP 安全边界与成熟中间件复核

## 决策

采用 `github.com/rs/cors v1.11.1` 处理 CORS 标准 header、`Vary`、preflight 与大小写/列表规范化；使用 Go 1.26 标准库 `http.CrossOriginProtection` 对 unsafe cross-site 请求提供 `Sec-Fetch-Site`/Origin 防护。二者隐藏在 `pkg/httpx.CORS` 后，不进入业务模块。

项目继续拥有 CORS 配置、default deny、exact allowlist、稳定 Problem 与“未允许的 unsafe 实际请求不得执行 handler”语义。`rs/cors` 对不允许的 actual request 默认只省略 allow header、仍调用 handler，因此不能把项目安全策略完全交给库默认值；项目薄 precheck 与 `CrossOriginProtection` 负责 fail-closed，库负责协议机制。

IAM Session CSRF token、rotation、constant-time validation 和 mutation guard 继续由 IAM 拥有。`CrossOriginProtection` 是 defense-in-depth，不替代 token，因为无 Origin/Sec-Fetch-Site 的非浏览器请求会被标准库允许，而 IAM 当前要求已解析 Session、严格 Origin 和有效 `X-CSRF-Token`。

安全响应头继续使用项目显式 `SecureHeaders`，不引入 `unrolled/secure`。

## 当前代码事实

- `pkg/httpx.CORS` 自行完成 exact origin、method/header allowlist、preflight header 和 403 Problem；约 40 行核心协议逻辑。
- 当前实现只在允许跨域时添加 `Vary: Origin`，没有覆盖 preflight 对 `Access-Control-Request-Method/Headers` 的完整缓存变化维度；成熟库在这里有明确价值。
- `SameOrigin` 使用当前 request scheme + Host 精确比较，被 IAM login/setup/mutation guard 使用；IAM 还要求 Session CSRF token，不能用通用 CORS 中间件替代。
- `SecureHeaders` 只设置 `nosniff`、`DENY` 和 `no-referrer`。当前 Go 服务主要呈现 API/manifest；CSP、HSTS、COOP/COEP/CORP 是否安全取决于前端资产、TLS termination 和跨域资源模型，不能从通用默认值猜测。

## 候选核验

| 候选 | 当前事实 | 结论 |
| --- | --- | --- |
| `rs/cors v1.11.1` | MIT，2024-08 release，仓库 2026-06 仍维护，约 2.9k stars；支持 exact/wildcard origin、Vary、preflight、credentials/private-network 等 | **采用窄范围**。只启用当前 exact origin/method/header 与 204 preflight，不开放 wildcard、credentials、private network 或 debug logger |
| `http.CrossOriginProtection` | Go 1.25+ 标准库；以 `Sec-Fetch-Site` 或 Origin/Host 判定，unsafe cross-origin 403，可配置 trusted origin 与项目 deny handler | **采用 defense-in-depth**。AllowedOrigins 映射为 trusted origin；deny path 输出项目 Problem |
| `unrolled/secure v1.17.0` | MIT，2024-10 release，仓库 2026-05 仍维护，覆盖 HSTS/CSP/COOP 等大量 header policy | **拒绝当前引入**。项目只有三个稳定静态 header；库不能替项目决定 TLS/CSP/asset policy，Wrapper 与配置成本高于现有实现 |

版本特定 OSV 查询对 `rs/cors@v1.11.1`、`unrolled/secure@v1.17.0` 均返回 0 条影响当前版本的记录。rs/cors module 名称层面存在 4 条历史公告，说明实施必须固定当前已修复版本并运行实际依赖图扫描，不能只写“无漏洞”。

## 实施边界

`SEC-057-002` 只允许：

1. `pkg/httpx.CORS` 内部引入 `rs/cors` 与 `CrossOriginProtection`，对外继续接收项目 `CORSConfig`。
2. 保留 exact origin、显式 method/header、empty allowlist deny 和项目 Problem；preflight 使用标准 204 + 完整 Vary。
3. 对 disallowed unsafe actual request 验证 handler 未执行；对 safe cross-origin request 允许执行但不得暴露 allow header，这是 Fetch/CORS 的标准边界。
4. IAM mutation 继续同时要求 Session、严格 Origin 和 CSRF token；不得用全局 middleware 成功结果绕过 IAM guard。
5. 删除手工 CORS response header/string-set 实现，不保留第二套协议路径。

不在本任务新增 wildcard、credentialed cross-origin、Private Network Access、HSTS/CSP/COOP 配置或 proxy TLS 推断。出现这些真实部署需求时，先建立对应 authority 和浏览器集成测试。

## 验收与停止条件

- conformance matrix 覆盖 no Origin、same-origin、allowed/disallowed origin、safe/unsafe method、allowed/disallowed requested method/header、preflight Vary、IAM CSRF 和 handler-not-called；
- CORS/CSRF 错误继续是低敏 Problem，不打印 Origin/token；
- `rs/cors` 类型不离开 `pkg/httpx`；
- Go test/race、Huma 后续路由第一片、漏洞扫描和 docs guard 通过。

若保持 fail-closed 需要复制 rs/cors 大部分协议实现，或 Huma router integration 迫使双轨，则停止并回到计划；不得为了“用了库”增加更复杂的 Wrapper。

## 局限

本研究没有真实浏览器 E2E 或 TLS reverse-proxy 环境；因此明确不决定 credentialed CORS、HSTS 与 CSP。当前结论只覆盖仓库已有 exact allowlist 和 same-origin Session 模型。
