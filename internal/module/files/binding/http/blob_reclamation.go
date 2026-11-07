package httpbinding

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/reina0721/clouddrive/internal/module/files/binding/permission"
	"github.com/reina0721/clouddrive/internal/module/files/handler"
	"github.com/reina0721/clouddrive/internal/module/files/service"
)

type blobCandidatesInput struct {
	Page int `query:"page" minimum:"1" maximum:"10000" default:"1"`
}

type blobCandidatesOutput struct {
	Body struct {
		service.BlobCandidatePage
		CanReclaim bool `json:"canReclaim"`
	}
}

type reclaimBlobInput struct {
	ID string `path:"id" minLength:"36" maxLength:"36"`
}

func registerBlobReclamation(api huma.API, h *handler.Handler, operation func(string, string, string, string, bool) huma.Operation) {
	list := operation("files.blob-reclamation.list", http.MethodGet, "/blob-reclamation", string(permission.BlobRead), false)
	list.Middlewares = append(list.Middlewares, sharingHeaders)
	huma.Register(api, list, func(ctx context.Context, input *blobCandidatesInput) (*blobCandidatesOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, err
		}
		allowed, err := h.BlobReclamationAccess.AuthorizeBlobReclamation(ctx, owner)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		page, err := h.BlobReclamation.List(ctx, input.Page)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		result := &blobCandidatesOutput{}
		result.Body.BlobCandidatePage = page
		result.Body.CanReclaim = allowed
		return result, nil
	})
	remove := operation("files.blob-reclamation.remove", http.MethodPost, "/blob-reclamation/{id}", string(permission.BlobReclaim), true)
	remove.DefaultStatus = http.StatusNoContent
	huma.Register(api, remove, func(ctx context.Context, input *reclaimBlobInput) (*struct{}, error) {
		if err := h.BlobReclamation.Remove(ctx, input.ID); err != nil {
			return nil, h.Present(ctx, err)
		}
		h.Logger.Info("files.blob.reclaimed")
		return nil, nil
	})
}
