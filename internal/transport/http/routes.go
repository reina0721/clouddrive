// Package httptransport 把应用 Huma registrations 绑定为唯一业务路由树。
package httptransport

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"reflect"

	"github.com/go-chi/chi/v5"
	"github.com/reina0721/clouddrive/internal/transport/http/humabinding"
	"github.com/reina0721/clouddrive/pkg/httpx"
)

const acceptLanguageHeader = "Accept-Language"

var (
	ErrUnauthenticated  = errors.New("HTTP request is unauthenticated")
	ErrPermissionDenied = errors.New("HTTP operation is not authorized")
)

// IsolatedRoutes starts a new route match for an internal protocol projection.
// It preserves authentication, cancellation and tracing, but drops the outer
// chi routing cursor, whose RoutePath still names the console endpoint.
func IsolatedRoutes(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), chi.RouteCtxKey, chi.NewRouteContext())))
	})
}

// OperationGate 是应用 route binding 使用的认证与 operation 授权窄端口。
type OperationGate interface {
	Authenticate(*http.Request, string) (*http.Request, error)
	Enforce(context.Context, string) error
}

// NewRouteBinding 从完整 registrations 建立单轨 Huma 路由。
func NewRouteBinding(gate OperationGate, registrations ...humabinding.Registration) (http.Handler, error) {
	if nilInterface(gate) {
		return nil, fmt.Errorf("HTTP operation gate is nil")
	}
	if len(registrations) == 0 {
		return nil, fmt.Errorf("no Huma registrations provided")
	}
	router := chi.NewRouter()
	router.NotFound(func(w http.ResponseWriter, r *http.Request) {
		httpx.WriteProblem(w, r, &httpx.StatusError{StatusCode: http.StatusNotFound, Code: "route_not_found", Message: "route not found"})
	})
	router.MethodNotAllowed(func(w http.ResponseWriter, r *http.Request) {
		httpx.WriteProblem(w, r, &httpx.StatusError{StatusCode: http.StatusMethodNotAllowed, Code: "method_not_allowed", Message: "method not allowed"})
	})
	router.Use(requireSingleJSONDocument, httpx.AcceptJSONHandler())
	api := newHumaAPI(router, gate)
	for index, registration := range registrations {
		if registration == nil {
			return nil, fmt.Errorf("Huma registration %d is nil", index)
		}
		registration(api)
	}
	return router, nil
}

func writeGateError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, ErrUnauthenticated):
		httpx.WriteProblem(w, r, &httpx.StatusError{StatusCode: http.StatusUnauthorized, Code: "unauthenticated", Message: "valid operation authentication is required", Err: err})
	case errors.Is(err, ErrPermissionDenied):
		httpx.WriteProblem(w, r, &httpx.StatusError{StatusCode: http.StatusForbidden, Code: "permission_denied", Message: "the authenticated principal is not authorized", Err: err})
	default:
		httpx.WriteProblem(w, r, err)
	}
}

// requireSingleJSONDocument 拒绝首个 JSON 值后的尾随内容。
func requireSingleJSONDocument(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Body == nil || r.Body == http.NoBody {
			next.ServeHTTP(w, r)
			return
		}
		mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
		if err != nil || mediaType != "application/json" {
			next.ServeHTTP(w, r)
			return
		}
		payload, err := io.ReadAll(r.Body)
		if err != nil {
			httpx.WriteProblem(w, r, &httpx.StatusError{StatusCode: http.StatusBadRequest, Code: "invalid_json", Message: "invalid JSON request body", Err: err})
			return
		}
		r.Body = io.NopCloser(bytes.NewReader(payload))
		decoder := json.NewDecoder(bytes.NewReader(payload))
		var value any
		if err := decoder.Decode(&value); err == nil {
			var trailing any
			if trailingErr := decoder.Decode(&trailing); !errors.Is(trailingErr, io.EOF) {
				httpx.WriteProblem(w, r, &httpx.StatusError{StatusCode: http.StatusBadRequest, Code: "invalid_request", Message: "request must contain one JSON document", Err: trailingErr})
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

func nilInterface(value any) bool {
	if value == nil {
		return true
	}
	reflected := reflect.ValueOf(value)
	switch reflected.Kind() {
	case reflect.Chan, reflect.Func, reflect.Interface, reflect.Map, reflect.Pointer, reflect.Slice:
		return reflected.IsNil()
	default:
		return false
	}
}
