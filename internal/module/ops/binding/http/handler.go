// Package httpbinding 实现 Ops module 的独立 management HTTP binding。
package httpbinding

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	configbinding "github.com/reina0721/clouddrive/internal/module/ops/binding/config"
	"github.com/reina0721/clouddrive/internal/module/ops/model"
	"github.com/reina0721/clouddrive/internal/module/ops/service"
	"github.com/reina0721/clouddrive/pkg/httpx"
	"github.com/reina0721/clouddrive/pkg/logger"
	pkgobservability "github.com/reina0721/clouddrive/pkg/observability"
)

// Access 是 composition 连接 Auth module 时实现的 management scope 端口。
type Access interface {
	Authenticate(http.Handler) http.Handler
	Authorize(context.Context, string) error
}

// ManagementRoutePaths 返回 management 面支持的相对子路径（不含 /management 前缀）。
// 模块内部注册与 composition 的模式 B facade 挂载共用同一清单，避免路径字面量漂移。
func ManagementRoutePaths() []string {
	return []string{"/startupz", "/livez", "/readyz", "/build", "/diagnostics", "/metrics", "/metrics-summary"}
}

// New 构造不包含 pprof 的固定 management 路由。
func New(ops *service.Service, metrics pkgobservability.Metrics, access Access, mode configbinding.AccessMode, logging logger.Logger) (http.Handler, error) {
	if ops == nil || metrics == nil || access == nil || logging == nil {
		return nil, fmt.Errorf("management HTTP dependencies are incomplete")
	}
	mux := http.NewServeMux()
	for _, routePath := range ManagementRoutePaths() {
		switch routePath {
		case "/startupz":
			mux.Handle("GET "+routePath, probe(ops, model.ProbeStartup, logging))
		case "/livez":
			mux.Handle("GET "+routePath, probe(ops, model.ProbeLiveness, logging))
		case "/readyz":
			mux.Handle("GET "+routePath, probe(ops, model.ProbeReady, logging))
		case "/build":
			mux.Handle("GET "+routePath, jsonHandler(model.OperationBuild, logging, func(context.Context) (any, error) { return ops.Build(), nil }))
		case "/diagnostics":
			mux.Handle("GET "+routePath, protect(access, model.OperationDiagnostics, jsonHandler(model.OperationDiagnostics, logging, func(ctx context.Context) (any, error) { return ops.Diagnostics(ctx) }), logging))
		case "/metrics":
			switch mode {
			case configbinding.AccessDisabled:
			case configbinding.AccessPublic:
				mux.Handle("GET "+routePath, metrics.Handler())
			case configbinding.AccessProtected:
				mux.Handle("GET "+routePath, protect(access, model.OperationMetrics, metrics.Handler(), logging))
			default:
				return nil, fmt.Errorf("management metrics access %q is unsupported", mode)
			}
		case "/metrics-summary":
			// 090 PAGE-090-006 / design §8：typed 指标投影，供产品 UI 消费，
			// 不让前端解析 Prometheus 文本推断语义。受保护等级与 /metrics 一致。
			summary := jsonHandler("ops.metrics-summary", logging, func(ctx context.Context) (any, error) { return metrics.Summary(ctx) })
			switch mode {
			case configbinding.AccessDisabled:
			case configbinding.AccessPublic:
				mux.Handle("GET "+routePath, summary)
			case configbinding.AccessProtected:
				mux.Handle("GET "+routePath, protect(access, model.OperationMetrics, summary, logging))
			default:
				return nil, fmt.Errorf("management metrics summary access %q is unsupported", mode)
			}
		}
	}
	return noStore(mux), nil
}

func probe(ops *service.Service, kind model.ProbeKind, logging logger.Logger) http.Handler {
	return jsonHandler(string(kind), logging, func(ctx context.Context) (any, error) {
		result, passing, err := ops.Probe(ctx, kind)
		if err != nil {
			logManagementError(logging, "probe", string(kind), http.StatusServiceUnavailable, err)
			return statusValue{status: http.StatusServiceUnavailable, value: model.Probe{Status: "fail"}}, nil
		}
		status := http.StatusOK
		if !passing {
			status = http.StatusServiceUnavailable
			logManagementWarning(logging, "probe", string(kind), status, "management probe failed")
		}
		return statusValue{status: status, value: result}, nil
	})
}

type statusValue struct {
	status int
	value  any
}

func jsonHandler(operationName string, logging logger.Logger, operation func(context.Context) (any, error)) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		value, err := operation(request.Context())
		if err != nil {
			logManagementError(logging, "operation", operationName, http.StatusInternalServerError, err)
			http.Error(writer, "management operation failed", http.StatusInternalServerError)
			return
		}
		status := http.StatusOK
		if response, ok := value.(statusValue); ok {
			status, value = response.status, response.value
		}
		writer.Header().Set("Content-Type", "application/json")
		writer.WriteHeader(status)
		_ = json.NewEncoder(writer).Encode(value)
	})
}

func protect(access Access, operation string, next http.Handler, logging logger.Logger) http.Handler {
	authorized := http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if err := access.Authorize(request.Context(), operation); err != nil {
			logManagementWarning(logging, "authorize", operation, http.StatusForbidden, "management operation rejected")
			httpx.WriteProblem(writer, request, &httpx.StatusError{StatusCode: http.StatusForbidden, Code: "forbidden", Message: "management scope is required", Err: err})
			return
		}
		next.ServeHTTP(writer, request)
	})
	return access.Authenticate(authorized)
}

func logManagementWarning(logging logger.Logger, phase string, operation string, status int, message string) {
	if logging == nil {
		return
	}
	logging.Warn(message,
		logger.String("owner", "management"),
		logger.String("phase", phase),
		logger.String("operation", operation),
		logger.Int("status", status),
		logger.String("status_class", statusClass(status)),
	)
}

func logManagementError(logging logger.Logger, phase string, operation string, status int, err error) {
	if logging == nil || err == nil {
		return
	}
	logging.Error("management operation failed",
		logger.String("owner", "management"),
		logger.String("phase", phase),
		logger.String("operation", operation),
		logger.Int("status", status),
		logger.String("status_class", statusClass(status)),
		logger.String("error_type", managementErrorType(err)),
		logger.String("cause_type", fmt.Sprintf("%T", err)),
	)
}

func managementErrorType(err error) string {
	if err == nil {
		return ""
	}
	return fmt.Sprintf("%T", err)
}

func statusClass(status int) string {
	switch {
	case status >= 500:
		return "5xx"
	case status >= 400:
		return "4xx"
	case status >= 300:
		return "3xx"
	case status >= 200:
		return "2xx"
	default:
		return "1xx"
	}
}

func noStore(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Cache-Control", "no-store")
		writer.Header().Set("X-Content-Type-Options", "nosniff")
		next.ServeHTTP(writer, request)
	})
}
