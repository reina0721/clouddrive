package httpbinding

import (
	"bytes"
	"context"
	"mime"
	"net/http"
	"path"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/reina0721/clouddrive/internal/module/files/handler"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/internal/transport/http/humabinding"
)

const archiveControlBytes = 6*service.DefaultMaxBatchEntries*service.MaxArchivePathBytes + 65536

type archiveInspectInput struct {
	ID   string `path:"id" minLength:"1" maxLength:"36"`
	Body struct {
		ExpectedRevision int64  `json:"expectedRevision" minimum:"1"`
		Password         string `json:"password" maxLength:"1024"`
	}
}
type archiveMemberInput struct {
	ID   string `path:"id" minLength:"1" maxLength:"36"`
	Body struct {
		ExpectedRevision int64  `json:"expectedRevision" minimum:"1"`
		Password         string `json:"password" maxLength:"1024"`
		Path             string `json:"path" minLength:"1" maxLength:"4096"`
	}
}
type archiveDownloadInput struct {
	ID   string `path:"id" minLength:"1" maxLength:"36"`
	Body struct {
		ExpectedRevision int64                    `json:"expectedRevision" minimum:"1"`
		Password         string                   `json:"password" maxLength:"1024"`
		Selection        service.ArchiveSelection `json:"selection"`
	}
}
type archiveExtractInput struct {
	ID   string `path:"id" minLength:"1" maxLength:"36"`
	Body service.ArchiveExtractRequest
}
type archiveManifestOutput struct{ Body service.ArchiveManifest }
type archiveReceiptOutput struct{ Body service.ArchiveReceipt }

func archiveContent(content []byte, name, mediaType string) *contentOutput {
	return &contentOutput{Body: func(ctx huma.Context) {
		request, writer := humabinding.UnwrapHTTP(ctx)
		writer.Header().Set("Content-Type", mediaType)
		writer.Header().Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": name}))
		writer.Header().Set("Cache-Control", "private, no-store")
		writer.Header().Set("X-Content-Type-Options", "nosniff")
		http.ServeContent(writer, request, name, time.Time{}, bytes.NewReader(content))
	}}
}
func registerArchives(api huma.API, h *handler.Handler, operation func(string, string, string, string, bool) huma.Operation) {
	makeOperation := func(id, suffix, scope string) huma.Operation {
		op := operation(id, http.MethodPost, "/{id}/archive/"+suffix, scope, true)
		op.MaxBodyBytes = archiveControlBytes
		op.Middlewares = append(op.Middlewares, transferAdmission(h))
		return op
	}
	huma.Register(api, makeOperation("files.archive.inspect", "inspect", "files:read"), func(ctx context.Context, input *archiveInspectInput) (*archiveManifestOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		value, err := h.Archives.Inspect(ctx, owner, input.ID, input.Body.ExpectedRevision, input.Body.Password)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &archiveManifestOutput{Body: value}, nil
	})
	member := makeOperation("files.archive.member", "member", "files:read")
	member.Responses = map[string]*huma.Response{"200": {Description: "包内单个成员的有界字节", Content: map[string]*huma.MediaType{"application/octet-stream": {Schema: &huma.Schema{Type: "string", Format: "binary"}}}}}
	huma.Register(api, member, func(ctx context.Context, input *archiveMemberInput) (*contentOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		value, err := h.Archives.Member(ctx, owner, input.ID, input.Body.ExpectedRevision, input.Body.Password, input.Body.Path)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return archiveContent(value, path.Base(input.Body.Path), "application/octet-stream"), nil
	})
	download := makeOperation("files.archive.download", "download", "files:read")
	download.Responses = map[string]*huma.Response{"200": {Description: "包内所选内容的有界ZIP", Content: map[string]*huma.MediaType{"application/zip": {Schema: &huma.Schema{Type: "string", Format: "binary"}}}}}
	huma.Register(api, download, func(ctx context.Context, input *archiveDownloadInput) (*contentOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		value, err := h.Archives.Download(ctx, owner, input.ID, input.Body.ExpectedRevision, input.Body.Password, input.Body.Selection)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return archiveContent(value, "archive-selection.zip", "application/zip"), nil
	})
	huma.Register(api, makeOperation("files.archive.extract", "extract", "files:write"), func(ctx context.Context, input *archiveExtractInput) (*archiveReceiptOutput, error) {
		owner, err := h.Owner(ctx)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		value, err := h.Archives.Extract(ctx, owner, input.ID, input.Body)
		if err != nil {
			return nil, h.Present(ctx, err)
		}
		return &archiveReceiptOutput{Body: value}, nil
	})
}
