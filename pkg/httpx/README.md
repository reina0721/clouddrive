# httpx

`pkg/httpx` 是项目内通用 HTTP 封装，包含出站客户端和入站服务端路由能力。客户端基于 Go 标准库 `net/http`，服务端路由基于 `net/http` 和 `github.com/go-chi/chi/v5`；业务代码通过本包的 `Client`、`Router`、`Context` 和 `Server` API 使用常见 HTTP 能力。

## 技术选型

- 客户端优先使用 `net/http`：标准库长期稳定，原生支持连接池、`context.Context` 取消、超时、`Transport` 替换和 `httptest` 验证，能覆盖脚手架的通用出站请求场景。
- 服务端继续使用 `net/http` 作为基础协议，并使用 `chi/v5` 负责路由匹配和标准中间件组合。chi 轻量、兼容标准库、维护活跃，适合长期 REST API 项目。
- 单进程入口速率保护使用 Go 官方扩展库 `golang.org/x/time/rate` 的并发安全 token bucket；第三方类型只留在 `RateLimiter` 薄实现内，项目继续拥有 429、Problem、配置和 generation 生命周期语义。
- CORS 标准 header、完整 preflight `Vary` 与列表规范化由 `rs/cors` 负责，unsafe cross-site defense-in-depth 使用 Go 标准库 `http.CrossOriginProtection`；两者都隐藏在项目 `CORS` 边界内。项目仍拥有 exact/default-deny、稳定 Problem 和拒绝时不调用业务 Handler 的策略。
- Huma typed binding 的内部解析/校验错误统一转换为本包拥有的 RFC 9457 `Problem`；业务错误通过不依赖 Huma 类型的 `ProtocolProblemError` 保留稳定 status/code、请求 instance 与低敏响应。Huma 的默认错误模型不成为公开协议。
- 首版不引入 `resty`、`fasthttp` 或完整 Web 框架。通用脚手架更需要稳定边界和低依赖面；只有出现明确场景时，才在包内部重新评估第三方客户端或框架。
- chi 只作为本包内部路由实现，业务代码不直接依赖 chi 类型。

## 设计目标

- 简单：封装常见 JSON 请求、响应解码、路由注册和响应写入。
- 通用：覆盖客户端请求、服务端路由、中间件、统一错误处理和优雅关闭。
- 可维护：配置、默认值、请求、响应、路由、上下文和服务生命周期分文件维护。
- 边界清晰：不提供全局 client/router/server，推荐在应用入口创建后显式注入。

## 目录结构

```text
pkg/httpx/
├── builder.go      # 配置补全、校验和内部辅助逻辑
├── client.go       # Client 接口和 HTTP 请求执行
├── config.go       # ClientConfig、RouterConfig、ServerConfig
├── constants.go    # 方法、Header、Content-Type、错误码等固定定义
├── context.go      # 服务端 Context 和响应/绑定辅助方法
├── defaults.go     # 默认配置和默认值
├── errors.go       # StatusError 等错误类型
├── middleware.go   # Handler、Middleware、ErrorHandler
├── metadata.go     # 跨 HTTP 协议边界传递的类型化请求元数据
├── request.go      # 客户端 Request
├── response.go     # 客户端 Response
├── router.go       # Router 和默认错误处理
├── server.go       # Server 生命周期封装
└── README.md       # 使用文档
```

## 配置项说明

### ClientConfig

| 字段 | 说明 | 默认值 |
| --- | --- | --- |
| `BaseURL` | 客户端基础地址，配置后 `Request.URL` 可使用相对路径 | 空 |
| `Timeout` | 单次请求总超时 | `10s` |
| `MaxResponseBodyBytes` | 最大响应体读取大小 | `10MiB` |
| `Transport` | 自定义 `http.RoundTripper` | `nil`，使用标准库默认 Transport |

基础 Client 每次 `Do` 只发送一次请求，不对 transport error、`429` 或 `5xx` 隐式重试。真实下游 Adapter 若需要重试，必须拥有 operation 幂等依据、status/transport 分类、`Retry-After` 上限、总 budget 与观测，不能把这些语义重新放回全局 Client 开关。

### RouterConfig

| 字段 | 说明 | 默认值 |
| --- | --- | --- |
| `ErrorHandler` | 统一错误处理函数 | `DefaultErrorHandler` |

`Router.Use` 接收项目自己的 `Middleware`，`Router.UseHTTP` 接收标准库形态的 `func(http.Handler) http.Handler`，用于接入 chi 生态或其他标准 HTTP 中间件。

### ServerConfig

| 字段 | 说明 | 默认值 |
| --- | --- | --- |
| `Addr` | 服务监听地址 | `127.0.0.1:8080` |
| `ReadHeaderTimeout` | 请求头读取超时 | `5s` |
| `ReadTimeout` | 请求读取超时 | `15s` |
| `WriteTimeout` | 响应写入超时 | `30s` |
| `IdleTimeout` | 空闲连接超时 | `60s` |
| `MaxHeaderBytes` | 最大请求头大小 | `http.DefaultMaxHeaderBytes` |

