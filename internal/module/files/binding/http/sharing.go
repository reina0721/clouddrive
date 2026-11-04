package httpbinding

import (
	"bytes"
	"context"
	"mime"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/reina0721/clouddrive/internal/module/files/handler"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/internal/transport/http/humabinding"
	"github.com/reina0721/clouddrive/pkg/httpx"
)

const publicSharePrefix = "/api/v1/file-shares"
const maxShareUnlockBodyBytes = 4096

type shareCreateInput struct {
	Body struct {
		RootID    string     `json:"rootId" minLength:"1" maxLength:"36"`
		Password  string     `json:"password,omitempty" maxLength:"128"`
		ExpiresAt *time.Time `json:"expiresAt,omitempty"`
	}
}
type shareRevokeInput struct {
	ShareID string `path:"shareId" minLength:"1" maxLength:"36"`
}
type sharesOutput struct{ Body []service.ShareSummary }
type shareOutput struct{ Body service.ShareSummary }
type publicShareInput struct {
	Token string `path:"token" minLength:"43" maxLength:"43"`
	Grant string `header:"X-Share-Grant" maxLength:"43"`
}
type publicEntriesInput struct {
	Token  string `path:"token" minLength:"43" maxLength:"43"`
	Grant  string `header:"X-Share-Grant" maxLength:"43"`
	Parent string `query:"parent" maxLength:"36"`
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
	private := func(id, method, suffix, scope string, jsonBody bool) huma.Operation {
		op := operation(id, method, suffix, scope, jsonBody)
		op.Middlewares = append(op.Middlewares, sharingHeaders)
		return op
	}
	huma.Register(api, private("files.shares.list", http.MethodGet, "/shares", "files:read", false), func(ctx context.Context, _ *struct{}) (*sharesOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		shares, err := h.Sharing.List(ctx, owner)
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
		share, err := h.Sharing.Create(ctx, owner, input.Body.RootID, input.Body.Password, input.Body.ExpiresAt)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		h.Logger.Info("files.share.created")
		return &shareOutput{Body: share}, nil
	})
	huma.Register(api, private("files.shares.revoke", http.MethodPost, "/shares/{shareId}/revoke", "files:write", false), func(ctx context.Context, input *shareRevokeInput) (*shareOutput, error) {
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
		listing, err := h.Sharing.Entries(ctx, input.Token, input.Grant, input.Parent)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &publicEntriesOutput{Body: listing}, nil
	})
	unlock := publicShareOperation("files.public.unlock", http.MethodPost, "/{token}/unlock", true)
	unlock.MaxBodyBytes = maxShareUnlockBodyBytes
	unlock.Middlewares = append(unlock.Middlewares, func(ctx huma.Context, next func(huma.Context)) {
		request, writer := humabinding.UnwrapHTTP(ctx)
		origin := request.Header.Get("Origin")
		allowed := origin != "" && httpx.SameOrigin(request, origin)
		if h != nil {
			for _, candidate := range h.PublicOrigins {
				if candidate == origin && origin != "" {
					allowed = true
					break
				}
			}
		}
		if !allowed {
			httpx.WriteProblem(writer, request, &httpx.StatusError{StatusCode: http.StatusForbidden, Code: "files_share_origin", Message: "share origin rejected"})
			return
		}
		next(ctx)
	})
	huma.Register(api, unlock, func(ctx context.Context, input *publicUnlockInput) (*publicUnlockOutput, error) {
		grant, err := h.Sharing.Unlock(ctx, input.Token, input.Body.Password)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		h.Logger.Info("files.share.unlocked")
		return &publicUnlockOutput{Body: grant}, nil
	})
	download := publicShareOperation("files.public.content", http.MethodGet, "/{token}/content/{id}", false)
	download.Middlewares = append(download.Middlewares, transferAdmission(h))
	download.Responses = map[string]*huma.Response{"200": {Description: "分享授权范围内的原始文件", Content: map[string]*huma.MediaType{"application/octet-stream": {Schema: &huma.Schema{Type: "string", Format: "binary"}}}}}
	huma.Register(api, download, func(ctx context.Context, input *publicContentInput) (*contentOutput, error) {
		entry, content, err := h.Sharing.Download(ctx, input.Token, input.Grant, input.ID)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &contentOutput{Body: func(ctx huma.Context) {
			request, writer := humabinding.UnwrapHTTP(ctx)
			writer.Header().Set("Content-Type", "application/octet-stream")
			writer.Header().Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": entry.Name}))
			http.ServeContent(writer, request, entry.Name, entry.UpdatedAt, bytes.NewReader(content))
		}}, nil
	})
}
