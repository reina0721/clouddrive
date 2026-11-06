package model

import "testing"

func TestHistoryPreferencesValidationAndMatching(t *testing.T) {
	defaults := DefaultHistoryPreferences()
	if err := defaults.Validate(); err != nil || !defaults.Matches("no-extension") {
		t.Fatal("无记录默认规则错误", err)
	}
	p := defaults
	p.Extensions = []string{"txt", "md"}
	if !p.Matches("FILE.TXT") || p.Matches("text.md.exe") || p.Matches("no-extension") {
		t.Fatal("扩展名匹配错误")
	}
	for _, extensions := range [][]string{nil, {"TXT"}, {".txt"}, {"txt", "txt"}, {"../txt"}, {"-txt"}} {
		p := defaults
		p.Extensions = extensions
		if p.Validate() == nil {
			t.Fatalf("未拒绝非法扩展名: %+v", extensions)
		}
	}
	for _, count := range []int{-1, MaxFileHistory + 1} {
		p := defaults
		p.MaxVersions = count
		if p.Validate() == nil {
			t.Fatal("未拒绝数量", count)
		}
	}
}
