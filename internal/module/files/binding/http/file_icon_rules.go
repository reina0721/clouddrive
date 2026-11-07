package httpbinding

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/reina0721/clouddrive/internal/module/files/binding/permission"
	"github.com/reina0721/clouddrive/internal/module/files/handler"
	"github.com/reina0721/clouddrive/internal/module/files/service"
)

type fileIconRulesInput struct {
	Body service.FileIconRuleSet
}

type fileIconRulesOutput struct {
	Body struct {
		service.FileIconRulesView
		CanSave bool `json:"canSave"`
	}
}

type activeFileIconsOutput struct {
	Body struct {
		Items []service.FileIconRule `json:"items"`
	}
}

func registerFileIconRules(api huma.API, h *handler.Handler, operation func(string, string, string, string, bool) huma.Operation) {
	read := operation("files.icon-rules.read", http.MethodGet, "/icon-rules", string(permission.SettingsRead), false)
	read.Middlewares = append(read.Middlewares, sharingHeaders)
	huma.Register(api, read, func(ctx context.Context, _ *struct{}) (*fileIconRulesOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, err
		}
		allowed, err := h.FilesystemSettingsAccess.AuthorizeFilesystemSettingsWrite(ctx, owner)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		view, err := h.FileIconRules.Read(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		output := &fileIconRulesOutput{}
		output.Body.FileIconRulesView, output.Body.CanSave = view, allowed
		return output, nil
	})
	save := operation("files.icon-rules.save", http.MethodPut, "/icon-rules", string(permission.SettingsWrite), true)
	save.MaxBodyBytes = 64 << 10
	save.Middlewares = append(save.Middlewares, sharingHeaders)
	huma.Register(api, save, func(ctx context.Context, input *fileIconRulesInput) (*fileIconRulesOutput, error) {
		view, err := h.FileIconRules.Save(ctx, input.Body)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		h.Logger.Info("files.icon-rules.saved")
		output := &fileIconRulesOutput{}
		output.Body.FileIconRulesView, output.Body.CanSave = view, true
		return output, nil
	})
	active := operation("files.icon-rules.active", http.MethodGet, "/icon-rules/active", string(permission.Read), false)
	active.Middlewares = append(active.Middlewares, sharingHeaders)
	huma.Register(api, active, func(ctx context.Context, _ *struct{}) (*activeFileIconsOutput, error) {
		items, err := h.FileIconRules.Active(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		output := &activeFileIconsOutput{}
		output.Body.Items = items
		return output, nil
	})
}
