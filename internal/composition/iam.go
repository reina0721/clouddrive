package composition

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/reina0721/clouddrive/internal/module/auth"
	authmodel "github.com/reina0721/clouddrive/internal/module/auth/model"
	"github.com/reina0721/clouddrive/internal/module/iam"
	"github.com/reina0721/clouddrive/internal/module/iam/repo"
	"github.com/reina0721/clouddrive/internal/module/iam/service"
	"github.com/reina0721/clouddrive/pkg/httpx"
)

// iamSessionAuthAdapter 是 IAM Session identity 到 Auth iam-rbac Principal
// 的唯一装配适配器。
type iamSessionAuthAdapter struct {
	sessions iam.SessionResolver
}

func newIAMSessionAuthAdapter(sessions iam.SessionResolver) (auth.RequestAuthenticator, error) {
	if sessions == nil {
		return nil, fmt.Errorf("iam session resolver is nil")
	}
	return iamSessionAuthAdapter{sessions: sessions}, nil
}
func (a iamSessionAuthAdapter) AuthenticateRequest(request *http.Request) (*http.Request, error) {
	cookie, err := request.Cookie(service.SessionCookieName)
	if err != nil || cookie.Value == "" {
		return nil, service.ErrSessionInvalid
	}
	session, err := a.sessions.Resolve(request.Context(), cookie.Value)
	if err != nil {
		return nil, err
	}
	principal, err := authmodel.NewIAMRBACPrincipal(
		session.Identity.AccountID, authmodel.ActorService,
		session.AuthorizationRevision, session.Identity.MustChangePassword,
		session.Identity.AuthenticatedAt, session.Identity.AuthenticatedAt,
	)
	if err != nil {
		return nil, err
	}
	resolved := service.WithResolvedSession(request, cookie.Value, session)
	ctx := authmodel.WithPrincipal(resolved.Context(), principal)
	if requestID, ok := httpx.RequestIDFromContext(resolved.Context()); ok {
		ctx = authmodel.WithCorrelationID(ctx, requestID)
	}
	return resolved.WithContext(ctx), nil
}

func adaptIAMDatabaseAccess(access repo.Access) (repo.Access, error) {
	if access == nil {
		return nil, fmt.Errorf("iam database access is nil")
	}
	return access, nil
}

var _ auth.RequestAuthenticator = iamSessionAuthAdapter{}

// iamMutationGuardAdapter 在 composition 把 IAM Session 协议校验提供给普通业务 HTTP binding。
type iamMutationGuardAdapter struct {
	mutation       iam.MutationGuard
	allowedOrigins map[string]struct{}
}

func newIAMMutationGuard(guard iam.MutationGuard, allowedOrigins []string) (iamMutationGuardAdapter, error) {
	if nilDependency(guard) {
		return iamMutationGuardAdapter{}, fmt.Errorf("iam mutation guard is nil")
	}
	allowed := make(map[string]struct{}, len(allowedOrigins))
	for _, origin := range allowedOrigins {
		origin = strings.TrimSpace(origin)
		if origin != "" {
			allowed[origin] = struct{}{}
		}
	}
	return iamMutationGuardAdapter{mutation: guard, allowedOrigins: allowed}, nil
}
func (adapter iamMutationGuardAdapter) ValidateMutation(request *http.Request) error {
	if request == nil {
		return &httpx.StatusError{StatusCode: http.StatusForbidden, Code: "csrf_invalid", Message: "mutation request is invalid"}
	}
	origin := strings.TrimSpace(request.Header.Get("Origin"))
	if origin == "" {
		return &httpx.StatusError{StatusCode: http.StatusForbidden, Code: "csrf_invalid", Message: "origin is required"}
	}
	if !httpx.SameOrigin(request, origin) {
		if _, ok := adapter.allowedOrigins[origin]; !ok {
			return &httpx.StatusError{StatusCode: http.StatusForbidden, Code: "csrf_invalid", Message: "origin is not allowed"}
		}
	}
	id, _, ok := service.SessionFromContext(request.Context())
	if !ok || adapter.mutation.ValidateCSRF(request.Context(), id, request.Header.Get("X-CSRF-Token")) != nil {
		return &httpx.StatusError{StatusCode: http.StatusForbidden, Code: "csrf_invalid", Message: "CSRF token is invalid"}
	}
	return nil
}

var _ navigationMutationGuard = iamMutationGuardAdapter{}
