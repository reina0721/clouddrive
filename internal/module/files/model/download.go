package model

import (
	"errors"
	"math"
	"time"
	"unicode/utf8"
)

const (
	MaxDownloadClientKeyBytes = 64
	MaxDownloadBatchEntries   = 20
	MaxDownloadOwnerRecords   = 200
	MaxDownloadGlobalRecords  = 2000
	MaxDownloadAttempts       = 20
	MaxDownloadURLBytes       = 4096
	MaxDownloadValidatorBytes = 1024
	MaxDownloadMediaTypeBytes = 256
	MaxDownloadRevision       = MaxContentRevision
)

var (
	ErrDownloadUnavailable       = errors.New("offline download dispatcher unavailable")
	ErrDownloadLimit             = errors.New("offline download budget exhausted")
	ErrDownloadLeaseLost         = errors.New("offline download publication lease lost")
	ErrDownloadSourceBlocked     = errors.New("offline download source blocked")
	ErrDownloadSourceChanged     = errors.New("offline download source changed")
	ErrDownloadResumeUnsupported = errors.New("offline download source cannot safely resume")
	ErrDownloadSourceUnavailable = errors.New("offline download source unavailable")
	ErrDownloadPermission        = errors.New("offline download permission unavailable")
	ErrDownloadMetadataLimited   = errors.New("offline destination metadata budget exhausted")
)

type DownloadKind string

const (
	DownloadHTTP       DownloadKind = "http"
	DownloadBitTorrent DownloadKind = "bittorrent"
)

type DownloadState string

const (
	DownloadQueued     DownloadState = "queued"
	DownloadResolving  DownloadState = "resolving"
	DownloadSelecting  DownloadState = "selecting"
	DownloadCanceling  DownloadState = "canceling"
	DownloadFetching   DownloadState = "fetching"
	DownloadPausing    DownloadState = "pausing"
	DownloadPaused     DownloadState = "paused"
	DownloadPublishing DownloadState = "publishing"
	DownloadCompleted  DownloadState = "completed"
	DownloadFailed     DownloadState = "failed"
	DownloadCanceled   DownloadState = "canceled"
	DownloadExpired    DownloadState = "expired"
)

func (s DownloadState) Valid() bool {
	switch s {
	case DownloadQueued, DownloadResolving, DownloadSelecting, DownloadCanceling, DownloadFetching, DownloadPausing, DownloadPaused, DownloadPublishing, DownloadCompleted, DownloadFailed, DownloadCanceled, DownloadExpired:
		return true
	default:
		return false
	}
}
func (s DownloadState) Finished() bool {
	return s == DownloadCompleted || s == DownloadFailed || s == DownloadCanceled || s == DownloadExpired
}

type DownloadIntent string

const (
	DownloadRun    DownloadIntent = "run"
	DownloadPause  DownloadIntent = "pause"
	DownloadCancel DownloadIntent = "cancel"
)

func (i DownloadIntent) Valid() bool {
	return i == DownloadRun || i == DownloadPause || i == DownloadCancel
}

type DownloadValidatorKind string

const (
	DownloadValidatorNone DownloadValidatorKind = ""
	DownloadValidatorETag DownloadValidatorKind = "etag"
	DownloadValidatorDate DownloadValidatorKind = "last-modified"
)

func (k DownloadValidatorKind) Valid() bool {
	return k == DownloadValidatorNone || k == DownloadValidatorETag || k == DownloadValidatorDate
}

type DownloadFailure string

const (
	DownloadFailureNone        DownloadFailure = ""
	DownloadFailureNetwork     DownloadFailure = "network"
	DownloadFailureTimeout     DownloadFailure = "timeout"
	DownloadFailureStatus      DownloadFailure = "source-status"
	DownloadFailureChanged     DownloadFailure = "source-changed"
	DownloadFailureResume      DownloadFailure = "resume-unsupported"
	DownloadFailureBlocked     DownloadFailure = "source-blocked"
	DownloadFailureLarge       DownloadFailure = "too-large"
	DownloadFailureFilename    DownloadFailure = "filename-restricted"
	DownloadFailureQuota       DownloadFailure = "quota"
	DownloadFailureDestination DownloadFailure = "destination"
	DownloadFailurePermission  DownloadFailure = "permission"
	DownloadFailureStorage     DownloadFailure = "storage"
	DownloadFailureLease       DownloadFailure = "lease-lost"
	DownloadFailureCleanup     DownloadFailure = "cleanup"
	DownloadFailureAttempts    DownloadFailure = "attempt-limit"
	DownloadFailureExpired     DownloadFailure = "expired"
	DownloadFailureIncomplete  DownloadFailure = "incomplete"
	DownloadFailureMetadata    DownloadFailure = "metadata"
	DownloadFailureNode        DownloadFailure = "node"
	DownloadFailureWriteLocked DownloadFailure = "write-locked"
)

func (f DownloadFailure) Valid() bool {
	switch f {
	case DownloadFailureNone, DownloadFailureNetwork, DownloadFailureTimeout, DownloadFailureStatus, DownloadFailureChanged, DownloadFailureResume, DownloadFailureBlocked, DownloadFailureLarge, DownloadFailureFilename, DownloadFailureQuota, DownloadFailureDestination, DownloadFailurePermission, DownloadFailureStorage, DownloadFailureLease, DownloadFailureCleanup, DownloadFailureAttempts, DownloadFailureExpired, DownloadFailureIncomplete, DownloadFailureMetadata, DownloadFailureNode, DownloadFailureWriteLocked:
		return true
	default:
		return false
	}
}

