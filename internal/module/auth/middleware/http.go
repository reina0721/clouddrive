// Package middleware 实现 Auth module 拥有的 HTTP bearer 认证边界。
package middleware

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/reina0721/clouddrive/internal/module/auth/model"
	"github.com/reina0721/clouddrive/internal/module/auth/service"
	"github.com/reina0721/clouddrive/pkg/httpx"
)

// Source 是 Bearer/development 认证的项目自有请求来源。
type Source struct{ authenticator service.Authenticator }

// NewSource 构造不读取请求的认证来源。
func NewSource(authenticator service.Authenticator) (*Source, error) {
	if authenticator == nil {
		return nil, model.ErrUnauthenticated
	}
	return &Source{authenticator: authenticator}, nil
}

// AuthenticateRequest 认证一次请求并返回注入 Principal 的副本。
func (source *Source) AuthenticateRequest(request *http.Request) (*http.Request, error) {
	if source == nil || source.authenticator == nil || request == nil {
		return nil, model.ErrUnauthenticated
	}
	principal, err := authenticateRequest(request, source.authenticator)
	if err != nil {
		if recordErr := source.authenticator.RecordAuthenticationFailure(request.Context()); recordErr != nil {
			return nil, fmt.Errorf("record authentication failure: %w", recordErr)
		}
		return nil, err
	}
	ctx := model.WithPrincipal(request.Context(), principal)
	if requestID, ok := httpx.RequestIDFromContext(request.Context()); ok {
		ctx = model.WithCorrelationID(ctx, requestID)
	}
	return request.WithContext(ctx), nil
}

// Middleware 把相同认证来源适配到仍由 Auth 模块拥有的 middleware 边界。
func (source *Source) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		authenticated, err := source.AuthenticateRequest(request)
		if err != nil {
			writer.Header().Set("WWW-Authenticate", `Bearer realm="api"`)
			httpx.WriteProblem(writer, request, &httpx.StatusError{
				StatusCode: http.StatusUnauthorized, Code: "unauthenticated", Message: "valid bearer authentication is required", Err: model.ErrUnauthenticated,
			})
			return
		}
		next.ServeHTTP(writer, authenticated)
	})
}

// HTTP 构造只负责认证与 Principal 注入的 middleware；operation/object 授权留给后续边界。
func HTTP(authenticator service.Authenticator) (func(http.Handler) http.Handler, error) {
	source, err := NewSource(authenticator)
	if err != nil {
		return nil, err
	}
	return source.Middleware, nil
}

func authenticateRequest(request *http.Request, authenticator service.Authenticator) (model.Principal, error) {
	values := request.Header.Values("Authorization")
	if len(values) == 0 {
		return authenticator.DevelopmentPrincipal(request.Context())
	}
	if len(values) != 1 {
		return model.Principal{}, model.ErrUnauthenticated
	}
	scheme, value, ok := strings.Cut(values[0], " ")
	if !ok || scheme != "Bearer" || value == "" || strings.ContainsAny(value, " \t\r\n") {
		return model.Principal{}, model.ErrUnauthenticated
	}
	return authenticator.Authenticate(request.Context(), model.Credential{Scheme: scheme, Value: value})
}
