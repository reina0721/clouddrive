package httpbinding

import (
	"context"
	"errors"
	"io"
	"mime"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/reina0721/clouddrive/internal/module/files/handler"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/transport/http/humabinding"
	"github.com/reina0721/clouddrive/pkg/httpx"
)

// contentResponse 在租约内写原始内容；发送后失败中止连接，不能追加 JSON 冒充成功文件。
func contentResponse(ctx context.Context, h *handler.Handler, download func(context.Context, func(model.Entry, io.ReadSeeker) error) error) *contentOutput {
	return &contentOutput{Body: func(raw huma.Context) {
		started := false
		request, _ := humabinding.UnwrapHTTP(raw)
		err := download(ctx, func(entry model.Entry, reader io.ReadSeeker) error {
			_, writer := humabinding.BeginRawHTTP(raw)
			started = true
			writer.Header().Set("Content-Type", "application/octet-stream")
			writer.Header().Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": entry.Name}))
			writer.Header().Set("ETag", `"`+entry.ContentSHA+`"`)
			writer.Header().Set("X-Content-Type-Options", "nosniff")
			writer.Header().Set("Cache-Control", "private, no-store")
			writer.Header().Set("Referrer-Policy", "no-referrer")
			tracked := &contentWriter{ResponseWriter: writer}
			content := &contentReader{ReadSeeker: reader}
			http.ServeContent(tracked, request, entry.Name, entry.UpdatedAt, content)
			return errors.Join(tracked.failure, content.failure, ctx.Err())
		})
		if err == nil {
			return
		}
		presented := h.Present(ctx, err)
		if !started {
			_, writer := humabinding.BeginRawHTTP(raw)
			httpx.WriteProblem(writer, request, presented)
			return
		}
		// 资源回调已经退出并关闭 reader；net/http sentinel 会中止不完整响应。
		panic(http.ErrAbortHandler)
	}}
}

// contentReader 保存 ServeContent 内部未向调用方返回的源读取错误。
type contentReader struct {
	io.ReadSeeker
	failure error
}

func (r *contentReader) Read(target []byte) (int, error) {
	n, err := r.ReadSeeker.Read(target)
	if err != nil && !errors.Is(err, io.EOF) {
		r.failure = errors.Join(r.failure, err)
	}
	return n, err
}
func (r *contentReader) Seek(offset int64, whence int) (int64, error) {
	position, err := r.ReadSeeker.Seek(offset, whence)
	if err != nil {
		r.failure = errors.Join(r.failure, err)
	}
	return position, err
}

type contentWriter struct {
	http.ResponseWriter
	failure error
}

func (w *contentWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }
func (w *contentWriter) Write(content []byte) (int, error) {
	n, err := w.ResponseWriter.Write(content)
	w.failure = errors.Join(w.failure, err)
	return n, err
}
