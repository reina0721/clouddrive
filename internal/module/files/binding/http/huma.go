// Package httpbinding 声明文件模块唯一的 typed HTTP operation 源头。
package httpbinding

import (
	"context"
	"github.com/danielgtaylor/huma/v2"
	"github.com/reina0721/clouddrive/internal/module/files/handler"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/internal/transport/http/humabinding"
	"github.com/reina0721/clouddrive/pkg/httpx"
	"io"
	"net/http"
	"time"
)

const prefix = "/api/v1/files"

type listInput struct {
	Parent        string                          `query:"parent" maxLength:"36"`
	Search        string                          `query:"search" maxLength:"255"`
	Category      string                          `query:"category"`
	Trash         bool                            `query:"trash"`
	Sort          service.SortKey                 `query:"sort" enum:"name,size,updated,created"`
	Desc          bool                            `query:"desc"`
	Scope         service.SearchScope             `query:"scope" enum:"auto,folder,tree,all"`
	Keywords      []string                        `query:"keywords,explode" maxItems:"8"`
	CaseSensitive bool                            `query:"caseSensitive"`
	Match         service.KeywordMatch            `query:"match" enum:"all,any"`
	Kinds         []string                        `query:"kinds,explode" maxItems:"3"`
	Extensions    []string                        `query:"extensions,explode" maxItems:"16"`
	MinBytes      humabinding.Optional[int64]     `query:"minBytes" minimum:"0"`
	MaxBytes      humabinding.Optional[int64]     `query:"maxBytes" minimum:"0"`
	CreatedFrom   humabinding.Optional[time.Time] `query:"createdFrom"`
	CreatedTo     humabinding.Optional[time.Time] `query:"createdTo"`
	ModifiedFrom  humabinding.Optional[time.Time] `query:"modifiedFrom"`
	ModifiedTo    humabinding.Optional[time.Time] `query:"modifiedTo"`
	FoldersFirst  bool                            `query:"foldersFirst"`
	Page          int                             `query:"page" default:"1" minimum:"1" maximum:"10000"`
	PageSize      int                             `query:"pageSize" minimum:"0" maximum:"200"`
	Tags          []string                        `query:"tags,explode" maxItems:"8"`
	TagMatch      service.KeywordMatch            `query:"tagMatch" enum:"all,any"`
	PropertyKey   string                          `query:"propertyKey" maxLength:"64"`
	PropertyMatch service.PropertyMatch           `query:"propertyMatch" enum:"exists,equals,contains"`
	PropertyValue string                          `query:"propertyValue" maxLength:"256"`
}
type listOutput struct{ Body service.Listing }
type entryOutput struct{ Body model.Entry }
type folderInput struct {
	Body struct {
		Name     string `json:"name" minLength:"1" maxLength:"255"`
		ParentID string `json:"parentId"`
	}
}
type pathInput struct {
	ID string `path:"id" maxLength:"36" minLength:"1"`
}
type changeInput struct {
	ID   string `path:"id"`
	Body service.Change
}
type restoreInput struct {
	ID   string `path:"id"`
	Body struct {
		ParentID *string `json:"parentId,omitempty"`
	}
}
type detailOutput struct{ Body service.Detail }
type contentOutput struct{ Body func(huma.Context) }

func operation(id, method, suffix, scope string, jsonBody bool) huma.Operation {
	op := huma.Operation{OperationID: id, Method: method, Path: prefix + suffix, Tags: []string{"Files"}, DefaultStatus: 200}
	definition := humabinding.Definition{Security: humabinding.SecurityWebUISession, Policy: humabinding.PolicyProtected, Scope: scope, Action: id}
	if jsonBody {
		return humabinding.JSONDefinition(op, definition)
	}
	return humabinding.Define(op, definition)
}

type MutationGuard interface{ ValidateMutation(*http.Request) error }

