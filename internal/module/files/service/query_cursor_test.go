package service

import (
	"errors"
	"slices"
	"testing"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

func TestWorkspaceCursorBoundariesAndChanges(t *testing.T) {
	policy := DefaultPolicy()
	policy.WorkspacePagination = PaginationCursor
	policy.WorkspaceMaxPageSize = 2
	files, repo, _ := newTestService(t, policy)
	entry := func(id, name string, kind model.Kind) model.Entry {
		return model.Entry{ID: id, OwnerID: "owner", Kind: kind, Name: name, NormalizedName: name}
	}
	repo.entries = []model.Entry{
		entry("a", "alpha", model.File), entry("b", "beta", model.File),
		entry("c", "charlie", model.File), entry("d", "delta", model.File),
		entry("folder", "folder", model.Folder),
	}
	read := func(query Query, want ...string) Listing {
		t.Helper()
		result, err := files.List(t.Context(), "owner", query)
		if err != nil {
			t.Fatal(err)
		}
		var ids []string
		for _, item := range result.Items {
			ids = append(ids, item.ID)
		}
		if !slices.Equal(ids, want) {
			t.Fatalf("列表 %v，预期 %v", ids, want)
		}
		return result
	}
	query := Query{Pagination: WorkspacePaginationAuto, PageSize: 50}
	first := read(query, "a", "b")
	if first.CursorPage == nil || first.CursorPage.Previous != "" || first.CursorPage.Next == "" ||
		first.PageSize != 2 || first.MaxPageSize != 2 || first.DefaultPageSize != 2 || len(first.AnnotationSummaries) != 2 {
		t.Fatalf("首批预算、注释或游标错误: %+v", first)
	}
	repo.entries = append(repo.entries, entry("new", "aardvark", model.File))
	query.Cursor = first.CursorPage.Next
	second := read(query, "c", "d")
	query.Cursor = second.CursorPage.Next
	last := read(query, "folder")
	if last.CursorPage.Next != "" || last.CursorPage.Previous == "" {
		t.Fatalf("末批游标错误: %+v", last.CursorPage)
	}
	query.Cursor = last.CursorPage.Previous
	read(query, "c", "d")
	query.Cursor = second.CursorPage.Previous
	read(query, "a", "b")
	query.Cursor = first.CursorPage.Next
	for _, altered := range []Query{
		{Pagination: WorkspacePaginationAuto, Cursor: query.Cursor, PageSize: 50, Sort: SortUpdated},
		{Pagination: WorkspacePaginationAuto, Cursor: query.Cursor, PageSize: 1},
		{Pagination: WorkspacePaginationAuto, Cursor: query.Cursor, PageSize: 50, Search: "beta"},
	} {
		if _, err := files.List(t.Context(), "owner", altered); !errors.Is(err, model.ErrConflict) {
			t.Fatalf("游标未绑定查询: %v", err)
		}
	}
	if _, err := files.List(t.Context(), "other", query); !errors.Is(err, model.ErrConflict) {
		t.Fatalf("跨所有者游标未失效: %v", err)
	}
	repo.entries[1].NormalizedName = "betta"
	if _, err := files.List(t.Context(), "owner", query); !errors.Is(err, model.ErrConflict) {
		t.Fatalf("重排锚点未失效: %v", err)
	}
	repo.entries = slices.Delete(repo.entries, 1, 2)
	if _, err := files.List(t.Context(), "owner", query); !errors.Is(err, model.ErrConflict) {
		t.Fatalf("删除锚点未失效: %v", err)
	}
	numbered := read(Query{Pagination: WorkspacePaginationNumbered, PageSize: 50, Page: 2}, "c", "d")
	if numbered.CursorPage != nil || numbered.Page != 2 {
		t.Fatalf("页码链接行为变化: %+v", numbered)
	}
	legacy := read(Query{PageSize: 50}, "new", "a", "c", "d", "folder")
	if legacy.CursorPage != nil || legacy.PageSize != 50 {
		t.Fatalf("原有调用受工作区上限影响: %+v", legacy)
	}
	files.policy.WorkspacePagination = PaginationNumbered
	search := read(Query{Pagination: WorkspacePaginationAuto, PageSize: 2, Kinds: []model.Kind{model.File}, Desc: true, Sort: SortSize}, "new", "d")
	if search.CursorPage == nil || search.CursorPage.Next == "" {
		t.Fatal("高级搜索未强制使用游标")
	}
	read(Query{Pagination: WorkspacePaginationAuto, PageSize: 2, Kinds: []model.Kind{model.File}, Desc: true, Sort: SortSize, Cursor: search.CursorPage.Next}, "c", "a")
	empty := read(Query{Pagination: WorkspacePaginationAuto, PageSize: 2, Search: "absent"})
	if empty.CursorPage == nil || *empty.CursorPage != (FileCursorPage{}) {
		t.Fatalf("空搜索存在无效翻页: %+v", empty.CursorPage)
	}
}
