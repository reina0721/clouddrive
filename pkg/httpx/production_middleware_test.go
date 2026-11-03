package httpx

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/reina0721/clouddrive/pkg/logger"
)

func TestProductionMiddlewareSetsRequestIDAndSecurityHeaders(t *testing.T) {
	router := NewRouter(nil)
	router.Use(RequestID(nil), SecureHeaders())
	router.Handle(MethodGet, "/ok", func(ctx *Context) error {
		if requestID, ok := RequestIDFromContext(ctx.Request.Context()); !ok || requestID == "" {
			t.Fatal("request id missing from context")
		}
		return ctx.Text(http.StatusOK, "ok")
	})
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/ok", nil))
	if recorder.Header().Get(headerRequestID) == "" {
		t.Fatal("request id header is empty")
	}
	if recorder.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Fatal("security header missing")
	}
}

func TestRequestIDRejectsUnsafeInboundValue(t *testing.T) {
	router := NewRouter(nil)
	router.Use(RequestID(nil))
	router.Handle(MethodGet, "/ok", func(ctx *Context) error { return ctx.NoContent(http.StatusNoContent) })
	request := httptest.NewRequest(http.MethodGet, "/ok", nil)
	request.Header.Set(headerRequestID, "unsafe value\r\ninjected")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	got := recorder.Header().Get(headerRequestID)
	if got == "" || got == request.Header.Get(headerRequestID) || !requestIDPattern.MatchString(got) {
		t.Fatalf("sanitized request id = %q", got)
	}
}

func TestTrustedProxyOnlyUsesForwardedAddressForTrustedPeer(t *testing.T) {
	middleware, err := TrustedProxy([]string{"10.0.0.0/8"})
	if err != nil {
		t.Fatalf("TrustedProxy() error = %v", err)
	}
	for _, test := range []struct {
		name, remote, want string
	}{
		{name: "trusted", remote: "10.1.2.3:8443", want: "203.0.113.9"},
		{name: "untrusted", remote: "192.0.2.4:8443", want: "192.0.2.4"},
	} {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodGet, "/", nil)
			request.RemoteAddr = test.remote
			request.Header.Set("X-Forwarded-For", "203.0.113.9, 10.1.2.3")
			var got string
			err := middleware(func(ctx *Context) error {
				ip, ok := ClientIPFromContext(ctx.Request.Context())
				if !ok {
					t.Fatal("client IP missing")
				}
				got = ip.String()
				return nil
			})(&Context{ResponseWriter: httptest.NewRecorder(), Request: request})
			if err != nil || got != test.want {
				t.Fatalf("middleware error = %v, client IP = %q, want %q", err, got, test.want)
			}
		})
	}
}

