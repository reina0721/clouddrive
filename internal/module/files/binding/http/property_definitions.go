package httpbinding

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/reina0721/clouddrive/internal/module/files/binding/permission"
	"github.com/reina0721/clouddrive/internal/module/files/handler"
	"github.com/reina0721/clouddrive/internal/module/files/model"
)

type propertyDefinitionInput struct {
	Body model.PropertyDefinitionSet
}

type propertyDefinitionOutput struct {
	Body struct {
		model.PropertyDefinitionSet
		CanSave bool `json:"canSave"`
	}
}

func propertyDefinitionsOutput(value model.PropertyDefinitionSet, canSave bool) *propertyDefinitionOutput {
	output := &propertyDefinitionOutput{}
	output.Body.PropertyDefinitionSet = value
	output.Body.CanSave = canSave
	return output
}

func registerPropertyDefinitions(api huma.API, h *handler.Handler, operation func(string, string, string, string, bool) huma.Operation) {
	read := operation("files.property-definitions.read", http.MethodGet, "/property-definitions", string(permission.SettingsRead), false)
	read.Middlewares = append(read.Middlewares, sharingHeaders)
	huma.Register(api, read, func(ctx context.Context, _ *struct{}) (*propertyDefinitionOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, err
		}
		allowed, err := h.FilesystemSettingsAccess.AuthorizeFilesystemSettingsWrite(ctx, owner)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		value, err := h.PropertyDefinitions.Read(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return propertyDefinitionsOutput(value, allowed), nil
	})
	save := operation("files.property-definitions.save", http.MethodPut, "/property-definitions", string(permission.SettingsWrite), true)
	save.Middlewares = append(save.Middlewares, sharingHeaders)
	huma.Register(api, save, func(ctx context.Context, input *propertyDefinitionInput) (*propertyDefinitionOutput, error) {
		value, err := h.PropertyDefinitions.Save(ctx, input.Body)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		h.Logger.Info("files.property-definitions.saved")
		return propertyDefinitionsOutput(value, true), nil
	})
}
