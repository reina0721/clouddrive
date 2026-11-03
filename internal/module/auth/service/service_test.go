package service

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/reina0721/clouddrive/internal/module/auth/model"
	pkgalerting "github.com/reina0721/clouddrive/pkg/alerting"
	"github.com/reina0721/clouddrive/pkg/clock"
)

// testAlertReporter 记录告警事件（079 触发测试用）。
type testAlertReporter struct {
	mu     sync.Mutex
	events []pkgalerting.Event
}

func (r *testAlertReporter) Notify(_ context.Context, event pkgalerting.Event) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.events = append(r.events, event)
	return nil
}

func TestServiceFailsClosedAndEnforcesOperationAndOwner(t *testing.T) {
	now := time.Date(2026, 8, 15, 8, 0, 0, 0, time.UTC)
	principal, err := model.NewPrincipal("actor-a", model.ActorService, []model.Scope{"todos:read"}, now, now)
	if err != nil {
		t.Fatalf("NewPrincipal() error = %v", err)
	}
	verifier := &testVerifier{ready: true, principal: principal}
	audit := &testAudit{}
	service, err := New(clock.Fixed(now), verifier, nil, audit, &stubDecisionPoint{}, []model.Policy{
		{Operation: "getTodo", Mode: model.PolicyProtected, Scope: "todos:read", Action: "todo.read"},
		{Operation: "createTodo", Mode: model.PolicyProtected, Scope: "todos:write", Action: "todo.create"},
		{Operation: "live", Mode: model.PolicyPublic},
	})
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}

	verified, err := service.Authenticate(t.Context(), model.Credential{Scheme: "Bearer", Value: "opaque"})
	if err != nil || verified.Subject != principal.Subject {
		t.Fatalf("Authenticate() = %#v, %v", verified, err)
	}
	verifier.err = context.Canceled
	if _, err := service.Authenticate(t.Context(), model.Credential{Scheme: "Bearer", Value: "opaque"}); !errors.Is(err, context.Canceled) {
		t.Fatalf("Authenticate(canceled verifier) error = %v", err)
	}
	verifier.err = context.DeadlineExceeded
	if _, err := service.Authenticate(t.Context(), model.Credential{Scheme: "Bearer", Value: "opaque"}); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("Authenticate(timed out verifier) error = %v", err)
	}
	verifier.err = errors.New("signature rejected")
	if _, err := service.Authenticate(t.Context(), model.Credential{Scheme: "Bearer", Value: "opaque"}); !errors.Is(err, model.ErrUnauthenticated) {
		t.Fatalf("Authenticate(rejected verifier) error = %v", err)
	}
	verifier.err = nil
	decision, err := service.AuthorizeOperation(t.Context(), verified, "getTodo")
	if err != nil || !decision.Allowed {
		t.Fatalf("AuthorizeOperation(read) = %#v, %v", decision, err)
	}
	decision, err = service.AuthorizeOperation(t.Context(), verified, "createTodo")
	if err != nil || decision.Allowed || decision.Reason != model.ReasonMissingScope {
		t.Fatalf("AuthorizeOperation(write) = %#v, %v", decision, err)
	}
	decision, err = service.AuthorizeAction(t.Context(), verified, "todo.read", model.ResourceFacts{OwnerSubject: "actor-b"})
	if err != nil || decision.Allowed || decision.Reason != model.ReasonOwnerMismatch {
		t.Fatalf("AuthorizeAction(other owner) = %#v, %v", decision, err)
	}
	decision, err = service.AuthorizeOperation(t.Context(), model.Principal{}, "live")
	if err != nil || !decision.Allowed || decision.Reason != model.ReasonPublic {
		t.Fatalf("AuthorizeOperation(public) = %#v, %v", decision, err)
	}
	decision, err = service.AuthorizeOperation(t.Context(), verified, "unknown")
	if err != nil || decision.Allowed || decision.Reason != model.ReasonMissingPolicy {
		t.Fatalf("AuthorizeOperation(unknown) = %#v, %v", decision, err)
	}

	verifier.ready = false
	if _, err := service.Authenticate(t.Context(), model.Credential{Scheme: "Bearer", Value: "opaque"}); !errors.Is(err, model.ErrUnauthenticated) {
		t.Fatalf("Authenticate(not ready) error = %v", err)
	}
}

