package repo

import (
	"encoding/json"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"strings"
	"testing"
)

func TestPreferencesRejectCorruptStoredDocument(t *testing.T) {
	value := model.DefaultFilePreferences()
	value.Revision = 1
	encoded, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	valid := string(encoded)
	for _, scenario := range []struct {
		name, document string
		revision       int64
	}{
		{"重复文档", valid + valid, 1},
		{"尾部损坏", valid + "?", 1},
		{"未知字段", strings.TrimSuffix(valid, "}") + `,"unknown":true}`, 1},
		{"revision不一致", valid, 2},
		{"已存revision为零", valid, 0},
		{"非法点击行为", strings.Replace(valid, `"open"`, `"invalid"`, 1), 1},
	} {
		t.Run(scenario.name, func(t *testing.T) {
			if _, err := decodeFilePreferences(preferencesRecord{Revision: scenario.revision, Document: scenario.document}); err == nil {
				t.Fatal("损坏文档被伪装为有效偏好")
			}
		})
	}
	if _, err := decodeFilePreferences(preferencesRecord{Revision: 1, Document: valid}); err != nil {
		t.Fatal(err)
	}
}
