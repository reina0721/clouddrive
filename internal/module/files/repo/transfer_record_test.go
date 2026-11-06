package repo

import (
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"reflect"
	"strings"
	"testing"
)

func TestDAVTransferConditionCodecRejectsMalformedState(t *testing.T) {
	value := model.Transfer{ID: "transfer", Source: model.TransferSourceWebDAV, DAVCondition: model.DAVCondition{RequestPath: "/note.txt", Lists: []model.DAVConditionList{{Conditions: []model.DAVStateCondition{{Token: "urn:uuid:lock"}}}}}}
	record, err := transferRecordFromModel(value)
	if err != nil {
		t.Fatal(err)
	}
	decoded, err := record.model()
	if err != nil || !reflect.DeepEqual(value, decoded) {
		t.Fatal("条件持久化未保留语义", err)
	}
	for _, document := range []string{record.DAVConditionDocument + "?", record.DAVConditionDocument + record.DAVConditionDocument, `{"Unknown":true}`, `{"Lists":[{"Conditions":[{}]}]}`, strings.Repeat("x", model.MaxDAVConditionBytes+1)} {
		corrupt := record
		corrupt.DAVConditionDocument = document
		if _, err := corrupt.model(); err == nil {
			t.Fatal("损坏持久条件被静默采用")
		}
	}
	record.Source = model.TransferSourceTus
	if _, err := record.model(); err == nil {
		t.Fatal("普通上传获得DAV条件权限")
	}
}
