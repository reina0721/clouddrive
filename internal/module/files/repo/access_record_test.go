package repo

import (
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"reflect"
	"strings"
	"testing"
)

func TestAccessRecordsRoundTripAndCorruption(t *testing.T) {
	zero := model.SharePermission(0)
	policy := &model.AccessPolicy{Default: model.ShareReadOnly, Audience: model.AudiencePolicy{Anonymous: &zero, Accounts: []model.AudienceRule{}, Roles: []model.AudienceRule{}}}
	encoded, err := encodeAccessPolicy(policy)
	if err != nil {
		t.Fatal(err)
	}
	restored, err := decodeAccessPolicy(encoded)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(policy, restored) {
		t.Fatal("文件策略持久化丢失零值或缺失语义")
	}
	for _, bad := range []string{"", "{bad", "{}{}", `{"default":7,"audience":{"unknown":true}}`, strings.Repeat(" ", model.MaxAccessPolicyJSONBytes+1)} {
		if _, err := decodeAccessPolicy(bad); err == nil {
			t.Fatal("损坏策略被默认为继承")
		}
	}
	for _, bad := range []string{"", "null", "{}{}", `{"unknown":true}`, `{"anonymous":32768}`} {
		if _, err := decodeAudience(bad); err == nil {
			t.Fatal("损坏受众被默认为公开")
		}
	}
	if inherited, err := decodeAccessPolicy("null"); err != nil || inherited != nil {
		t.Fatal("明确继承被误解")
	}
	if _, err := decodeAudience("{}"); err != nil {
		t.Fatal("历史空受众默认不可用")
	}
}
