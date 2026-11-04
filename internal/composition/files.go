package composition

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	storageapp "github.com/reina0721/clouddrive/internal/kernel/app/storage"
	"github.com/reina0721/clouddrive/internal/kernel/config"
	authmodel "github.com/reina0721/clouddrive/internal/module/auth/model"
	"github.com/reina0721/clouddrive/pkg/storage"
	"io"
	"path/filepath"
)

// filesStorageIdentity 只对内容位置求摘要，不包含凭据或公开 URL。
func filesStorageIdentity(snapshot config.Snapshot) (string, error) {
	var cfg storageapp.Config
	if err := snapshot.DecodeSection(storageapp.ConfigPath, &cfg); err != nil {
		return "", err
	}
	root, err := filepath.Abs(cfg.Local.BasePath)
	if err != nil {
		return "", err
	}
	identity := struct {
		Driver                                                      storage.Driver
		LocalRoot, S3Endpoint, S3Bucket, MinIOEndpoint, MinIOBucket string
	}{cfg.Driver, root, cfg.S3.Endpoint, cfg.S3.Bucket, cfg.MinIO.Endpoint, cfg.MinIO.Bucket}
	encoded, err := json.Marshal(identity)
	if err != nil {
		return "", err
	}
	digest := sha256.Sum256(encoded)
	return hex.EncodeToString(digest[:]), nil
}

// filesActorAdapter 只投影已认证主体，不允许请求参数选择文件 owner。
type filesActorAdapter struct{}

func (filesActorAdapter) Owner(ctx context.Context) (string, bool) {
	principal, ok := authmodel.PrincipalFromContext(ctx)
	return principal.Subject, ok
}

// filesContentAdapter 在单次租约内访问对象，不向业务暴露共享资源关闭权。
type filesContentAdapter struct{ access storageapp.Access }

func (a filesContentAdapter) Put(ctx context.Context, key string, content []byte, mediaType string) error {
	return a.access.Use(ctx, storageapp.RoutePrimary, func(client storageapp.Client) error {
		return client.Put(ctx, key, content, storage.PutOptions{ContentType: mediaType})
	})
}

func (a filesContentAdapter) PutReader(ctx context.Context, key string, source io.ReadSeeker, sizeBytes int64, mediaType string) error {
	return a.access.Use(ctx, storageapp.RoutePrimary, func(client storageapp.Client) error {
		return client.PutReader(ctx, key, source, sizeBytes, storage.PutOptions{ContentType: mediaType})
	})
}

func (a filesContentAdapter) WithReader(ctx context.Context, key string, use func(io.ReadSeeker, int64) error) error {
	return a.access.Use(ctx, storageapp.RoutePrimary, func(client storageapp.Client) error {
		return client.WithReader(ctx, key, func(reader io.ReadSeeker, info storage.ObjectInfo) error { return use(reader, info.Size) })
	})
}
func (a filesContentAdapter) Delete(ctx context.Context, key string) error {
	return a.access.Use(ctx, storageapp.RoutePrimary, func(client storageapp.Client) error { return client.Delete(ctx, key) })
}
