package model

import (
	"testing"
	"time"
)

func TestPrincipalAuthorizationSourceInvariants(t *testing.T) {
	now := time.Date(2026, 8, 22, 1, 0, 0, 0, time.UTC)
	principal, err := NewPrincipal("actor", ActorService, []Scope{"todos:read"}, now, now)
	if err != nil {
		t.Fatalf("NewPrincipal() error = %v", err)
	}
	if principal.AuthorizationSource != AuthorizationTokenScopes || principal.AuthorizationRevision != 0 || principal.Restricted {
		t.Fatalf("token scopes principal = %#v", principal)
	}
	rbac, err := NewIAMRBACPrincipal("account:1", ActorService, 5, true, now, now)
	if err != nil {
		t.Fatalf("NewIAMRBACPrincipal() error = %v", err)
	}
	if rbac.AuthorizationSource != AuthorizationIAMRBAC || rbac.AuthorizationRevision != 5 || !rbac.Restricted || len(rbac.Scopes) != 0 {
		t.Fatalf("iam rbac principal = %#v", rbac)
	}
	if _, err := NewIAMRBACPrincipal("account:1", ActorService, 0, false, now, now); err == nil {
		t.Fatal("iam rbac principal with zero revision succeeded")
	}
	if principal.HasScope("todos:read") != true || principal.HasScope("other:read") {
		t.Fatalf("token scopes HasScope result is wrong")
	}
	if rbac.HasScope("anything") {
		t.Fatal("iam rbac principal must never carry scopes")
	}
}
