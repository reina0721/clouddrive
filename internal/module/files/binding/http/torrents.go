package httpbinding

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/reina0721/clouddrive/internal/module/files/handler"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/logger"
)

const maxTorrentControlBodyBytes int64 = int64(service.TorrentBase64Limit) + (64 << 10)

type torrentCreateInput struct{ Body service.TorrentCreate }
type torrentCapabilitiesOutput struct{ Body service.TorrentCapabilities }
type torrentDetailOutput struct{ Body service.TorrentDetail }
type torrentSelectionInput struct {
	ID   string `path:"id" minLength:"36" maxLength:"36"`
	Body service.TorrentSelection
}

func registerTorrents(api huma.API, h *handler.Handler, base func(string, string, string, string, bool) huma.Operation) {
	operation := func(id, method, suffix, scope string, body bool) huma.Operation {
		op := base(id, method, "/torrent-downloads"+suffix, scope, body)
		if body {
			op.MaxBodyBytes = maxTorrentControlBodyBytes
		}
		return op
	}
	huma.Register(api, operation("files.torrents.capabilities", http.MethodGet, "/capabilities", "files:read", false), func(ctx context.Context, input *struct{}) (*torrentCapabilitiesOutput, error) {
		if _, err := h.Owner(ctx); err != nil {
			return nil, h.Present(ctx, err)
		}
		return &torrentCapabilitiesOutput{Body: h.Torrents.Capabilities()}, nil
	})
	huma.Register(api, operation("files.torrents.create", http.MethodPost, "", "files:write", true), func(ctx context.Context, input *torrentCreateInput) (*downloadOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		result, err := h.Torrents.Create(ctx, owner, input.Body)
		if err == nil {
			h.Logger.Info("files.bittorrent.created", logger.String("owner", "files.bittorrent"), logger.String("phase", "create"), logger.String("task_id", result.ID))
		}
		return downloadResult(ctx, h, result, err)
	})
	huma.Register(api, operation("files.torrents.read", http.MethodGet, "/{id}", "files:read", false), func(ctx context.Context, input *transferInput) (*torrentDetailOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		result, err := h.Torrents.Detail(ctx, owner, input.ID)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &torrentDetailOutput{Body: result}, nil
	})
	huma.Register(api, operation("files.torrents.select", http.MethodPatch, "/{id}/selection", "files:write", true), func(ctx context.Context, input *torrentSelectionInput) (*downloadOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		result, err := h.Torrents.Select(ctx, owner, input.ID, input.Body)
		return downloadResult(ctx, h, result, err)
	})
}
