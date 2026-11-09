package httpbinding

import (
	"context"
	"errors"
	"net/http"
	"strconv"

	"github.com/danielgtaylor/huma/v2"
	"github.com/reina0721/clouddrive/internal/module/files/handler"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/internal/transport/http/humabinding"
	"github.com/reina0721/clouddrive/pkg/httpx"
)

const wopiLockHeader = "X-WOPI-Lock"

type wopiLockInput struct {
	ID        string                    `path:"id"`
	Token     string                    `query:"access_token"`
	Operation service.WOPILockOperation `header:"X-WOPI-Override"`
	Value     string                    `header:"X-WOPI-Lock"`
	OldValue  string                    `header:"X-WOPI-OldLock"`
}

type wopiPutInput struct {
	ID        string `path:"id"`
	Token     string `query:"access_token"`
	Operation string `header:"X-WOPI-Override"`
	Value     string `header:"X-WOPI-Lock"`
}

func registerWOPIEdits(api huma.API, h *handler.Handler) {
	lock := wopiOperation("files.public.wopi.lock", http.MethodPost, wopiFilePath, humabinding.Definition{})
	lock.Responses = map[string]*huma.Response{"200": {Description: "已处理 WOPI 锁命令"}}
	huma.Register(api, lock, func(ctx context.Context, input *wopiLockInput) (*contentOutput, error) {
		return &contentOutput{Body: func(raw huma.Context) {
			request, writer := humabinding.BeginRawHTTP(raw)
			switch input.Operation {
			case service.WOPILockAcquire, service.WOPILockGet, service.WOPILockRefresh, service.WOPILockUnlock:
				current, err := h.WebFilePreviews.ChangeWOPILock(ctx, input.Token, input.ID, input.Operation, input.Value, input.OldValue)
				if err != nil {
					writeWOPIError(ctx, h, writer, request, err)
					return
				}
				if input.Operation == service.WOPILockGet {
					writer.Header().Set(wopiLockHeader, current)
				}
				writer.WriteHeader(http.StatusOK)
			default:
				writeWOPIError(ctx, h, writer, request, model.ErrUnsupported)
			}
		}}, nil
	})

	put := wopiOperation("files.public.wopi.put", http.MethodPost, wopiFilePath+"/contents", humabinding.Definition{Budget: humabinding.BudgetTransfer})
	put.Middlewares = append(put.Middlewares, transferAdmission(h))
	put.RequestBody = &huma.RequestBody{Required: true, Content: map[string]*huma.MediaType{
		"application/octet-stream": {Schema: &huma.Schema{Type: "string", Format: "binary"}},
	}}
	put.Responses = map[string]*huma.Response{"200": {Description: "已保存 WOPI 文件版本"}}
	huma.Register(api, put, func(ctx context.Context, input *wopiPutInput) (*contentOutput, error) {
		return &contentOutput{Body: func(raw huma.Context) {
			request, writer := humabinding.BeginRawHTTP(raw)
			if input.Operation != "PUT" {
				writeWOPIError(ctx, h, writer, request, model.ErrUnsupported)
				return
			}
			entry, err := h.WebFilePreviews.PutWOPIFile(ctx, input.Token, input.ID, input.Value, request.Body, request.ContentLength)
			if err != nil {
				writeWOPIError(ctx, h, writer, request, err)
				return
			}
			writer.Header().Set(wopiItemVersionHeader, strconv.FormatInt(entry.ContentRevision, 10))
			writer.WriteHeader(http.StatusOK)
		}}, nil
	})
}

func writeWOPIError(ctx context.Context, h *handler.Handler, writer http.ResponseWriter, request *http.Request, err error) {
	var mismatch *service.WOPILockConflict
	switch {
	case errors.As(err, &mismatch):
		writer.Header().Set(wopiLockHeader, mismatch.Current)
	case errors.Is(err, model.ErrConflict):
		writer.Header().Set(wopiLockHeader, "")
	case errors.Is(err, model.ErrInvalid):
		httpx.WriteProblem(writer, request, &httpx.StatusError{StatusCode: http.StatusBadRequest, Code: "files_wopi_invalid", Message: "invalid WOPI request", Err: err})
		return
	case errors.Is(err, model.ErrUnsupported):
		httpx.WriteProblem(writer, request, &httpx.StatusError{StatusCode: http.StatusNotImplemented, Code: "files_wopi_unsupported", Message: "unsupported WOPI operation", Err: err})
		return
	}
	httpx.WriteProblem(writer, request, h.Present(ctx, err))
}
