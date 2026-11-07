// Package handler 适配 files 用例与请求主体，保持业务层不依赖认证实现。
package handler

import (
	"context"
	"errors"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/httpx"
	"github.com/reina0721/clouddrive/pkg/logger"
	"net/http"
)

type ActorAccess interface {
	Owner(context.Context) (string, bool)
}

type BlobReclamationAuthority interface {
	AuthorizeBlobReclamation(context.Context, string) (bool, error)
}

type FilesystemSettingsAuthority interface {
	AuthorizeFilesystemSettingsWrite(context.Context, string) (bool, error)
}

type StoragePolicyAuthority interface {
	AuthorizeStoragePolicyWrite(context.Context, string) (bool, error)
}

type AdminShareAuthority interface {
	AuthorizeAdminShareRevoke(context.Context, string) (bool, error)
}

type AdminTaskAuthority interface {
	AuthorizeAdminTaskCleanup(context.Context, string) (bool, error)
	AuthorizeAdminTaskRead(context.Context, string) (bool, error)
}

// TransferProtocol 只处理已经经 service 加锁并授权的核心续传请求。
type TransferProtocol interface {
	Handle(http.ResponseWriter, *http.Request, string)
}

// PublicAuthenticator 在公开分享路由显式复用可选Session，不改变全局公共路由语义。
type PublicAuthenticator interface {
	AuthenticateOptional(*http.Request) (*http.Request, error)
}

type Handler struct {
	WriteLocks               *service.WriteLocks
	PublicAuthentication     PublicAuthenticator
	Archives                 *service.Archives
	ArchiveTasks             *service.ArchiveTasks
	BackgroundTasks          *service.BackgroundTasks
	TrashPurge               *service.TrashPurge
	TrashRetention           *service.TrashRetention
	DirectLinks              *service.DirectLinks
	Inventory                *service.Inventory
	AdminShares              *service.AdminShares
	AdminShareAccess         AdminShareAuthority
	AdminTasks               *service.AdminTasks
	AdminTaskAccess          AdminTaskAuthority
	WorkerNodes              *service.WorkerNodes
	Blobs                    *service.BlobCatalog
	BlobReclamation          *service.BlobReclamation
	BlobReclamationAccess    BlobReclamationAuthority
	FilesystemSettings       *service.FilesystemSettings
	FilesystemSettingsAccess FilesystemSettingsAuthority
	StoragePolicy            *service.StoragePolicy
	StoragePolicyAccess      StoragePolicyAuthority
	PropertyDefinitions      *service.PropertyDefinitions
	Downloads                *service.OfflineDownloads
	Torrents                 *service.TorrentDownloads
	Service                  *service.Service
	Sharing                  *service.Sharing
	ShareTransfers           *service.ShareTransfers
	Connections              *service.Connections
	ConnectionOrigin         string
	Navigation               *service.Navigation
	Preferences              *service.Preferences
	WebDAV                   http.Handler
	Transfers                *service.Transfers
	TransferProtocol         TransferProtocol
	PublicOrigins            []string
	Actors                   ActorAccess
	Logger                   logger.Logger
}

func (h *Handler) Owner(ctx context.Context) (string, error) {
	owner, ok := h.Actors.Owner(ctx)
	if !ok || owner == "" {
		return "", &httpx.StatusError{StatusCode: http.StatusUnauthorized, Code: "unauthenticated", Err: model.ErrMissing}
	}
	return owner, nil
}

