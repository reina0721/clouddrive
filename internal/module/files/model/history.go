package model

import (
	"encoding/hex"
	"errors"
	"time"
	"unicode"
	"unicode/utf8"
)

const (
	MaxFileHistory                 = 20
	MaxOwnerHistory                = 1000
	MaxHistoryJSONBytes            = (64 << 10) - 1
	MaxContentRevision       int64 = (1 << 53) - 1
	MaxHistoryRevision             = MaxContentRevision
	MaxVersionMediaTypeBytes       = 256
	MaxVersionObjectKeyBytes       = 128
	MaxFileContentBytes      int64 = 512 << 20
)

var ErrHistoryFull = errors.New("file history budget exhausted")

// VersionSnapshot 保存旧内容的不可变关联，不把存储键暴露到公开Entry。
type VersionSnapshot struct {
	Revision   int64     `json:"revision"`
	Name       string    `json:"name"`
	ObjectKey  string    `json:"objectKey"`
	SizeBytes  int64     `json:"sizeBytes"`
	MediaType  string    `json:"mediaType"`
	ContentSHA string    `json:"contentSHA"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

func CurrentSnapshot(entry Entry) VersionSnapshot {
	return VersionSnapshot{Revision: entry.ContentRevision, Name: entry.Name, ObjectKey: entry.ObjectKey, SizeBytes: entry.SizeBytes, MediaType: entry.MediaType, ContentSHA: entry.ContentSHA, UpdatedAt: entry.UpdatedAt}
}

func CloneHistory(history []VersionSnapshot) []VersionSnapshot {
	return append([]VersionSnapshot{}, history...)
}

func HistoryBytes(entry Entry) int64 {
	var total int64
	for _, version := range entry.History {
		total += version.SizeBytes
	}
	return total
}

func HistoryCount(entries []Entry) int {
	total := 0
	for _, entry := range entries {
		total += len(entry.History)
	}
	return total
}

func validVersionText(value string, maxBytes int) bool {
	if !utf8.ValidString(value) || len(value) > maxBytes {
		return false
	}
	for _, r := range value {
		if unicode.IsControl(r) {
			return false
		}
	}
	return true
}

// ValidateHistory 拒绝无法寻址、重复或来自未来的版本；零历史允许旧目录项原样升级。
func ValidateHistory(entry Entry) error {
	if len(entry.History) > MaxFileHistory {
		return ErrHistoryFull
	}
	if entry.HistoryRevision < 0 || entry.HistoryRevision > MaxHistoryRevision {
		return ErrInvalid
	}
	if entry.Kind != File && (len(entry.History) > 0 || entry.HistoryRevision != 0) {
		return ErrInvalid
	}
	seen := make(map[int64]bool, len(entry.History))
	for _, version := range entry.History {
		if version.Revision < 1 || version.Revision >= entry.ContentRevision || version.Revision > MaxContentRevision || seen[version.Revision] || version.SizeBytes < 0 || version.SizeBytes > MaxFileContentBytes || ValidateName(version.Name) != nil || version.ObjectKey == "" || !validVersionText(version.ObjectKey, MaxVersionObjectKeyBytes) || !validVersionText(version.MediaType, MaxVersionMediaTypeBytes) {
			return ErrInvalid
		}
		if version.ContentSHA != "" {
			if len(version.ContentSHA) != 64 {
				return ErrInvalid
			}
			if _, err := hex.DecodeString(version.ContentSHA); err != nil {
				return ErrInvalid
			}
		}
		seen[version.Revision] = true
	}
	return nil
}
