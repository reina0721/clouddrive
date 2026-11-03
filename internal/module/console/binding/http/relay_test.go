package httpbinding

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestRelayEnforcesTargetsBudgetsAndCancellation(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/slow":
			select {
			case <-r.Context().Done():
				return
			case <-time.After(time.Second):
			}
		case "/large":
			_, _ = w.Write([]byte(strings.Repeat("x", 1025)))
			return
		case "/redirect":
			http.Redirect(w, r, "http://169.254.169.254/latest/meta-data", http.StatusFound)
			return
		}
		w.Header().Set("X-Observed-Agent", r.UserAgent())
		_, _ = w.Write([]byte("real upstream"))
	}))
	defer upstream.Close()
	policy := DefaultRelayPolicy()
	policy.MaxResponseBytes = 1024
	input := ResolvedRequest{Method: "GET", URL: upstream.URL, TimeoutMS: 100}
	if result := ExecuteRelay(t.Context(), input, policy); result.OK {
		t.Fatal("private target allowed without explicit origin")
	}
	policy.AllowedOrigins = []string{upstream.URL}
	input.Headers = map[string]string{"User-Agent": "clouddrive-test"}
	result := ExecuteRelay(t.Context(), input, policy)
	if !result.OK || result.Response.Body != "real upstream" {
		t.Fatalf("real relay=%+v", result)
	}
	for _, test := range []struct{ path, kind string }{{"/large", "unsupported"}, {"/slow", "timeout"}, {"/redirect", "network"}} {
		input.URL = upstream.URL + test.path
		result = ExecuteRelay(t.Context(), input, policy)
		if result.OK || result.Failure.Kind != test.kind {
			t.Fatalf("%s: %+v", test.path, result)
		}
	}
	input.URL = upstream.URL
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	result = ExecuteRelay(ctx, input, policy)
	if result.OK || result.Failure.Kind != "aborted" {
		t.Fatalf("cancel=%+v", result)
	}
}
