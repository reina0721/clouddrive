// Package model 定义私有文件目录的持久化事实与业务不变量。
package model

import (
	"errors"
	"path"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

type Kind string

const (
	File     Kind = "file"
	Folder   Kind = "folder"
	Shortcut Kind = "shortcut"
)
const MaxNameRunes = 255

var (
	ErrInvalid     = errors.New("invalid file input")
	ErrMissing     = errors.New("file not accessible")
	ErrConflict    = errors.New("file conflict")
	ErrQuota       = errors.New("file quota exceeded")
	ErrTooLarge    = errors.New("file size exceeded")
	ErrBusy        = errors.New("file upload busy")
	ErrUnsupported = errors.New("file operation not supported for this kind")
)

// Entry 保存单个目录项；ObjectKey 和幂等校验信息永不对外输出。
type Entry struct {
	ID                 string      `json:"id"`
	OwnerID            string      `json:"-"`
	ParentID           string      `json:"parentId"`
	Kind               Kind        `json:"kind"`
	Name               string      `json:"name"`
	NormalizedName     string      `json:"-"`
	ObjectKey          string      `json:"-"`
	SizeBytes          int64       `json:"sizeBytes"`
	MediaType          string      `json:"mediaType"`
	CreatedAt          time.Time   `json:"createdAt"`
	UpdatedAt          time.Time   `json:"updatedAt"`
	TrashedAt          *time.Time  `json:"trashedAt"`
	UploadKey          string      `json:"-"`
	ContentSHA         string      `json:"-"`
	ContentRevision    int64       `json:"contentRevision"`
	ShareToken         string      `json:"-"`
	Annotations        Annotations `json:"-"`
	AnnotationRevision int64       `json:"-"`
}

// ValidateName 不把用户名称解释为路径，并限制名称的字符与长度。
func ValidateName(name string) error {
	if name == "" || strings.TrimSpace(name) != name || name == "." || name == ".." || !utf8.ValidString(name) || utf8.RuneCountInString(name) > MaxNameRunes {
		return ErrInvalid
	}
	for _, r := range name {
		if unicode.IsControl(r) || r == '/' || r == '\\' {
			return ErrInvalid
		}
	}
	return nil
}

func Find(entries []Entry, id string) (Entry, bool) {
	for _, entry := range entries {
		if entry.ID == id {
			return entry, true
		}
	}
	return Entry{}, false
}

// Visible 同时检查祖先，保证回收目录的子项不可绕过目录直接读取。
func Visible(entries []Entry, entry Entry) bool {
	for remaining := len(entries) + 1; remaining > 0; remaining-- {
		if entry.TrashedAt != nil {
			return false
		}
		if entry.ParentID == "" {
			return true
		}
		parent, ok := Find(entries, entry.ParentID)
		if !ok || parent.Kind != Folder {
			return false
		}
		entry = parent
	}
	return false
}
func Parent(entries []Entry, id string) error {
	if id == "" {
		return nil
	}
	entry, ok := Find(entries, id)
	if !ok || entry.Kind != Folder || !Visible(entries, entry) {
		return ErrMissing
	}
	return nil
}
func Available(entries []Entry, id, parent, normalized string) error {
	for _, entry := range entries {
		if entry.ID != id && entry.ParentID == parent && entry.TrashedAt == nil && entry.NormalizedName == normalized {
			return ErrConflict
		}
	}
	return nil
}
func Used(entries []Entry) int64 {
	var used int64
	for _, entry := range entries {
		used += entry.SizeBytes
	}
	return used
}
func Category(entry Entry) string {
	switch {
	case strings.HasPrefix(entry.MediaType, "image/"):
		return "image"
	case strings.HasPrefix(entry.MediaType, "video/"):
		return "video"
	case strings.HasPrefix(entry.MediaType, "audio/"):
		return "audio"
	case strings.HasPrefix(entry.MediaType, "text/") || entry.MediaType == "application/pdf":
		return "document"
	}
	switch strings.ToLower(path.Ext(entry.Name)) {
	case ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".odt", ".csv", ".md":
		return "document"
	}
	return "other"
}
