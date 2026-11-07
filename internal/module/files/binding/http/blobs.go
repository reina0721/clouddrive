package httpbinding

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/reina0721/clouddrive/internal/module/files/binding/permission"
	"github.com/reina0721/clouddrive/internal/module/files/handler"
	"github.com/reina0721/clouddrive/internal/module/files/service"
)

type blobListInput struct {
	OwnerID   string                      `query:"ownerId" maxLength:"128"`
	Reference service.BlobReferenceFilter `query:"reference" enum:"any,current,history,history-only" default:"any"`
	Storage   service.BlobStorage         `query:"storage" enum:"any,primary" default:"any"`
	Sort      service.BlobSort            `query:"sort" enum:"id,size,references,first-file" default:"references"`
	Direction service.InventoryDirection  `query:"direction" enum:"asc,desc" default:"desc"`
	Page      int                         `query:"page" minimum:"1" maximum:"10000" default:"1"`
}
type blobDetailInput struct {
	ID   string `path:"id" minLength:"36" maxLength:"36"`
	Page int    `query:"page" minimum:"1" maximum:"10000" default:"1"`
}
type blobListOutput struct{ Body service.BlobPage }
type blobDetailOutput struct{ Body service.BlobDetail }

func registerBlobs(api huma.API, h *handler.Handler, operation func(string, string, string, string, bool) huma.Operation) {
	blobOperation := func(id, suffix string) huma.Operation {
		op := operation(id, http.MethodGet, "/blobs"+suffix, string(permission.BlobRead), false)
		op.Middlewares = append(op.Middlewares, sharingHeaders)
		return op
	}
	huma.Register(api, blobOperation("files.blobs.list", ""), func(ctx context.Context, input *blobListInput) (*blobListOutput, error) {
		page, err := h.Blobs.List(ctx, service.BlobQuery{OwnerID: input.OwnerID, Reference: input.Reference, Storage: input.Storage,
			Sort: input.Sort, Direction: input.Direction, Page: input.Page})
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		h.Logger.Info("files.blobs.listed")
		return &blobListOutput{Body: page}, nil
	})
	huma.Register(api, blobOperation("files.blobs.detail", "/{id}"), func(ctx context.Context, input *blobDetailInput) (*blobDetailOutput, error) {
		detail, err := h.Blobs.Read(ctx, input.ID, input.Page)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		h.Logger.Info("files.blobs.detail.read")
		return &blobDetailOutput{Body: detail}, nil
	})
}
