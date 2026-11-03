package httpx

import (
	"log"
	"net/http"
	"time"
)

// ClientConfig 定义 HTTP 客户端构造参数。
type ClientConfig struct {
	BaseURL              string
	Timeout              time.Duration
	MaxResponseBodyBytes int64
	Transport            http.RoundTripper
}

// RouterConfig 定义 Router 构造参数。
type RouterConfig struct {
	ErrorHandler ErrorHandler
}

// ServerConfig 定义 HTTP 服务端构造参数。
type ServerConfig struct {
	Addr                string
	ReadHeaderTimeout   time.Duration
	ReadTimeout         time.Duration
	WriteTimeout        time.Duration
	IdleTimeout         time.Duration
	MaxHeaderBytes      int
	RequestTimeout      time.Duration
	MaxRequestBodyBytes int64
	MaxInFlight         int
	TrustedProxyCIDRs   []string
	RateLimit           RateLimitConfig
	CORS                CORSConfig
	ErrorLog            *log.Logger
}

// RateLimitConfig 定义单进程入口令牌桶；跨副本配额不在本契约范围。
// Routes 是按路径前缀覆盖全局速率的可选规则（如登录/初始化端点专用更严限流）。
type RateLimitConfig struct {
	Mode              RateLimitMode
	RequestsPerSecond int
	Burst             int
	Routes            []RateLimitRoute
}

// RateLimitRoute 是入口速率的按路径前缀覆盖规则；命中路径的请求使用独立
// token bucket，未命中继续使用全局规则。
type RateLimitRoute struct {
	Path              string
	RequestsPerSecond int
	Burst             int
}

// RateLimitMode 声明单进程入口速率保护是否启用。
type RateLimitMode string

const (
	// RateLimitModeLocal 使用当前 Application Generation 私有的本地令牌桶。
	RateLimitModeLocal RateLimitMode = "local"
	// RateLimitModeDisabled 不安装入口速率中间件；并发过载门禁仍然生效。
	RateLimitModeDisabled RateLimitMode = "disabled"
)

// CORSConfig 定义显式跨域 allowlist；空 origin 列表表示拒绝跨域。
type CORSConfig struct {
	AllowedOrigins []string
	AllowedMethods []string
	AllowedHeaders []string
}

type resolvedClientConfig struct {
	BaseURL              string
	Timeout              time.Duration
	MaxResponseBodyBytes int64
	Transport            http.RoundTripper
}

type resolvedRouterConfig struct {
	ErrorHandler ErrorHandler
}

type resolvedServerConfig struct {
	Addr                string
	ReadHeaderTimeout   time.Duration
	ReadTimeout         time.Duration
	WriteTimeout        time.Duration
	IdleTimeout         time.Duration
	MaxHeaderBytes      int
	RequestTimeout      time.Duration
	MaxRequestBodyBytes int64
	MaxInFlight         int
	TrustedProxyCIDRs   []string
	RateLimit           RateLimitConfig
	CORS                CORSConfig
	ErrorLog            *log.Logger
}
