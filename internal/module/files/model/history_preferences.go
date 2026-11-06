package model

import (
	"path"
	"strings"
)

const MaxHistoryExtensions = 32
const MaxHistoryExtensionBytes = 32

// HistoryPreferences 控制未来内容覆盖；保存规则本身不会移除已有历史。
type HistoryPreferences struct {
	Revision    int64    `json:"revision" minimum:"0" maximum:"9007199254740991"`
	Enabled     bool     `json:"enabled"`
	Extensions  []string `json:"extensions" maxItems:"32"`
	MaxVersions int      `json:"maxVersions" minimum:"0" maximum:"20"`
}

func DefaultHistoryPreferences() HistoryPreferences {
	return HistoryPreferences{Enabled: true, Extensions: []string{}}
}

func (p HistoryPreferences) Validate() error {
	if p.Revision < 0 || p.Revision > MaxPreferenceRevision || p.Extensions == nil || len(p.Extensions) > MaxHistoryExtensions || p.MaxVersions < 0 || p.MaxVersions > MaxFileHistory {
		return ErrInvalid
	}
	seen := map[string]bool{}
	for _, extension := range p.Extensions {
		if len(extension) < 1 || len(extension) > MaxHistoryExtensionBytes || seen[extension] {
			return ErrInvalid
		}
		for i, c := range extension {
			if c >= 'a' && c <= 'z' || c >= '0' && c <= '9' {
				continue
			}
			if i > 0 && (c == '-' || c == '_') {
				continue
			}
			return ErrInvalid
		}
		seen[extension] = true
	}
	return nil
}

// Matches 以最终文件名的最后扩展名匹配；无扩展名只在空筛选时适用。
func (p HistoryPreferences) Matches(name string) bool {
	if !p.Enabled {
		return false
	}
	if len(p.Extensions) == 0 {
		return true
	}
	extension := strings.TrimPrefix(strings.ToLower(path.Ext(name)), ".")
	for _, allowed := range p.Extensions {
		if extension == allowed {
			return true
		}
	}
	return false
}
