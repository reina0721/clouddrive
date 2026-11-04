package tus

import (
	"context"
	"errors"
	"fmt"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"io"
	"os"
	"path/filepath"
)

// Offset 采样真实已写入长度；不读取.info，避免与seal元数据更新交错。
func (s *Store) Offset(ctx context.Context, id string) (int64, error) {
	if err := model.ValidateTransferID(id); err != nil {
		return 0, err
	}
	if err := ctx.Err(); err != nil {
		return 0, err
	}
	info, err := os.Lstat(filepath.Join(s.root, id))
	if errors.Is(err, os.ErrNotExist) {
		return 0, errors.Join(model.ErrMissing, err)
	}
	if err != nil {
		return 0, fmt.Errorf("sample transfer offset: %w", err)
	}
	if !info.Mode().IsRegular() || info.Size() < 0 || info.Size() > s.config.MaxFileBytes {
		return 0, fmt.Errorf("transfer offset invariant violated")
	}
	return info.Size(), nil
}

// AppendStream 在调用方的同会话锁内使用标准库追加数据，metadata仍由tusd管理。
// SDK WriteChunk在copy失败分支无法导出关闭错误，此处显式join，不另建临时目录或文件命名体系。
func (s *Store) AppendStream(ctx context.Context, id string, source io.Reader, options service.StageAppend) (written int64, resultErr error) {
	if source == nil || options.OffsetBytes < 0 || options.MaxAppendBytes < 0 || options.OffsetBytes > s.config.MaxFileBytes || options.MaxAppendBytes > s.config.MaxFileBytes-options.OffsetBytes {
		return 0, model.ErrInvalid
	}
	info, err := s.Inspect(ctx, id)
	if err != nil {
		return 0, err
	}
	if !info.Deferred || info.OffsetBytes != options.OffsetBytes {
		return 0, model.ErrConflict
	}
	offset, err := s.Offset(ctx, id)
	if err != nil {
		return 0, err
	}
	if offset != options.OffsetBytes {
		return 0, model.ErrConflict
	}
	// #nosec G304 -- UUID已验证，路径只在Adapter受控根内，调用方持有同会话OS锁。
	file, err := os.OpenFile(filepath.Join(s.root, id), os.O_WRONLY, 0)
	if err != nil {
		return 0, fmt.Errorf("open transfer append: %w", err)
	}
	defer func() { resultErr = errors.Join(resultErr, file.Close(), ctx.Err()) }()
	position, err := file.Seek(options.OffsetBytes, io.SeekStart)
	if err != nil {
		return 0, fmt.Errorf("seek transfer append: %w", err)
	}
	if position != options.OffsetBytes {
		return 0, model.ErrConflict
	}
	return io.Copy(file, &appendInput{ctx: ctx, source: source, remaining: options.MaxAppendBytes})
}

type appendInput struct {
	ctx       context.Context
	source    io.Reader
	remaining int64
}

func (r *appendInput) Read(target []byte) (int, error) {
	if err := r.ctx.Err(); err != nil {
		return 0, err
	}
	if len(target) == 0 {
		return 0, nil
	}
	if r.remaining == 0 {
		var probe [1]byte
		n, err := r.source.Read(probe[:])
		if n > 0 {
			return 0, model.ErrTooLarge
		}
		return 0, err
	}
	if int64(len(target)) > r.remaining {
		target = target[:int(r.remaining)]
	}
	n, err := r.source.Read(target)
	r.remaining -= int64(n)
	return n, err
}
