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
	entry := model.Entry{ID: "entry", OwnerID: "owner", ParentID: "parent", Kind: model.File, Name: "文件", NormalizedName: "文件", ObjectKey: "object", SizeBytes: 17, MediaType: "text/plain", CreatedAt: now, UpdatedAt: now, TrashedAt: &now, UploadKey: "upload", ContentSHA: strings.Repeat("a", 64), ContentRevision: 7, ShareToken: "", History: []model.VersionSnapshot{}, AnnotationRevision: 3, Annotations: model.Annotations{Tags: []model.Tag{{Name: "label", Color: model.DefaultTagColor}}, Properties: []model.Property{{Key: "Empty", Value: ""}}, Emoji: "📄"}}
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

func TestEntryRecordHistoryRoundTripAndCorruption(t *testing.T) {
	now := time.Now().UTC()
	entry := model.Entry{ID: "history-file", OwnerID: "owner", Kind: model.File, Name: "current.txt", NormalizedName: "current.txt", ObjectKey: "current", SizeBytes: 3, MediaType: "text/plain", CreatedAt: now, UpdatedAt: now, ContentRevision: 3, HistoryRevision: 2, History: []model.VersionSnapshot{{Revision: 1, Name: "first.txt", ObjectKey: "first", SizeBytes: 5, MediaType: "text/plain", ContentSHA: strings.Repeat("b", 64), UpdatedAt: now}}}
	record, err := entryRecordFromModel(entry)
	if err != nil {
		t.Fatal(err)
	}
	restored, err := record.model()
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(entry, restored) {
		t.Fatal("版本持久映射丢失字段")
	}
	for _, invalid := range []string{"", "null", "{}", "[] []", `[{"unknown":1}]`, `[{"revision":3,"name":"bad","objectKey":"bad"}]`, strings.Repeat(" ", model.MaxHistoryJSONBytes+1)} {
		corrupt := record
		corrupt.HistoryJSON = invalid
		if _, err := corrupt.model(); err == nil {
			t.Fatal("损坏历史被当作空历史")
		}
	}
	entry.Kind = model.Folder
	if _, err := entryRecordFromModel(entry); err == nil {
		t.Fatal("目录接受了内容历史")
	}
}
