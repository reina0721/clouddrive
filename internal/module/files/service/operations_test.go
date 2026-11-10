package service

import (
	"archive/zip"
	"bytes"
	"errors"
	"io"
	"sync"
	"testing"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

func TestCopyTreeTextCASAndArchivePreserveIndependentContents(t *testing.T) {
	s, repo, _ := newTestService(t, DefaultPolicy())
	ctx := t.Context()
	root, err := s.Folder(ctx, "owner", "", "源目录")
	root = requireEntry(t, root, err)
	sub, err := s.Folder(ctx, "owner", root.ID, "子目录")
	sub = requireEntry(t, sub, err)
	original, err := s.createSmallContent(ctx, "owner", sub.ID, "说明.md", "copy-source-upload-key", []byte("原始内容"))
	original = requireEntry(t, original, err)
	deleted, err := s.createSmallContent(ctx, "owner", sub.ID, "回收.txt", "copy-trashed-upload-key", []byte("不可复制"))
	deleted = requireEntry(t, deleted, err)
	if _, err := s.Trash(ctx, "owner", deleted.ID); err != nil {
		t.Fatal(err)
	}
	copy, err := s.Copy(ctx, "owner", root.ID, "", "副本")
	copy = requireEntry(t, copy, err)
	listing, err := s.List(ctx, "owner", Query{Search: "说明"})
	if err != nil || len(listing.Items) != 2 {
		t.Fatalf("有效子树副本数量不符: %v", err)
	}
	var duplicate model.Entry
	for _, entry := range listing.Items {
		if entry.ID != original.ID {
			duplicate = entry
		}
	}
	if duplicate.ID == "" || duplicate.ObjectKey != original.ObjectKey || duplicate.UploadKey != "" {
		t.Fatal("复制没有生成独立目录项或泄漏上传幂等键")
	}
	updated, err := s.ReplaceText(ctx, "owner", duplicate.ID, duplicate.ContentRevision, "副本修改")
	updated = requireEntry(t, updated, err)
	if updated.ContentRevision != duplicate.ContentRevision+1 {
		t.Fatal("文本内容版本未递增")
	}
	if _, _, err := s.ReadSmall(ctx, "owner", original.ID, DefaultMaxArchiveBytes); err != nil {
		t.Fatal(err)
	}
	_, content, err := s.ReadSmall(ctx, "owner", original.ID, DefaultMaxArchiveBytes)
	if err != nil || string(content) != "原始内容" {
		t.Fatal("编辑副本破坏了原文件")
	}
	if _, err := s.ReplaceText(ctx, "owner", duplicate.ID, duplicate.ContentRevision, "旧窗口覆盖"); !errors.Is(err, model.ErrConflict) {
		t.Fatalf("旧版本覆盖没有被拒绝: %v", err)
	}
	archive, err := s.Archive(ctx, "owner", []string{copy.ID, duplicate.ID})
	if err != nil {
		t.Fatal(err)
	}
	reader, err := zip.NewReader(bytes.NewReader(archive), int64(len(archive)))
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, entry := range reader.File {
		if entry.Name == "副本/子目录/说明.md" {
			stream, err := entry.Open()
			if err != nil {
				t.Fatal(err)
			}
			payload, readErr := io.ReadAll(stream)
			if err := errors.Join(readErr, stream.Close()); err != nil {
				t.Fatal(err)
			}
			if string(payload) != "副本修改" {
				t.Fatal("ZIP 内容与实际文件不一致")
			}
			found = true
		}
		if entry.Name == "副本/子目录/回收.txt" {
			t.Fatal("ZIP 泄漏了回收内容")
		}
	}
	if !found {
		t.Fatal("ZIP 没有保留相对层级或祖先去重失败")
	}
	before := len(repo.entries)
	if _, err := s.Copy(ctx, "owner", root.ID, sub.ID, "循环副本"); !errors.Is(err, model.ErrConflict) {
		t.Fatalf("复制到后代未拒绝: %v", err)
	}
	if _, err := s.Copy(ctx, "other", root.ID, "", "越权副本"); !errors.Is(err, model.ErrMissing) {
		t.Fatalf("越权复制未拒绝: %v", err)
	}
	if len(repo.entries) != before {
		t.Fatal("失败复制留下部分目录项")
	}
	if _, err := s.Archive(ctx, "other", []string{copy.ID}); !errors.Is(err, model.ErrMissing) {
		t.Fatalf("越权 ZIP 未拒绝: %v", err)
	}
}

func TestCopyBudgetsAndConcurrentTextCAS(t *testing.T) {
	policy := DefaultPolicy()
	policy.MaxBatchEntries = 2
	policy.MaxArchiveBytes = 4
	s, repo, _ := newTestService(t, policy)
	ctx := t.Context()
	root, err := s.Folder(ctx, "owner", "", "root")
	root = requireEntry(t, root, err)
	file, err := s.createSmallContent(ctx, "owner", root.ID, "text.txt", "text-cas-source-key", []byte("initial"))
	file = requireEntry(t, file, err)
	if _, err := s.Folder(ctx, "owner", root.ID, "nested"); err != nil {
		t.Fatal(err)
	}
	before := len(repo.entries)
	if _, err := s.Copy(ctx, "owner", root.ID, "", "too-many"); !errors.Is(err, model.ErrTooLarge) {
		t.Fatalf("复制条目预算未拒绝: %v", err)
	}
	if len(repo.entries) != before {
		t.Fatal("超限复制留下部分树")
	}
	if _, err := s.Archive(ctx, "owner", []string{root.ID}); !errors.Is(err, model.ErrTooLarge) {
		t.Fatalf("打包预算未拒绝: %v", err)
	}
	var wait sync.WaitGroup
	results := make(chan error, 2)
	for _, text := range []string{"writer one", "writer two"} {
		wait.Add(1)
		go func(text string) {
			defer wait.Done()
			_, err := s.ReplaceText(ctx, "owner", file.ID, file.ContentRevision, text)
			results <- err
		}(text)
	}
	wait.Wait()
	close(results)
	success, conflicts := 0, 0
	for err := range results {
		if err == nil {
			success++
		} else if errors.Is(err, model.ErrConflict) {
			conflicts++
		} else {
			t.Fatal(err)
		}
	}
	if success != 1 || conflicts != 1 {
		t.Fatalf("并发 CAS 结果为 %d 成功/%d 冲突", success, conflicts)
	}
	for _, text := range []string{"含\x00字节", string([]byte{0xff})} {
		if _, err := s.ReplaceText(ctx, "owner", file.ID, 2, text); !errors.Is(err, model.ErrInvalid) {
			t.Fatalf("非法文本未拒绝: %v", err)
		}
	}
}

func TestTextReplacementNormalizesRenamedFileMediaType(t *testing.T) {
	s, _, _ := newTestService(t, DefaultPolicy())
	ctx := t.Context()
	entry, err := s.createSmallContent(ctx, "owner", "", "upload.png", "renamed-text-upload-key", []byte("UTF-8 text"))
	entry = requireEntry(t, entry, err)
	name := "editable.txt"
	entry, err = s.Update(ctx, "owner", entry.ID, Change{Name: &name})
	entry = requireEntry(t, entry, err)
	entry, err = s.ReplaceText(ctx, "owner", entry.ID, entry.ContentRevision, "replacement text")
	entry = requireEntry(t, entry, err)
	if entry.MediaType != editedTextMediaType {
		t.Fatal("纯文本替换仍保留旧的图片类型")
	}
	listing, err := s.List(ctx, "owner", Query{Category: "document"})
	if err != nil || len(listing.Items) != 1 {
		t.Fatalf("文本替换后的分类不一致: %v", err)
	}
}

func TestPrivateCodeTextEditingKeepsOriginalJSONMediaType(t *testing.T) {
	s, _, _ := newTestService(t, DefaultPolicy())
	ctx := t.Context()
	entry, err := s.createSmallContent(ctx, "owner", "", "settings.json", "private-code-text-key", []byte(`{"enabled":false}`))
	entry = requireEntry(t, entry, err)
	detail, err := s.Detail(ctx, "owner", entry.ID)
	if err != nil || !detail.TextEditable || editableText(entry) {
		t.Fatalf("代码后缀必须仅扩大私有编辑: %v", err)
	}
	entry, err = s.ReplaceText(ctx, "owner", entry.ID, entry.ContentRevision, `{"enabled":true}`)
	entry = requireEntry(t, entry, err)
	if entry.MediaType != "application/json" || entry.ContentRevision != 2 {
		t.Fatalf("写回后类型或版本不一致: %s/%d", entry.MediaType, entry.ContentRevision)
	}
	if utf8TextMediaType("text/plain; charset=gbk") != editedTextMediaType {
		t.Fatal("UTF-8 内容仍带旧字符集")
	}
}
