package httpbinding

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	webdavbinding "github.com/reina0721/clouddrive/internal/module/files/binding/webdav"
	"github.com/reina0721/clouddrive/internal/module/files/handler"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/internal/transport/http/humabinding"
)

type connectionOriginContextKey struct{}

// connectionOrigin 由本绑定的必经中间件填充，缺失属于装配错误，不能伪造默认地址。
func connectionOrigin(ctx context.Context, h *handler.Handler) string {
	if h.ConnectionOrigin != "" {
		return h.ConnectionOrigin
	}
	return ctx.Value(connectionOriginContextKey{}).(string)
}

const maxConnectionControlBytes int64 = 4096

type connectionListInput struct {
	Cursor string `query:"cursor" maxLength:"36"`
	Limit  int    `query:"limit" minimum:"1" maximum:"100" default:"20"`
}
type connectionSummaryView struct {
	service.ConnectionSummary
	EndpointPath   string `json:"endpointPath"`
	EndpointOrigin string `json:"endpointOrigin"`
}
type connectionIssuedView struct {
	service.ConnectionIssued
	EndpointPath   string `json:"endpointPath"`
	EndpointOrigin string `json:"endpointOrigin"`
}
type connectionListView struct {
	Items             []connectionSummaryView `json:"items"`
	NextCursor        string                  `json:"nextCursor"`
	Limit             int                     `json:"limit"`
	DefaultAgeSeconds int64                   `json:"defaultAgeSeconds"`
	MaxAgeSeconds     int64                   `json:"maxAgeSeconds"`
	MetadataLimited   bool                    `json:"metadataLimited"`
}

func connectionPage(page service.ConnectionListing, origin string) connectionListView {
	result := connectionListView{Items: []connectionSummaryView{}, NextCursor: page.NextCursor, Limit: page.Limit, DefaultAgeSeconds: page.DefaultAgeSeconds, MaxAgeSeconds: page.MaxAgeSeconds, MetadataLimited: page.MetadataLimited}
	for _, item := range page.Items {
		result.Items = append(result.Items, connectionSummaryView{ConnectionSummary: item, EndpointOrigin: origin, EndpointPath: webdavbinding.Endpoint(item.ID)})
	}
	return result
}

type connectionListOutput struct{ Body connectionListView }
type connectionCreateInput struct{ Body service.ConnectionRequest }
type connectionReadInput struct {
	ID string `path:"connectionId" minLength:"36" maxLength:"36"`
}
type connectionIssuedOutput struct{ Body connectionIssuedView }
type connectionSummaryOutput struct{ Body connectionSummaryView }
type connectionUpdateInput struct {
	ID   string `path:"connectionId" minLength:"36" maxLength:"36"`
	Body service.ConnectionChange
}
type connectionStateInput struct {
	ID   string `path:"connectionId" minLength:"36" maxLength:"36"`
	Body struct {
		Revision int64                 `json:"revision" minimum:"1"`
		State    model.ConnectionState `json:"state" enum:"active,disabled,revoked"`
	}
}
type connectionRotateInput struct {
	ID   string `path:"connectionId" minLength:"36" maxLength:"36"`
	Body struct {
		Revision int64 `json:"revision" minimum:"1"`
	}
}

func registerConnections(api huma.API, h *handler.Handler, operation func(string, string, string, string, bool) huma.Operation) {
	baseOperation := operation
	operation = func(id, method, suffix, scope string, jsonBody bool) huma.Operation {
		op := baseOperation(id, method, suffix, scope, jsonBody)
		if jsonBody {
			op.MaxBodyBytes = maxConnectionControlBytes
		}
		op.Middlewares = append(op.Middlewares, func(ctx huma.Context, next func(huma.Context)) {
			request, writer := humabinding.UnwrapHTTP(ctx)
			writer.Header().Set("Cache-Control", "private, no-store")
			writer.Header().Set("Referrer-Policy", "no-referrer")
			scheme := "http"
			if request.TLS != nil {
				scheme = "https"
			}
			// 不采用未经信任的Forwarded头；HTTPS代理由publicOrigin明确声明。
			next(huma.WithValue(ctx, connectionOriginContextKey{}, scheme+"://"+request.Host))
		})
		return op
	}
	huma.Register(api, operation("files.connections.list", http.MethodGet, "/connections", "files:read", false), func(ctx context.Context, input *connectionListInput) (*connectionListOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		page, err := h.Connections.List(ctx, owner, input.Cursor, input.Limit)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &connectionListOutput{Body: connectionPage(page, connectionOrigin(ctx, h))}, nil
	})
	huma.Register(api, operation("files.connections.read", http.MethodGet, "/connections/{connectionId}", "files:read", false), func(ctx context.Context, input *connectionReadInput) (*connectionSummaryOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		summary, err := h.Connections.Read(ctx, owner, input.ID)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &connectionSummaryOutput{Body: connectionSummaryView{ConnectionSummary: summary, EndpointOrigin: connectionOrigin(ctx, h), EndpointPath: webdavbinding.Endpoint(summary.ID)}}, nil
	})
	huma.Register(api, operation("files.connections.create", http.MethodPost, "/connections", "files:write", true), func(ctx context.Context, input *connectionCreateInput) (*connectionIssuedOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		issued, err := h.Connections.Create(ctx, owner, input.Body)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		h.Logger.Info("files.connection.created")
		return &connectionIssuedOutput{Body: connectionIssuedView{ConnectionIssued: issued, EndpointOrigin: connectionOrigin(ctx, h), EndpointPath: webdavbinding.Endpoint(issued.ID)}}, nil
	})
	huma.Register(api, operation("files.connections.update", http.MethodPatch, "/connections/{connectionId}", "files:write", true), func(ctx context.Context, input *connectionUpdateInput) (*connectionSummaryOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		summary, err := h.Connections.Update(ctx, owner, input.ID, input.Body)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		h.Logger.Info("files.connection.updated")
		return &connectionSummaryOutput{Body: connectionSummaryView{ConnectionSummary: summary, EndpointOrigin: connectionOrigin(ctx, h), EndpointPath: webdavbinding.Endpoint(summary.ID)}}, nil
	})
	huma.Register(api, operation("files.connections.state", http.MethodPost, "/connections/{connectionId}/state", "files:write", true), func(ctx context.Context, input *connectionStateInput) (*connectionSummaryOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		summary, err := h.Connections.SetState(ctx, owner, input.ID, input.Body.Revision, input.Body.State)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		h.Logger.Info("files.connection.state.changed")
		return &connectionSummaryOutput{Body: connectionSummaryView{ConnectionSummary: summary, EndpointOrigin: connectionOrigin(ctx, h), EndpointPath: webdavbinding.Endpoint(summary.ID)}}, nil
	})
	huma.Register(api, operation("files.connections.rotate", http.MethodPost, "/connections/{connectionId}/rotate", "files:write", true), func(ctx context.Context, input *connectionRotateInput) (*connectionIssuedOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		issued, err := h.Connections.Rotate(ctx, owner, input.ID, input.Body.Revision)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		h.Logger.Info("files.connection.rotated")
		return &connectionIssuedOutput{Body: connectionIssuedView{ConnectionIssued: issued, EndpointOrigin: connectionOrigin(ctx, h), EndpointPath: webdavbinding.Endpoint(issued.ID)}}, nil
	})
}
