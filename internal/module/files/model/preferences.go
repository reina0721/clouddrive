package model

import "github.com/reina0721/clouddrive/pkg/idgen"

const MaxPreferenceFolders = 200
const MaxPreferenceRevision int64 = 1<<53 - 1

type FileViewMode string
type FileSortKey string
type FileColumn string

const (
	FileViewGrid      FileViewMode = "grid"
	FileViewList      FileViewMode = "list"
	FileViewGallery   FileViewMode = "gallery"
	FileSortName      FileSortKey  = "name"
	FileSortSize      FileSortKey  = "size"
	FileSortUpdated   FileSortKey  = "updated"
	FileSortCreated   FileSortKey  = "created"
	FileColumnSize    FileColumn   = "size"
	FileColumnKind    FileColumn   = "kind"
	FileColumnUpdated FileColumn   = "updated"
	FileColumnCreated FileColumn   = "created"
	FilePageSmall                  = 50
	FilePageMedium                 = 100
	FilePageLarge                  = 200
	FileColumnCount                = 4
)

type FolderClickAction string

const (
	FolderClickOpen   FolderClickAction = "open"
	FolderClickSelect FolderClickAction = "select"
)

// FileViewPreferences 保存视图语义；不授予目录或内容访问权限。
type FileViewPreferences struct {
	View         FileViewMode `json:"view" enum:"grid,list,gallery"`
	Sort         FileSortKey  `json:"sort" enum:"name,size,updated,created"`
	Desc         bool         `json:"desc"`
	FoldersFirst bool         `json:"foldersFirst"`
	Thumbnails   bool         `json:"thumbnails"`
	PageSize     int          `json:"pageSize" enum:"50,100,200"`
	Columns      []FileColumn `json:"columns" maxItems:"4"`
}

type FolderViewPreferences struct {
	ParentID string              `json:"parentId" maxLength:"36"`
	View     FileViewPreferences `json:"view"`
}

// FilePreferences 的revision用于整个文档CAS；根目录使用空parentId。
type FilePreferences struct {
	Revision        int64                   `json:"revision" minimum:"0" maximum:"9007199254740991"`
	RememberFolders bool                    `json:"rememberFolders"`
	FolderClick     FolderClickAction       `json:"folderClick" enum:"open,select"`
	Defaults        FileViewPreferences     `json:"defaults"`
	Folders         []FolderViewPreferences `json:"folders" maxItems:"200"`
}

func DefaultFilePreferences() FilePreferences {
	return FilePreferences{FolderClick: FolderClickOpen, Defaults: FileViewPreferences{
		View: FileViewGrid, Sort: FileSortName, Thumbnails: true, PageSize: FilePageSmall, Columns: []FileColumn{FileColumnSize, FileColumnUpdated},
	}, Folders: []FolderViewPreferences{}}
}

func (v FileViewPreferences) Validate() error {
	if v.View != FileViewGrid && v.View != FileViewList && v.View != FileViewGallery {
		return ErrInvalid
	}
	if v.Sort != FileSortName && v.Sort != FileSortSize && v.Sort != FileSortUpdated && v.Sort != FileSortCreated {
		return ErrInvalid
	}
	if v.PageSize != FilePageSmall && v.PageSize != FilePageMedium && v.PageSize != FilePageLarge {
		return ErrInvalid
	}
	if v.Columns == nil || len(v.Columns) > FileColumnCount {
		return ErrInvalid
	}
	seen := map[FileColumn]bool{}
	for _, column := range v.Columns {
		if (column != FileColumnSize && column != FileColumnKind && column != FileColumnUpdated && column != FileColumnCreated) || seen[column] {
			return ErrInvalid
		}
		seen[column] = true
	}
	return nil
}

func (p FilePreferences) Validate() error {
	if p.Revision < 0 || p.Revision > MaxPreferenceRevision || (p.FolderClick != FolderClickOpen && p.FolderClick != FolderClickSelect) || p.Folders == nil || len(p.Folders) > MaxPreferenceFolders {
		return ErrInvalid
	}
	if err := p.Defaults.Validate(); err != nil {
		return err
	}
	seen := map[string]bool{}
	for _, folder := range p.Folders {
		if seen[folder.ParentID] || (folder.ParentID != "" && idgen.Validate(folder.ParentID) != nil) {
			return ErrInvalid
		}
		seen[folder.ParentID] = true
		if err := folder.View.Validate(); err != nil {
			return err
		}
	}
	return nil
}
