package composition

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"reflect"

	"github.com/reina0721/clouddrive/internal/module/auth"
	authmodel "github.com/reina0721/clouddrive/internal/module/auth/model"
	httptransport "github.com/reina0721/clouddrive/internal/transport/http"
	"github.com/reina0721/clouddrive/internal/transport/http/humabinding"
)

type operationAuthorizer interface {
	EnforceOperation(context.Context, authmodel.Principal, string) error
}
type operationGateAdapter struct {
	auth    operationAuthorizer
	sources map[string]auth.RequestAuthenticator
}

func newOperationGate(authorizer operationAuthorizer, bearerSource, sessionSource auth.RequestAuthenticator) (httptransport.OperationGate, error) {
	if nilDependency(authorizer) || nilDependency(bearerSource) || nilDependency(sessionSource) {
		return nil, fmt.Errorf("auth sources for HTTP operation gate are incomplete")
	}
	return operationGateAdapter{auth: authorizer, sources: map[string]auth.RequestAuthenticator{humabinding.SecurityBearer: bearerSource, humabinding.SecurityWebUISession: sessionSource}}, nil
}
func (adapter operationGateAdapter) Authenticate(request *http.Request, security string) (*http.Request, error) {
	if request == nil {
		return nil, httptransport.ErrUnauthenticated
	}
	if security == humabinding.SecurityNone {
		return request, nil
	}
	source, exists := adapter.sources[security]
	if !exists || nilDependency(source) {
		return nil, httptransport.ErrUnauthenticated
	}
	authenticated, err := source.AuthenticateRequest(request)
	if err != nil {
		return nil, httptransport.ErrUnauthenticated
	}
	return authenticated, nil
}
func (adapter operationGateAdapter) Enforce(ctx context.Context, operation string) error {
	principal, _ := authmodel.PrincipalFromContext(ctx)
	if err := adapter.auth.EnforceOperation(ctx, principal, operation); err != nil {
		switch {
		case errors.Is(err, authmodel.ErrUnauthenticated):
			return httptransport.ErrUnauthenticated
		case errors.Is(err, authmodel.ErrPermissionDenied):
			return httptransport.ErrPermissionDenied
		default:
			return err
		}
	}
	return nil
}
func nilDependency(value any) bool {
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
func withOptionalAuthentication(source auth.RequestAuthenticator, next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		authenticated, err := source.AuthenticateRequest(request)
		if err != nil {
			next.ServeHTTP(writer, request)
			return
		}
		next.ServeHTTP(writer, authenticated)
	})
}

var _ httptransport.OperationGate = operationGateAdapter{}
