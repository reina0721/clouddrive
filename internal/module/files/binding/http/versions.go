package httpbinding

import (
	"context"
	"github.com/danielgtaylor/huma/v2"
	"github.com/reina0721/clouddrive/internal/module/files/handler"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"io"
	"net/http"
)

type versionListInput struct {
	ID    string               `path:"id" minLength:"1" maxLength:"36"`
	Page  int                  `query:"page" default:"1" minimum:"1" maximum:"21"`
	Order service.VersionOrder `query:"order" default:"newest" enum:"newest,oldest"`
}
type versionListOutput struct{ Body service.VersionPage }
type versionPathInput struct {
	ID       string `path:"id" minLength:"1" maxLength:"36"`
	Revision int64  `path:"revision" minimum:"1" maximum:"9007199254740991"`
}
type versionRestoreInput struct {
	ID       string `path:"id" minLength:"1" maxLength:"36"`
	Revision int64  `path:"revision" minimum:"1" maximum:"9007199254740991"`
	Body     service.VersionMutation
}
type versionCopyInput struct {
	ID       string `path:"id" minLength:"1" maxLength:"36"`
	Revision int64  `path:"revision" minimum:"1" maximum:"9007199254740991"`
	Body     service.VersionCopy
}
type versionDeleteInput struct {
	ID   string `path:"id" minLength:"1" maxLength:"36"`
	Body service.VersionDelete
}
type versionMutationOutput struct{ Body service.VersionMutationResult }

func registerVersions(api huma.API, h *handler.Handler, operation func(string, string, string, string, bool) huma.Operation) {
	huma.Register(api, operation("files.versions.list", http.MethodGet, "/{id}/versions", "files:read", false), func(ctx context.Context, input *versionListInput) (*versionListOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		page, err := h.Service.Versions(ctx, owner, input.ID, input.Page, input.Order)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &versionListOutput{Body: page}, nil
	})
	for _, method := range []string{http.MethodGet, http.MethodHead} {
		id := "files.versions.content"
		if method == http.MethodHead {
			id = "files.versions.content.head"
		}
		download := transferBudget(operation(id, method, "/{id}/versions/{revision}/content", "files:read", false))
		download.Middlewares = append(download.Middlewares, transferAdmission(h))
		download.Responses = map[string]*huma.Response{"200": {Description: "指定版本的原始内容和字节范围", Content: map[string]*huma.MediaType{"application/octet-stream": {Schema: &huma.Schema{Type: "string", Format: "binary"}}}}}
		huma.Register(api, download, func(ctx context.Context, input *versionPathInput) (*contentOutput, error) {
			owner, err := h.Owner(ctx)
			if err != nil {
				return nil, h.Present(ctx, err)
			}
			return contentResponse(ctx, h, func(ctx context.Context, use func(model.Entry, io.ReadSeeker) error) error {
				return h.Service.DownloadVersionTo(ctx, owner, input.ID, input.Revision, use)
			}), nil
		})
	}
	huma.Register(api, operation("files.versions.restore", http.MethodPost, "/{id}/versions/{revision}/restore", "files:write", true), func(ctx context.Context, input *versionRestoreInput) (*entryOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		entry, err := h.Service.RestoreVersion(ctx, owner, input.ID, input.Revision, input.Body)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		h.Logger.Info("files.version.restore.completed")
		return &entryOutput{Body: entry}, nil
	})
	huma.Register(api, operation("files.versions.copy", http.MethodPost, "/{id}/versions/{revision}/copy", "files:write", true), func(ctx context.Context, input *versionCopyInput) (*entryOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		entry, err := h.Service.CopyVersion(ctx, owner, input.ID, input.Revision, input.Body)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		h.Logger.Info("files.version.copy.completed")
		return &entryOutput{Body: entry}, nil
	})
	huma.Register(api, operation("files.versions.delete", http.MethodDelete, "/{id}/versions", "files:write", true), func(ctx context.Context, input *versionDeleteInput) (*versionMutationOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		value, err := h.Service.DeleteVersions(ctx, owner, input.ID, input.Body)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		h.Logger.Info("files.version.delete.completed")
		return &versionMutationOutput{Body: value}, nil
	})
}
