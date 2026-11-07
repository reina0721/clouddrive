package httpbinding

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/reina0721/clouddrive/internal/module/files/binding/permission"
	"github.com/reina0721/clouddrive/internal/module/files/handler"
	"github.com/reina0721/clouddrive/internal/module/files/service"
)

type filesystemSettingsInput struct {
	Body service.StoredFilesystemSettings
}

type filesystemSettingsOutput struct {
	Body struct {
		service.FilesystemSettingsView
		CanSave bool `json:"canSave"`
	}
}

func settingsOutput(value service.FilesystemSettingsView, canSave bool) *filesystemSettingsOutput {
	output := &filesystemSettingsOutput{}
	output.Body.FilesystemSettingsView = value
	output.Body.CanSave = canSave
	return output
}

func registerFilesystemSettings(api huma.API, h *handler.Handler, operation func(string, string, string, string, bool) huma.Operation) {
	read := operation("files.settings.read", http.MethodGet, "/settings", string(permission.SettingsRead), false)
	read.Middlewares = append(read.Middlewares, sharingHeaders)
	huma.Register(api, read, func(ctx context.Context, _ *struct{}) (*filesystemSettingsOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, err
		}
		allowed, err := h.FilesystemSettingsAccess.AuthorizeFilesystemSettingsWrite(ctx, owner)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		value, err := h.FilesystemSettings.Read(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return settingsOutput(value, allowed), nil
	})
	save := operation("files.settings.save", http.MethodPut, "/settings", string(permission.SettingsWrite), true)
	save.Middlewares = append(save.Middlewares, sharingHeaders)
	huma.Register(api, save, func(ctx context.Context, input *filesystemSettingsInput) (*filesystemSettingsOutput, error) {
		value, err := h.FilesystemSettings.Save(ctx, input.Body)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		h.Logger.Info("files.settings.saved")
		return settingsOutput(value, true), nil
	})
}
