package httpbinding

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/reina0721/clouddrive/internal/module/files/binding/permission"
	"github.com/reina0721/clouddrive/internal/module/files/handler"
	"github.com/reina0721/clouddrive/internal/module/files/service"
)

type workerNodesOutput struct {
	Body struct {
		service.WorkerNodeCatalog
		CanReadTasks bool `json:"canReadTasks"`
	}
}

type workerNodeCheckInput struct {
	ID string `path:"id" minLength:"1" maxLength:"64" pattern:"^[a-z0-9_-]+$"`
}

type workerNodeCheckOutput struct{ Body service.WorkerNodeCheck }

func registerWorkerNodes(api huma.API, h *handler.Handler, operation func(string, string, string, string, bool) huma.Operation) {
	const path = "/worker-nodes"
	list := operation("files.worker-nodes.list", http.MethodGet, path, string(permission.WorkerNodeRead), false)
	list.Middlewares = append(list.Middlewares, sharingHeaders)
	huma.Register(api, list, func(ctx context.Context, _ *struct{}) (*workerNodesOutput, error) {
		actor, err := h.Owner(ctx)
		if err != nil {
			return nil, err
		}
		allowed, err := h.AdminTaskAccess.AuthorizeAdminTaskRead(ctx, actor)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		output := &workerNodesOutput{}
		output.Body.WorkerNodeCatalog, output.Body.CanReadTasks = h.WorkerNodes.Catalog(), allowed
		return output, nil
	})
	check := operation("files.worker-nodes.check", http.MethodGet, path+"/{id}/check", string(permission.WorkerNodeRead), false)
	check.Middlewares = append(check.Middlewares, sharingHeaders)
	huma.Register(api, check, func(ctx context.Context, input *workerNodeCheckInput) (*workerNodeCheckOutput, error) {
		result, err := h.WorkerNodes.Check(ctx, input.ID)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &workerNodeCheckOutput{Body: result}, nil
	})
}
