package httpbinding

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/reina0721/clouddrive/internal/module/files/handler"
)

type shareListInput struct {
	Search string `query:"search" maxLength:"200"`
	State  string `query:"state" enum:",active,paused,expired,revoked"`
	Sort   string `query:"sort" enum:"newest,oldest,name" default:"newest"`
	Page   int    `query:"page" minimum:"1" maximum:"100000" default:"1"`
}
type shareUpdateInput struct {
	ShareID string `path:"shareId" minLength:"36" maxLength:"36"`
	Body    shareUpdateBody
}
type shareStateInput struct {
	ShareID string `path:"shareId" minLength:"36" maxLength:"36"`
	Body    struct {
		Revision int64 `json:"revision" minimum:"1" maximum:"9007199254740990"`
		Enabled  bool  `json:"enabled"`
	}
}

func registerShareManagement(api huma.API, h *handler.Handler, operation func(string, string, string, string, bool) huma.Operation) {
	huma.Register(api, operation("files.shares.read", http.MethodGet, "/shares/{shareId}", "files:read", false), func(ctx context.Context, input *sharePathInput) (*shareOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		value, err := h.Sharing.ReadManaged(ctx, owner, input.ShareID)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &shareOutput{Body: shareBody(value)}, nil
	})
	update := operation("files.shares.update", http.MethodPut, "/shares/{shareId}", "files:write", true)
	update.MaxBodyBytes = maxAudienceBodyBytes
	huma.Register(api, update, func(ctx context.Context, input *shareUpdateInput) (*shareOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		value, err := h.Sharing.Update(ctx, owner, input.ShareID, input.Body.service())
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		h.Logger.Info("files.share.policy.updated")
		return &shareOutput{Body: shareBody(value)}, nil
	})
	state := operation("files.shares.state", http.MethodPut, "/shares/{shareId}/state", "files:write", true)
	state.MaxBodyBytes = maxShareUnlockBodyBytes
	huma.Register(api, state, func(ctx context.Context, input *shareStateInput) (*shareOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		value, err := h.Sharing.SetEnabled(ctx, owner, input.ShareID, input.Body.Revision, input.Body.Enabled)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		h.Logger.Info("files.share.state.updated")
		return &shareOutput{Body: shareBody(value)}, nil
	})
}
