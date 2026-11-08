package service

import (
	"context"
	"fmt"
	"regexp"
	"slices"
	"strings"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

// FileApplicationID 标识已有的内置文件渲染器。
type FileApplicationID string

const (
	FileAppImage    FileApplicationID = "image"
	FileAppAudio    FileApplicationID = "audio"
	FileAppVideo    FileApplicationID = "video"
	FileAppPDF      FileApplicationID = "pdf"
	FileAppEPUB     FileApplicationID = "epub"
	FileAppArchive  FileApplicationID = "archive"
	FileAppMarkdown FileApplicationID = "markdown"
	FileAppText     FileApplicationID = "text"
)

// FileApplicationPlatform 表示浏览器打开入口允许的显示平台。
type FileApplicationPlatform string

const (
	FileAppAll     FileApplicationPlatform = "all"
	FileAppDesktop FileApplicationPlatform = "desktop"
	FileAppMobile  FileApplicationPlatform = "mobile"
)

const (
	maxFileApplicationDefaults   = 32
	maxFileApplicationExtensions = 48
)

var fileApplicationExtension = regexp.MustCompile(`^[a-z0-9][a-z0-9_+-]{0,23}$`)

// FileApplicationAvailability 是内置应用的可用性设置。
type FileApplicationAvailability struct {
	ID       FileApplicationID       `json:"id" enum:"image,audio,video,pdf,epub,archive,markdown,text"`
	Enabled  bool                    `json:"enabled"`
	Platform FileApplicationPlatform `json:"platform" enum:"all,desktop,mobile"`
}

// FileApplicationRule 追加可选的扩展名覆盖，空数组表示没有关联。
type FileApplicationRule struct {
	FileApplicationAvailability
	Extensions *[]string `json:"extensions,omitempty" maxItems:"48"`
}

// FileApplicationItem 声明应用有效设置及扩展名来源。
type FileApplicationItem struct {
	FileApplicationAvailability
	Extensions       []string `json:"extensions"`
	CustomExtensions bool     `json:"customExtensions"`
}

// FileApplicationDefault 对具有多个候选的扩展名指定默认应用。
type FileApplicationDefault struct {
	Extension string            `json:"extension" minLength:"1" maxLength:"32"`
	App       FileApplicationID `json:"app" enum:"image,audio,video,pdf,epub,archive,markdown,text"`
}

// FileApplicationSettings 保存完整草稿，应用规则可以省略采用内置可用性的条目。
type FileApplicationSettings struct {
	Revision int64                    `json:"revision" minimum:"0"`
	Apps     []FileApplicationRule    `json:"apps" maxItems:"8"`
	Defaults []FileApplicationDefault `json:"defaults" maxItems:"32"`
}

// FileApplicationPolicy 是本人文件页读取的有效策略。
type FileApplicationPolicy struct {
	Items    []FileApplicationItem    `json:"items"`
	Defaults []FileApplicationDefault `json:"defaults"`
}

// FileApplicationView 包含管理员恢复内置设置及并发保存所需信息。
type FileApplicationView struct {
	FileApplicationPolicy
	Revision        int64                    `json:"revision"`
	BuiltInDefaults []FileApplicationDefault `json:"builtInDefaults"`
	BuiltInItems    []FileApplicationItem    `json:"builtInItems"`
}

// FileApplicationsRepository 负责在文件设置存储中按修订替换策略。
type FileApplicationsRepository interface {
	ReadFileApplications(context.Context) (FileApplicationSettings, error)
	SaveFileApplications(context.Context, FileApplicationSettings) (FileApplicationSettings, error)
}

// FileApplications 管理内置渲染器可用性与默认打开方式。
type FileApplications struct {
	repository FileApplicationsRepository
}

// NewFileApplications 装配文件应用设置服务。
func NewFileApplications(repository FileApplicationsRepository) (*FileApplications, error) {
	if repository == nil {
		return nil, fmt.Errorf("file applications repository is required")
	}
	return &FileApplications{repository: repository}, nil
}

func builtInFileApplications() []FileApplicationItem {
	return []FileApplicationItem{
		{FileApplicationAvailability: FileApplicationAvailability{FileAppImage, true, FileAppAll}, Extensions: []string{"png", "jpg", "jpeg", "gif", "webp", "avif"}},
		{FileApplicationAvailability: FileApplicationAvailability{FileAppAudio, true, FileAppAll}, Extensions: []string{"mp3", "ogg", "wav", "flac", "m4a", "aac"}},
		{FileApplicationAvailability: FileApplicationAvailability{FileAppVideo, true, FileAppAll}, Extensions: []string{"mp4", "webm", "ogv"}},
		{FileApplicationAvailability: FileApplicationAvailability{FileAppPDF, true, FileAppAll}, Extensions: []string{"pdf"}},
		{FileApplicationAvailability: FileApplicationAvailability{FileAppEPUB, true, FileAppAll}, Extensions: []string{"epub"}},
		{FileApplicationAvailability: FileApplicationAvailability{FileAppArchive, true, FileAppAll}, Extensions: []string{"zip", "7z"}},
		{FileApplicationAvailability: FileApplicationAvailability{FileAppMarkdown, true, FileAppAll}, Extensions: []string{"md", "markdown"}},
		{FileApplicationAvailability: FileApplicationAvailability{FileAppText, true, FileAppAll}, Extensions: []string{"txt", "md", "markdown", "csv", "json", "xml", "html", "css", "js", "log"}},
	}
}

func builtInFileApplicationDefaults() []FileApplicationDefault {
	return []FileApplicationDefault{{"md", FileAppMarkdown}, {"markdown", FileAppMarkdown}}
}

func normalizeFileApplicationExtension(value string) string {
	return strings.ToLower(strings.TrimPrefix(strings.TrimSpace(value), "."))
}

func normalizeFileApplicationExtensions(values []string) ([]string, error) {
	if len(values) > maxFileApplicationExtensions {
		return nil, model.ErrInvalid
	}
	result := make([]string, 0, len(values))
	seen := make(map[string]bool, len(values))
	for _, value := range values {
		extension := normalizeFileApplicationExtension(value)
		if seen[extension] || !fileApplicationExtension.MatchString(extension) {
			return nil, model.ErrInvalid
		}
		seen[extension] = true
		result = append(result, extension)
	}
	return result, nil
}

func (v FileApplicationSettings) effective() (FileApplicationView, error) {
	builtIns := builtInFileApplications()
	items := slices.Clone(builtIns)
	if v.Revision < 0 || v.Revision > model.MaxPreferenceRevision ||
		len(v.Apps) > len(items) || len(v.Defaults) > maxFileApplicationDefaults {
		return FileApplicationView{}, model.ErrInvalid
	}
	byID := make(map[FileApplicationID]int, len(items))
	for index, item := range items {
		byID[item.ID] = index
	}
	seenApps := make(map[FileApplicationID]bool, len(v.Apps))
	for _, rule := range v.Apps {
		index, exists := byID[rule.ID]
		if !exists || seenApps[rule.ID] || (rule.Platform != FileAppAll && rule.Platform != FileAppDesktop && rule.Platform != FileAppMobile) {
			return FileApplicationView{}, model.ErrInvalid
		}
		seenApps[rule.ID] = true
		items[index].FileApplicationAvailability = rule.FileApplicationAvailability
		if rule.Extensions != nil {
			extensions, err := normalizeFileApplicationExtensions(*rule.Extensions)
			if err != nil {
				return FileApplicationView{}, err
			}
			items[index].Extensions = extensions
			items[index].CustomExtensions = true
		}
	}
	extensionCount := make(map[string]int)
	for _, item := range items {
		for _, extension := range item.Extensions {
			extensionCount[extension]++
		}
	}
	defaults := make([]FileApplicationDefault, 0, len(v.Defaults))
	seenExtensions := make(map[string]bool, len(v.Defaults))
	for _, rule := range v.Defaults {
		extension := normalizeFileApplicationExtension(rule.Extension)
		index, exists := byID[rule.App]
		if !exists || seenExtensions[extension] || extensionCount[extension] < 2 ||
			!items[index].Enabled || !slices.Contains(items[index].Extensions, extension) {
			return FileApplicationView{}, model.ErrInvalid
		}
		seenExtensions[extension] = true
		defaults = append(defaults, FileApplicationDefault{Extension: extension, App: rule.App})
	}
	return FileApplicationView{
		FileApplicationPolicy: FileApplicationPolicy{Items: items, Defaults: defaults},
		Revision:              v.Revision, BuiltInDefaults: builtInFileApplicationDefaults(), BuiltInItems: builtIns,
	}, nil
}

// Read 返回当前有效规则，首次使用采用内置默认。
func (s *FileApplications) Read(ctx context.Context) (FileApplicationView, error) {
	stored, err := s.repository.ReadFileApplications(ctx)
	if err != nil {
		return FileApplicationView{}, err
	}
	if stored.Revision == 0 {
		stored.Defaults = builtInFileApplicationDefaults()
	}
	return stored.effective()
}

// Save 校验完整草稿，保留底层并发错误及原始原因。
func (s *FileApplications) Save(ctx context.Context, value FileApplicationSettings) (FileApplicationView, error) {
	view, err := value.effective()
	if err != nil {
		return FileApplicationView{}, err
	}
	if value.Revision == model.MaxPreferenceRevision {
		return FileApplicationView{}, model.ErrConflict
	}
	value.Defaults = view.Defaults
	value.Apps = make([]FileApplicationRule, 0, len(view.Items))
	for _, item := range view.Items {
		if item.Enabled && item.Platform == FileAppAll && !item.CustomExtensions {
			continue
		}
		rule := FileApplicationRule{FileApplicationAvailability: item.FileApplicationAvailability}
		if item.CustomExtensions {
			rule.Extensions = &item.Extensions
		}
		value.Apps = append(value.Apps, rule)
	}
	stored, err := s.repository.SaveFileApplications(ctx, value)
	if err != nil {
		return FileApplicationView{}, err
	}
	view.Revision = stored.Revision
	return view, nil
}
