package httpbinding

import (
	"context"
	"github.com/danielgtaylor/huma/v2"
	"github.com/reina0721/clouddrive/internal/module/files/handler"
	"github.com/reina0721/clouddrive/internal/module/files/service"
)

type annotationReadOutput struct{ Body service.AnnotationDetail }
type annotationWriteInput struct {
	ID   string `path:"id" minLength:"1" maxLength:"36"`
	Body service.AnnotationUpdate
}
type annotationWriteOutput struct{ Body service.AnnotationDocument }
type annotationBatchInput struct{ Body service.TagsBatch }
type annotationBatchResult struct {
	Items []service.AnnotationSummary `json:"items"`
}
type annotationBatchOutput struct{ Body annotationBatchResult }
type annotationSummariesInput struct {
	IDs        []string                     `query:"ids,explode" minItems:"1" maxItems:"200"`
	Visibility service.AnnotationVisibility `query:"visibility" enum:"active,trash" default:"active"`
}

func registerAnnotations(api huma.API, h *handler.Handler, operation func(string, string, string, string, bool) huma.Operation) {
	huma.Register(api, operation("files.annotations.summaries", "GET", "/annotations/summaries", "files:read", false), func(ctx context.Context, input *annotationSummariesInput) (*annotationBatchOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		value, err := h.Service.ReadAnnotationSummaries(ctx, owner, input.IDs, input.Visibility)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &annotationBatchOutput{Body: annotationBatchResult{Items: value}}, nil
	})
	huma.Register(api, operation("files.annotations.read", "GET", "/{id}/annotations", "files:read", false), func(ctx context.Context, input *pathInput) (*annotationReadOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		value, err := h.Service.ReadAnnotations(ctx, owner, input.ID)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		definitions, err := h.PropertyDefinitions.Read(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		value.PropertyDefinitions = definitions.Items
		return &annotationReadOutput{Body: value}, nil
	})
	huma.Register(api, operation("files.annotations.replace", "PUT", "/{id}/annotations", "files:write", true), func(ctx context.Context, input *annotationWriteInput) (*annotationWriteOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		value, err := h.Service.ReplaceAnnotations(ctx, owner, input.ID, input.Body)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		h.Logger.Info("files.annotations.write.completed")
		return &annotationWriteOutput{Body: value}, nil
	})
	huma.Register(api, operation("files.annotations.tags-batch", "POST", "/annotations/tags-batch", "files:write", true), func(ctx context.Context, input *annotationBatchInput) (*annotationBatchOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		value, err := h.Service.ChangeTags(ctx, owner, input.Body)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		h.Logger.Info("files.annotations.batch.completed")
		return &annotationBatchOutput{Body: annotationBatchResult{Items: value}}, nil
	})
}
