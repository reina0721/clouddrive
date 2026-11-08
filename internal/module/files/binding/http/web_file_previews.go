package httpbinding

import (
	"context"
	"io"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/reina0721/clouddrive/internal/module/files/binding/permission"
	"github.com/reina0721/clouddrive/internal/module/files/handler"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/internal/transport/http/humabinding"
)

const webFilePreviewContentPath = "/api/v1/file-web-previews/{token}"

type webFilePreviewInput struct {
	ID   string `path:"id" minLength:"36" maxLength:"36"`
	Body service.WebFilePreviewRequest
}

type webFilePreviewOutput struct {
	Body service.WebFilePreview
}

type webFilePreviewContentInput struct {
	Token string `path:"token"`
}

func registerWebFilePreviews(api huma.API, h *handler.Handler, operation func(string, string, string, string, bool) huma.Operation) {
	launch := operation("files.applications.web-launch", http.MethodPost, "/{id}/web-preview", string(permission.Read), true)
	launch.Middlewares = append(launch.Middlewares, sharingHeaders)
	huma.Register(api, launch, func(ctx context.Context, input *webFilePreviewInput) (*webFilePreviewOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, err
		}
		preview, err := h.WebFilePreviews.Launch(ctx, owner, input.ID, input.Body)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &webFilePreviewOutput{Body: preview}, nil
	})
	registerWebFilePreviewContent(api, h, "files.public.web-previews.content", http.MethodGet)
	registerWebFilePreviewContent(api, h, "files.public.web-previews.head", http.MethodHead)
}

func registerWebFilePreviewContent(api huma.API, h *handler.Handler, id, method string) {
	op := humabinding.Define(huma.Operation{
		OperationID: id, Method: method, Path: webFilePreviewContentPath, Tags: []string{"File Web Previews"},
		Responses: map[string]*huma.Response{"200": {
			Description: "有效临时授权的原始文件、条件请求及字节范围",
			Content: map[string]*huma.MediaType{
				"application/octet-stream": {Schema: &huma.Schema{Type: "string", Format: "binary"}},
			},
		}},
	}, humabinding.Definition{Security: humabinding.SecurityNone, Policy: humabinding.PolicyPublic, Budget: humabinding.BudgetTransfer})
	op.Middlewares = append(op.Middlewares, sharingHeaders, transferAdmission(h))
	huma.Register(api, op, func(ctx context.Context, input *webFilePreviewContentInput) (*contentOutput, error) {
		return &contentOutput{Body: func(raw huma.Context) {
			request, writer := humabinding.UnwrapHTTP(raw)
			writer.Header().Del("Access-Control-Allow-Origin")
			writer.Header().Add("Vary", "Origin")
			contentResponse(ctx, h, func(ctx context.Context, use func(model.Entry, io.ReadSeeker) error) error {
				return h.WebFilePreviews.DownloadTo(ctx, input.Token, func(entry model.Entry, reader io.ReadSeeker, origin string) error {
					if request.Header.Get("Origin") == origin {
						writer.Header().Set("Access-Control-Allow-Origin", origin)
						writer.Header().Set("Access-Control-Expose-Headers", "Content-Range, ETag")
					}
					return use(entry, reader)
				})
			}).Body(raw)
		}}, nil
	})
}
