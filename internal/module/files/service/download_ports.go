package service

import (
	"context"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"io"
	"time"
)

// DownloadSourceRequest 是一次完整或断点读取，URI/验证器均仅在服务端使用。
type DownloadSourceRequest struct {
	DeclaredBytes  *int64
	URI            string
	EffectiveURI   string
	OffsetBytes    int64
	ValidatorKind  model.DownloadValidatorKind
	ValidatorValue string
	MaxBytes       int64
}

type DownloadSourceHeaders struct {
	EffectiveURI    string
	SuggestedName   string
	MediaType       string
	DeclaredBytes   *int64
	SegmentEndBytes *int64
	ValidatorKind   model.DownloadValidatorKind
	ValidatorValue  string
}

// HTTPDownloadSource 拥有响应body及重定向；reader只在回调内有效，关闭失败完整返回。
type HTTPDownloadSource interface {
	Normalize(string) (uri string, origin string, err error)
	WithBody(context.Context, DownloadSourceRequest, func(DownloadSourceHeaders, io.Reader) error) error
}

// DownloadAccountAuthority 由composition投影当前IAM写文件权限，后台任务不复用过期浏览器会话。
type DownloadAccountAuthority interface {
	AuthorizeDownload(context.Context, string) (bool, error)
}

type DownloadClaim struct {
	TaskID  string
	OwnerID string
	Token   string
}

type DownloadQuery struct {
	Section string
	State   model.DownloadState
	Search  string
	Cursor  string
}

type DownloadSnapshot struct {
	MetadataLimited   bool
	Task              model.DownloadTask
	Transfers         []model.Transfer
	Entries           []model.Entry
	GlobalActiveTasks int
}

type DownloadPage struct {
	MetadataLimited bool
	Tasks           []model.DownloadTask
	Transfers       []model.Transfer
	Entries         []model.Entry
	NextCursor      string
	ActiveCount     int
	FinishedCount   int
	TotalCount      int
}

type DownloadCandidate struct{ ID, OwnerID string }

// DownloadRepository 仅暴露下载任务事务与有围栏的心跳；文件发布仍走TransferRepository。
// 进度和续租不推进用户Revision，ChangeDownload只写实际变更字段，不能覆盖并发检查点。
type DownloadRepository interface {
	CreateDownload(context.Context, model.DownloadTask, model.Transfer, func(TransferSnapshot) error) (model.DownloadTask, error)
	ReadDownload(context.Context, string, string) (DownloadSnapshot, error)
	ListDownloads(context.Context, string, DownloadQuery, int) (DownloadPage, error)
	NextDownload(context.Context, time.Time, int) (DownloadCandidate, bool, error)
	ChangeDownload(context.Context, string, string, func(DownloadSnapshot) (model.DownloadTask, error)) (model.DownloadTask, error)
	RenewDownload(context.Context, DownloadClaim, time.Time, time.Time) error
	CheckpointDownload(context.Context, DownloadClaim, time.Time, int64, float64) error
	RetargetDownload(context.Context, string, string, int64, string, string, string, func(DownloadSnapshot) error) (model.DownloadTask, error)
	DeleteDownload(context.Context, DownloadClaim, func(DownloadSnapshot) error) error
}

// DownloadSourceError 保留底层错误链，但公开Error只包含稳定分类，避免url.Error泄露签名参数。
type DownloadSourceError struct {
	Failure    model.DownloadFailure
	StatusCode int
	Cause      error
}

func (e *DownloadSourceError) Error() string { return "offline source: " + string(e.Failure) }
func (e *DownloadSourceError) Unwrap() error { return e.Cause }
func (e *DownloadSourceError) Is(target error) bool {
	switch e.Failure {
	case model.DownloadFailureBlocked:
		return target == model.ErrDownloadSourceBlocked
	case model.DownloadFailureChanged:
		return target == model.ErrDownloadSourceChanged
	case model.DownloadFailureResume:
		return target == model.ErrDownloadResumeUnsupported
	case model.DownloadFailureLarge:
		return target == model.ErrTooLarge
	case model.DownloadFailureNetwork, model.DownloadFailureTimeout, model.DownloadFailureStatus, model.DownloadFailureIncomplete:
		return target == model.ErrDownloadSourceUnavailable
	default:
		return false
	}
}
