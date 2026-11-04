package service

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"io"
	"strings"
	"testing"
)

func versionText(t *testing.T, s *Service, id string, revision int64) string {
	t.Helper()
	var text string
	err := s.DownloadVersionTo(t.Context(), "owner", id, revision, func(_ model.Entry, reader io.ReadSeeker) error {
		content, err := io.ReadAll(reader)
		text = string(content)
		return err
	})
	if err != nil {
		t.Fatal(err)
	}
	return text
}
func TestVersionsRecoveryCopyDeleteAndQuota(t *testing.T) {
	s, _, _ := newTestService(t, DefaultPolicy())
	ctx := t.Context()
	original, err := s.CreateText(ctx, "owner", "", "version.txt", "versions-one-fixture", "abc")
	if err != nil {
		t.Fatal(err)
	}
	updated, err := s.ReplaceText(ctx, "owner", original.ID, 1, "abcdef")
	if err != nil {
		t.Fatal(err)
	}
	page, err := s.Versions(ctx, "owner", original.ID, 1, VersionsNewest)
	if err != nil {
		t.Fatal(err)
	}
	if page.Total != 2 || page.OwnerUsedBytes != 9 || page.FileHistoryBytes != 3 || page.Items[0].Revision != 2 || !page.Items[0].Current || page.HistoryRevision != 1 {
		t.Fatalf("版本和占用错误: %+v", page)
	}
	encoded, err := json.Marshal(page)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(encoded), original.ObjectKey) || strings.Contains(string(encoded), "contentSHA") || strings.Contains(string(encoded), "history_json") {
		t.Fatal("私有存储泄露")
	}
	if versionText(t, s, original.ID, 1) != "abc" {
		t.Fatal("旧版字节错误")
	}
	if _, err := s.ReplaceAnnotations(ctx, "owner", original.ID, AnnotationUpdate{Tags: []model.Tag{{Name: "保留", Color: model.DefaultTagColor}}}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Update(ctx, "owner", original.ID, Change{Name: func() *string { v := "renamed.txt"; return &v }()}); err != nil {
		t.Fatal(err)
	}
	recovered, err := s.RestoreVersion(ctx, "owner", original.ID, 1, VersionMutation{ExpectedContentRevision: updated.ContentRevision, ExpectedHistoryRevision: 1})
	if err != nil {
		t.Fatal(err)
	}
	if recovered.ContentRevision != 3 || recovered.Name != "renamed.txt" || len(recovered.History) != 1 || recovered.History[0].Revision != 2 || recovered.HistoryRevision != 2 || len(recovered.Annotations.Tags) != 1 {
		t.Fatal("提升/恢复前内容或元数据错误")
	}
	if versionText(t, s, original.ID, 3) != "abc" || versionText(t, s, original.ID, 2) != "abcdef" {
		t.Fatal("恢复字节错误")
	}
	page, err = s.Versions(ctx, "owner", original.ID, 1, VersionsNewest)
	if err != nil {
		t.Fatal(err)
	}
	if page.OwnerUsedBytes != 9 {
		t.Fatal("恢复重复计费")
	}
	copy, err := s.Copy(ctx, "owner", original.ID, "", "copy.txt")
	if err != nil {
		t.Fatal(err)
	}
	if copy.ContentRevision != 3 || len(copy.History) != 1 {
		t.Fatal("普通副本未继承历史")
	}
	copyPage, err := s.Versions(ctx, "owner", copy.ID, 1, VersionsNewest)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.DeleteVersions(ctx, "owner", copy.ID, VersionDelete{VersionMutation: VersionMutation{ExpectedContentRevision: copyPage.ContentRevision, ExpectedHistoryRevision: copyPage.HistoryRevision}, Mode: DeleteAllHistory}); err != nil {
		t.Fatal(err)
	}
	if page, err := s.Versions(ctx, "owner", original.ID, 1, VersionsNewest); err != nil || page.Total != 2 {
		t.Fatal("副本清理改变原历史", err)
	}
	saved, err := s.CopyVersion(ctx, "owner", original.ID, 2, VersionCopy{Name: "old-copy.txt"})
	if err != nil {
		t.Fatal(err)
	}
	if saved.ContentRevision != 1 || len(saved.History) != 0 || saved.ObjectKey != updated.ObjectKey || len(saved.Annotations.Tags) != 1 {
		t.Fatal("旧版另存错误")
	}
	before, err := s.Versions(ctx, "owner", original.ID, 1, VersionsNewest)
	if err != nil {
		t.Fatal(err)
	}
	input := VersionDelete{VersionMutation: VersionMutation{ExpectedContentRevision: 3, ExpectedHistoryRevision: 2}, Mode: DeleteSelectedVersions, Revisions: []int64{2, 999}}
	if _, err := s.DeleteVersions(ctx, "owner", original.ID, input); !errors.Is(err, model.ErrMissing) {
		t.Fatal("无效选择未整体拒绝", err)
	}
	after, err := s.Versions(ctx, "owner", original.ID, 1, VersionsNewest)
	if err != nil || after.Total != before.Total {
		t.Fatal("部分清理发生", err)
	}
	input.Revisions = []int64{3}
	if _, err := s.DeleteVersions(ctx, "owner", original.ID, input); !errors.Is(err, model.ErrInvalid) {
		t.Fatal("允许删除当前", err)
	}
	input.Revisions = []int64{2}
	input.ExpectedContentRevision = 2
	if _, err := s.DeleteVersions(ctx, "owner", original.ID, input); !errors.Is(err, model.ErrConflict) {
		t.Fatal("过期内容CAS未拒绝", err)
	}
	input.ExpectedContentRevision = 3
	result, err := s.DeleteVersions(ctx, "owner", original.ID, input)
	if err != nil || result.HistoryRevision != 3 {
		t.Fatal("清理失败", err)
	}
	if _, err := s.Versions(ctx, "other", original.ID, 1, VersionsNewest); !errors.Is(err, model.ErrMissing) {
		t.Fatal("跨账号可读", err)
	}
	if _, err := s.Trash(ctx, "owner", original.ID); err != nil {
		t.Fatal(err)
	}
	if err := s.DownloadVersionTo(ctx, "owner", original.ID, 3, func(model.Entry, io.ReadSeeker) error { return nil }); !errors.Is(err, model.ErrMissing) {
		t.Fatal("回收可绕过", err)
	}
	if _, err := s.Restore(ctx, "owner", original.ID, nil); err != nil {
		t.Fatal(err)
	}
	if versionText(t, s, original.ID, 3) != "abc" {
		t.Fatal("回收恢复内容丢失")
	}
}

