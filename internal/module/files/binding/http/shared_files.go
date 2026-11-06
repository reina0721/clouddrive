package httpbinding

import (
	"bytes"
	"context"
	"mime"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/reina0721/clouddrive/internal/module/files/handler"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/internal/transport/http/humabinding"
	"github.com/reina0721/clouddrive/pkg/logger"
)

const sharedArchiveFilename = "shared-files.zip"

type sharedFolderInput struct {
	Token string `path:"token" minLength:"43" maxLength:"43"`
	Grant string `header:"X-Share-Grant" maxLength:"43"`
	Body  struct {
		ParentID string `json:"parentId" maxLength:"36"`
		Name     string `json:"name" minLength:"1" maxLength:"255"`
	}
}
type sharedTextCreateInput struct {
	Token string `path:"token" minLength:"43" maxLength:"43"`
	Grant string `header:"X-Share-Grant" maxLength:"43"`
	Body  service.SharedTextCreate
}
type sharedTextReplaceInput struct {
	Token string `path:"token" minLength:"43" maxLength:"43"`
	Grant string `header:"X-Share-Grant" maxLength:"43"`
	ID    string `path:"id" minLength:"36" maxLength:"36"`
	Body  struct {
		Revision int64  `json:"revision" minimum:"1" maximum:"9007199254740990"`
		Text     string `json:"text" maxLength:"1048576"`
	}
}
type sharedItemChangeInput struct {
	Token string `path:"token" minLength:"43" maxLength:"43"`
	Grant string `header:"X-Share-Grant" maxLength:"43"`
	Body  service.SharedItemChange
}
type sharedBatchInput struct {
	Token string `path:"token" minLength:"43" maxLength:"43"`
	Grant string `header:"X-Share-Grant" maxLength:"43"`
	Body  service.SharedBatch
}
type sharedArchiveInput struct {
	Token string `path:"token" minLength:"43" maxLength:"43"`
	Grant string `header:"X-Share-Grant" maxLength:"43"`
	Body  struct {
		IDs []string `json:"ids" minItems:"1" maxItems:"20"`
	}
}
type publicEntryOutput struct{ Body service.PublicEntry }
type publicTextOutput struct{ Body service.PublicText }
type publicBatchOutput struct{ Body service.SharedBatchResult }

func sharedMutation(h *handler.Handler, id, method, suffix string) huma.Operation {
	op := publicShareOperation(h, id, method, suffix, true)
	op.MaxBodyBytes = maxShareUnlockBodyBytes
	op.Middlewares = append(op.Middlewares, shareOrigin(h))
	return op
}
func publicEntryResult(ctx context.Context, h *handler.Handler, value service.PublicEntry, err error) (*publicEntryOutput, error) {
	if err != nil {
		return nil, h.Present(ctx, err)
	}
	h.Logger.Info("files.share.file.mutated")
	return &publicEntryOutput{Body: value}, nil
}
func registerSharedFiles(api huma.API, h *handler.Handler) {
	huma.Register(api, publicShareOperation(h, "files.public.text.read", http.MethodGet, "/{token}/text/{id}", false), func(ctx context.Context, input *publicContentInput) (*publicTextOutput, error) {
		value, err := h.Sharing.ReadText(ctx, input.Token, input.Grant, input.ID)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &publicTextOutput{Body: value}, nil
	})
	huma.Register(api, sharedMutation(h, "files.public.folders.create", http.MethodPost, "/{token}/folders"), func(ctx context.Context, input *sharedFolderInput) (*publicEntryOutput, error) {
		value, err := h.Sharing.CreateFolder(ctx, input.Token, input.Grant, input.Body.ParentID, input.Body.Name)
		return publicEntryResult(ctx, h, value, err)
	})
	create := sharedMutation(h, "files.public.text.create", http.MethodPost, "/{token}/text")
	create.MaxBodyBytes = maxTextJSONBytes
	create.Middlewares = append(create.Middlewares, transferAdmission(h))
	huma.Register(api, create, func(ctx context.Context, input *sharedTextCreateInput) (*publicEntryOutput, error) {
		value, err := h.Sharing.CreateText(ctx, input.Token, input.Grant, input.Body)
		return publicEntryResult(ctx, h, value, err)
	})
	replace := sharedMutation(h, "files.public.text.replace", http.MethodPut, "/{token}/text/{id}")
	replace.MaxBodyBytes = maxTextJSONBytes
	replace.Middlewares = append(replace.Middlewares, transferAdmission(h))
	huma.Register(api, replace, func(ctx context.Context, input *sharedTextReplaceInput) (*publicEntryOutput, error) {
		value, err := h.Sharing.ReplaceText(ctx, input.Token, input.Grant, input.ID, input.Body.Revision, input.Body.Text)
		return publicEntryResult(ctx, h, value, err)
	})
	huma.Register(api, sharedMutation(h, "files.public.entries.change", http.MethodPost, "/{token}/entries/change"), func(ctx context.Context, input *sharedItemChangeInput) (*publicEntryOutput, error) {
		value, err := h.Sharing.ChangeItem(ctx, input.Token, input.Grant, input.Body)
		return publicEntryResult(ctx, h, value, err)
	})
	batch := sharedMutation(h, "files.public.entries.batch", http.MethodPost, "/{token}/entries/batch")
	batch.MaxBodyBytes = maxTransferControlBodyBytes * service.DefaultShareBatchEntries
	huma.Register(api, batch, func(ctx context.Context, input *sharedBatchInput) (*publicBatchOutput, error) {
		value, err := h.Sharing.Batch(ctx, input.Token, input.Grant, input.Body)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		failed := 0
		for _, item := range value.Items {
			if item.ErrorCode != "" {
				failed++
			}
		}
		if failed > 0 {
			h.Logger.Warn("files.share.batch.partial", logger.Int("failed_count", failed))
		} else {
			h.Logger.Info("files.share.batch.completed")
		}
		return &publicBatchOutput{Body: value}, nil
	})
	archive := sharedMutation(h, "files.public.archive", http.MethodPost, "/{token}/archive")
	archive.Middlewares = append(archive.Middlewares, transferAdmission(h))
	archive.Responses = map[string]*huma.Response{"200": {Description: "分享范围内所选文件的有界ZIP", Content: map[string]*huma.MediaType{"application/zip": {Schema: &huma.Schema{Type: "string", Format: "binary"}}}}}
	huma.Register(api, archive, func(ctx context.Context, input *sharedArchiveInput) (*contentOutput, error) {
		payload, err := h.Sharing.Archive(ctx, input.Token, input.Grant, input.Body.IDs)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &contentOutput{Body: func(raw huma.Context) {
			request, writer := humabinding.UnwrapHTTP(raw)
			writer.Header().Set("Content-Type", "application/zip")
			writer.Header().Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": sharedArchiveFilename}))
			http.ServeContent(writer, request, sharedArchiveFilename, time.Time{}, bytes.NewReader(payload))
		}}, nil
	})
}
