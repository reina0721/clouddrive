package alerting

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestWebhookNotifierSendsAndSigns(t *testing.T) {
	var received atomic.Int32
	var signature string
	var payload webhookPayload
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		received.Add(1)
		signature = request.Header.Get("X-Alert-Signature")
		body, _ := io.ReadAll(request.Body)
		_ = json.Unmarshal(body, &payload)
		writer.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	notifier, err := NewWebhookNotifier(WebhookConfig{URL: server.URL, SigningKey: "sekrit", Timeout: 2 * time.Second})
	if err != nil {
		t.Fatal(err)
	}
	event := Event{Type: "account_locked", Severity: SeverityCritical, Summary: "account locked", ResourceType: "account", ResourceIDHash: "deadbeef", OccurredAt: time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)}
	if err := notifier.Notify(t.Context(), event); err != nil {
		t.Fatal(err)
	}
	if received.Load() != 1 {
		t.Fatalf("received = %d", received.Load())
	}
	if payload.Type != "account_locked" || payload.Severity != "critical" || payload.ResourceType != "account" || payload.ResourceIDHash != "deadbeef" {
		t.Fatalf("payload = %#v", payload)
	}
	// 签名与本地计算一致（不泄密钥只验凭证）。
	mac := hmac.New(sha256.New, []byte("sekrit"))
	mac.Write([]byte(mustMarshal(t, payload)))
	if signature != hex.EncodeToString(mac.Sum(nil)) {
		t.Fatalf("signature mismatch: %q", signature)
	}
}

func mustMarshal(t *testing.T, payload webhookPayload) []byte {
	t.Helper()
	encoded, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}
	return encoded
}

func TestWebhookNotifierRetriesAndEmitsFailure(t *testing.T) {
	var attempts atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		attempts.Add(1)
		writer.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer server.Close()
	notifier, err := NewWebhookNotifier(WebhookConfig{URL: server.URL, Timeout: 2 * time.Second, Retries: 2, RetryDelay: time.Millisecond})
	if err != nil {
		t.Fatal(err)
	}
	if err := notifier.Notify(t.Context(), Event{Type: "auth_failed", Severity: SeverityWarning, Summary: "repeated failures"}); err == nil {
		t.Fatal("Notify must fail after retries exhausted")
	}
	if attempts.Load() != 3 {
		t.Fatalf("attempts = %d, want 3", attempts.Load())
	}
}

func TestWebhookConfigValidation(t *testing.T) {
	for _, config := range []WebhookConfig{
		{URL: "http://example.com/hook", Timeout: time.Second},      // 非 loopback http
		{URL: "", Timeout: time.Second},                             // 空 URL
		{URL: "https://example.com/hook?a=1", Timeout: time.Second}, // 带 query
		{URL: "https://example.com/hook", Timeout: 0},               // 超时非法
		{URL: "https://example.com/hook", Timeout: time.Second, Retries: -1},
	} {
		if err := config.Validate(); err == nil {
			t.Fatalf("config %#v must fail validation", config)
		}
	}
	if err := (WebhookConfig{URL: "https://example.com/hook", Timeout: time.Second}).Validate(); err != nil {
		t.Fatalf("valid config rejected: %v", err)
	}
	// loopback http 放行。
	if err := (WebhookConfig{URL: "http://127.0.0.1:8080/hook", Timeout: time.Second}).Validate(); err != nil {
		t.Fatalf("loopback http config rejected: %v", err)
	}
}

func TestNotifyRejectsEmptyTypeAndCancellation(t *testing.T) {
	notifier, err := NewWebhookNotifier(WebhookConfig{URL: "https://example.com/hook", Timeout: time.Second})
	if err != nil {
		t.Fatal(err)
	}
	if err := notifier.Notify(t.Context(), Event{}); err == nil {
		t.Fatal("empty event type must be rejected")
	}
	cancelled, cancel := context.WithCancel(t.Context())
	cancel()
	if err := notifier.Notify(cancelled, Event{Type: "x", Summary: "y"}); err == nil {
		t.Fatal("cancelled context must fail")
	}
	if !strings.Contains(notifier.endpoint, "example.com") {
		t.Fatalf("endpoint = %q", notifier.endpoint)
	}
}