func TestServiceRejectsIncompleteAndDuplicatePolicies(t *testing.T) {
	now := time.Date(2026, 8, 15, 8, 0, 0, 0, time.UTC)
	principal, err := model.NewPrincipal("development", model.ActorDevelopment, []model.Scope{"todos:read"}, now, now)
	if err != nil {
		t.Fatalf("NewPrincipal() error = %v", err)
	}
	tests := [][]model.Policy{
		nil,
		{{Operation: "read", Mode: model.PolicyProtected, Scope: "todos:read"}},
		{{Operation: "read", Mode: model.PolicyPublic, Scope: "todos:read"}},
		{
			{Operation: "read", Mode: model.PolicyProtected, Scope: "todos:read", Action: "todo.read"},
			{Operation: "read", Mode: model.PolicyProtected, Scope: "todos:read", Action: "todo.read-again"},
		},
	}
	for _, policies := range tests {
		if _, err := New(clock.Fixed(now), nil, &principal, &testAudit{}, &stubDecisionPoint{}, policies); err == nil {
			t.Fatalf("New(%#v) error = nil", policies)
		}
	}
}

type testVerifier struct {
	ready     bool
	principal model.Principal
	err       error
}

func (v *testVerifier) Verify(context.Context, model.Credential) (model.Principal, error) {
	return v.principal, v.err
}

func (v *testVerifier) Ready() bool { return v.ready }

type testAudit struct{ events []model.AuditEvent }

func (a *testAudit) Record(_ context.Context, event model.AuditEvent) error {
	a.events = append(a.events, event)
	return nil
}

// stubDecisionPoint 记录收到的请求并返回可编程结果。
type stubDecisionPoint struct {
	requests []AuthorizationRequest
	result   AuthorizationDecision
	err      error
}

func (d *stubDecisionPoint) Decide(_ context.Context, request AuthorizationRequest) (AuthorizationDecision, error) {
	d.requests = append(d.requests, request)
	return d.result, d.err
}

// TestServiceRoutesIAMRBACThroughDecisionPoint 验证 iam-rbac 来源的
// Principal 不读 Scopes，必须经 DecisionPoint 判断，且请求携带完整
// Subject/Permission/Revision/Restricted。
func TestServiceRoutesIAMRBACThroughDecisionPoint(t *testing.T) {
	now := time.Date(2026, 8, 15, 8, 0, 0, 0, time.UTC)
	principal, err := model.NewIAMRBACPrincipal("account:9", model.ActorService, 7, true, now, now)
	if err != nil {
		t.Fatalf("NewIAMRBACPrincipal() error = %v", err)
	}
	point := &stubDecisionPoint{result: AuthorizationDecision{Allowed: true, Reason: model.ReasonAllowed}}
	service, err := New(clock.Fixed(now), nil, &principal, &testAudit{}, point, []model.Policy{
		{Operation: "run", Mode: model.PolicyProtected, Scope: "iam:role:write", Action: "iam.role.write"},
	})
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	decision, err := service.AuthorizeOperation(t.Context(), principal, "run")
	if err != nil || !decision.Allowed {
		t.Fatalf("AuthorizeOperation() = %#v, %v", decision, err)
	}
	if len(point.requests) != 1 {
		t.Fatalf("decision point requests = %d, want 1", len(point.requests))
	}
	request := point.requests[0]
	if request.Subject != "account:9" || request.Permission != "iam:role:write" || request.Revision != 7 || !request.Restricted {
		t.Fatalf("decision point request = %#v", request)
	}
	// 业务 deny 映射为 rbac_denied，不是 error。
	point.result = AuthorizationDecision{Allowed: false, Reason: model.ReasonRBACDenied}
	decision, err = service.AuthorizeOperation(t.Context(), principal, "run")
	if err != nil || decision.Allowed || decision.Reason != model.ReasonRBACDenied {
		t.Fatalf("AuthorizeOperation(denied) = %#v, %v", decision, err)
	}
	// DecisionPoint 错误保留错误链并 fail closed。
	point.result = AuthorizationDecision{}
	point.err = context.Canceled
	if _, err := service.AuthorizeOperation(t.Context(), principal, "run"); !errors.Is(err, context.Canceled) {
		t.Fatalf("AuthorizeOperation(point error) error = %v", err)
	}
	// iam-rbac allow 后资源 owner mismatch 仍然拒绝。
	point.result = AuthorizationDecision{Allowed: true, Reason: model.ReasonAllowed}
	point.err = nil
	decision, err = service.AuthorizeAction(t.Context(), principal, "iam.role.write", model.ResourceFacts{OwnerSubject: "someone-else"})
	if err != nil || decision.Allowed || decision.Reason != model.ReasonOwnerMismatch {
		t.Fatalf("AuthorizeAction(owner mismatch) = %#v, %v", decision, err)
	}
}

