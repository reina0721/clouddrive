package execution

import (
	"context"
	"testing"
	"time"

	"github.com/reina0721/clouddrive/internal/kernel/config"
	pkgexecution "github.com/reina0721/clouddrive/pkg/execution"
	"github.com/reina0721/clouddrive/pkg/fault"
	"github.com/reina0721/clouddrive/pkg/health"
	"github.com/reina0721/clouddrive/pkg/logger"
)

func TestBuildMemoryReturnsSynchronousExecutor(t *testing.T) {
	resource, err := build(context.Background(), defaultConfig(), componentDeps{logger: logger.Noop()})
	if err != nil {
		t.Fatalf("build memory: %v", err)
	}
	if resource == nil || resource.driver != DriverMemory || resource.executor == nil {
		t.Fatalf("memory resource unexpected: %+v", resource)
	}
}

func TestBuildDisabledReturnsNilExecutor(t *testing.T) {
	resource, err := build(context.Background(), Config{Driver: DriverDisabled}, componentDeps{})
	if err != nil {
		t.Fatalf("build disabled: %v", err)
	}
	if resource == nil || resource.executor != nil {
		t.Fatalf("disabled resource should have nil executor: %+v", resource)
	}
}

func TestBuildUnsupportedDriver(t *testing.T) {
	if _, err := build(context.Background(), Config{Driver: "bogus"}, componentDeps{}); err == nil {
		t.Fatal("unsupported driver should error")
	}
}

func TestDefaultConfigCarriesCompleteBudget(t *testing.T) {
	cfg := defaultConfig()
	if cfg.Driver != DriverMemory || cfg.RetryMaxAttempts != 3 || cfg.RetryJitterFactor != 0.2 {
		t.Fatalf("default config unexpected: %+v", cfg)
	}
	if cfg.RetryAttemptTimeoutMs <= 0 || cfg.RetryTotalTimeoutMs < cfg.RetryAttemptTimeoutMs {
		t.Fatalf("default timeout budget unexpected: %+v", cfg)
	}
}

func TestApplyPolicyNamed(t *testing.T) {
	r := &resource{policies: map[string]pkgexecution.RetryPolicy{
		"payment": {MaxAttempts: 5, InitialDelay: 100 * time.Millisecond, MaxDelay: time.Second,
			JitterFactor: 0.1, AttemptTimeout: 2 * time.Second, TotalTimeout: 5 * time.Second},
	}}
	exec := pkgexecution.Execution{PolicyName: "payment"}
	if err := r.applyPolicy(&exec); err != nil {
		t.Fatalf("applyPolicy: %v", err)
	}
	if exec.Policy.MaxAttempts != 5 || exec.Policy.AttemptTimeout != 2*time.Second {
		t.Fatalf("policy resolved %+v", exec.Policy)
	}
}

func TestApplyPolicyUnknownNameErrors(t *testing.T) {
	r := &resource{policies: map[string]pkgexecution.RetryPolicy{}}
	if err := r.applyPolicy(&pkgexecution.Execution{PolicyName: "missing"}); err == nil {
		t.Fatal("unknown policy name should error")
	}
}

func TestApplyPolicyFallsBackAndKeepsExplicitPolicy(t *testing.T) {
	r := &resource{defaultPolicy: pkgexecution.RetryPolicy{MaxAttempts: 3}}
	defaulted := pkgexecution.Execution{}
	if err := r.applyPolicy(&defaulted); err != nil || defaulted.Policy.MaxAttempts != 3 {
		t.Fatalf("default policy=%+v err=%v", defaulted.Policy, err)
	}
	explicit := pkgexecution.Execution{Policy: pkgexecution.RetryPolicy{MaxAttempts: 7}}
	if err := r.applyPolicy(&explicit); err != nil || explicit.Policy.MaxAttempts != 7 {
		t.Fatalf("explicit policy=%+v err=%v", explicit.Policy, err)
	}
}

func TestAccessHealthReflectsBackendState(t *testing.T) {
	memory, err := build(context.Background(), defaultConfig(), componentDeps{logger: logger.Noop()})
	if err != nil {
		t.Fatalf("build memory: %v", err)
	}
	result, err := (&access{delegate: &fakeLease{current: memory}}).Health()
	if err != nil || result.Status != health.StatusPass {
		t.Fatalf("memory health=%+v err=%v", result, err)
	}
	disabled, err := build(context.Background(), Config{Driver: DriverDisabled}, componentDeps{})
	if err != nil {
		t.Fatalf("build disabled: %v", err)
	}
	result, err = (&access{delegate: &fakeLease{current: disabled}}).Health()
	if err != nil || result.Status != health.StatusFail {
		t.Fatalf("disabled health=%+v err=%v", result, err)
	}
}

func TestRetryLogContainsOnlyControlledFields(t *testing.T) {
	recorder := logger.NewTestLogger()
	observer := logRetry(recorder)
	observer(pkgexecution.RetryEvent{Attempt: 2, NextDelay: time.Second, ErrorCode: fault.CodeUnavailable})
	entries := recorder.Entries()
	if len(entries) != 1 || entries[0].Level != "debug" || entries[0].Message != "execution retry scheduled" {
		t.Fatalf("entries=%+v", entries)
	}
	if logRetry(nil) != nil {
		t.Fatal("nil logger should disable retry observer")
	}
}

func TestDecodeValidatesCompletePolicy(t *testing.T) {
	valid, err := decodeCfg(t, map[string]any{
		"driver": "  MEMORY  ", "retryMaxAttempts": 3, "retryInitialDelayMs": 10,
		"retryMaxDelayMs": 100, "retryJitterFactor": 0.25,
		"retryAttemptTimeoutMs": 100, "retryTotalTimeoutMs": 500,
	})
	if err != nil || valid.Driver != DriverMemory {
		t.Fatalf("valid=%+v err=%v", valid, err)
	}
	tests := []map[string]any{
		{"driver": "memory", "retryMaxAttempts": -1},
		{"driver": "memory", "retryJitterFactor": 1.1},
		{"driver": "memory", "retryMaxAttempts": 2, "retryInitialDelayMs": 0},
		{"driver": "memory", "retryInitialDelayMs": 100, "retryMaxDelayMs": 10},
		{"driver": "memory", "retryAttemptTimeoutMs": 200, "retryTotalTimeoutMs": 100},
	}
	for _, section := range tests {
		if _, err := decodeCfg(t, section); err == nil {
			t.Fatalf("invalid section accepted: %+v", section)
		}
	}
}

type fakeLease struct{ current *resource }

func (l *fakeLease) Use(_ context.Context, fn func(*resource) error) error { return fn(l.current) }

func decodeCfg(t *testing.T, section map[string]any) (Config, error) {
	t.Helper()
	snapshot, err := config.New(config.MapSource("test", map[string]any{"execution": section})).Load(context.Background())
	if err != nil {
		t.Fatalf("load snapshot: %v", err)
	}
	return decode(snapshot)
}
