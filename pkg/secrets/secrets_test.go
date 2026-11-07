package secrets

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestRedactMapProtectsNodeCredentialsInsideLists(t *testing.T) {
	const marker = "must-not-appear-in-diagnostics"
	node := map[string]any{"name": "download node", "secret": marker, "nested": []any{[]any{map[string]any{"token": marker}}}}
	input := map[string]any{"nodes": []any{node}, "typedNodes": []map[string]any{{"credential": marker}}}
	redacted := RedactMap(input)
	encoded, err := json.Marshal(redacted)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(encoded), marker) {
		t.Fatal("列表配置中的凭据泄露到诊断输出")
	}
	if node["secret"] != marker {
		t.Fatal("脱敏修改了原始配置")
	}
	copyNode := redacted["nodes"].([]any)[0].(map[string]any)
	copyNode["name"] = "changed"
	if node["name"] != "download node" {
		t.Fatal("脱敏结果仍共享原配置的列表对象")
	}
}

func TestRedactMapPreservesMissingAndEmptyListSemantics(t *testing.T) {
	input := map[string]any{"missing": []any(nil), "empty": []any{}, "typedMissing": []map[string]any(nil), "typedEmpty": []map[string]any{}}
	redacted := RedactMap(input)
	if redacted["missing"].([]any) != nil || redacted["typedMissing"].([]map[string]any) != nil {
		t.Fatal("缺失列表被改成空列表")
	}
	if redacted["empty"].([]any) == nil || redacted["typedEmpty"].([]map[string]any) == nil {
		t.Fatal("显式空列表被改成缺失")
	}
}

func TestSecretStringIsRedacted(t *testing.T) {
	secret := New("plain-value")
	if secret.Value() != "plain-value" {
		t.Fatal("Value() did not return original secret")
	}
	if secret.String() == "plain-value" {
		t.Fatal("String() leaked secret")
	}
}

func TestRedactMapRedactsNestedSensitiveKeys(t *testing.T) {
	redacted := RedactMap(map[string]any{
		"database": map[string]any{
			"password": "secret",
			"host":     "localhost",
		},
	})
	nested := redacted["database"].(map[string]any)
	if nested["password"] != redactedValue {
		t.Fatalf("password = %v, want redacted", nested["password"])
	}
	if nested["host"] != "localhost" {
		t.Fatalf("host = %v, want original", nested["host"])
	}
}

func TestRedactMapTreatsDSNAsSensitive(t *testing.T) {
	redacted := RedactMap(map[string]any{"dsn": "postgres://user:secret@example.invalid/app"})
	if redacted["dsn"] == "postgres://user:secret@example.invalid/app" {
		t.Fatal("RedactMap() leaked dsn")
	}
}

func TestTokenGeneratesDifferentValues(t *testing.T) {
	first, err := Token(16)
	if err != nil {
		t.Fatalf("Token() error = %v", err)
	}
	second, err := Token(16)
	if err != nil {
		t.Fatalf("Token() error = %v", err)
	}
	if first.Value() == "" || first.Value() == second.Value() {
		t.Fatalf("tokens are not unique enough: %q %q", first.Value(), second.Value())
	}
}