// TestServiceRejectsUnknownAuthorizationSource 验证未知来源 fail closed。
func TestServiceRejectsUnknownAuthorizationSource(t *testing.T) {
	now := time.Date(2026, 8, 15, 8, 0, 0, 0, time.UTC)
	principal := model.Principal{Subject: "actor", Kind: model.ActorService, Scopes: []model.Scope{"todos:read"}, AuthenticatedAt: now, IssuedAt: now}
	service, err := New(clock.Fixed(now), nil, &principal, &testAudit{}, &stubDecisionPoint{}, []model.Policy{
		{Operation: "run", Mode: model.PolicyProtected, Scope: "todos:read", Action: "todo.read"},
	})
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	if _, err := service.AuthorizeOperation(t.Context(), principal, "run"); err == nil {
		t.Fatal("unknown source authorization succeeded")
	}
}

// TestServiceRequiresDecisionPointForHTTPProfile 验证 HTTP profile 缺少
// DecisionPoint 时构造失败（避免 iam-rbac 主体静默放行）。
func TestServiceRequiresDecisionPointForHTTPProfile(t *testing.T) {
	now := time.Date(2026, 8, 15, 8, 0, 0, 0, time.UTC)
	principal, err := model.NewPrincipal("actor", model.ActorService, []model.Scope{"todos:read"}, now, now)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := New(clock.Fixed(now), &testVerifier{ready: true, principal: principal}, nil, &testAudit{}, nil, []model.Policy{
		{Operation: "run", Mode: model.PolicyProtected, Scope: "todos:read", Action: "todo.read"},
	}); err == nil {
		t.Fatal("New() without decision point succeeded")
	}
}

// TestRepeatedAuthFailureAlerts 验证连续认证失败达到阈值触发一次低敏告警（079），
// 未注入 reporter 时零行为。
func TestRepeatedAuthFailureAlerts(t *testing.T) {
	now := time.Date(2026, 8, 15, 8, 0, 0, 0, time.UTC)
	principal, err := model.NewPrincipal("actor-a", model.ActorService, []model.Scope{"todos:read"}, now, now)
	if err != nil {
		t.Fatal(err)
	}
	service, err := New(clock.Fixed(now), &testVerifier{ready: true, principal: principal}, nil, &testAudit{}, &stubDecisionPoint{}, []model.Policy{
		{Operation: "live", Mode: model.PolicyPublic},
	})
	if err != nil {
		t.Fatal(err)
	}
	reporter := &testAlertReporter{}
	service.WithAlertReporter(reporter)
	for index := 0; index < 5; index++ {
		if err := service.RecordAuthenticationFailure(t.Context()); err != nil {
			t.Fatal(err)
		}
	}
	if len(reporter.events) != 1 || reporter.events[0].Type != "auth_failed" {
		t.Fatalf("alert events = %#v", reporter.events)
	}
	// 阈值以下不触发。
	service2, err := New(clock.Fixed(now), &testVerifier{ready: true, principal: principal}, nil, &testAudit{}, &stubDecisionPoint{}, []model.Policy{
		{Operation: "live", Mode: model.PolicyPublic},
	})
	if err != nil {
		t.Fatal(err)
	}
	reporter2 := &testAlertReporter{}
	service2.WithAlertReporter(reporter2)
	for index := 0; index < 4; index++ {
		_ = service2.RecordAuthenticationFailure(t.Context())
	}
	if len(reporter2.events) != 0 {
		t.Fatalf("below-threshold alert events = %#v", reporter2.events)
	}
}
