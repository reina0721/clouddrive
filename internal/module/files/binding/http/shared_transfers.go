package httpbinding

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/reina0721/clouddrive/internal/module/files/handler"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/internal/transport/http/humabinding"
	"github.com/reina0721/clouddrive/pkg/httpx"
	"github.com/reina0721/clouddrive/pkg/logger"
)

type sharedTransferCreateInput struct {
	Token string `path:"token" minLength:"43" maxLength:"43"`
	Grant string `header:"X-Share-Grant" maxLength:"43"`
	Body  service.SharedTransferCreate
}
type sharedTransferOutput struct{ Body service.SharedTransfer }

func sharedTransferResult(ctx context.Context, h *handler.Handler, value service.SharedTransfer, err error) (*sharedTransferOutput, error) {
	if err != nil {
		return nil, h.Present(ctx, err)
	}
	return &sharedTransferOutput{Body: value}, nil
}
func registerSharedTransfers(api huma.API, h *handler.Handler) {
	create := sharedMutation(h, "files.public.transfers.create", http.MethodPost, "/{token}/transfers")
	huma.Register(api, create, func(ctx context.Context, input *sharedTransferCreateInput) (*sharedTransferOutput, error) {
		value, err := h.ShareTransfers.Create(ctx, input.Token, input.Grant, input.Body)
		if err == nil {
			h.Logger.Info("files.share.transfer.created")
		}
		return sharedTransferResult(ctx, h, value, err)
	})
	huma.Register(api, publicShareOperation("files.public.transfers.read", http.MethodGet, "/{token}/transfers/{id}", false), func(ctx context.Context, input *publicContentInput) (*sharedTransferOutput, error) {
		value, err := h.ShareTransfers.Read(ctx, input.Token, input.Grant, input.ID)
		return sharedTransferResult(ctx, h, value, err)
	})
	for _, action := range []struct {
		id, path, event string
		run             func(context.Context, string, string, string) (service.SharedTransfer, error)
	}{
		{"files.public.transfers.commit", "commit", "files.share.transfer.completed", func(ctx context.Context, token, ticket, id string) (service.SharedTransfer, error) {
			return h.ShareTransfers.Commit(ctx, token, ticket, id)
		}},
		{"files.public.transfers.cancel", "cancel", "files.share.transfer.canceled", func(ctx context.Context, token, ticket, id string) (service.SharedTransfer, error) {
			return h.ShareTransfers.Cancel(ctx, token, ticket, id)
		}},
	} {
		op := publicShareOperation(action.id, http.MethodPost, "/{token}/transfers/{id}/"+action.path, false)
		op.Middlewares = append(op.Middlewares, shareOrigin(h))
		if action.path == "commit" {
			op = transferBudget(op)
			op.Middlewares = append(op.Middlewares, transferAdmission(h))
		}
		huma.Register(api, op, func(ctx context.Context, input *publicContentInput) (*sharedTransferOutput, error) {
			value, err := action.run(ctx, input.Token, input.Grant, input.ID)
			if err == nil {
				h.Logger.Info(action.event)
			}
			return sharedTransferResult(ctx, h, value, err)
		})
	}
	for _, method := range []string{http.MethodHead, http.MethodPatch} {
		id := "files.public.transfers.offset"
		if method == http.MethodPatch {
			id = "files.public.transfers.chunk"
		}
		op := transferBudget(publicShareOperation(id, method, "/{token}/transfers/{id}/data", false))
		if method == http.MethodPatch {
			op.DefaultStatus = http.StatusNoContent
			op.Middlewares = append(op.Middlewares, shareOrigin(h), transferAdmission(h))
		}
		huma.Register(api, op, func(ctx context.Context, input *publicContentInput) (*contentOutput, error) {
			return &contentOutput{Body: func(raw huma.Context) {
				request, _ := humabinding.UnwrapHTTP(raw)
				started := false
				err := h.ShareTransfers.RunReceiving(ctx, input.Token, input.Grant, input.ID, func(locked context.Context) error {
					request, writer := humabinding.BeginRawHTTP(raw)
					started = true
					request = request.WithContext(locked)
					if request.Method == http.MethodPatch {
						request.Body = http.MaxBytesReader(writer, request.Body, h.Transfers.ChunkBytes())
					}
					h.TransferProtocol.Handle(writer, request, input.ID)
					return nil
				})
				if err != nil {
					if !started {
						_, writer := humabinding.BeginRawHTTP(raw)
						httpx.WriteProblem(writer, request, h.Present(ctx, err))
					} else {
						h.Logger.Error("files.share.transfer.release.failed", logger.String("code", "cleanup"))
					}
				}
			}}, nil
		})
	}
}
