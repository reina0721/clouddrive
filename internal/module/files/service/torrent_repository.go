package service

import (
	"context"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

const (
	MaxTorrentOwnerMetadataBytes    int64 = 4 << 20
	MaxTorrentGlobalMetadataBytes   int64 = 16 << 20
	TorrentMetadataReservationBytes int64 = 128 << 20
	TorrentPayloadOverheadBytes     int64 = 2 * MaxTorrentMetadataBytes
	MaxTorrentBindings                    = model.MaxDownloadAttempts * 2
)

// TorrentData 是私有的元数据和结果聚合；原始种子不进入产品列表或日志。
type TorrentData struct {
	TaskID         string
	NodeID         string
	InfoHash       string
	Name           string
	Metadata       []byte
	TotalBytes     int64
	ResultFolderID string
	Files          []TorrentSelectionFile
	Folders        []TorrentFolder
}

// TorrentFolder 保存发布前已分配的稳定目录身份，使重启后不重建另一套目录。
type TorrentFolder struct {
	Path     string
	EntryID  string
	ParentID string
	Name     string
}

type TorrentSelectionFile struct {
	TorrentFile
	Selected   bool
	TransferID string
}

// TorrentBinding 在调用节点之前持久化，未知结果也必须保留预算和清理账本。
type TorrentBinding struct {
	GID               string
	TaskID            string
	OwnerID           string
	NodeID            string
	ClaimToken        string
	Phase             TorrentJobPhase
	WorkspaceIdentity string
	NodeSessionID     string
	ReservedBytes     int64
	Submitted         bool
	Accepted          bool
	Stopped           bool
	Cleaned           bool
	CreatedAt         time.Time
}

type TorrentSnapshot struct {
	Task                  model.DownloadTask
	Data                  TorrentData
	Bindings              []TorrentBinding
	Transfers             []model.Transfer
	Entries               []model.Entry
	HistoryPreferences    model.HistoryPreferences
	MetadataLimited       bool
	OwnerReservedBytes    int64
	OwnerReservedCount    int64
	GlobalReservedBytes   int64
	GlobalReservedCount   int64
	OwnerMetadataBytes    int64
	GlobalMetadataBytes   int64
	NodeReservedBytes     int64
	NodeActiveTasks       int
	NodeHashActiveTasks   int
	GlobalActiveTasks     int
	OwnerDownloadRecords  int
	GlobalDownloadRecords int
}

// TorrentMutation 在一个storage/owner事务中写入任务、所选候选和全部目录项。
// Bindings只增或推进，不能删除未知清理结果；数据对象补偿仍由用例负责。
type TorrentMutation struct {
	Claim     *DownloadClaim
	Task      model.DownloadTask
	Data      TorrentData
	Bindings  []TorrentBinding
	Transfers []model.Transfer
	Entries   []model.Entry
	Delete    bool
}

type TorrentRepository interface {
	CreateTorrent(context.Context, model.DownloadTask, TorrentData, func(TorrentSnapshot) error) (TorrentSnapshot, error)
	ReadTorrent(context.Context, string, string) (TorrentSnapshot, error)
	ChangeTorrent(context.Context, string, string, func(TorrentSnapshot) (TorrentMutation, error)) (TorrentSnapshot, error)
	NextTorrent(context.Context, time.Time, int, int) (DownloadCandidate, bool, error)
	RecordTorrentSubmission(context.Context, DownloadClaim, string, TorrentSubmissionOutcome) error
}

type TorrentSubmissionOutcome string

const (
	TorrentSubmissionAccepted TorrentSubmissionOutcome = "accepted"
	TorrentSubmissionUnsent   TorrentSubmissionOutcome = "unsent"
)
