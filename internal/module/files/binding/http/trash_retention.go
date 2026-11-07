package httpbinding

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/reina0721/clouddrive/internal/module/files/handler"
	"github.com/reina0721/clouddrive/internal/module/files/model"
)

type trashRetentionPayload struct{ Body model.TrashRetention }

func registerTrashRetention(api huma.API, h *handler.Handler, operation func(string, string, string, string, bool) huma.Operation) {
	huma.Register(api, operation("files.trash.retention.read", http.MethodGet, "/trash/retention", "files:read", false), func(ctx context.Context, _ *struct{}) (*trashRetentionPayload, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		policy, err := h.TrashRetention.Get(ctx, owner)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &trashRetentionPayload{Body: policy}, nil
	})
	huma.Register(api, operation("files.trash.retention.write", http.MethodPut, "/trash/retention", "files:write", true), func(ctx context.Context, input *trashRetentionPayload) (*trashRetentionPayload, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		policy, err := h.TrashRetention.Save(ctx, owner, input.Body)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &trashRetentionPayload{Body: policy}, nil
	})
}
