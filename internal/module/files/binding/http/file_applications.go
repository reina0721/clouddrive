package httpbinding

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/reina0721/clouddrive/internal/module/files/binding/permission"
	"github.com/reina0721/clouddrive/internal/module/files/handler"
	"github.com/reina0721/clouddrive/internal/module/files/service"
)

type fileApplicationInput struct {
	Body service.FileApplicationSettings
}

type fileApplicationOutput struct {
	Body struct {
		service.FileApplicationView
		CanSave bool `json:"canSave"`
	}
}

type activeFileApplicationsOutput struct {
	Body service.FileApplicationPolicy
}

func registerFileApplications(api huma.API, h *handler.Handler, operation func(string, string, string, string, bool) huma.Operation) {
	read := operation("files.applications.read", http.MethodGet, "/applications", string(permission.SettingsRead), false)
	read.Middlewares = append(read.Middlewares, sharingHeaders)
	huma.Register(api, read, func(ctx context.Context, _ *struct{}) (*fileApplicationOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, err
		}
		allowed, err := h.FilesystemSettingsAccess.AuthorizeFilesystemSettingsWrite(ctx, owner)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		view, err := h.FileApplications.Read(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		output := &fileApplicationOutput{}
		output.Body.FileApplicationView, output.Body.CanSave = view, allowed
		return output, nil
	})
	save := operation("files.applications.save", http.MethodPut, "/applications", string(permission.SettingsWrite), true)
	save.MaxBodyBytes = 256 << 10
	save.Middlewares = append(save.Middlewares, sharingHeaders)
	huma.Register(api, save, func(ctx context.Context, input *fileApplicationInput) (*fileApplicationOutput, error) {
		view, err := h.FileApplications.Save(ctx, input.Body)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		h.Logger.Info("files.applications.saved")
		output := &fileApplicationOutput{}
		output.Body.FileApplicationView, output.Body.CanSave = view, true
		return output, nil
	})
	active := operation("files.applications.active", http.MethodGet, "/applications/active", string(permission.Read), false)
	active.Middlewares = append(active.Middlewares, sharingHeaders)
	huma.Register(api, active, func(ctx context.Context, _ *struct{}) (*activeFileApplicationsOutput, error) {
		view, err := h.FileApplications.Read(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &activeFileApplicationsOutput{Body: view.FileApplicationPolicy}, nil
	})
	registerWebFilePreviews(api, h, operation)
	registerWOPI(api, h, operation)
}
