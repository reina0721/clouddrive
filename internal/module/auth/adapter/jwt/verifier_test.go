package jwtadapter

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/lestrrat-go/jwx/v3/jwa"
	"github.com/lestrrat-go/jwx/v3/jwk"
	"github.com/lestrrat-go/jwx/v3/jws"
	"github.com/lestrrat-go/jwx/v3/jwt"
	"github.com/reina0721/clouddrive/internal/module/auth/model"
	"github.com/reina0721/clouddrive/pkg/clock"
)

func TestVerifierLifecycleClaimsAndKeyRotation(t *testing.T) {
	now := time.Date(2026, 8, 15, 8, 0, 0, 0, time.UTC)
	first := newTestKey(t, "key-one")
	second := newTestKey(t, "key-two")
	provider := &testJWKSProvider{}
	provider.set(t, first.public)
	server := httptest.NewServer(provider)
	defer server.Close()

	verifier, err := New(Config{
		Issuer: "https://issuer.example", Audience: "todo-api", JWKSURL: server.URL,
		Algorithms: []string{"RS256"}, ScopesClaim: "scope", RequestTimeout: time.Second,
		RefreshInterval: time.Hour, RefreshTimeout: time.Second, Leeway: 5 * time.Second,
		MaxResponseBodyBytes: 1 << 20, AllowLoopbackOrPrivate: true,
	}, clock.Fixed(now))
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	credential := signCredential(t, first.private, now, tokenOptions{})
	if _, err := verifier.Verify(t.Context(), credential); err == nil {
		t.Fatal("Verify(before Start) error = nil")
	}
	if err := verifier.Start(t.Context()); err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	principal, err := verifier.Verify(t.Context(), credential)
	if err != nil || principal.Subject != "actor-a" || !principal.HasScope("todos:read") {
		t.Fatalf("Verify(valid) = %#v, %v", principal, err)
	}

	invalid := []struct {
		name    string
		options tokenOptions
	}{
		{name: "issuer", options: tokenOptions{issuer: "https://wrong.example"}},
		{name: "audience", options: tokenOptions{audience: "wrong-api"}},
		{name: "expired", options: tokenOptions{expiration: now.Add(-time.Minute)}},
		{name: "missing subject", options: tokenOptions{omitSubject: true}},
		{name: "missing expiration", options: tokenOptions{omitExpiration: true}},
		{name: "missing nbf", options: tokenOptions{omitNotBefore: true}},
		{name: "missing issued at", options: tokenOptions{omitIssuedAt: true}},
		{name: "future not before", options: tokenOptions{notBefore: now.Add(time.Minute)}},
		{name: "future issued at", options: tokenOptions{issuedAt: now.Add(time.Minute)}},
		{name: "missing scopes", options: tokenOptions{omitScopes: true}},
		{name: "missing kid", options: tokenOptions{omitKeyID: true}},
	}
	for _, test := range invalid {
		t.Run(test.name, func(t *testing.T) {
			if _, err := verifier.Verify(t.Context(), signCredential(t, first.private, now, test.options)); err == nil {
				t.Fatal("Verify(invalid claims) error = nil")
			}
		})
	}
	if _, err := verifier.Verify(t.Context(), model.Credential{Scheme: "Bearer", Value: "not-a-jwt"}); !errors.Is(err, model.ErrUnauthenticated) {
		t.Fatalf("Verify(malformed) error = %v", err)
	}
	if _, err := verifier.Verify(t.Context(), model.Credential{Scheme: "Bearer", Value: strings.Repeat("x", maxTokenBytes+1)}); !errors.Is(err, model.ErrUnauthenticated) {
		t.Fatalf("Verify(oversized) error = %v", err)
	}

	provider.set(t, second.public)
	rotated := signCredential(t, second.private, now, tokenOptions{})
	principal, err = verifier.Verify(t.Context(), rotated)
	if err != nil || principal.Subject != "actor-a" || provider.requests() < 2 {
		t.Fatalf("Verify(rotated) = %#v, %v, requests = %d", principal, err, provider.requests())
	}
	if err := verifier.Stop(context.Background()); err != nil {
		t.Fatalf("Stop() error = %v", err)
	}
	if verifier.Ready() {
		t.Fatal("Ready() = true after Stop")
	}
	if _, err := verifier.Verify(t.Context(), rotated); err == nil {
		t.Fatal("Verify(after Stop) error = nil")
	}
}

