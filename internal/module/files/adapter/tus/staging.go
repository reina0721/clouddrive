// Package tus 将成熟续传协议和同机暂存隔离在 files 的窄边界内。
package tus

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/gofrs/flock"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/httpx"
	"github.com/reina0721/clouddrive/pkg/logger"
	"github.com/tus/tusd/v2/pkg/filestore"
	tusd "github.com/tus/tusd/v2/pkg/handler"
	"golang.org/x/exp/slog"
)

// Config 只定义暂存/协议资源预算；文件业务的归属、配额和期限由 service 拥有。
type Config struct {
	Root              string
	LockTimeout       time.Duration
	LockRetryInterval time.Duration
	NetworkTimeout    time.Duration
	CompletionTimeout time.Duration
	MaxFileBytes      int64
}

type Store struct {
	root     string
	store    filestore.FileStore
	protocol *tusd.UnroutedHandler
	config   Config
	logger   logger.Logger
}

// New 只构造内存对象，不建立目录或启动后台任务。
func New(config Config, logging logger.Logger) (*Store, error) {
	if logging == nil || config.Root == "" || config.LockTimeout <= 0 || config.LockRetryInterval <= 0 || config.NetworkTimeout <= 0 || config.CompletionTimeout <= 0 || config.MaxFileBytes <= 0 {
		return nil, fmt.Errorf("invalid transfer staging dependencies")
	}
	root, err := filepath.Abs(config.Root)
	if err != nil {
		return nil, fmt.Errorf("resolve transfer staging root: %w", err)
	}
	store := filestore.New(root)
	store.DirModePerm = 0o700
	store.FileModePerm = 0o600
	composer := tusd.NewStoreComposer()
	// 锁由 service.WithLock 统一覆盖协议与发布，不在协议内再次加锁。
	composer.UseCore(store)
	protocol, err := tusd.NewUnroutedHandler(tusd.Config{StoreComposer: composer, MaxSize: config.MaxFileBytes, DisableDownload: true, DisableTermination: true, DisableConcatenation: true, Cors: &tusd.CorsConfig{Disable: true}, Logger: slog.New(protocolLogger{logging}), NetworkTimeout: config.NetworkTimeout, GracefulRequestCompletionTimeout: config.CompletionTimeout, AcquireLockTimeout: config.LockTimeout})
	if err != nil {
		return nil, fmt.Errorf("construct transfer protocol: %w", err)
	}
	return &Store{root: root, store: store, protocol: protocol, config: config, logger: logging}, nil
}

