package httpbinding

import (
	"context"
	"github.com/danielgtaylor/huma/v2"
	"github.com/reina0721/clouddrive/internal/module/files/handler"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"net/http"
)

type writeLocksOutput struct {
	Body struct {
		Items []service.WriteLockSummary `json:"items"`
	}
}
type releaseWriteLockInput struct {
	ID   string `path:"id" minLength:"36" maxLength:"36"`
	Body struct {
		Revision int64 `json:"revision" minimum:"1"`
	}
}

type releaseWriteLockOutput struct {
	Body struct {
		Released bool `json:"released"`
	}
}

func registerWriteLocks(api huma.API, h *handler.Handler, operation func(string, string, string, string, bool) huma.Operation) {
	huma.Register(api, operation("files.write-locks.list", http.MethodGet, "/write-locks", "files:read", false), func(ctx context.Context, _ *struct{}) (*writeLocksOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		locks, err := h.WriteLocks.List(ctx, owner)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		result := &writeLocksOutput{}
		result.Body.Items = locks
		return result, nil
	})
	op := operation("files.write-locks.release", http.MethodPost, "/write-locks/{id}/release", "files:write", true)
	op.MaxBodyBytes = maxPreferencesControlBytes
	huma.Register(api, op, func(ctx context.Context, input *releaseWriteLockInput) (*releaseWriteLockOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		if err := h.WriteLocks.Release(ctx, owner, input.ID, input.Body.Revision); err != nil {
			return nil, h.Present(ctx, err)
		}
		h.Logger.Info("files.write-lock.released")
		output := &releaseWriteLockOutput{}
		output.Body.Released = true
		return output, nil
	})
}
