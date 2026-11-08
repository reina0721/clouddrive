package service

import (
	"context"
	"fmt"
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

const maxFileApplicationDefaults = 32

// FileApplicationRule 是内置应用的可用性设置。
type FileApplicationRule struct {
	ID       FileApplicationID       `json:"id" enum:"image,audio,video,pdf,epub,archive,markdown,text"`
	Enabled  bool                    `json:"enabled"`
	Platform FileApplicationPlatform `json:"platform" enum:"all,desktop,mobile"`
}

// FileApplicationItem 声明应用有效设置及典型支持扩展名。
type FileApplicationItem struct {
	FileApplicationRule
	Extensions []string `json:"extensions"`
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
		{FileApplicationRule{FileAppImage, true, FileAppAll}, []string{"png", "jpg", "jpeg", "gif", "webp", "avif"}},
		{FileApplicationRule{FileAppAudio, true, FileAppAll}, []string{"mp3", "ogg", "wav", "flac", "m4a", "aac"}},
		{FileApplicationRule{FileAppVideo, true, FileAppAll}, []string{"mp4", "webm", "ogv"}},
		{FileApplicationRule{FileAppPDF, true, FileAppAll}, []string{"pdf"}},
		{FileApplicationRule{FileAppEPUB, true, FileAppAll}, []string{"epub"}},
		{FileApplicationRule{FileAppArchive, true, FileAppAll}, []string{"zip", "7z"}},
		{FileApplicationRule{FileAppMarkdown, true, FileAppAll}, []string{"md", "markdown"}},
		{FileApplicationRule{FileAppText, true, FileAppAll}, []string{"txt", "md", "markdown", "csv", "json", "xml", "html", "css", "js", "log"}},
	}
}

func builtInFileApplicationDefaults() []FileApplicationDefault {
	return []FileApplicationDefault{{"md", FileAppMarkdown}, {"markdown", FileAppMarkdown}}
}

func (v FileApplicationSettings) effective() (FileApplicationView, error) {
	items := builtInFileApplications()
	if v.Revision < 0 || v.Revision > model.MaxPreferenceRevision ||
		len(v.Apps) > len(items) || len(v.Defaults) > maxFileApplicationDefaults {
		return FileApplicationView{}, model.ErrInvalid
	}
	byID := make(map[FileApplicationID]int, len(items))
	extensionCount := make(map[string]int)
	for index, item := range items {
		byID[item.ID] = index
		for _, extension := range item.Extensions {
			extensionCount[extension]++
		}
	}
	seenApps := make(map[FileApplicationID]bool, len(v.Apps))
	for _, rule := range v.Apps {
		index, exists := byID[rule.ID]
		if !exists || seenApps[rule.ID] || (rule.Platform != FileAppAll && rule.Platform != FileAppDesktop && rule.Platform != FileAppMobile) {
			return FileApplicationView{}, model.ErrInvalid
		}
		seenApps[rule.ID] = true
		items[index].FileApplicationRule = rule
	}
	defaults := make([]FileApplicationDefault, 0, len(v.Defaults))
	seenExtensions := make(map[string]bool, len(v.Defaults))
	for _, rule := range v.Defaults {
		extension := strings.ToLower(strings.TrimPrefix(strings.TrimSpace(rule.Extension), "."))
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
		Revision:              v.Revision, BuiltInDefaults: builtInFileApplicationDefaults(),
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
	stored, err := s.repository.SaveFileApplications(ctx, value)
	if err != nil {
		return FileApplicationView{}, err
	}
	view.Revision = stored.Revision
	return view, nil
}
