package composition

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	storageapp "github.com/reina0721/clouddrive/internal/kernel/app/storage"
	authmodel "github.com/reina0721/clouddrive/internal/module/auth/model"
	filespermission "github.com/reina0721/clouddrive/internal/module/files/binding/permission"
	filesservice "github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/internal/module/iam"
	"github.com/reina0721/clouddrive/pkg/storage"
	"io"
	"path/filepath"
)

// filesConnectionAuthority 将files的操作语义转换为IAM公开的当前账号授权。
type filesConnectionAuthority struct {
	access   iam.AccountAuthorizer
	audience iam.CollaborationDirectory
}

func (a filesConnectionAuthority) AuthorizeFilesystemSettingsWrite(ctx context.Context, owner string) (bool, error) {
	if a.access == nil {
		return false, fmt.Errorf("filesystem settings authorization unavailable")
	}
	return a.access.AuthorizeAccount(ctx, owner, filespermission.SettingsWrite)
}

func (a filesConnectionAuthority) AuthorizeStoragePolicyWrite(ctx context.Context, owner string) (bool, error) {
	if a.access == nil {
		return false, fmt.Errorf("storage policy authorization unavailable")
	}
	return a.access.AuthorizeAccount(ctx, owner, filespermission.StoragePolicyWrite)
}

func (a filesConnectionAuthority) AuthorizeBlobReclamation(ctx context.Context, owner string) (bool, error) {
	if a.access == nil {
		return false, fmt.Errorf("blob reclamation authorization unavailable")
	}
	return a.access.AuthorizeAccount(ctx, owner, filespermission.BlobReclaim)
}

func (a filesConnectionAuthority) AuthorizeAdminShareRevoke(ctx context.Context, actor string) (bool, error) {
	if a.access == nil {
		return false, fmt.Errorf("admin share authorization unavailable")
	}
	return a.access.AuthorizeAccount(ctx, actor, filespermission.AdminShareRevoke)
}

func (a filesConnectionAuthority) AuthorizeAdminTaskCleanup(ctx context.Context, actor string) (bool, error) {
	if a.access == nil {
		return false, fmt.Errorf("admin task authorization unavailable")
	}
	return a.access.AuthorizeAccount(ctx, actor, filespermission.AdminTaskCleanup)
}

func (a filesConnectionAuthority) AuthorizeAdminTaskRead(ctx context.Context, actor string) (bool, error) {
	if a.access == nil {
		return false, fmt.Errorf("admin task authorization unavailable")
	}
	return a.access.AuthorizeAccount(ctx, actor, filespermission.AdminTaskRead)
}

func (a filesConnectionAuthority) AuthorizeShare(ctx context.Context, owner string, access filesservice.ShareAccountAccess) (bool, error) {
	if a.access == nil {
		return false, fmt.Errorf("file share authorization unavailable")
	}
	switch access {
	case filesservice.ShareAccountRead:
		return a.access.AuthorizeAccount(ctx, owner, filespermission.Read)
	case filesservice.ShareAccountWrite:
		return a.access.AuthorizeAccount(ctx, owner, filespermission.Write)
	default:
		return false, filesservice.ErrConnectionUnavailable
	}
}

func (a filesConnectionAuthority) AuthorizeDownload(ctx context.Context, owner string) (bool, error) {
	if a.access == nil {
		return false, fmt.Errorf("file download authorization unavailable")
	}
	return a.access.AuthorizeAccount(ctx, owner, filespermission.Write)
}

func (a filesConnectionAuthority) AuthorizeArchiveTask(ctx context.Context, owner string) (bool, error) {
	if a.access == nil {
		return false, fmt.Errorf("archive task authorization unavailable")
	}
	return a.access.AuthorizeAccount(ctx, owner, filespermission.Write)
}

func (a filesConnectionAuthority) AuthorizeConnection(ctx context.Context, owner string, mode filesservice.ConnectionAccess) (bool, error) {
	if a.access == nil {
		return false, fmt.Errorf("file connection authorization unavailable")
	}
	switch mode {
	case filesservice.ConnectionRead:
		return a.access.AuthorizeAccount(ctx, owner, filespermission.Read)
	case filesservice.ConnectionWrite:
		return a.access.AuthorizeAccount(ctx, owner, filespermission.Write)
	default:
		return false, filesservice.ErrConnectionUnavailable
	}
}

// filesStorageIdentity 只对内容位置求摘要，不包含凭据或公开 URL。
func filesStorageIdentity(cfg storageapp.Config) (string, error) {
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

func filesStorageBackend(driver storage.Driver) (filesservice.StorageBackend, error) {
	switch driver {
	case storage.DriverDisabled:
		return filesservice.StorageBackendDisabled, nil
	case storage.DriverLocal:
		return filesservice.StorageBackendLocal, nil
	case storage.DriverS3, storage.DriverLocalS3:
		return filesservice.StorageBackendS3, nil
	case storage.DriverMinIO, storage.DriverLocalMinIO:
		return filesservice.StorageBackendMinIO, nil
	default:
		return "", fmt.Errorf("unsupported file storage driver")
	}
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

func (a filesContentAdapter) Exists(ctx context.Context, key string) (bool, error) {
	var exists bool
	err := a.access.Use(ctx, storageapp.RoutePrimary, func(client storageapp.Client) error {
		var err error
		exists, err = client.Exists(ctx, key)
		return err
	})
	return exists, err
}
