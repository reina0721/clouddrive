# 045 WebUI Origin 策略闭环设计

## 1. HTTP CORS

在 `pkg/httpx` 内集中计算请求自身 Origin（TLS 决定 scheme，`Host` 保留端口）。`CORS` 收到非空 Origin 时先比较请求自身 Origin：相同则按同源请求继续；不同时才要求命中 `AllowedOrigins`。默认空列表的跨域拒绝语义不变。

测试覆盖同源 POST、显式允许的跨域 preflight/POST 和未允许跨域拒绝，避免把“存在 Origin”继续误判为跨域。

## 2. WebUI Auth

`webuiauth.Config` 增加不可变 `AllowedOrigins` 副本。Composition 在同一候选快照中解码 HTTP Server Config，并把 `httpConfig.CORS.AllowedOrigins` 注入 Auth；Auth 不读取全局配置，也不维护第二个配置键。

不安全 WebUI Auth 请求满足以下任一条件时通过 Origin 边界：

1. Origin 等于请求自身 Origin；
2. Origin 精确命中已注入 allowlist。

不接受通配符、前缀、忽略端口或字符串模糊匹配。

## 3. 本地开发

Vite 设置 `strictPort: true`，保持 5173 与 allowlist 一致。`config.example.yaml`、本地启动指南和当前未跟踪的 `config.yaml` 配置两个固定 HTTPS Origin。若端口占用，用户应释放端口或显式同步修改配置，不允许 Vite 静默换端口。

当前 `config.yaml` 是本地运行状态，不进入 Git；实施前后的 staged diff 必须确认没有把它或任何 Token 加入提交。

## 4. Setup Token UI

Setup Token 输入改为 `type="password"`，使用适合一次性秘密的 `autoComplete` 设置。该修改只降低肩窥和截图暴露风险；已出现在截图中的值仍必须轮换。

## 5. 验证

先运行 CORS/Auth 定向测试，再运行全量 Go 与 Node 门禁。运行态使用独立临时 SQLite、测试专用 Token、后端独立端口和 Vite 5173，验证 setup 成功后立即停止进程并清理临时数据。验收输出只记录状态码和稳定错误码，不打印 Token。
