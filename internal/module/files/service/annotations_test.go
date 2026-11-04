package service

import (
	"context"
	"errors"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"reflect"
	"strings"
	"testing"
)

func TestAnnotationsCASAtomicBatchAndValueSemantics(t *testing.T) {
	s, _, _ := newTestService(t, DefaultPolicy())
	ctx := t.Context()
	root, err := s.Folder(ctx, "owner", "", "整理")
	if err != nil {
		t.Fatal(err)
	}
	first, err := s.CreateText(ctx, "owner", root.ID, "first.txt", "annotation-first", "abc")
	if err != nil {
		t.Fatal(err)
	}
	second, err := s.CreateText(ctx, "owner", root.ID, "second.txt", "annotation-second", "")
	if err != nil {
		t.Fatal(err)
	}
	value, err := s.ReplaceAnnotations(ctx, "owner", first.ID, AnnotationUpdate{Tags: []model.Tag{{Name: "Cafe\u0301", Color: strings.ToUpper(model.DefaultTagColor)}}, Properties: []model.Property{{Key: "Project", Value: ""}}, Emoji: "📄"})
	if err != nil {
		t.Fatal(err)
	}
	if value.Revision != 1 || value.Tags[0].Name != "Café" || value.Tags[0].Color != model.DefaultTagColor || value.Properties[0].Value != "" {
		t.Fatal("注解正规化或零值语义错误")
	}
	if _, err := s.ReplaceAnnotations(ctx, "owner", first.ID, AnnotationUpdate{ExpectedRevision: 0}); !errors.Is(err, model.ErrConflict) {
		t.Fatal("过期版本未拒绝", err)
	}
	if _, err := s.ReplaceAnnotations(ctx, "owner", second.ID, AnnotationUpdate{Tags: []model.Tag{{Name: "保留", Color: model.DefaultTagColor}}}); err != nil {
		t.Fatal(err)
	}
	batch := TagsBatch{Targets: []AnnotationTarget{{ID: first.ID, Revision: 1}, {ID: second.ID, Revision: 0}}, Add: []model.Tag{{Name: "Batch", Color: model.DefaultTagColor}}}
	if _, err := s.ChangeTags(ctx, "owner", batch); !errors.Is(err, model.ErrConflict) {
		t.Fatal("批量冲突未拒绝", err)
	}
	detail, err := s.ReadAnnotations(ctx, "owner", first.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(detail.Annotation.Tags) != 1 || detail.Annotation.Revision != 1 {
		t.Fatal("批量失败部分提交")
	}
	batch.Targets[1].Revision = 1
	summaries, err := s.ChangeTags(ctx, "owner", batch)
	if err != nil {
		t.Fatal(err)
	}
	if len(summaries) != 2 || summaries[0].Revision != 2 || summaries[1].Revision != 2 {
		t.Fatal("批量版本错误")
	}
	detail, err = s.ReadAnnotations(ctx, "owner", first.ID)
	if err != nil {
		t.Fatal(err)
	}
	if detail.Annotation.Properties[0].Value != "" || detail.Annotation.Emoji != "📄" {
		t.Fatal("批量添加丢失其他字段")
	}
	if _, err := s.ChangeTags(ctx, "owner", TagsBatch{Targets: []AnnotationTarget{{ID: first.ID, Revision: 2}}, Remove: []string{"不存在"}}); err != nil {
		t.Fatal(err)
	}
	detail, err = s.ReadAnnotations(ctx, "owner", first.ID)
	if err != nil {
		t.Fatal(err)
	}
	if detail.Annotation.Revision != 2 {
		t.Fatal("无变化移除推进了版本")
	}
	if _, err := s.ChangeTags(ctx, "owner", TagsBatch{Targets: []AnnotationTarget{{ID: first.ID, Revision: 2}}, Remove: []string{"BATCH"}}); err != nil {
		t.Fatal(err)
	}
	detail, err = s.ReadAnnotations(ctx, "owner", first.ID)
	if err != nil {
		t.Fatal(err)
	}
	if detail.Annotation.Revision != 3 || len(detail.Annotation.Tags) != 1 {
		t.Fatal("标签移除错误")
	}
	if _, err := s.ReadAnnotations(ctx, "other", first.ID); !errors.Is(err, model.ErrMissing) {
		t.Fatal("跨owner读取未拒绝", err)
	}
	for _, input := range []AnnotationUpdate{
		{ExpectedRevision: 3, Tags: []model.Tag{{Name: "café", Color: model.DefaultTagColor}, {Name: "Cafe\u0301", Color: model.DefaultTagColor}}},
		{ExpectedRevision: 3, Properties: []model.Property{{Key: "sys:shared_redirect", Value: "x"}}},
		{ExpectedRevision: 3, FolderColor: model.DefaultTagColor},
		{ExpectedRevision: 3, Emoji: "bad\n"},
	} {
		if _, err := s.ReplaceAnnotations(ctx, "owner", first.ID, input); !errors.Is(err, model.ErrInvalid) {
			t.Fatal("无效注解被接受", err)
		}
	}
	if _, err := s.ReplaceAnnotations(ctx, "owner", first.ID, AnnotationUpdate{ExpectedRevision: 3, Properties: []model.Property{{Key: "a", Value: strings.Repeat("文", 256)}, {Key: "b", Value: strings.Repeat("文", 256)}, {Key: "c", Value: strings.Repeat("文", 256)}}}); !errors.Is(err, model.ErrTooLarge) {
		t.Fatal("字节预算未拒绝", err)
	}
}

func TestAnnotationsFilteringStatisticsCopiesAndRecovery(t *testing.T) {
	s, repository, _ := newTestService(t, DefaultPolicy())
	ctx := t.Context()
	root, err := s.Folder(ctx, "owner", "", "源目录")
	if err != nil {
		t.Fatal(err)
	}
	nested, err := s.Folder(ctx, "owner", root.ID, "子目录")
	if err != nil {
		t.Fatal(err)
	}
	file, err := s.CreateText(ctx, "owner", nested.ID, "report.txt", "annotation-report", "正文")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.ReplaceAnnotations(ctx, "owner", root.ID, AnnotationUpdate{Tags: []model.Tag{{Name: "Root", Color: model.DefaultTagColor}}, Emoji: "📚", FolderColor: model.DefaultTagColor}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.ReplaceAnnotations(ctx, "owner", file.ID, AnnotationUpdate{Tags: []model.Tag{{Name: "工作", Color: model.DefaultTagColor}, {Name: "项目,甲", Color: model.DefaultTagColor}}, Properties: []model.Property{{Key: "Project", Value: "AlphaBeta"}, {Key: "Empty", Value: ""}}}); err != nil {
		t.Fatal(err)
	}
	cases := []struct {
		query Query
		count int
	}{
		{Query{Tags: []string{"工作", "项目,甲"}, TagMatch: MatchAll}, 1},
		{Query{Tags: []string{"Root", "不存在"}, TagMatch: MatchAny}, 1},
		{Query{Tags: []string{"Root", "工作"}, TagMatch: MatchAll}, 0},
		{Query{Property: &AnnotationPropertyFilter{Key: "Empty", Match: PropertyEquals, Value: ""}}, 1},
		{Query{Property: &AnnotationPropertyFilter{Key: "Empty", Match: PropertyExists}}, 1},
		{Query{Property: &AnnotationPropertyFilter{Key: "Project", Match: PropertyContains, Value: "BETA"}}, 1},
		{Query{Property: &AnnotationPropertyFilter{Key: "Project", Match: PropertyContains, Value: "BETA"}, CaseSensitive: true}, 0},
	}
	for _, scenario := range cases {
		listing, err := s.List(ctx, "owner", scenario.query)
		if err != nil || len(listing.Items) != scenario.count {
			t.Fatal("注解检索错误", err, len(listing.Items), scenario.count)
		}
	}
	detail, err := s.ReadAnnotations(ctx, "owner", root.ID)
	if err != nil {
		t.Fatal(err)
	}
	if detail.Statistics.Files != 1 || detail.Statistics.Folders != 1 || detail.Statistics.LogicalBytes != int64(len("正文")) {
		t.Fatal("目录统计错误")
	}
	copy, err := s.Copy(ctx, "owner", root.ID, "", "副本")
	if err != nil {
		t.Fatal(err)
	}
	copied, err := s.ReadAnnotations(ctx, "owner", copy.ID)
	if err != nil {
		t.Fatal(err)
	}
	if copied.Annotation.Revision != 0 || copied.Annotation.Emoji != "📚" || copied.Annotation.FolderColor != model.DefaultTagColor {
		t.Fatal("目录副本丢失整理信息")
	}
	if _, err := s.ReplaceAnnotations(ctx, "owner", copy.ID, AnnotationUpdate{Tags: []model.Tag{{Name: "副本专用", Color: model.DefaultTagColor}}}); err != nil {
		t.Fatal(err)
	}
	original, err := s.ReadAnnotations(ctx, "owner", root.ID)
	if err != nil {
		t.Fatal(err)
	}
	if original.Annotation.Tags[0].Name != "Root" {
		t.Fatal("修改副本影响原件")
	}
	listing, err := s.List(ctx, "owner", Query{ParentID: copy.ID, Scope: ScopeTree, Tags: []string{"工作"}, PageSize: 50})
	if err != nil {
		t.Fatal(err)
	}
	if len(listing.Items) != 1 || len(listing.AnnotationSummaries) != 1 {
		t.Fatal("后代副本注解或摘要丢失")
	}
	if _, err := s.ReplaceText(ctx, "owner", file.ID, file.ContentRevision, "新内容"); err != nil {
		t.Fatal(err)
	}
	before, err := s.ReadAnnotations(ctx, "owner", file.ID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.Trash(ctx, "owner", root.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := s.ReadAnnotations(ctx, "owner", file.ID); !errors.Is(err, model.ErrMissing) {
		t.Fatal("回收祖先未隐藏注解")
	}
	if _, err := s.ReadAnnotationSummaries(ctx, "owner", []string{file.ID}, AnnotationTrash); !errors.Is(err, model.ErrMissing) {
		t.Fatal("隐含回收项被暴露")
	}
	if _, err := s.ReadAnnotationSummaries(ctx, "owner", []string{root.ID}, AnnotationTrash); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Restore(ctx, "owner", root.ID, nil); err != nil {
		t.Fatal(err)
	}
	after, err := s.ReadAnnotations(ctx, "owner", file.ID)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(before.Annotation, after.Annotation) {
		t.Fatal("恢复丢失注解")
	}
	// 修改读取副本不能改变仓储中的标签slice。
	after.Annotation.Tags[0].Name = "响应副本"
	stored, ok := model.Find(repository.entries, file.ID)
	if !ok || stored.Annotations.Tags[0].Name != "工作" {
		t.Fatal("响应共享可变标签")
	}
}

func TestAnnotationsBudgetsCancellationAndRevisionCeiling(t *testing.T) {
	policy := DefaultPolicy()
	policy.SearchTreeEntries = 2
	policy.AnnotationBatchEntries = 1
	s, repository, _ := newTestService(t, policy)
	repository.entries = []model.Entry{{ID: "a", OwnerID: "owner", Kind: model.File, Name: "a", AnnotationRevision: model.MaxAnnotationRevision}}
	if _, err := s.ReplaceAnnotations(t.Context(), "owner", "a", AnnotationUpdate{ExpectedRevision: model.MaxAnnotationRevision, Emoji: "📄"}); !errors.Is(err, model.ErrConflict) {
		t.Fatal("版本上界未拒绝", err)
	}
	if _, err := s.ChangeTags(t.Context(), "owner", TagsBatch{Targets: []AnnotationTarget{{ID: "a"}, {ID: "b"}}, Remove: []string{"x"}}); !errors.Is(err, model.ErrTooLarge) {
		t.Fatal("批量上界未拒绝", err)
	}
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	if _, err := s.ReadAnnotations(ctx, "owner", "a"); !errors.Is(err, context.Canceled) {
		t.Fatal("取消被隐藏", err)
	}
	repository.entries = append(repository.entries, model.Entry{ID: "b", OwnerID: "owner"}, model.Entry{ID: "c", OwnerID: "owner"})
	if _, err := s.ReadAnnotations(t.Context(), "owner", "a"); !errors.Is(err, model.ErrTooLarge) {
		t.Fatal("读取树预算未拒绝", err)
	}
	if _, err := s.ReplaceAnnotations(t.Context(), "owner", "a", AnnotationUpdate{ExpectedRevision: model.MaxAnnotationRevision}); !errors.Is(err, model.ErrTooLarge) {
		t.Fatal("写入树预算未拒绝", err)
	}
}