`RateLimit.Mode` 只有 `local` 与 `disabled`。`local` 要求 `RequestsPerSecond` 和 `Burst` 都为正，并在每个 Application Generation 创建独立的满 bucket；`disabled` 不安装速率中间件，但固定权重、非阻塞的 `MaxInFlight` 过载门禁仍返回 503。默认 `100/200/128` 只是脚手架起点，部署方必须依据容量、SLO 和入口网关校准；该能力不是按用户、IP、路由或跨副本一致的业务 quota。

`CORSConfig` 只接受显式 HTTP(S) Origin、method 与 header，不支持 wildcard、credentials 或 Private Network Access。安全的跨域实际请求可以执行但不会获得 allow header；不允许的 unsafe cross-site 请求在业务 Handler 前返回项目 403 Problem。该入口防护不替代 IAM Session 的严格 Origin 与 `X-CSRF-Token` 校验。

## 客户端基础示例

```go
package main

import (
	"context"
	"fmt"

	"github.com/reina0721/clouddrive/pkg/httpx"
)

func main() {
	client, err := httpx.NewClient(nil)
	if err != nil {
		panic(err)
	}
	defer client.CloseIdleConnections()

	var out struct {
		Name string `json:"name"`
	}
	_, err = client.JSON(context.Background(), httpx.Request{
		Method: httpx.MethodGet,
		URL:    "https://example.com/api/user",
		Query:  map[string]string{"id": "1"},
	}, &out)
	if err != nil {
		panic(err)
	}

	fmt.Println(out.Name)
}
```

## 客户端自定义示例

```go
package main

import (
	"context"
	"net/http"
	"time"

	"github.com/reina0721/clouddrive/pkg/httpx"
)

func main() {
	client, err := httpx.NewClient(&httpx.ClientConfig{
		BaseURL:              "https://example.com",
		Timeout:              3 * time.Second,
		MaxResponseBodyBytes: 2 << 20,
	})
	if err != nil {
		panic(err)
	}

	_, err = client.Do(context.Background(), httpx.Request{
		Method:       httpx.MethodPost,
		URL:          "/api/users",
		Headers:      map[string]string{"X-Trace-ID": "trace-1"},
		Body:         map[string]string{"name": "rin"},
		AcceptStatus: []int{http.StatusCreated},
	})
	if err != nil {
		panic(err)
	}
}
```

## 服务端基础示例

```go
package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"

	"github.com/reina0721/clouddrive/pkg/httpx"
)

func main() {
	router := httpx.NewRouter(nil)
	router.Handle(httpx.MethodGet, "/users/{id}", func(ctx *httpx.Context) error {
		return ctx.JSON(http.StatusOK, map[string]string{
			"id": ctx.Param("id"),
		})
	})

	server, err := httpx.NewServer(nil, router)
	if err != nil {
		panic(err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	if err := server.Start(ctx); err != nil {
		panic(err)
	}
	runDone := make(chan error, 1)
	go func() { runDone <- server.Run(context.Background()) }()
	<-server.Running()

	<-ctx.Done()
	if err := server.Stop(context.Background()); err != nil {
		panic(err)
	}
	if err := <-runDone; err != nil {
		panic(err)
	}
}
```

## 在业务代码中的推荐使用方式

推荐在应用入口创建 `Client`、`Router` 和 `Server`，再通过构造函数注入业务组件。业务组件不要在函数内部重复创建客户端，也不要绕过 `httpx` 重新散写 JSON 请求、状态码判断和错误响应。

```go
package user

import (
	"context"

	"github.com/reina0721/clouddrive/pkg/httpx"
)

type Gateway struct {
	client  httpx.Client
	baseURL string
}

func NewGateway(client httpx.Client, baseURL string) *Gateway {
	return &Gateway{client: client, baseURL: baseURL}
}

func (g *Gateway) Find(ctx context.Context, id string, out any) error {
	_, err := g.client.JSON(ctx, httpx.Request{
		Method: httpx.MethodGet,
		URL:    g.baseURL + "/users/" + id,
	}, out)
	return err
}
```

`Server.Stop(ctx)` 只执行 `http.Server.Shutdown` 并等待 Serve 完成，不会在超时后暗中强关连接。进程 owner 只有在 graceful 失败且预算仍允许时，才通过 `Server.ForceStop(ctx)` 显式调用 `Close`；forced 会作为有损结果上报。当前 Server 不治理 hijacked/WebSocket 连接，出现真实升级协议时必须增加独立 owner。

长期 Service 使用 `ListenerHub` 独占物理 TCP listener。每个不可变 Application Generation 创建自己的 `Server` 和虚拟 listener route；候选先通过 `StartWithListener` 进入 Serve-ready，commit 再把新连接 dispatch 到新 route。旧 route 的 pending connection 先交付旧 Server，然后 `Shutdown` 排空 active connection/request。`ListenerHub` 是 composition owner 的基础设施，不应进入业务模块或作为运行时查询入口。

基础 Client 不实现通用重试或熔断；Server 的 OpenAPI、安全和观测能力由各自现行文档说明。新增出站韧性必须在明确下游 failure domain 后单独设计，并继续保持业务侧只依赖项目契约。
