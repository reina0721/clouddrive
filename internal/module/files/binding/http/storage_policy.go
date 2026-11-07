package httpbinding

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/reina0721/clouddrive/internal/module/files/binding/permission"
	"github.com/reina0721/clouddrive/internal/module/files/handler"
	"github.com/reina0721/clouddrive/internal/module/files/service"
)

type storagePolicyInput struct{ Body service.StoredStoragePolicy }

type storagePolicyOutput struct {
	Body struct {
		service.StoragePolicyView
		CanSave bool `json:"canSave"`
	}
}

type storageUsageOutput struct{ Body service.StorageUsageSnapshot }

func storagePolicyResponse(view service.StoragePolicyView, canSave bool) *storagePolicyOutput {
	result := &storagePolicyOutput{}
	result.Body.StoragePolicyView, result.Body.CanSave = view, canSave
	return result
}

func registerStoragePolicy(api huma.API, h *handler.Handler, operation func(string, string, string, string, bool) huma.Operation) {
	const path = "/storage-policy"
	read := operation("files.storage-policy.read", http.MethodGet, path, string(permission.StoragePolicyRead), false)
	read.Middlewares = append(read.Middlewares, sharingHeaders)
	huma.Register(api, read, func(ctx context.Context, _ *struct{}) (*storagePolicyOutput, error) {
		actor, err := h.Owner(ctx)
		if err != nil {
			return nil, err
		}
		allowed, err := h.StoragePolicyAccess.AuthorizeStoragePolicyWrite(ctx, actor)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		value, err := h.StoragePolicy.Read(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return storagePolicyResponse(value, allowed), nil
	})
	usage := operation("files.storage-policy.usage", http.MethodGet, path+"/usage", string(permission.StoragePolicyRead), false)
	usage.Middlewares = append(usage.Middlewares, sharingHeaders)
	huma.Register(api, usage, func(ctx context.Context, _ *struct{}) (*storageUsageOutput, error) {
		result, err := h.StoragePolicy.Usage(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &storageUsageOutput{Body: result}, nil
	})
	save := operation("files.storage-policy.save", http.MethodPut, path, string(permission.StoragePolicyWrite), true)
	save.Middlewares = append(save.Middlewares, sharingHeaders)
	huma.Register(api, save, func(ctx context.Context, input *storagePolicyInput) (*storagePolicyOutput, error) {
		value, err := h.StoragePolicy.Save(ctx, input.Body)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		h.Logger.Info("files.storage-policy.saved")
		return storagePolicyResponse(value, true), nil
	})
}
