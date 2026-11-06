package httpbinding

import (
	"context"
	"io"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/reina0721/clouddrive/internal/module/files/handler"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/internal/transport/http/humabinding"
	"github.com/reina0721/clouddrive/pkg/httpx"
)

const fileDownloadsPrefix = "/api/v1/file-downloads"

type downloadGrantOutput struct{ Body service.DownloadGrant }
type downloadGrantInput struct {
	Ticket string `path:"ticket" minLength:"43" maxLength:"43"`
}

func shareOrigin(h *handler.Handler) func(huma.Context, func(huma.Context)) {
	return func(ctx huma.Context, next func(huma.Context)) {
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
	}
}

func registerShareDownloads(api huma.API, h *handler.Handler) {
	create := publicShareOperation(h, "files.public.download.create", http.MethodPost, "/{token}/content/{id}/download", false)
	create.Middlewares = append(create.Middlewares, shareOrigin(h))
	huma.Register(api, create, func(ctx context.Context, input *publicContentInput) (*downloadGrantOutput, error) {
		grant, err := h.Sharing.CreateDownload(ctx, input.Token, input.Grant, input.ID)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &downloadGrantOutput{Body: grant}, nil
	})
	for _, method := range []string{http.MethodGet, http.MethodHead} {
		id := "files.public.download.content"
		if method == http.MethodHead {
			id = "files.public.download.head"
		}
		op := publicShareOperation(h, id, method, "", false)
		op.Path = fileDownloadsPrefix + "/{ticket}"
		definition, _ := humabinding.DefinitionOf(&op)
		definition.Budget = humabinding.BudgetTransfer
		op = humabinding.Define(op, definition)
		op.Middlewares = append(op.Middlewares, transferAdmission(h))
		op.Responses = map[string]*huma.Response{"200": {Description: "限定单文件短期下载及字节范围", Content: map[string]*huma.MediaType{"application/octet-stream": {Schema: &huma.Schema{Type: "string", Format: "binary"}}}}}
		huma.Register(api, op, func(ctx context.Context, input *downloadGrantInput) (*contentOutput, error) {
			return contentResponse(ctx, h, func(ctx context.Context, use func(model.Entry, io.ReadSeeker) error) error {
				return h.Sharing.DownloadTicketTo(ctx, input.Ticket, use)
			}), nil
		})
	}
}
