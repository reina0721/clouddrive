package service

import (
	"errors"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"testing"
)

func TestHistoryPreferencesReplacementAndQuota(t *testing.T) {
	policy := DefaultPolicy()
	policy.QuotaBytes = policy.MaxFileBytes
	s, repo, _ := newTestService(t, policy)
	prefs := model.DefaultHistoryPreferences()
	prefs.MaxVersions = 2
	prefs.Extensions = []string{"txt"}
	repo.historyPreferences = map[string]model.HistoryPreferences{"owner": prefs}
	entry, err := s.CreateText(t.Context(), "owner", "", "NOTES.TXT", "retention-fixture-key", "first")
	entry = requireEntry(t, entry, err)
	for _, text := range []string{"second", "third", "fourth"} {
		entry, err = s.ReplaceText(t.Context(), "owner", entry.ID, entry.ContentRevision, text)
		entry = requireEntry(t, entry, err)
	}
	if len(entry.History) != 2 || entry.History[0].Revision != 2 || entry.History[1].Revision != 3 {
		t.Fatalf("没有保留最近两个旧版本: %+v", entry.History)
	}
	page, err := s.Versions(t.Context(), "owner", entry.ID, 1, VersionsNewest)
	if err != nil || !page.HistoryApplies || page.OwnerUsedBytes != int64(len("second")+len("third")+len("fourth")) {
		t.Fatalf("保留裁剪后的配额或生效规则错误: %+v %v", page, err)
	}
	prefs.Enabled = false
	repo.historyPreferences["owner"] = prefs
	before := entry.HistoryRevision
	entry, err = s.ReplaceText(t.Context(), "owner", entry.ID, entry.ContentRevision, "fifth")
	entry = requireEntry(t, entry, err)
	if len(entry.History) != 2 || entry.HistoryRevision != before {
		t.Fatal("关闭未来保留清理了已有历史")
	}
	restored, err := s.RestoreVersion(t.Context(), "owner", entry.ID, 2, VersionMutation{ExpectedContentRevision: entry.ContentRevision, ExpectedHistoryRevision: entry.HistoryRevision})
	if err != nil || len(restored.History) != 2 {
		t.Fatalf("关闭后恢复不应丢弃恢复前内容: %v", err)
	}
}

func TestHistoryPreferencesFailureLeavesHistoryAndOtherOwners(t *testing.T) {
	s, repo, _ := newTestService(t, DefaultPolicy())
	prefs := model.DefaultHistoryPreferences()
	prefs.MaxVersions = 1
	repo.historyPreferences = map[string]model.HistoryPreferences{"owner": prefs}
	entry, err := s.CreateText(t.Context(), "owner", "", "notes.txt", "retention-atomic-key", "first")
	entry = requireEntry(t, entry, err)
	entry, err = s.ReplaceText(t.Context(), "owner", entry.ID, 1, "second")
	entry = requireEntry(t, entry, err)
	sentinel := errors.New("repository failed")
	repo.fail = sentinel
	if _, err := s.ReplaceText(t.Context(), "owner", entry.ID, 2, "third"); !errors.Is(err, sentinel) {
		t.Fatalf("底层错误没有保留: %v", err)
	}
	repo.fail = nil
	stored, err := repo.Read(t.Context(), "owner")
	if err != nil || len(stored) != 1 || stored[0].ContentRevision != 2 || stored[0].History[0].Revision != 1 {
		t.Fatal("失败覆盖改变了原历史")
	}
	other, err := s.CreateText(t.Context(), "other", "", "other.txt", "retention-other-key", "first")
	other = requireEntry(t, other, err)
	for _, text := range []string{"second", "third"} {
		other, err = s.ReplaceText(t.Context(), "other", other.ID, other.ContentRevision, text)
		other = requireEntry(t, other, err)
	}
	if len(other.History) != 2 {
		t.Fatal("账号规则泄漏到其他拥有者")
	}
}

func TestHistoryPreferencesBudgetAndExtensionBoundaries(t *testing.T) {
	s, _, _ := newTestService(t, DefaultPolicy())
	p := model.DefaultHistoryPreferences()
	p.MaxVersions = 1
	entry := model.Entry{ID: "entry", Kind: model.File, Name: "a.txt", ObjectKey: "current", ContentRevision: 3, HistoryRevision: 2, History: []model.VersionSnapshot{{Revision: 1, Name: "a.txt", ObjectKey: "first"}, {Revision: 2, Name: "a.txt", ObjectKey: "second"}}}
	prepared, err := s.prepareReplacement([]model.Entry{entry}, entry, p)
	if err != nil || len(prepared.History) != 1 || prepared.History[0].Revision != 3 || len(entry.History) != 2 {
		t.Fatal("裁剪必须在副本执行并保留最近旧当前", err)
	}
	p.Extensions = []string{"md"}
	prepared, err = s.prepareReplacement([]model.Entry{entry}, entry, p)
	if err != nil || len(prepared.History) != 2 || prepared.HistoryRevision != 2 {
		t.Fatal("不匹配扩展名不应删除旧历史", err)
	}
	p.Extensions = []string{}
	p.MaxVersions = 0
	s.policy.HistoryPerFile = 2
	if _, err := s.prepareReplacement([]model.Entry{entry}, entry, p); !errors.Is(err, model.ErrHistoryFull) {
		t.Fatal("0不能绕过服务器预算", err)
	}
	p.MaxVersions = 2
	if _, err := s.prepareReplacement([]model.Entry{entry}, entry, p); err != nil {
		t.Fatal("显式数量裁剪后应允许继续覆盖", err)
	}
}