func TestVersionsRetentionBoundsAndFullCapacityPromotion(t *testing.T) {
	policy := DefaultPolicy()
	policy.MaxFileBytes = 8
	policy.QuotaBytes = 8
	policy.HistoryPerFile = 1
	policy.HistoryPerOwner = 1
	s, _, _ := newTestService(t, policy)
	ctx := t.Context()
	file, err := s.CreateText(ctx, "owner", "", "budget.txt", "version-budget-fixture", "abc")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.ReplaceText(ctx, "owner", file.ID, 1, "defgh"); err != nil {
		t.Fatal(err)
	}
	if _, err := s.ReplaceText(ctx, "owner", file.ID, 2, ""); !errors.Is(err, model.ErrHistoryFull) {
		t.Fatal("满历史未拒绝", err)
	}
	restored, err := s.RestoreVersion(ctx, "owner", file.ID, 1, VersionMutation{ExpectedContentRevision: 2, ExpectedHistoryRevision: 1})
	if err != nil {
		t.Fatal("满配额与满保留仍应可提升旧关联", err)
	}
	if restored.ContentRevision != 3 || len(restored.History) != 1 || restored.History[0].Revision != 2 {
		t.Fatal("提升历史有误")
	}
	page, err := s.Versions(ctx, "owner", file.ID, 1, VersionsNewest)
	if err != nil || page.OwnerUsedBytes != 8 {
		t.Fatal("满配额恢复增加占用", err)
	}
	s.policy.HistoryEnabled = false
	if _, err := s.ReplaceText(ctx, "owner", file.ID, 3, ""); err != nil {
		t.Fatal("关闭未来保留不应删除已有历史或阻止缩小当前", err)
	}
	page, err = s.Versions(ctx, "owner", file.ID, 1, VersionsNewest)
	if err != nil || page.Total != 2 || page.FileHistoryBytes != 5 || page.OwnerUsedBytes != 5 {
		t.Fatal("关闭策略丢历史或错误计费", err)
	}
}

func TestVersionsPagingCancellationAndMissingContent(t *testing.T) {
	s, _, content := newTestService(t, DefaultPolicy())
	ctx := t.Context()
	file, err := s.CreateText(ctx, "owner", "", "paging.txt", "version-pages-fixture", "0")
	if err != nil {
		t.Fatal(err)
	}
	for revision := int64(1); revision <= 6; revision++ {
		if _, err := s.ReplaceText(ctx, "owner", file.ID, revision, strings.Repeat("x", int(revision))); err != nil {
			t.Fatal(err)
		}
	}
	page, err := s.Versions(ctx, "owner", file.ID, 2, VersionsOldest)
	if err != nil || page.Total != 7 || len(page.Items) != 2 || page.Items[0].Revision != 6 || !page.Items[1].Current {
		t.Fatal("分页顺序错误", err)
	}
	cancelled, cancel := context.WithCancel(ctx)
	cancel()
	if _, err := s.Versions(cancelled, "owner", file.ID, 1, VersionsNewest); !errors.Is(err, context.Canceled) {
		t.Fatal("取消未导出", err)
	}
	content.mu.Lock()
	delete(content.objects, file.ObjectKey)
	content.mu.Unlock()
	if _, err := s.RestoreVersion(ctx, "owner", file.ID, 1, VersionMutation{ExpectedContentRevision: 7, ExpectedHistoryRevision: 6}); err == nil {
		t.Fatal("丢失对象被恢复为当前")
	}
	page, err = s.Versions(ctx, "owner", file.ID, 1, VersionsNewest)
	if err != nil || page.ContentRevision != 7 {
		t.Fatal("失败改变当前", err)
	}
}

func TestVersionsPromotionAfterRetentionLimitsReduced(t *testing.T) {
	s, _, _ := newTestService(t, DefaultPolicy())
	file, err := s.CreateText(t.Context(), "owner", "", "reduced.txt", "version-reduced-fixture", "one")
	if err != nil {
		t.Fatal(err)
	}
	for revision := int64(1); revision <= 3; revision++ {
		if _, err := s.ReplaceText(t.Context(), "owner", file.ID, revision, "next"); err != nil {
			t.Fatal(err)
		}
	}
	s.policy.HistoryPerFile = 1
	s.policy.HistoryPerOwner = 1
	restored, err := s.RestoreVersion(t.Context(), "owner", file.ID, 1, VersionMutation{ExpectedContentRevision: 4, ExpectedHistoryRevision: 3})
	if err != nil {
		t.Fatal("降低新增预算不应禁止等量提升", err)
	}
	if len(restored.History) != 3 || restored.ContentRevision != 5 {
		t.Fatal("恢复丢失历史或增加关联")
	}
	if _, err := s.ReplaceText(t.Context(), "owner", file.ID, 5, "new"); !errors.Is(err, model.ErrHistoryFull) {
		t.Fatal("降低预算后仍允许增加", err)
	}
}
