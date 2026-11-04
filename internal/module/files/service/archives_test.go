package service

import (
	"archive/zip"
	"bytes"
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

type archiveProcessorFunc func(context.Context, ArchiveParseRequest) (ArchiveParseResult, error)

func (f archiveProcessorFunc) Process(ctx context.Context, q ArchiveParseRequest) (ArchiveParseResult, error) {
	return f(ctx, q)
}
func archiveFixtureResult(q ArchiveParseRequest) ArchiveParseResult {
	result := ArchiveParseResult{Format: "zip", Members: []ArchiveMember{{Path: "docs", Kind: model.Folder}, {Path: "docs/a.txt", Kind: model.File, SizeBytes: 3}, {Path: "b.txt", Kind: model.File, SizeBytes: 4}}, Payloads: []ArchivePayload{}}
	if q.Mode != ArchiveInspect {
		for _, payload := range []ArchivePayload{{Path: "docs/a.txt", Content: []byte("one")}, {Path: "b.txt", Content: []byte("body")}} {
			if q.Mode == ArchiveReadAll || archiveChosen(payload.Path, q.Paths) {
				result.Payloads = append(result.Payloads, payload)
			}
		}
	}
	return result
}
func archiveServiceFixture(t *testing.T, policy Policy) (*Archives, *Service, *memoryRepository, *memoryContent, model.Entry, model.Entry) {
	t.Helper()
	files, repo, content := newTestService(t, policy)
	source, err := files.createSmallContent(context.Background(), "owner", "", "source.zip", strings.Repeat("s", 16), []byte("zip"))
	if err != nil {
		t.Fatal(err)
	}
	target, err := files.Folder(context.Background(), "owner", "", "target")
	if err != nil {
		t.Fatal(err)
	}
	archives, err := NewArchives(files, archiveProcessorFunc(func(_ context.Context, q ArchiveParseRequest) (ArchiveParseResult, error) {
		return archiveFixtureResult(q), nil
	}))
	if err != nil {
		t.Fatal(err)
	}
	return archives, files, repo, content, source, target
}
func archiveExtractInput(source, target model.Entry, conflict ArchiveConflict) ArchiveExtractRequest {
	return ArchiveExtractRequest{ExpectedRevision: source.ContentRevision, Selection: ArchiveSelection{Mode: ArchiveReadAll}, ParentID: target.ID, Conflict: conflict}
}
func TestArchiveOwnershipSourceFenceAndStrictPayloads(t *testing.T) {
	a, _, _, _, source, _ := archiveServiceFixture(t, DefaultPolicy())
	ctx := context.Background()
	if _, err := a.Inspect(ctx, "other", source.ID, 1, ""); !errors.Is(err, model.ErrMissing) {
		t.Fatalf("越权归属未拒绝: %v", err)
	}
	if _, err := a.Inspect(ctx, "owner", source.ID, 2, ""); !errors.Is(err, model.ErrConflict) {
		t.Fatalf("旧源版本未拒绝: %v", err)
	}
	a.processor = archiveProcessorFunc(func(_ context.Context, q ArchiveParseRequest) (ArchiveParseResult, error) {
		r := archiveFixtureResult(q)
		r.Payloads = []ArchivePayload{{Path: "docs/a.txt", Content: []byte("tampered")}}
		return r, nil
	})
	if _, err := a.Member(ctx, "owner", source.ID, 1, "", "docs/a.txt"); !errors.Is(err, model.ErrInvalid) {
		t.Fatalf("错误字节长度未拒绝: %v", err)
	}
	a.processor = archiveProcessorFunc(func(context.Context, ArchiveParseRequest) (ArchiveParseResult, error) {
		return ArchiveParseResult{Format: "zip", Members: []ArchiveMember{{Path: "café.txt", Kind: model.File}, {Path: "cafe\u0301.txt", Kind: model.File}}}, nil
	})
	if _, err := a.Inspect(ctx, "owner", source.ID, 1, ""); !errors.Is(err, model.ErrConflict) {
		t.Fatalf("规范化名称冲突未拒绝: %v", err)
	}
}
func TestArchiveExtractAtomicHierarchyWrappingAndRealBytes(t *testing.T) {
	a, files, _, _, source, target := archiveServiceFixture(t, DefaultPolicy())
	q := archiveExtractInput(source, target, ArchiveReject)
	q.FolderName = "unpacked"
	receipt, err := a.Extract(context.Background(), "owner", source.ID, q)
	if err != nil {
		t.Fatal(err)
	}
	if len(receipt.Created) != 4 || receipt.DestinationID == target.ID {
		t.Fatalf("包裹目录/结果不完整: %#v", receipt)
	}
	roots := map[string]string{}
	for _, entry := range receipt.Created {
		roots[entry.Name] = entry.ID
		if entry.Kind == model.File {
			_, content, err := files.ReadSmall(context.Background(), "owner", entry.ID, 64)
			if err != nil {
				t.Fatal(err)
			}
			expected := "body"
			if entry.Name == "a.txt" {
				expected = "one"
			}
			if string(content) != expected {
				t.Fatalf("实际字节错误: %q", content)
			}
		}
	}
	for _, entry := range receipt.Created {
		if entry.Name == "a.txt" && entry.ParentID != roots["docs"] {
			t.Fatal("相对层级丢失")
		}
	}
	if _, err := a.Inspect(context.Background(), "owner", source.ID, source.ContentRevision, ""); err != nil {
		t.Fatalf("提取改变源压缩包: %v", err)
	}
}
func TestArchiveExtractSelectionAndConflicts(t *testing.T) {
	t.Run("拒绝不部分发布", func(t *testing.T) {
		a, files, repo, content, source, target := archiveServiceFixture(t, DefaultPolicy())
		if _, err := files.CreateText(context.Background(), "owner", target.ID, "b.txt", strings.Repeat("b", 16), "existing"); err != nil {
			t.Fatal(err)
		}
		entries, objects := len(repo.entries), len(content.objects)
		if _, err := a.Extract(context.Background(), "owner", source.ID, archiveExtractInput(source, target, ArchiveReject)); !errors.Is(err, model.ErrConflict) {
			t.Fatalf("冲突未拒绝: %v", err)
		}
		if len(repo.entries) != entries || len(content.objects) != objects {
			t.Fatal("冲突留下部分目录或对象")
		}
	})
	t.Run("跳过复用目录", func(t *testing.T) {
		a, files, _, _, source, target := archiveServiceFixture(t, DefaultPolicy())
		docs, err := files.Folder(context.Background(), "owner", target.ID, "docs")
		if err != nil {
			t.Fatal(err)
		}
		if _, err := files.CreateText(context.Background(), "owner", docs.ID, "a.txt", strings.Repeat("a", 16), "existing"); err != nil {
			t.Fatal(err)
		}
		receipt, err := a.Extract(context.Background(), "owner", source.ID, archiveExtractInput(source, target, ArchiveSkip))
		if err != nil {
			t.Fatal(err)
		}
		if len(receipt.Created) != 1 || receipt.Created[0].Name != "b.txt" || len(receipt.Skipped) != 1 || receipt.Skipped[0] != "docs/a.txt" {
			t.Fatalf("跳过回执错误: %#v", receipt)
		}
	})
	t.Run("自动改名保留目录", func(t *testing.T) {
		a, files, _, _, source, target := archiveServiceFixture(t, DefaultPolicy())
		if _, err := files.Folder(context.Background(), "owner", target.ID, "docs"); err != nil {
			t.Fatal(err)
		}
		if _, err := files.CreateText(context.Background(), "owner", target.ID, "b.txt", strings.Repeat("b", 16), "existing"); err != nil {
			t.Fatal(err)
		}
		receipt, err := a.Extract(context.Background(), "owner", source.ID, archiveExtractInput(source, target, ArchiveRename))
		if err != nil {
			t.Fatal(err)
		}
		if len(receipt.Created) != 3 || len(receipt.Renamed) != 2 {
			t.Fatalf("改名回执错误: %#v", receipt)
		}
		names := map[string]bool{}
		for _, entry := range receipt.Created {
			names[entry.Name] = true
		}
		if !names["docs (1)"] || !names["b (1).txt"] {
			t.Fatal("目录/扩展名改名错误")
		}
	})
	t.Run("只选目录", func(t *testing.T) {
		a, _, _, _, source, target := archiveServiceFixture(t, DefaultPolicy())
		q := archiveExtractInput(source, target, ArchiveReject)
		q.Selection = ArchiveSelection{Mode: ArchiveReadSelected, Paths: []string{"docs"}}
		receipt, err := a.Extract(context.Background(), "owner", source.ID, q)
		if err != nil {
			t.Fatal(err)
		}
		if len(receipt.Created) != 2 {
			t.Fatalf("选择范围泄漏: %#v", receipt)
		}
	})
}

type archiveRepositoryProbe struct {
	Repository
	beforeChange func()
	debts        []string
	debtErr      error
}

func (r *archiveRepositoryProbe) ChangeManyBounded(ctx context.Context, owner string, limit int, change func([]model.Entry) ([]model.Entry, error)) ([]model.Entry, error) {
	if r.beforeChange != nil {
		before := r.beforeChange
		r.beforeChange = nil
		before()
	}
	return r.Repository.ChangeManyBounded(ctx, owner, limit, change)
}
func (r *archiveRepositoryProbe) RecordCleanup(_ context.Context, _ string, key string) error {
	r.debts = append(r.debts, key)
	return r.debtErr
}
func TestArchiveCommitFailureCompensatesAndPreservesErrors(t *testing.T) {
	for _, cleanupFails := range []bool{false, true} {
		t.Run(map[bool]string{false: "删除候选", true: "清理债保留"}[cleanupFails], func(t *testing.T) {
			a, files, repo, content, source, target := archiveServiceFixture(t, DefaultPolicy())
			primary := errors.New("test publication failure")
			repo.fail = primary
			probe := &archiveRepositoryProbe{Repository: repo}
			files.repo = probe
			cleanup := errors.New("test cleanup failure")
			debt := errors.New("test debt failure")
			if cleanupFails {
				content.deleteErr = cleanup
				probe.debtErr = debt
			}
			_, err := a.Extract(context.Background(), "owner", source.ID, archiveExtractInput(source, target, ArchiveReject))
			if !errors.Is(err, primary) {
				t.Fatalf("主要错误丢失: %v", err)
			}
			if len(repo.entries) != 2 {
				t.Fatal("发布失败留下目录项")
			}
			if cleanupFails {
				if !errors.Is(err, cleanup) || !errors.Is(err, debt) || !errors.Is(err, ErrCleanup) || len(probe.debts) != 2 {
					t.Fatalf("补偿错误/清理债丢失: %v %#v", err, probe.debts)
				}
			} else if len(content.objects) != 1 {
				t.Fatal("候选对象未全部补偿")
			}
		})
	}
}
func TestArchiveCommitFencesSourceTargetAndQuotaRaces(t *testing.T) {
	for _, scenario := range []string{"source", "target", "quota"} {
		t.Run(scenario, func(t *testing.T) {
			policy := DefaultPolicy()
			policy.MaxFileBytes = 64
			policy.QuotaBytes = 64
			a, files, repo, content, source, target := archiveServiceFixture(t, policy)
			other, err := files.Folder(context.Background(), "owner", "", "other")
			if err != nil {
				t.Fatal(err)
			}
			probe := &archiveRepositoryProbe{Repository: repo}
			files.repo = probe
			probe.beforeChange = func() {
				if scenario == "quota" {
					if _, err := files.CreateText(context.Background(), "owner", "", "concurrent.txt", strings.Repeat("q", 16), strings.Repeat("q", 60)); err != nil {
						t.Fatal(err)
					}
					return
				}
				repo.mu.Lock()
				defer repo.mu.Unlock()
				for i := range repo.entries {
					if scenario == "source" && repo.entries[i].ID == source.ID {
						repo.entries[i].ContentRevision++
					}
					if scenario == "target" && repo.entries[i].ID == target.ID {
						repo.entries[i].ParentID = other.ID
					}
				}
			}
			_, err = a.Extract(context.Background(), "owner", source.ID, archiveExtractInput(source, target, ArchiveReject))
			expected := model.ErrConflict
			if scenario == "quota" {
				expected = model.ErrQuota
			}
			if !errors.Is(err, expected) {
				t.Fatalf("并发围栏未生效: %v", err)
			}
			expectedEntries, expectedObjects := 3, 1
			if scenario == "quota" {
				expectedEntries++
				expectedObjects++
			}
			if len(repo.entries) != expectedEntries || len(content.objects) != expectedObjects {
				t.Fatal("并发失败留下提取结果或删除了外部成功写入")
			}
		})
	}
}
func TestArchiveSelectedDownloadPreservesBytesAndScope(t *testing.T) {
	a, _, _, _, source, _ := archiveServiceFixture(t, DefaultPolicy())
	content, err := a.Download(context.Background(), "owner", source.ID, 1, "", ArchiveSelection{Mode: ArchiveReadSelected, Paths: []string{"docs"}})
	if err != nil {
		t.Fatal(err)
	}
	reader, err := zip.NewReader(bytes.NewReader(content), int64(len(content)))
	if err != nil {
		t.Fatal(err)
	}
	if len(reader.File) != 2 {
		t.Fatalf("打包选择范围错误: %d", len(reader.File))
	}
	member, err := a.Member(context.Background(), "owner", source.ID, 1, "", "docs/a.txt")
	if err != nil || string(member) != "one" {
		t.Fatalf("成员字节错误: %q %v", member, err)
	}
}
