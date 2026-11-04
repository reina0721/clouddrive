package service

import (
	"context"
	"io"
)

// StageInfo 是协议适配器实际确认的暂存长度和偏移，不包含第三方类型或路径。
type StageInfo struct {
	SizeBytes   int64
	OffsetBytes int64
	Deferred    bool
}

// Staging 仅服务 files 暂存；调用方先持有 WithLock，再操作同一会话。
// WithReader 的 reader 和 WithLock 的上下文均不得逃逸至回调之外。
type Staging interface {
	WithLock(context.Context, string, func(context.Context) error) error
	Create(context.Context, string, int64) error
	CreateDeferred(context.Context, string) error
	WriteStream(context.Context, string, io.Reader, int64) (int64, string, error)
	Seal(context.Context, string, int64) error
	Inspect(context.Context, string) (StageInfo, error)
	WithReader(context.Context, string, func(io.ReadSeeker) error) error
	Remove(context.Context, string) error
}
