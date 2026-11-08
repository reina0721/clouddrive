package repo

import (
	"context"

	"github.com/reina0721/clouddrive/internal/module/files/service"
)

const fileApplicationsID = "file-applications"

type fileApplicationsRecord struct {
	Apps     []service.FileApplicationRule    `json:"apps"`
	Defaults []service.FileApplicationDefault `json:"defaults"`
	WebApps  []service.WebFileApplication     `json:"webApps,omitempty"`
}

// ReadFileApplications 读取独立的内置应用策略记录。
func (r *Repository) ReadFileApplications(ctx context.Context) (service.FileApplicationSettings, error) {
	revision, value, err := readFileSettings[fileApplicationsRecord](ctx, r, fileApplicationsID)
	return service.FileApplicationSettings{Revision: revision, Apps: value.Apps, Defaults: value.Defaults, WebApps: value.WebApps}, err
}

// SaveFileApplications 复用文件设置事务和修订围栏。
func (r *Repository) SaveFileApplications(ctx context.Context, value service.FileApplicationSettings) (service.FileApplicationSettings, error) {
	expected := value.Revision
	value.Revision++
	return value, r.saveFileSettings(ctx, fileApplicationsID, expected, value.Revision,
		fileApplicationsRecord{Apps: value.Apps, Defaults: value.Defaults, WebApps: value.WebApps})
}
