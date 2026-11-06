package httpbinding

import (
	"context"
	"github.com/danielgtaylor/huma/v2"
	"github.com/reina0721/clouddrive/internal/module/files/handler"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"net/http"
)

const maxAudienceBodyBytes = 32 << 10

type accessPathInput struct {
	ID string `path:"id" minLength:"36" maxLength:"36"`
}
type accessUpdateInput struct {
	ID   string `path:"id" minLength:"36" maxLength:"36"`
	Body accessUpdateBody
}
type accessOutput struct{ Body fileAccessDetailBody }
type audienceLookupInput struct {
	Body struct {
		Kind service.AudienceKind `json:"kind" enum:"account,role"`
		Key  string               `json:"key" minLength:"1" maxLength:"254"`
	}
}
type audienceTargetOutput struct{ Body service.AudienceTarget }
type effectiveAccessInput struct {
	ID   string `path:"id" minLength:"36" maxLength:"36"`
	Body struct {
		ShareID   string `json:"shareId" minLength:"36" maxLength:"36"`
		AccountID string `json:"accountId" maxLength:"36"`
	}
}
type effectiveAccessOutput struct{ Body effectiveAccessBody }

func registerAccessManagement(api huma.API, h *handler.Handler, operation func(string, string, string, string, bool) huma.Operation) {
	huma.Register(api, operation("files.access.read", http.MethodGet, "/{id}/access", "files:read", false), func(ctx context.Context, input *accessPathInput) (*accessOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		value, err := h.Sharing.ReadAccess(ctx, owner, input.ID)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &accessOutput{Body: accessBody(value)}, nil
	})
	update := operation("files.access.update", http.MethodPut, "/{id}/access", "files:write", true)
	update.MaxBodyBytes = maxAudienceBodyBytes
	huma.Register(api, update, func(ctx context.Context, input *accessUpdateInput) (*accessOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		value, err := h.Sharing.UpdateAccess(ctx, owner, input.ID, input.Body.service())
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		h.Logger.Info("files.access.updated")
		return &accessOutput{Body: accessBody(value)}, nil
	})
	lookup := operation("files.audience.lookup", http.MethodPost, "/audience/lookup", "files:write", true)
	lookup.MaxBodyBytes = maxShareUnlockBodyBytes
	huma.Register(api, lookup, func(ctx context.Context, input *audienceLookupInput) (*audienceTargetOutput, error) {
		if _, err := h.Owner(ctx); err != nil {
			return nil, h.Present(ctx, err)
		}
		value, err := h.Sharing.LookupAudience(ctx, input.Body.Kind, input.Body.Key)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &audienceTargetOutput{Body: value}, nil
	})
	preview := operation("files.access.preview", http.MethodPost, "/{id}/access/effective", "files:read", true)
	preview.MaxBodyBytes = maxShareUnlockBodyBytes
	huma.Register(api, preview, func(ctx context.Context, input *effectiveAccessInput) (*effectiveAccessOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		value, err := h.Sharing.PreviewAccess(ctx, owner, input.ID, input.Body.ShareID, input.Body.AccountID)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &effectiveAccessOutput{Body: effectiveBody(value)}, nil
	})
}
