package humabinding

import (
	"encoding/json"
	"github.com/danielgtaylor/huma/v2"
	"reflect"
	"testing"
)

type nullableExample struct {
	Enabled bool `json:"enabled"`
}

func TestNullableObjectKeepsNullRequiredAndStrictObjectValidation(t *testing.T) {
	type payload struct {
		Value Nullable[nullableExample] `json:"value"`
	}
	registry := huma.NewMapRegistry("#/components/schemas/", huma.DefaultSchemaNamer)
	schema := registry.Schema(reflect.TypeFor[payload](), false, "")
	for _, scenario := range []struct {
		json  string
		valid bool
	}{
		{`{"value":null}`, true},
		{`{"value":{"enabled":true}}`, true},
		{`{}`, false},
		{`{"value":{}}`, false},
		{`{"value":{"enabled":"wrong"}}`, false},
		{`{"value":{"enabled":true,"unknown":true}}`, false},
		{`{"value":[]}`, false},
		{`{"value":0}`, false},
	} {
		var input any
		if err := json.Unmarshal([]byte(scenario.json), &input); err != nil {
			t.Fatal(err)
		}
		result := &huma.ValidateResult{}
		huma.Validate(registry, schema, huma.NewPathBuffer(nil, 0), huma.ModeWriteToServer, input, result)
		if (len(result.Errors) == 0) != scenario.valid {
			t.Fatalf("nullable对象校验不符，合法输入=%v，错误数=%d", scenario.valid, len(result.Errors))
		}
	}
	var value payload
	if err := json.Unmarshal([]byte(`{"value":{"enabled":true}}`), &value); err != nil || value.Value.Value == nil || !value.Value.Value.Enabled {
		t.Fatal("对象反序列化失败")
	}
	if err := json.Unmarshal([]byte(`{"value":null}`), &value); err != nil || value.Value.Value != nil {
		t.Fatal("明确null没有清除值")
	}
	encoded, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	if string(encoded) != `{"value":null}` {
		t.Fatal("null序列化形状不符")
	}
}
