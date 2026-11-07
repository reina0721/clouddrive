package httpbinding

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/reina0721/clouddrive/internal/module/files/handler"
	"github.com/reina0721/clouddrive/internal/module/files/service"
)

type trashPreviewInput struct {
	Body service.TrashPurgeSelectionInput
}
type trashPurgeInput struct {
	Body struct {
		service.TrashPurgeSelectionInput
		Snapshot string `json:"snapshot" minLength:"64" maxLength:"64"`
	}
}
type trashPurgeOutput struct{ Body service.TrashPurgePreview }

func registerTrashPurge(api huma.API, h *handler.Handler, operation func(string, string, string, string, bool) huma.Operation) {
	huma.Register(api, operation("files.trash.purge-preview", http.MethodPost, "/trash/purge-preview", "files:write", true), func(ctx context.Context, input *trashPreviewInput) (*trashPurgeOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		preview, err := h.TrashPurge.Preview(ctx, owner, input.Body)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &trashPurgeOutput{Body: preview}, nil
	})
	huma.Register(api, operation("files.trash.purge", http.MethodPost, "/trash/purge", "files:write", true), func(ctx context.Context, input *trashPurgeInput) (*trashPurgeOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		preview, err := h.TrashPurge.Confirm(ctx, owner, input.Body.TrashPurgeSelectionInput, input.Body.Snapshot)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &trashPurgeOutput{Body: preview}, nil
	})
}
