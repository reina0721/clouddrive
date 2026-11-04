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

// StageAppend 明确已有前缀与本次最多追加字节，零上限仍需探测来源是否为空。
type StageAppend struct {
	OffsetBytes    int64
	MaxAppendBytes int64
}

// Staging 仅服务 files 暂存；除只读Offset采样外，调用方先持有WithLock再操作同一会话。
// WithReader 的 reader 和 WithLock 的上下文均不得逃逸至回调之外。
type Staging interface {
	WithLock(context.Context, string, func(context.Context) error) error
	Create(context.Context, string, int64) error
	CreateDeferred(context.Context, string) error
	WriteStream(context.Context, string, io.Reader, int64) (int64, string, error)
	AppendStream(context.Context, string, io.Reader, StageAppend) (int64, error)
	// Offset 只读取真实数据文件长度，可在持锁写入期间由同任务采样，不读取易变的.info。
	Offset(context.Context, string) (int64, error)
	Seal(context.Context, string, int64) error
	Inspect(context.Context, string) (StageInfo, error)
	WithReader(context.Context, string, func(io.ReadSeeker) error) error
	Remove(context.Context, string) error
}