func TestCORSDefaultsDenyAndExplicitPreflightAllows(t *testing.T) {
	tests := []struct {
		name     string
		cfg      CORSConfig
		method   string
		headers  string
		want     int
		wantCode string
	}{
		{name: "default deny", cfg: DefaultServerConfig().CORS, method: http.MethodPost, want: http.StatusForbidden, wantCode: "cors_origin_denied"},
		{name: "explicit allow", cfg: CORSConfig{
			AllowedOrigins: []string{"https://console.example"}, AllowedMethods: []string{http.MethodPost}, AllowedHeaders: []string{"Content-Type"},
		}, method: http.MethodPost, headers: "Content-Type", want: http.StatusNoContent},
		{name: "method deny", cfg: CORSConfig{
			AllowedOrigins: []string{"https://console.example"}, AllowedMethods: []string{http.MethodGet}, AllowedHeaders: []string{"Content-Type"},
		}, method: http.MethodPost, headers: "Content-Type", want: http.StatusForbidden, wantCode: "cors_method_denied"},
		{name: "header deny", cfg: CORSConfig{
			AllowedOrigins: []string{"https://console.example"}, AllowedMethods: []string{http.MethodPost}, AllowedHeaders: []string{"Authorization"},
		}, method: http.MethodPost, headers: "Content-Type", want: http.StatusForbidden, wantCode: "cors_header_denied"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			router := NewRouter(nil)
			middleware, err := CORS(test.cfg)
			if err != nil {
				t.Fatalf("CORS() error = %v", err)
			}
			router.Use(middleware)
			handlerCalls := 0
			router.Handle(MethodOptions, "/api/v1/todos", func(ctx *Context) error {
				handlerCalls++
				return ctx.NoContent(http.StatusNoContent)
			})
			request := httptest.NewRequest(http.MethodOptions, "/api/v1/todos", nil)
			request.Header.Set("Origin", "https://console.example")
			request.Header.Set("Access-Control-Request-Method", test.method)
			request.Header.Set("Access-Control-Request-Headers", test.headers)
			recorder := httptest.NewRecorder()
			router.ServeHTTP(recorder, request)
			if recorder.Code != test.want {
				t.Fatalf("status = %d, want %d; body = %s", recorder.Code, test.want, recorder.Body.String())
			}
			if handlerCalls != 0 {
				t.Fatalf("preflight handler calls = %d", handlerCalls)
			}
			if test.wantCode != "" {
				assertProblem(t, recorder, test.want, test.wantCode)
				return
			}
			if recorder.Header().Get("Access-Control-Allow-Origin") != "https://console.example" {
				t.Fatalf("allow origin = %q", recorder.Header().Get("Access-Control-Allow-Origin"))
			}
			vary := strings.Join(recorder.Header().Values("Vary"), ",")
			for _, name := range []string{"Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"} {
				if !strings.Contains(vary, name) {
					t.Fatalf("Vary = %q, missing %q", vary, name)
				}
			}
		})
	}
}

func TestCORSAllowsSameOriginPostWithoutCrossOriginAllowlist(t *testing.T) {
	router := NewRouter(nil)
	middleware, err := CORS(DefaultServerConfig().CORS)
	if err != nil {
		t.Fatalf("CORS() error = %v", err)
	}
	router.Use(middleware)
	router.Handle(MethodPost, "/api/v1/webui/auth/setup", func(ctx *Context) error {
		return ctx.NoContent(http.StatusNoContent)
	})
	request := httptest.NewRequest(http.MethodPost, "http://127.0.0.1:8080/api/v1/webui/auth/setup", nil)
	request.Header.Set("Origin", "http://127.0.0.1:8080")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want %d; body = %s", recorder.Code, http.StatusNoContent, recorder.Body.String())
	}
	if recorder.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatalf("same-origin response unexpectedly emitted CORS header %q", recorder.Header().Get("Access-Control-Allow-Origin"))
	}
}

func TestCORSActualRequestAndCrossSiteProtectionMatrix(t *testing.T) {
	cfg := CORSConfig{
		AllowedOrigins: []string{"https://console.example"},
		AllowedMethods: []string{http.MethodGet, http.MethodPost},
		AllowedHeaders: []string{"Content-Type"},
	}
	tests := []struct {
		name            string
		method          string
		origin          string
		fetchSite       string
		want            int
		wantAllowOrigin bool
		wantHandler     bool
	}{
		{name: "no origin unsafe non-browser", method: http.MethodPost, want: http.StatusNoContent, wantHandler: true},
		{name: "allowed unsafe origin", method: http.MethodPost, origin: "https://console.example", fetchSite: "cross-site", want: http.StatusNoContent, wantAllowOrigin: true, wantHandler: true},
		{name: "disallowed safe origin", method: http.MethodGet, origin: "https://evil.example", fetchSite: "cross-site", want: http.StatusNoContent, wantHandler: true},
		{name: "disallowed unsafe origin", method: http.MethodPost, origin: "https://evil.example", fetchSite: "cross-site", want: http.StatusForbidden},
		{name: "scheme mismatch is cross origin", method: http.MethodPost, origin: "https://api.example", want: http.StatusForbidden},
		{name: "cross-site unsafe without origin", method: http.MethodPost, fetchSite: "cross-site", want: http.StatusForbidden},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			middleware, err := CORS(cfg)
			if err != nil {
				t.Fatalf("CORS() error = %v", err)
			}
			handlerCalls := 0
			router := NewRouter(nil)
			router.Use(middleware)
			router.Handle(Method(test.method), "/", func(ctx *Context) error {
				handlerCalls++
				return ctx.NoContent(http.StatusNoContent)
			})
			request := httptest.NewRequest(test.method, "http://api.example/", nil)
			if test.origin != "" {
				request.Header.Set("Origin", test.origin)
			}
			if test.fetchSite != "" {
				request.Header.Set("Sec-Fetch-Site", test.fetchSite)
			}
			recorder := httptest.NewRecorder()
			router.ServeHTTP(recorder, request)
			if recorder.Code != test.want {
				t.Fatalf("status = %d, want %d; body = %s", recorder.Code, test.want, recorder.Body.String())
			}
			if (handlerCalls == 1) != test.wantHandler {
				t.Fatalf("handler calls = %d", handlerCalls)
			}
			if got := recorder.Header().Get("Access-Control-Allow-Origin"); (got != "") != test.wantAllowOrigin {
				t.Fatalf("allow origin = %q", got)
			}
		})
	}
}

