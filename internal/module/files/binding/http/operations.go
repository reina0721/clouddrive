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

type copyInput struct {
	ID   string `path:"id" minLength:"1" maxLength:"36"`
	Body struct {
		ParentID string `json:"parentId" maxLength:"36"`
		Name     string `json:"name" minLength:"1" maxLength:"255"`
	}
}
type textInput struct {
	ID   string `path:"id" minLength:"1" maxLength:"36"`
	Body struct {
		ExpectedRevision int64  `json:"expectedRevision" minimum:"1"`
		Text             string `json:"text" maxLength:"1048576"`
	}
}

type textCreateInput struct {
	Body struct {
		Name     string `json:"name" minLength:"1" maxLength:"255"`
		ParentID string `json:"parentId" maxLength:"36"`
		Key      string `json:"key" minLength:"16" maxLength:"128"`
		Text     string `json:"text"`
	}
}
type archiveInput struct {
	Body struct {
		IDs []string `json:"ids" minItems:"1" maxItems:"500"`
	}
}

// maxTextJSONBytes 覆盖每个文本字节最坏的 JSON Unicode 转义与外层字段开销。
const maxTextJSONBytes = 6*service.DefaultMaxTextBytes + 1024

func registerOperations(api huma.API, h *handler.Handler, operation func(string, string, string, string, bool) huma.Operation) {
	createText := operation("files.text.create", http.MethodPost, "/text", "files:write", true)
	createText.MaxBodyBytes = maxTextJSONBytes
	createText.Middlewares = append(createText.Middlewares, transferAdmission(h))
	huma.Register(api, createText, func(ctx context.Context, input *textCreateInput) (*entryOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		entry, err := h.Service.CreateText(ctx, owner, input.Body.ParentID, input.Body.Name, input.Body.Key, input.Body.Text)
		return result(ctx, h, entry, err)
	})
	huma.Register(api, operation("files.copy", http.MethodPost, "/{id}/copy", "files:write", true), func(ctx context.Context, input *copyInput) (*entryOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		entry, err := h.Service.Copy(ctx, owner, input.ID, input.Body.ParentID, input.Body.Name)
		return result(ctx, h, entry, err)
	})
	text := operation("files.text.replace", http.MethodPut, "/{id}/text", "files:write", true)
	text.MaxBodyBytes = maxTextJSONBytes
	text.Middlewares = append(text.Middlewares, transferAdmission(h))
	huma.Register(api, text, func(ctx context.Context, input *textInput) (*entryOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		entry, err := h.Service.ReplaceText(ctx, owner, input.ID, input.Body.ExpectedRevision, input.Body.Text)
		return result(ctx, h, entry, err)
	})
	archive := operation("files.archive", http.MethodPost, "/archive", "files:read", true)
	archive.Responses = map[string]*huma.Response{"200": {Description: "有界文件 ZIP", Content: map[string]*huma.MediaType{"application/zip": {Schema: &huma.Schema{Type: "string", Format: "binary"}}}}}
	archive.Middlewares = append(archive.Middlewares, transferAdmission(h))
	huma.Register(api, archive, func(ctx context.Context, input *archiveInput) (*contentOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		content, err := h.Service.Archive(ctx, owner, input.Body.IDs)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &contentOutput{Body: func(ctx huma.Context) {
			request, writer := humabinding.UnwrapHTTP(ctx)
			writer.Header().Set("Content-Type", "application/zip")
			writer.Header().Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": "files.zip"}))
			writer.Header().Set("X-Content-Type-Options", "nosniff")
			writer.Header().Set("Cache-Control", "private, no-store")
			http.ServeContent(writer, request, "files.zip", time.Time{}, bytes.NewReader(content))
		}}, nil
	})
}

// transferAdmission 在 body 解码前复用有界传输名额，不派生独立队列或 goroutine。
func transferAdmission(h *handler.Handler) func(huma.Context, func(huma.Context)) {
	return func(ctx huma.Context, next func(huma.Context)) {
		release, err := h.Service.AcquireUpload(ctx.Context())
		if err != nil {
			request, writer := humabinding.UnwrapHTTP(ctx)
			httpx.WriteProblem(writer, request, h.Present(ctx.Context(), err))
			return
		}
		defer release()
		next(ctx)
	}
}
