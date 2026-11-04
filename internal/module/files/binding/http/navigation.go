package httpbinding

import (
	"context"
	"net/http"
	"net/url"

	"github.com/danielgtaylor/huma/v2"
	"github.com/reina0721/clouddrive/internal/module/files/handler"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/internal/transport/http/humabinding"
)

const maxNavigationControlBytes int64 = 4096
const publicSharePagePath = "/share"

type shortcutListInput struct {
	Search string                 `query:"search" maxLength:"255"`
	Cursor string                 `query:"cursor" maxLength:"36"`
	State  service.ShortcutFilter `query:"state" enum:",active,protected,unavailable"`
}
type shortcutListOutput struct{ Body service.ShortcutListing }
type shortcutCreateInput struct{ Body service.ShortcutRequest }
type shortcutPathInput struct {
	ID string `path:"shortcutId" minLength:"36" maxLength:"36"`
}
type shortcutOpenOutput struct {
	Location string `header:"Location"`
}
type shortcutPurgeInput struct {
	ID   string `path:"shortcutId" minLength:"36" maxLength:"36"`
	Body struct {
		Revision int64 `json:"revision" minimum:"1"`
	}
}
type pinListOutput struct{ Body service.PinListing }
type pinCreateInput struct{ Body service.PinRequest }
type navigationRevisionOutput struct {
	Body struct {
		Revision int64 `json:"revision"`
	}
}
type pinRemoveInput struct {
	ID   string `path:"pinId" minLength:"36" maxLength:"36"`
	Body struct {
		Revision int64 `json:"revision" minimum:"0"`
	}
}
type pinOrderInput struct {
	Body struct {
		Revision int64    `json:"revision" minimum:"0"`
		IDs      []string `json:"ids" maxItems:"20"`
	}
}

func navigationRevision(revision int64) *navigationRevisionOutput {
	result := &navigationRevisionOutput{}
	result.Body.Revision = revision
	return result
}

func registerNavigation(api huma.API, h *handler.Handler, operation func(string, string, string, string, bool) huma.Operation) {
	base := operation
	operation = func(id, method, suffix, scope string, jsonBody bool) huma.Operation {
		op := base(id, method, suffix, scope, jsonBody)
		if jsonBody {
			op.MaxBodyBytes = maxNavigationControlBytes
		}
		op.Middlewares = append(op.Middlewares, func(ctx huma.Context, next func(huma.Context)) {
			_, writer := humabinding.UnwrapHTTP(ctx)
			writer.Header().Set("Cache-Control", "private, no-store")
			writer.Header().Set("Referrer-Policy", "no-referrer")
			next(ctx)
		})
		return op
	}
	huma.Register(api, operation("files.shortcuts.list", http.MethodGet, "/shortcuts", "files:read", false), func(ctx context.Context, input *shortcutListInput) (*shortcutListOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		result, err := h.Navigation.Shortcuts(ctx, owner, input.Search, input.Cursor, input.State)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &shortcutListOutput{Body: result}, nil
	})
	huma.Register(api, operation("files.shortcuts.create", http.MethodPost, "/shortcuts", "files:write", true), func(ctx context.Context, input *shortcutCreateInput) (*entryOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		entry, err := h.Navigation.CreateShortcut(ctx, owner, input.Body)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		h.Logger.Info("files.shortcut.saved")
		return &entryOutput{Body: entry}, nil
	})
	open := operation("files.shortcuts.open", http.MethodGet, "/shortcuts/{shortcutId}/open", "files:read", false)
	open.DefaultStatus = http.StatusSeeOther
	huma.Register(api, open, func(ctx context.Context, input *shortcutPathInput) (*shortcutOpenOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		token, err := h.Navigation.OpenShortcut(ctx, owner, input.ID)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		target := url.URL{Path: publicSharePagePath, Fragment: url.Values{"token": []string{token}}.Encode()}
		return &shortcutOpenOutput{Location: target.String()}, nil
	})
	purge := operation("files.shortcuts.purge", http.MethodDelete, "/shortcuts/{shortcutId}", "files:write", true)
	purge.DefaultStatus = http.StatusNoContent
	huma.Register(api, purge, func(ctx context.Context, input *shortcutPurgeInput) (*struct{}, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		if err := h.Navigation.PurgeShortcut(ctx, owner, input.ID, input.Body.Revision); err != nil {
			return nil, h.Present(ctx, err)
		}
		h.Logger.Info("files.shortcut.removed")
		return nil, nil
	})
	huma.Register(api, operation("files.pins.list", http.MethodGet, "/pins", "files:read", false), func(ctx context.Context, _ *struct{}) (*pinListOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		result, err := h.Navigation.Pins(ctx, owner)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &pinListOutput{Body: result}, nil
	})
	huma.Register(api, operation("files.pins.create", http.MethodPost, "/pins", "files:write", true), func(ctx context.Context, input *pinCreateInput) (*navigationRevisionOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		revision, err := h.Navigation.AddPin(ctx, owner, input.Body)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		h.Logger.Info("files.pin.saved")
		return navigationRevision(revision), nil
	})
	huma.Register(api, operation("files.pins.remove", http.MethodDelete, "/pins/{pinId}", "files:write", true), func(ctx context.Context, input *pinRemoveInput) (*navigationRevisionOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		revision, err := h.Navigation.RemovePin(ctx, owner, input.ID, input.Body.Revision)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		h.Logger.Info("files.pin.removed")
		return navigationRevision(revision), nil
	})
	huma.Register(api, operation("files.pins.order", http.MethodPut, "/pins/order", "files:write", true), func(ctx context.Context, input *pinOrderInput) (*navigationRevisionOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		revision, err := h.Navigation.ReorderPins(ctx, owner, input.Body.Revision, input.Body.IDs)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		h.Logger.Info("files.pins.reordered")
		return navigationRevision(revision), nil
	})
}