func HumaRegistration(h *handler.Handler, guard MutationGuard) humabinding.Registration {
	return func(api huma.API) { Register(api, h, guard) }
}
func Register(api huma.API, h *handler.Handler, guard MutationGuard) {
	operation := func(id, method, suffix, scope string, jsonBody bool) huma.Operation {
		op := operation(id, method, suffix, scope, jsonBody)
		if method != http.MethodGet && method != http.MethodHead && method != http.MethodOptions {
			op.Middlewares = append(op.Middlewares, func(ctx huma.Context, next func(huma.Context)) {
				request, writer := humabinding.UnwrapHTTP(ctx)
				if guard == nil {
					httpx.WriteProblem(writer, request, &httpx.StatusError{StatusCode: 503, Code: "files_mutation_guard_unavailable", Message: "file mutation guard unavailable"})
					return
				}
				if err := guard.ValidateMutation(request); err != nil {
					httpx.WriteProblem(writer, request, err)
					return
				}
				next(ctx)
			})
		}
		return op
	}
	registerOperations(api, h, operation)
	registerArchives(api, h, operation)
	registerArchiveTasks(api, h, operation)
	registerSharing(api, h, operation)
	registerTransfers(api, h, operation)
	registerDownloads(api, h, operation)
	registerTorrents(api, h, operation)
	registerConnections(api, h, operation)
	registerWriteLocks(api, h, operation)
	registerNavigation(api, h, operation)
	registerPreferences(api, h, operation)
	registerAnnotations(api, h, operation)
	registerVersions(api, h, operation)
	huma.Register(api, operation("files.list", "GET", "", "files:read", false), func(ctx context.Context, input *listInput) (*listOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		kinds := make([]model.Kind, len(input.Kinds))
		for index, kind := range input.Kinds {
			kinds[index] = model.Kind(kind)
		}
		var property *service.AnnotationPropertyFilter
		if input.PropertyKey != "" || input.PropertyMatch != "" || input.PropertyValue != "" {
			property = &service.AnnotationPropertyFilter{Key: input.PropertyKey, Match: input.PropertyMatch, Value: input.PropertyValue}
		}
		result, err := h.Service.List(ctx, owner, service.Query{ParentID: input.Parent, Search: input.Search, Category: input.Category, Trash: input.Trash, Sort: input.Sort, Desc: input.Desc, Scope: input.Scope, Keywords: input.Keywords, CaseSensitive: input.CaseSensitive, Match: input.Match, Kinds: kinds, Extensions: input.Extensions, MinBytes: input.MinBytes.Pointer(), MaxBytes: input.MaxBytes.Pointer(), CreatedFrom: input.CreatedFrom.Pointer(), CreatedTo: input.CreatedTo.Pointer(), ModifiedFrom: input.ModifiedFrom.Pointer(), ModifiedTo: input.ModifiedTo.Pointer(), FoldersFirst: input.FoldersFirst, Page: input.Page, PageSize: input.PageSize, Tags: input.Tags, TagMatch: input.TagMatch, Property: property})
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &listOutput{Body: result}, nil
	})
	huma.Register(api, operation("files.folder", "POST", "/folders", "files:write", true), func(ctx context.Context, input *folderInput) (*entryOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		entry, err := h.Service.Folder(ctx, owner, input.Body.ParentID, input.Body.Name)
		return result(ctx, h, entry, err)
	})
	huma.Register(api, operation("files.detail", "GET", "/{id}", "files:read", false), func(ctx context.Context, input *pathInput) (*detailOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		detail, err := h.Service.Detail(ctx, owner, input.ID)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &detailOutput{Body: detail}, nil
	})
	huma.Register(api, operation("files.update", "PATCH", "/{id}", "files:write", true), func(ctx context.Context, input *changeInput) (*entryOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		entry, err := h.Service.Update(ctx, owner, input.ID, input.Body)
		return result(ctx, h, entry, err)
	})
	huma.Register(api, operation("files.trash", "POST", "/{id}/trash", "files:write", false), func(ctx context.Context, input *pathInput) (*entryOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		entry, err := h.Service.Trash(ctx, owner, input.ID)
		return result(ctx, h, entry, err)
	})
	huma.Register(api, operation("files.restore", "POST", "/{id}/restore", "files:write", true), func(ctx context.Context, input *restoreInput) (*entryOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		entry, err := h.Service.Restore(ctx, owner, input.ID, input.Body.ParentID)
		return result(ctx, h, entry, err)
	})

	for _, method := range []string{http.MethodGet, http.MethodHead} {
		id := "files.content"
		if method == http.MethodHead {
			id = "files.content.head"
		}
		download := transferBudget(operation(id, method, "/{id}/content", "files:read", false))
		download.Middlewares = append(download.Middlewares, transferAdmission(h))
		download.Responses = map[string]*huma.Response{"200": {Description: "文件原始内容和字节范围", Content: map[string]*huma.MediaType{"application/octet-stream": {Schema: &huma.Schema{Type: "string", Format: "binary"}}}}}
		huma.Register(api, download, func(ctx context.Context, input *pathInput) (*contentOutput, error) {
			owner, err := h.Owner(ctx)
			if err != nil {
				return nil, h.Present(ctx, err)
			}
			return contentResponse(ctx, h, func(ctx context.Context, use func(model.Entry, io.ReadSeeker) error) error {
				return h.Service.DownloadTo(ctx, owner, input.ID, use)
			}), nil
		})
	}

}
func result(ctx context.Context, h *handler.Handler, entry model.Entry, err error) (*entryOutput, error) {
	if err != nil {
		return nil, h.Present(ctx, err)
	}
	h.Logger.Info("files.mutation.succeeded")
	return &entryOutput{Body: entry}, nil
}
