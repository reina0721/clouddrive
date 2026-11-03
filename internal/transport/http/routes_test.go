package httptransport

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/danielgtaylor/huma/v2"
	"github.com/reina0721/clouddrive/internal/transport/http/humabinding"
)

type operationGateStub struct {
	authenticateErr error
	enforceErr      error
	operation       string
	security        string
}

func (gate *operationGateStub) Authenticate(request *http.Request, security string) (*http.Request, error) {
	gate.security = security
	return request, gate.authenticateErr
}
func (gate *operationGateStub) Enforce(_ context.Context, operation string) error {
	gate.operation = operation
	return gate.enforceErr
}

func testRegistration(api huma.API) {
	op := humabinding.JSONDefinition(huma.Operation{OperationID: "test.create", Method: http.MethodPost, Path: "/test"}, humabinding.Definition{ID: "test.create", Method: http.MethodPost, Path: "/test", Security: humabinding.SecurityBearer, Policy: humabinding.PolicyProtected, Scope: "test:write", Action: "create"})
	type input struct {
		Body struct {
			Name string `json:"name" minLength:"1"`
		}
	}
	type output struct {
		Body struct {
			Name string `json:"name"`
		}
	}
	huma.Register(api, op, func(_ context.Context, in *input) (*output, error) {
		return &output{Body: struct {
			Name string `json:"name"`
		}{Name: in.Body.Name}}, nil
	})
}

func TestHumaRouteUsesProjectGateAndValidation(t *testing.T) {
	gate := &operationGateStub{}
	routes, err := NewRouteBinding(gate, testRegistration)
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodPost, "/test", nil)
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	routes.ServeHTTP(response, request)
	if response.Code != http.StatusBadRequest || response.Header().Get("Content-Type") != "application/problem+json" {
		t.Fatalf("validation response = %d %s", response.Code, response.Body.String())
	}
	request = httptest.NewRequest(http.MethodPost, "/test", nil)
	request.Header.Set("Content-Type", "application/json")
	gate.authenticateErr = ErrUnauthenticated
	response = httptest.NewRecorder()
	routes.ServeHTTP(response, request)
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("gate response = %d", response.Code)
	}
}

func TestCatalogUsesRegistrationMetadata(t *testing.T) {
	definitions, err := BuildHumaOperationCatalog(testRegistration)
	if err != nil {
		t.Fatal(err)
	}
	if len(definitions) != 1 || definitions[0].ID != "test.create" || definitions[0].Scope != "test:write" {
		t.Fatalf("definitions = %#v", definitions)
	}
	_, err = NewRouteBinding(&operationGateStub{enforceErr: errors.New("denied")}, nil)
	if err == nil {
		t.Fatal("expected nil registration error")
	}
}

var _ OperationGate = (*operationGateStub)(nil)
