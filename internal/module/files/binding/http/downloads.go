package httpbinding

import (
	"context"
	"errors"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/reina0721/clouddrive/internal/module/files/handler"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/logger"
)

const maxDownloadControlBodyBytes int64 = 6*model.MaxDownloadURLBytes*model.MaxDownloadBatchEntries + 64<<10

type downloadOutput struct{ Body service.DownloadSummary }
type downloadRemovedOutput struct {
	Body struct {
		Removed bool `json:"removed"`
	}
}
type downloadCreateInput struct{ Body service.DownloadCreate }
type downloadListInput struct {
	Section string              `query:"section" enum:",all,active,finished"`
	State   model.DownloadState `query:"state" enum:",queued,resolving,selecting,fetching,pausing,paused,canceling,publishing,completed,failed,canceled,expired"`
	Search  string              `query:"search" maxLength:"200"`
	Cursor  string              `query:"cursor" maxLength:"256"`
}
type downloadListOutput struct{ Body service.DownloadListing }
type downloadCommandInput struct {
	ID   string `path:"id" minLength:"36" maxLength:"36"`
	Body struct {
		Revision int64 `json:"revision" minimum:"1" maximum:"9007199254740990"`
	}
}
type downloadTargetInput struct {
	ID   string `path:"id" minLength:"36" maxLength:"36"`
	Body struct {
		Revision int64  `json:"revision" minimum:"1" maximum:"9007199254740990"`
		ParentID string `json:"parentId" maxLength:"36"`
		Name     string `json:"name" minLength:"1" maxLength:"255"`
	}
}
type downloadSourceOutput struct {
	CacheControl string `header:"Cache-Control"`
	Body         struct {
		URI string `json:"uri"`
	}
}
type downloadBatchCreateInput struct {
	Body struct {
		Items []service.DownloadCreate `json:"items" minItems:"1" maxItems:"20"`
	}
}
type downloadBatchTarget struct {
	ID       string `json:"id" minLength:"36" maxLength:"36"`
	Revision int64  `json:"revision" minimum:"1" maximum:"9007199254740990"`
}
type downloadBatchControlInput struct {
	Body struct {
		Action string                `json:"action" enum:"pause,resume,cancel,remove"`
		Items  []downloadBatchTarget `json:"items" minItems:"1" maxItems:"20"`
	}
}
type downloadBatchResult struct {
	ID        string                   `json:"id"`
	ClientKey string                   `json:"clientKey"`
	Task      *service.DownloadSummary `json:"task,omitempty"`
	ErrorCode string                   `json:"errorCode"`
}
type downloadBatchOutput struct {
	Body struct {
		Items []downloadBatchResult `json:"items"`
	}
}

func downloadResult(ctx context.Context, h *handler.Handler, result service.DownloadSummary, err error) (*downloadOutput, error) {
	if err != nil {
		return nil, h.Present(ctx, err)
	}
	return &downloadOutput{Body: result}, nil
}

// downloadItemError 为部分成功结果保留稳定分类，不能输出含来源URI或账号信息的错误文本。
func downloadItemError(err error) string {
	switch {
	case errors.Is(err, service.ErrTorrentNode):
		return "files_offline_node_unavailable"
	case errors.Is(err, service.ErrTorrentMetadata):
		return "files_offline_torrent_invalid"
	case errors.Is(err, model.ErrDownloadMetadataLimited):
		return "files_offline_metadata_limited"
	case err == nil:
		return ""
	case errors.Is(err, model.ErrDownloadUnavailable):
		return "files_offline_unavailable"
	case errors.Is(err, model.ErrDownloadLimit):
		return "files_offline_limit"
	case errors.Is(err, model.ErrDownloadPermission):
		return "files_offline_permission"
	case errors.Is(err, model.ErrDownloadSourceBlocked):
		return "files_offline_source_blocked"
	case errors.Is(err, model.ErrDownloadResumeUnsupported):
		return "files_offline_resume_unsupported"
	case errors.Is(err, model.ErrMissing):
		return "files_not_found"
	case errors.Is(err, model.ErrInvalid):
		return "files_invalid"
	case errors.Is(err, model.ErrConflict):
		return "files_conflict"
	case errors.Is(err, model.ErrQuota):
		return "files_quota"
	case errors.Is(err, model.ErrBusy):
		return "files_busy"
	case errors.Is(err, service.ErrCleanup):
		return "files_cleanup_incomplete"
	case errors.Is(err, context.Canceled):
		return "files_canceled"
	case errors.Is(err, context.DeadlineExceeded):
		return "files_timeout"
	default:
		return "files_unavailable"
	}
}