// PrepareRoot 是候选准入 I/O；只创建被显式配置的暂存根，不扫描或清空已有内容。
func PrepareRoot(ctx context.Context, root string) error {
	if root == "" {
		return model.ErrInvalid
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := os.MkdirAll(root, 0o700); err != nil {
		return fmt.Errorf("create transfer staging root: %w", err)
	}
	info, err := os.Stat(root)
	if err != nil {
		return fmt.Errorf("inspect transfer staging root: %w", err)
	}
	if !info.IsDir() {
		return fmt.Errorf("transfer staging root is not a directory")
	}
	return ctx.Err()
}

func (s *Store) WithLock(ctx context.Context, id string, use func(context.Context) error) (resultErr error) {
	if err := model.ValidateTransferID(id); err != nil {
		return err
	}
	if ctx == nil || use == nil {
		return model.ErrInvalid
	}
	wait, cancel := context.WithTimeout(ctx, s.config.LockTimeout)
	defer cancel()
	lock := flock.New(filepath.Join(s.root, id+".lock"), flock.SetPermissions(0o600))
	defer func() { resultErr = errors.Join(resultErr, lock.Close()) }()
	locked, err := lock.TryLockContext(wait, s.config.LockRetryInterval)
	if err != nil {
		return fmt.Errorf("acquire transfer lock: %w", err)
	}
	if !locked {
		return model.ErrBusy
	}
	// 不删除锁文件：旧句柄仍被等待者持有时删除会产生两套 inode 锁。
	return use(ctx)
}

func (s *Store) Create(ctx context.Context, id string, sizeBytes int64) error {
	if err := model.ValidateTransferID(id); err != nil {
		return err
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	if sizeBytes < 0 || sizeBytes > s.config.MaxFileBytes {
		return model.ErrTooLarge
	}
	// 上次初始化在 .info 发布前崩溃时只可清理同会话已有文件，绝不截断完整暂存。
	if info, err := s.Inspect(ctx, id); err == nil {
		if info.SizeBytes != sizeBytes {
			return model.ErrConflict
		}
		return nil
	} else if !errors.Is(err, model.ErrMissing) {
		return err
	}
	if err := s.Remove(ctx, id); err != nil {
		return err
	}
	_, err := s.store.NewUpload(ctx, tusd.FileInfo{ID: id, Size: sizeBytes})
	if err != nil {
		return fmt.Errorf("initialize transfer staging: %w", err)
	}
	return nil
}

func (s *Store) Inspect(ctx context.Context, id string) (service.StageInfo, error) {
	if err := model.ValidateTransferID(id); err != nil {
		return service.StageInfo{}, err
	}
	if err := ctx.Err(); err != nil {
		return service.StageInfo{}, err
	}
	upload, err := s.store.GetUpload(ctx, id)
	if errors.Is(err, tusd.ErrNotFound) || errors.Is(err, os.ErrNotExist) {
		return service.StageInfo{}, model.ErrMissing
	}
	if err != nil {
		return service.StageInfo{}, fmt.Errorf("inspect transfer staging: %w", err)
	}
	info, err := upload.GetInfo(ctx)
	if err != nil {
		return service.StageInfo{}, fmt.Errorf("read transfer staging metadata: %w", err)
	}
	if info.ID != id || info.Size < 0 || info.Size > s.config.MaxFileBytes || info.Offset < 0 || info.Offset > info.Size || info.Storage[filestore.StorageKeyPath] != filepath.Join(s.root, id) {
		return service.StageInfo{}, fmt.Errorf("transfer staging invariant violated")
	}
	return service.StageInfo{SizeBytes: info.Size, OffsetBytes: info.Offset}, nil
}

func (s *Store) WithReader(ctx context.Context, id string, use func(io.ReadSeeker) error) (resultErr error) {
	if err := model.ValidateTransferID(id); err != nil {
		return err
	}
	if use == nil {
		return model.ErrInvalid
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	// #nosec G304 -- id 已限定为规范 UUID，根由候选准入显式创建。
	file, err := os.Open(filepath.Join(s.root, id))
	if err != nil {
		return fmt.Errorf("open transfer source: %w", err)
	}
	defer func() { resultErr = errors.Join(resultErr, file.Close()) }()
	lifetime, cancel := context.WithCancel(ctx)
	defer cancel()
	return use(stageReader{ctx: lifetime, source: file})
}

func (s *Store) Remove(ctx context.Context, id string) error {
	if err := model.ValidateTransferID(id); err != nil {
		return err
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	var resultErr error
	for _, suffix := range []string{"", ".info"} {
		err := os.Remove(filepath.Join(s.root, id+suffix))
		if err != nil && !errors.Is(err, os.ErrNotExist) {
			resultErr = errors.Join(resultErr, fmt.Errorf("remove transfer staging: %w", err))
		}
	}
	return resultErr
}

// Handle 只可在同会话 WithLock 内经 service 状态与 owner 校验后调用。
// HTTP 注册仍归 binding；此处不拥有路由树或认证策略。
func (s *Store) Handle(writer http.ResponseWriter, request *http.Request, id string) {
	if model.ValidateTransferID(id) != nil || request.Header.Get("X-HTTP-Method-Override") != "" {
		http.Error(writer, "invalid transfer request", http.StatusBadRequest)
		return
	}
	copy := request.Clone(request.Context())
	uri := *request.URL
	uri.Path = "/" + id
	uri.RawPath = ""
	copy.URL = &uri
	var action http.HandlerFunc
	switch request.Method {
	case http.MethodHead:
		action = s.protocol.HeadFile
	case http.MethodPatch:
		action = s.protocol.PatchFile
	default:
		http.Error(writer, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	s.protocol.Middleware(action).ServeHTTP(&safeProtocolWriter{ResponseWriter: writer, request: copy, logger: s.logger}, copy)
}

// safeProtocolWriter 保留 tus 状态与偏移头，只替换可能含路径/底层错误的响应文本。
type safeProtocolWriter struct {
	http.ResponseWriter
	request *http.Request
	logger  logger.Logger
	written bool
	failed  bool
}

func (w *safeProtocolWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }
func (w *safeProtocolWriter) WriteHeader(status int) {
	if w.written {
		return
	}
	w.written = true
	if status < http.StatusBadRequest {
		w.ResponseWriter.WriteHeader(status)
		return
	}
	w.failed = true
	w.Header().Del("Content-Length")
	code := "files_transfer_protocol"
	if status >= 500 && !errors.Is(w.request.Context().Err(), context.Canceled) && !errors.Is(w.request.Context().Err(), context.DeadlineExceeded) {
		w.logger.Error("files.transfer.protocol.failed", logger.String("code", code))
	}
	httpx.WriteProblem(w.ResponseWriter, w.request, &httpx.StatusError{StatusCode: status, Code: code, Message: code})
}
func (w *safeProtocolWriter) Write(content []byte) (int, error) {
	if !w.written {
		w.WriteHeader(http.StatusOK)
	}
	if w.failed {
		return len(content), nil
	}
	return w.ResponseWriter.Write(content)
}

type stageReader struct {
	ctx    context.Context
	source io.ReadSeeker
}

func (r stageReader) Read(buffer []byte) (int, error) {
	if err := r.ctx.Err(); err != nil {
		return 0, err
	}
	return r.source.Read(buffer)
}
func (r stageReader) Seek(offset int64, whence int) (int64, error) {
	if err := r.ctx.Err(); err != nil {
		return 0, err
	}
	return r.source.Seek(offset, whence)
}

// protocolLogger 不转发第三方原始消息或属性，避免路径、body 和凭据进入日志。
// 协议内部诊断不决定最终失败策略，错误级别由项目呈现边界负责。
type protocolLogger struct{ logger logger.Logger }

func (l protocolLogger) Enabled(context.Context, slog.Level) bool { return true }
func (l protocolLogger) Handle(context.Context, slog.Record) error {
	l.logger.Debug("files.transfer.protocol")
	return nil
}
func (l protocolLogger) WithAttrs([]slog.Attr) slog.Handler { return l }
func (l protocolLogger) WithGroup(string) slog.Handler      { return l }

var _ service.Staging = (*Store)(nil)
