package service

import (
	"context"
	"fmt"
	"io"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

// DownloadTo 在内容租约内完成原始响应，不让 reader 或共享资源关闭权逃逸。
// Range 读取不扫描整个文件摘要；对象在发布时校验 SHA256，之后以不可变 key 访问。
func (s *Service) DownloadTo(ctx context.Context, owner, id string, use func(model.Entry, io.ReadSeeker) error) error {
	if use == nil {
		return model.ErrInvalid
	}
	detail, err := s.Detail(ctx, owner, id)
	if err != nil {
		return err
	}
	entry := detail.Entry
	if entry.Kind != model.File {
		return model.ErrInvalid
	}
	return s.content.WithReader(ctx, entry.ObjectKey, func(reader io.ReadSeeker, sizeBytes int64) error {
		if sizeBytes != entry.SizeBytes {
			return fmt.Errorf("file content length mismatch")
		}
		latest, err := s.Detail(ctx, owner, id)
		if err != nil {
			return err
		}
		if latest.Entry.ObjectKey != entry.ObjectKey {
			return model.ErrConflict
		}
		return use(entry, reader)
	})
}
