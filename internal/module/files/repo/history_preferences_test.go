package repo

import (
	"encoding/json"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"strings"
	"testing"
)

func TestHistoryPreferencesStoredCorruptionIsNotDefaulted(t *testing.T) {
	value := model.DefaultHistoryPreferences()
	value.Revision = 1
	encoded, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	valid := string(encoded)
	for _, document := range []string{"null", valid + valid, valid + "?", strings.Replace(valid, `"extensions":[]`, `"extensions":null`, 1), strings.TrimSuffix(valid, "}") + `,"owner":"other"}`} {
		if _, err := decodeHistoryPreferences(historyPreferencesRecord{Revision: 1, Document: document}); err == nil {
			t.Fatal("损坏规则被默认为成功")
		}
	}
	if _, err := decodeHistoryPreferences(historyPreferencesRecord{Revision: 2, Document: valid}); err == nil {
		t.Fatal("revision不一致被接受")
	}
	if _, err := decodeHistoryPreferences(historyPreferencesRecord{Revision: 1, Document: valid}); err != nil {
		t.Fatal(err)
	}
}
