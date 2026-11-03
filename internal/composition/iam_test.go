package composition

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/reina0721/clouddrive/internal/module/iam/service"
)

func TestIAMMutationGuardRequiresAllowedOriginResolvedSessionAndCSRF(t *testing.T) {
	guard, err := newIAMMutationGuard(csrfValidatorStub{}, []string{"https://127.0.0.1:5173"})
	if err != nil {
		t.Fatal(err)
	}
	request, err := http.NewRequest(http.MethodPut, "http://api.example.test/api/v1/navigation/menus/menu", http.NoBody)
	if err != nil {
		t.Fatal(err)
	}
	if err := guard.ValidateMutation(request); err == nil {
		t.Fatal("missing Origin was accepted")
	}
	request.Header.Set("Origin", "https://evil.example.test")
	if err := guard.ValidateMutation(request); err == nil {
		t.Fatal("unlisted Origin was accepted")
	}
	request.Header.Set("Origin", "https://127.0.0.1:5173")
	request.Header.Set("X-CSRF-Token", "csrf-valid")
	if err := guard.ValidateMutation(request); err == nil {
		t.Fatal("request without resolved IAM Session was accepted")
	}
	request = service.WithResolvedSession(request, "session-valid", service.Session{})
	if err := guard.ValidateMutation(request); err != nil {
		t.Fatalf("valid mutation rejected: %v", err)
	}
	request.Header.Set("X-CSRF-Token", "csrf-invalid")
	if err := guard.ValidateMutation(request); err == nil {
		t.Fatal("invalid CSRF token was accepted")
	}
}

type csrfValidatorStub struct{}

func (csrfValidatorStub) ValidateCSRF(_ context.Context, sessionID, token string) error {
	if sessionID == "session-valid" && token == "csrf-valid" {
		return nil
	}
	return errors.New("csrf invalid")
}
