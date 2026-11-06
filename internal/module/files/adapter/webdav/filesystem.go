// Package webdav 将成熟DAV协议与项目文件、错误和回调租约隔离。
package webdav

import (
	"context"
	"errors"
	"io"
	"net/http"

	dav "github.com/emersion/go-webdav"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
)

const (
	MethodPropFind  = "PROPFIND"
	MethodPropPatch = "PROPPATCH"
	MethodMkcol     = "MKCOL"
	MethodCopy      = "COPY"
	MethodMove      = "MOVE"
	MethodLock      = "LOCK"
	MethodUnlock    = "UNLOCK"
)

type filesystem struct {
	files           *service.DAVFiles
	scope           service.DAVScope
	prefix          string
	bodyBytes       int64
	borrowed        *contentLease
	sourceCondition service.ContentCondition
	failure         error
}

func (f *filesystem) fail(err error) error {
	f.failure = errors.Join(f.failure, err)
	return dav.NewHTTPError(Status(err), nil)
}

// Status 只公开稳定协议分类；底层错误文本留在返回链而不进入响应。
func Status(err error) int {
	if errors.Is(err, service.ErrCleanup) {
		return http.StatusInternalServerError
	}
	var bodyError *http.MaxBytesError
	if errors.As(err, &bodyError) {
		return http.StatusRequestEntityTooLarge
	}
	switch {
	case err == nil:
		return http.StatusOK
	case errors.Is(err, model.ErrUnsupported):
		return http.StatusNotImplemented
	case errors.Is(err, service.ErrCleanup):
		return http.StatusInternalServerError
	case errors.Is(err, service.ErrContentPrecondition):
		return http.StatusPreconditionFailed
	case errors.Is(err, model.ErrWriteLocked):
		return http.StatusLocked
	case errors.Is(err, service.ErrConnectionReadOnly), errors.Is(err, service.ErrConnectionUnavailable), errors.Is(err, service.ErrConnectionSystemFile):
		return http.StatusForbidden
	case errors.Is(err, model.ErrMissing):
		return http.StatusNotFound
	case errors.Is(err, model.ErrInvalid):
		return http.StatusBadRequest
	case errors.Is(err, model.ErrConflict):
		return http.StatusConflict
	case errors.Is(err, model.ErrQuota):
		return http.StatusInsufficientStorage
	case errors.Is(err, model.ErrTooLarge):
		return http.StatusRequestEntityTooLarge
	case errors.Is(err, model.ErrBusy):
		return http.StatusTooManyRequests
	case errors.Is(err, context.Canceled):
		return 499
	case errors.Is(err, context.DeadlineExceeded):
		return http.StatusGatewayTimeout
	default:
		return http.StatusInternalServerError
	}
}
func (f *filesystem) info(item service.DAVItem) *dav.FileInfo {
	path := f.prefix + item.Path
	if item.Entry.Kind == model.Folder && path[len(path)-1] != '/' {
		path += "/"
	}
	return &dav.FileInfo{Path: path, Size: item.Entry.SizeBytes, ModTime: item.Entry.UpdatedAt, IsDir: item.Entry.Kind == model.Folder, MIMEType: item.Entry.MediaType, ETag: item.Entry.ContentSHA}
}
func (f *filesystem) Open(_ context.Context, name string) (io.ReadCloser, error) {
	if f.borrowed == nil || f.borrowed.item.Path != name {
		return nil, f.fail(model.ErrMissing)
	}
	return f.borrowed, nil
}
func (f *filesystem) Stat(ctx context.Context, name string) (*dav.FileInfo, error) {
	var item service.DAVItem
	if f.borrowed != nil && f.borrowed.item.Path == name {
		item = f.borrowed.item
	} else {
		var err error
		item, err = f.files.Stat(ctx, f.scope, name)
		if err != nil {
			return nil, f.fail(err)
		}
	}
	info := f.info(item)
	if f.borrowed != nil {
		info.MIMEType = "application/octet-stream"
	}
	return info, nil
}
func (f *filesystem) ReadDir(ctx context.Context, name string, recursive bool) ([]dav.FileInfo, error) {
	items, err := f.files.ReadDir(ctx, f.scope, name, recursive)
	if err != nil {
		return nil, f.fail(err)
	}
	result := make([]dav.FileInfo, len(items))
	for index, item := range items {
		result[index] = *f.info(item)
	}
	return result, nil
}
func condition(match dav.ConditionalMatch) (*service.ContentMatch, error) {
	if !match.IsSet() {
		return nil, nil
	}
	if match.IsWildcard() {
		return &service.ContentMatch{Kind: service.ContentMatchAny}, nil
	}
	tag, err := match.ETag()
	if err != nil {
		return nil, model.ErrInvalid
	}
	return &service.ContentMatch{Kind: service.ContentMatchExact, Tag: tag}, nil
}
func conditions(match, notMatch dav.ConditionalMatch) (service.ContentCondition, error) {
	value, err := condition(match)
	if err != nil {
		return service.ContentCondition{}, err
	}
	excluded, err := condition(notMatch)
	if err != nil {
		return service.ContentCondition{}, err
	}
	return service.ContentCondition{Match: value, NotMatch: excluded}, nil
}
func (f *filesystem) Create(ctx context.Context, name string, body io.ReadCloser, options *dav.CreateOptions) (*dav.FileInfo, bool, error) {
	expected, err := conditions(options.IfMatch, options.IfNoneMatch)
	if err != nil {
		return nil, false, f.fail(err)
	}
	item, created, err := f.files.Put(ctx, f.scope, name, f.bodyBytes, expected, body)
	if err != nil {
		return nil, false, f.fail(err)
	}
	return f.info(item), created, nil
}
func (f *filesystem) RemoveAll(ctx context.Context, name string, options *dav.RemoveAllOptions) error {
	expected, err := conditions(options.IfMatch, options.IfNoneMatch)
	if err != nil {
		return f.fail(err)
	}
	if err := f.files.Remove(ctx, f.scope, name, expected); err != nil {
		return f.fail(err)
	}
	return nil
}
func (f *filesystem) Mkdir(ctx context.Context, name string) error {
	if err := f.files.Mkdir(ctx, f.scope, name); err != nil {
		return f.fail(err)
	}
	return nil
}
func (f *filesystem) Copy(ctx context.Context, name, destination string, options *dav.CopyOptions) (bool, error) {
	depth := service.CopyRecursive
	if options.NoRecursive {
		depth = service.CopyShallow
	}
	created, err := f.files.Copy(ctx, f.scope, name, destination, service.DAVCopyOptions{Depth: depth, Overwrite: !options.NoOverwrite, Condition: f.sourceCondition})
	if err != nil {
		return false, f.fail(err)
	}
	return created, nil
}
func (f *filesystem) Move(ctx context.Context, name, destination string, options *dav.MoveOptions) (bool, error) {
	created, err := f.files.Move(ctx, f.scope, name, destination, service.DAVMoveOptions{Overwrite: !options.NoOverwrite, Condition: f.sourceCondition})
	if err != nil {
		return false, f.fail(err)
	}
	return created, nil
}

// contentLease 的Close不拥有底层reader；实际关闭由外层同步DownloadTo回调完成。
type contentLease struct {
	source  io.ReadSeeker
	item    service.DAVItem
	failure error
	offset  int64
}

func (r *contentLease) Read(target []byte) (int, error) {
	n, err := r.source.Read(target)
	r.offset += int64(n)
	if errors.Is(err, io.EOF) && r.offset < r.item.Entry.SizeBytes {
		r.failure = errors.Join(r.failure, io.ErrUnexpectedEOF)
	} else if err != nil && !errors.Is(err, io.EOF) {
		r.failure = errors.Join(r.failure, err)
	}
	return n, err
}
func (r *contentLease) Seek(offset int64, whence int) (int64, error) {
	position, err := r.source.Seek(offset, whence)
	if err != nil {
		r.failure = errors.Join(r.failure, err)
	} else {
		r.offset = position
	}
	return position, err
}
func (r *contentLease) Close() error { return nil }

var _ dav.FileSystem = (*filesystem)(nil)