func TestUnknownKeyRefreshIsCoalescedAndCallerCancellationPropagates(t *testing.T) {
	now := time.Date(2026, 8, 15, 8, 0, 0, 0, time.UTC)
	known := newTestKey(t, "known")
	unknown := newTestKey(t, "unknown")
	payload := marshalSet(t, known.public)
	refreshStarted := make(chan struct{}, 8)
	var mu sync.Mutex
	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		mu.Lock()
		requests++
		current := requests
		mu.Unlock()
		if current == 1 {
			writer.Header().Set("Content-Type", "application/jwk-set+json")
			_, _ = writer.Write(payload)
			return
		}
		refreshStarted <- struct{}{}
		<-request.Context().Done()
	}))
	defer server.Close()
	verifier := newStartedVerifier(t, server.URL, now)
	contexts := make([]context.CancelFunc, 8)
	results := make(chan error, len(contexts))
	credentials := make([]model.Credential, len(contexts))
	for index := range credentials {
		credentials[index] = signCredential(t, unknown.private, now, tokenOptions{keyID: fmt.Sprintf("unknown-%d", index)})
	}
	for index := range contexts {
		ctx, cancel := context.WithCancel(t.Context())
		contexts[index] = cancel
		go func(credential model.Credential) {
			_, err := verifier.Verify(ctx, credential)
			results <- err
		}(credentials[index])
	}
	<-refreshStarted
	select {
	case <-refreshStarted:
		t.Fatal("concurrent unknown-key verification started more than one JWKS refresh")
	case <-time.After(100 * time.Millisecond):
	}
	for _, cancel := range contexts {
		cancel()
	}
	for range contexts {
		if err := <-results; !errors.Is(err, context.Canceled) {
			t.Fatalf("Verify(canceled refresh waiter) error = %v", err)
		}
	}
	if err := verifier.Stop(t.Context()); err != nil {
		t.Fatalf("Stop() error = %v", err)
	}
}

func TestUnknownKeyRefreshTimeoutPropagates(t *testing.T) {
	now := time.Date(2026, 8, 15, 8, 0, 0, 0, time.UTC)
	known := newTestKey(t, "known")
	unknown := newTestKey(t, "unknown")
	payload := marshalSet(t, known.public)
	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		requests++
		if requests == 1 {
			writer.Header().Set("Content-Type", "application/jwk-set+json")
			_, _ = writer.Write(payload)
			return
		}
		<-request.Context().Done()
	}))
	defer server.Close()
	verifier, err := New(Config{
		Issuer: "https://issuer.example", Audience: "todo-api", JWKSURL: server.URL,
		Algorithms: []string{"RS256"}, ScopesClaim: "scope", RequestTimeout: time.Second,
		RefreshInterval: time.Hour, RefreshTimeout: 50 * time.Millisecond, Leeway: 5 * time.Second,
		MaxResponseBodyBytes: 1 << 20, AllowLoopbackOrPrivate: true,
	}, clock.Fixed(now))
	if err != nil {
		t.Fatal(err)
	}
	if err := verifier.Start(t.Context()); err != nil {
		t.Fatal(err)
	}
	if _, err := verifier.Verify(t.Context(), signCredential(t, unknown.private, now, tokenOptions{})); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("Verify(refresh timeout) error = %v", err)
	}
	if err := verifier.Stop(t.Context()); err != nil {
		t.Fatalf("Stop() error = %v", err)
	}
}

func TestVerifierRejectsDuplicateKIDAndMultipleSignatures(t *testing.T) {
	now := time.Date(2026, 8, 15, 8, 0, 0, 0, time.UTC)
	first := newTestKey(t, "duplicate")
	second := newTestKey(t, "duplicate")
	firstJSON, err := json.Marshal(first.public)
	if err != nil {
		t.Fatal(err)
	}
	secondJSON, err := json.Marshal(second.public)
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.Header().Set("Content-Type", "application/jwk-set+json")
		_, _ = fmt.Fprintf(writer, `{"keys":[%s,%s]}`, firstJSON, secondJSON)
	}))
	defer server.Close()
	verifier, err := newVerifier(server.URL, now)
	if err != nil {
		t.Fatal(err)
	}
	if err := verifier.Start(t.Context()); err == nil {
		t.Fatal("Start(duplicate kid) error = nil")
	}

	multiple, err := jws.Sign([]byte(`{"sub":"actor-a"}`),
		jws.WithJSON(),
		jws.WithKey(jwa.RS256(), first.private),
		jws.WithKey(jwa.RS256(), second.private),
	)
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err := verifier.protectedHeader(multiple); err == nil {
		t.Fatal("protectedHeader(multiple signatures) error = nil")
	}
}

