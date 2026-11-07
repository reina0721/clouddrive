package httpbinding

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/reina0721/clouddrive/internal/module/files/binding/permission"
	"github.com/reina0721/clouddrive/internal/module/files/handler"
	"github.com/reina0721/clouddrive/internal/module/files/service"
)

type storageNameRulesInput struct {
	Body service.StoredStorageNameRules
}

type storageNameRulesOutput struct {
	Body struct {
		service.StorageNameRulesView
		CanSave bool `json:"canSave"`
	}
}

type storageNameCheckInput struct {
	Body struct {
		Name  string                   `json:"name" minLength:"1" maxLength:"255"`
		Rules service.StorageNameRules `json:"rules"`
	}
}

type storageNameCheckOutput struct {
	Body struct {
		Decision service.StorageNameRuleDecision `json:"decision" enum:"allowed,extension,pattern"`
	}
}

func storageNameRulesResponse(view service.StorageNameRulesView, canSave bool) *storageNameRulesOutput {
	result := &storageNameRulesOutput{}
	result.Body.StorageNameRulesView, result.Body.CanSave = view, canSave
	return result
}

func registerStorageNameRules(api huma.API, h *handler.Handler, operation func(string, string, string, string, bool) huma.Operation) {
	const path = "/storage-policy/name-rules"
	read := operation("files.storage-name-rules.read", http.MethodGet, path, string(permission.StoragePolicyRead), false)
	read.Middlewares = append(read.Middlewares, sharingHeaders)
	huma.Register(api, read, func(ctx context.Context, _ *struct{}) (*storageNameRulesOutput, error) {
		actor, err := h.Owner(ctx)
		if err != nil {
			return nil, err
		}
		allowed, err := h.StoragePolicyAccess.AuthorizeStoragePolicyWrite(ctx, actor)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		value, err := h.StorageNameRules.Read(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return storageNameRulesResponse(value, allowed), nil
	})
	save := operation("files.storage-name-rules.save", http.MethodPut, path, string(permission.StoragePolicyWrite), true)
	save.Middlewares = append(save.Middlewares, sharingHeaders)
	huma.Register(api, save, func(ctx context.Context, input *storageNameRulesInput) (*storageNameRulesOutput, error) {
		value, err := h.StorageNameRules.Save(ctx, input.Body)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		h.Logger.Info("files.storage-name-rules.saved")
		return storageNameRulesResponse(value, true), nil
	})
	check := operation("files.storage-name-rules.check", http.MethodPost, path+"/check", string(permission.StoragePolicyWrite), true)
	check.Middlewares = append(check.Middlewares, sharingHeaders)
	huma.Register(api, check, func(ctx context.Context, input *storageNameCheckInput) (*storageNameCheckOutput, error) {
		decision, err := service.PreviewStorageNameRules(input.Body.Name, input.Body.Rules)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		output := &storageNameCheckOutput{}
		output.Body.Decision = decision
		return output, nil
	})
}