// DownloadTask 是任务本身的持久事实；源与租约只能经消费方DTO投影，不直接输出到协议。
// Revision 仅控制用户命令并发，进度和心跳不推进该版本，避免后台更新阻碍暂停操作。
type DownloadTask struct {
	ID                 string                `json:"-"`
	OwnerID            string                `json:"-"`
	Kind               DownloadKind          `json:"-"`
	SourceURI          string                `json:"-"`
	EffectiveURI       string                `json:"-"`
	SourceOrigin       string                `json:"-"`
	TargetParentID     string                `json:"-"`
	RequestedName      string                `json:"-"`
	ClientKey          string                `json:"-"`
	State              DownloadState         `json:"-"`
	Intent             DownloadIntent        `json:"-"`
	ValidatorKind      DownloadValidatorKind `json:"-"`
	ValidatorValue     string                `json:"-"`
	DeclaredBytes      *int64                `json:"-"`
	ReceivedBytes      int64                 `json:"-"`
	RateBytesPerSecond float64               `json:"-"`
	ProgressAt         *time.Time            `json:"-"`
	MediaType          string                `json:"-"`
	FailureCode        DownloadFailure       `json:"-"`
	SourceStatus       int                   `json:"-"`
	Attempts           int                   `json:"-"`
	LeaseToken         string                `json:"-"`
	LeaseUntil         *time.Time            `json:"-"`
	Revision           int64                 `json:"-"`
	CreatedAt          time.Time             `json:"-"`
	UpdatedAt          time.Time             `json:"-"`
	StartedAt          *time.Time            `json:"-"`
	FinishedAt         *time.Time            `json:"-"`
	ExpiresAt          time.Time             `json:"-"`
}

// LeaseValid 只确认当前领取者的时限；发布还必须核对意图、状态和具体token。
func (t DownloadTask) LeaseValid(now time.Time) bool {
	return t.LeaseToken != "" && t.LeaseUntil != nil && now.Before(*t.LeaseUntil)
}

// ValidateDownloadTask 拒绝损坏的私有持久化，不用空URL、默认状态或零租约掩盖读取失败。
func ValidateDownloadTask(t DownloadTask) error {
	if t.Kind == DownloadHTTP && (t.State == DownloadResolving || t.State == DownloadSelecting || t.State == DownloadCanceling) {
		return ErrInvalid
	}
	if ValidateTransferID(t.ID) != nil || t.OwnerID == "" || (t.Kind != DownloadHTTP && t.Kind != DownloadBitTorrent) || !t.State.Valid() || !t.Intent.Valid() || !t.ValidatorKind.Valid() || !t.FailureCode.Valid() || t.Revision < 1 || t.Revision > MaxDownloadRevision || t.Attempts < 0 || t.Attempts > MaxDownloadAttempts {
		return ErrInvalid
	}
	for _, value := range []string{t.SourceURI, t.EffectiveURI, t.SourceOrigin} {
		if !utf8.ValidString(value) || len(value) > MaxDownloadURLBytes {
			return ErrInvalid
		}
	}
	if t.SourceURI == "" || t.SourceOrigin == "" || !utf8.ValidString(t.ValidatorValue) || len(t.ValidatorValue) > MaxDownloadValidatorBytes || !utf8.ValidString(t.MediaType) || len(t.MediaType) > MaxDownloadMediaTypeBytes {
		return ErrInvalid
	}
	if t.RequestedName != "" && ValidateName(t.RequestedName) != nil {
		return ErrInvalid
	}
	if t.TargetParentID != "" && ValidateTransferID(t.TargetParentID) != nil {
		return ErrInvalid
	}
	for _, character := range t.ClientKey {
		if character < 33 || character > 126 {
			return ErrInvalid
		}
	}
	if len(t.ClientKey) < 16 || len(t.ClientKey) > MaxDownloadClientKeyBytes || !utf8.ValidString(t.ClientKey) {
		return ErrInvalid
	}
	if t.ReceivedBytes < 0 || t.ReceivedBytes > MaxFileContentBytes || t.RateBytesPerSecond < 0 || math.IsNaN(t.RateBytesPerSecond) || math.IsInf(t.RateBytesPerSecond, 0) {
		return ErrInvalid
	}
	if t.DeclaredBytes != nil && (*t.DeclaredBytes < 0 || *t.DeclaredBytes > MaxFileContentBytes || t.ReceivedBytes > *t.DeclaredBytes) {
		return ErrInvalid
	}
	if (t.ValidatorKind == DownloadValidatorNone) != (t.ValidatorValue == "") || (t.LeaseToken == "") != (t.LeaseUntil == nil) {
		return ErrInvalid
	}
	if t.LeaseToken != "" && ValidateTransferID(t.LeaseToken) != nil {
		return ErrInvalid
	}
	if t.SourceStatus != 0 && (t.SourceStatus < 100 || t.SourceStatus > 599) {
		return ErrInvalid
	}
	if t.CreatedAt.IsZero() || t.UpdatedAt.Before(t.CreatedAt) || !t.ExpiresAt.After(t.CreatedAt) {
		return ErrInvalid
	}
	return nil
}
