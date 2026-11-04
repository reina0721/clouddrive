package client

import (
	"context"
	"io"
)

// PutOptions describes optional object metadata used by object-style storage.
type PutOptions struct {
	ContentType string
	Metadata    map[string]string
}

// ObjectInfo is the portable metadata returned by StorageClient implementations.
type ObjectInfo struct {
	Key         string
	Size        int64
	ContentType string
	ETag        string
	Metadata    map[string]string
}

// StorageClient is the object-storage contract shared by local, R2, MinIO, and
// future storage backends. It is intentionally narrower than the legacy afero
// based Storage file toolbox so object stores do not need to emulate a full FS.
type StorageClient interface {
	Put(ctx context.Context, key string, data []byte, opts PutOptions) error
	Get(ctx context.Context, key string) ([]byte, ObjectInfo, error)
	// PutReader 从开头读取恰好 sizeBytes 字节；源由调用方关闭，适配器不得关闭源。
	PutReader(ctx context.Context, key string, source io.ReadSeeker, sizeBytes int64, opts PutOptions) error
	// WithReader 在回调内借用可寻址内容；回调结束后 reader 失效，禁止并发读写或逃逸使用。
	WithReader(ctx context.Context, key string, use func(io.ReadSeeker, ObjectInfo) error) error
	Delete(ctx context.Context, key string) error
	Exists(ctx context.Context, key string) (bool, error)
	HealthCheck(ctx context.Context) error
	Close() error
}
