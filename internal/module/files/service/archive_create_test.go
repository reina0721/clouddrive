package service

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"slices"
	"testing"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

type zipTestAuthority struct{}

func (zipTestAuthority) AuthorizeArchiveTask(context.Context, string) (bool, error) { return true, nil }

type zipPublicationProbe struct {
	ArchiveTaskRepository
	files      *Service
	candidates []string
	receipt    ArchiveTask
}

func (p *zipPublicationProbe) RecordArchiveCandidates(_ context.Context, _ ArchiveTaskClaim, keys []string) error {
	p.candidates = slices.Clone(keys)
	return nil
}

func (p *zipPublicationProbe) PublishArchiveTask(ctx context.Context, claim ArchiveTaskClaim, limit int, receipt ArchiveTask, validate func([]model.Entry) ([]model.Entry, error)) error {
	_, err := p.files.repo.ChangeManyBounded(ctx, claim.OwnerID, limit, validate)
	if err == nil {
		p.receipt = receipt
	}
	return err
}

func TestBackgroundZIPContentSnapshotAndBudgets(t *testing.T) {
	ctx := t.Context()
	files, repository, _ := newTestService(t, DefaultPolicy())
	root, err := files.Folder(ctx, "owner", "", "源目录")
	root = requireEntry(t, root, err)
	empty, err := files.Folder(ctx, "owner", root.ID, "空目录")
	empty = requireEntry(t, empty, err)
	source, err := files.createSmallContent(ctx, "owner", root.ID, "正文.txt", "zip-test-source-key", []byte("真实 ZIP 内容"))
	source = requireEntry(t, source, err)
	probe := &zipPublicationProbe{files: files}
	tasks := &ArchiveTasks{archives: &Archives{files: files}, repo: probe, accounts: zipTestAuthority{}}
	input := ZIPTaskInput{SourceIDs: []string{root.ID, empty.ID, source.ID}, Name: "发布.zip"}
	encoded, err := json.Marshal(input)
	if err != nil {
		t.Fatal(err)
	}
	_, signature, err := tasks.zipSources(ctx, repository.entries, input.SourceIDs)
	if err != nil {
		t.Fatal(err)
	}
	claim := ArchiveTaskClaim{OwnerID: "owner", Kind: ArchiveTaskZIP, Signature: signature, RequestJSON: string(encoded)}
	if err := tasks.runZIP(ctx, claim); err != nil {
		t.Fatal(err)
	}
	entry, payload, err := files.ReadSmall(ctx, "owner", probe.receipt.ResultEntryID, DefaultMaxArchiveBytes)
	if err != nil || entry.Name != input.Name || !slices.Equal(probe.candidates, []string{entry.ObjectKey}) {
		t.Fatalf("ZIP 发布未记录真实结果与对象: %v", err)
	}
	result, err := zip.NewReader(bytes.NewReader(payload), int64(len(payload)))
	if err != nil {
		t.Fatal(err)
	}
	if len(result.File) != 3 || result.File[0].Name != "源目录/" || result.File[2].Name != "源目录/空目录/" {
		t.Fatal("ZIP 层级、Unicode、空目录或祖先去重失败")
	}
	member := result.File[1]
	if member.Method != zip.Deflate || member.Name != "源目录/正文.txt" {
		t.Fatal("文件未使用标准压缩或路径错误")
	}
	stream, err := member.Open()
	if err != nil {
		t.Fatal(err)
	}
	content, err := io.ReadAll(stream)
	if err := errors.Join(err, stream.Close()); err != nil || string(content) != "真实 ZIP 内容" {
		t.Fatalf("ZIP 字节或 CRC 不匹配: %v", err)
	}

	input.Name = "另一个.zip"
	encoded, err = json.Marshal(input)
	if err != nil {
		t.Fatal(err)
	}
	claim.RequestJSON = string(encoded)
	probe.candidates = nil
	before := len(repository.entries)
	archiveLimit := files.policy.MaxArchiveBytes
	files.policy.MaxArchiveBytes = 100
	if err := tasks.runZIP(ctx, claim); !errors.Is(err, model.ErrTooLarge) {
		t.Fatalf("ZIP 输出超限未被拒绝: %v", err)
	}
	files.policy.MaxArchiveBytes = archiveLimit
	quota := files.policy.QuotaBytes
	files.policy.QuotaBytes = model.Used(repository.entries)
	if err := tasks.runZIP(ctx, claim); !errors.Is(err, model.ErrQuota) {
		t.Fatalf("ZIP 配额未被检查: %v", err)
	}
	files.policy.QuotaBytes = quota
	if _, err := files.ReplaceText(ctx, "owner", source.ID, source.ContentRevision, "已修改"); err != nil {
		t.Fatal(err)
	}
	if err := tasks.runZIP(ctx, claim); !errors.Is(err, model.ErrConflict) || len(probe.candidates) != 0 || len(repository.entries) != before {
		t.Fatalf("已变化来源创建了候选或结果: %v", err)
	}

	malformed := append(slices.Clone(repository.entries), model.Entry{ID: "shortcut", Name: "跳转", Kind: model.Shortcut})
	if _, _, err := tasks.zipSources(ctx, malformed, []string{"shortcut"}); !errors.Is(err, model.ErrUnsupported) {
		t.Fatalf("快捷方式被归档: %v", err)
	}
	colliding := model.Entry{ID: "collision", Name: root.Name, Kind: model.Folder, ParentID: empty.ID}
	malformed = append(malformed, colliding)
	if _, _, err := tasks.zipSources(ctx, malformed, []string{root.ID, colliding.ID}); err != nil {
		t.Fatalf("合法嵌套选择误判冲突: %v", err)
	}
	malformed[len(malformed)-1].ParentID = ""
	if _, _, err := tasks.zipSources(ctx, malformed, []string{root.ID, colliding.ID}); !errors.Is(err, model.ErrConflict) {
		t.Fatalf("包内重名未被拒绝: %v", err)
	}
}