func TestVerifierRejectsKeyAlgorithmMismatch(t *testing.T) {
	now := time.Date(2026, 8, 15, 8, 0, 0, 0, time.UTC)
	key := newTestKey(t, "mismatched")
	if err := key.public.Set(jwk.AlgorithmKey, jwa.RS384()); err != nil {
		t.Fatal(err)
	}
	payload := marshalSet(t, key.public)
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.Header().Set("Content-Type", "application/jwk-set+json")
		_, _ = writer.Write(payload)
	}))
	defer server.Close()
	verifier := newStartedVerifier(t, server.URL, now)
	defer func() {
		if err := verifier.Stop(t.Context()); err != nil {
			t.Errorf("Stop() error = %v", err)
		}
	}()
	if _, err := verifier.Verify(t.Context(), signCredential(t, key.private, now, tokenOptions{})); !errors.Is(err, model.ErrUnauthenticated) {
		t.Fatalf("Verify(key algorithm mismatch) error = %v", err)
	}
}

func TestVerifierRejectsDisallowedAlgorithmAndFailedInitialFetch(t *testing.T) {
	now := time.Date(2026, 8, 15, 8, 0, 0, 0, time.UTC)
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		http.Error(writer, "unavailable", http.StatusServiceUnavailable)
	}))
	defer server.Close()
	verifier, err := New(Config{
		Issuer: "https://issuer.example", Audience: "todo-api", JWKSURL: server.URL,
		Algorithms: []string{"RS256"}, ScopesClaim: "scope", RequestTimeout: time.Second,
		RefreshInterval: time.Hour, RefreshTimeout: time.Second, Leeway: 5 * time.Second,
		MaxResponseBodyBytes: 1024, AllowLoopbackOrPrivate: true,
	}, clock.Fixed(now))
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	if err := verifier.Start(t.Context()); err == nil || verifier.Ready() {
		t.Fatalf("Start(failed fetch) error = %v, ready = %t", err, verifier.Ready())
	}

	key := []byte("01234567890123456789012345678901")
	token, err := jwt.NewBuilder().Issuer("https://issuer.example").Audience([]string{"todo-api"}).
		Subject("actor-a").IssuedAt(now).NotBefore(now.Add(-time.Minute)).Expiration(now.Add(time.Minute)).
		Claim("scope", "todos:read").Build()
	if err != nil {
		t.Fatalf("Build() error = %v", err)
	}
	headers := jws.NewHeaders()
	if err := headers.Set(jws.KeyIDKey, "symmetric"); err != nil {
		t.Fatalf("Set(kid) error = %v", err)
	}
	signed, err := jwt.Sign(token, jwt.WithKey(jwa.HS256(), key, jws.WithProtectedHeaders(headers)))
	if err != nil {
		t.Fatalf("Sign(HS256) error = %v", err)
	}
	if _, _, err := verifier.protectedHeader(signed); err == nil {
		t.Fatal("protectedHeader(HS256) error = nil")
	}
}

type testKey struct {
	private jwk.Key
	public  jwk.Key
}

func newTestKey(t *testing.T, kid string) testKey {
	t.Helper()
	raw, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("GenerateKey() error = %v", err)
	}
	private, err := jwk.Import(raw)
	if err != nil {
		t.Fatalf("Import(private) error = %v", err)
	}
	if err := private.Set(jwk.KeyIDKey, kid); err != nil {
		t.Fatalf("Set(private kid) error = %v", err)
	}
	if err := private.Set(jwk.AlgorithmKey, jwa.RS256()); err != nil {
		t.Fatalf("Set(private alg) error = %v", err)
	}
	public, err := jwk.PublicKeyOf(private)
	if err != nil {
		t.Fatalf("PublicKeyOf() error = %v", err)
	}
	return testKey{private: private, public: public}
}