// Present 是决定协议结果的唯一文件错误日志边界，不记录文件名称或底层错误文本。
func (h *Handler) Present(ctx context.Context, err error) error {
	status, code := http.StatusInternalServerError, "files_unavailable"
	var protocolError *httpx.StatusError
	switch {
	case errors.Is(err, model.ErrShareForbidden):
		status, code = http.StatusForbidden, "files_share_forbidden"
	case errors.Is(err, service.ErrTorrentNode), errors.Is(err, service.ErrTorrentBinding), errors.Is(err, service.ErrTorrentProtocol), errors.Is(err, service.ErrTorrentJobMissing):
		status, code = http.StatusServiceUnavailable, "files_offline_node_unavailable"
	case errors.Is(err, service.ErrTorrentMetadata), errors.Is(err, service.ErrTorrentUnsupported):
		status, code = http.StatusUnprocessableEntity, "files_offline_torrent_invalid"
	case errors.Is(err, model.ErrDownloadMetadataLimited):
		status, code = 413, "files_offline_metadata_limited"
	case errors.Is(err, model.ErrDownloadUnavailable):
		status, code = 503, "files_offline_unavailable"
	case errors.Is(err, model.ErrDownloadLimit):
		status, code = 429, "files_offline_limit"
	case errors.Is(err, model.ErrDownloadPermission):
		status, code = 403, "files_offline_permission"
	case errors.Is(err, model.ErrDownloadSourceBlocked):
		status, code = 422, "files_offline_source_blocked"
	case errors.Is(err, model.ErrDownloadSourceChanged):
		status, code = 409, "files_offline_source_changed"
	case errors.Is(err, model.ErrDownloadResumeUnsupported):
		status, code = 409, "files_offline_resume_unsupported"
	case errors.Is(err, model.ErrDownloadSourceUnavailable):
		status, code = 502, "files_offline_source_unavailable"
	case errors.Is(err, model.ErrDownloadLeaseLost):
		status, code = 409, "files_offline_lease_lost"
	case errors.Is(err, model.ErrHistoryFull):
		status, code = 409, "files_history_full"
	case errors.Is(err, model.ErrWriteLocked):
		status, code = http.StatusLocked, "files_write_locked"
	case errors.Is(err, model.ErrUnsupported):
		status, code = http.StatusUnprocessableEntity, "files_unsupported"
	case errors.Is(err, service.ErrArchivePassword):
		status, code = http.StatusForbidden, "files_archive_password"
	case errors.Is(err, service.ErrArchiveChecksum):
		status, code = http.StatusUnprocessableEntity, "files_archive_checksum"
	case errors.Is(err, service.ErrArchiveTasksUnavailable):
		status, code = http.StatusServiceUnavailable, "files_archive_tasks_unavailable"
	case errors.Is(err, service.ErrArchiveTaskForbidden):
		status, code = http.StatusForbidden, "files_archive_forbidden"
	case errors.Is(err, service.ErrContentPrecondition):
		status, code = 412, "files_content_precondition"
	case errors.Is(err, service.ErrConnectionSystemFile):
		status, code = 403, "files_connection_system_file"
	case errors.Is(err, service.ErrConnectionCredentials):
		status, code = 401, "files_connection_credentials"
	case errors.Is(err, service.ErrConnectionReadOnly):
		status, code = 403, "files_connection_read_only"
	case errors.Is(err, service.ErrConnectionUnavailable):
		status, code = 403, "files_connection_unavailable"
	case errors.Is(err, service.ErrCleanup):
		status, code = 500, "files_cleanup_incomplete"
	case errors.As(err, &protocolError):
		status, code = protocolError.StatusCode, protocolError.Code
	case errors.Is(err, model.ErrMissing):
		status, code = 404, "files_not_found"
	case errors.Is(err, model.ErrInvalid):
		status, code = 422, "files_invalid"
	case errors.Is(err, model.ErrConflict):
		status, code = 409, "files_conflict"
	case errors.Is(err, model.ErrQuota):
		status, code = 409, "files_quota"
	case errors.Is(err, model.ErrTooLarge):
		status, code = 413, "files_too_large"
	case errors.Is(err, model.ErrBusy):
		status, code = 429, "files_busy"
	case errors.Is(err, model.ErrShareLocked):
		status, code = 403, "files_share_locked"
	case errors.Is(err, service.ErrTransferExpired):
		status, code = 410, "files_transfer_expired"
	case errors.Is(err, service.ErrTransferChecksum):
		status, code = 422, "files_transfer_checksum"
	case errors.Is(err, context.Canceled):
		status, code = 499, "files_canceled"
	case errors.Is(err, context.DeadlineExceeded):
		status, code = 504, "files_timeout"
	case errors.Is(err, service.ErrArchiveWorker):
		status, code = 503, "files_archive_worker_unavailable"
	}
	if status >= 500 && !errors.Is(err, context.DeadlineExceeded) {
		h.Logger.Error("files.request.failed", logger.String("code", code))
	}
	return httpx.NewProtocolProblemError(ctx, &httpx.StatusError{StatusCode: status, Code: code, Message: code, Err: err})
}