func TestCORSRejectsNonExactOriginConfiguration(t *testing.T) {
	for _, origin := range []string{"https://*.example", "https://user@example.com", "https://example.com?tenant=one", "https://example.com#fragment"} {
		if _, err := CORS(CORSConfig{AllowedOrigins: []string{origin}}); err == nil {
			t.Fatalf("CORS(%q) error = nil", origin)
		}
	}
}

func TestProtocolBudgetsReturnStableProblems(t *testing.T) {
	tests := []struct {
		name string
		use  Middleware
		req  *http.Request
		want int
		code string
	}{
		{name: "body", use: BodyLimit(4), req: httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"value":"large"}`)), want: http.StatusRequestEntityTooLarge, code: "request_body_too_large"},
		{name: "upgrade", use: RejectUpgrade(), req: requestWithHeader(http.MethodGet, "Upgrade", "websocket"), want: http.StatusUpgradeRequired, code: "upgrade_not_supported"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			router := NewRouter(nil)
			router.Use(test.use)
			router.Handle(MethodGet, "/", func(ctx *Context) error { return ctx.NoContent(http.StatusNoContent) })
			router.Handle(MethodPost, "/", func(ctx *Context) error {
				var body map[string]any
				return ctx.BindJSON(&body)
			})
			recorder := httptest.NewRecorder()
			router.ServeHTTP(recorder, test.req)
			assertProblem(t, recorder, test.want, test.code)
		})
	}
}

func TestAcceptJSONHandlerGatesHTTPHandlerChains(t *testing.T) {
	next := http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.WriteHeader(http.StatusNoContent)
	})
	tests := []struct {
		name   string
		accept string
		want   int
	}{
		{name: "empty accept", accept: "", want: http.StatusNoContent},
		{name: "json", accept: "application/json", want: http.StatusNoContent},
		{name: "wildcard", accept: "*/*", want: http.StatusNoContent},
		{name: "browser html", accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", want: http.StatusNoContent},
		{name: "html only", accept: "text/html", want: http.StatusNotAcceptable},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, "/api/v1/ping", nil)
			if test.accept != "" {
				request.Header.Set("Accept", test.accept)
			}
			AcceptJSONHandler()(next).ServeHTTP(recorder, request)
			if test.want == http.StatusNoContent {
				if recorder.Code != http.StatusNoContent {
					t.Fatalf("status = %d, want 204; body = %s", recorder.Code, recorder.Body.String())
				}
				return
			}
			assertProblem(t, recorder, test.want, "not_acceptable")
		})
	}
}

func TestRequestTimeoutUsesApplicationDeadline(t *testing.T) {
	router := NewRouter(nil)
	router.Use(RequestTimeout(10 * time.Millisecond))
	router.Handle(MethodGet, "/", func(ctx *Context) error {
		<-ctx.Request.Context().Done()
		return ctx.Request.Context().Err()
	})
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/", nil))
	assertProblem(t, recorder, http.StatusGatewayTimeout, "request_timeout")
}

func TestRateAndOverloadLimitsFailWithoutQueueing(t *testing.T) {
	rateRouter := NewRouter(nil)
	rateLimiter, err := NewRateLimiterWithBurst(1, 1)
	if err != nil {
		t.Fatalf("NewRateLimiterWithBurst() error = %v", err)
	}
	rateRouter.Use(rateLimiter.Middleware())
	rateRouter.Handle(MethodGet, "/", func(ctx *Context) error { return ctx.NoContent(http.StatusNoContent) })
	rateRouter.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))
	rateRecorder := httptest.NewRecorder()
	rateRouter.ServeHTTP(rateRecorder, httptest.NewRequest(http.MethodGet, "/", nil))
	assertProblem(t, rateRecorder, http.StatusTooManyRequests, "rate_limited")
	if rateRecorder.Header().Get("Retry-After") != "1" {
		t.Fatalf("rate Retry-After = %q", rateRecorder.Header().Get("Retry-After"))
	}

	entered := make(chan struct{})
	release := make(chan struct{})
	overloadRouter := NewRouter(nil)
	overloadLimiter, err := NewOverloadLimiter(1)
	if err != nil {
		t.Fatalf("NewOverloadLimiter() error = %v", err)
	}
	overloadRouter.Use(overloadLimiter.Middleware())
	var enteredOnce sync.Once
	overloadRouter.Handle(MethodGet, "/", func(ctx *Context) error {
		enteredOnce.Do(func() { close(entered) })
		<-release
		return ctx.NoContent(http.StatusNoContent)
	})
	var wait sync.WaitGroup
	wait.Add(1)
	go func() {
		defer wait.Done()
		overloadRouter.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))
	}()
	<-entered
	overloadRecorder := httptest.NewRecorder()
	overloadRouter.ServeHTTP(overloadRecorder, httptest.NewRequest(http.MethodGet, "/", nil))
	assertProblem(t, overloadRecorder, http.StatusServiceUnavailable, "server_overloaded")
	close(release)
	wait.Wait()
	releasedRecorder := httptest.NewRecorder()
	overloadRouter.ServeHTTP(releasedRecorder, httptest.NewRequest(http.MethodGet, "/", nil))
	if releasedRecorder.Code != http.StatusNoContent {
		t.Fatalf("request after overload release status = %d", releasedRecorder.Code)
	}
}

func TestPathRateLimiterUsesRouteBuckets(t *testing.T) {
	// 全局 1 rps / burst 1；登录路径 1 rps / burst 2（独立 bucket）。
	limiter, err := NewPathRateLimiter(1, 1, []RateLimitRoute{{Path: "/api/v1/iam/login", RequestsPerSecond: 1, Burst: 2}})
	if err != nil {
		t.Fatalf("NewPathRateLimiter() error = %v", err)
	}
	router := NewRouter(nil)
	router.Use(limiter.Middleware())
	router.Handle(MethodPost, "/api/v1/iam/login", func(ctx *Context) error { return ctx.NoContent(http.StatusNoContent) })
	router.Handle(MethodGet, "/other", func(ctx *Context) error { return ctx.NoContent(http.StatusNoContent) })

	// 登录路径：burst 2 容纳前两个请求，第三个 429。
	for index := 0; index < 2; index++ {
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/api/v1/iam/login", nil))
		if recorder.Code != http.StatusNoContent {
			t.Fatalf("login request %d status = %d", index, recorder.Code)
		}
	}
	limited := httptest.NewRecorder()
	router.ServeHTTP(limited, httptest.NewRequest(http.MethodPost, "/api/v1/iam/login", nil))
	assertProblem(t, limited, http.StatusTooManyRequests, "rate_limited")

	// 非登录路径走全局 bucket（burst 1）：第一个通过，第二个 429。
	otherRecorder := httptest.NewRecorder()
	router.ServeHTTP(otherRecorder, httptest.NewRequest(http.MethodGet, "/other", nil))
	if otherRecorder.Code != http.StatusNoContent {
		t.Fatalf("other request status = %d", otherRecorder.Code)
	}
	otherLimited := httptest.NewRecorder()
	router.ServeHTTP(otherLimited, httptest.NewRequest(http.MethodGet, "/other", nil))
	assertProblem(t, otherLimited, http.StatusTooManyRequests, "rate_limited")
}

func TestRateLimiterRejectsInvalidBudgetAndRefills(t *testing.T) {
	for _, values := range [][2]int{{0, 1}, {1, 0}, {-1, 1}, {1, -1}} {
		if _, err := NewRateLimiterWithBurst(values[0], values[1]); err == nil {
			t.Fatalf("NewRateLimiterWithBurst(%d, %d) error = nil", values[0], values[1])
		}
	}
	if _, err := NewOverloadLimiter(0); err == nil {
		t.Fatal("NewOverloadLimiter(0) error = nil")
	}

	limiter, err := NewRateLimiterWithBurst(100, 1)
	if err != nil {
		t.Fatalf("NewRateLimiterWithBurst() error = %v", err)
	}
	if !limiter.limiter.Allow() || limiter.limiter.Allow() {
		t.Fatal("limiter initial burst behavior is invalid")
	}
	time.Sleep(20 * time.Millisecond)
	if !limiter.limiter.Allow() {
		t.Fatal("limiter did not refill within the expected budget")
	}
}

func TestRateLimiterPreservesCancellationWithoutConsumingToken(t *testing.T) {
	limiter, err := NewRateLimiterWithBurst(1, 1)
	if err != nil {
		t.Fatalf("NewRateLimiterWithBurst() error = %v", err)
	}
	handlerCalls := 0
	handler := limiter.Middleware()(func(*Context) error {
		handlerCalls++
		return nil
	})
	canceledContext, cancel := context.WithCancel(context.Background())
	cancel()
	canceledRequest := httptest.NewRequest(http.MethodGet, "/", nil).WithContext(canceledContext)
	if err := handler(&Context{ResponseWriter: httptest.NewRecorder(), Request: canceledRequest}); !errors.Is(err, context.Canceled) {
		t.Fatalf("canceled request error = %v", err)
	}
	activeRequest := httptest.NewRequest(http.MethodGet, "/", nil)
	if err := handler(&Context{ResponseWriter: httptest.NewRecorder(), Request: activeRequest}); err != nil {
		t.Fatalf("active request error = %v", err)
	}
	if handlerCalls != 1 {
		t.Fatalf("handler calls = %d", handlerCalls)
	}
}

func requestWithHeader(method, name, value string) *http.Request {
	request := httptest.NewRequest(method, "/", nil)
	request.Header.Set(name, value)
	return request
}

func assertProblem(t *testing.T, recorder *httptest.ResponseRecorder, status int, code string) {
	t.Helper()
	var problem Problem
	if err := json.Unmarshal(recorder.Body.Bytes(), &problem); err != nil {
		t.Fatalf("decode Problem: %v; body = %s", err, recorder.Body.String())
	}
	if recorder.Code != status || problem.Status != status || problem.Code != code || recorder.Header().Get("Content-Type") != problemContentType {
		t.Fatalf("response = status %d problem %#v headers %#v", recorder.Code, problem, recorder.Header())
	}
}

func TestRecoveryMapsPanicToStatusError(t *testing.T) {
	handler := Recovery(nil)(func(*Context) error {
		panic("boom")
	})
	err := handler(&Context{ResponseWriter: httptest.NewRecorder(), Request: httptest.NewRequest(http.MethodGet, "/", nil)})
	statusErr, ok := asStatusError(err)
	if !ok || statusErr.StatusCode != http.StatusInternalServerError {
		t.Fatalf("err = %#v", err)
	}
}

func TestRecoveryDoesNotLogPanicValue(t *testing.T) {
	path := filepath.Join(t.TempDir(), "panic.log")
	addCaller := false
	resource, err := logger.New(&logger.Config{
		Environment: logger.EnvironmentProduction,
		OutputPaths: []string{path}, ErrorOutputPaths: []string{path}, AddCaller: &addCaller,
	})
	if err != nil {
		t.Fatalf("logger.New() error = %v", err)
	}
	sensitiveDetail := "UNSAFE_PANIC_DETAIL_SENTINEL"
	handler := Recovery(resource)(func(*Context) error { panic(sensitiveDetail) })
	_ = handler(&Context{ResponseWriter: httptest.NewRecorder(), Request: httptest.NewRequest(http.MethodGet, "/", nil)})
	if err := resource.Close(); err != nil {
		t.Fatalf("logger.Close() error = %v", err)
	}
	payload, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("ReadFile() error = %v", err)
	}
	if bytes.Contains(payload, []byte(sensitiveDetail)) || !bytes.Contains(payload, []byte("panic_type")) {
		t.Fatalf("panic log is not safely classified: %s", payload)
	}
}

func TestAccessLogClassifiesRequestOutcome(t *testing.T) {
	tests := []struct {
		name        string
		err         error
		wantLevel   string
		wantMessage string
	}{
		{name: "success", wantLevel: "info", wantMessage: "http request completed"},
		{name: "client rejection", err: &StatusError{StatusCode: http.StatusBadRequest, Code: "invalid_request"}, wantLevel: "warn", wantMessage: "http request rejected"},
		{name: "rate limit", err: &StatusError{StatusCode: http.StatusTooManyRequests, Code: "rate_limited"}, wantLevel: "warn", wantMessage: "http request rejected"},
		{name: "overload", err: &StatusError{StatusCode: http.StatusServiceUnavailable, Code: "server_overloaded"}, wantLevel: "warn", wantMessage: "http request rejected"},
		{name: "server failure", err: &StatusError{StatusCode: http.StatusInternalServerError, Code: "internal_error"}, wantLevel: "error", wantMessage: "http request failed"},
		{name: "unknown failure", err: errors.New("unknown"), wantLevel: "error", wantMessage: "http request failed"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			log := logger.NewTestLogger()
			request := httptest.NewRequest(http.MethodGet, "/private?detail=UNSAFE_QUERY_DETAIL_SENTINEL", nil)
			request = request.WithContext(WithOperationID(request.Context(), "testOperation"))
			request = request.WithContext(context.WithValue(request.Context(), requestIDContextKey{}, "request-123"))
			request = request.WithContext(WithTraceID(request.Context(), "trace-123"))
			err := AccessLog(log)(func(*Context) error { return test.err })(
				&Context{ResponseWriter: httptest.NewRecorder(), Request: request},
			)
			if !errors.Is(err, test.err) {
				t.Fatalf("AccessLog() error = %v, want %v", err, test.err)
			}
			entries := log.Entries()
			if len(entries) != 1 || entries[0].Level != test.wantLevel || entries[0].Message != test.wantMessage {
				t.Fatalf("entries = %#v", entries)
			}
		})
	}
}

func TestAccessLogUsesCommittedProblemOutcome(t *testing.T) {
	log := logger.NewTestLogger()
	router := NewRouter(nil)
	router.Use(AccessLog(log))
	router.Handle(MethodGet, "/failure", func(*Context) error {
		return &StatusError{StatusCode: http.StatusInternalServerError, Code: "internal_failure"}
	})

	router.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/missing", nil))
	router.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/failure", nil))
	entries := log.Entries()
	if len(entries) != 2 || entries[0].Level != "warn" || entries[0].Message != "http request rejected" ||
		entries[1].Level != "error" || entries[1].Message != "http request failed" {
		t.Fatalf("entries = %#v", entries)
	}
}
