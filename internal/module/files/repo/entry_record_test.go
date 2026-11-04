package repo

import (
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"reflect"
	"strings"
	"testing"
	"time"
)

func TestEntryRecordAnnotationsRoundTripAndCorruption(t *testing.T) {
	now := time.Now().UTC()
	entry := model.Entry{ID: "entry", OwnerID: "owner", ParentID: "parent", Kind: model.File, Name: "文件", NormalizedName: "文件", ObjectKey: "object", SizeBytes: 17, MediaType: "text/plain", CreatedAt: now, UpdatedAt: now, TrashedAt: &now, UploadKey: "upload", ContentSHA: strings.Repeat("a", 64), ContentRevision: 7, ShareToken: "", AnnotationRevision: 3, Annotations: model.Annotations{Tags: []model.Tag{{Name: "label", Color: model.DefaultTagColor}}, Properties: []model.Property{{Key: "Empty", Value: ""}}, Emoji: "📄"}}
	record, err := entryRecordFromModel(entry)
	if err != nil {
		t.Fatal(err)
	}
	restored, err := record.model()
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(entry, restored) {
		t.Fatal("持久映射丢失旧字段或注解")
	}
	for _, invalid := range []string{"", "null", "{bad", "{}{}", `{"unknown":"x"}`, `{"tags":[{"name":"x","color":"url(bad)"}]}`, strings.Repeat(" ", model.MaxAnnotationBytes+1)} {
		corrupt := record
		corrupt.AnnotationJSON = invalid
		if _, err := corrupt.model(); err == nil {
			t.Fatal("损坏注解被默认为空")
		}
	}
}
