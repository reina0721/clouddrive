package service

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

func TestAdvancedFileQueryConditionsScopeAndPagination(t *testing.T) {
	s, repository, _ := newTestService(t, DefaultPolicy())
	base := time.Date(2026, 11, 3, 0, 0, 0, 0, time.UTC)
	trash := base
	repository.entries = []model.Entry{
		{ID: "root", OwnerID: "owner", Kind: model.Folder, Name: "a-dir.txt", NormalizedName: "a-dir.txt"},
		{ID: "nested", OwnerID: "owner", ParentID: "root", Kind: model.Folder, Name: "nested", NormalizedName: "nested"},
		{ID: "alpha", OwnerID: "owner", ParentID: "root", Kind: model.File, Name: "Alpha-报告.TXT", NormalizedName: "alpha-报告.txt", SizeBytes: 10, CreatedAt: base.Add(24*time.Hour - time.Second), UpdatedAt: base},
		{ID: "beta", OwnerID: "owner", ParentID: "nested", Kind: model.File, Name: "beta报告.md", NormalizedName: "beta报告.md", CreatedAt: base.Add(24 * time.Hour), UpdatedAt: base.Add(48 * time.Hour)},
		{ID: "unicode", OwnerID: "owner", Kind: model.File, Name: "cafe\u0301-note.txt", NormalizedName: "café-note.txt", SizeBytes: 3, CreatedAt: base.Add(48 * time.Hour), UpdatedAt: base.Add(72 * time.Hour)},
		{ID: "comma", OwnerID: "owner", Kind: model.File, Name: "report,final.txt", NormalizedName: "report,final.txt", SizeBytes: 9, CreatedAt: base, UpdatedAt: base},
		{ID: "shortcut", OwnerID: "owner", Kind: model.Shortcut, Name: "Alpha-link", NormalizedName: "alpha-link", CreatedAt: base, UpdatedAt: base},
		{ID: "trash", OwnerID: "owner", Kind: model.Folder, Name: "回收目录", NormalizedName: "回收目录", TrashedAt: &trash},
		{ID: "hidden", OwnerID: "owner", ParentID: "trash", Kind: model.File, Name: "Alpha-secret.txt", NormalizedName: "alpha-secret.txt", SizeBytes: 7, CreatedAt: base, UpdatedAt: base},
		{ID: "foreign", OwnerID: "other", Kind: model.File, Name: "Alpha-other.txt", NormalizedName: "alpha-other.txt", SizeBytes: 1000},
	}
	zero, one, ten := int64(0), int64(1), int64(10)
	nextDay, thirdDay := base.Add(24*time.Hour), base.Add(72*time.Hour)
	cases := []struct {
		name  string
		query Query
		ids   []string
	}{
		{"默认名称检索仍跨自有目录", Query{Search: "报告"}, []string{"alpha", "beta"}},
		{"规范化Unicode", Query{Search: "CAFÉ"}, []string{"unicode"}},
		{"大小写敏感", Query{Scope: ScopeAll, Keywords: []string{"alpha"}, CaseSensitive: true}, nil},
		{"大小写不敏感", Query{Scope: ScopeAll, Keywords: []string{"alpha"}}, []string{"alpha", "shortcut"}},
		{"全部关键词", Query{Scope: ScopeAll, Keywords: []string{"报告", "ALPHA"}, Match: MatchAll}, []string{"alpha"}},
		{"任一关键词", Query{Scope: ScopeAll, Keywords: []string{"beta", "note"}, Match: MatchAny}, []string{"beta", "unicode"}},
		{"字面逗号不拆分", Query{Scope: ScopeAll, Keywords: []string{"report,final"}}, []string{"comma"}},
		{"当前层", Query{ParentID: "root", Scope: ScopeFolder}, []string{"alpha", "nested"}},
		{"当前子树", Query{ParentID: "root", Scope: ScopeTree}, []string{"alpha", "beta", "nested"}},
		{"类型不扩展分享内容", Query{Scope: ScopeAll, Kinds: []model.Kind{model.Shortcut}}, []string{"shortcut"}},
		{"扩展名只筛文件", Query{Scope: ScopeAll, Extensions: []string{".TXT", "Md"}}, []string{"alpha", "beta", "comma", "unicode"}},
		{"零字节非缺失", Query{Scope: ScopeAll, MinBytes: &zero, MaxBytes: &zero}, []string{"beta"}},
		{"闭区间文件字节", Query{Scope: ScopeAll, MinBytes: &one, MaxBytes: &ten}, []string{"alpha", "comma", "unicode"}},
		{"创建上界排除", Query{Scope: ScopeAll, Kinds: []model.Kind{model.File}, CreatedFrom: &base, CreatedTo: &nextDay}, []string{"alpha", "comma"}},
		{"修改上界排除", Query{Scope: ScopeAll, Kinds: []model.Kind{model.File}, ModifiedFrom: &nextDay, ModifiedTo: &thirdDay}, []string{"beta"}},
		{"回收不枚举隐含子项", Query{Trash: true, Scope: ScopeAll, Keywords: []string{"回收"}}, []string{"trash"}},
	}
	for _, scenario := range cases {
		t.Run(scenario.name, func(t *testing.T) {
			listing, err := s.List(t.Context(), "owner", scenario.query)
			if err != nil {
				t.Fatal(err)
			}
			ids := []string{}
			for _, entry := range listing.Items {
				ids = append(ids, entry.ID)
			}
			sort.Strings(ids)
			expected := append([]string{}, scenario.ids...)
			sort.Strings(expected)
			if !reflect.DeepEqual(ids, expected) {
				t.Fatalf("查询结果%v，预期%v", ids, expected)
			}
			if listing.UsedBytes != 29 {
				t.Fatalf("过滤错误改变完整占用%d", listing.UsedBytes)
			}
		})
	}
	first, err := s.List(t.Context(), "owner", Query{Scope: ScopeAll, Page: 1, PageSize: 2, FoldersFirst: true, Desc: true})
	if err != nil {
		t.Fatal(err)
	}
	if first.Total != 7 || len(first.Items) != 2 || first.Items[0].Kind != model.Folder || first.Items[1].Kind != model.Folder {
		t.Fatalf("目录优先与分页错误 %+v", first)
	}
	second, err := s.List(t.Context(), "owner", Query{Scope: ScopeAll, Page: 2, PageSize: 2, FoldersFirst: true, Desc: true})
	if err != nil {
		t.Fatal(err)
	}
	if first.Items[0].ID == second.Items[0].ID || second.Total != first.Total {
		t.Fatal("分页重复或总数变化")
	}
	beyond, err := s.List(t.Context(), "owner", Query{Scope: ScopeAll, Page: 20, PageSize: 2})
	if err != nil || len(beyond.Items) != 0 || beyond.Total != 7 || beyond.Page != 20 {
		t.Fatal("越界页被伪装为首页", err)
	}
	_, err = s.List(t.Context(), "other", Query{ParentID: "root", Scope: ScopeTree})
	if !errors.Is(err, model.ErrMissing) {
		t.Fatal("跨账号根未拒绝", err)
	}
}