func registerDownloads(api huma.API, h *handler.Handler, base func(string, string, string, string, bool) huma.Operation) {
	operation := func(id, method, suffix, scope string, body bool) huma.Operation {
		op := base(id, method, "/downloads"+suffix, scope, body)
		if body {
			op.MaxBodyBytes = maxDownloadControlBodyBytes
		}
		return op
	}
	huma.Register(api, operation("files.downloads.create", http.MethodPost, "", "files:write", true), func(ctx context.Context, input *downloadCreateInput) (*downloadOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		result, err := h.Downloads.Create(ctx, owner, input.Body)
		if err == nil {
			h.Logger.Info("files.offline.created")
		}
		return downloadResult(ctx, h, result, err)
	})
	huma.Register(api, operation("files.downloads.list", http.MethodGet, "", "files:read", false), func(ctx context.Context, input *downloadListInput) (*downloadListOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		result, err := h.Downloads.List(ctx, owner, service.DownloadQuery{Section: input.Section, State: input.State, Search: input.Search, Cursor: input.Cursor})
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &downloadListOutput{Body: result}, nil
	})
	huma.Register(api, operation("files.downloads.read", http.MethodGet, "/{id}", "files:read", false), func(ctx context.Context, input *transferInput) (*downloadOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		result, err := h.Downloads.Read(ctx, owner, input.ID)
		return downloadResult(ctx, h, result, err)
	})
	huma.Register(api, operation("files.downloads.source", http.MethodGet, "/{id}/source", "files:read", false), func(ctx context.Context, input *transferInput) (*downloadSourceOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		source, err := h.Downloads.Source(ctx, owner, input.ID)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		output := &downloadSourceOutput{CacheControl: "no-store"}
		output.Body.URI = source
		return output, nil
	})
	for _, command := range []service.DownloadCommand{service.DownloadCommandPause, service.DownloadCommandResume, service.DownloadCommandRetry, service.DownloadCommandCancel} {
		huma.Register(api, operation("files.downloads."+string(command), http.MethodPost, "/{id}/"+string(command), "files:write", true), func(ctx context.Context, input *downloadCommandInput) (*downloadOutput, error) {
			owner, err := h.Owner(ctx)
			if err != nil {
				return nil, h.Present(ctx, err)
			}
			result, err := h.Downloads.Command(ctx, owner, input.ID, input.Body.Revision, command)
			if err == nil {
				h.Logger.Info("files.offline.controlled", logger.String("phase", string(command)))
			}
			return downloadResult(ctx, h, result, err)
		})
	}
	huma.Register(api, operation("files.downloads.restart", http.MethodPost, "/{id}/restart", "files:write", true), func(ctx context.Context, input *downloadCommandInput) (*downloadOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		result, err := h.Downloads.Restart(ctx, owner, input.ID, input.Body.Revision)
		return downloadResult(ctx, h, result, err)
	})
	huma.Register(api, operation("files.downloads.target", http.MethodPut, "/{id}/target", "files:write", true), func(ctx context.Context, input *downloadTargetInput) (*downloadOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		result, err := h.Downloads.Retarget(ctx, owner, input.ID, input.Body.Revision, input.Body.ParentID, input.Body.Name)
		return downloadResult(ctx, h, result, err)
	})
	huma.Register(api, operation("files.downloads.remove", http.MethodPost, "/{id}/remove", "files:write", true), func(ctx context.Context, input *downloadCommandInput) (*downloadRemovedOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		if err := h.Downloads.Remove(ctx, owner, input.ID, input.Body.Revision); err != nil {
			return nil, h.Present(ctx, err)
		}
		output := &downloadRemovedOutput{}
		output.Body.Removed = true
		return output, nil
	})
	huma.Register(api, operation("files.downloads.batch-create", http.MethodPost, "/batch-create", "files:write", true), func(ctx context.Context, input *downloadBatchCreateInput) (*downloadBatchOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		if len(input.Body.Items) < 1 || len(input.Body.Items) > h.Downloads.BatchLimit() {
			return nil, h.Present(ctx, model.ErrDownloadLimit)
		}
		output := &downloadBatchOutput{}
		output.Body.Items = []downloadBatchResult{}
		for _, item := range input.Body.Items {
			task, err := h.Downloads.Create(ctx, owner, item)
			result := downloadBatchResult{ID: task.ID, ClientKey: item.ClientKey, ErrorCode: downloadItemError(err)}
			if err == nil {
				result.Task = &task
			}
			output.Body.Items = append(output.Body.Items, result)
		}
		downloadBatchLog(h, "create", output)
		return output, nil
	})
	huma.Register(api, operation("files.downloads.batch-control", http.MethodPost, "/batch-control", "files:write", true), func(ctx context.Context, input *downloadBatchControlInput) (*downloadBatchOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		if len(input.Body.Items) < 1 || len(input.Body.Items) > h.Downloads.BatchLimit() {
			return nil, h.Present(ctx, model.ErrDownloadLimit)
		}
		output := &downloadBatchOutput{}
		output.Body.Items = []downloadBatchResult{}
		for _, item := range input.Body.Items {
			result := downloadBatchResult{ID: item.ID}
			if input.Body.Action == "remove" {
				err = h.Downloads.Remove(ctx, owner, item.ID, item.Revision)
			} else {
				var task service.DownloadSummary
				task, err = h.Downloads.Command(ctx, owner, item.ID, item.Revision, service.DownloadCommand(input.Body.Action))
				if err == nil {
					result.Task = &task
				}
			}
			result.ErrorCode = downloadItemError(err)
			output.Body.Items = append(output.Body.Items, result)
		}
		downloadBatchLog(h, input.Body.Action, output)
		return output, nil
	})
}

func downloadBatchLog(h *handler.Handler, phase string, output *downloadBatchOutput) {
	failed := 0
	for _, result := range output.Body.Items {
		if result.ErrorCode != "" {
			failed++
		}
	}
	fields := []logger.Field{logger.String("owner", "files.offline"), logger.String("phase", phase), logger.Int("succeeded", len(output.Body.Items)-failed), logger.Int("failed", failed)}
	if failed > 0 {
		h.Logger.Warn("files.offline.batch.partial", fields...)
	} else {
		h.Logger.Info("files.offline.batch.succeeded", fields...)
	}
}
