package httpbinding

import (
	"context"
	"io"
	"net/http"
	"strconv"

	"github.com/danielgtaylor/huma/v2"
	"github.com/reina0721/clouddrive/internal/module/files/binding/permission"
	"github.com/reina0721/clouddrive/internal/module/files/handler"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/internal/transport/http/humabinding"
)

const wopiFilePath = "/wopi/files/{id}"
const wopiItemVersionHeader = "X-WOPI-ItemVersion"

type wopiDiscoveryInput struct {
	Body struct {
		Endpoint string `json:"endpoint" minLength:"1" maxLength:"2048"`
	}
}

type wopiDiscoveryOutput struct {
	Body service.WOPIDiscoveryDraft
}

type wopiFileInput struct {
	ID    string `path:"id"`
	Token string `query:"access_token"`
}

type wopiContentInput struct {
	ID               string `path:"id"`
	Token            string `query:"access_token"`
	MaxExpectedBytes int64  `header:"X-WOPI-MaxExpectedSize" minimum:"0" default:"2147483647"`
}

type wopiFileInfoOutput struct {
	Body service.WOPIFileInfo
}

func registerWOPI(api huma.API, h *handler.Handler, operation func(string, string, string, string, bool) huma.Operation) {
	discover := operation("files.applications.wopi-discover", http.MethodPost, "/applications/wopi-discovery", string(permission.SettingsWrite), true)
	discover.MaxBodyBytes = 8 << 10
	discover.Middlewares = append(discover.Middlewares, sharingHeaders)
	huma.Register(api, discover, func(ctx context.Context, input *wopiDiscoveryInput) (*wopiDiscoveryOutput, error) {
		result, err := h.WOPIDiscovery.Discover(ctx, input.Body.Endpoint)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &wopiDiscoveryOutput{Body: result}, nil
	})
	info := wopiReadOperation("files.public.wopi.info", wopiFilePath, humabinding.Definition{})
	huma.Register(api, info, func(ctx context.Context, input *wopiFileInput) (*wopiFileInfoOutput, error) {
		result, err := h.WebFilePreviews.InspectWOPI(ctx, input.Token, input.ID)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &wopiFileInfoOutput{Body: result}, nil
	})
	content := wopiReadOperation("files.public.wopi.contents", wopiFilePath+"/contents", humabinding.Definition{Budget: humabinding.BudgetTransfer})
	content.Middlewares = append(content.Middlewares, transferAdmission(h))
	content.Responses = map[string]*huma.Response{"200": {
		Description: "WOPI 只读文件内容",
		Content: map[string]*huma.MediaType{
			"application/octet-stream": {Schema: &huma.Schema{Type: "string", Format: "binary"}},
		},
	}}
	huma.Register(api, content, func(ctx context.Context, input *wopiContentInput) (*contentOutput, error) {
		return &contentOutput{Body: func(raw huma.Context) {
			_, writer := humabinding.UnwrapHTTP(raw)
			contentResponse(ctx, h, func(ctx context.Context, use func(model.Entry, io.ReadSeeker) error) error {
				return h.WebFilePreviews.DownloadWOPITo(ctx, input.Token, input.ID, func(entry model.Entry, reader io.ReadSeeker) error {
					if entry.SizeBytes > input.MaxExpectedBytes {
						return service.ErrContentPrecondition
					}
					writer.Header().Set(wopiItemVersionHeader, strconv.FormatInt(entry.ContentRevision, 10))
					return use(entry, reader)
				})
			}).Body(raw)
		}}, nil
	})
}

func wopiReadOperation(id, path string, definition humabinding.Definition) huma.Operation {
	definition.Security, definition.Policy = humabinding.SecurityNone, humabinding.PolicyPublic
	op := humabinding.Define(huma.Operation{
		OperationID: id, Method: http.MethodGet, Path: path, Tags: []string{"WOPI"},
	}, definition)
	op.Middlewares = append(op.Middlewares, sharingHeaders)
	return op
}
