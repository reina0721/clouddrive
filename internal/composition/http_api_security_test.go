package composition

import (
	"context"
	"errors"
	"net/http"
	"testing"

	authmodel "github.com/reina0721/clouddrive/internal/module/auth/model"
	"github.com/reina0721/clouddrive/internal/transport/http"
	"github.com/reina0721/clouddrive/internal/transport/http/humabinding"
)

// stubOperationAuthorizer 是可编程 operation authorizer。
type stubOperationAuthorizer struct {
	err error
}

func (stub stubOperationAuthorizer) EnforceOperation(context.Context, authmodel.Principal, string) error {
	return stub.err
}

// stubRequestAuthenticator 是可编程 transport 认证来源。
type stubRequestAuthenticator struct {
	err   error
	calls int
}

func (stub *stubRequestAuthenticator) AuthenticateRequest(request *http.Request) (*http.Request, error) {
	stub.calls++
	return request, stub.err
}

var errInternalGateFailure = errors.New("database refresh failed")

// TestOperationGateMapsAuthorizationErrors 验证 401/403 与内部错误映射，
// 与 transport writeGateError 的 HTTP 状态码契约一致。
func TestOperationGateMapsAuthorizationErrors(t *testing.T) {
	cases := []struct {
		name string
		auth error
		want error
	}{
		{name: "unauthenticated maps to 401", auth: authmodel.ErrUnauthenticated, want: httptransport.ErrUnauthenticated},
		{name: "permission denied maps to 403", auth: authmodel.ErrPermissionDenied, want: httptransport.ErrPermissionDenied},
		{name: "internal error preserved", auth: errInternalGateFailure, want: errInternalGateFailure},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			gate, err := newOperationGate(stubOperationAuthorizer{err: tc.auth}, &stubRequestAuthenticator{}, &stubRequestAuthenticator{})
			if err != nil {
				t.Fatal(err)
			}
			err = gate.Enforce(t.Context(), "any.operation")
			if !errors.Is(err, tc.want) {
				t.Fatalf("Enforce() error = %v, want %v", err, tc.want)
			}
		})
	}
}

// TestOperationGateRoutesSecuritySchemes 验证未知/缺失 security scheme
// 一律 fail closed，不落到默认认证来源。
func TestOperationGateRoutesSecuritySchemes(t *testing.T) {
	source := &stubRequestAuthenticator{err: authmodel.ErrUnauthenticated}
	gate, err := newOperationGate(stubOperationAuthorizer{}, source, source)
	if err != nil {
		t.Fatal(err)
	}
	request, err := http.NewRequest(http.MethodGet, "http://example.test/api/v1/ping", nil)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := gate.Authenticate(request, "unknown.security"); !errors.Is(err, httptransport.ErrUnauthenticated) {
		t.Fatalf("unknown scheme error = %v", err)
	}
	authenticated, err := gate.Authenticate(request, humabinding.SecurityNone)
	if err != nil || authenticated == nil {
		t.Fatalf("public scheme = %v, %v", authenticated, err)
	}
	if source.calls != 0 {
		t.Fatal("public scheme must not consult an authenticator")
	}
	source.err = nil
	authenticated, err = gate.Authenticate(request, humabinding.SecurityBearer)
	if err != nil || source.calls != 1 || authenticated == nil {
		t.Fatalf("bearer scheme error = %v, calls = %d", err, source.calls)
	}
}
