package httpx

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/reina0721/clouddrive/pkg/idgen"
	"github.com/reina0721/clouddrive/pkg/logger"
	"github.com/rs/cors"
	"golang.org/x/time/rate"
)

const headerRequestID = "X-Request-ID"

type requestIDContextKey struct{}
type operationIDContextKey struct{}
type traceIDContextKey struct{}

var requestIDPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`)

// RequestIDFromContext 读取 RequestID 中间件写入的 request id。
func RequestIDFromContext(ctx context.Context) (string, bool) {
	if ctx == nil {
		return "", false
	}
	value, ok := ctx.Value(requestIDContextKey{}).(string)
	return value, ok && value != ""
}

// WithOperationID 把生成 inventory 中的稳定 operationId 写入请求上下文。
func WithOperationID(ctx context.Context, operationID string) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	return context.WithValue(ctx, operationIDContextKey{}, operationID)
}

// OperationIDFromContext 读取 strict transport 写入的稳定 operationId。
func OperationIDFromContext(ctx context.Context) (string, bool) {
	if ctx == nil {
		return "", false
	}
	value, ok := ctx.Value(operationIDContextKey{}).(string)
	return value, ok && value != ""
}

// WithTraceID 允许观测 Adapter 把已经校验的 trace id 注入项目 HTTP 上下文。
func WithTraceID(ctx context.Context, traceID string) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	if traceID == "" {
		return ctx
	}
	return context.WithValue(ctx, traceIDContextKey{}, traceID)
}

// TraceIDFromContext 返回用于结构日志关联的 trace id。
func TraceIDFromContext(ctx context.Context) (string, bool) {
	if ctx == nil {
		return "", false
	}
	value, ok := ctx.Value(traceIDContextKey{}).(string)
	return value, ok && value != ""
}

// Recovery 将 panic 转换为统一 500 错误。
func Recovery(log logger.Logger) Middleware {
	return func(next Handler) Handler {
		return func(ctx *Context) (err error) {
			defer func() {
				if recovered := recover(); recovered != nil {
					if log != nil {
						log.Error("http panic recovered", logger.String("panic_type", fmt.Sprintf("%T", recovered)))
					}
					err = &StatusError{StatusCode: http.StatusInternalServerError, Code: errorCodeInternalServer, Message: "internal server error", Err: fmt.Errorf("%v", recovered)}
				}
			}()
			return next(ctx)
		}
	}
}

// RequestID 确保每个请求都有 request id，并写入包内上下文。
func RequestID(generator idgen.Generator) Middleware {
	if generator == nil {
		generator = idgen.UUID()
	}
	return func(next Handler) Handler {
		return func(ctx *Context) error {
			requestID := ctx.Request.Header.Get(headerRequestID)
			if !requestIDPattern.MatchString(requestID) {
				generated, err := generator.New()
				if err != nil {
					return err
				}
				requestID = generated
			}
			ctx.ResponseWriter.Header().Set(headerRequestID, requestID)
			ctx.Request = ctx.Request.WithContext(context.WithValue(ctx.Request.Context(), requestIDContextKey{}, requestID))
			return next(ctx)
		}
	}
}

// AccessLog 记录稳定 operation、请求方法、耗时和 request id，不记录原始 URL。
func AccessLog(log logger.Logger) Middleware {
	return func(next Handler) Handler {
		return func(ctx *Context) error {
			startedAt := time.Now()
			err := next(ctx)
			if log != nil {
				fields := []logger.Field{
					logger.String("method", ctx.Request.Method),
					logger.Duration("duration", time.Since(startedAt)),
				}
				if operationID, ok := OperationIDFromContext(ctx.Request.Context()); ok {
					fields = append(fields, logger.String("operation", operationID))
				}
				if requestID, ok := RequestIDFromContext(ctx.Request.Context()); ok {
					fields = append(fields, logger.String("request_id", requestID))
				}
				if traceID, ok := TraceIDFromContext(ctx.Request.Context()); ok {
					fields = append(fields, logger.String("trace_id", traceID))
				}
				status, code, recoverable, failed := classifyHTTPLogOutcome(ctx.ResponseWriter, err)
				if failed {
					fields = append(fields,
						logger.Int("status", status),
						logger.String("status_class", fmt.Sprintf("%dxx", status/100)),
						logger.String("error_code", code),
					)
					if err != nil {
						fields = append(fields, logger.String("error_type", fmt.Sprintf("%T", err)))
					}
					if recoverable {
						log.Warn("http request rejected", fields...)
					} else {
						log.Error("http request failed", fields...)
					}
				} else {
					log.Info("http request completed", fields...)
				}
			}
			return err
		}
	}
}

func classifyHTTPLogOutcome(writer http.ResponseWriter, err error) (status int, code string, recoverable bool, failed bool) {
	if responseStatus, problemCode, ok := responseOutcome(writer); ok {
		status = responseStatus
		code = problemCode
		failed = status >= http.StatusBadRequest
	}
	if err == nil && !failed {
		return status, code, false, false
	}
	if status == 0 {
		status = http.StatusInternalServerError
	}
	if code == "" {
		code = errorCodeInternalServer
	}
	var statusErr *StatusError
	if errors.As(err, &statusErr) {
		status = statusErrorStatusCode(statusErr)
		code = statusErr.Code
	}
	recoverable = status >= http.StatusBadRequest && status < http.StatusInternalServerError
	if status == http.StatusServiceUnavailable && code == "server_overloaded" {
		recoverable = true
	}
	return status, code, recoverable, true
}

// SecureHeaders 写入常用安全响应头。
func SecureHeaders() Middleware {
	return func(next Handler) Handler {
		return func(ctx *Context) error {
			header := ctx.ResponseWriter.Header()
			header.Set("X-Content-Type-Options", "nosniff")
			header.Set("X-Frame-Options", "DENY")
			header.Set("Referrer-Policy", "no-referrer")
			return next(ctx)
		}
	}
}

// CORS 组合成熟 CORS 协议实现与标准库跨站保护；空 origin allowlist 表示拒绝跨域。
// 项目继续拥有 exact allowlist、稳定 Problem 和拒绝时不调用业务 Handler 的语义。
func CORS(cfg CORSConfig) (Middleware, error) {
	if err := validateCORSConfig(cfg); err != nil {
		return nil, err
	}
	origins := make(map[string]struct{}, len(cfg.AllowedOrigins))
	methods := make(map[string]struct{}, len(cfg.AllowedMethods))
	headers := make(map[string]struct{}, len(cfg.AllowedHeaders))
	protection := http.NewCrossOriginProtection()
	for _, origin := range cfg.AllowedOrigins {
		origins[origin] = struct{}{}
		if err := protection.AddTrustedOrigin(origin); err != nil {
			return nil, fmt.Errorf("add trusted CORS origin: %w", err)
		}
	}
	for _, method := range cfg.AllowedMethods {
		methods[method] = struct{}{}
	}
	for _, header := range cfg.AllowedHeaders {
		headers[strings.ToLower(header)] = struct{}{}
	}
	protocol := cors.New(cors.Options{
		AllowOriginFunc: func(origin string) bool {
			_, allowed := origins[origin]
			return allowed
		},
		AllowedMethods:       append([]string(nil), cfg.AllowedMethods...),
		AllowedHeaders:       append([]string(nil), cfg.AllowedHeaders...),
		OptionsSuccessStatus: http.StatusNoContent,
	})
	return func(next Handler) Handler {
		return func(ctx *Context) error {
			origin := ctx.Request.Header.Get("Origin")
			if origin != "" && !SameOrigin(ctx.Request, origin) && !safeCrossOriginMethod(ctx.Request.Method) {
				if _, allowed := origins[origin]; !allowed {
					return &StatusError{StatusCode: http.StatusForbidden, Code: "cors_origin_denied", Message: "cross-origin request is not allowed"}
				}
			}
			if err := protection.Check(ctx.Request); err != nil {
				return &StatusError{StatusCode: http.StatusForbidden, Code: "cors_origin_denied", Message: "cross-origin request is not allowed"}
			}
			if origin != "" && !SameOrigin(ctx.Request, origin) && ctx.Request.Method == http.MethodOptions && ctx.Request.Header.Get("Access-Control-Request-Method") != "" {
				if _, allowed := origins[origin]; !allowed {
					return &StatusError{StatusCode: http.StatusForbidden, Code: "cors_origin_denied", Message: "cross-origin request is not allowed"}
				}
				requestedMethod := ctx.Request.Header.Get("Access-Control-Request-Method")
				if _, allowed := methods[requestedMethod]; !allowed {
					return &StatusError{StatusCode: http.StatusForbidden, Code: "cors_method_denied", Message: "cross-origin method is not allowed"}
				}
				normalizedHeaders := make([]string, 0)
				normalizedSeen := make(map[string]struct{})
				for _, requestedHeader := range strings.Split(ctx.Request.Header.Get("Access-Control-Request-Headers"), ",") {
					requestedHeader = strings.ToLower(strings.TrimSpace(requestedHeader))
					if requestedHeader == "" {
						continue
					}
					if _, allowed := headers[requestedHeader]; !allowed {
						return &StatusError{StatusCode: http.StatusForbidden, Code: "cors_header_denied", Message: "cross-origin header is not allowed"}
					}
					if _, duplicate := normalizedSeen[requestedHeader]; !duplicate {
						normalizedHeaders = append(normalizedHeaders, requestedHeader)
						normalizedSeen[requestedHeader] = struct{}{}
					}
				}
				sort.Strings(normalizedHeaders)
				ctx.Request.Header.Set("Access-Control-Request-Headers", strings.Join(normalizedHeaders, ","))
			}

			var nextErr error
			nextCalled := false
			protocol.Handler(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
				nextCalled = true
				ctx.ResponseWriter = writer
				ctx.Request = request
				nextErr = next(ctx)
			})).ServeHTTP(ctx.ResponseWriter, ctx.Request)
			if !nextCalled {
				return nil
			}
			return nextErr
		}
	}, nil
}

func safeCrossOriginMethod(method string) bool {
	switch method {
	case http.MethodGet, http.MethodHead, http.MethodOptions:
		return true
	default:
		return false
	}
}

// SameOrigin 判断 Origin 是否与服务端当前看到的请求 scheme 和 Host 精确一致。
func SameOrigin(request *http.Request, origin string) bool {
	if request == nil || request.Host == "" {
		return false
	}
	origin = strings.TrimSpace(origin)
	if origin == "" {
		return false
	}
	scheme := "http"
	if request.TLS != nil {
		scheme = "https"
	}
	return origin == scheme+"://"+request.Host
}

// BodyLimit 限制请求体大小。
func BodyLimit(maxBytes int64) Middleware {
	return func(next Handler) Handler {
		return func(ctx *Context) error {
			if maxBytes <= 0 {
				return next(ctx)
			}
			ctx.Request.Body = http.MaxBytesReader(ctx.ResponseWriter, ctx.Request.Body, maxBytes)
			return next(ctx)
		}
	}
}

// RequestTimeout 为每个请求建立有界 application deadline。
func RequestTimeout(timeout time.Duration) Middleware {
	return func(next Handler) Handler {
		return func(ctx *Context) error {
			if timeout <= 0 {
				return next(ctx)
			}
			requestCtx, cancel := context.WithTimeout(ctx.Request.Context(), timeout)
			defer cancel()
			ctx.Request = ctx.Request.WithContext(requestCtx)
			err := next(ctx)
			if errors.Is(requestCtx.Err(), context.DeadlineExceeded) {
				return &StatusError{StatusCode: http.StatusGatewayTimeout, Code: "request_timeout", Message: "request deadline exceeded", Err: errors.Join(err, requestCtx.Err())}
			}
			return err
		}
	}
}

type clientIPContextKey struct{}

// ClientIPFromContext 返回经过 trusted proxy policy 解析的客户端地址。
func ClientIPFromContext(ctx context.Context) (net.IP, bool) {
	if ctx == nil {
		return nil, false
	}
	value, ok := ctx.Value(clientIPContextKey{}).(net.IP)
	return append(net.IP(nil), value...), ok && value != nil
}

// TrustedProxy 只在直连 peer 命中显式 CIDR 时采用 X-Forwarded-For 首地址。
func TrustedProxy(cidrs []string) (Middleware, error) {
	networks := make([]*net.IPNet, 0, len(cidrs))
	for _, value := range cidrs {
		_, network, err := net.ParseCIDR(value)
		if err != nil {
			return nil, fmt.Errorf("parse trusted proxy CIDR %q: %w", value, err)
		}
		networks = append(networks, network)
	}
	return func(next Handler) Handler {
		return func(ctx *Context) error {
			peer := remoteIP(ctx.Request.RemoteAddr)
			client := peer
			if containsIP(networks, peer) {
				forwarded := strings.Split(ctx.Request.Header.Get("X-Forwarded-For"), ",")[0]
				if parsed := net.ParseIP(strings.TrimSpace(forwarded)); parsed != nil {
					client = parsed
				}
			}
			ctx.Request = ctx.Request.WithContext(context.WithValue(ctx.Request.Context(), clientIPContextKey{}, client))
			return next(ctx)
		}
	}, nil
}

func remoteIP(address string) net.IP {
	host, _, err := net.SplitHostPort(address)
	if err == nil {
		return net.ParseIP(host)
	}
	return net.ParseIP(address)
}

func containsIP(networks []*net.IPNet, value net.IP) bool {
	for _, network := range networks {
		if value != nil && network.Contains(value) {
			return true
		}
	}
	return false
}

// AcceptJSONHandler 返回适用于 http.Handler 链的 JSON Accept 门禁。
// 只用于必须返回 JSON/Problem 的 API 分组边界；静态页面等其它表示不得经过它。
func AcceptJSONHandler() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			accept := request.Header.Get("Accept")
			if accept == "" || acceptsJSON(accept) {
				next.ServeHTTP(writer, request)
				return
			}
			WriteProblem(writer, request, &StatusError{StatusCode: http.StatusNotAcceptable, Code: "not_acceptable", Message: "response representation is not acceptable"})
		})
	}
}

func acceptsJSON(value string) bool {
	for _, item := range strings.Split(value, ",") {
		mediaType := strings.TrimSpace(strings.SplitN(item, ";", 2)[0])
		switch mediaType {
		case "*/*", "application/*", "application/json", problemContentType:
			return true
		}
	}
	return false
}

// RejectUpgrade 确定性拒绝当前同步 HTTP profile 未治理的升级连接。
func RejectUpgrade() Middleware {
	return func(next Handler) Handler {
		return func(ctx *Context) error {
			if ctx.Request.Header.Get("Upgrade") != "" || strings.Contains(strings.ToLower(ctx.Request.Header.Get("Connection")), "upgrade") {
				return &StatusError{StatusCode: http.StatusUpgradeRequired, Code: "upgrade_not_supported", Message: "connection upgrade is not supported"}
			}
			return next(ctx)
		}
	}
}

// RateLimiter 使用 Go 官方扩展库的并发安全令牌桶限制入口请求速率。
// 第三方类型只存在于该薄实现内部，不进入配置或业务契约。
type RateLimiter struct{ limiter *rate.Limiter }

// NewRateLimiterWithBurst 创建显式速率和突发容量的无 goroutine 令牌桶。
func NewRateLimiterWithBurst(tokensPerSecond, burst int) (*RateLimiter, error) {
	if tokensPerSecond <= 0 {
		return nil, fmt.Errorf("rate limit requests per second must be positive")
	}
	if burst <= 0 {
		return nil, fmt.Errorf("rate limit burst must be positive")
	}
	return &RateLimiter{limiter: rate.NewLimiter(rate.Limit(tokensPerSecond), burst)}, nil
}

// Middleware 返回 HTTP 中间件，限流状态由 RateLimiter 实例持有。
func (r *RateLimiter) Middleware() Middleware {
	return func(next Handler) Handler {
		return func(ctx *Context) error {
			if r == nil || r.limiter == nil {
				return fmt.Errorf("rate limiter is nil")
			}
			if err := ctx.Request.Context().Err(); err != nil {
				return ctx.Request.Context().Err()
			}
			if !r.limiter.Allow() {
				return &StatusError{StatusCode: http.StatusTooManyRequests, Code: "rate_limited", Message: "local request rate exceeded", RetryAfter: 1}
			}
			return next(ctx)
		}
	}
}

// OverloadLimiter 以非阻塞 semaphore 限制单进程 in-flight 请求。
type OverloadLimiter struct{ slots chan struct{} }

// PathRateLimiter 是带按路径覆盖规则的入口令牌桶：请求路径命中任意
// RateLimitRoute 前缀时使用该路由的独立 token bucket，否则使用全局 bucket。
// 路径规则用于登录/初始化等端点施加比全局更严的限流，不改变未命中请求的
// 全局语义。
type PathRateLimiter struct {
	global *rate.Limiter
	routes []pathRateLimit
}

type pathRateLimit struct {
	prefix  string
	limiter *rate.Limiter
}

// NewPathRateLimiter 构造全局与按路径规则限流器；routes 为空时仅全局生效。
func NewPathRateLimiter(requestsPerSecond, burst int, routes []RateLimitRoute) (*PathRateLimiter, error) {
	global, err := NewRateLimiterWithBurst(requestsPerSecond, burst)
	if err != nil {
		return nil, err
	}
	result := &PathRateLimiter{global: global.limiter}
	for _, route := range routes {
		limited, routeErr := NewRateLimiterWithBurst(route.RequestsPerSecond, route.Burst)
		if routeErr != nil {
			return nil, routeErr
		}
		result.routes = append(result.routes, pathRateLimit{prefix: route.Path, limiter: limited.limiter})
	}
	return result, nil
}

// Middleware 返回 HTTP 中间件；path 前缀命中路由规则时用路由 bucket。
func (r *PathRateLimiter) Middleware() Middleware {
	return func(next Handler) Handler {
		return func(ctx *Context) error {
			if r == nil || r.global == nil {
				return fmt.Errorf("path rate limiter is nil")
			}
			if err := ctx.Request.Context().Err(); err != nil {
				return err
			}
			limiter := r.global
			path := ctx.Request.URL.Path
			for _, route := range r.routes {
				if strings.HasPrefix(path, route.prefix) {
					limiter = route.limiter
					break
				}
			}
			if !limiter.Allow() {
				return &StatusError{StatusCode: http.StatusTooManyRequests, Code: "rate_limited", Message: "local request rate exceeded", RetryAfter: 1}
			}
			return next(ctx)
		}
	}
}

// NewOverloadLimiter 创建不启动后台 goroutine 的并发门禁。
func NewOverloadLimiter(maxInFlight int) (*OverloadLimiter, error) {
	if maxInFlight <= 0 {
		return nil, fmt.Errorf("max in-flight requests must be positive")
	}
	return &OverloadLimiter{slots: make(chan struct{}, maxInFlight)}, nil
}

// Middleware 在容量耗尽时返回 503，不排队占用未知预算。
func (l *OverloadLimiter) Middleware() Middleware {
	return func(next Handler) Handler {
		return func(ctx *Context) error {
			if l == nil || l.slots == nil {
				return fmt.Errorf("overload limiter is nil")
			}
			select {
			case l.slots <- struct{}{}:
				defer func() { <-l.slots }()
				return next(ctx)
			default:
				return &StatusError{StatusCode: http.StatusServiceUnavailable, Code: "server_overloaded", Message: "server is overloaded", RetryAfter: 1}
			}
		}
	}
}
