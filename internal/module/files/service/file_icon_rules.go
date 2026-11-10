package service

import (
	"context"
	"fmt"
	"net/url"
	"path"
	"regexp"
	"strings"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

const maxFileIconRules = 32

type FileIconShape string

const (
	FileIconPlain FileIconShape = "file"
	FileIconText  FileIconShape = "text"
	FileIconPhoto FileIconShape = "image"
	FileIconVideo FileIconShape = "video"
	FileIconAudio FileIconShape = "audio"
	FileIconZIP   FileIconShape = "archive"
	FileIconCode  FileIconShape = "code"
	FileIconPDF   FileIconShape = "pdf"
	FileIconSheet FileIconShape = "spreadsheet"
	FileIconURL   FileIconShape = "image-url"
)

type FileIconRule struct {
	Shape      FileIconShape `json:"shape" enum:"file,text,image,video,audio,archive,code,pdf,spreadsheet,image-url"`
	Extensions []string      `json:"extensions" minItems:"1" maxItems:"24"`
	Light      string        `json:"light,omitempty" maxLength:"7"`
	Dark       string        `json:"dark,omitempty" maxLength:"7"`
	ImageURL   string        `json:"imageUrl,omitempty" maxLength:"512"`
}

type FileIconRuleSet struct {
	Revision int64          `json:"revision" minimum:"0"`
	Inherit  bool           `json:"inherit"`
	Items    []FileIconRule `json:"items" maxItems:"32"`
}

type FileIconRulesView struct {
	FileIconRuleSet
	Defaults []FileIconRule `json:"defaults"`
}

type FileIconRulesRepository interface {
	ReadFileIconRules(context.Context) (FileIconRuleSet, error)
	SaveFileIconRules(context.Context, FileIconRuleSet) (FileIconRuleSet, error)
}

type FileIconRules struct {
	repository FileIconRulesRepository
}

func NewFileIconRules(repository FileIconRulesRepository) (*FileIconRules, error) {
	if repository == nil {
		return nil, fmt.Errorf("file icon rules repository is required")
	}
	return &FileIconRules{repository: repository}, nil
}

func defaultFileIconRules() []FileIconRule {
	return []FileIconRule{
		{Shape: FileIconAudio, Extensions: []string{"mp3", "flac", "wav", "ogg", "m4a", "aac"}, Light: "#6d28d9", Dark: "#c4b5fd"},
		{Shape: FileIconVideo, Extensions: []string{"mp4", "webm", "mov", "mkv", "avi", "m4v", "m3u8"}, Light: "#b91c1c", Dark: "#fca5a5"},
		{Shape: FileIconPhoto, Extensions: []string{"png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "heic", "tiff", "bmp"}, Light: "#be185d", Dark: "#f9a8d4"},
		{Shape: FileIconPDF, Extensions: []string{"pdf"}, Light: "#b91c1c", Dark: "#fca5a5"},
		{Shape: FileIconText, Extensions: []string{"txt", "md", "rtf", "doc", "docx", "odt"}, Light: "#1d4ed8", Dark: "#93c5fd"},
		{Shape: FileIconSheet, Extensions: []string{"xls", "xlsx", "csv", "ods"}, Light: "#166534", Dark: "#86efac"},
		{Shape: FileIconZIP, Extensions: []string{"zip", "gz", "xz", "tar", "rar", "7z", "bz2"}, Light: "#92400e", Dark: "#fcd34d"},
		{Shape: FileIconCode, Extensions: []string{"js", "ts", "jsx", "tsx", "py", "go", "rs", "json", "html", "css"}, Light: "#334155", Dark: "#cbd5e1"},
	}
}

var (
	iconExtension = regexp.MustCompile(`^[a-z0-9][a-z0-9_+-]{0,23}$`)
	iconColor     = regexp.MustCompile(`^#[a-f0-9]{6}$`)
	iconHost      = regexp.MustCompile(`^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$`)
)

func allowedIconURL(value string) bool {
	parsed, err := url.Parse(value)
	if err != nil || len(value) > 512 || !strings.HasPrefix(value, "https://") || parsed.User != nil ||
		parsed.Opaque != "" || parsed.RawQuery != "" || parsed.ForceQuery || strings.ContainsAny(value, "#\\") ||
		(parsed.Port() != "" && parsed.Port() != "443") {
		return false
	}
	host := strings.ToLower(parsed.Hostname())
	if !iconHost.MatchString(host) || strings.HasSuffix(host, ".local") || strings.HasSuffix(host, ".localhost") ||
		strings.HasSuffix(host, ".internal") || strings.HasSuffix(host, ".lan") || strings.HasSuffix(host, ".home") ||
		strings.HasSuffix(host, ".onion") {
		return false
	}
	switch strings.ToLower(path.Ext(parsed.Path)) {
	case ".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", ".svg":
		return true
	}
	return false
}

func (v FileIconRuleSet) normalized() (FileIconRuleSet, error) {
	if v.Revision < 0 || v.Revision > model.MaxPreferenceRevision || len(v.Items) > maxFileIconRules ||
		(v.Inherit && len(v.Items) > 0) {
		return FileIconRuleSet{}, model.ErrInvalid
	}
	items := make([]FileIconRule, 0, len(v.Items))
	seen := make(map[string]struct{})
	for _, item := range v.Items {
		if len(item.Extensions) == 0 || len(item.Extensions) > 24 {
			return FileIconRuleSet{}, model.ErrInvalid
		}
		extensions := make([]string, 0, len(item.Extensions))
		for _, raw := range item.Extensions {
			extension := strings.ToLower(strings.TrimPrefix(strings.TrimSpace(raw), "."))
			if _, exists := seen[extension]; exists || !iconExtension.MatchString(extension) {
				return FileIconRuleSet{}, model.ErrInvalid
			}
			seen[extension] = struct{}{}
			extensions = append(extensions, extension)
		}
		item.Extensions = extensions
		item.Light = strings.ToLower(strings.TrimSpace(item.Light))
		item.Dark = strings.ToLower(strings.TrimSpace(item.Dark))
		item.ImageURL = strings.TrimSpace(item.ImageURL)
		switch item.Shape {
		case FileIconURL:
			if item.Light != "" || item.Dark != "" || !allowedIconURL(item.ImageURL) {
				return FileIconRuleSet{}, model.ErrInvalid
			}
		case FileIconPlain, FileIconText, FileIconPhoto, FileIconVideo, FileIconAudio, FileIconZIP, FileIconCode, FileIconPDF, FileIconSheet:
			if item.ImageURL != "" || !iconColor.MatchString(item.Light) ||
				(item.Dark != "" && !iconColor.MatchString(item.Dark)) {
				return FileIconRuleSet{}, model.ErrInvalid
			}
		default:
			return FileIconRuleSet{}, model.ErrInvalid
		}
		items = append(items, item)
	}
	v.Items = items
	return v, nil
}

func (s *FileIconRules) Read(ctx context.Context) (FileIconRulesView, error) {
	stored, err := s.repository.ReadFileIconRules(ctx)
	if err != nil {
		return FileIconRulesView{}, err
	}
	stored, err = stored.normalized()
	return FileIconRulesView{FileIconRuleSet: stored, Defaults: defaultFileIconRules()}, err
}

func (s *FileIconRules) Active(ctx context.Context) ([]FileIconRule, error) {
	view, err := s.Read(ctx)
	if err != nil {
		return nil, err
	}
	if view.Inherit {
		return view.Defaults, nil
	}
	return view.Items, nil
}

func (s *FileIconRules) Save(ctx context.Context, value FileIconRuleSet) (FileIconRulesView, error) {
	normalized, err := value.normalized()
	if err != nil {
		return FileIconRulesView{}, err
	}
	if normalized.Revision == model.MaxPreferenceRevision {
		return FileIconRulesView{}, model.ErrConflict
	}
	stored, err := s.repository.SaveFileIconRules(ctx, normalized)
	if err != nil {
		return FileIconRulesView{}, err
	}
	return FileIconRulesView{FileIconRuleSet: stored, Defaults: defaultFileIconRules()}, nil
}
