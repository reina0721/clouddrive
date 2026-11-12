package httpbinding

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/reina0721/clouddrive/internal/module/files/binding/permission"
	"github.com/reina0721/clouddrive/internal/module/files/handler"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/httpx"
)

type AdminTaskFilters struct {
	OwnerID string                       `query:"ownerId" maxLength:"128"`
	NodeID  string                       `query:"nodeId" maxLength:"64" pattern:"^[a-z0-9_-]*$"`
	Kind    service.BackgroundTaskKind   `query:"kind" enum:"all,zip,extract,http,bittorrent,trash-expiry,blob-reclaim" default:"all"`
	Origin  service.AdminTaskOrigin      `query:"origin" enum:"all,user,system" default:"all"`
	Status  service.BackgroundTaskStatus `query:"status" enum:"all,active,completed,failed,canceled,expired" default:"all"`
}

type adminTaskListInput struct {
	AdminTaskFilters
	TaskID    string                     `query:"taskId" maxLength:"36"`
	Sort      service.AdminTaskSort      `query:"sort" enum:"id,created" default:"created"`
	Direction service.InventoryDirection `query:"direction" enum:"asc,desc" default:"desc"`
	Page      int                        `query:"page" minimum:"1" maximum:"10000" default:"1"`
}

type adminTaskListOutput struct {
	Body struct {
		service.AdminTaskPage
		CanCleanup bool `json:"canCleanup"`
	}
}

type adminTaskSummaryInput struct {
	OwnerID string                     `query:"ownerId" maxLength:"128"`
	NodeID  string                     `query:"nodeId" maxLength:"64" pattern:"^[a-z0-9_-]*$"`
	Kind    service.BackgroundTaskKind `query:"kind" enum:"all,zip,extract,http,bittorrent,trash-expiry,blob-reclaim" default:"all"`
	Origin  service.AdminTaskOrigin    `query:"origin" enum:"all,user,system" default:"all"`
	TaskID  string                     `query:"taskId" maxLength:"36"`
}

type adminTaskSummaryOutput struct{ Body service.AdminTaskSummary }

type adminTaskReadInput struct {
	Kind service.BackgroundTaskKind `path:"kind" enum:"zip,extract,http,bittorrent,trash-expiry,blob-reclaim"`
	ID   string                     `path:"id" minLength:"36" maxLength:"36"`
}

type adminTaskReadOutput struct{ Body service.AdminTask }

type adminTaskPreviewInput struct {
	AdminTaskFilters
	Before time.Time `query:"before" required:"true"`
}

type adminTaskPreviewOutput struct{ Body service.AdminTaskPage }

type adminTaskCleanupInput struct {
	Body struct {
		Targets []service.AdminTaskTarget `json:"targets" minItems:"1" maxItems:"20"`
	}
}

type adminTaskOutcome struct {
	service.AdminTaskTarget
	Status int    `json:"status"`
	Code   string `json:"code,omitempty"`
}

type adminTaskCleanupOutput struct {
	Body struct {
		Items []adminTaskOutcome `json:"items"`
	}
}

func registerAdminTasks(api huma.API, h *handler.Handler, operation func(string, string, string, string, bool) huma.Operation) {
	const prefix = "/admin-tasks"
	list := operation("files.admin-tasks.list", http.MethodGet, prefix, string(permission.AdminTaskRead), false)
	list.Middlewares = append(list.Middlewares, sharingHeaders)
	huma.Register(api, list, func(ctx context.Context, input *adminTaskListInput) (*adminTaskListOutput, error) {
		actor, err := h.Owner(ctx)
		if err != nil {
			return nil, err
		}
		allowed, err := h.AdminTaskAccess.AuthorizeAdminTaskCleanup(ctx, actor)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		page, err := h.AdminTasks.List(ctx, service.AdminTaskQuery{OwnerID: input.OwnerID, TaskID: input.TaskID, NodeID: input.NodeID, Kind: input.Kind,
			Origin: input.Origin, Status: input.Status, Sort: input.Sort, Direction: input.Direction, Page: input.Page})
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		output := &adminTaskListOutput{}
		output.Body.AdminTaskPage, output.Body.CanCleanup = page, allowed
		return output, nil
	})
	summary := operation("files.admin-tasks.summary", http.MethodGet, prefix+"/summary", string(permission.AdminTaskRead), false)
	summary.Middlewares = append(summary.Middlewares, sharingHeaders)
	huma.Register(api, summary, func(ctx context.Context, input *adminTaskSummaryInput) (*adminTaskSummaryOutput, error) {
		value, err := h.AdminTasks.Summary(ctx, service.AdminTaskSummaryQuery{OwnerID: input.OwnerID, TaskID: input.TaskID, NodeID: input.NodeID, Kind: input.Kind, Origin: input.Origin})
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &adminTaskSummaryOutput{Body: value}, nil
	})
	read := operation("files.admin-tasks.read", http.MethodGet, prefix+"/{kind}/{id}", string(permission.AdminTaskRead), false)
	read.Middlewares = append(read.Middlewares, sharingHeaders)
	huma.Register(api, read, func(ctx context.Context, input *adminTaskReadInput) (*adminTaskReadOutput, error) {
		value, err := h.AdminTasks.Read(ctx, input.Kind, input.ID)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &adminTaskReadOutput{Body: value}, nil
	})
	preview := operation("files.admin-tasks.cleanup-preview", http.MethodGet, prefix+"/cleanup-preview", string(permission.AdminTaskCleanup), false)
	preview.Middlewares = append(preview.Middlewares, sharingHeaders)
	huma.Register(api, preview, func(ctx context.Context, input *adminTaskPreviewInput) (*adminTaskPreviewOutput, error) {
		if input.Before.IsZero() {
			return nil, h.Present(ctx, model.ErrInvalid)
		}
		page, err := h.AdminTasks.List(ctx, service.AdminTaskQuery{OwnerID: input.OwnerID, NodeID: input.NodeID, Kind: input.Kind, Origin: input.Origin, Status: input.Status,
			Sort: service.AdminTaskByCreated, Direction: service.InventoryAscending, Page: 1, CleanupBefore: input.Before})
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &adminTaskPreviewOutput{Body: page}, nil
	})
	cleanup := operation("files.admin-tasks.cleanup", http.MethodPost, prefix+"/cleanup", string(permission.AdminTaskCleanup), true)
	cleanup.Middlewares = append(cleanup.Middlewares, sharingHeaders)
	huma.Register(api, cleanup, func(ctx context.Context, input *adminTaskCleanupInput) (*adminTaskCleanupOutput, error) {
		results, err := h.AdminTasks.Cleanup(ctx, input.Body.Targets)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		output := &adminTaskCleanupOutput{}
		output.Body.Items = make([]adminTaskOutcome, 0, len(results))
		for _, result := range results {
			outcome := adminTaskOutcome{AdminTaskTarget: result.Target, Status: http.StatusOK}
			if result.Err != nil {
				outcome.Status, outcome.Code = http.StatusInternalServerError, "files_unavailable"
				var problem *httpx.ProtocolProblemError
				if errors.As(h.Present(ctx, result.Err), &problem) {
					outcome.Status, outcome.Code = problem.GetStatus(), problem.Code
				}
			}
			output.Body.Items = append(output.Body.Items, outcome)
		}
		h.Logger.Info("files.admin-tasks.cleanup.finished")
		return output, nil
	})
}
