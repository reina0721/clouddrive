package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/reina0721/clouddrive/internal/module/auth/model"
	"github.com/reina0721/clouddrive/pkg/httpx"
)

func TestHTTPAuthenticatesBearerAndInjectsPrincipal(t *testing.T) {
	principal := testPrincipal(t)
	authenticator := &testAuthenticator{principal: principal}
	middleware, err := HTTP(authenticator)
	if err != nil {
		t.Fatalf("HTTP() error = %v", err)
	}
	handler := middleware(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		actual, ok := model.PrincipalFromContext(request.Context())
		if !ok || actual.Subject != principal.Subject {
			t.Fatalf("PrincipalFromContext() = %#v, %t", actual, ok)
		}
		writer.WriteHeader(http.StatusNoContent)
	}))
	request := httptest.NewRequest(http.MethodGet, "/todos", nil)
	request.Header.Set("Authorization", "Bearer opaque-token")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusNoContent || authenticator.credential.Value != "opaque-token" {
		t.Fatalf("response = %d, credential = %#v", response.Code, authenticator.credential)
	}
}

func TestSourceCarriesRequestIDAsCorrelationID(t *testing.T) {
	source, err := NewSource(&testAuthenticator{principal: testPrincipal(t)})
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodGet, "/todos", nil)
	request.Header.Set("Authorization", "Bearer opaque-token")
	transportContext := &httpx.Context{Request: request, ResponseWriter: httptest.NewRecorder()}
	var requestWithID *http.Request
	if err := httpx.RequestID(fixedRequestIDGenerator{value: "request-123"})(func(ctx *httpx.Context) error {
		requestWithID = ctx.Request
		return nil
	})(transportContext); err != nil {
		t.Fatal(err)
	}
	authenticated, err := source.AuthenticateRequest(requestWithID)
	if err != nil {
		t.Fatal(err)
	}
	if correlationID, ok := model.CorrelationIDFromContext(authenticated.Context()); !ok || correlationID != "request-123" {
		t.Fatalf("correlation id = %q, ok = %t", correlationID, ok)
	}
}

func TestHTTPRejectsMalformedCredentialWithoutLeakingIt(t *testing.T) {
	authenticator := &testAuthenticator{principal: testPrincipal(t)}
	middleware, err := HTTP(authenticator)
	if err != nil {
		t.Fatalf("HTTP() error = %v", err)
	}
	handler := middleware(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		t.Fatal("protected handler was called")
	}))
	request := httptest.NewRequest(http.MethodGet, "/todos", nil)
	request.Header["Authorization"] = []string{"Bearer secret-one", "Bearer secret-two"}
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusUnauthorized || authenticator.failures != 1 {
		t.Fatalf("response = %d, failures = %d", response.Code, authenticator.failures)
	}
	if body := response.Body.String(); body == "" || containsAny(body, "secret-one", "secret-two") {
		t.Fatalf("problem body leaked credential: %q", body)
	}
}

type testAuthenticator struct {
	principal  model.Principal
	credential model.Credential
	failures   int
}

type fixedRequestIDGenerator struct{ value string }

func (g fixedRequestIDGenerator) New() (string, error) { return g.value, nil }

func (a *testAuthenticator) Authenticate(_ context.Context, credential model.Credential) (model.Principal, error) {
	a.credential = credential
	return a.principal, nil
}

func (a *testAuthenticator) DevelopmentPrincipal(context.Context) (model.Principal, error) {
	return model.Principal{}, model.ErrUnauthenticated
}

func (a *testAuthenticator) RecordAuthenticationFailure(context.Context) error {
	a.failures++
	return nil
}

func testPrincipal(t *testing.T) model.Principal {
	t.Helper()
	now := time.Date(2026, 8, 15, 8, 0, 0, 0, time.UTC)
	principal, err := model.NewPrincipal("actor", model.ActorService, []model.Scope{"todos:read"}, now, now)
	if err != nil {
		t.Fatalf("NewPrincipal() error = %v", err)
	}
	return principal
}

func containsAny(value string, candidates ...string) bool {
	for _, candidate := range candidates {
		if len(candidate) > 0 && len(value) >= len(candidate) {
			for index := 0; index+len(candidate) <= len(value); index++ {
				if value[index:index+len(candidate)] == candidate {
					return true
				}
			}
		}
	}
	return false
}
