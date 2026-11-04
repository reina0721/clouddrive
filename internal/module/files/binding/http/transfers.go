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

type transferInput struct {
	ID string `path:"id" minLength:"36" maxLength:"36"`
}

const maxTransferControlBodyBytes int64 = 4096

type transferCreateInput struct{ Body service.TransferRequest }
type transferOutput struct{ Body service.TransferSummary }
type transferListInput struct {
	State  string `query:"state" enum:",active,attention,completed"`
	Cursor string `query:"cursor" maxLength:"36"`
	Limit  int    `query:"limit" minimum:"1" maximum:"100" default:"20"`
}
type transferListOutput struct{ Body service.TransferListing }
type transferSourceInput struct {
	ID   string `path:"id" minLength:"36" maxLength:"36"`
	Body struct {
		SHA256    string `json:"sha256" minLength:"64" maxLength:"64"`
		SizeBytes int64  `json:"sizeBytes" minimum:"0"`
	}
}
type transferTargetInput struct {
	ID   string `path:"id" minLength:"36" maxLength:"36"`
	Body struct {
		ParentID string `json:"parentId" maxLength:"36"`
		Name     string `json:"name" minLength:"1" maxLength:"255"`
	}
}

func transferResult(ctx context.Context, h *handler.Handler, transfer service.TransferSummary, err error) (*transferOutput, error) {
	if err != nil {
		return nil, h.Present(ctx, err)
	}
	return &transferOutput{Body: transfer}, nil
}

func registerTransfers(api huma.API, h *handler.Handler, operation func(string, string, string, string, bool) huma.Operation) {
	baseOperation := operation
	operation = func(id, method, suffix, scope string, jsonBody bool) huma.Operation {
		op := baseOperation(id, method, suffix, scope, jsonBody)
		if jsonBody {
			op.MaxBodyBytes = maxTransferControlBodyBytes
		}
		return op
	}
	huma.Register(api, operation("files.transfers.create", http.MethodPost, "/transfers", "files:write", true), func(ctx context.Context, input *transferCreateInput) (*transferOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		transfer, err := h.Transfers.Create(ctx, owner, input.Body)
		if err == nil {
			h.Logger.Info("files.transfer.created")
		}
		return transferResult(ctx, h, transfer, err)
	})
	huma.Register(api, operation("files.transfers.list", http.MethodGet, "/transfers", "files:read", false), func(ctx context.Context, input *transferListInput) (*transferListOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		page, err := h.Transfers.List(ctx, owner, input.State, input.Cursor, input.Limit)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &transferListOutput{Body: page}, nil
	})
	huma.Register(api, operation("files.transfers.read", http.MethodGet, "/transfers/{id}", "files:read", false), func(ctx context.Context, input *transferInput) (*transferOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		transfer, err := h.Transfers.Read(ctx, owner, input.ID)
		return transferResult(ctx, h, transfer, err)
	})
	for _, kind := range []struct {
		id    string
		path  string
		event string
		run   func(context.Context, string, string) (service.TransferSummary, error)
	}{
		{"files.transfers.pause", "pause", "files.transfer.paused", func(ctx context.Context, owner, id string) (service.TransferSummary, error) {
			return h.Transfers.Pause(ctx, owner, id)
		}},
		{"files.transfers.resume", "resume", "files.transfer.resumed", func(ctx context.Context, owner, id string) (service.TransferSummary, error) {
			return h.Transfers.Resume(ctx, owner, id)
		}},
		{"files.transfers.cancel", "cancel", "files.transfer.canceled", func(ctx context.Context, owner, id string) (service.TransferSummary, error) {
			return h.Transfers.Cancel(ctx, owner, id)
		}},
		{"files.transfers.commit", "commit", "files.transfer.completed", func(ctx context.Context, owner, id string) (service.TransferSummary, error) {
			return h.Transfers.Commit(ctx, owner, id)
		}},
	} {
		op := operation(kind.id, http.MethodPost, "/transfers/{id}/"+kind.path, "files:write", false)
		if kind.path == "commit" {
			op = transferBudget(op)
			op.Middlewares = append(op.Middlewares, transferAdmission(h))
		}
		huma.Register(api, op, func(ctx context.Context, input *transferInput) (*transferOutput, error) {
			owner, err := h.Owner(ctx)
			if err != nil {
				return nil, h.Present(ctx, err)
			}
			transfer, err := kind.run(ctx, owner, input.ID)
			if err == nil {
				h.Logger.Info(kind.event)
			}
			return transferResult(ctx, h, transfer, err)
		})
	}
	huma.Register(api, operation("files.transfers.source", http.MethodPost, "/transfers/{id}/source", "files:write", true), func(ctx context.Context, input *transferSourceInput) (*transferOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		transfer, err := h.Transfers.MatchSource(ctx, owner, input.ID, input.Body.SHA256, input.Body.SizeBytes)
		return transferResult(ctx, h, transfer, err)
	})
	huma.Register(api, operation("files.transfers.target", http.MethodPut, "/transfers/{id}/target", "files:write", true), func(ctx context.Context, input *transferTargetInput) (*transferOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		transfer, err := h.Transfers.Retarget(ctx, owner, input.ID, input.Body.ParentID, input.Body.Name)
		return transferResult(ctx, h, transfer, err)
	})
	for _, method := range []string{http.MethodHead, http.MethodPatch} {
		id, scope := "files.transfers.offset", "files:read"
		if method == http.MethodPatch {
			id, scope = "files.transfers.chunk", "files:write"
		}
		op := transferBudget(operation(id, method, "/transfers/{id}/data", scope, false))
		if method == http.MethodPatch {
			op.DefaultStatus = http.StatusNoContent
		}
		if method == http.MethodPatch {
			op.Middlewares = append(op.Middlewares, transferAdmission(h))
		}
		huma.Register(api, op, func(ctx context.Context, input *transferInput) (*contentOutput, error) {
			owner, err := h.Owner(ctx)
			if err != nil {
				return nil, h.Present(ctx, err)
			}
			return &contentOutput{Body: func(raw huma.Context) {
				request, _ := humabinding.UnwrapHTTP(raw)
				started := false
				err := h.Transfers.RunReceiving(ctx, owner, input.ID, func(locked context.Context) error {
					request, writer := humabinding.BeginRawHTTP(raw)
					started = true
					request = request.WithContext(locked)
					writer.Header().Set("Cache-Control", "private, no-store")
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
						h.Logger.Error("files.transfer.release.failed", logger.String("code", "cleanup"))
					}
				}
			}}, nil
		})
	}
}

func transferBudget(op huma.Operation) huma.Operation {
	definition, _ := humabinding.DefinitionOf(&op)
	definition.Budget = humabinding.BudgetTransfer
	return humabinding.Define(op, definition)
}