type tokenOptions struct {
	issuer         string
	audience       string
	keyID          string
	expiration     time.Time
	notBefore      time.Time
	issuedAt       time.Time
	omitSubject    bool
	omitExpiration bool
	omitNotBefore  bool
	omitIssuedAt   bool
	omitScopes     bool
	omitKeyID      bool
}

func signCredential(t *testing.T, key jwk.Key, now time.Time, options tokenOptions) model.Credential {
	t.Helper()
	issuer := options.issuer
	if issuer == "" {
		issuer = "https://issuer.example"
	}
	audience := options.audience
	if audience == "" {
		audience = "todo-api"
	}
	expiration := options.expiration
	if expiration.IsZero() {
		expiration = now.Add(time.Hour)
	}
	builder := jwt.NewBuilder().Issuer(issuer).Audience([]string{audience})
	if !options.omitSubject {
		builder.Subject("actor-a")
	}
	if !options.omitIssuedAt {
		issuedAt := options.issuedAt
		if issuedAt.IsZero() {
			issuedAt = now.Add(-time.Minute)
		}
		builder.IssuedAt(issuedAt)
	}
	if !options.omitExpiration {
		builder.Expiration(expiration)
	}
	if !options.omitScopes {
		builder.Claim("scope", "todos:read todos:write")
	}
	if !options.omitNotBefore {
		notBefore := options.notBefore
		if notBefore.IsZero() {
			notBefore = now.Add(-time.Minute)
		}
		builder.NotBefore(notBefore)
	}
	token, err := builder.Build()
	if err != nil {
		t.Fatalf("Build() error = %v", err)
	}
	headers := jws.NewHeaders()
	var signingKey any = key
	if !options.omitKeyID {
		kid := options.keyID
		if kid == "" {
			kid, _ = key.KeyID()
		}
		if err := headers.Set(jws.KeyIDKey, kid); err != nil {
			t.Fatalf("Set(kid) error = %v", err)
		}
	} else {
		var raw rsa.PrivateKey
		if err := jwk.Export(key, &raw); err != nil {
			t.Fatalf("Export(private key) error = %v", err)
		}
		signingKey = &raw
	}
	signed, err := jwt.Sign(token, jwt.WithKey(jwa.RS256(), signingKey, jws.WithProtectedHeaders(headers)))
	if err != nil {
		t.Fatalf("Sign() error = %v", err)
	}
	return model.Credential{Scheme: "Bearer", Value: string(signed)}
}

func newVerifier(jwksURL string, now time.Time) (*Verifier, error) {
	return New(Config{
		Issuer: "https://issuer.example", Audience: "todo-api", JWKSURL: jwksURL,
		Algorithms: []string{"RS256"}, ScopesClaim: "scope", RequestTimeout: time.Second,
		RefreshInterval: time.Hour, RefreshTimeout: time.Second, Leeway: 5 * time.Second,
		MaxResponseBodyBytes: 1 << 20, AllowLoopbackOrPrivate: true,
	}, clock.Fixed(now))
}

func newStartedVerifier(t *testing.T, jwksURL string, now time.Time) *Verifier {
	t.Helper()
	verifier, err := newVerifier(jwksURL, now)
	if err != nil {
		t.Fatal(err)
	}
	if err := verifier.Start(t.Context()); err != nil {
		t.Fatal(err)
	}
	return verifier
}

func marshalSet(t *testing.T, keys ...jwk.Key) []byte {
	t.Helper()
	set := jwk.NewSet()
	for _, key := range keys {
		if err := set.AddKey(key); err != nil {
			t.Fatal(err)
		}
	}
	payload, err := json.Marshal(set)
	if err != nil {
		t.Fatal(err)
	}
	return payload
}

type testJWKSProvider struct {
	mu       sync.RWMutex
	payload  []byte
	requestN int
}

func (p *testJWKSProvider) ServeHTTP(writer http.ResponseWriter, _ *http.Request) {
	p.mu.Lock()
	p.requestN++
	payload := append([]byte(nil), p.payload...)
	p.mu.Unlock()
	writer.Header().Set("Content-Type", "application/jwk-set+json")
	_, _ = writer.Write(payload)
}

func (p *testJWKSProvider) set(t *testing.T, key jwk.Key) {
	t.Helper()
	payload := marshalSet(t, key)
	p.mu.Lock()
	p.payload = payload
	p.mu.Unlock()
}

func (p *testJWKSProvider) requests() int {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.requestN
}
