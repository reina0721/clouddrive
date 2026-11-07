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
)

const directLinkPrefix = "/api/v1/file-direct-links"

type directLinkIssueInput struct {
	Body struct {
		IDs []string `json:"ids" minItems:"1" maxItems:"10"`
	}
}
type directLinkIssueOutput struct {
	Body struct {
		Results []service.DirectLinkResult `json:"results"`
	}
}
type directLinkListInput struct {
	Page int `query:"page" minimum:"1" maximum:"10" default:"1"`
}
type directLinkListOutput struct{ Body service.DirectLinkPage }
type directLinkRevokeInput struct {
	ID string `path:"id" minLength:"36" maxLength:"36"`
}
type directLinkContentInput struct {
	Token    string `path:"token"`
	Download bool   `query:"download"`
}

func registerDirectLinks(api huma.API, h *handler.Handler, operation func(string, string, string, string, bool) huma.Operation) {
	private := func(id, method, suffix, scope string, jsonBody bool) huma.Operation {
		op := operation(id, method, "/direct-links"+suffix, scope, jsonBody)
		op.Middlewares = append(op.Middlewares, sharingHeaders)
		return op
	}
	huma.Register(api, private("files.direct-links.list", http.MethodGet, "", "files:read", false), func(ctx context.Context, input *directLinkListInput) (*directLinkListOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		page, err := h.DirectLinks.List(ctx, owner, input.Page)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &directLinkListOutput{Body: page}, nil
	})
	huma.Register(api, private("files.direct-links.issue", http.MethodPost, "", "files:write", true), func(ctx context.Context, input *directLinkIssueInput) (*directLinkIssueOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		results, err := h.DirectLinks.Issue(ctx, owner, input.Body.IDs)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		result := &directLinkIssueOutput{}
		result.Body.Results = results
		return result, nil
	})
	revoke := private("files.direct-links.revoke", http.MethodDelete, "/{id}", "files:write", false)
	revoke.DefaultStatus = http.StatusNoContent
	huma.Register(api, revoke, func(ctx context.Context, input *directLinkRevokeInput) (*struct{}, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		if err := h.DirectLinks.Revoke(ctx, owner, input.ID); err != nil {
			return nil, h.Present(ctx, err)
		}
		return &struct{}{}, nil
	})
	registerDirectContent(api, h, "files.public.direct-links.content", http.MethodGet)
	registerDirectContent(api, h, "files.public.direct-links.head", http.MethodHead)
}

func registerDirectContent(api huma.API, h *handler.Handler, id, method string) {
	op := humabinding.Define(huma.Operation{
		OperationID: id, Method: method, Path: directLinkPrefix + "/{token}", Tags: []string{"File Direct Links"},
		Responses: map[string]*huma.Response{"200": {
			Description: "单文件直链、条件请求及字节范围",
			Content: map[string]*huma.MediaType{
				"application/octet-stream": {Schema: &huma.Schema{Type: "string", Format: "binary"}},
			},
		}},
	}, humabinding.Definition{Security: humabinding.SecurityNone, Policy: humabinding.PolicyPublic, Budget: humabinding.BudgetTransfer})
	op.Middlewares = append(op.Middlewares, sharingHeaders, transferAdmission(h))
	huma.Register(api, op, func(ctx context.Context, input *directLinkContentInput) (*contentOutput, error) {
		delivery := contentInline
		if input.Download {
			delivery = contentAttachment
		}
		return contentWithDelivery(ctx, h, delivery, func(ctx context.Context, use func(model.Entry, io.ReadSeeker) error) error {
			return h.DirectLinks.DownloadTo(ctx, input.Token, use)
		}), nil
	})
}
