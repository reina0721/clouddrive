package httpbinding

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/reina0721/clouddrive/internal/module/files/handler"
	"github.com/reina0721/clouddrive/internal/module/files/service"
)

type archiveTaskCreateInput struct {
	ID   string `path:"id" minLength:"1" maxLength:"36"`
	Body service.ArchiveTaskInput
}
type archiveTaskOutput struct{ Body service.ArchiveTask }
type archiveTaskListOutput struct{ Body service.ArchiveTaskListing }

func registerArchiveTasks(api huma.API, h *handler.Handler, operation func(string, string, string, string, bool) huma.Operation) {
	create := operation("files.archive-tasks.create", http.MethodPost, "/{id}/archive/tasks", "files:write", true)
	create.DefaultStatus = http.StatusAccepted
	create.MaxBodyBytes = service.ArchiveTaskRequestBytes
	huma.Register(api, create, func(ctx context.Context, input *archiveTaskCreateInput) (*archiveTaskOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		task, err := h.ArchiveTasks.Create(ctx, owner, input.ID, input.Body)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &archiveTaskOutput{Body: task}, nil
	})
	huma.Register(api, operation("files.archive-tasks.list", http.MethodGet, "/archive-tasks", "files:read", false), func(ctx context.Context, _ *struct{}) (*archiveTaskListOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		tasks, err := h.ArchiveTasks.List(ctx, owner)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &archiveTaskListOutput{Body: tasks}, nil
	})
	huma.Register(api, operation("files.archive-tasks.read", http.MethodGet, "/archive-tasks/{id}", "files:read", false), func(ctx context.Context, input *pathInput) (*archiveTaskOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		task, err := h.ArchiveTasks.Read(ctx, owner, input.ID)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &archiveTaskOutput{Body: task}, nil
	})
	registerAction := func(id, method, suffix string, change func(context.Context, string, string) error) {
		op := operation(id, method, suffix, "files:write", false)
		op.DefaultStatus = http.StatusNoContent
		huma.Register(api, op, func(ctx context.Context, input *pathInput) (*struct{}, error) {
			owner, err := h.Owner(ctx)
			if err != nil {
				return nil, h.Present(ctx, err)
			}
			if err := change(ctx, owner, input.ID); err != nil {
				return nil, h.Present(ctx, err)
			}
			return nil, nil
		})
	}
	registerAction("files.archive-tasks.cancel", http.MethodPost, "/archive-tasks/{id}/cancel", func(ctx context.Context, owner, id string) error {
		return h.ArchiveTasks.Cancel(ctx, owner, id)
	})
	registerAction("files.archive-tasks.remove", http.MethodDelete, "/archive-tasks/{id}", func(ctx context.Context, owner, id string) error {
		return h.ArchiveTasks.Remove(ctx, owner, id)
	})
}