func TestAdvancedFileQueryRejectsInvalidAndHonorsCancellationBudget(t *testing.T) {
	s, repository, _ := newTestService(t, DefaultPolicy())
	negative, large, lower, upper := int64(-1), MaxQueryBytes+1, int64(5), int64(2)
	now := time.Now()
	invalid := []Query{
		{Keywords: []string{""}}, {Keywords: []string{"\n"}}, {Keywords: strings.Fields(strings.Repeat("word ", MaxQueryKeywords+1))},
		{Scope: "unbounded"}, {Match: "regex"}, {Sort: "unknown"}, {Kinds: []model.Kind{"link"}}, {Kinds: []model.Kind{model.File, model.File}},
		{Extensions: []string{"tar.gz"}}, {MinBytes: &negative}, {MaxBytes: &large}, {MinBytes: &lower, MaxBytes: &upper}, {CreatedFrom: &now, CreatedTo: &now},
		{Page: 2}, {PageSize: MaxListPageSize + 1}, {Page: DefaultSearchTreeEntries + 1}, {Search: string([]byte{0xff})},
	}
	for index, query := range invalid {
		if _, err := s.List(t.Context(), "owner", query); !errors.Is(err, model.ErrInvalid) {
			t.Fatalf("非法条件%d未拒绝: %v", index, err)
		}
	}
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	if _, err := s.List(ctx, "owner", Query{}); !errors.Is(err, context.Canceled) {
		t.Fatal("取消原因被隐藏", err)
	}
	s.policy.SearchTreeEntries = 1
	repository.entries = []model.Entry{{ID: "a", OwnerID: "owner", Kind: model.Folder}, {ID: "b", OwnerID: "owner", Kind: model.Folder}}
	if _, err := s.List(t.Context(), "owner", Query{}); !errors.Is(err, model.ErrTooLarge) {
		t.Fatal("截断被伪装成功", err)
	}
}

func TestAdvancedFileQueryDeepTreesAndCyclesDoNotLeak(t *testing.T) {
	s, repository, _ := newTestService(t, DefaultPolicy())
	entries := make([]model.Entry, DefaultSearchTreeEntries)
	for index := range entries {
		parent := ""
		if index > 0 {
			parent = fmt.Sprint(index - 1)
		}
		entries[index] = model.Entry{ID: fmt.Sprint(index), OwnerID: "owner", ParentID: parent, Kind: model.Folder, Name: "folder"}
	}
	entries[len(entries)-1].Kind = model.File
	entries[len(entries)-1].Name = "deep-last.txt"
	repository.entries = entries
	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()
	listing, err := s.List(ctx, "owner", Query{ParentID: "0", Scope: ScopeTree, Keywords: []string{"deep-last"}})
	if err != nil || len(listing.Items) != 1 {
		t.Fatal("深树不能有界检索", err)
	}
	repository.entries = []model.Entry{{ID: "a", OwnerID: "owner", ParentID: "b", Kind: model.Folder}, {ID: "b", OwnerID: "owner", ParentID: "a", Kind: model.Folder}, {ID: "leak", OwnerID: "owner", ParentID: "a", Kind: model.File, Name: "secret"}}
	listing, err = s.List(t.Context(), "owner", Query{Scope: ScopeAll})
	if err != nil || len(listing.Items) != 0 {
		t.Fatal("异常父链被当作可见", err)
	}
}
