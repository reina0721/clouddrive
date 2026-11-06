package webdav

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"

	dav "github.com/emersion/go-webdav"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
)

var ErrResponseBudget = errors.New("webdav response exceeds configured budget")

// Protocol 仅拥有成熟协议实例，身份、预算准入与路由由binding显式处理。
type Protocol struct {
	files  *service.DAVFiles
	policy service.ConnectionPolicy
}

func New(files *service.DAVFiles, policy service.ConnectionPolicy) (*Protocol, error) {
	if files == nil {
		return nil, model.ErrInvalid
	}
	if err := policy.Validate(); err != nil {
		return nil, err
	}
	return &Protocol{files: files, policy: policy}, nil
}

// Handle 的request使用已校验相对路径；prefix仅用于协议中的同源href。
func (p *Protocol) Handle(writer http.ResponseWriter, request *http.Request, scope service.DAVScope, prefix string) error {
	if err := p.files.CheckIf(request.Context(), scope); err != nil {
		return err
	}
	if request.Method == MethodLock || request.Method == MethodUnlock {
		return p.handleLock(writer, request, scope, prefix)
	}
	var propertyBody []byte
	if request.Method == MethodPropFind && request.Body != nil {
		var err error
		propertyBody, err = io.ReadAll(request.Body)
		if err != nil {
			return err
		}
		request.Body = io.NopCloser(bytes.NewReader(propertyBody))
	}
	fs := &filesystem{files: p.files, scope: scope, prefix: prefix, bodyBytes: request.ContentLength}
	if request.Method == MethodCopy || request.Method == MethodMove {
		expected, err := conditions(dav.ConditionalMatch(request.Header.Get("If-Match")), dav.ConditionalMatch(request.Header.Get("If-None-Match")))
		if err != nil {
			return err
		}
		fs.sourceCondition = expected
	}
	if request.Method == http.MethodGet || request.Method == http.MethodHead {
		return p.files.DownloadTo(request.Context(), scope, request.URL.Path, func(item service.DAVItem, source io.ReadSeeker) error {
			content := &contentLease{source: source, item: item}
			fs.borrowed = content
			writer.Header().Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": item.Entry.Name}))
			tracked := &streamWriter{ResponseWriter: writer}
			protocol := dav.Handler{FileSystem: fs}
			protocol.ServeHTTP(tracked, request)
			return errors.Join(content.failure, tracked.failure, fs.failure, request.Context().Err())
		})
	}
	response := &controlResponse{header: make(http.Header), limit: p.policy.ResponseBytes}
	protocol := dav.Handler{FileSystem: fs}
	protocol.ServeHTTP(response, request)
	if response.failure != nil {
		return errors.Join(response.failure, fs.failure)
	}
	if response.status >= http.StatusBadRequest {
		// 上游解析错误可能包含原始请求值；输出固定状态文本而不转发正文。
		if fs.failure != nil {
			return fs.failure
		}
		return &ProtocolError{Status: response.status}
	}
	if request.Method == MethodPropFind {
		if err := p.augmentLockProperties(request.Context(), scope, prefix, propertyBody, response); err != nil {
			return err
		}
	}
	for name, values := range response.header {
		writer.Header()[name] = append([]string(nil), values...)
	}
	writer.WriteHeader(response.statusCode())
	_, err := writer.Write(response.body.Bytes())
	return errors.Join(err, fs.failure)
}

// ProtocolError 保留成熟协议解析器的状态而不公开其不受控错误文本。
type ProtocolError struct{ Status int }

func (e *ProtocolError) Error() string { return fmt.Sprintf("webdav request rejected (%d)", e.Status) }

type streamWriter struct {
	http.ResponseWriter
	failure error
}

func (w *streamWriter) Write(body []byte) (int, error) {
	n, err := w.ResponseWriter.Write(body)
	w.failure = errors.Join(w.failure, err)
	return n, err
}
func (w *streamWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }

type controlResponse struct {
	header  http.Header
	status  int
	body    bytes.Buffer
	limit   int64
	failure error
}

func (w *controlResponse) Header() http.Header { return w.header }
func (w *controlResponse) WriteHeader(status int) {
	if w.status == 0 {
		w.status = status
	}
}
func (w *controlResponse) statusCode() int {
	if w.status == 0 {
		return http.StatusOK
	}
	return w.status
}
func (w *controlResponse) Write(body []byte) (int, error) {
	if w.failure != nil {
		return 0, w.failure
	}
	if int64(w.body.Len())+int64(len(body)) > w.limit {
		w.failure = ErrResponseBudget
		return 0, w.failure
	}
	if w.status == 0 {
		w.status = http.StatusOK
	}
	return w.body.Write(body)
}

// ErrorStatus 让binding统一处理协议错误、预算和取消，不记录原始第三方文本。
func ErrorStatus(err error) int {
	if errors.Is(err, service.ErrCleanup) {
		return http.StatusInternalServerError
	}
	var protocol *ProtocolError
	if errors.As(err, &protocol) {
		return protocol.Status
	}
	if errors.Is(err, ErrResponseBudget) {
		return http.StatusInsufficientStorage
	}
	if errors.Is(err, io.ErrUnexpectedEOF) {
		return http.StatusBadRequest
	}
	if errors.Is(err, context.Canceled) {
		return 499
	}
	return Status(err)
}
