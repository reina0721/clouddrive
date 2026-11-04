package httpbinding

import (
	"context"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"io"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/reina0721/clouddrive/internal/module/files/handler"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/internal/transport/http/humabinding"
)

const publicSharePrefix = "/api/v1/file-shares"
const maxShareUnlockBodyBytes = 4096

type shareCreateInput struct{ Body service.ShareCreate }
type sharePathInput struct {
	ShareID string `path:"shareId" minLength:"1" maxLength:"36"`
}
type sharesOutput struct{ Body service.ShareListing }
type shareOutput struct{ Body service.ShareSummary }
type publicShareInput struct {
	Token string `path:"token" minLength:"43" maxLength:"43"`
	Grant string `header:"X-Share-Grant" maxLength:"43"`
}
type publicEntriesInput struct {
	Token  string              `path:"token" minLength:"43" maxLength:"43"`
	Grant  string              `header:"X-Share-Grant" maxLength:"43"`
	Parent string              `query:"parent" maxLength:"36"`
	Search string              `query:"search" maxLength:"255"`
	Sort   service.SortKey     `query:"sort" enum:",name,size,updated,created"`
	Desc   bool                `query:"desc"`
	Scope  service.SearchScope `query:"scope" enum:",folder,tree"`
	Page   int                 `query:"page" minimum:"1" default:"1"`
}
type publicContentInput struct {
	Token string `path:"token" minLength:"43" maxLength:"43"`
	Grant string `header:"X-Share-Grant" maxLength:"43"`
	ID    string `path:"id" minLength:"1" maxLength:"36"`
}
type publicUnlockInput struct {
	Token string `path:"token" minLength:"43" maxLength:"43"`
	Body  struct {
		Password string `json:"password" maxLength:"128"`
	}
}
type publicShareOutput struct{ Body service.PublicShare }
type publicEntriesOutput struct{ Body service.PublicListing }
type publicUnlockOutput struct{ Body service.UnlockResult }

// sharingHeaders 避免 capability 响应进入缓存，且不把所在页面 URL 传递给外部资源。
func sharingHeaders(ctx huma.Context, next func(huma.Context)) {
	_, writer := humabinding.UnwrapHTTP(ctx)
	writer.Header().Set("Cache-Control", "private, no-store")
	writer.Header().Set("Referrer-Policy", "no-referrer")
	writer.Header().Set("X-Content-Type-Options", "nosniff")
	next(ctx)
}
func publicShareOperation(id, method, suffix string, jsonBody bool) huma.Operation {
	op := huma.Operation{OperationID: id, Method: method, Path: publicSharePrefix + suffix, Tags: []string{"File Shares"}, DefaultStatus: 200}
	definition := humabinding.Definition{Security: humabinding.SecurityNone, Policy: humabinding.PolicyPublic}
	if jsonBody {
		op = humabinding.JSONDefinition(op, definition)
	} else {
		op = humabinding.Define(op, definition)
	}
	op.Middlewares = append(op.Middlewares, sharingHeaders)
	return op
}
func registerSharing(api huma.API, h *handler.Handler, operation func(string, string, string, string, bool) huma.Operation) {
	registerShareDownloads(api, h)
	private := func(id, method, suffix, scope string, jsonBody bool) huma.Operation {
		op := operation(id, method, suffix, scope, jsonBody)
		op.Middlewares = append(op.Middlewares, sharingHeaders)
		return op
	}
	registerShareManagement(api, h, private)
	registerSharedFiles(api, h)
	registerSharedTransfers(api, h)
	huma.Register(api, private("files.shares.list", http.MethodGet, "/shares", "files:read", false), func(ctx context.Context, input *shareListInput) (*sharesOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		shares, err := h.Sharing.List(ctx, owner, service.ShareQuery{Search: input.Search, State: input.State, Sort: input.Sort, Page: input.Page})
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &sharesOutput{Body: shares}, nil
	})
	huma.Register(api, private("files.shares.create", http.MethodPost, "/shares", "files:write", true), func(ctx context.Context, input *shareCreateInput) (*shareOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		share, err := h.Sharing.Create(ctx, owner, input.Body)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		h.Logger.Info("files.share.created")
		return &shareOutput{Body: share}, nil
	})
	huma.Register(api, private("files.shares.revoke", http.MethodPost, "/shares/{shareId}/revoke", "files:write", false), func(ctx context.Context, input *sharePathInput) (*shareOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		share, err := h.Sharing.Revoke(ctx, owner, input.ShareID)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		h.Logger.Info("files.share.revoked")
		return &shareOutput{Body: share}, nil
	})
	huma.Register(api, publicShareOperation("files.public.metadata", http.MethodGet, "/{token}", false), func(ctx context.Context, input *publicShareInput) (*publicShareOutput, error) {
		share, err := h.Sharing.Metadata(ctx, input.Token, input.Grant)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &publicShareOutput{Body: share}, nil
	})
	huma.Register(api, publicShareOperation("files.public.entries", http.MethodGet, "/{token}/entries", false), func(ctx context.Context, input *publicEntriesInput) (*publicEntriesOutput, error) {
		listing, err := h.Sharing.Entries(ctx, input.Token, input.Grant, service.PublicFileQuery{Parent: input.Parent, Search: input.Search, Sort: input.Sort, Desc: input.Desc, Scope: input.Scope, Page: input.Page})
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &publicEntriesOutput{Body: listing}, nil
	})
	unlock := publicShareOperation("files.public.unlock", http.MethodPost, "/{token}/unlock", true)
	unlock.MaxBodyBytes = maxShareUnlockBodyBytes
	unlock.Middlewares = append(unlock.Middlewares, shareOrigin(h))
	huma.Register(api, unlock, func(ctx context.Context, input *publicUnlockInput) (*publicUnlockOutput, error) {
		grant, err := h.Sharing.Unlock(ctx, input.Token, input.Body.Password)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		h.Logger.Info("files.share.unlocked")
		return &publicUnlockOutput{Body: grant}, nil
	})

	for _, method := range []string{http.MethodGet, http.MethodHead} {
		id := "files.public.content"
		if method == http.MethodHead {
			id = "files.public.content.head"
		}
		download := transferBudget(publicShareOperation(id, method, "/{token}/content/{id}", false))
		download.Middlewares = append(download.Middlewares, transferAdmission(h))
		download.Responses = map[string]*huma.Response{"200": {Description: "分享范围内的原始内容和字节范围", Content: map[string]*huma.MediaType{"application/octet-stream": {Schema: &huma.Schema{Type: "string", Format: "binary"}}}}}
		huma.Register(api, download, func(ctx context.Context, input *publicContentInput) (*contentOutput, error) {
			return contentResponse(ctx, h, func(ctx context.Context, use func(model.Entry, io.ReadSeeker) error) error {
				return h.Sharing.ContentTo(ctx, input.Token, input.Grant, input.ID, use)
			}), nil
		})
	}

}
