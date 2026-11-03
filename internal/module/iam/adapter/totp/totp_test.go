package totp

import (
	"strings"
	"testing"
	"time"
)

// TestRFC6238AppendixBVectors 使用 RFC 6238 附录 B 的官方测试向量验证实现
// 与标准 TOTP（Google Authenticator 等）互通。
func TestRFC6238AppendixBVectors(t *testing.T) {
	// RFC 6238 附录 B：ASCII secret "12345678901234567890"（其 base32 编码
	// GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ），0 时刻（Unix epoch）为 T0。
	secret := "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
	cases := []struct {
		steps        int64
		expectedCode string
	}{
		{steps: 59, expectedCode: "94287082"}, // 8 位截断：附录列出的完整码
		{steps: 1111111109, expectedCode: "07081804"},
		{steps: 1111111111, expectedCode: "14050471"},
		{steps: 1234567890, expectedCode: "89005924"},
		{steps: 2000000000, expectedCode: "69279037"},
		{steps: 20000000000, expectedCode: "65353130"},
	}
	for _, tc := range cases {
		at := time.Unix(tc.steps, 0).UTC() // 直接用秒构造，避免 Duration 纳秒溢出
		code, err := CodeAt(secret, at)
		if err != nil {
			t.Fatalf("CodeAt(%d) error = %v", tc.steps, err)
		}
		// RFC 6238 附录提供 8 位码；取后 6 位为本实现 6 位语义。
		if len(tc.expectedCode) < 6 {
			t.Fatalf("bad expected code %q", tc.expectedCode)
		}
		expected6 := tc.expectedCode[len(tc.expectedCode)-6:]
		if code != expected6 {
			t.Fatalf("code at step %d = %q, want %q", tc.steps, code, expected6)
		}
	}
}

func TestValidateWindowAndReplayBoundary(t *testing.T) {
	secret := "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
	now := time.Unix(1700000000, 0).UTC()
	current, err := CodeAt(secret, now)
	if err != nil {
		t.Fatal(err)
	}
	previous, err := CodeAt(secret, now.Add(-PeriodSeconds*time.Second))
	if err != nil {
		t.Fatal(err)
	}
	// 当前步与 -1 步都应在默认窗口（±1）内通过。
	if ok, err := Validate(secret, current, now, DefaultWindow); err != nil || !ok {
		t.Fatalf("validate current = %v, %v", ok, err)
	}
	if ok, err := Validate(secret, previous, now, DefaultWindow); err != nil || !ok {
		t.Fatalf("validate previous = %v, %v", ok, err)
	}
	// 错误码拒绝；空码拒绝。
	if ok, err := Validate(secret, "000000", now, DefaultWindow); err != nil || ok {
		t.Fatalf("validate wrong = %v, %v", ok, err)
	}
	if ok, err := Validate(secret, "", now, DefaultWindow); err != nil || ok {
		t.Fatalf("validate empty = %v, %v", ok, err)
	}
}

func TestGenerateSecretAndURIRoundTrip(t *testing.T) {
	secret, err := GenerateSecret()
	if err != nil {
		t.Fatal(err)
	}
	if len(secret) < 16 {
		t.Fatalf("secret too short: %q", secret)
	}
	uri := URI("community-go", "owner", secret)
	if !strings.HasPrefix(uri, "otpauth://totp/") || !strings.Contains(uri, "secret=") {
		t.Fatalf("invalid uri %q", uri)
	}
	// 生成的 secret 可正常解码并产码。
	if _, err := CodeAt(secret, time.Now().UTC()); err != nil {
		t.Fatalf("code from generated secret error = %v", err)
	}
}

func TestInvalidSecretRejected(t *testing.T) {
	if _, err := CodeAt("!!not-base32!!", time.Now().UTC()); err == nil {
		t.Fatal("invalid secret must be rejected")
	}
}
